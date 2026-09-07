import { R2StorageService, type R2BucketLike, type R2ObjectLike, type R2HeadLike } from './r2-storage';

class LocalFallbackR2Bucket implements R2BucketLike {
  private store = new Map<string, { body: Uint8Array; httpMetadata?: any; customMetadata?: any }>();

  async put(key: string, value: Uint8Array | ReadableStream<Uint8Array>, options?: Record<string, unknown>): Promise<unknown> {
    let bytes: Uint8Array;
    if (value instanceof Uint8Array) {
      bytes = value;
    } else {
      const reader = value.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        if (chunk) chunks.push(chunk);
      }
      const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
      bytes = new Uint8Array(totalLength);
      let offset = 0;
      for (const c of chunks) {
        bytes.set(c, offset);
        offset += c.length;
      }
    }
    this.store.set(key, {
      body: bytes,
      httpMetadata: options?.httpMetadata as any,
      customMetadata: options?.customMetadata as any,
    });
    return {};
  }

  async get(key: string): Promise<R2ObjectLike | null> {
    const item = this.store.get(key);
    if (!item) return null;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(item.body);
        controller.close();
      },
    });
    return {
      body: stream,
      httpMetadata: item.httpMetadata,
      customMetadata: item.customMetadata,
    };
  }

  async head(key: string): Promise<R2HeadLike | null> {
    const item = this.store.get(key);
    if (!item) return null;
    return { customMetadata: item.customMetadata };
  }

  async delete(keys: string | string[]): Promise<void> {
    const arr = Array.isArray(keys) ? keys : [keys];
    for (const k of arr) this.store.delete(k);
  }
}

let fallbackBucket: LocalFallbackR2Bucket | null = null;

export async function getR2StorageService(): Promise<R2StorageService> {
  let bucket: R2BucketLike | undefined;

  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const context = await getCloudflareContext({ async: true }) as unknown as { env: { LTE_ASSETS?: R2BucketLike } };
    bucket = context?.env?.LTE_ASSETS;
  } catch (error) {
    // Cloudflare context unavailable in standard Node.js dev server
  }

  if (!bucket) {
    if (!fallbackBucket) {
      fallbackBucket = new LocalFallbackR2Bucket();
    }
    bucket = fallbackBucket;
  }

  const publicDomain = process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || 'https://assets.rareminds.in';
  return new R2StorageService(bucket, publicDomain);
}
