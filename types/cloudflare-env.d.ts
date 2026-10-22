/**
 * Cloudflare Environment Bindings for sp-dash-2
 * 
 * This file defines TypeScript types for Cloudflare service bindings
 * used in the dashboard application.
 */

import type { SsoWorker as SSOEntrypoint } from "../../workers/sso-worker/src/index";
import type { CourseManagementQueueMessage } from "../lib/services/course-upload-queue";

declare global {
  interface CloudflareEnv {
    SSO: Service<SSOEntrypoint>;
    WORKER_SELF_REFERENCE: Service<SSOEntrypoint>;
    MAINTENANCE_EVENTS_QUEUE: Queue;
    COURSE_MANAGEMENT_UPLOAD_QUEUE: Queue<CourseManagementQueueMessage>;
    LTE_API_BASE_URL: string;
    LTE_CATALOG_SYNC_SECRET: string;
    SKILLPASSPORT_ASSETS: R2Bucket;
    RATE_LIMIT_KV: KVNamespace;
    COURSE_UPLOAD_WORKER_TOKEN: string;
  }
}

export {};
