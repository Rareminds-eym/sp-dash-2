import { signedLTERequest, type LTEConnection } from '../lib/lte-http';

interface AssetMessage { uploadId: string; assetUrl: string }
interface QueueMessage {
  body: AssetMessage;
  ack(): void;
  retry(options?: {delaySeconds?:number}): void;
  attempts?: number;
}

export default {
  async queue(batch: {messages:QueueMessage[]}, env: LTEConnection): Promise<void> {
    for (const message of batch.messages) {
      try {
        const response = await signedLTERequest(env, '/api/v1/internal/catalog/process-asset', {
          ...message.body, attempts:Number(message.attempts || 1),
        });
        // Ack only after LTE has processed or persisted an exhausted job.
        if (!response.ok) throw new Error(`LTE asset endpoint returned ${response.status}`);
        const result = await response.json() as {success?:boolean};
        if (result.success !== true) throw new Error('LTE did not confirm asset processing');
        message.ack();
      } catch {
        message.retry({delaySeconds:30});
      }
    }
  },
};
