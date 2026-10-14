import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  bulkPreviewStats,
  getBulkPreview,
  saveBulkPreview,
} from '@/lib/services/bulk-preview-store';
import { BULK_PREVIEW_MAX_ENTRIES } from '@/lib/services/course-resource-validation';
import {
  checkCourseAssetsHealth,
  CourseAssetsBindingError,
  getCourseAssetsBucket,
} from '@/lib/services/course-assets-r2';

function sampleResource(n: number) {
  return {
    rowNumber: n,
    course_id: '',
    course_code: 'C',
    course_name: 'N',
    module_id: '',
    module_title: 'M',
    lesson_id: 'L',
    lesson_title: 'L',
    resource_name: `R${n}`,
    resource_type: 'link',
    resource_url: 'https://example.com/x',
    file_path: '',
    file_size: '',
    thumbnail_url: '',
    embed_url: '',
    order_index: 0,
    notes: '',
  };
}

describe('Blocker 4: R2 fail-closed', () => {
  const FLAG = 'COURSE_ASSETS_LOCAL_FALLBACK';
  let prev: string | undefined;
  beforeEach(() => {
    prev = process.env[FLAG];
    delete process.env[FLAG];
  });
  afterEach(() => {
    if (prev === undefined) delete process.env[FLAG];
    else process.env[FLAG] = prev;
  });

  it('throws a binding error when no R2 binding and no explicit flag', async () => {
    await expect(getCourseAssetsBucket()).rejects.toBeInstanceOf(CourseAssetsBindingError);
    const health = await checkCourseAssetsHealth();
    expect(health.ok).toBe(false);
  });

  it('allows volatile fallback ONLY with explicit local flag', async () => {
    process.env[FLAG] = '1';
    const bucket = await getCourseAssetsBucket();
    await bucket.put('courses/resources/uploads/2024/01/t-abc123.pdf', new Uint8Array([1, 2, 3]));
    // Unsigned key shapes are rejected by the serving allow-list, but the
    // bucket round-trip itself proves the explicit-fallback path works.
    expect(await bucket.get('courses/resources/uploads/2024/01/t-abc123.pdf')).not.toBeNull();
  });

  it('does not treat NODE_ENV alone as an environment boundary', async () => {
    const prevNode = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = 'development';
    try {
      await expect(getCourseAssetsBucket()).rejects.toBeInstanceOf(CourseAssetsBindingError);
    } finally {
      (process.env as Record<string, string>).NODE_ENV = prevNode as string;
    }
  });
});

describe('Blocker 5: bounded preview store', () => {
  it('evicts oldest entries beyond the cap (LRU)', () => {
    const ids: string[] = [];
    for (let i = 0; i < BULK_PREVIEW_MAX_ENTRIES + 10; i += 1) {
      ids.push(saveBulkPreview([sampleResource(i)], ['a.xlsx']));
    }
    expect(bulkPreviewStats().size).toBeLessThanOrEqual(BULK_PREVIEW_MAX_ENTRIES);
    // Oldest evicted, newest retained.
    expect(getBulkPreview(ids[0])).toBeNull();
    expect(getBulkPreview(ids[ids.length - 1])).not.toBeNull();
  });
});
