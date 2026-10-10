import { randomUUID } from 'crypto';
import { getCourseAssetsBucket, CourseAssetsBindingError } from '@/lib/services/course-assets-r2';
import {
  COURSE_UPLOAD_JOB_TTL_SECONDS,
  courseUploadJobKey,
  type BulkCourseJobKind,
  type BulkCourseJobMessage,
  type CourseUploadJob,
} from '@/lib/services/course-upload-queue';
import {
  getCourseUploadRuntime,
  type CourseUploadRuntime,
} from '@/lib/services/course-upload-runtime';

export class CourseManagementQueueUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CourseManagementQueueUnavailableError';
  }
}

interface QueueJobInput {
  kind: BulkCourseJobKind;
  ownerId: string;
  fileName: string;
  fileNames?: string[];
  template?: File;
  payload?: unknown;
}

export async function queueBulkCourseManagementJob({
  kind,
  ownerId,
  fileName,
  fileNames = [],
  template,
  payload,
}: QueueJobInput): Promise<string> {
  let runtime: CourseUploadRuntime;
  try {
    runtime = await getCourseUploadRuntime();
  } catch {
    throw new CourseManagementQueueUnavailableError('Course upload queue is not configured. Contact support.');
  }
  if (!runtime.COURSE_MANAGEMENT_UPLOAD_QUEUE || !runtime.RATE_LIMIT_KV ||
      !runtime.COURSE_UPLOAD_WORKER_TOKEN) {
    throw new CourseManagementQueueUnavailableError('Course import queue is not fully configured. Contact support.');
  }

  const bucket = await getCourseAssetsBucket().catch((error) => {
    if (error instanceof CourseAssetsBindingError) return null;
    throw error;
  });
  if (!bucket) {
    throw new CourseManagementQueueUnavailableError('Course import storage is not configured. Contact support.');
  }

  const isPreview = kind.endsWith('preview');
  if (isPreview && !template) throw new Error('Course import workbook is required.');
  if (!isPreview && payload === undefined) throw new Error('Course import payload is required.');

  const jobId = randomUUID();
  const stagingKey = `_queued/course-jobs/${jobId}/${isPreview ? 'template.xlsx' : 'payload.json'}`;
  const job: CourseUploadJob = {
    jobId,
    ownerId,
    status: 'queued',
    jobKind: kind,
    fileName,
    resourceType: 'course-import',
    createdAt: new Date().toISOString(),
  };
  const message: BulkCourseJobMessage = {
    kind,
    jobId,
    stagingKey,
    uploaderId: ownerId,
    fileName: isPreview ? fileName : undefined,
    fileNames: isPreview ? fileNames : undefined,
  };

  try {
    const stagedData = isPreview
      ? new Uint8Array(await template!.arrayBuffer())
      : new TextEncoder().encode(JSON.stringify(payload));
    await bucket.put(stagingKey, stagedData, {
      httpMetadata: {
        contentType: isPreview
          ? template!.type || 'application/octet-stream'
          : 'application/json',
      },
    });
    await runtime.RATE_LIMIT_KV.put(courseUploadJobKey(jobId), JSON.stringify(job), {
      expirationTtl: COURSE_UPLOAD_JOB_TTL_SECONDS,
    });
    await runtime.COURSE_MANAGEMENT_UPLOAD_QUEUE.send(message);
  } catch (error) {
    await bucket.delete(stagingKey).catch((cleanupError) => {
      console.error('Failed to clean up staged course-management queue payload', {
        jobId,
        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      });
    });
    await runtime.RATE_LIMIT_KV.delete(courseUploadJobKey(jobId)).catch((cleanupError) => {
      console.error('Failed to clean up course-management queue job state', {
        jobId,
        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      });
    });
    throw error;
  }

  return jobId;
}
