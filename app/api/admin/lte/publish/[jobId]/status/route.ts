import { NextRequest, NextResponse } from 'next/server';
import Logger, { getErrorMessage } from '@/lib/logger';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { readPublishJobStatus } from '@/lib/services/lte-ingestion/publish-job';

const logger = new Logger('LTEPublishStatusAPI');

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<NextResponse> {
  try {
    const { user, error: authError } = await authenticateSSORequest(
      request,
      ['super_admin', 'platform_admin']
    );

    if (authError || !user) {
      return authError || NextResponse.json(
        { success: false, error: 'FORBIDDEN: Publish status requires admin access.' },
        { status: 403 }
      );
    }

    const { jobId } = await params;
    const { job, assets } = await readPublishJobStatus(jobId);
    const failedAssets = assets.filter((asset) => asset.status === 'FAILED');

    return NextResponse.json({
      success: true,
      publishJobId: job.id,
      uploadId: job.upload_id,
      status: job.status,
      inserted: job.inserted_count || 0,
      skipped: job.skipped_count || 0,
      tableSummary: job.table_summary || {},
      completedAt: job.completed_at,
      error: job.error_message,
      assetValidation: {
        total: job.total_assets || assets.length,
        validated: job.validated_assets || assets.filter((asset) => asset.status === 'VALID').length,
        failed: job.failed_assets || failedAssets.length,
        pending: assets.filter((asset) => ['PENDING', 'VALIDATING'].includes(asset.status)).length,
      },
      failedAssets: failedAssets.map((asset) => ({
        url: asset.asset_url,
        errorCode: asset.error_code,
        error: asset.error_message,
        attempts: asset.attempt_count,
      })),
    });
  } catch (error) {
    const message = getErrorMessage(error);
    logger.error('Failed to read LTE publish status', { error: message });
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
