/** Trainer documents share the application's existing R2 assets bucket. */
import crypto from 'crypto';
import { getSharedAssetsBucket } from './course-assets-r2';

export async function uploadEducatorDocument(file, educatorId, documentType, requestUrl) {
  try {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(educatorId)) throw new Error('Invalid educator ID');
    const extensions = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png' };
    const ext = extensions[file.type];
    if (!ext || !['degree-certificate', 'id-proof', 'experience-letters'].includes(documentType)) {
      throw new Error('Invalid educator document');
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const hash = crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 16);
    const key = `educator-documents/${educatorId}/${documentType}-${hash}${ext}`;
    const bucket = await getSharedAssetsBucket();
    await bucket.put(key, buffer, { httpMetadata: { contentType: file.type } });
    const url = new URL('/api/educators/documents', requestUrl);
    url.searchParams.set('key', key);
    return { success: true, url: url.toString(), key };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function generateEducatorId() {
  return `EDU-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}