import { NextRequest, NextResponse } from 'next/server';
import Logger, { getErrorMessage } from '@/lib/logger';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseLTE } from '@/lib/supabase-lte';
import { LTEPublishResult } from '@/types/lte-ingestion';
import { calculateHash } from '@/lib/services/lte-ingestion/snapshot-serializer';

const logger = new Logger('LTEPublishAPI');

export const runtime = 'nodejs';

interface PublishRequest {
  uploadId: string;
  confirm: boolean;
}

interface PublishRPCResult {
  status: 'published' | 'error';
  message?: string;
  errorCode?: string;
  inserted?: number;
  skipped?: number;
  tableSummary?: Record<string, { inserted: number; skipped: number }>;
}

/**
 * POST /api/admin/lte/publish
 * Publishes a validated LTE catalog snapshot to production tables
 */
export async function POST(request: NextRequest): Promise<NextResponse<LTEPublishResult>> {
  logger.info('Received LTE publish request');

  try {
    // Step 1: Authenticate and verify publish permission (super_admin or platform_admin only)
    const { user, error: authError } = await authenticateSSORequest(
      request,
      ['super_admin', 'platform_admin']
    );

    if (authError || !user) {
      logger.warn('Unauthorized publish attempt');
      return authError || NextResponse.json(
        {
          success: false,
          status: 'rejected',
          inserted: 0,
          skipped: 0,
          completedAt: new Date().toISOString(),
          error: 'Insufficient permissions. Publish requires super_admin or platform_admin role.',
        },
        { status: 403 }
      );
    }

    logger.info('User authenticated for publish', { userId: user.userId, role: user.role });

    // Step 2: Parse request body
    const body = (await request.json()) as PublishRequest;

    if (!body.uploadId) {
      logger.warn('Publish request missing uploadId');
      return NextResponse.json(
        {
          success: false,
          status: 'rejected',
          inserted: 0,
          skipped: 0,
          completedAt: new Date().toISOString(),
          error: 'Missing uploadId in request body',
        },
        { status: 400 }
      );
    }

    if (!body.confirm) {
      logger.warn('Publish request rejected: confirmation missing');
      return NextResponse.json(
        {
          success: false,
          status: 'rejected',
          inserted: 0,
          skipped: 0,
          completedAt: new Date().toISOString(),
          error: 'Explicit admin confirmation is required before publishing.',
        },
        { status: 400 }
      );
    }

    logger.info('Loading upload record', { uploadId: body.uploadId });

    // Step 3: Load upload record from lte_catalog_uploads
    const { data: uploadRecord, error: fetchError } = await supabaseLTE
      .from('lte_catalog_uploads')
      .select('*')
      .eq('id', body.uploadId)
      .single();

    if (fetchError || !uploadRecord) {
      logger.error('Upload not found', { uploadId: body.uploadId, error: fetchError });
      return NextResponse.json(
        {
          success: false,
          status: 'rejected',
          inserted: 0,
          skipped: 0,
          completedAt: new Date().toISOString(),
          error: 'Upload not found',
        },
        { status: 404 }
      );
    }

    // Step 4: Verify status === 'validated'
    if (uploadRecord.status !== 'validated') {
      logger.warn('Upload not in validated status', {
        uploadId: body.uploadId,
        status: uploadRecord.status,
      });
      return NextResponse.json(
        {
          success: false,
          status: 'rejected',
          inserted: 0,
          skipped: 0,
          completedAt: new Date().toISOString(),
          error: `Upload status is ${uploadRecord.status}, expected validated`,
        },
        { status: 400 }
      );
    }

    // Step 5: Recompute snapshot hash using canonical serializer
    const normalizedSnapshot = {
      tables: uploadRecord.normalized_snapshot?.tables || {},
      metadata: uploadRecord.normalized_snapshot?.metadata || {},
    };
    const recomputedHash = calculateHash(normalizedSnapshot as any);

    logger.info('Hash verification', {
      uploadId: body.uploadId,
      storedHash: uploadRecord.snapshot_hash,
      recomputedHash,
    });

    // Step 6: Verify recomputed hash === stored snapshot_hash
    if (recomputedHash !== uploadRecord.snapshot_hash) {
      logger.error('Hash mismatch detected', {
        uploadId: body.uploadId,
        storedHash: uploadRecord.snapshot_hash,
        recomputedHash,
      });
      return NextResponse.json(
        {
          success: false,
          status: 'rejected',
          inserted: 0,
          skipped: 0,
          completedAt: new Date().toISOString(),
          error: 'Snapshot hash mismatch - data may have been tampered with',
        },
        { status: 400 }
      );
    }

    logger.info('Calling publish RPC', {
      uploadId: body.uploadId,
      publishedBy: user.userId,
      expectedHash: uploadRecord.snapshot_hash,
    });

    // Step 7: Call publish_lte_catalog_snapshot() RPC with expected_snapshot_hash
    const { data: rpcResult, error: rpcError } = await supabaseLTE.rpc(
      'publish_lte_catalog_snapshot',
      {
        p_upload_id: body.uploadId,
        p_published_by: user.userId,
        p_expected_snapshot_hash: uploadRecord.snapshot_hash,
      }
    );

    if (rpcError) {
      logger.error('RPC call failed', { error: rpcError });

      // Update last_publish_error
      await supabaseLTE
        .from('lte_catalog_uploads')
        .update({
          last_publish_error: {
            errorAt: new Date().toISOString(),
            errorCode: rpcError.code,
            errorMessage: rpcError.message,
          },
          last_publish_attempt_at: new Date().toISOString(),
        })
        .eq('id', body.uploadId);

      return NextResponse.json(
        {
          success: false,
          status: 'publish_failed',
          inserted: 0,
          skipped: 0,
          completedAt: new Date().toISOString(),
          error: rpcError.message || 'Database publish failed',
        },
        { status: 500 }
      );
    }

    const result = rpcResult as PublishRPCResult;

    // Step 8: Handle RPC success or failure
    if (result.status === 'error') {
      logger.error('RPC returned error', { result });
      return NextResponse.json(
        {
          success: false,
          status: 'publish_failed',
          inserted: 0,
          skipped: 0,
          completedAt: new Date().toISOString(),
          error: result.message || 'Publish failed',
          errorCode: result.errorCode,
        },
        { status: 500 }
      );
    }

    // Step 9: Return success with inserted/skipped counts
    logger.info('Publish completed successfully', {
      uploadId: body.uploadId,
      inserted: result.inserted,
      skipped: result.skipped,
    });

    return NextResponse.json({
      success: true,
      status: 'published',
      inserted: result.inserted || 0,
      skipped: result.skipped || 0,
      tableSummary: result.tableSummary,
      completedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error('LTE Publish unexpected failure', { error: errorMessage });

    return NextResponse.json(
      {
        success: false,
        status: 'publish_failed',
        inserted: 0,
        skipped: 0,
        completedAt: new Date().toISOString(),
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
