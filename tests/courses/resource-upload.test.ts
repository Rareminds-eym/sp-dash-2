import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ put: vi.fn(), send: vi.fn(), kvPut: vi.fn() }));
vi.mock('@/lib/middleware/sso-auth', () => ({ authenticateSSORequest: vi.fn(async () => ({ user: { id: 'admin' }, error: null })) }));
vi.mock('@/lib/services/course-assets-r2', () => ({
  CourseAssetsBindingError: class extends Error {},
  getCourseAssetsBucket: vi.fn(async () => ({ put: mocks.put, delete: vi.fn() })),
}));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: vi.fn(async () => ({ env: {
  COURSE_MANAGEMENT_UPLOAD_QUEUE: { send: mocks.send },
  RATE_LIMIT_KV: { put: mocks.kvPut, delete: vi.fn() },
} })) }));

import { POST } from '@/app/api/courses/resource-upload/route';

describe('course file upload', () => {
  const originalEnv = process.env.NODE_ENV;
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { (process.env as Record<string, string>).NODE_ENV = originalEnv; });

  it('stores a PPTX directly in local development without leaving a queued job', async () => {
    (process.env as Record<string, string>).NODE_ENV = 'development';
    const form = new FormData();
    form.append('file', new File(['presentation'], 'slides.pptx', { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }));
    form.append('resourceType', 'document');
    form.append('resourceName', 'Slides');
    const response = await POST(new Request('http://localhost/api/courses/resource-upload', { method: 'POST', body: form }) as never);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe('completed');
    expect(body.r2Url).toContain('/api/courses/assets?key=');
    expect(mocks.put).toHaveBeenCalledOnce();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('queues uploads in production', async () => {
    (process.env as Record<string, string>).NODE_ENV = 'production';
    const form = new FormData();
    form.append('file', new File(['presentation'], 'slides.pptx'));
    form.append('resourceType', 'document');
    form.append('resourceName', 'Slides');
    const response = await POST(new Request('http://localhost/api/courses/resource-upload', { method: 'POST', body: form }) as never);
    expect(response.status).toBe(202);
    expect((await response.json()).status).toBe('queued');
    expect(mocks.put).toHaveBeenCalledOnce();
    expect(mocks.kvPut).toHaveBeenCalledOnce();
    expect(mocks.send).toHaveBeenCalledOnce();
  });
});
