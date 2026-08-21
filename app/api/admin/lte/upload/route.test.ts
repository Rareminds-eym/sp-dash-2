import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock server-only modules before importing the route
vi.mock('@/lib/middleware/sso-auth', () => ({
  authenticateSSORequest: vi.fn(),
}));

vi.mock('@/lib/supabase-lte', () => ({
  supabaseLTE: {
    from: vi.fn(),
  },
}));

vi.mock('@/lib/services/lte-ingestion-service', () => ({
  LTEIngestionService: {
    processIngestionSource: vi.fn(),
  },
}));

vi.mock('crypto', () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => 'mocked-hash-abc123'),
  })),
}));

// Now import after mocks are set up
import { POST } from './route';
import { NextRequest } from 'next/server';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseLTE } from '@/lib/supabase-lte';
import { LTEIngestionService } from '@/lib/services/lte-ingestion-service';

describe('POST /api/admin/lte/upload', () => {
  const mockUser = {
    userId: 'test-user-123',
    role: 'admin',
    email: 'admin@test.com',
  };

  const mockSnapshot = {
    uploadId: 'temp-id-123',
    sourceType: 'xlsx' as const,
    sourceName: 'test.xlsx',
    snapshotHash: 'abc123hash',
    status: 'validated' as const,
    validationReport: {
      verified: true,
      totalRowsParsed: 100,
      tableSummaries: [],
      validationItems: [],
      errors: [],
      warnings: [],
    },
    courseMetadata: {
      courseTitle: 'Test Course',
      courseCode: 'TEST-101',
      domain: 'Technology',
      capabilityCode: 'WEB_DEV',
      capabilityLevel: 'Level 1',
      instructorLead: 'Test Instructor',
      courseSummary: 'Test summary',
      problemStatement: 'Test problem',
      capstoneTitle: 'Test capstone',
    },
    modules: [],
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    vi.mocked(authenticateSSORequest).mockResolvedValue({
      user: mockUser,
      error: null,
    });

    vi.mocked(supabaseLTE.from).mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'db-generated-uuid-456' },
            error: null,
          }),
        }),
      }),
    } as any);

    vi.mocked(LTEIngestionService.processIngestionSource).mockResolvedValue(mockSnapshot);
  });

  it('should reject unauthorized requests', async () => {
    // Mock authentication failure
    vi.mocked(authenticateSSORequest).mockResolvedValue({
      user: null,
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });

    const formData = new FormData();
    formData.append('file', new Blob(['test'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'test.xlsx');

    const request = new NextRequest('http://localhost:3000/api/admin/lte/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should reject files with invalid extension', async () => {
    const formData = new FormData();
    formData.append('file', new Blob(['test'], { type: 'text/csv' }), 'test.csv');

    const request = new NextRequest('http://localhost:3000/api/admin/lte/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('.xlsx');
  });

  it('should reject files exceeding size limit', async () => {
    const largeBuffer = new ArrayBuffer(11 * 1024 * 1024); // 11 MB
    const formData = new FormData();
    formData.append('file', new Blob([largeBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'large.xlsx');

    const request = new NextRequest('http://localhost:3000/api/admin/lte/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('exceeds maximum allowed limit');
  });

  it('should reject uploads with too many rows', async () => {
    // Mock snapshot with too many rows
    vi.mocked(LTEIngestionService.processIngestionSource).mockResolvedValue({
      ...mockSnapshot,
      validationReport: {
        ...mockSnapshot.validationReport,
        totalRowsParsed: 15000, // Exceeds 10,000 limit
      },
    });

    const formData = new FormData();
    formData.append('file', new Blob(['test'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'test.xlsx');

    const request = new NextRequest('http://localhost:3000/api/admin/lte/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('exceeds maximum allowed limit of 10000 rows');
  });

  it('should successfully process valid XLSX upload', async () => {
    const formData = new FormData();
    formData.append('file', new Blob(['test'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'test.xlsx');

    const request = new NextRequest('http://localhost:3000/api/admin/lte/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.uploadId).toBe('db-generated-uuid-456');
    expect(data.snapshot).toBeDefined();
    expect(data.snapshot.uploadId).toBe('db-generated-uuid-456');

    // Verify ingestion service was called
    expect(LTEIngestionService.processIngestionSource).toHaveBeenCalledWith(
      'xlsx',
      'test.xlsx',
      expect.any(ArrayBuffer),
      mockUser.userId
    );

    // Verify database insert was called
    expect(supabaseLTE.from).toHaveBeenCalledWith('lte_catalog_uploads');
  });

  it('should handle database insertion errors', async () => {
    // Mock database error
    vi.mocked(supabaseLTE.from).mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error', code: 'DB_ERROR' },
          }),
        }),
      }),
    } as any);

    const formData = new FormData();
    formData.append('file', new Blob(['test'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'test.xlsx');

    const request = new NextRequest('http://localhost:3000/api/admin/lte/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Database insert failed');
  });

  it('should verify validation result structure', async () => {
    const formData = new FormData();
    formData.append('file', new Blob(['test'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'test.xlsx');

    const request = new NextRequest('http://localhost:3000/api/admin/lte/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.snapshot.validationReport).toBeDefined();
    expect(data.snapshot.validationReport).toHaveProperty('verified');
    expect(data.snapshot.validationReport).toHaveProperty('totalRowsParsed');
    expect(data.snapshot.validationReport).toHaveProperty('tableSummaries');
    expect(data.snapshot.validationReport).toHaveProperty('validationItems');
    expect(data.snapshot.validationReport).toHaveProperty('errors');
    expect(data.snapshot.validationReport).toHaveProperty('warnings');
  });

  it('should reject requests with missing file', async () => {
    const formData = new FormData();
    // No file added

    const request = new NextRequest('http://localhost:3000/api/admin/lte/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('valid .xlsx workbook file');
  });

  it('should reject unsupported content types', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/lte/upload', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
      },
      body: 'plain text',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Unsupported Content-Type');
  });
});
