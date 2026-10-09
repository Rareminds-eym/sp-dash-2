/**
 * Course Management R2 bucket accessor (COURSE_ASSETS).
 *
 * Separate bucket from LTE_ASSETS to isolate course management resources.
 *
 * Fail-closed contract (P0): deployed environments MUST resolve the
 * Cloudflare R2 binding. A silent in-memory fallback would report a
 * successful upload from one isolate while a later request (different
 * isolate) cannot retrieve the object. Local memory fallback is therefore
 * opt-in via COURSE_ASSETS_LOCAL_FALLBACK=1 only — never NODE_ENV alone.
 */

export class CourseAssetsBindingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CourseAssetsBindingError';
  }
}

export interface CourseAssetBucketLike {
  put(
    key: string,
    value: Uint8Array | ArrayBuffer | ReadableStream<Uint8Array>,
    options?: Record<string, unknown>
  ): Promise<unknown>;
  get(
    key: string,
    options?: { range?: { offset: number; length?: number } }
  ): Promise<{
    body: ReadableStream<Uint8Array> | null;
    httpMetadata?: { contentType?: string };
    customMetadata?: Record<string, string>;
    size?: number;
  } | null>;
  delete(key: string): Promise<void>;
}

class LocalFallbackCourseBucket implements CourseAssetBucketLike {
  private store = new Map<
    string,
    { body: Uint8Array; httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }
  >();

  async put(
    key: string,
    value: Uint8Array | ArrayBuffer | ReadableStream<Uint8Array>,
    options?: Record<string, unknown>
  ): Promise<unknown> {
    let bytes: Uint8Array;
    if (value instanceof Uint8Array) {
      bytes = value;
    } else if (value instanceof ArrayBuffer) {
      bytes = new Uint8Array(value);
    } else {
      const reader = (value as ReadableStream<Uint8Array>).getReader();
      const chunks: Uint8Array[] = [];
      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        if (chunk) chunks.push(chunk);
      }
      const total = chunks.reduce((acc, c) => acc + c.length, 0);
      bytes = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        bytes.set(c, offset);
        offset += c.length;
      }
    }
    const opts = (options || {}) as {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    };
    this.store.set(key, {
      body: bytes,
      httpMetadata: opts.httpMetadata,
      customMetadata: opts.customMetadata,
    });
    return { key };
  }

  async get(key: string, options?: { range?: { offset: number; length?: number } }) {
    const item = this.store.get(key);
    if (!item) return null;
    let body = item.body;
    if (options?.range) {
      const start = Math.max(0, options.range.offset || 0);
      const end = options.range.length !== undefined
        ? Math.min(body.byteLength, start + options.range.length)
        : body.byteLength;
      body = body.slice(start, Math.max(start, end));
    }
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(body);
        controller.close();
      },
    });
    return {
      body: stream,
      httpMetadata: item.httpMetadata,
      customMetadata: item.customMetadata,
      size: body.byteLength,
    };
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

let fallbackBucket: LocalFallbackCourseBucket | null = null;

function isExplicitLocalFallbackAllowed(): boolean {
  const flag =
    (typeof process !== 'undefined' &&
      (process.env?.COURSE_ASSETS_LOCAL_FALLBACK ||
        process.env?.NEXT_PUBLIC_COURSE_ASSETS_LOCAL_FALLBACK)) ||
    '';
  return String(flag).trim() === '1';
}

export async function getCourseAssetsBucket(): Promise<CourseAssetBucketLike> {
  let bucket: CourseAssetBucketLike | undefined;

  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const context = (await getCloudflareContext({ async: true })) as unknown as {
      env?: { COURSE_ASSETS?: CourseAssetBucketLike };
    };
    bucket = context?.env?.COURSE_ASSETS;
  } catch {
    // Cloudflare context unavailable in standard Node.js dev server
  }

  if (bucket) return bucket;

  // No binding resolved. Only an explicit local-dev flag permits the
  // volatile in-memory bucket; deployed envs fail closed instead of
  // falsely reporting upload success.
  if (isExplicitLocalFallbackAllowed()) {
    if (!fallbackBucket) fallbackBucket = new LocalFallbackCourseBucket();
    return fallbackBucket;
  }

  throw new CourseAssetsBindingError(
    'COURSE_ASSETS R2 binding is not configured. ' +
      'Verify wrangler.toml [[r2_buckets]] (course-assets / course-assets-dev) ' +
      'and deployment bindings. Set COURSE_ASSETS_LOCAL_FALLBACK=1 only for local development.',
  );
}

/** Readiness probe used by health checks and upload routes. */
export async function checkCourseAssetsHealth(): Promise<
  { ok: true; persistent: boolean } | { ok: false; error: string }
> {
  try {
    await getCourseAssetsBucket();
    return { ok: true, persistent: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'R2 binding unavailable',
    };
  }
}

/**
 * Strict R2 key allow-list for the asset-serving endpoint.
 * Accepts the canonical `courses/resources/YYYY/MM/<file>` layout plus the
 * legacy `courses/resources/uploads/YYYY/MM/<file>` layout written by earlier
 * bulk builds. Rejects traversal, absolute paths, and unsafe characters.
 */
const COURSE_ASSET_KEY_RE =
  /^courses\/resources\/(uploads\/\d{4}\/\d{2}\/|\d{4}\/\d{2}\/)[A-Za-z0-9][A-Za-z0-9._-]*\.[A-Za-z0-9]{1,10}$/;

export function isAllowedCourseAssetKey(key: string): boolean {
  if (typeof key !== 'string' || key.length > 512) return false;
  if (key.includes('..') || key.includes('\\') || key.startsWith('/')) return false;
  return COURSE_ASSET_KEY_RE.test(key);
}
