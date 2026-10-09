import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { getCourseAssetsBucket, CourseAssetsBindingError } from '@/lib/services/course-assets-r2';
import {
  buildCourseAssetKey,
  extensionOf,
  formatFileSize,
  getResourceTypeConfig,
  isUrlResourceType,
  mimeTypeFor,
  sanitizeFileName,
  validateExtensionForType,
  validateFileSignature,
  validateFileSize,
  validateResourceType,
} from '@/lib/services/course-resource-validation';

export const runtime = 'nodejs';

/**
 * POST /api/courses/resource-upload - Upload a course resource file to R2.
 * multipart/form-data: file (File, required), resourceType (string, required),
 * resourceName (string, required).
 *
 * Validation (canonical — bulk processing enforces the same rules):
 * type → extension → declared size → magic-number signature → R2 put.
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
    const config = getResourceTypeConfig(resourceType);
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
    await bucket.put(r2Key, bytes, {
      httpMetadata: { contentType: mimeType },
      customMetadata: {
        originalFileName: originalName,
        uploadedBy: String(
          (user as { userId?: string; id?: string }).userId ||
            (user as { id?: string }).id ||
            'unknown',
        ),
        uploadedAt: now.toISOString(),
        resourceType,
        resourceName: resourceName.slice(0, 255),
        contentHash,
      },
    });

    const r2Url = `/api/courses/assets?key=${encodeURIComponent(r2Key)}`;

    return NextResponse.json(
      {
        success: true,
        r2Key,
        r2Url,
        fileName: originalName,
        fileSize: formatFileSize(file.size),
        fileSizeBytes: file.size,
        mimeType,
        contentHash,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Course Resource Upload] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload resource', details: (error as Error).message },
      { status: 500 }
    );
  }
}
