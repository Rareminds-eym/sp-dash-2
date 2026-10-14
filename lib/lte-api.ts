import type { NextRequest } from 'next/server';
import { lteEndpoint, type LTEConnection } from './lte-http';

export async function lteConnection(): Promise<LTEConnection> {
  // Resolve at request time so absent LTE configuration never breaks app boot/build.
  let bindings: LTEConnection = {};
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const context = await getCloudflareContext({async:true});
    bindings = context.env as unknown as LTEConnection;
  } catch { /* Missing runtime bindings fail only the requested LTE feature. */ }
  return {
    // OpenNext's Node dev bridge loads top-level Wrangler production vars.
    LTE_API_BASE_URL: process.env.NODE_ENV === 'development'
      ? (bindings.LTE_API_BASE_URL && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(bindings.LTE_API_BASE_URL).hostname)
        ? bindings.LTE_API_BASE_URL : 'http://localhost:8789')
      : bindings.LTE_API_BASE_URL,
    LTE_CATALOG_SYNC_SECRET: bindings.LTE_CATALOG_SYNC_SECRET,
  };
}

export async function callLTE(request: NextRequest, operation: string, payload?: unknown): Promise<Response> {
  let bodyTooLarge = false;
  try {
    const origin = request.headers.get('origin');
    if (!['GET', 'HEAD'].includes(request.method)) {
      const cookie = request.headers.get('cookie');
      if ((origin && origin !== new URL(request.url).origin) || (!origin && cookie) || request.headers.get('sec-fetch-site') === 'cross-site') {
        return Response.json({success:false,error:'Forbidden origin'}, {status:403});
      }
    }
    const authorization = request.headers.get('authorization');
    const cookieToken = request.headers.get('cookie')?.split(';').map(value => value.trim()).find(value => /^(?:__Host-)?sso_access_token=/.test(value))?.split('=').slice(1).join('=');
    const token = authorization || (cookieToken ? `Bearer ${cookieToken}` : null);
    if (!token) return Response.json({success:false,error:'Unauthorized'}, {status:401});
    const endpoint = lteEndpoint(await lteConnection(), `/api/v1/admin/catalog/${operation}`);
    endpoint.search = new URL(request.url).search;
    const headers = new Headers({Authorization: token, Accept:'application/json'});
    let body: string | ReadableStream<Uint8Array> | undefined;
    if (payload !== undefined) {
      body = JSON.stringify(payload);
      headers.set('Content-Type', 'application/json');
    } else if (!['GET', 'HEAD'].includes(request.method)) {
      const limit = 25 * 1024 * 1024;
      if (Number(request.headers.get('content-length')) > limit)
        return Response.json({success:false,error:'Request too large'}, {status:413});
      const reader = request.body?.getReader();
      let size = 0;
      body = reader ? new ReadableStream({
        async pull(controller) {
          try {
            const result = await reader.read();
            if (result.done) { controller.close(); reader.releaseLock(); return; }
            size += result.value.byteLength;
            if (size > limit) { bodyTooLarge = true; await reader.cancel(); controller.error(new RangeError('Request too large')); return; }
            controller.enqueue(result.value);
          } catch (error) { controller.error(error); }
        },
        async cancel(reason) { await reader.cancel(reason); },
      }) : undefined;
      headers.set('Content-Type', request.headers.get('content-type') || 'application/json');
    }
    const result = await fetch(endpoint, {method:request.method, headers, body, ...(body instanceof ReadableStream ? {duplex:'half'} : {}), redirect:'error', signal:AbortSignal.timeout(120000)});
    // Do not forward upstream cookies, CORS policy or transport headers.
    return new Response(result.body, {status:result.status, headers:{'Content-Type':result.headers.get('Content-Type') || 'application/json', 'Cache-Control':'no-store'}});
  } catch {
    if (bodyTooLarge) return Response.json({success:false,error:'Request too large'}, {status:413});
    return Response.json({success:false,error:'LTE catalog service unavailable'}, {status:503});
  }
}

export async function proxyLTE(request: NextRequest, operation: string): Promise<Response> {
  return callLTE(request, operation);
}

export async function proxyLTEAsset(request: NextRequest): Promise<Response> {
  try {
    const endpoint = lteEndpoint(await lteConnection(), '/api/v1/catalog/assets');
    endpoint.search = new URL(request.url).search;
    const response = await fetch(endpoint, {redirect:'error', signal:AbortSignal.timeout(30000)});
    const headers = new Headers();
    for (const name of ['Content-Type', 'Cache-Control', 'X-Content-Type-Options']) {
      const value = response.headers.get(name); if (value) headers.set(name,value);
    }
    return new Response(response.body, {status:response.status,headers});
  } catch {
    return Response.json({success:false,error:'LTE asset service unavailable'}, {status:503});
  }
}
