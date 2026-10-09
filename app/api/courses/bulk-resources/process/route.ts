import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCourseAssetsBucket, CourseAssetsBindingError } from '@/lib/services/course-assets-r2';
import { getBulkPreview } from '@/lib/services/bulk-preview-store';
import {
  BULK_MAX_FILES_PER_REQUEST,
  BULK_MAX_RESOURCES_PER_BATCH,
  buildCourseAssetKey,
  chunkArray,
  extensionOf,
  formatFileSize,
  isUrlResourceType,
  mimeTypeFor,
  sanitizeFileName,
  SUPABASE_IN_CHUNK_SIZE,
  validateExtensionForType,
  validateFileSignature,
  validateFileSize,
  validateOptionalUrl,
  validateResourceType,
  validateResourceUrl,
} from '@/lib/services/course-resource-validation';
import Logger from '@/lib/logger';

const logger = new Logger('Bulk Resource Process');

export const runtime = 'nodejs';
export const maxDuration = 300;

interface IncomingResource {
  lesson_id: string;
  resource_name: string;
  resource_type: string;
  resource_url?: string;
  file_path?: string;
  file_size?: string;
  thumbnail_url?: string;
  embed_url?: string;
  order_index?: number;
  course_id?: string;
  rowNumber?: number;
}

/**
 * POST /api/courses/bulk-resources/process - Upload files to R2 and insert lesson_resources.
 * multipart/form-data: payload (JSON { previewId, resources }), files (File[], optional)
 *
 * Consistency: applies the SAME canonical validation as preview + single upload.
 * Safety: bounded batches, chunked lesson validation, per-file errors, orphan
 * cleanup (R2 object deleted when its DB insert fails), in-batch dedup so
 * client retries don't create duplicate rows.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateSSORequest(request, [
      'admin',
      'super_admin',
      'rm_admin',
    ]);
    if (authError || !user) {
      return authError || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const payloadRaw = formData.get('payload');
    if (!payloadRaw || typeof payloadRaw !== 'string') {
      return NextResponse.json({ success: false, error: 'payload JSON field is required' }, { status: 400 });
    }

    let payload: { previewId?: string; resources?: IncomingResource[] };
    try {
      payload = JSON.parse(payloadRaw);
    } catch {
      return NextResponse.json({ success: false, error: 'payload must be valid JSON' }, { status: 400 });
    }

    // Best-effort preview validation: the client always resubmits the full
    // resource list, so a missing/expired preview (e.g. different isolate)
    // is a warning, not a hard error.
    if (payload.previewId && !getBulkPreview(payload.previewId)) {
      logger.warn('Bulk resource preview was unavailable; continuing with submitted resources', {
        previewId: payload.previewId,
      });
    }

    const resources = Array.isArray(payload.resources) ? payload.resources : [];
    if (resources.length === 0) {
      return NextResponse.json({ success: false, error: 'No resources to process' }, { status: 400 });
    }
    if (resources.length > BULK_MAX_RESOURCES_PER_BATCH) {
      return NextResponse.json(
        { success: false, error: `Maximum ${BULK_MAX_RESOURCES_PER_BATCH} resources per batch. Split the template and retry.` },
        { status: 400 }
      );
    }

    const files = formData.getAll('files').filter((f): f is File => f instanceof File);
    if (files.length > BULK_MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        { success: false, error: `Maximum ${BULK_MAX_FILES_PER_REQUEST} files per request. Split the upload and retry.` },
        { status: 400 }
      );
    }
    const fileByName = new Map<string, File>();
    for (const f of files) {
      fileByName.set(f.name, f);
      const base = f.name.split('/').pop() || f.name;
      if (!fileByName.has(base)) fileByName.set(base, f);
    }

    const bucket = await getCourseAssetsBucket().catch((err) => {
      if (err instanceof CourseAssetsBindingError) return null;
      throw err;
    });
    if (!bucket) {
      return NextResponse.json(
        { success: false, error: 'Resource storage is not configured. Contact support.' },
        { status: 503 }
      );
    }
    const uploaderId = String((user as { userId?: string; id?: string }).userId || (user as { id?: string }).id || 'unknown');

    // Validate all lesson_ids exist up-front (chunked to respect URL limits)
    const lessonIds = Array.from(new Set(resources.map((r) => r.lesson_id).filter(Boolean)));
    const validLessonIds = new Set<string>();
    for (const chunk of chunkArray(lessonIds, SUPABASE_IN_CHUNK_SIZE)) {
      const { data: existingLessons, error: lessonsError } = await supabaseAdmin
        .from('lessons')
        .select('lesson_id')
        .in('lesson_id', chunk);
      if (lessonsError) {
        return NextResponse.json({ success: false, error: 'Failed to validate lessons', details: lessonsError.message }, { status: 500 });
      }
      for (const l of existingLessons || []) validLessonIds.add(l.lesson_id);
    }

    let processedResources = 0;
    let skippedDuplicates = 0;
    const affectedCourses = new Set<string>();
    const seenInBatch = new Set<string>();
    const errors: Array<{ row?: number; resource: string; error: string }> = [];

    for (const res of resources) {
      const label = res.resource_name || res.file_path || 'unnamed';
      let uploadedKey: string | null = null;
      try {
        const type = String(res.resource_type || '').toLowerCase();
        if (!res.lesson_id || !validLessonIds.has(res.lesson_id)) {
          throw new Error(`lesson_id '${res.lesson_id || '(missing)'}' not found`);
        }
        if (!res.resource_name?.trim()) throw new Error('resource_name is required');
        const typeError = validateResourceType(type);
        if (typeError) throw new Error(typeError);

        let url = (res.resource_url || '').trim();
        let fileSize = res.file_size || '';

        if (!url && res.file_path) {
          if (isUrlResourceType(type)) {
            throw new Error(`Resource type '${type}' requires resource_url, not file_path`);
          }
          const baseName = res.file_path.split('/').pop() || res.file_path;
          const file = fileByName.get(res.file_path) || fileByName.get(baseName);
          if (!file) throw new Error(`Uploaded file not found for file_path '${res.file_path}'`);

          const sizeError = validateFileSize(file.size, type);
          if (sizeError) throw new Error(sizeError);
          const originalName = sanitizeFileName(file.name);
          const extError = validateExtensionForType(originalName, type);
          if (extError) throw new Error(extError);

          const bytes = new Uint8Array(await file.arrayBuffer());
          if (bytes.byteLength !== file.size) {
            throw new Error(`Upload '${originalName}' was truncated, please retry`);
          }
          const signatureError = validateFileSignature(bytes, originalName);
          if (signatureError) throw new Error(signatureError);

          const contentHash = createHash('sha256').update(bytes).digest('hex');
          const ext = extensionOf(originalName);
          const stem = (ext ? originalName.slice(0, -ext.length) : originalName) || 'file';
          const now = new Date();
          uploadedKey = buildCourseAssetKey(stem, contentHash, ext, now);
          const mimeType = mimeTypeFor(originalName, file.type);

          await bucket.put(uploadedKey, bytes, {
            httpMetadata: { contentType: mimeType },
            customMetadata: {
              originalFileName: originalName,
              uploadedBy: uploaderId,
              uploadedAt: now.toISOString(),
              resourceType: type,
              resourceName: res.resource_name.slice(0, 255),
              contentHash,
            },
          });

          url = `/api/courses/assets?key=${encodeURIComponent(uploadedKey)}`;
          fileSize = formatFileSize(file.size);
        }

        if (!url) throw new Error('Either resource_url or a matching uploaded file is required');
        const urlError = validateResourceUrl(url, type);
        // R2-backed URLs (/api/courses/assets?...) are system-generated; only
        // external URLs need strict youtube/drive shape validation here.
        if (urlError && !url.startsWith('/api/courses/assets?')) throw new Error(urlError);
        const thumbError = validateOptionalUrl(res.thumbnail_url || '', 'thumbnail_url');
        if (thumbError) throw new Error(thumbError);
        const embedError = validateOptionalUrl(res.embed_url || '', 'embed_url');
        if (embedError) throw new Error(embedError);

        // In-batch idempotency: exact duplicates (retry/double-submit) are
        // skipped instead of inserted twice.
        const dedupKey = `${res.lesson_id}|${type}|${res.resource_name.trim().toLowerCase()}|${url}`;
        if (seenInBatch.has(dedupKey)) {
          skippedDuplicates += 1;
          continue;
        }
        seenInBatch.add(dedupKey);

        const { error: insertError } = await supabaseAdmin.from('lesson_resources').insert({
          lesson_id: res.lesson_id,
          name: res.resource_name.trim(),
          type,
          url,
          file_size: fileSize || null,
          thumbnail_url: res.thumbnail_url || null,
          embed_url: res.embed_url || null,
          order_index: Number(res.order_index) || 0,
        });
        if (insertError) throw new Error(insertError.message);

        processedResources += 1;
        if (res.course_id) affectedCourses.add(res.course_id);
      } catch (err) {
        // Orphan cleanup: don't leave an R2 object without its DB record.
        if (uploadedKey) {
          try {
            await bucket.delete(uploadedKey);
          } catch (cleanupError) {
            logger.warn('Failed to clean up orphaned R2 object', { uploadedKey, cleanupError });
          }
        }
        errors.push({ row: res.rowNumber, resource: label, error: (err as Error).message });
        // Continue processing other resources per TSD error handling
      }
    }

    return NextResponse.json({
      success: true,
      processedResources,
      skippedDuplicates,
      affectedCourses: affectedCourses.size,
      totalReceived: resources.length,
      errors,
    });
  } catch (error) {
    logger.error('Failed to process bulk resources', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to process bulk resources', details: (error as Error).message },
      { status: 500 }
    );
  }
}
