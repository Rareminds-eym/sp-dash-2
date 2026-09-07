import { describe, expect, it, vi } from 'vitest';
import {
  generateStableAssetKey,
  R2StorageService,
  type R2BucketLike,
  type R2ObjectLike,
} from './r2-storage';

const HASH = 'a'.repeat(64);
const context = {
  capabilityCode: 'CIE/CAP',
  levelCode: 'L1',
  moduleNo: 2,
  artifactType: 'practice' as const,
  originalUrl: 'https://cdn.example.com/files/My.Workbook.Final.PDF?version=2',
  contentHash: HASH,
  mimeType: 'application/pdf',
};

function stream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } });
}

class MemoryBucket implements R2BucketLike {
  objects = new Map<string, { bytes: Uint8Array; options: any }>();
  failures = 0;

  async put(key: string, value: Uint8Array | ReadableStream<Uint8Array>, options: any = {}) {
    if (this.failures-- > 0) throw new Error('temporary failure');
    let bytes = value as Uint8Array;
    if (value instanceof ReadableStream) {
      bytes = new Uint8Array(await new Response(value).arrayBuffer());
    }
    this.objects.set(key, { bytes, options });
  }
  async get(key: string): Promise<R2ObjectLike | null> {
    const item = this.objects.get(key);
    return item ? {
      body: stream(item.bytes),
      customMetadata: item.options.customMetadata,
      httpMetadata: item.options.httpMetadata,
    } : null;
  }
  async head(key: string) {
    const item = this.objects.get(key);
    return item ? { customMetadata: item.options.customMetadata } : null;
  }
  async delete(keys: string | string[]) {
    for (const key of Array.isArray(keys) ? keys : [keys]) this.objects.delete(key);
  }
}

describe('R2StorageService', () => {
  it('generates stable taxonomy keys with a content-hash suffix', () => {
    const first = generateStableAssetKey(context);
    const second = generateStableAssetKey({ ...context });
    expect(first).toBe(second);
    expect(first).toBe('lte/resources/capabilities/CIE-CAP/levels/L1/modules-2/artifacts/practice/My-Workbook-Final-aaaaaaaaaaaaaaaa.pdf');
  });

  it('requires a complete SHA-256 digest', () => {
    expect(() => generateStableAssetKey({ ...context, contentHash: 'not-a-hash' })).toThrow('SHA-256');
  });

  it('uploads staged bytes with metadata and retries temporary failures', async () => {
    const bucket = new MemoryBucket();
    bucket.failures = 2;
    const service = new R2StorageService(bucket, 'https://assets.example.com/');
    const result = await service.uploadAsset({
      ...context,
      bytes: new TextEncoder().encode('asset'),
      uploadId: 'upload-1',
    });
    const stored = bucket.objects.get(result.key)!;

    expect(result.publicUrl).toBe(`https://assets.example.com/${result.key}`);
    expect(stored.options.httpMetadata).toEqual({ contentType: 'application/pdf' });
    expect(stored.options.customMetadata).toMatchObject({
      lifecycle: 'staged',
      uploadId: 'upload-1',
      originalUrl: context.originalUrl,
      contentHash: HASH,
    });
  });

  it('activates staged objects and treats active objects idempotently', async () => {
    const bucket = new MemoryBucket();
    const service = new R2StorageService(bucket, 'https://assets.example.com');
    const uploaded = await service.uploadAsset({ ...context, bytes: new Uint8Array([1]), uploadId: 'upload-1' });

    expect(await service.activateAssets([uploaded.key])).toEqual({ activated: 1, failedKeys: [] });
    expect(await service.activateAssets([uploaded.key])).toEqual({ activated: 0, failedKeys: [] });
    expect(bucket.objects.get(uploaded.key)?.options.customMetadata.lifecycle).toBe('active');
  });

  it('deletes only staged objects and preserves active objects', async () => {
    const bucket = new MemoryBucket();
    const service = new R2StorageService(bucket, 'https://assets.example.com');
    const staged = await service.uploadAsset({ ...context, bytes: new Uint8Array([1]), uploadId: 'one' });
    const active = await service.uploadAsset({ ...context, contentHash: 'b'.repeat(64), bytes: new Uint8Array([2]), uploadId: 'two' });
    await service.activateAssets([active.key]);

    expect(await service.deleteStagedAssets([staged.key, active.key])).toEqual({ deleted: 1, failedKeys: [] });
    expect(bucket.objects.has(staged.key)).toBe(false);
    expect(bucket.objects.has(active.key)).toBe(true);
  });
});
