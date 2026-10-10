import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomUUID } from 'crypto';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { getCourseAssetsBucket, CourseAssetsBindingError } from '@/lib/services/course-assets-r2';
import {
  COURSE_UPLOAD_JOB_TTL_SECONDS,
  courseUploadJobKey,
  type CourseManagementQueueMessage,
  type CourseUploadJob,
} from '@/lib/services/course-upload-queue';
import {
  buildCourseAssetKey,
  extensionOf,
  formatFileSize,
  isUrlResourceType,
  mimeTypeFor,
  sanitizeFileName,
  validateExtensionForType,
  validateFileSignature,
  validateFileSize,
  validateResourceType,
} from '@/lib/services/course-resource-validation';

export const runtime = 'nodejs';

interface QueueLike<T> {
  send(message: T): Promise<void>;
}

interface UploadBindings {
  COURSE_MANAGEMENT_UPLOAD_QUEUE?: QueueLike<CourseManagementQueueMessage>;
  RATE_LIMIT_KV?: {
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
    delete(key: string): Promise<void>;
  };
}

/**
 * POST /api/courses/resource-upload - Validate and enqueue a course file upload.
 * multipart/form-data: file (File, required), resourceType (string, required),
 * resourceName (string, required).
 *
 * Validation (canonical — bulk processing enforces the same rules):
 * type → extension → declared size → magic-number signature → staged R2 object.
 * The consumer moves the staged asset to its final storage location.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateSSORequest(request, [
      'admin',
      'super_admin',
      'rm_admin',
      'platform_admin',
    ]);
    if (authError || !user) {
      return authError || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const resourceType = String(formData.get('resourceType') || '').toLowerCase();
    const resourceName = String(formData.get('resourceName') || '').trim();
    const rawUploadTarget = String(formData.get('uploadTarget') || 'resource');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'File is required' }, { status: 400 });
    }
    const typeError = validateResourceType(resourceType);
    if (typeError) {
      return NextResponse.json({ success: false, error: typeError }, { status: 400 });
    }
    if (!resourceName) {
      return NextResponse.json({ success: false, error: 'resourceName is required' }, { status: 400 });
    }
    if ((rawUploadTarget !== 'resource' && rawUploadTarget !== 'course-image') ||
        (rawUploadTarget === 'course-image' && resourceType !== 'image')) {
      return NextResponse.json({ success: false, error: 'Invalid upload target' }, { status: 400 });
    }
    const uploadTarget = rawUploadTarget;

    // URL-only types never go through file upload
    if (isUrlResourceType(resourceType)) {
      return NextResponse.json(
        { success: false, error: `Resource type '${resourceType}' is URL-based and does not accept file uploads` },
        { status: 400 }
      );
    }

    const sizeError = validateFileSize(file.size, resourceType);
    if (sizeError) {
      return NextResponse.json({ success: false, error: sizeError }, { status: 400 });
    }

    const originalName = sanitizeFileName(file.name || 'file');
    const extError = validateExtensionForType(originalName, resourceType);
    if (extError) {
      return NextResponse.json({ success: false, error: extError }, { status: 400 });
    }

    // Single buffered copy: hash + upload share the same Uint8Array view
    // (no duplicate Buffer.from(arrayBuffer) allocation).
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength !== file.size) {
      return NextResponse.json({ success: false, error: 'Upload was truncated, please retry' }, { status: 400 });
    }
    const signatureError = validateFileSignature(bytes, originalName);
    if (signatureError) {
      return NextResponse.json({ success: false, error: signatureError }, { status: 400 });
    }
    const contentHash = createHash('sha256').update(bytes).digest('hex');
    const ext = extensionOf(originalName);
    const mimeType = mimeTypeFor(originalName, file.type);

    const now = new Date();
    const stem = ext ? originalName.slice(0, -ext.length) : originalName;
    const r2Key = buildCourseAssetKey(stem, contentHash, ext, now);

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
    const jobId = randomUUID();
    const uploaderId = String(
      (user as { userId?: string; id?: string }).userId ||
        (user as { id?: string }).id ||
        'unknown',
    );
    const stagingKey = `_queued/course-uploads/${jobId}/${originalName}`;
    let bindings: UploadBindings | undefined;
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const context = await getCloudflareContext({ async: true }) as unknown as { env?: UploadBindings };
      bindings = context?.env;
    } catch (error) {
      console.error('[Course Resource Upload] Failed to access upload queue bindings:', error);
    }

    const queue = bindings?.COURSE_MANAGEMENT_UPLOAD_QUEUE;
    const kv = bindings?.RATE_LIMIT_KV;
    if (!queue || !kv) {
      if (process.env.NODE_ENV === 'development') {
        const localKey = r2Key;
        await bucket.put(localKey, bytes, {
          httpMetadata: { contentType: mimeType },
          customMetadata: {
            originalFileName: originalName,
            uploadedBy: uploaderId,
            uploadedAt: now.toISOString(),
            resourceType,
            resourceName: resourceName.slice(0, 255),
            contentHash,
          },
        });
        const r2Url = `/api/courses/assets?key=${encodeURIComponent(localKey)}`;
        return NextResponse.json({
          success: true,
          r2Key: localKey,
          r2Url,
          fileName: originalName,
          fileSize: formatFileSize(file.size),
          fileSizeBytes: file.size,
          mimeType,
          contentHash,
          status: 'completed',
        });
      }
      return NextResponse.json(
        { success: false, error: 'Course upload queue is not configured. Contact support.' },
        { status: 503 },
      );
    }

    const message: CourseManagementQueueMessage = {
      kind: 'file-upload',
      jobId,
      stagingKey,
      r2Key,
      fileName: originalName,
      resourceName: resourceName.slice(0, 255),
      fileSize: formatFileSize(file.size),
      fileSizeBytes: file.size,
      mimeType,
      contentHash,
      resourceType,
      uploadTarget,
      uploaderId,
    };
    const job: CourseUploadJob = {
      jobId,
      ownerId: uploaderId,
      status: 'queued',
      fileName: originalName,
      resourceType,
      uploadTarget,
      createdAt: now.toISOString(),
    };

    try {
      await bucket.put(stagingKey, bytes, {
        httpMetadata: { contentType: mimeType },
        customMetadata: {
          originalFileName: originalName,
          uploadedBy: uploaderId,
          uploadedAt: now.toISOString(),
          resourceType,
          resourceName: resourceName.slice(0, 255),
          contentHash,
        },
      });
      await kv.put(courseUploadJobKey(jobId), JSON.stringify(job), {
        expirationTtl: COURSE_UPLOAD_JOB_TTL_SECONDS,
      });
      await queue.send(message);
    } catch (error) {
      await bucket.delete(stagingKey).catch((cleanupError) => {
        console.error('[Course Resource Upload] Failed to clean up staged file:', cleanupError);
      });
      await kv.delete(courseUploadJobKey(jobId)).catch((cleanupError) => {
        console.error('[Course Resource Upload] Failed to clean up queued job:', cleanupError);
      });
      throw error;
    }

    return NextResponse.json(
      { success: true, jobId, status: 'queued', fileName: originalName },
      { status: 202 },
    );
  } catch (error) {
    console.error('[Course Resource Upload] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload resource', details: (error as Error).message },
      { status: 500 }
    );
  }
}
