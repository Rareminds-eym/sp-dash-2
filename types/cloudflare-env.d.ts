/**
 * Cloudflare Environment Bindings for sp-dash-2
 * 
 * This file defines TypeScript types for Cloudflare service bindings
 * used in the dashboard application.
 */

import type { SSOEntrypoint } from "../../workers/sso-worker/src/entrypoint";

declare global {
  interface CloudflareEnv {
    SSO: Service<SSOEntrypoint>;
  }
}

export {};
