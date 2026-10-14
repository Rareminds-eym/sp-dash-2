import { NextRequest, NextResponse } from 'next/server';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import {
  courseUploadJobKey,
  type CourseUploadJob,
} from '@/lib/services/course-upload-queue';

export const runtime = 'nodejs';

interface UploadStatusBindings {
  RATE_LIMIT_KV?: {
    get(key: string): Promise<string | null>;
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const { user, error: authError } = await authenticateSSORequest(request, [
    'admin',
    'super_admin',
    'rm_admin',
    'platform_admin',
  ]);
  if (authError || !user) {
    return authError || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { jobId } = await params;
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const context = await getCloudflareContext({ async: true }) as unknown as { env?: UploadStatusBindings };
    const kv = context?.env?.RATE_LIMIT_KV;
    if (!kv) {
      return NextResponse.json(
        { success: false, error: 'Course upload status storage is not configured.' },
        { status: 503 },
      );
    }

    const rawJob = await kv.get(courseUploadJobKey(jobId));
    if (!rawJob) {
      return NextResponse.json({ success: false, error: 'Upload job was not found or has expired.' }, { status: 404 });
    }
    const job = JSON.parse(rawJob) as CourseUploadJob;
    const uploaderId = String(
      (user as { userId?: string; id?: string }).userId ||
        (user as { id?: string }).id ||
        '',
    );
    const roles = (user as { roles?: string[]; role?: string }).roles || [];
    const role = (user as { role?: string }).role;
    const isAdmin = ['admin', 'super_admin', 'rm_admin', 'platform_admin'].some(
      (allowedRole) => roles.includes(allowedRole) || role === allowedRole,
    );
    if (job.ownerId !== uploaderId && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      jobId: job.jobId,
      status: job.status,
      fileName: job.fileName,
      resourceType: job.resourceType,
      r2Key: job.r2Key,
      r2Url: job.r2Url,
      url: job.url,
      fileSize: job.fileSize,
      fileSizeBytes: job.fileSizeBytes,
      mimeType: job.mimeType,
      contentHash: job.contentHash,
      result: job.result,
      error: job.error,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Course Upload Status] Failed to read job status:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
