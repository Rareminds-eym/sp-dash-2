import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock server-only modules before importing the route
vi.mock('@/lib/middleware/sso-auth', () => ({
  authenticateSSORequest: vi.fn(),
}));

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

// Now import after mocks are set up
import { GET } from './route';
import { NextRequest } from 'next/server';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

describe('GET /api/admin/lte/review', () => {
  const mockUser = {
    userId: 'test-user-123',
    role: 'admin',
    email: 'admin@test.com',
  };

  const mockUploadRecord = {
    id: 'upload-uuid-456',
    source_name: 'test-course.xlsx',
    status: 'validated',
    created_by: 'test-user-123',
    created_at: '2026-08-18T10:00:00Z',
    validation_result: {
      verified: true,
      totalRowsParsed: 100,
      tableSummaries: [],
      validationItems: [],
      errors: [],
      warnings: [],
    },
    normalized_snapshot: {
      courseMetadata: {
        courseTitle: 'Introduction to Web Development',
        courseCode: 'WEB-101',
        domain: 'Technology',
        capabilityCode: 'WEB_DEV',
        capabilityLevel: 'Level 1',
        instructorLead: 'John Smith',
        courseSummary: 'Learn the fundamentals of web development',
        problemStatement: 'Build modern web applications',
        capstoneTitle: 'Portfolio Website',
      },
      modules: [
        {
          index: 0,
          title: 'HTML Basics',
          subtitle: 'Introduction to HTML',
          completionPercentage: 0,
          status: 'not_started',
          contextDescription: 'Learn HTML fundamentals',
          stages: [
            {
              type: 'engage',
              title: 'What is HTML?',
              subtitle: 'Understanding markup',
            },
            {
              type: 'explore',
              title: 'HTML Elements',
              subtitle: 'Common tags',
            },
          ],
          artifactPractices: ['Build a simple webpage'],
        },
        {
          index: 1,
          title: 'CSS Styling',
          subtitle: 'Introduction to CSS',
          completionPercentage: 0,
          status: 'not_started',
          contextDescription: 'Learn CSS fundamentals',
          stages: [
            {
              type: 'engage',
              title: 'What is CSS?',
              subtitle: 'Understanding styles',
            },
          ],
          artifactPractices: ['Style a webpage'],
        },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    vi.mocked(authenticateSSORequest).mockResolvedValue({
      user: mockUser,
      error: null,
    });

    vi.mocked(supabaseAdmin.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockUploadRecord,
            error: null,
          }),
        }),
      }),
    } as any);
  });

  it('should reject unauthorized requests', async () => {
    // Mock authentication failure
    vi.mocked(authenticateSSORequest).mockResolvedValue({
      user: null,
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });

    const request = new NextRequest('http://localhost:3000/api/admin/lte/review?uploadId=upload-uuid-456', {
      method: 'GET',
    });

    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('should reject requests missing uploadId parameter', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/lte/review', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('uploadId');
  });

  it('should return 404 when upload does not exist', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found', code: 'PGRST116' },
          }),
        }),
      }),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/admin/lte/review?uploadId=nonexistent-id', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('not found');
  });

  it('should reject unauthorized access to another user\'s upload', async () => {
    // Upload belongs to different user
    vi.mocked(supabaseAdmin.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              ...mockUploadRecord,
              created_by: 'different-user-456',
            },
            error: null,
          }),
        }),
      }),
    } as any);

    // Mock user without elevated permissions
    vi.mocked(authenticateSSORequest).mockResolvedValue({
      user: {
        userId: 'test-user-123',
        role: 'viewer', // Not admin
        email: 'viewer@test.com',
      },
      error: null,
    });

    const request = new NextRequest('http://localhost:3000/api/admin/lte/review?uploadId=upload-uuid-456', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Unauthorized');
  });

  it('should allow admin to access any upload', async () => {
    // Upload belongs to different user
    vi.mocked(supabaseAdmin.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              ...mockUploadRecord,
              created_by: 'different-user-456',
            },
            error: null,
          }),
        }),
      }),
    } as any);

    // Admin user should have access
    const request = new NextRequest('http://localhost:3000/api/admin/lte/review?uploadId=upload-uuid-456', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should successfully retrieve validated snapshot', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/lte/review?uploadId=upload-uuid-456', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.uploadId).toBe('upload-uuid-456');
    expect(data.sourceName).toBe('test-course.xlsx');
    expect(data.status).toBe('validated');
    expect(data.validationReport).toBeDefined();
    expect(data.courseSpecification).toBeDefined();
    expect(data.modules).toBeDefined();
    expect(data.createdAt).toBe('2026-08-18T10:00:00Z');

    // Verify Supabase query was called correctly
    expect(supabaseAdmin.from).toHaveBeenCalledWith('lte_catalog_uploads');
    const fromMock = vi.mocked(supabaseAdmin.from).mock.results[0]?.value;
    expect(fromMock.select).toHaveBeenCalledWith('*');
  });

  it('should extract course specification from snapshot', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/lte/review?uploadId=upload-uuid-456', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.courseSpecification).toEqual({
      courseTitle: 'Introduction to Web Development',
      courseCode: 'WEB-101',
      domain: 'Technology',
      capabilityCode: 'WEB_DEV',
      capabilityLevel: 'Level 1',
      instructorLead: 'John Smith',
      courseSummary: 'Learn the fundamentals of web development',
      problemStatement: 'Build modern web applications',
      capstoneArtifactTitle: 'Portfolio Website',
    });
  });

  it('should extract modules with 6 Es stages', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/lte/review?uploadId=upload-uuid-456', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.modules).toHaveLength(2);
    
    // Verify first module
    expect(data.modules[0]).toEqual({
      index: 0,
      title: 'HTML Basics',
      subtitle: 'Introduction to HTML',
      completionPercentage: 0,
      status: 'not_started',
      contextDescription: 'Learn HTML fundamentals',
      stages: [
        {
          type: 'engage',
          title: 'What is HTML?',
          subtitle: 'Understanding markup',
        },
        {
          type: 'explore',
          title: 'HTML Elements',
          subtitle: 'Common tags',
        },
      ],
      artifactPractices: ['Build a simple webpage'],
    });

    // Verify second module
    expect(data.modules[1]).toEqual({
      index: 1,
      title: 'CSS Styling',
      subtitle: 'Introduction to CSS',
      completionPercentage: 0,
      status: 'not_started',
      contextDescription: 'Learn CSS fundamentals',
      stages: [
        {
          type: 'engage',
          title: 'What is CSS?',
          subtitle: 'Understanding styles',
        },
      ],
      artifactPractices: ['Style a webpage'],
    });
  });

  it('should handle missing course metadata gracefully', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              ...mockUploadRecord,
              normalized_snapshot: {
                // courseMetadata is missing
                modules: [],
              },
            },
            error: null,
          }),
        }),
      }),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/admin/lte/review?uploadId=upload-uuid-456', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.courseSpecification).toEqual({
      courseTitle: 'Unknown Course',
      courseCode: 'UNKNOWN',
      domain: 'General',
      capabilityCode: 'UNKNOWN',
      capabilityLevel: 'Level 1',
      instructorLead: 'Unknown Instructor',
      courseSummary: '',
      problemStatement: '',
      capstoneArtifactTitle: '',
    });
  });

  it('should handle missing modules gracefully', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              ...mockUploadRecord,
              normalized_snapshot: {
                courseMetadata: mockUploadRecord.normalized_snapshot.courseMetadata,
                // modules is missing
              },
            },
            error: null,
          }),
        }),
      }),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/admin/lte/review?uploadId=upload-uuid-456', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.modules).toEqual([]);
  });

  it('should handle database query errors', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database connection error', code: 'DB_ERROR' },
          }),
        }),
      }),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/admin/lte/review?uploadId=upload-uuid-456', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('not found');
  });

  it('should handle unexpected errors gracefully', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      throw new Error('Unexpected error');
    });

    const request = new NextRequest('http://localhost:3000/api/admin/lte/review?uploadId=upload-uuid-456', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Unexpected error');
  });
});
