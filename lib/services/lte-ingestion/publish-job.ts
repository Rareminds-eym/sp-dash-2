import type { SupabaseClient } from '@supabase/supabase-js';
import Logger, { getErrorMessage } from '@/lib/logger';
import { calculateHash } from './snapshot-serializer';
import { extractAssets, type AssetOccurrence } from './asset-extractor';
import { replaceOccurrence, type AssetManifestEntry } from './asset-processor';
import { validateAndDownloadAsset, AssetValidationError } from './asset-validator';
import { publishSnapshotTables } from './publish-snapshot-tables';
import { R2StorageService } from './r2-storage';
import { getR2StorageService } from './r2-runtime';
import { deterministicUUID, isUUID } from './uuid-generator';

const logger = new Logger('LTEPublishJob');
const PUBLISH_LOCK_RETRY_LIMIT = 8;
const PUBLISH_LOCK_RETRY_BASE_MS = 75;

export interface LTEAssetValidationMessage {
  uploadId: string;
  assetUrl: string;
}

interface PublishJobOptions {
  supabase?: SupabaseClient;
  storage?: R2StorageService;
}

interface AssetState {
  url: string;
  status: 'PENDING' | 'VALIDATING' | 'VALID' | 'FAILED';
  tableName?: string;
  occurrences: AssetOccurrence[];
  r2Key?: string;
  r2Url?: string;
  contentHash?: string;
  mimeType?: string;
  sizeBytes?: number;
  errorCode?: string;
  error?: string;
  validatedAt?: string;
}

interface AssetValidationState {
  status: 'VALIDATING' | 'PUBLISHING' | 'PUBLISHED' | 'VALIDATION_FAILED' | 'PUBLISH_FAILED';
  total: number;
  validated: number;
  failed: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
  inserted?: number;
  skipped?: number;
  tableSummary?: Record<string, { inserted: number; skipped: number }>;
  assets: Record<string, AssetState>;
}

interface PublishSnapshotUpdate {
  snapshot: any;
  snapshotHash?: string;
  status?: string;
  publishedBy?: string;
  publishedAt?: string;
}

export async function createPublishJob(
  version: any,
  userId: string,
  options: PublishJobOptions = {}
): Promise<{ job: any; messages: LTEAssetValidationMessage[] }> {
  const client = await resolveSupabase(options.supabase);
  const snapshot = version.snapshot_data || {};
  const existingState = snapshot.assetValidation as AssetValidationState | undefined;

  if (existingState && ['VALIDATING', 'PUBLISHING'].includes(existingState.status)) {
    return {
      job: stateToJob(version, existingState),
      messages: Object.values(existingState.assets || {})
        .filter((asset) => asset.status !== 'VALID')
        .map((asset) => ({ uploadId: version.id, assetUrl: asset.url })),
    };
  }

  const references = extractAssets(snapshot);
  const state: AssetValidationState = {
    status: 'VALIDATING',
    total: references.length,
    validated: 0,
    failed: 0,
    startedAt: new Date().toISOString(),
    assets: Object.fromEntries(references.map((reference) => [
      reference.originalUrl,
      {
        url: reference.originalUrl,
        status: 'PENDING',
        tableName: reference.tableName,
        occurrences: reference.occurrences,
      } satisfies AssetState,
    ])),
  };

  await updateSnapshotWithRetry(client, version.id, () => ({
    snapshot: {
      ...snapshot,
      assetValidation: state,
    },
    snapshotHash: calculateProgressHash(snapshot),
  }));

  if (references.length === 0) {
    await finalizePublishJob(version.id, userId, options);
    const refreshed = await readCatalogVersion(client, version.id);
    return {
      job: stateToJob(refreshed, refreshed.snapshot_data?.assetValidation),
      messages: [],
    };
  }

  return {
    job: stateToJob(version, state),
    messages: references.map((reference) => ({
      uploadId: version.id,
      assetUrl: reference.originalUrl,
    })),
  };
}

export async function processAssetValidationMessage(
  message: LTEAssetValidationMessage,
  options: PublishJobOptions = {}
): Promise<void> {
  const client = await resolveSupabase(options.supabase);
  const storage = options.storage || await getR2StorageService();
  const version = await readCatalogVersion(client, message.uploadId);
  const snapshot = version.snapshot_data || {};
  const state = ensureAssetValidationState(snapshot.assetValidation);
  const assetState = state.assets[message.assetUrl];

  if (!assetState || assetState.status === 'VALID') return;

  await updateAssetValidationStateWithRetry(client, message.uploadId, (latestState) => {
    const latestAsset = latestState.assets[message.assetUrl];
    if (!latestAsset || latestAsset.status === 'VALID') return false;
    latestAsset.status = 'VALIDATING';
    return true;
  });

  try {
    const asset = await validateAndDownloadAsset(message.assetUrl);
    const uploaded = await storage.uploadAsset({
      capabilityCode: snapshot.courseMetadata?.capabilityCode || snapshot.metadata?.capabilityCode || 'CAPABILITY',
      levelCode: snapshot.levelCourses?.[0]?.levelCode || snapshot.metadata?.levelCode || 'LEVEL',
      moduleNo: 0,
      artifactType: assetState.tableName === 'artifact_templates' ? 'final' : 'practice',
      originalUrl: message.assetUrl,
      contentHash: asset.contentHash,
      mimeType: asset.mimeType,
      bytes: asset.bytes,
      uploadId: message.uploadId,
    });

    await updateAssetValidationStateWithRetry(client, message.uploadId, (latestState) => {
      const latestAsset = latestState.assets[message.assetUrl];
      if (!latestAsset) return false;
      latestAsset.status = 'VALID';
      latestAsset.r2Key = uploaded.key;
      latestAsset.r2Url = uploaded.publicUrl;
      latestAsset.contentHash = asset.contentHash;
      latestAsset.mimeType = asset.mimeType;
      latestAsset.sizeBytes = asset.sizeBytes;
      latestAsset.validatedAt = new Date().toISOString();
      delete latestAsset.error;
      delete latestAsset.errorCode;
      return true;
    });
  } catch (error) {
    await updateAssetValidationStateWithRetry(client, message.uploadId, (latestState) => {
      const latestAsset = latestState.assets[message.assetUrl];
      if (!latestAsset) return false;
      latestAsset.status = 'FAILED';
      latestAsset.errorCode = error instanceof AssetValidationError ? error.code : 'DOWNLOAD_FAILED';
      latestAsset.error = getErrorMessage(error);
      latestAsset.validatedAt = new Date().toISOString();
      return true;
    });
  }

  await finalizePublishJobIfReady(message.uploadId, options);
}

export async function finalizePublishJobIfReady(
  uploadId: string,
  options: PublishJobOptions = {}
): Promise<void> {
  const client = await resolveSupabase(options.supabase);
  const version = await readCatalogVersion(client, uploadId);
  const state = ensureAssetValidationState(version.snapshot_data?.assetValidation);
  const pending = Object.values(state.assets).filter((asset) => ['PENDING', 'VALIDATING'].includes(asset.status)).length;

  if (pending > 0) return;
  if (state.failed > 0) {
    await updateAssetValidationStateWithRetry(client, uploadId, (latestState) => {
      latestState.status = 'VALIDATION_FAILED';
      latestState.error = `${latestState.failed} linked asset(s) failed validation.`;
      latestState.completedAt = new Date().toISOString();
      return true;
    });
    return;
  }

  await finalizePublishJob(uploadId, undefined, options);
}

export async function markAssetValidationFailed(
  uploadId: string,
  assetUrl: string,
  error: unknown,
  options: PublishJobOptions = {}
): Promise<void> {
  const client = await resolveSupabase(options.supabase);
  await updateAssetValidationStateWithRetry(client, uploadId, (latestState) => {
    const latestAsset = latestState.assets[assetUrl];
    if (!latestAsset) return false;
    latestAsset.status = 'FAILED';
    latestAsset.errorCode = 'DOWNLOAD_FAILED';
    latestAsset.error = `Queue processing failed after retries: ${getErrorMessage(error)}`;
    latestAsset.validatedAt = new Date().toISOString();
    return true;
  });
}

export async function finalizePublishJob(
  uploadId: string,
  userId?: string,
  options: PublishJobOptions = {}
): Promise<void> {
  const client = await resolveSupabase(options.supabase);
  const acquired = await acquirePublishingSnapshot(client, uploadId);
  if (!acquired) return;

  const { version, snapshot, state } = acquired;

  try {
    const finalSnapshot = structuredClone(snapshot);
    delete finalSnapshot.assetValidation;
    const assetManifest: AssetManifestEntry[] = [];

    for (const assetState of Object.values(state.assets)) {
      for (const occurrence of assetState.occurrences) replaceOccurrence(finalSnapshot, occurrence, assetState.r2Url || '');
      assetManifest.push({
        originalUrl: assetState.url,
        r2Key: assetState.r2Key || '',
        r2Url: assetState.r2Url || '',
        contentHash: assetState.contentHash || '',
        mimeType: assetState.mimeType || '',
        sizeBytes: Number(assetState.sizeBytes || 0),
        status: 'staged',
        occurrences: assetState.occurrences,
      });
    }

    const finalSnapshotHash = calculateHash(finalSnapshot);
    const publishSnapshot = {
      ...finalSnapshot,
      snapshotHash: finalSnapshotHash,
      reviewedSnapshotHash: finalSnapshotHash,
      assetManifest,
      assetStatus: assetManifest.length > 0 ? 'staged' : 'none',
    };

    const { inserted, skipped, tableSummary } = await publishSnapshotTables(publishSnapshot?.tables || {}, client);
    const completedAt = new Date().toISOString();
    await createPublishedLevelVersions(publishSnapshot, userId || version.created_by, completedAt, client);

    state.status = 'PUBLISHED';
    state.inserted = inserted;
    state.skipped = skipped;
    state.tableSummary = tableSummary;
    state.completedAt = completedAt;

    await updateSnapshotWithRetry(client, uploadId, () => ({
      snapshot: { ...publishSnapshot, assetValidation: state },
      snapshotHash: finalSnapshotHash,
      status: 'PUBLISHED',
      publishedBy: userId || version.created_by,
      publishedAt: completedAt,
    }));

    logger.info('LTE queued publish completed', { uploadId, inserted, skipped });
  } catch (error) {
    await updateAssetValidationStateWithRetry(client, uploadId, (latestState) => {
      latestState.status = 'PUBLISH_FAILED';
      latestState.error = getErrorMessage(error);
      latestState.completedAt = new Date().toISOString();
      return true;
    });
    throw error;
  }
}

export async function readPublishJobStatus(
  uploadId: string,
  options: PublishJobOptions = {}
): Promise<{ job: any; assets: any[] }> {
  const client = await resolveSupabase(options.supabase);
  const version = await readCatalogVersion(client, uploadId);
  const state = version.snapshot_data?.assetValidation as AssetValidationState | undefined;
  const job = stateToJob(version, state);
  return {
    job,
    assets: Object.values(state?.assets || {}).map((asset) => ({
      id: asset.url,
      asset_url: asset.url,
      status: asset.status,
      r2_url: asset.r2Url,
      error_code: asset.errorCode,
      error_message: asset.error,
      attempt_count: 1,
      validated_at: asset.validatedAt,
    })),
  };
}

async function readCatalogVersion(client: SupabaseClient, uploadId: string): Promise<any> {
  const { data, error } = await client
    .from('catalog_versions')
    .select('*')
    .eq('id', uploadId)
    .single();
  if (error || !data) throw new Error(`Catalog version not found: ${error?.message || uploadId}`);
  return data;
}

async function updateAssetValidationStateWithRetry(
  client: SupabaseClient,
  uploadId: string,
  mutate: (state: AssetValidationState, snapshot: any, version: any) => boolean | void
): Promise<void> {
  await updateSnapshotWithRetry(client, uploadId, (version) => {
    const snapshot = structuredClone(version.snapshot_data || {});
    const state = ensureAssetValidationState(snapshot.assetValidation);
    const shouldUpdate = mutate(state, snapshot, version);
    if (shouldUpdate === false) return null;
    snapshot.assetValidation = recomputeState(state);
    return {
      snapshot,
      snapshotHash: calculateProgressHash(snapshot),
    };
  });
}

async function updateSnapshotWithRetry(
  client: SupabaseClient,
  uploadId: string,
  buildUpdate: (version: any) => PublishSnapshotUpdate | null
): Promise<void> {
  for (let attempt = 1; attempt <= PUBLISH_LOCK_RETRY_LIMIT; attempt += 1) {
    const version = await readCatalogVersion(client, uploadId);
    const currentRevision = Number(version.draft_revision || 1);
    const update = buildUpdate(version);
    if (!update) return;

    const payload: Record<string, unknown> = {
      snapshot_data: update.snapshot,
      draft_revision: currentRevision + 1,
    };
    if (update.snapshotHash) payload.snapshot_hash = update.snapshotHash;
    if (update.status) payload.status = update.status;
    if (update.publishedBy) payload.published_by = update.publishedBy;
    if (update.publishedAt) payload.published_at = update.publishedAt;

    const { data, error } = await client
      .from('catalog_versions')
      .update(payload)
      .eq('id', uploadId)
      .eq('draft_revision', currentRevision)
      .select('id')
      .maybeSingle();

    if (error) throw new Error(`Failed to update publish progress: ${error.message}`);
    if (data) return;

    await sleep(PUBLISH_LOCK_RETRY_BASE_MS * attempt);
  }

  throw new Error('Failed to update publish progress after concurrent retries.');
}

async function acquirePublishingSnapshot(
  client: SupabaseClient,
  uploadId: string
): Promise<{ version: any; snapshot: any; state: AssetValidationState } | null> {
  for (let attempt = 1; attempt <= PUBLISH_LOCK_RETRY_LIMIT; attempt += 1) {
    const version = await readCatalogVersion(client, uploadId);
    const snapshot = structuredClone(version.snapshot_data || {});
    const state = ensureAssetValidationState(snapshot.assetValidation);

    if (state.status === 'PUBLISHED' || state.status === 'PUBLISHING') return null;
    if (Object.values(state.assets).some((asset) => asset.status !== 'VALID')) return null;

    state.status = 'PUBLISHING';
    snapshot.assetValidation = recomputeState(state);
    const currentRevision = Number(version.draft_revision || 1);

    const { data, error } = await client
      .from('catalog_versions')
      .update({
        snapshot_data: snapshot,
        snapshot_hash: calculateProgressHash(snapshot),
        draft_revision: currentRevision + 1,
      })
      .eq('id', uploadId)
      .eq('draft_revision', currentRevision)
      .select('id')
      .maybeSingle();

    if (error) throw new Error(`Failed to acquire publish lock: ${error.message}`);
    if (data) return { version, snapshot, state };

    await sleep(PUBLISH_LOCK_RETRY_BASE_MS * attempt);
  }

  throw new Error('Failed to acquire publish lock after concurrent retries.');
}

function ensureAssetValidationState(value: unknown): AssetValidationState {
  if (!value || typeof value !== 'object') {
    throw new Error('Publish job state is missing from catalog snapshot.');
  }
  return value as AssetValidationState;
}

function recomputeState(state: AssetValidationState): AssetValidationState {
  const assets = Object.values(state.assets || {});
  state.total = assets.length;
  state.validated = assets.filter((asset) => asset.status === 'VALID').length;
  state.failed = assets.filter((asset) => asset.status === 'FAILED').length;
  if (state.failed > 0 && state.validated + state.failed === state.total) state.status = 'VALIDATION_FAILED';
  else if (state.status !== 'PUBLISHING') state.status = 'VALIDATING';
  return state;
}

function calculateProgressHash(snapshot: any): string {
  return calculateHash({
    tables: snapshot?.tables || {},
    metadata: snapshot?.metadata || {},
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stateToJob(version: any, state?: AssetValidationState): any {
  return {
    id: version.id,
    upload_id: version.id,
    status: state?.status || version.status,
    total_assets: state?.total || 0,
    validated_assets: state?.validated || 0,
    failed_assets: state?.failed || 0,
    inserted_count: state?.inserted || 0,
    skipped_count: state?.skipped || 0,
    table_summary: state?.tableSummary || {},
    error_message: state?.error,
    completed_at: state?.completedAt || version.published_at,
  };
}

async function createPublishedLevelVersions(
  snapshot: any,
  userId: string,
  publishedAt: string,
  client: SupabaseClient
): Promise<void> {
  const levelTable = snapshot?.tables?.levels;
  if (!levelTable?.columns?.length || !levelTable?.rows?.length) return;

  const idIndex = levelTable.columns.indexOf('id');
  const codeIndex = levelTable.columns.indexOf('level_code');
  if (idIndex === -1) return;

  for (const row of levelTable.rows) {
    const levelCode = codeIndex === -1 ? String(row[idIndex] || '') : String(row[codeIndex] || '');
    let entityId = toPublishUUID('levels', row[idIndex]);
    if (levelCode) {
      const { data: existing } = await client
        .from('levels')
        .select('id')
        .eq('level_code', levelCode)
        .maybeSingle();
      if (existing?.id) entityId = existing.id;
    }

    const { data: latestVersion, error: latestError } = await client
      .from('catalog_versions')
      .select('id, version_no')
      .eq('entity_type', 'level')
      .eq('entity_id', entityId)
      .order('version_no', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) throw new Error(`Failed to read level version for ${levelCode}: ${latestError.message}`);

    const nextVersionNo = (latestVersion?.version_no || 0) + 1;
    const levelSnapshot = { ...snapshot, entityType: 'level', entityId, levelCode, versionNo: nextVersionNo };
    const { error } = await client
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

    if (error) throw new Error(`Failed to create level version for ${levelCode}: ${error.message}`);
  }
}

function toPublishUUID(tableName: string, value: unknown): string {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${tableName}.id is required before publish`);
  return isUUID(text) ? text.toLowerCase() : deterministicUUID(tableName, text);
}

async function resolveSupabase(client?: SupabaseClient): Promise<SupabaseClient> {
  if (client) return client;
  return (await import('@/lib/supabase-lte')).supabaseLTE;
}
