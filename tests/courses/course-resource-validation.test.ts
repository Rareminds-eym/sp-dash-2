import { describe, expect, it } from 'vitest';
import {
  buildCourseAssetKey,
  buildCourseSearchOrFilter,
  buildPostgrestLikePattern,
  BULK_MAX_FILES_PER_REQUEST,
  BULK_MAX_RESOURCES_PER_BATCH,
  CANONICAL_RESOURCE_TYPE_IDS,
  chunkArray,
  extensionOf,
  FETCH_ALL_MAX_IDS,
  formatFileSize,
  getAcceptedFileTypes,
  getResourceTypeConfig,
  isCanonicalResourceType,
  isUploadResourceType,
  isUrlResourceType,
  mimeTypeFor,
  normalizeStoredResourceType,
  parsePositiveInt,
  sanitizeContentDispositionFilename,
  sanitizeFileName,
  SUPABASE_IN_CHUNK_SIZE,
  validateExtensionForType,
  validateFileSignature,
  validateFileSize,
  validateOptionalUrl,
  validateResourceType,
  validateResourceUrl,
} from '@/lib/services/course-resource-validation';
import { isAllowedCourseAssetKey } from '@/lib/services/course-assets-r2';

describe('canonical resource types', () => {
  it('covers pdf, video, youtube, document, image, link, drive exactly once', () => {
    expect([...CANONICAL_RESOURCE_TYPE_IDS].sort()).toEqual(
      ['document', 'drive', 'image', 'link', 'pdf', 'video', 'youtube'].sort(),
    );
  });

  it('distinguishes upload vs URL types', () => {
    for (const t of ['pdf', 'video', 'document', 'image']) {
      expect(isUploadResourceType(t)).toBe(true);
      expect(isUrlResourceType(t)).toBe(false);
    }
    for (const t of ['youtube', 'link', 'drive']) {
      expect(isUrlResourceType(t)).toBe(true);
      expect(isUploadResourceType(t)).toBe(false);
    }
  });

  it('rejects unknown types with a helpful message', () => {
    const err = validateResourceType('ppt');
    expect(err).toMatch(/must be one of/);
    expect(err).toContain('drive');
    expect(validateResourceType('')).toMatch(/required/);
    expect(validateResourceType('PDF')).toBeNull(); // case-insensitive
  });

  it('normalizes legacy stored values for display', () => {
    expect(normalizeStoredResourceType('ppt')).toBe('document');
    expect(normalizeStoredResourceType('file')).toBe('document');
    expect(normalizeStoredResourceType('PDF')).toBe('pdf');
    expect(isCanonicalResourceType('ppt')).toBe(false);
  });

  it('exposes accept strings per type', () => {
    expect(getAcceptedFileTypes('pdf')).toBe('.pdf');
    expect(getAcceptedFileTypes('youtube')).toBe('');
  });
});

describe('file validation parity (single upload == bulk process)', () => {
  it('rejects unsupported extensions per type', () => {
    expect(validateExtensionForType('slides.exe', 'pdf')).toMatch(/Invalid file extension/);
    expect(validateExtensionForType('talk.mp4', 'video')).toBeNull();
    expect(validateExtensionForType('notes.txt', 'document')).toBeNull();
    expect(validateExtensionForType('photo.JPG', 'image')).toBeNull();
    expect(validateExtensionForType('noext', 'pdf')).toMatch(/\(none\)/);
  });

  it('rejects file uploads for URL-only types', () => {
    for (const t of ['youtube', 'link', 'drive']) {
      expect(validateExtensionForType('x.mp4', t)).toMatch(/URL-based/);
      expect(validateFileSize(10, t)).toMatch(/URL-based/);
    }
  });

  it('enforces per-type size caps', () => {
    const pdfMax = getResourceTypeConfig('pdf')!.maxSizeBytes;
    expect(validateFileSize(pdfMax, 'pdf')).toBeNull();
    expect(validateFileSize(pdfMax + 1, 'pdf')).toMatch(/exceeds maximum/);
    const imgMax = getResourceTypeConfig('image')!.maxSizeBytes;
    expect(validateFileSize(imgMax + 1, 'image')).toMatch(/10\.0 MB/);
    expect(validateFileSize(-1, 'pdf')).toMatch(/Invalid file size/);
  });

  it('sniffs magic numbers for image/pdf payloads', () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    expect(validateFileSignature(pdf, 'a.pdf')).toBeNull();
    const notPdf = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]); // MZ
    expect(validateFileSignature(notPdf, 'evil.pdf')).toMatch(/PDF signature/);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(validateFileSignature(png, 'a.png')).toBeNull();
    expect(validateFileSignature(png, 'a.jpg')).toMatch(/JPEG signature/);
    expect(validateFileSignature(new Uint8Array([1]), 'a.pdf')).toMatch(/too small/);
    // Containers we do not sniff pass through (extension+MIME+size enforced)
    expect(validateFileSignature(new Uint8Array([1, 2, 3, 4]), 'a.mp4')).toBeNull();
  });

  it('resolves MIME types from the canonical map', () => {
    expect(mimeTypeFor('a.pdf', 'x')).toBe('application/pdf');
    expect(mimeTypeFor('a.svg', 'x')).toBe('image/svg+xml');
    expect(mimeTypeFor('a.unknown', 'fallback/x')).toBe('fallback/x');
  });
});

describe('resource URL validation', () => {
  it('requires https youtube URLs in valid shape', () => {
    expect(validateResourceUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube')).toBeNull();
    expect(validateResourceUrl('https://youtu.be/dQw4w9WgXcQ', 'youtube')).toBeNull();
    expect(validateResourceUrl('http://youtube.com/watch?v=x', 'youtube')).toMatch(/https/);
    expect(validateResourceUrl('https://vimeo.com/123', 'youtube')).toMatch(/YouTube/);
    expect(validateResourceUrl('', 'youtube')).toMatch(/required/);
  });

  it('validates drive URLs and generic links', () => {
    expect(
      validateResourceUrl('https://drive.google.com/file/d/abc123/view', 'drive'),
    ).toBeNull();
    expect(validateResourceUrl('https://example.com/x', 'drive')).toMatch(/Google Drive/);
    expect(validateResourceUrl('https://example.com/readme', 'link')).toBeNull();
    expect(validateResourceUrl('ftp://example.com/x', 'link')).toMatch(/https/);
    expect(validateResourceUrl('not-a-url', 'link')).toMatch(/valid URL/);
  });

  it('skips URL checks for upload types', () => {
    expect(validateResourceUrl('', 'pdf')).toBeNull();
  });

  it('validates optional thumbnail/embed URLs', () => {
    expect(validateOptionalUrl('', 'thumbnail_url')).toBeNull();
    expect(validateOptionalUrl('https://cdn/x.jpg', 'thumbnail_url')).toBeNull();
    expect(validateOptionalUrl('javascript:alert(1)', 'embed_url')).toMatch(/valid URL|http|scheme/);
  });
});

describe('filenames and R2 keys', () => {
  it('sanitizes malicious filenames', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFileName('a/b\\c$id!.pdf')).not.toMatch(/[/\\$!]/);
    expect(sanitizeFileName('')).toBe('file');
  });

  it('sanitizes Content-Disposition filenames (no header injection)', () => {
    const out = sanitizeContentDispositionFilename('evil"; filename="x');
    expect(out).not.toMatch(/["\\\r\n]/);
  });

  it('builds standard keys and allow-lists them', () => {
    const key = buildCourseAssetKey('Lecture Slides', 'abcdef1234567890abcdef', '.pdf');
    expect(key).toMatch(/^courses\/resources\/\d{4}\/\d{2}\/Lecture-Slides-abcdef1234567890\.pdf$/);
    expect(isAllowedCourseAssetKey(key)).toBe(true);
  });

  it('rejects traversal and non-conforming keys', () => {
    expect(isAllowedCourseAssetKey('courses/resources/2024/01/../../../etc')).toBe(false);
    expect(isAllowedCourseAssetKey('/courses/resources/2024/01/a.pdf')).toBe(false);
    expect(isAllowedCourseAssetKey('other-bucket/a.pdf')).toBe(false);
    expect(isAllowedCourseAssetKey('courses/resources/a.pdf')).toBe(false); // missing date prefix
    // Legacy bulk prefix keeps working (backward compat)
    expect(isAllowedCourseAssetKey('courses/resources/uploads/2024/01/a-b123.pdf')).toBe(true);
  });

  it('formats file sizes', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('extracts extensions', () => {
    expect(extensionOf('A.PDF')).toBe('.pdf');
    expect(extensionOf('noext')).toBe('');
  });
});

describe('PostgREST search escaping', () => {
  it('quotes patterns and escapes LIKE wildcards', () => {
    expect(buildPostgrestLikePattern('100%_sure')).toBe('"%100\\%\\_sure%"');
  });

  it('keeps commas/parentheses from breaking .or() filters', () => {
    const filter = buildCourseSearchOrFilter('Intro (part 1), "advanced"');
    expect(filter).not.toContain('"advanced"');
    expect(filter).toContain('title.ilike.');
    expect(filter).toContain('code.ilike.');
    expect(filter).toContain('description.ilike.');
  });
});

describe('batching and pagination bounds', () => {
  it('chunks large ID lists for .in() queries', () => {
    const chunks = chunkArray(Array.from({ length: 250 }, (_, i) => i), SUPABASE_IN_CHUNK_SIZE);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(100);
  });

  it('parses positive ints safely', () => {
    expect(parsePositiveInt('abc', 20)).toBe(20);
    expect(parsePositiveInt('-3', 1)).toBe(1);
    expect(parsePositiveInt('0', 1)).toBe(1);
    expect(parsePositiveInt('50', 20)).toBe(50);
  });

  it('declares sane bulk ceilings', () => {
    expect(BULK_MAX_RESOURCES_PER_BATCH).toBeLessThanOrEqual(100);
    expect(BULK_MAX_FILES_PER_REQUEST).toBeLessThanOrEqual(25);
    expect(FETCH_ALL_MAX_IDS).toBeLessThanOrEqual(5000);
  });
});
