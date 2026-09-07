import { extname, basename } from 'node:path';

export interface R2ObjectLike {
  body: ReadableStream<Uint8Array>;
  customMetadata?: Record<string, string>;
  httpMetadata?: { contentType?: string; [key: string]: unknown };
}

export interface R2HeadLike {
  customMetadata?: Record<string, string>;
}

export interface R2BucketLike {
  put(key: string, value: Uint8Array | ReadableStream<Uint8Array>, options?: Record<string, unknown>): Promise<unknown>;
  get(key: string): Promise<R2ObjectLike | null>;
  head(key: string): Promise<R2HeadLike | null>;
  delete(keys: string | string[]): Promise<void>;
}

export interface AssetKeyContext {
  capabilityCode: string;
  levelCode: string;
  moduleNo: number;
  artifactType: 'final' | 'practice';
  originalUrl: string;
  contentHash: string;
  mimeType: string;
}

export interface UploadAssetInput extends AssetKeyContext {
  bytes: Uint8Array;
  uploadId: string;
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'video/mp4': '.mp4',
  'audio/mpeg': '.mp3',
  'application/json': '.json',
  'application/zip': '.zip',
};

function safeSegment(value: string, fallback: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || fallback;
}

function safeFilename(context: AssetKeyContext): string {
  let urlName = '';
  try { urlName = decodeURIComponent(basename(new URL(context.originalUrl).pathname)); } catch { /* fallback */ }
  const urlExtension = extname(urlName).toLowerCase();
  const extension = /^\.[a-z0-9]{1,8}$/.test(urlExtension)
    ? urlExtension
    : (EXTENSION_BY_MIME[context.mimeType] || '.bin');
  const stem = safeSegment(urlName.slice(0, urlName.length - urlExtension.length), 'asset').slice(0, 80);
  const hash = context.contentHash.toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('contentHash must be a 64-character SHA-256 hex digest');
  return `${stem}-${hash.slice(0, 16)}${extension}`;
}

export function generateStableAssetKey(context: AssetKeyContext): string {
  const capability = safeSegment(context.capabilityCode, 'CAPABILITY');
  const level = safeSegment(context.levelCode, 'LEVEL');
  const moduleNo = Number.isInteger(context.moduleNo) && context.moduleNo >= 0 ? context.moduleNo : 0;
  return `lte/resources/capabilities/${capability}/levels/${level}/modules-${moduleNo}` +
    `/artifacts/${context.artifactType}/${safeFilename(context)}`;
}

export class R2StorageService {
  constructor(
    private readonly bucket: R2BucketLike,
    private readonly publicDomain: string,
  ) {}

  async uploadAsset(input: UploadAssetInput, maxAttempts = 3): Promise<{ key: string; publicUrl: string }> {
    const key = generateStableAssetKey(input);
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.bucket.put(key, input.bytes, {
          httpMetadata: { contentType: input.mimeType },
          customMetadata: {
            originalUrl: input.originalUrl,
            uploadedAt: new Date().toISOString(),
            uploadId: input.uploadId,
            mimeType: input.mimeType,
            contentHash: input.contentHash,
            lifecycle: 'staged',
          },
        });
        return { key, publicUrl: `${this.publicDomain.replace(/\/$/, '')}/${key}` };
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** (attempt - 1)));
      }
    }
    throw lastError instanceof Error ? lastError : new Error('R2 asset upload failed');
  }

  async activateAssets(keys: string[]): Promise<{ activated: number; failedKeys: string[] }> {
    let activated = 0;
    const failedKeys: string[] = [];
    for (let offset = 0; offset < keys.length; offset += 1000) {
      for (const key of [...new Set(keys.slice(offset, offset + 1000))]) {
        try {
          const object = await this.bucket.get(key);
          if (!object) throw new Error('Object not found');
          if (object.customMetadata?.lifecycle === 'active') continue;
          await this.bucket.put(key, object.body, {
            httpMetadata: object.httpMetadata,
            customMetadata: { ...(object.customMetadata || {}), lifecycle: 'active', activatedAt: new Date().toISOString() },
          });
          activated += 1;
        } catch { failedKeys.push(key); }
      }
    }
    return { activated, failedKeys };
  }

  async deleteStagedAssets(keys: string[]): Promise<{ deleted: number; failedKeys: string[] }> {
    const staged: string[] = [];
    const failedKeys: string[] = [];
    for (const key of [...new Set(keys)]) {
      try {
        const object = await this.bucket.head(key);
        if (!object) continue;
        if (object.customMetadata?.lifecycle !== 'active') staged.push(key);
      } catch { failedKeys.push(key); }
    }
    let deleted = 0;
    for (let offset = 0; offset < staged.length; offset += 1000) {
      const batch = staged.slice(offset, offset + 1000);
      try { await this.bucket.delete(batch); deleted += batch.length; }
      catch { failedKeys.push(...batch); }
    }
    return { deleted, failedKeys: [...new Set(failedKeys)] };
  }
}
