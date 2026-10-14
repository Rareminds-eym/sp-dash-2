/**
 * Canonical course-resource validation (single source of truth).
 *
 * Used by: resource-upload, bulk preview/process/export, course create/update,
 * and frontend builders. Do NOT hardcode competing type/extension/size lists
 * elsewhere — import from here.
 *
 * Runtime-safe: pure functions only, no Node.js APIs, works in Cloudflare
 * Workers (nodejs_compat) and Node.js alike.
 */

export type CourseResourceType =
  | 'pdf'
  | 'video'
  | 'youtube'
  | 'document'
  | 'image'
  | 'link'
  | 'drive';

/** Legacy values that may exist in stored rows. Normalized on read, rejected on write. */
const LEGACY_TYPE_ALIASES: Record<string, CourseResourceType> = {
  ppt: 'document',
  file: 'document',
  url: 'link',
};

export interface ResourceTypeConfig {
  type: CourseResourceType;
  label: string;
  /** Uploaded binary (goes through R2) vs external URL only. */
  kind: 'upload' | 'url';
  extensions: string[];
  mimeTypes: Record<string, string>;
  maxSizeBytes: number;
}

export const COURSE_RESOURCE_TYPES: ResourceTypeConfig[] = [
  {
    type: 'pdf',
    label: 'PDF',
    kind: 'upload',
    extensions: ['.pdf'],
    mimeTypes: { '.pdf': 'application/pdf' },
    maxSizeBytes: 50 * 1024 * 1024,
  },
  {
    type: 'video',
    label: 'Video',
    kind: 'upload',
    extensions: ['.mp4', '.avi', '.mov', '.wmv', '.webm'],
    mimeTypes: {
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.wmv': 'video/x-ms-wmv',
      '.webm': 'video/webm',
    },
    maxSizeBytes: 200 * 1024 * 1024,
  },
  {
    type: 'document',
    label: 'Document',
    kind: 'upload',
    extensions: ['.doc', '.docx', '.ppt', '.pptx', '.txt', '.rtf'],
    mimeTypes: {
      '.doc': 'application/msword',
      '.docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx':
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain',
      '.rtf': 'application/rtf',
    },
    maxSizeBytes: 50 * 1024 * 1024,
  },
  {
    type: 'image',
    label: 'Image',
    kind: 'upload',
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
    mimeTypes: {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    },
    maxSizeBytes: 10 * 1024 * 1024,
  },
  { type: 'youtube', label: 'YouTube', kind: 'url', extensions: [], mimeTypes: {}, maxSizeBytes: 0 },
  { type: 'link', label: 'Link', kind: 'url', extensions: [], mimeTypes: {}, maxSizeBytes: 0 },
  { type: 'drive', label: 'Google Drive', kind: 'url', extensions: [], mimeTypes: {}, maxSizeBytes: 0 },
];

export const CANONICAL_RESOURCE_TYPE_IDS: CourseResourceType[] =
  COURSE_RESOURCE_TYPES.map((t) => t.type);

const CONFIG_BY_TYPE = new Map<CourseResourceType, ResourceTypeConfig>(
  COURSE_RESOURCE_TYPES.map((t) => [t.type, t]),
);

/** Bulk processing safety bounds (Cloudflare Worker memory / request limits). */
export const BULK_MAX_RESOURCES_PER_BATCH = 100;
export const BULK_MAX_FILES_PER_REQUEST = 25;
export const BULK_MAX_EXPORT_COURSES = 600;
/** Bulk course-upload bounds: max logical courses accepted per process call. */
export const BULK_MAX_COURSES_PER_BATCH = 50;
/** Max data rows parsed from an uploaded workbook (header excluded). */
export const BULK_PREVIEW_MAX_ROWS = 2000;
/** Max template upload accepted for preview parsing (10 MB). */
export const BULK_PREVIEW_MAX_BYTES = 10 * 1024 * 1024;
/** Max preview sessions retained per isolate (LRU eviction). */
export const BULK_PREVIEW_MAX_ENTRIES = 100;
/** Supabase/PostgREST `.in()` lists must stay small to avoid URL-length limits. */
export const SUPABASE_IN_CHUNK_SIZE = 100;
/** fetchAll selection cap — the UI must narrow filters beyond this. */
export const FETCH_ALL_MAX_IDS = 5000;

export function getResourceTypeConfig(
  type: string,
): ResourceTypeConfig | undefined {
  return CONFIG_BY_TYPE.get(normalizeStoredResourceType(type) as CourseResourceType);
}

export function isCanonicalResourceType(type: string): boolean {
  return CONFIG_BY_TYPE.has(type as CourseResourceType);
}

/** Map legacy stored values (ppt/file/url) to canonical types for display. */
export function normalizeStoredResourceType(type: unknown): string {
  const t = String(type || '').toLowerCase().trim();
  if (CONFIG_BY_TYPE.has(t as CourseResourceType)) return t;
  return LEGACY_TYPE_ALIASES[t] || t;
}

export function isUrlResourceType(type: string): boolean {
  return getResourceTypeConfig(type)?.kind === 'url';
}

export function isUploadResourceType(type: string): boolean {
  return getResourceTypeConfig(type)?.kind === 'upload';
}

export function getAcceptedFileTypes(type: string): string {
  return getResourceTypeConfig(type)?.extensions.join(',') || '';
}

export function extensionOf(fileName: string): string {
  const match = fileName.toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match ? match[1] : '';
}

export function validateResourceType(type: unknown): string | null {
  const t = String(type || '').toLowerCase().trim();
  if (!t) return 'resource_type is required';
  if (!isCanonicalResourceType(t)) {
    return `resource_type must be one of: ${CANONICAL_RESOURCE_TYPE_IDS.join(', ')}`;
  }
  return null;
}

export function validateExtensionForType(
  fileName: string,
  type: string,
): string | null {
  const config = getResourceTypeConfig(type);
  if (!config) return validateResourceType(type);
  if (config.kind === 'url') {
    return `Resource type '${config.type}' is URL-based and does not accept file uploads`;
  }
  const ext = extensionOf(fileName);
  if (!config.extensions.includes(ext)) {
    return `Invalid file extension '${ext || '(none)'}' for type '${config.type}'. Allowed: ${config.extensions.join(', ')}`;
  }
  return null;
}

export function validateFileSize(sizeBytes: number, type: string): string | null {
  const config = getResourceTypeConfig(type);
  if (!config) return validateResourceType(type);
  if (config.kind === 'url') {
    return `Resource type '${config.type}' is URL-based and does not accept file uploads`;
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) return 'Invalid file size';
  if (sizeBytes > config.maxSizeBytes) {
    return `File size exceeds maximum allowed limit of ${formatFileSize(config.maxSizeBytes)} for type '${config.type}'`;
  }
  return null;
}

export function mimeTypeFor(fileName: string, fallback: string): string {
  const ext = extensionOf(fileName);
  for (const config of COURSE_RESOURCE_TYPES) {
    if (config.mimeTypes[ext]) return config.mimeTypes[ext];
  }
  return fallback || 'application/octet-stream';
}

/**
 * Best-effort magic-number check (first bytes) for common formats.
 * Returns an error string when bytes positively mismatch the extension,
 * null when consistent or unknown (office/video containers are not sniffed —
 * extension + MIME + size enforcement applies there).
 */
export function validateFileSignature(
  bytes: Uint8Array,
  fileName: string,
): string | null {
  const ext = extensionOf(fileName);
  if (bytes.length < 4) return 'File is empty or too small';
  const head = bytes.subarray(0, 12);
  const ascii = (n: number) =>
    Array.from(head.subarray(0, n))
      .map((b) => String.fromCharCode(b))
      .join('');
  switch (ext) {
    case '.pdf':
      return ascii(5) === '%PDF-' ? null : 'File content does not match PDF signature';
    case '.png':
      return head[0] === 0x89 && ascii(4).slice(1) === 'PNG'
        ? null
        : 'File content does not match PNG signature';
    case '.jpg':
    case '.jpeg':
      return head[0] === 0xff && head[1] === 0xd8
        ? null
        : 'File content does not match JPEG signature';
    case '.gif':
      return ascii(6) === 'GIF87a' || ascii(6) === 'GIF89a'
        ? null
        : 'File content does not match GIF signature';
    case '.webp':
      return ascii(4) === 'RIFF' && ascii(12).slice(8) === 'WEBP'
        ? null
        : 'File content does not match WEBP signature';
    default:
      return null;
  }
}

const YOUTUBE_URL_RE =
  /^https:\/\/(www\.|m\.|music\.)?(youtube\.com\/(watch\?[^#\s]*v=|embed\/|shorts\/|live\/)|youtu\.be\/)[\w-]+/i;
const DRIVE_URL_RE =
  /^https:\/\/(drive\.google\.com\/(file\/d\/|drive\/|open\?|uc\?)|docs\.google\.com\/)/i;

const UNSAFE_URL_SCHEME_RE = /^(javascript|data|file|vbscript|blob):/i;

/**
 * Canonical resource URL validator (single source of truth).
 *
 * Upload kinds (`pdf`/`video`/`document`/`image`):
 * - Empty URL is permitted ONLY as a pre-upload placeholder (bulk rows that
 *   carry `file_path` instead, or modal state before a file is chosen).
 *   Final persistence still requires either an uploaded asset path or https.
 * - When present, only `https://` external URLs or app-controlled
 *   `/api/courses/assets?key=...` paths are accepted.
 * - `javascript:`, `data:`, `file:`, `vbscript:`, `blob:` and other
 *   non-http(s) schemes are always rejected — never trust a client-supplied
 *   "safe" declaration.
 */
export function validateResourceUrl(url: unknown, type: string): string | null {
  const value = String(url || '').trim();
  const config = getResourceTypeConfig(type);
  if (!config) return validateResourceType(type);
  if (!value) {
    // Empty allowed for upload kinds (pre-upload placeholder); persistence
    // layers must still require url-or-file. URL kinds always need a URL.
    if (config.kind === 'upload') return null;
    return 'resource_url is required for URL-based resource types';
  }
  if (UNSAFE_URL_SCHEME_RE.test(value)) {
    return 'resource_url uses an unsupported scheme';
  }
  // App-controlled R2 asset path (system-generated on upload).
  if (value.startsWith('/api/courses/assets?')) {
    return null;
  }
  // Relative asset paths are only valid when they target the asset endpoint.
  if (value.startsWith('/')) {
    return 'resource_url must be https:// or a valid asset path';
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return 'resource_url must be a valid URL';
  }
  if (parsed.protocol !== 'https:') {
    return 'resource_url must use https://';
  }
  if (config.type === 'youtube' && !YOUTUBE_URL_RE.test(value)) {
    return 'resource_url must be a valid YouTube URL (youtube.com or youtu.be)';
  }
  if (config.type === 'drive' && !DRIVE_URL_RE.test(value)) {
    return 'resource_url must be a valid Google Drive URL';
  }
  return null;
}

/** Validate thumbnail/embed URLs when provided (https only, any host). */
export function validateOptionalUrl(url: unknown, field: string): string | null {
  const value = String(url || '').trim();
  if (!value) return null;
  if (UNSAFE_URL_SCHEME_RE.test(value)) {
    return `${field} uses an unsupported scheme`;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return `${field} must use http(s)://`;
    }
  } catch {
    return `${field} must be a valid URL`;
  }
  return null;
}

export function sanitizeFileName(name: string): string {
  const base = name.split('/').pop()?.split('\\').pop() || 'file';
  return (
    base.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, 100) ||
    'file'
  );
}

/** Quote-safe filename for Content-Disposition (strips quotes/backslashes). */
export function sanitizeContentDispositionFilename(name: string): string {
  return sanitizeFileName(name).replace(/["\\]/g, '-').slice(0, 80) || 'download';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Escape a user search term for use inside a PostgREST `.or()` filter.
 * Commas/parentheses are filter syntax, % _ \ are LIKE wildcards.
 * Returns a safely quoted `ilike."%...%"` pattern fragment.
 */
export function buildPostgrestLikePattern(searchTerm: string): string {
  const escaped = searchTerm
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/"/g, '');
  return `"%${escaped}%"`;
}

export function buildCourseSearchOrFilter(searchTerm: string): string {
  const pattern = buildPostgrestLikePattern(searchTerm);
  return `title.ilike.${pattern},code.ilike.${pattern},description.ilike.${pattern}`;
}

export interface HierarchyResourceInput {
  name?: unknown;
  type?: unknown;
  url?: unknown;
  size?: unknown;
  fileSize?: unknown;
  file_size?: unknown;
  thumbnailUrl?: unknown;
  thumbnail_url?: unknown;
  embedUrl?: unknown;
  embed_url?: unknown;
}

export interface HierarchyLessonInput {
  title?: unknown;
  lessons?: unknown;
  resources?: unknown;
  [key: string]: unknown;
}

export interface HierarchyModuleInput {
  title?: unknown;
  lessons?: unknown;
  [key: string]: unknown;
}

/**
 * Canonical modules → lessons → resources payload contract.
 * Shared by course POST, PUT/PATCH, bulk course creation and bulk resource
 * processing (via per-resource checks). Explicit empty arrays are valid
 * (clear-all); callers decide whether an omitted key means "skip sync".
 */
export function validateHierarchyPayload(modules: unknown): string | null {
  if (!Array.isArray(modules)) return 'modules must be an array';
  if (modules.length > 200) return 'Maximum 200 modules per course';
  for (let mi = 0; mi < modules.length; mi += 1) {
    const mod = (modules[mi] || {}) as HierarchyModuleInput;
    if (!String(mod.title || '').trim()) return `modules[${mi}].title is required`;
    const lessons = (mod.lessons || []) as HierarchyLessonInput[];
    if (!Array.isArray(lessons)) return `modules[${mi}].lessons must be an array`;
    if (lessons.length > 500) return `modules[${mi}] exceeds 500 lessons`;
    for (let li = 0; li < lessons.length; li += 1) {
      const lesson = (lessons[li] || {}) as HierarchyLessonInput & { resources?: HierarchyResourceInput[] };
      if (!String(lesson.title || '').trim()) {
        return `modules[${mi}].lessons[${li}].title is required`;
      }
      const resources = lesson.resources || [];
      if (!Array.isArray(resources)) {
        return `modules[${mi}].lessons[${li}].resources must be an array`;
      }
      if (resources.length > 100) {
        return `modules[${mi}].lessons[${li}] exceeds 100 resources`;
      }
      for (let ri = 0; ri < resources.length; ri += 1) {
        const res = (resources[ri] || {}) as HierarchyResourceInput;
        const path = `modules[${mi}].lessons[${li}].resources[${ri}]`;
        if (!String(res.name || '').trim()) return `${path}.name is required`;
        const typeError = validateResourceType(res.type);
        if (typeError) return `${path}: ${typeError}`;
        const url = String(res.url || '').trim();
        if (!url) return `${path}: resource URL is required`;
        const urlError = validateResourceUrl(url, String(res.type));
        if (urlError) return `${path}: ${urlError}`;
        if (url.startsWith('/api/courses/assets?')) {
          const sizeError =
            res.size || res.fileSize || res.file_size
              ? null
              : `${path}: uploaded resources must include file size`;
          if (sizeError) return sizeError;
        } else if (!/^https:\/\//i.test(url)) {
          return `${path}: resource URL must be https:// or a valid asset path`;
        }
        const thumbError = validateOptionalUrl(
          res.thumbnailUrl ?? res.thumbnail_url ?? '',
          `${path}.thumbnailUrl`,
        );
        if (thumbError) return thumbError;
        const embedError = validateOptionalUrl(
          res.embedUrl ?? res.embed_url ?? '',
          `${path}.embedUrl`,
        );
        if (embedError) return embedError;
      }
    }
  }
  return null;
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export function parsePositiveInt(raw: unknown, fallback: number): number {
  const n = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** Standard R2 key: courses/resources/YYYY/MM/<stem>-<hash16><ext> */
export function buildCourseAssetKey(
  stem: string,
  contentHash: string,
  ext: string,
  now = new Date(),
): string {
  const safeStem = sanitizeFileName(stem).replace(/\.[^.]*$/, '') || 'file';
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `courses/resources/${year}/${month}/${safeStem.slice(0, 60)}-${contentHash.slice(0, 16)}${ext}`;
}
