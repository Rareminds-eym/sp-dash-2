import type { CourseManagementQueueMessage } from './course-upload-queue';

interface QueueLike<T> {
  send(message: T): Promise<void>;
}

interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface CourseUploadRuntime {
  COURSE_MANAGEMENT_UPLOAD_QUEUE?: QueueLike<CourseManagementQueueMessage>;
  COURSE_ASSETS?: {
    put(
      key: string,
      value: Uint8Array | ArrayBuffer | ReadableStream<Uint8Array>,
      options?: Record<string, unknown>,
    ): Promise<unknown>;
  };
  RATE_LIMIT_KV?: KVNamespaceLike;
  COURSE_UPLOAD_WORKER_TOKEN?: string;
}

export async function getCourseUploadRuntime(): Promise<CourseUploadRuntime> {
  const { getCloudflareContext } = await import('@opennextjs/cloudflare');
  const context = await getCloudflareContext({ async: true }) as unknown as {
    env?: CourseUploadRuntime;
  };
  if (!context.env) throw new Error('Cloudflare upload queue bindings are unavailable.');
  return context.env;
}

export async function isCourseUploadWorkerRequest(request: Request): Promise<boolean> {
  const requestToken = request.headers.get('x-course-upload-worker-token');
  if (!requestToken) return false;
  const runtime = await getCourseUploadRuntime();
  return Boolean(runtime.COURSE_UPLOAD_WORKER_TOKEN &&
    requestToken === runtime.COURSE_UPLOAD_WORKER_TOKEN);
}
