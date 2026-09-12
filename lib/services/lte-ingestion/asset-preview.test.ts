import { describe, expect, it } from 'vitest';
import { classifyPreviewAsset } from './asset-preview';

describe('classifyPreviewAsset', () => {
  it.each([
    [{ id: '1', title: 'Video', contentType: 'video/mp4' }, 'video'],
    [{ id: '2', title: 'Image', fileName: 'PHOTO.JPEG' }, 'image'],
    [{ id: '3', title: 'Audio', url: 'https://cdn.test/audio.MP3?token=1' }, 'audio'],
    [{ id: '4', title: 'Deck', url: 'https://cdn.test/course.PPTX?download=1' }, 'slides'],
    [{ id: '5', title: 'Old deck', fileName: 'course.ppt' }, 'slides'],
    [{ id: '6', title: 'Guide', url: 'https://cdn.test/guide.PDF?x=1' }, 'document'],
    [{ id: '7', title: 'Website', url: 'https://example.test/lesson' }, 'link'],
  ] as const)('classifies %o as %s', (asset, expected) => {
    expect(classifyPreviewAsset(asset)).toBe(expected);
  });
});
