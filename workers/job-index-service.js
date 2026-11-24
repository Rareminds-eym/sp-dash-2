import { WorkerEntrypoint } from 'cloudflare:workers';
import { requestJobIndexWake, requestJobIndexStatus } from '../lib/job-index/coordinator';

/** Private app-to-app signal only; no public HTTP command or caller-supplied SQL. */
export class JobIndexService extends WorkerEntrypoint {
  async getIndexingStatus() { return requestJobIndexStatus(this.env); }
  async kickJobIndexing() { return requestJobIndexWake(this.env); }
  async fetch() { return new Response('Not found', { status: 404 }); }
}
