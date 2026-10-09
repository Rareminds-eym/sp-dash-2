import { describe, expect, it } from 'vitest';
import {
  validateHierarchyPayload,
  validateResourceUrl,
} from '@/lib/services/course-resource-validation';

describe('Blocker 3: upload-type URL hardening', () => {
  it('rejects javascript:/data:/file: URLs for upload types', () => {
    expect(validateResourceUrl('javascript:alert(1)', 'pdf')).toMatch(/scheme/);
    expect(validateResourceUrl('data:text/html,<h1>x</h1>', 'video')).toMatch(/scheme/);
    expect(validateResourceUrl('file:///etc/passwd', 'document')).toMatch(/scheme/);
    expect(validateResourceUrl('JaVaScRiPt:alert(1)', 'image')).toMatch(/scheme/);
  });

  it('rejects malformed and non-https URLs for upload types', () => {
    expect(validateResourceUrl('not-a-url', 'pdf')).toMatch(/valid URL|https|asset/);
    expect(validateResourceUrl('http://example.com/a.pdf', 'pdf')).toMatch(/https/);
    expect(validateResourceUrl('ftp://example.com/a.pdf', 'pdf')).toMatch(/https/);
  });

  it('accepts empty (pre-upload placeholder), https, and asset paths', () => {
    expect(validateResourceUrl('', 'pdf')).toBeNull();
    expect(validateResourceUrl('https://cdn.example.com/a.pdf', 'pdf')).toBeNull();
    expect(validateResourceUrl('/api/courses/assets?key=courses%2Fresources%2F2024%2F01%2Fa.pdf', 'video')).toBeNull();
    expect(validateResourceUrl('/etc/passwd', 'pdf')).toMatch(/asset/);
  });

  it('still enforces youtube/drive shapes', () => {
    expect(validateResourceUrl('javascript:alert(1)', 'youtube')).toMatch(/scheme/);
    expect(validateResourceUrl('https://vimeo.com/1', 'youtube')).toMatch(/YouTube/);
    expect(validateResourceUrl('https://example.com/x', 'drive')).toMatch(/Google Drive/);
  });
});

describe('Blocker 3: shared hierarchy contract', () => {
  it('rejects unsafe resource URLs nested in hierarchy', () => {
    const err = validateHierarchyPayload([
      { title: 'M1', lessons: [{ title: 'L1', resources: [{ name: 'R', type: 'pdf', url: 'javascript:alert(1)' }] }] },
    ]);
    expect(err).toMatch(/scheme/);
  });

  it('accepts valid hierarchy with asset paths and https', () => {
    expect(
      validateHierarchyPayload([
        {
          title: 'M1',
          lessons: [
            {
              title: 'L1',
              resources: [
                { name: 'Slides', type: 'pdf', url: '/api/courses/assets?key=k', size: '1 MB' },
                { name: 'Talk', type: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
              ],
            },
          ],
        },
      ]),
    ).toBeNull();
  });

  it('rejects missing names and bad types', () => {
    expect(validateHierarchyPayload([{ title: 'M1', lessons: [{ title: 'L1', resources: [{ name: '', type: 'pdf', url: 'https://x.com/a' }] }] }])).toMatch(/name/);
    expect(validateHierarchyPayload([{ title: 'M1', lessons: [{ title: 'L1', resources: [{ name: 'R', type: 'ppt', url: 'https://x.com/a' }] }] }])).toMatch(/one of/);
  });

  it('allows explicit empty arrays (clear-all)', () => {
    expect(validateHierarchyPayload([])).toBeNull();
  });
});
