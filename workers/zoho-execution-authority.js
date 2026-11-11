import { WorkerEntrypoint } from 'cloudflare:workers';
import { validateLiveOperation, validateProjectionReceipt, candidateProjectionCapabilities } from '../lib/zoho/execution-authority';

/** Named method on the existing dashboard deployment; no public HTTP command route. */
export class ZohoExecutionAuthority extends WorkerEntrypoint {
  async candidateProjectionCapabilities() { return candidateProjectionCapabilities(this.env); }
  async validateOperation(grant) { return validateLiveOperation(this.env, grant); }
  async validateProjectionReceipt(proof) { return validateProjectionReceipt(this.env, proof); }
  async fetch() { return new Response('Not found', { status: 404 }); }
}
