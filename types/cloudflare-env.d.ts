/**
 * Cloudflare Environment Bindings for sp-dash-2
 * 
 * This file defines TypeScript types for Cloudflare service bindings
 * used in the dashboard application.
 */

import type { SsoWorker as SSOEntrypoint } from "../../workers/sso-worker/src/index";

declare global {
  interface CloudflareEnv {
    SSO: Service<SSOEntrypoint>;
    MAINTENANCE_EVENTS_QUEUE: Queue;
    RATE_LIMIT_KV: KVNamespace;
  }
}

export {};
