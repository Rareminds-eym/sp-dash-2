import { createClient } from '@supabase/supabase-js';
import {
  COURSE_UPLOAD_JOB_TTL_SECONDS,
  courseUploadJobKey,
  type BulkCourseJobMessage,
  type CourseManagementQueueMessage,
  type CourseUploadJob,
  type CourseUploadMessage,
} from '../lib/services/course-upload-queue';

interface R2ObjectLike {
  body: ReadableStream<Uint8Array> | null;
}

interface R2BucketLike {
  get(key: string): Promise<R2ObjectLike | null>;
  put(
    key: string,
    value: ReadableStream<Uint8Array>,
    options?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
  delete(key: string): Promise<void>;
}

interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface QueueMessageLike<T> {
  body: T;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
  attempts?: number;
}

interface InternalWorkerBinding {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  COURSE_ASSETS: R2BucketLike;
  RATE_LIMIT_KV: KVNamespaceLike;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  COURSE_UPLOAD_WORKER_TOKEN?: string;
  WORKER_SELF_REFERENCE?: InternalWorkerBinding;
}

interface QueueBatch<T> {
  messages: QueueMessageLike<T>[];
}

async function updateJob(
  kv: KVNamespaceLike,
  jobId: string,
  update: Partial<CourseUploadJob>,
): Promise<void> {
  const key = courseUploadJobKey(jobId);
  const currentRaw = await kv.get(key);
  if (!currentRaw) throw new Error(`Course upload job ${jobId} was not found.`);
  const current = JSON.parse(currentRaw) as CourseUploadJob;
  await kv.put(
    key,
    JSON.stringify({ ...current, ...update }),
    { expirationTtl: COURSE_UPLOAD_JOB_TTL_SECONDS },
  );
}

async function removeStagedFile(bucket: R2BucketLike, jobId: string, key: string): Promise<void> {
  await bucket.delete(key).catch((error) => {
    console.error('[Course Upload Queue] Failed to remove staged file', {
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

async function processFileUpload(
  body: CourseUploadMessage,
  env: Env,
  message: QueueMessageLike<CourseManagementQueueMessage>,
): Promise<void> {
  try {
    const currentRaw = await env.RATE_LIMIT_KV.get(courseUploadJobKey(body.jobId));
    if (!currentRaw) throw new Error(`Course upload job ${body.jobId} was not found.`);
    const current = JSON.parse(currentRaw) as CourseUploadJob;
    if (current.status === 'completed') {
      message.ack();
      return;
    }

    await updateJob(env.RATE_LIMIT_KV, body.jobId, { status: 'processing', error: undefined });
    const stagedObject = await env.COURSE_ASSETS.get(body.stagingKey);
    if (!stagedObject?.body) throw new Error('Staged upload file is unavailable.');

    let resultUrl = `/api/courses/assets?key=${encodeURIComponent(body.r2Key)}`;
    let resultKey = body.r2Key;
    if (body.uploadTarget === 'course-image') {
      if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Course image queue requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }
      const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });
      const imageBytes = new Uint8Array(await new Response(stagedObject.body).arrayBuffer());
      const imagePath = `courses/${body.jobId}-${body.fileName}`;
      const { error: storageError } = await supabase.storage
        .from('course-images')
        .upload(imagePath, imageBytes, {
          cacheControl: '3600',
          contentType: body.mimeType,
          upsert: true,
        });
      if (storageError) throw new Error(`Course image storage failed: ${storageError.message}`);
      resultUrl = supabase.storage.from('course-images').getPublicUrl(imagePath).data.publicUrl;
      resultKey = imagePath;
    } else {
      await env.COURSE_ASSETS.put(body.r2Key, stagedObject.body, {
        httpMetadata: { contentType: body.mimeType },
        customMetadata: {
          originalFileName: body.fileName,
          uploadedBy: body.uploaderId,
          uploadedAt: new Date().toISOString(),
          resourceType: body.resourceType,
          resourceName: body.resourceName,
          contentHash: body.contentHash,
        },
      });
    }
    await updateJob(env.RATE_LIMIT_KV, body.jobId, {
      status: 'completed',
      r2Key: resultKey,
      r2Url: resultUrl,
      url: resultUrl,
      fileSize: body.fileSize,
      fileSizeBytes: body.fileSizeBytes,
      mimeType: body.mimeType,
      contentHash: body.contentHash,
    });
    await removeStagedFile(env.COURSE_ASSETS, body.jobId, body.stagingKey);
    message.ack();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const attempts = Number(message.attempts || 1);
    console.error('[Course Upload Queue] File upload failed', {
      jobId: body.jobId,
      attempts,
      error: errorMessage,
    });

    if (attempts < 3) {
      message.retry({ delaySeconds: 30 });
      return;
    }

    await updateJob(env.RATE_LIMIT_KV, body.jobId, {
      status: 'failed',
      error: errorMessage,
    });
    await removeStagedFile(env.COURSE_ASSETS, body.jobId, body.stagingKey);
    message.ack();
  }
}

async function processBulkCourseJob(
  body: BulkCourseJobMessage,
  env: Env,
  message: QueueMessageLike<CourseManagementQueueMessage>,
): Promise<void> {
  const currentRaw = await env.RATE_LIMIT_KV.get(courseUploadJobKey(body.jobId));
  if (!currentRaw) {
    message.ack();
    return;
  }
  const current = JSON.parse(currentRaw) as CourseUploadJob;
  if (current.status === 'completed' || current.status === 'failed') {
    message.ack();
    return;
  }
  if (current.status === 'processing') {
    await updateJob(env.RATE_LIMIT_KV, body.jobId, {
      status: 'failed',
      error: 'Processing was interrupted. Verify imported courses before starting a new import.',
    });
    await removeStagedFile(env.COURSE_ASSETS, body.jobId, body.stagingKey);
    message.ack();
    return;
  }

  try {
    if (!env.COURSE_UPLOAD_WORKER_TOKEN || !env.WORKER_SELF_REFERENCE) {
      throw new Error('Course import queue requires COURSE_UPLOAD_WORKER_TOKEN and WORKER_SELF_REFERENCE.');
    }
    await updateJob(env.RATE_LIMIT_KV, body.jobId, { status: 'processing' });
    const stagedObject = await env.COURSE_ASSETS.get(body.stagingKey);
    if (!stagedObject?.body) throw new Error('Staged course import payload is unavailable.');

    const routeByKind: Record<BulkCourseJobMessage['kind'], string> = {
      'bulk-course-preview': '/api/courses/bulk-upload/preview',
      'bulk-course-process': '/api/courses/bulk-upload/process',
      'bulk-resource-preview': '/api/courses/bulk-resources/preview',
      'bulk-resource-process': '/api/courses/bulk-resources/process',
    };
    const url = `https://sp-dash-2${routeByKind[body.kind]}`;
    let requestBody: BodyInit;
    const headers = new Headers({
      'x-course-upload-worker-token': env.COURSE_UPLOAD_WORKER_TOKEN,
      'x-course-upload-uploader-id': body.uploaderId,
    });
    if (body.kind.endsWith('preview')) {
      const bytes = new Uint8Array(await new Response(stagedObject.body).arrayBuffer());
      const formData = new FormData();
      formData.set(
        'template',
        new File([bytes], body.fileName || 'course-upload.xlsx', {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      );
      formData.set('fileNames', JSON.stringify(body.fileNames || []));
      requestBody = formData;
    } else {
      headers.set('content-type', 'application/json');
      requestBody = await new Response(stagedObject.body).text();
    }

    const response = await env.WORKER_SELF_REFERENCE.fetch(new Request(url, {
      method: 'POST',
      headers,
      body: requestBody,
    }));
    const result = await response.json() as Record<string, unknown>;
    if (!response.ok || result.success !== true) {
      const errorMessage = String(result.error || result.details || `Course import failed (Status ${response.status})`);
      await updateJob(env.RATE_LIMIT_KV, body.jobId, {
        status: 'failed',
        error: errorMessage,
        result,
      });
    } else {
      await updateJob(env.RATE_LIMIT_KV, body.jobId, {
        status: 'completed',
        result,
      });
    }
    await removeStagedFile(env.COURSE_ASSETS, body.jobId, body.stagingKey);
    message.ack();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Course Upload Queue] Bulk course job failed', {
      jobId: body.jobId,
      error: errorMessage,
    });
    await updateJob(env.RATE_LIMIT_KV, body.jobId, {
      status: 'failed',
      error: errorMessage,
    });
    await removeStagedFile(env.COURSE_ASSETS, body.jobId, body.stagingKey);
    message.ack();
  }
}

export default {
  async queue(batch: QueueBatch<CourseManagementQueueMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      if (message.body.kind === 'file-upload') {
        await processFileUpload(message.body, env, message);
      } else {
        await processBulkCourseJob(message.body, env, message);
      }
    }
  },
};
