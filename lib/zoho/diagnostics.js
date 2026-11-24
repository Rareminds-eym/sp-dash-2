/** Closed metadata only: never log messages, stack traces, tokens, query strings or PII. */
export function integrationFailure(event, error, context = {}) {
  const requestId = crypto.randomUUID();
  const safe = value => typeof value === 'string' && /^[a-zA-Z0-9_./-]{1,80}$/.test(value) ? value : 'unknown';
  console.error(JSON.stringify({ event, requestId, name: safe(error?.name), code: safe(error?.code),
    action: safe(context.action), view: safe(context.view) }));
  return requestId;
}
