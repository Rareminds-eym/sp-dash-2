import type { LTELearningAsset } from '@/types/lte-ingestion';

export type PreviewAssetKind = 'video' | 'image' | 'audio' | 'document' | 'slides' | 'link';

export function classifyPreviewAsset(asset: LTELearningAsset): PreviewAssetKind {
  const value = `${asset.contentType || ''} ${asset.fileName || ''} ${asset.url || ''}`.toLowerCase();
  if (/video|\.(mp4|webm|mov)(?:\?|\s|$)/.test(value)) return 'video';
  if (/image|\.(png|jpe?g|gif|webp)(?:\?|\s|$)/.test(value)) return 'image';
  if (/audio|\.(mp3|wav|m4a|ogg)(?:\?|\s|$)/.test(value)) return 'audio';
  if (/powerpoint|presentation|\.pptx?(?:\?|\s|$)|slides/.test(value)) return 'slides';
  if (/pdf|\.pdf(?:\?|\s|$)/.test(value)) return 'document';
  return 'link';
}
