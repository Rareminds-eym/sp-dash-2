import { processJobIndex } from './processor';
import { processorErrorCode, processorHealth } from './health';

export async function requestJobIndexWake(env) {
  if (!env.JOB_INDEX_COORDINATOR) throw new Error('JOB_INDEX_DISPATCH_UNCONFIGURED');
  const stub = env.JOB_INDEX_COORDINATOR.get(env.JOB_INDEX_COORDINATOR.idFromName('catalog'));
  const response = await stub.fetch('https://job-index.internal/wake');
  if (!response.ok) throw new Error('JOB_INDEX_DISPATCH_UNAVAILABLE');
  return { accepted: true };
}

export async function requestJobIndexStatus(env) {
  if (!env.JOB_INDEX_COORDINATOR) throw new Error('JOB_INDEX_DISPATCH_UNCONFIGURED');
  const stub = env.JOB_INDEX_COORDINATOR.get(env.JOB_INDEX_COORDINATOR.idFromName('catalog'));
  const response = await stub.fetch('https://job-index.internal/status');
  if (!response.ok) throw new Error('JOB_INDEX_DISPATCH_UNAVAILABLE');
  return processorHealth(await response.json());
}

/** App-owned alarm scheduler. Database leases remain authoritative. */
export class JobIndexCoordinator {
  running = null;
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
  async fetch(request) {
    const path = request ? new URL(request.url).pathname : '/wake';
    if (path === '/status') return Response.json(processorHealth(await this.ctx.storage.get('processorHealth')));
    if (path !== '/wake') return new Response('Not found', { status: 404 });
    if (this.running) return Response.json({ accepted: true });
    const alarm = await this.ctx.storage.getAlarm();
    if (alarm === null || alarm > Date.now() + 1000) await this.ctx.storage.setAlarm(Date.now() + 1000);
    return Response.json({ accepted: true });
  }
  async alarm() {
    if (this.running) return this.running;
    this.running = this.run();
    try { await this.running; } finally { this.running = null; }
  }
  async run() {
    await this.ctx.storage.setAlarm(Date.now() + 660000);
    let health;
    try {
      const previous = await this.ctx.storage.get('processorHealth');
      health = { state: 'running', errorCode: null, lastAttemptAt: new Date().toISOString(), lastSuccessAt: previous?.lastSuccessAt || null };
      await this.ctx.storage.put('processorHealth', health);
      const status = await processJobIndex(this.env);
      await this.ctx.storage.put('processorHealth', { ...health, state: 'idle', lastSuccessAt: new Date().toISOString() });
      const next = status.next_attempt_at ? Date.parse(status.next_attempt_at) : Date.now() + 300000;
      await this.ctx.storage.setAlarm(Math.max(Date.now() + 3000, Math.min(next, Date.now() + 300000)));
    } catch (error) {
      const errorCode = processorErrorCode(error);
      await this.ctx.storage.setAlarm(Date.now() + 60000);
      await this.ctx.storage.put('processorHealth', { ...health, state: 'blocked', errorCode,
        lastAttemptAt: health?.lastAttemptAt || new Date().toISOString() });
      console.error(JSON.stringify({ event: 'job_index.retry_scheduled', code: errorCode }));
    }
  }
}
