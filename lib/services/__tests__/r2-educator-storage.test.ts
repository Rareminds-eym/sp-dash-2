import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ put: vi.fn(), bucket: vi.fn() }));
vi.mock('../course-assets-r2', () => ({ getSharedAssetsBucket: mocks.bucket }));
import { uploadEducatorDocument } from '../r2-educator-storage';

describe('trainer shared R2 storage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.bucket.mockResolvedValue({ put: mocks.put });
  });

  it('writes to the shared bucket and returns an authenticated document URL', async () => {
    const file = new File(['document'], 'degree.pdf', { type: 'application/pdf' });
    const result = await uploadEducatorDocument(file, 'EDU-123', 'degree-certificate', 'https://dashboard.example/api/educators/upload-document');
    expect(result.success).toBe(true);
    expect(mocks.put).toHaveBeenCalledWith(result.key, expect.any(Uint8Array), { httpMetadata: { contentType: 'application/pdf' } });
    const url = new URL(result.url!);
    expect(url.pathname).toBe('/api/educators/documents');
    expect(url.searchParams.get('key')).toBe(result.key);
  });

  it('rejects a path traversal educator ID before writing', async () => {
    const result = await uploadEducatorDocument(new File(['x'], 'id.pdf', { type: 'application/pdf' }), '../other', 'id-proof', 'https://dashboard.example');
    expect(result.success).toBe(false);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('reports a failed bucket write without a success URL', async () => {
    mocks.put.mockRejectedValue(new Error('Storage unavailable'));
    const result = await uploadEducatorDocument(new File(['x'], 'id.pdf', { type: 'application/pdf' }), 'EDU-123', 'id-proof', 'https://dashboard.example');
    expect(result).toEqual({ success: false, error: 'Storage unavailable' });
  });
});
