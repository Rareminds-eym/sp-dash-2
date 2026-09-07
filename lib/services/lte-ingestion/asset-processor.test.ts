import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./asset-validator', () => ({ validateAssetBatch: vi.fn() }));
vi.mock('./r2-runtime', () => ({ getR2StorageService: vi.fn() }));

import { processSnapshotAssets } from './asset-processor';
import { validateAssetBatch } from './asset-validator';
import { getR2StorageService } from './r2-runtime';

describe('processSnapshotAssets', () => {
  const uploadAsset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getR2StorageService).mockResolvedValue({ uploadAsset } as any);
    uploadAsset.mockResolvedValue({
      key: 'lte/resources/capabilities/CAP/levels/L1/modules-0/artifacts/practice/file-hash.pdf',
      publicUrl: 'https://assets.example.com/file-hash.pdf',
    });
  });

  it('validates, uploads, replaces every duplicate occurrence, and builds the manifest', async () => {
    vi.mocked(validateAssetBatch).mockResolvedValue([{
      url: 'https://source.example.com/file.pdf',
      valid: true,
      asset: {
        originalUrl: 'https://source.example.com/file.pdf',
        finalUrl: 'https://source.example.com/file.pdf',
        contentHash: 'a'.repeat(64),
        mimeType: 'application/pdf',
        sizeBytes: 3,
        bytes: new Uint8Array([1, 2, 3]),
      },
    }]);
    const heartbeat = vi.fn().mockResolvedValue(undefined);
    const snapshot = {
      courseMetadata: { capabilityCode: 'CAP' },
      levelCourses: [{ levelCode: 'L1' }],
      tables: {
        artifact_questions: {
          columns: ['reference_url', 'solution_url'],
          rows: [['https://source.example.com/file.pdf', 'https://source.example.com/file.pdf']],
        },
      },
    };

    const result = await processSnapshotAssets(snapshot, 'upload-1', heartbeat);

    expect(validateAssetBatch).toHaveBeenCalledWith(['https://source.example.com/file.pdf']);
    expect(uploadAsset).toHaveBeenCalledWith(expect.objectContaining({
      uploadId: 'upload-1',
      capabilityCode: 'CAP',
      levelCode: 'L1',
      contentHash: 'a'.repeat(64),
    }));
    expect(result.finalSnapshot.tables.artifact_questions.rows[0]).toEqual([
      'https://assets.example.com/file-hash.pdf',
      'https://assets.example.com/file-hash.pdf',
    ]);
    expect(result.assetManifest[0].occurrences).toHaveLength(2);
    expect(result.hasAssets).toBe(true);
    expect(heartbeat).toHaveBeenCalledTimes(2);
  });

  it('fails before resolving R2 when validation rejects an asset', async () => {
    vi.mocked(validateAssetBatch).mockResolvedValue([{
      url: 'http://source.example.com/file.pdf',
      valid: false,
      errorCode: 'INVALID_PROTOCOL',
      error: 'Asset URL must use HTTPS',
    }]);
    const snapshot = {
      tables: {
        artifact_questions: {
          columns: ['reference_url'],
          rows: [['http://source.example.com/file.pdf']],
        },
      },
    };

    await expect(processSnapshotAssets(snapshot, 'upload-1')).rejects.toThrow('ASSET_VALIDATION_FAILED');
    expect(getR2StorageService).not.toHaveBeenCalled();
  });
});
