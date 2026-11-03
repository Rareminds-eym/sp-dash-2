// Read-only diagnostics through LTE Pages Functions, never through PostgREST.
const { createHmac } = require('node:crypto');
require('dotenv').config({ path: '.dev.vars', quiet: true, override: true });
module.exports = async function run() {
  const origin = process.env.LTE_API_BASE_URL;
  const secret = process.env.LTE_INTERNAL_SECRET;
  if (!origin || !secret || secret.length < 32) throw new Error('Set LTE_API_BASE_URL and LTE_INTERNAL_SECRET');
  const url = new URL('/api/v1/internal/catalog/health', origin);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('LTE must use HTTPS or local loopback');
  const body = '{}';
  const timestamp = String(Date.now());
  const signature = createHmac('sha256', secret).update(`POST\n${url.pathname}\n${timestamp}\n${body}`).digest('hex');
  const response = await fetch(url, {method:'POST', body, redirect:'error', signal:AbortSignal.timeout(30000), headers:{'Content-Type':'application/json','x-lte-timestamp':timestamp,'x-lte-signature':signature}});
  if (!response.ok) {
    const failure = await response.json().catch(() => ({}));
    throw new Error(`LTE diagnostics returned HTTP ${response.status}${typeof failure.error === 'string' ? `: ${failure.error}` : ''}`);
  }
  console.log(JSON.stringify(await response.json(), null, 2));
};
