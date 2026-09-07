import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Mock server-only modules before importing the route
vi.mock('@/lib/middleware/sso-auth', () => ({
  authenticateSSORequest: vi.fn(),
}));

vi.mock('@/lib/supabase-lte', () => ({
  supabaseLTE: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('@/lib/services/lte-ingestion/snapshot-serializer', () => ({
  calculateHash: vi.fn(() => 'test-snapshot-hash'),
}));

vi.mock('@/lib/services/lte-ingestion/asset-processor', () => ({
  processSnapshotAssets: vi.fn(),
}));

vi.mock('@/lib/services/lte-ingestion/r2-runtime', () => ({
  getR2StorageService: vi.fn(),
}));

// Import after mocks are set up
import { POST } from './route';
import { NextRequest } from 'next/server';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseLTE } from '@/lib/supabase-lte';
import { calculateHash } from '@/lib/services/lte-ingestion/snapshot-serializer';
import { processSnapshotAssets } from '@/lib/services/lte-ingestion/asset-processor';
import { getR2StorageService } from '@/lib/services/lte-ingestion/r2-runtime';

describe('POST /api/admin/lte/publish', () => {
  let updatePayloads: any[];
  const mockUser = {
    userId: 'test-user-123',
    role: 'super_admin',
    email: 'admin@test.com',
  };

  const mockUploadRecord = {
    id: 'upload-uuid-456',
    source_name: 'test-course.xlsx',
    status: 'validated',
    snapshot_hash: 'test-snapshot-hash',
    reviewed_snapshot_hash: 'test-snapshot-hash',
    normalized_snapshot: {
      tables: {
        capabilities: {
          columns: ['id', 'code', 'name'],
          rows: [['uuid-1', 'TEST_CAP', 'Test Capability']],
        },
      },
    },
    reviewed_snapshot: {
      tables: {
        capabilities: {
          columns: ['id', 'code', 'name'],
          rows: [['uuid-1', 'TEST_CAP', 'Test Capability']],
        },
      },
    },
    created_by: 'test-user-123',
    created_at: '2026-08-18T10:00:00Z',
  };

  const mockRPCResult = {
    status: 'published',
    message: 'Successfully published',
    inserted: 148,
    skipped: 36,
    tableSummary: {
      capabilities: { inserted: 10, skipped: 2 },
      modules: { inserted: 50, skipped: 10 },
    },
  };

  function createChainableQuery(data: any, error: any = null) {
    const query: any = {};
    query.select = vi.fn().mockReturnValue(query);
    query.update = vi.fn((payload: any) => {
      updatePayloads.push(payload);
      return query;
    });
    query.insert = vi.fn().mockReturnValue(query);
    query.eq = vi.fn().mockReturnValue(query);
    query.in = vi.fn().mockReturnValue(query);
    query.single = vi.fn().mockResolvedValue({ data, error });
    query.then = (onfulfilled: any) => Promise.resolve({ data, error }).then(onfulfilled);
    return query;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    updatePayloads = [];
    
    vi.mocked(authenticateSSORequest).mockResolvedValue({
      user: mockUser,
      error: null,
    });

    vi.mocked(supabaseLTE.from).mockImplementation(() => {
      return createChainableQuery(mockUploadRecord, null);
    });

    vi.mocked(supabaseLTE.rpc).mockResolvedValue({
      data: mockRPCResult,
      error: null,
    } as any);

    vi.mocked(processSnapshotAssets).mockResolvedValue({
      finalSnapshot: mockUploadRecord.reviewed_snapshot,
      finalSnapshotHash: 'test-snapshot-hash',
      assetManifest: [],
      hasAssets: false,
    });

    vi.mocked(getR2StorageService).mockResolvedValue({
      activateAssets: vi.fn().mockResolvedValue({ activatedCount: 0, failedKeys: [] }),
    } as any);
  });

  it('should reject unauthorized requests with 401', async () => {
    vi.mocked(authenticateSSORequest).mockResolvedValue({
      user: null,
      error: null,
    });

    const request = new NextRequest('http://localhost:3000/api/admin/lte/publish', {
      method: 'POST',
      body: JSON.stringify({ uploadId: 'upload-uuid-456', reviewedSnapshotHash: 'test-snapshot-hash' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should reject an ordinary admin and request only elevated publish roles', async () => {
    vi.mocked(authenticateSSORequest).mockResolvedValue({
      user: null,
      error: new Response(JSON.stringify({ error: 'Forbidden - Insufficient permissions' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/admin/lte/publish', {
      method: 'POST',
      body: JSON.stringify({
        uploadId: 'upload-uuid-456',
        reviewedSnapshotHash: 'test-snapshot-hash',
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(authenticateSSORequest).toHaveBeenCalledWith(
      request,
      ['super_admin', 'platform_admin'],
    );
    expect(supabaseLTE.rpc).not.toHaveBeenCalled();
  });

  it('should reject requests missing uploadId or reviewedSnapshotHash', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/lte/publish', {
      method: 'POST',
      body: JSON.stringify({ uploadId: 'upload-uuid-456' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Missing reviewedSnapshotHash');
  });

  it('should return 404 when upload does not exist', async () => {
    vi.mocked(supabaseLTE.from).mockImplementation(() => {
      return createChainableQuery(null, { message: 'Not found', code: 'PGRST116' });
    });

    const request = new NextRequest('http://localhost:3000/api/admin/lte/publish', {
      method: 'POST',
      body: JSON.stringify({ uploadId: 'nonexistent-id', reviewedSnapshotHash: 'test-snapshot-hash' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Upload not found');
  });

  it('should return 409 SNAPSHOT_CHANGED when requested hash differs from stored hash', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/lte/publish', {
      method: 'POST',
      body: JSON.stringify({ uploadId: 'upload-uuid-456', reviewedSnapshotHash: 'outdated-hash' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.errorCode).toBe('SNAPSHOT_CHANGED');
  });

  it('should return 202 PUBLISH_IN_PROGRESS when active lease exists', async () => {
    vi.mocked(supabaseLTE.from).mockImplementation(() => {
      return createChainableQuery({
        ...mockUploadRecord,
        status: 'publishing',
        publish_lease_expires_at: new Date(Date.now() + 60000).toISOString(),
      });
    });

    const request = new NextRequest('http://localhost:3000/api/admin/lte/publish', {
      method: 'POST',
      body: JSON.stringify({ uploadId: 'upload-uuid-456', reviewedSnapshotHash: 'test-snapshot-hash' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.status).toBe('publishing');
  });

  it('should return 200 idempotent response for already published upload', async () => {
    vi.mocked(supabaseLTE.from).mockImplementation(() => {
      return createChainableQuery({
        ...mockUploadRecord,
        status: 'published',
        publish_summary: {
          inserted: 148,
          skipped: 36,
        },
      });
    });

    const request = new NextRequest('http://localhost:3000/api/admin/lte/publish', {
      method: 'POST',
      body: JSON.stringify({ uploadId: 'upload-uuid-456', reviewedSnapshotHash: 'test-snapshot-hash' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.status).toBe('published');
    expect(data.inserted).toBe(148);
  });

  it('should successfully publish end-to-end', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/lte/publish', {
      method: 'POST',
      body: JSON.stringify({ uploadId: 'upload-uuid-456', reviewedSnapshotHash: 'test-snapshot-hash' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.status).toBe('published');
    expect(data.inserted).toBe(148);
    expect(data.skipped).toBe(36);
    expect(data.tableSummary).toBeDefined();

    expect(supabaseLTE.rpc).toHaveBeenCalledWith(
      'publish_lte_catalog_snapshot',
      {
        p_upload_id: 'upload-uuid-456',
        p_published_by: 'test-user-123',
        p_expected_snapshot_hash: 'test-snapshot-hash',
      }
    );
  });

  it('should handle RPC database error', async () => {
    vi.mocked(supabaseLTE.rpc).mockResolvedValue({
      data: null,
      error: { message: 'Database error', code: 'DB_ERROR' },
    } as any);

    const request = new NextRequest('http://localhost:3000/api/admin/lte/publish', {
      method: 'POST',
      body: JSON.stringify({ uploadId: 'upload-uuid-456', reviewedSnapshotHash: 'test-snapshot-hash' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.status).toBe('publish_failed');
    expect(updatePayloads).toContainEqual(expect.objectContaining({
      status: 'publish_failed',
      asset_status: 'cleanup_pending',
    }));
  });

  it('persists the rewritten final snapshot and activates its asset manifest', async () => {
    const finalSnapshot = {
      tables: {
        module_artifacts: {
          columns: ['artifact_url'],
          rows: [['https://assets.example.test/lte/test.pdf']],
        },
      },
    };
    const manifest = [{
      originalUrl: 'https://origin.example.test/test.pdf',
      r2Key: 'lte/uploads/upload-uuid-456/test.pdf',
      r2Url: 'https://assets.example.test/lte/test.pdf',
      contentHash: 'asset-content-hash',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      status: 'staged' as const,
      occurrences: [],
    }];
    const activateAssets = vi.fn().mockResolvedValue({ activatedCount: 1, failedKeys: [] });
    vi.mocked(processSnapshotAssets).mockResolvedValue({
      finalSnapshot,
      finalSnapshotHash: 'final-snapshot-hash',
      assetManifest: manifest,
      hasAssets: true,
    });
    vi.mocked(getR2StorageService).mockResolvedValue({ activateAssets } as any);

    const response = await POST(new NextRequest('http://localhost:3000/api/admin/lte/publish', {
      method: 'POST',
      body: JSON.stringify({ uploadId: 'upload-uuid-456', reviewedSnapshotHash: 'test-snapshot-hash' }),
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(expect.objectContaining({
      catalogPublished: true,
      assetsActive: true,
      assetStatus: 'active',
      retryScheduled: false,
    }));
    expect(updatePayloads).toContainEqual(expect.objectContaining({
      final_snapshot: finalSnapshot,
      final_snapshot_hash: 'final-snapshot-hash',
      asset_manifest: manifest,
      asset_status: 'staged',
    }));
    expect(supabaseLTE.rpc).toHaveBeenCalledWith('publish_lte_catalog_snapshot', expect.objectContaining({
      p_expected_snapshot_hash: 'final-snapshot-hash',
    }));
    expect(activateAssets).toHaveBeenCalledWith(['lte/uploads/upload-uuid-456/test.pdf']);
  });

  it('keeps the catalog published and schedules retry when asset activation fails', async () => {
    const manifest = [{
      originalUrl: 'https://origin.example.test/test.pdf',
      r2Key: 'lte/uploads/upload-uuid-456/test.pdf',
      r2Url: 'https://assets.example.test/lte/test.pdf',
      contentHash: 'asset-content-hash',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      status: 'staged' as const,
      occurrences: [],
    }];
    vi.mocked(processSnapshotAssets).mockResolvedValue({
      finalSnapshot: mockUploadRecord.reviewed_snapshot,
      finalSnapshotHash: 'final-snapshot-hash',
      assetManifest: manifest,
      hasAssets: true,
    });
    vi.mocked(getR2StorageService).mockResolvedValue({
      activateAssets: vi.fn().mockResolvedValue({
        activatedCount: 0,
        failedKeys: ['lte/uploads/upload-uuid-456/test.pdf'],
      }),
    } as any);

    const response = await POST(new NextRequest('http://localhost:3000/api/admin/lte/publish', {
      method: 'POST',
      body: JSON.stringify({ uploadId: 'upload-uuid-456', reviewedSnapshotHash: 'test-snapshot-hash' }),
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(expect.objectContaining({
      status: 'published',
      catalogPublished: true,
      assetsActive: false,
      assetStatus: 'activation_pending',
      retryScheduled: true,
    }));
    expect(updatePayloads).toContainEqual(expect.objectContaining({
      status: 'published',
      asset_status: 'activation_pending',
      next_asset_activation_at: expect.any(String),
      last_asset_activation_error: {
        failedKeys: ['lte/uploads/upload-uuid-456/test.pdf'],
      },
    }));
  });

  it('detects corruption when the stored reviewed snapshot no longer matches its hash', async () => {
    vi.mocked(calculateHash).mockReturnValueOnce('recomputed-corrupt-hash');

    const response = await POST(new NextRequest('http://localhost:3000/api/admin/lte/publish', {
      method: 'POST',
      body: JSON.stringify({ uploadId: 'upload-uuid-456', reviewedSnapshotHash: 'test-snapshot-hash' }),
    }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.errorCode).toBe('INTEGRITY_MISMATCH');
    expect(supabaseLTE.rpc).not.toHaveBeenCalled();
    expect(updatePayloads).toContainEqual(expect.objectContaining({
      status: 'publish_failed',
      last_publish_error: expect.objectContaining({ errorCode: 'INTEGRITY_MISMATCH' }),
    }));
  });

  it('Property 13: never exposes partial catalog success when the transaction fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          errorCode: fc.string({ minLength: 1, maxLength: 32 }),
          message: fc.string({ minLength: 1, maxLength: 120 }),
          attemptedInserted: fc.integer({ min: 0, max: 10000 }),
          attemptedSkipped: fc.integer({ min: 0, max: 10000 }),
        }),
        async ({ errorCode, message, attemptedInserted, attemptedSkipped }) => {
          vi.mocked(supabaseLTE.rpc).mockResolvedValueOnce({
            data: {
              status: 'error',
              errorCode,
              message,
              // A defensive input: failed RPCs must not leak partial counts even
              // if a database adapter accidentally includes them.
              inserted: attemptedInserted,
              skipped: attemptedSkipped,
            },
            error: null,
          } as any);

          const request = new NextRequest('http://localhost:3000/api/admin/lte/publish', {
            method: 'POST',
            body: JSON.stringify({
              uploadId: 'upload-uuid-456',
              reviewedSnapshotHash: 'test-snapshot-hash',
            }),
          });
          const response = await POST(request);
          const data = await response.json();

          expect(response.status).toBe(500);
          expect(data.success).toBe(false);
          expect(data.status).toBe('publish_failed');
          expect(data.inserted).toBe(0);
          expect(data.skipped).toBe(0);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('should handle unexpected errors gracefully', async () => {
    vi.mocked(supabaseLTE.from).mockImplementation(() => {
      throw new Error('Unexpected error');
    });

    const request = new NextRequest('http://localhost:3000/api/admin/lte/publish', {
      method: 'POST',
      body: JSON.stringify({ uploadId: 'upload-uuid-456', reviewedSnapshotHash: 'test-snapshot-hash' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.status).toBe('publish_failed');
    expect(data.error).toBe('Unexpected error');
  });
});
