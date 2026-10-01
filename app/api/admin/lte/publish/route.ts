import { NextRequest, NextResponse } from 'next/server';
import Logger, { getErrorMessage } from '@/lib/logger';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseLTE } from '@/lib/supabase-lte';
import { LTEPublishResult } from '@/types/lte-ingestion';
import { calculateHash } from '@/lib/services/lte-ingestion/snapshot-serializer';
import { createPublishJob, type LTEAssetValidationMessage } from '@/lib/services/lte-ingestion/publish-job';

const logger = new Logger('LTEPublishAPI');
const QUEUE_SEND_BATCH_LIMIT = 100;

export const runtime = 'nodejs';

interface PublishRequest {
  uploadId: string;
  reviewedSnapshotHash: string;
}

interface QueueLike<T> {
  sendBatch(messages: Array<{ body: T }>): Promise<void>;
}

export async function POST(request: NextRequest): Promise<NextResponse<LTEPublishResult>> {
  logger.info('Received LTE publish request');

  try {
    const { user, error: authError } = await authenticateSSORequest(
      request,
      ['super_admin', 'platform_admin']
    );

    if (authError || !user) {
      logger.warn('Authentication failure during publish attempt');
      return authError || NextResponse.json(
        {
          success: false,
          status: 'rejected',
          inserted: 0,
          skipped: 0,
          completedAt: new Date().toISOString(),
          error: 'FORBIDDEN: Publish requires super_admin or platform_admin role.',
        },
        { status: 403 }
      );
    }

    const body = (await request.json()) as PublishRequest;
    if (!body.uploadId || !body.reviewedSnapshotHash) {
      return NextResponse.json(
        {
          success: false,
          status: 'rejected',
          inserted: 0,
          skipped: 0,
          completedAt: new Date().toISOString(),
          error: 'Missing uploadId or reviewedSnapshotHash in request body',
        },
        { status: 400 }
      );
    }

    const { data: version, error: fetchError } = await supabaseLTE
      .from('catalog_versions')
      .select('*')
      .eq('id', body.uploadId)
      .eq('entity_type', 'catalog')
      .single();

    if (fetchError || !version) {
      logger.error('Catalog version not found', { uploadId: body.uploadId, error: fetchError });
      return NextResponse.json(
        {
          success: false,
          status: 'rejected',
          inserted: 0,
          skipped: 0,
          completedAt: new Date().toISOString(),
          error: 'Catalog version not found',
        },
        { status: 404 }
      );
    }

    if (version.status === 'PUBLISHED') {
      return NextResponse.json({
        success: true,
        status: 'published',
        catalogPublished: true,
        inserted: 0,
        skipped: 0,
        completedAt: version.published_at || new Date().toISOString(),
      });
    }

    if (!['VALIDATED', 'DRAFT'].includes(version.status)) {
      return NextResponse.json(
        {
          success: false,
          status: 'rejected',
          inserted: 0,
          skipped: 0,
          completedAt: new Date().toISOString(),
          error: `Catalog version status is ${version.status}; expected VALIDATED or DRAFT.`,
        },
        { status: 409 }
      );
    }

    const snapshot = version.snapshot_data;
    const normalizedSnapshot = {
      tables: snapshot?.tables || {},
      metadata: snapshot?.metadata || {},
    };
    const recomputedHash = calculateHash(normalizedSnapshot as any);

    if (
      recomputedHash !== version.snapshot_hash ||
      body.reviewedSnapshotHash !== version.snapshot_hash
    ) {
      logger.warn('Catalog version hash mismatch', {
        uploadId: body.uploadId,
        storedHash: version.snapshot_hash,
        requestedHash: body.reviewedSnapshotHash,
        recomputedHash,
      });

      return NextResponse.json(
        {
          success: false,
          status: 'rejected',
          inserted: 0,
          skipped: 0,
          completedAt: new Date().toISOString(),
          errorCode: 'SNAPSHOT_CHANGED',
          error: 'SNAPSHOT_CHANGED: The reviewed snapshot version changed. Please refresh and review again.',
        },
        { status: 409 }
      );
    }

    const { job, messages } = await createPublishJob(version, user.userId);

    if (messages.length > 0) {
      const queue = await getAssetValidationQueue();
      if (!queue) {
        throw new Error('LTE_ASSET_VALIDATION_QUEUE is not configured. Add the queue producer binding before publishing assets.');
      }

      for (let index = 0; index < messages.length; index += QUEUE_SEND_BATCH_LIMIT) {
        const chunk = messages.slice(index, index + QUEUE_SEND_BATCH_LIMIT);
        const batchNumber = Math.floor(index / QUEUE_SEND_BATCH_LIMIT) + 1;
        try {
          await queue.sendBatch(chunk.map((message) => ({ body: message })));
        } catch (error) {
          logger.error('LTE asset validation queue batch failed', {
            uploadId: body.uploadId,
            batchNumber,
            batchSize: chunk.length,
            error: getErrorMessage(error),
          });
          throw error;
        }
      }

      logger.info('LTE asset validation job queued', {
        uploadId: body.uploadId,
        publishJobId: job.id,
        totalAssets: messages.length,
      });

      return NextResponse.json({
        success: true,
        status: 'validating_assets',
        inserted: 0,
        skipped: 0,
        completedAt: new Date().toISOString(),
        assetStatus: 'validation_pending',
        publishJobId: job.id,
        assetValidation: {
          total: job.total_assets || messages.length,
          validated: job.validated_assets || 0,
          failed: job.failed_assets || 0,
        },
      } as LTEPublishResult & Record<string, unknown>);
    }

    logger.info('LTE catalog version published successfully', {
      uploadId: body.uploadId,
      inserted: job.inserted_count || 0,
      skipped: job.skipped_count || 0,
    });

    return NextResponse.json({
      success: true,
      status: 'published',
      catalogPublished: true,
      inserted: job.inserted_count || 0,
      skipped: job.skipped_count || 0,
      tableSummary: job.table_summary || {},
      completedAt: job.completed_at || new Date().toISOString(),
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

async function getAssetValidationQueue(): Promise<QueueLike<LTEAssetValidationMessage> | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const context = await getCloudflareContext({ async: true }) as unknown as {
      env?: { LTE_ASSET_VALIDATION_QUEUE?: QueueLike<LTEAssetValidationMessage> };
    };
    return context?.env?.LTE_ASSET_VALIDATION_QUEUE || null;
  } catch (error) {
    logger.warn('LTE_ASSET_VALIDATION_QUEUE binding unavailable', {
      error: getErrorMessage(error),
    });
    return null;
  }
}
