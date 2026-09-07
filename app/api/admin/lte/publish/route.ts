import { NextRequest, NextResponse } from 'next/server';
import Logger, { getErrorMessage } from '@/lib/logger';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseLTE } from '@/lib/supabase-lte';
import { LTEPublishResult } from '@/types/lte-ingestion';
import { calculateHash } from '@/lib/services/lte-ingestion/snapshot-serializer';
import { processSnapshotAssets } from '@/lib/services/lte-ingestion/asset-processor';
import { getR2StorageService } from '@/lib/services/lte-ingestion/r2-runtime';

const logger = new Logger('LTEPublishAPI');

export const runtime = 'nodejs';

interface PublishRequest {
  uploadId: string;
  reviewedSnapshotHash: string;
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
 * Following LTE-CATALOG-PUBLISH-001-v2.1 Architecture Specification
 */
export async function POST(request: NextRequest): Promise<NextResponse<LTEPublishResult>> {
  logger.info('Received LTE publish request');

  try {
    // Step 1: Authenticate and verify elevated publish permission.
    const { user, error: authError } = await authenticateSSORequest(
      request,
      ['super_admin', 'platform_admin']
    );

    if (authError || !user) {
      logger.warn('Authentication failure during publish attempt');
      const statusCode = !user ? 401 : 403;
      return authError || NextResponse.json(
        {
          success: false,
          status: 'rejected',
          inserted: 0,
          skipped: 0,
          completedAt: new Date().toISOString(),
          error: statusCode === 401 
            ? 'UNAUTHENTICATED: Authentication token missing, invalid, or expired.'
            : 'FORBIDDEN: Insufficient permissions. Publish requires super_admin or platform_admin role.',
        },
        { status: statusCode }
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

    if (!body.reviewedSnapshotHash) {
      logger.warn('Publish request missing reviewedSnapshotHash');
      return NextResponse.json(
        {
          success: false,
          status: 'rejected',
          inserted: 0,
          skipped: 0,
          completedAt: new Date().toISOString(),
          error: 'Missing reviewedSnapshotHash in request body',
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

    const storedHash = uploadRecord.reviewed_snapshot_hash || uploadRecord.snapshot_hash;
    const rawSnapshot = uploadRecord.reviewed_snapshot || uploadRecord.normalized_snapshot;

    // Step 4: Evaluate Idempotency & Current Status
    if (uploadRecord.status === 'published') {
      logger.info('Upload is already published (idempotent replay)', { uploadId: body.uploadId });
      const summary = uploadRecord.publish_summary || {};
      return NextResponse.json({
        success: true,
        status: 'published',
        catalogPublished: true,
        assetsActive: true,
        inserted: summary.inserted || 0,
        skipped: summary.skipped || 0,
        tableSummary: summary.tableSummary,
        completedAt: uploadRecord.published_at || new Date().toISOString(),
      });
    }

    if (uploadRecord.status === 'publishing') {
      const leaseExpiresAt = uploadRecord.publish_lease_expires_at 
        ? new Date(uploadRecord.publish_lease_expires_at).getTime() 
        : 0;
      
      if (leaseExpiresAt > Date.now()) {
        logger.info('Publish operation is currently in progress (active lease)', { uploadId: body.uploadId });
        return NextResponse.json(
          {
            success: true,
            status: 'publishing',
            inserted: 0,
            skipped: 0,
            completedAt: new Date().toISOString(),
            error: 'PUBLISH_IN_PROGRESS: Catalog publish operation is currently processing.',
          },
          { status: 202 }
        );
      }
    }

    // Step 5: Server Stored Snapshot Integrity Check (Check 1)
    const normalizedSnapshot = {
      tables: rawSnapshot?.tables || {},
      metadata: rawSnapshot?.metadata || {},
    };
    const recomputedHash = calculateHash(normalizedSnapshot as any);

    logger.info('Server hash verification', {
      uploadId: body.uploadId,
      storedHash,
      recomputedHash,
    });

    if (recomputedHash !== storedHash) {
      logger.error('Stored snapshot hash integrity mismatch detected', {
        uploadId: body.uploadId,
        storedHash,
        recomputedHash,
      });

      // Mark status as publish_failed in separate transaction
      await supabaseLTE
        .from('lte_catalog_uploads')
        .update({
          status: 'publish_failed',
          last_publish_error: {
            errorAt: new Date().toISOString(),
            errorCode: 'INTEGRITY_MISMATCH',
            errorMessage: 'Stored snapshot hash mismatch - data integrity check failed',
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
          errorCode: 'INTEGRITY_MISMATCH',
          error: 'Snapshot integrity mismatch - server-stored snapshot failed hash verification.',
        },
        { status: 500 }
      );
    }

    // Step 6: Stale Admin Version Check (Check 2)
    if (body.reviewedSnapshotHash !== storedHash) {
      logger.warn('Stale review snapshot version conflict (requested hash != stored hash)', {
        uploadId: body.uploadId,
        requestedHash: body.reviewedSnapshotHash,
        storedHash,
      });

      // Keep status as 'validated' so admin can refresh review
      return NextResponse.json(
        {
          success: false,
          status: 'rejected',
          inserted: 0,
          skipped: 0,
          completedAt: new Date().toISOString(),
          errorCode: 'SNAPSHOT_CHANGED',
          error: 'SNAPSHOT_CHANGED: The reviewed snapshot version has changed. Please refresh and review the updated snapshot before publishing.',
        },
        { status: 409 }
      );
    }

    // Step 7: Atomic Claim (validated -> publishing)
    const leaseExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    const { data: claimedRows, error: claimError } = await supabaseLTE
      .from('lte_catalog_uploads')
      .update({
        status: 'publishing',
        publish_started_at: nowIso,
        publish_heartbeat_at: nowIso,
        publish_lease_expires_at: leaseExpiresAt,
      })
      .eq('id', body.uploadId)
      .eq('reviewed_snapshot_hash', body.reviewedSnapshotHash)
      .in('status', ['validated', 'publish_failed'])
      .select('id');

    if (claimError || !claimedRows || claimedRows.length === 0) {
      logger.warn('Failed to claim upload for publishing (concurrent request or invalid state)', {
        uploadId: body.uploadId,
        claimError,
      });

      return NextResponse.json(
        {
          success: false,
          status: 'rejected',
          inserted: 0,
          skipped: 0,
          completedAt: new Date().toISOString(),
          error: 'Unable to claim publication lock. Another request may be processing.',
        },
        { status: 409 }
      );
    }

    logger.info('Atomic claim acquired for publishing', { uploadId: body.uploadId });

    // Step 8: Asset extraction, SSRF validation, R2 key generation, URL replacement & Final Snapshot persistence (Transaction A)
    const heartbeat = async () => {
      const heartbeatAt = new Date();
      await supabaseLTE.from('lte_catalog_uploads').update({
        publish_heartbeat_at: heartbeatAt.toISOString(),
        publish_lease_expires_at: new Date(heartbeatAt.getTime() + 10 * 60 * 1000).toISOString(),
      }).eq('id', body.uploadId).eq('status', 'publishing');
    };

    let assetProcessing;
    try {
      assetProcessing = await processSnapshotAssets(rawSnapshot, body.uploadId, heartbeat);
    } catch (assetError) {
      const assetErrorMessage = getErrorMessage(assetError);
      await supabaseLTE.from('lte_catalog_uploads').update({
        status: 'publish_failed',
        asset_status: 'cleanup_pending',
        last_publish_error: {
          errorAt: new Date().toISOString(),
          errorCode: assetErrorMessage.startsWith('ASSET_VALIDATION_FAILED')
            ? 'ASSET_VALIDATION_FAILED'
            : 'ASSET_UPLOAD_FAILED',
          errorMessage: assetErrorMessage,
          details: (assetError as any)?.details,
        },
        last_publish_attempt_at: new Date().toISOString(),
      }).eq('id', body.uploadId);
      return NextResponse.json({
        success: false,
        status: 'publish_failed',
        inserted: 0,
        skipped: 0,
        completedAt: new Date().toISOString(),
        errorCode: assetErrorMessage.startsWith('ASSET_VALIDATION_FAILED')
          ? 'ASSET_VALIDATION_FAILED'
          : 'ASSET_UPLOAD_FAILED',
        error: assetErrorMessage,
      }, { status: assetErrorMessage.startsWith('ASSET_VALIDATION_FAILED') ? 422 : 500 });
    }
    const { finalSnapshot, finalSnapshotHash, assetManifest, hasAssets } = assetProcessing;

    await supabaseLTE
      .from('lte_catalog_uploads')
      .update({
        final_snapshot: finalSnapshot,
        final_snapshot_hash: finalSnapshotHash,
        asset_manifest: assetManifest,
        asset_status: hasAssets ? 'staged' : 'none',
      })
      .eq('id', body.uploadId);

    logger.info('Calling publish_lte_catalog_snapshot RPC', {
      uploadId: body.uploadId,
      publishedBy: user.userId,
      expectedHash: finalSnapshotHash,
    });

    // Step 9: Call publish_lte_catalog_snapshot() RPC
    const { data: rpcResult, error: rpcError } = await supabaseLTE.rpc(
      'publish_lte_catalog_snapshot',
      {
        p_upload_id: body.uploadId,
        p_published_by: user.userId,
        p_expected_snapshot_hash: finalSnapshotHash,
      }
    );

    if (rpcError) {
      logger.error('RPC execution failed', { error: rpcError });

      // Separate transaction: persist publish_failed state and failure details
      await supabaseLTE
        .from('lte_catalog_uploads')
        .update({
          status: 'publish_failed',
          asset_status: 'cleanup_pending',
          last_publish_error: {
            errorAt: new Date().toISOString(),
            errorCode: rpcError.code || 'RPC_ERROR',
            errorMessage: rpcError.message || 'Database publish execution failed',
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
          error: rpcError.message || 'Database publish execution failed',
        },
        { status: 500 }
      );
    }

    const result = rpcResult as PublishRPCResult;

    if (result.status === 'error') {
      logger.error('RPC returned failure result', { result });

      await supabaseLTE
        .from('lte_catalog_uploads')
        .update({
          status: 'publish_failed',
          asset_status: 'cleanup_pending',
          last_publish_error: {
            errorAt: new Date().toISOString(),
            errorCode: result.errorCode || 'PUBLISH_RPC_ERROR',
            errorMessage: result.message || 'Catalog publication returned error',
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
          errorCode: result.errorCode,
          error: result.message || 'Publish failed',
        },
        { status: 500 }
      );
    }

    // Step 10: Post-commit asset lifecycle activation (staged -> active)
    let assetsActive = true;
    let assetStatus: 'none' | 'active' | 'activation_pending' = hasAssets ? 'active' : 'none';
    let activationError: unknown = null;
    if (hasAssets) {
      try {
        const storage = await getR2StorageService();
        const activation = await storage.activateAssets(assetManifest.map((entry) => entry.r2Key));
        if (activation.failedKeys.length > 0) {
          assetsActive = false;
          assetStatus = 'activation_pending';
          activationError = { failedKeys: activation.failedKeys };
        }
      } catch (error) {
        assetsActive = false;
        assetStatus = 'activation_pending';
        activationError = { message: getErrorMessage(error) };
      }
    }
    await supabaseLTE
      .from('lte_catalog_uploads')
      .update({
        status: 'published',
        asset_status: assetStatus,
        next_asset_activation_at: assetsActive ? null : new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        last_asset_activation_error: activationError,
        published_at: new Date().toISOString(),
        published_by: user.userId,
      })
      .eq('id', body.uploadId);

    logger.info('LTE Publish completed successfully', {
      uploadId: body.uploadId,
      inserted: result.inserted,
      skipped: result.skipped,
    });

    return NextResponse.json({
      success: true,
      status: 'published',
      catalogPublished: true,
      assetsActive,
      assetStatus,
      retryScheduled: !assetsActive,
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
