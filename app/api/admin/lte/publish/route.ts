import { NextRequest, NextResponse } from 'next/server';
import Logger, { getErrorMessage } from '@/lib/logger';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseLTE } from '@/lib/supabase-lte';
import { LTEPublishResult } from '@/types/lte-ingestion';
import { calculateHash } from '@/lib/services/lte-ingestion/snapshot-serializer';
import { processSnapshotAssets } from '@/lib/services/lte-ingestion/asset-processor';
import { publishSnapshotTables } from '@/lib/services/lte-ingestion/publish-snapshot-tables';
import { deterministicUUID, isUUID } from '@/lib/services/lte-ingestion/uuid-generator';

const logger = new Logger('LTEPublishAPI');

export const runtime = 'nodejs';

interface PublishRequest {
  uploadId: string;
  reviewedSnapshotHash: string;
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

    const assetProcessing = await processSnapshotAssets(snapshot, body.uploadId);
    const publishSnapshot = {
      ...assetProcessing.finalSnapshot,
      snapshotHash: assetProcessing.finalSnapshotHash,
      reviewedSnapshotHash: assetProcessing.finalSnapshotHash,
      assetManifest: assetProcessing.assetManifest,
      assetStatus: assetProcessing.hasAssets ? 'staged' : 'none',
    };

    const { inserted, skipped, tableSummary } = await publishSnapshotTables(publishSnapshot?.tables || {});
    const completedAt = new Date().toISOString();
    await createPublishedLevelVersions(publishSnapshot, user.userId, completedAt);

    const { error: updateError } = await supabaseLTE
      .from('catalog_versions')
      .update({
        status: 'PUBLISHED',
        snapshot_hash: assetProcessing.finalSnapshotHash,
        snapshot_data: publishSnapshot,
        published_by: user.userId,
        published_at: completedAt,
      })
      .eq('id', body.uploadId);

    if (updateError) {
      throw new Error(`Failed to mark catalog version as published: ${updateError.message}`);
    }

    logger.info('LTE catalog version published successfully', {
      uploadId: body.uploadId,
      inserted,
      skipped,
    });

    return NextResponse.json({
      success: true,
      status: 'published',
      catalogPublished: true,
      inserted,
      skipped,
      tableSummary,
      completedAt,
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

async function createPublishedLevelVersions(
  snapshot: any,
  userId: string,
  publishedAt: string
): Promise<void> {
  const levelTable = snapshot?.tables?.levels;
  if (!levelTable?.columns?.length || !levelTable?.rows?.length) return;

  const idIndex = levelTable.columns.indexOf('id');
  const codeIndex = levelTable.columns.indexOf('level_code');
  if (idIndex === -1) return;

  for (const row of levelTable.rows) {
    const levelCode = codeIndex === -1 ? String(row[idIndex] || '') : String(row[codeIndex] || '');
    // Incremental re-upload: if this level_code already exists, version the
    // existing level row instead of forking a new entity id.
    let entityId = toPublishUUID('levels', row[idIndex]);
    if (levelCode) {
      const { data: existing } = await supabaseLTE
        .from('levels')
        .select('id')
        .eq('level_code', levelCode)
        .maybeSingle();
      if (existing?.id) entityId = existing.id;
    }

    const { data: latestVersion, error: latestError } = await supabaseLTE
      .from('catalog_versions')
      .select('id, version_no')
      .eq('entity_type', 'level')
      .eq('entity_id', entityId)
      .order('version_no', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      throw new Error(`Failed to read level version for ${levelCode}: ${latestError.message}`);
    }

    const nextVersionNo = (latestVersion?.version_no || 0) + 1;
    const levelSnapshot = {
      ...snapshot,
      entityType: 'level',
      entityId,
      levelCode,
      versionNo: nextVersionNo,
    };

    const { error: insertError } = await supabaseLTE
      .from('catalog_versions')
      .insert({
        entity_type: 'level',
        entity_id: entityId,
        version_no: nextVersionNo,
        status: 'PUBLISHED',
        base_version_id: latestVersion?.id || null,
        snapshot_hash: calculateHash(levelSnapshot),
        snapshot_data: levelSnapshot,
        change_reason: 'CATALOG_PUBLISH',
        created_by: userId,
        published_by: userId,
        published_at: publishedAt,
      });

    if (insertError) {
      throw new Error(`Failed to create level version for ${levelCode}: ${insertError.message}`);
    }
  }
}

function toPublishUUID(tableName: string, value: unknown): string {
  const text = String(value || '').trim();
  if (!text) {
    throw new Error(`${tableName}.id is required before publish`);
  }
  return isUUID(text) ? text.toLowerCase() : deterministicUUID(tableName, text);
}
