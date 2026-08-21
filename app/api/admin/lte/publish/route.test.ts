import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// Now import after mocks are set up
import { POST } from './route';
import { NextRequest } from 'next/server';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseLTE } from '@/lib/supabase-lte';

describe('POST /api/admin/lte/publish', () => {
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
    normalized_snapshot: {
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

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    vi.mocked(authenticateSSORequest).mockResolvedValue({
      user: mockUser,
      error: null,
    });

    vi.mocked(supabaseLTE.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockUploadRecord,
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }),
    } as any);

    vi.mocked(supabaseLTE.rpc).mockResolvedValue({
      data: mockRPCResult,
      error: null,
    } as any);
  });

  it('should reject unauthorized requests', async () => {
    // Mock authentication failure
    vi.mocked(authenticateSSORequest).mockResolvedValue({
      user: null,
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });

    const request = new NextRequest('http://localhost:3000/api/admin/lte/publish', {
      method: 'POST',
      body: JSON.stringify({ uploadId: 'upload-uuid-456', confirm: true }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should reject requests with insufficient permissions', async () => {
    // Mock user without publish permission - this will fail auth check
    vi.mocked(authenticateSSORequest).mockResolvedValue({
      user: null,
      error: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    });

    const request = new NextRequest('http://localhost:3000/api/admin/lte/publish', {
      method: 'POST',
      body: JSON.stringify({ uploadId: 'upload-uuid-456', confirm: true }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it('should reject requests missing uploadId', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/lte/publish', {
      method: 'POST',
      body: JSON.stringify({ confirm: true }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Missing uploadId');
  });

  it('should reject requests missing confirmation', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/lte/publish', {
      method: 'POST',
      body: JSON.stringify({ uploadId: 'upload-uuid-456' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('confirmation is required');
  });

  it('should return 404 when upload does not exist', async () => {
    vi.mocked(supabaseLTE.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found', code: 'PGRST116' },
          }),
        }),
      }),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/admin/lte/publish', {
      method: 'POST',
      body: JSON.stringify({ uploadId: 'nonexistent-id', confirm: true }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Upload not found');
  });

  it('should reject uploads not in validated status', async () => {
    vi.mocked(supabaseLTE.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              ...mockUploadRecord,
              status: 'uploaded', // Wrong status
            },
            error: null,
          }),
        }),
      }),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/admin/lte/publish', {
      method: 'POST',
      body: JSON.stringify({ uploadId: 'upload-uuid-456', confirm: true }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('expected validated');
  });

  it('should reject hash mismatch before RPC call', async () => {
    // Mock upload with different hash
    vi.mocked(supabaseLTE.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              ...mockUploadRecord,
              snapshot_hash: 'different-hash',
            },
            error: null,
          }),
        }),
      }),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/admin/lte/publish', {
      method: 'POST',
      body: JSON.stringify({ uploadId: 'upload-uuid-456', confirm: true }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('hash mismatch');
  });

  it('should successfully publish end-to-end', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/lte/publish', {
      method: 'POST',
      body: JSON.stringify({ uploadId: 'upload-uuid-456', confirm: true }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.status).toBe('published');
    expect(data.inserted).toBe(148);
    expect(data.skipped).toBe(36);
    expect(data.tableSummary).toBeDefined();

    // Verify RPC was called with correct parameters
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
      body: JSON.stringify({ uploadId: 'upload-uuid-456', confirm: true }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.status).toBe('publish_failed');

    // Verify last_publish_error was updated
    expect(supabaseLTE.from).toHaveBeenCalledWith('lte_catalog_uploads');
  });

  it('should handle RPC returning error status', async () => {
    vi.mocked(supabaseLTE.rpc).mockResolvedValue({
      data: {
        status: 'error',
        message: 'Hash mismatch in RPC',
        errorCode: 'HASH_MISMATCH',
      },
      error: null,
    } as any);

    const request = new NextRequest('http://localhost:3000/api/admin/lte/publish', {
      method: 'POST',
      body: JSON.stringify({ uploadId: 'upload-uuid-456', confirm: true }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.status).toBe('publish_failed');
    expect(data.errorCode).toBe('HASH_MISMATCH');
  });

  it('should verify audit trail (published_at, published_by)', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/lte/publish', {
      method: 'POST',
      body: JSON.stringify({ uploadId: 'upload-uuid-456', confirm: true }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.completedAt).toBeDefined();
    
    // The audit trail is updated by the RPC function, not the API
    // We verify the RPC was called with the correct user ID
    expect(supabaseLTE.rpc).toHaveBeenCalledWith(
      'publish_lte_catalog_snapshot',
      expect.objectContaining({
        p_published_by: 'test-user-123',
      })
    );
  });

  it('should handle already-published idempotency', async () => {
    vi.mocked(supabaseLTE.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              ...mockUploadRecord,
              status: 'published', // Already published
            },
            error: null,
          }),
        }),
      }),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/admin/lte/publish', {
      method: 'POST',
      body: JSON.stringify({ uploadId: 'upload-uuid-456', confirm: true }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('expected validated');

    // RPC should not be called for already-published uploads
    expect(supabaseLTE.rpc).not.toHaveBeenCalled();
  });

  it('should handle unexpected errors gracefully', async () => {
    vi.mocked(supabaseLTE.from).mockImplementation(() => {
      throw new Error('Unexpected error');
    });

    const request = new NextRequest('http://localhost:3000/api/admin/lte/publish', {
      method: 'POST',
      body: JSON.stringify({ uploadId: 'upload-uuid-456', confirm: true }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.status).toBe('publish_failed');
    expect(data.error).toBe('Unexpected error');
  });
});
