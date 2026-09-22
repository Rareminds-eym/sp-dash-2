import Logger from '@/lib/logger';
import { extractAssets, type AssetOccurrence } from './asset-extractor';
import { validateAssetBatch } from './asset-validator';
import { getR2StorageService } from './r2-runtime';
import { calculateHash } from './snapshot-serializer';

const logger = new Logger('LTEAssetProcessor');

export interface AssetManifestEntry {
  originalUrl: string;
  r2Key: string;
  r2Url: string;
  contentHash: string;
  mimeType: string;
  sizeBytes: number;
  status: 'staged';
  occurrences: AssetOccurrence[];
}

export interface AssetProcessingResult {
  finalSnapshot: any;
  finalSnapshotHash: string;
  assetManifest: AssetManifestEntry[];
  hasAssets: boolean;
}

function replaceOccurrence(snapshot: any, occurrence: AssetOccurrence, replacement: string): void {
  const table = snapshot.tables?.[occurrence.tableName];
  const row = table?.rows?.[occurrence.rowIndex];
  if (!table || !row) throw new Error(`Asset field no longer exists: ${occurrence.fieldPath}`);
  const configuredPath = occurrence.fieldPath.split(`rows.${occurrence.rowIndex}.`)[1];
  const [columnName, ...nested] = configuredPath.split('.');
  const columnIndex = table.columns.indexOf(columnName);
  if (columnIndex < 0) throw new Error(`Asset column no longer exists: ${columnName}`);
  if (nested.length === 0) {
    row[columnIndex] = replacement;
    return;
  }
  let target = row[columnIndex];
  for (const segment of nested.slice(0, -1)) target = target?.[segment];
  if (!target || typeof target !== 'object') throw new Error(`Asset nested path no longer exists: ${occurrence.fieldPath}`);
  target[nested[nested.length - 1]] = replacement;
}

export async function processSnapshotAssets(
  snapshot: any,
  uploadId: string,
  heartbeat?: () => Promise<void>,
): Promise<AssetProcessingResult> {
  const finalSnapshot = structuredClone(snapshot);
  const references = extractAssets(finalSnapshot);
  if (references.length === 0) {
    return { finalSnapshot, finalSnapshotHash: calculateHash(finalSnapshot), assetManifest: [], hasAssets: false };
  }

  logger.info('Validating extracted assets', { uploadId, count: references.length });
  const validation = await validateAssetBatch(references.map(({ originalUrl }) => originalUrl));
  await heartbeat?.();

  // Failures are strictly security/protocol errors (e.g. BLOCKED_DOMAIN, PRIVATE_IP, INVALID_PROTOCOL).
  // External web documents (e.g. Google Docs, YouTube) and external page links are retained in snapshot.
  const failures = validation.filter((result) => {
    if (result.valid) return false;
    if (
      result.isExternalWebResource ||
      result.errorCode === 'INVALID_MIME_TYPE' ||
      result.errorCode === 'DOWNLOAD_TIMEOUT' ||
      result.errorCode === 'HTTP_ERROR' ||
      result.errorCode === 'DOWNLOAD_FAILED'
    ) {
      logger.warn('Retaining external reference URL in catalog snapshot without R2 upload', {
        url: result.url,
        errorCode: result.errorCode,
        error: result.error,
      });
      return false;
    }
    return true;
  });

  if (failures.length > 0) {
    const error = new Error(`ASSET_VALIDATION_FAILED: ${failures.map((item) => `${item.url} (${item.errorCode})`).join(', ')}`);
    (error as any).details = failures;
    throw error;
  }

  const storage = await getR2StorageService();
  const assetManifest: AssetManifestEntry[] = [];
  for (let index = 0; index < references.length; index += 1) {
    const reference = references[index];
    const validationResult = validation[index];
    
    // Skip R2 blob upload for external web reference links (keep original URL in snapshot)
    if (!validationResult.valid || validationResult.isExternalWebResource || !validationResult.asset) {
      continue;
    }

    const asset = validationResult.asset;
    const uploaded = await storage.uploadAsset({
      capabilityCode: snapshot.courseMetadata?.capabilityCode || snapshot.metadata?.capabilityCode || 'CAPABILITY',
      levelCode: snapshot.levelCourses?.[0]?.levelCode || snapshot.metadata?.levelCode || 'LEVEL',
      moduleNo: 0,
      artifactType: reference.tableName === 'artifact_templates' ? 'final' : 'practice',
      originalUrl: reference.originalUrl,
      contentHash: asset.contentHash,
      mimeType: asset.mimeType,
      bytes: asset.bytes,
      uploadId,
    });
    for (const occurrence of reference.occurrences) replaceOccurrence(finalSnapshot, occurrence, uploaded.publicUrl);
    assetManifest.push({
      originalUrl: reference.originalUrl,
      r2Key: uploaded.key,
      r2Url: uploaded.publicUrl,
      contentHash: asset.contentHash,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      status: 'staged',
      occurrences: reference.occurrences,
    });
    await heartbeat?.();
  }

  return { finalSnapshot, finalSnapshotHash: calculateHash(finalSnapshot), assetManifest, hasAssets: assetManifest.length > 0 };
}
