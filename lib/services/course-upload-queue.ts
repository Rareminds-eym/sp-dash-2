export interface CourseUploadMessage {
  kind: 'file-upload';
  jobId: string;
  stagingKey: string;
  r2Key: string;
  fileName: string;
  resourceName: string;
  fileSize: string;
  fileSizeBytes: number;
  mimeType: string;
  contentHash: string;
  resourceType: string;
  uploadTarget: 'resource' | 'course-image';
  uploaderId: string;
}

export type BulkCourseJobKind =
  | 'bulk-course-preview'
  | 'bulk-course-process'
  | 'bulk-resource-preview'
  | 'bulk-resource-process';

export interface BulkCourseJobMessage {
  kind: BulkCourseJobKind;
  jobId: string;
  stagingKey: string;
  uploaderId: string;
  fileName?: string;
  fileNames?: string[];
}

export type CourseManagementQueueMessage = CourseUploadMessage | BulkCourseJobMessage;

export interface CourseUploadJob {
  jobId: string;
  ownerId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  jobKind?: 'file-upload' | BulkCourseJobKind;
  fileName: string;
  resourceType: string;
  createdAt: string;
  r2Key?: string;
  r2Url?: string;
  fileSize?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  contentHash?: string;
  url?: string;
  uploadTarget?: 'resource' | 'course-image';
  result?: unknown;
  error?: string;
}

export const COURSE_UPLOAD_JOB_TTL_SECONDS = 60 * 60 * 24;

export function courseUploadJobKey(jobId: string): string {
  return `course-upload-job:${jobId}`;
}
