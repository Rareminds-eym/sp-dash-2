/** Server-only LTE transport, also used by the existing queue consumer. */
export interface LTEConnection { LTE_API_BASE_URL?: string; LTE_CATALOG_SYNC_SECRET?: string }

export async function readLTEBody(request: Request, limit: number): Promise<string> {
  if (Number(request.headers.get('content-length')) > limit) throw new RangeError('Request too large');
  const reader=request.body?.getReader();if(!reader)return '';
  const decoder=new TextDecoder();const chunks:string[]=[];let size=0;
  try {
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
      if(size>limit){await reader.cancel();throw new RangeError('Request too large');}
      chunks.push(decoder.decode(value,{stream:true}));}
  } finally {reader.releaseLock();}
  chunks.push(decoder.decode());return chunks.join('');
}

export function lteEndpoint(config: LTEConnection, path: string): URL {
  if (!config.LTE_API_BASE_URL) throw new Error('LTE_API_BASE_URL is not configured');
  const base = new URL(config.LTE_API_BASE_URL);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if ((base.protocol !== 'https:' && !(base.protocol === 'http:' && local)) || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new Error('LTE_API_BASE_URL must be an HTTPS origin (HTTP loopback is allowed locally)');
  }
  return new URL(path, base);
}

export async function signedLTERequest(config: LTEConnection, path: string, payload: unknown): Promise<Response> {
  const secret = config.LTE_CATALOG_SYNC_SECRET;
  if (!secret || secret.length < 32) throw new Error('LTE_CATALOG_SYNC_SECRET is not configured');
  const endpoint = lteEndpoint(config, path);
  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`POST\n${endpoint.pathname}\n${timestamp}\n${body}`)));
  const signature = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return fetch(endpoint, {
    method: 'POST', body, redirect: 'error', signal: AbortSignal.timeout(120000),
    headers: {'Content-Type':'application/json', 'x-lte-timestamp':timestamp, 'x-lte-signature':signature},
  });
}
