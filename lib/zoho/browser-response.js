/** Never expose a proxy's HTML response or an unparseable body as an operator error. */
export async function browserResponse(response) {
  let value;
  try {
    const type = response.headers.get('content-type') || '';
    if (!/\bapplication\/(?:[\w.+-]*\+)?json\b/i.test(type)) throw new Error();
    value = await response.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
  } catch {
    throw Object.assign(new Error(`Integration response unavailable (HTTP ${response.status}). Please retry.`), { status: response.status });
  }
  if (!response.ok) throw Object.assign(new Error(value.error || `Integration request failed (HTTP ${response.status}).`),
    { status: response.status, code: value.code, requestId: value.requestId });
  return value;
}
