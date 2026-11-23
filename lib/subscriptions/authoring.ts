import 'server-only';

export class DraftRequestError extends Error {
  constructor(readonly status: number) { super('Invalid draft request'); }
}

/** Bound actual streamed bytes rather than trusting Content-Length. No partial JSON is accepted. */
export async function readDraftRequest(request: Request): Promise<unknown> {
  if (new URL(request.url).search || request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new DraftRequestError(400);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new DraftRequestError(400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 262144) { await reader.cancel(); throw new DraftRequestError(413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new DraftRequestError(400); }
}
