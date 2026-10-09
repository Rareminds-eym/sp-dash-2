/**
 * Shared bounded store for bulk preview sessions.
 *
 * Production-safety contract (P0):
 * - Bounded entries (LRU eviction) + TTL expiry with opportunistic sweep, so
 *   expired entries can never accumulate indefinitely.
 * - Row-capped payloads: preview routes enforce BULK_PREVIEW_MAX_ROWS before
 *   calling save(); oversized workbooks are rejected up front.
 * - Best-effort cache only (single isolate). Process endpoints treat a
 *   missing/expired preview as a warning and REVALIDATE the resubmitted
 *   payload — preview results are never trusted.
 */

import { BULK_PREVIEW_MAX_ENTRIES } from '@/lib/services/course-resource-validation';

export interface ParsedBulkResource {
  rowNumber: number;
  course_id: string;
  course_code: string;
  course_name: string;
  module_id: string;
  module_title: string;
  lesson_id: string;
  lesson_title: string;
  resource_name: string;
  resource_type: string;
  resource_url: string;
  file_path: string;
  file_size: string;
  thumbnail_url: string;
  embed_url: string;
  order_index: number;
  notes: string;
}

interface PreviewEntry {
  createdAt: number;
  resources: ParsedBulkResource[];
  fileNames: string[];
}

export const BULK_PREVIEW_TTL_MS = 30 * 60 * 1000; // 30 minutes

const previewStore = new Map<string, PreviewEntry>();

function sweepExpired(now = Date.now()): void {
  for (const [id, entry] of previewStore) {
    if (now - entry.createdAt > BULK_PREVIEW_TTL_MS) {
      previewStore.delete(id);
    }
  }
  // LRU eviction: Map preserves insertion order — drop oldest first.
  while (previewStore.size > BULK_PREVIEW_MAX_ENTRIES) {
    const oldest = previewStore.keys().next();
    if (oldest.done) break;
    previewStore.delete(oldest.value);
  }
}

export function saveBulkPreview(resources: ParsedBulkResource[], fileNames: string[]): string {
  sweepExpired();
  // Refresh recency for LRU behavior on access-ordered re-save.
  const previewId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  previewStore.set(previewId, { createdAt: Date.now(), resources, fileNames });
  sweepExpired();
  return previewId;
}

export function getBulkPreview(previewId: string): PreviewEntry | null {
  const entry = previewStore.get(previewId);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > BULK_PREVIEW_TTL_MS) {
    previewStore.delete(previewId);
    return null;
  }
  // LRU touch: re-insert to mark as recently used.
  previewStore.delete(previewId);
  previewStore.set(previewId, entry);
  return entry;
}

export function deleteBulkPreview(previewId: string): void {
  previewStore.delete(previewId);
}

/** Introspection for health checks / tests (count only, no payload). */
export function bulkPreviewStats(): { size: number; maxEntries: number; ttlMs: number } {
  return { size: previewStore.size, maxEntries: BULK_PREVIEW_MAX_ENTRIES, ttlMs: BULK_PREVIEW_TTL_MS };
}
