import { createClient } from '@supabase/supabase-js';
import {
  finalizePublishJobIfReady,
  markAssetValidationFailed,
  processAssetValidationMessage,
  type LTEAssetValidationMessage,
} from '../lib/services/lte-ingestion/publish-job';
import { R2StorageService, type R2BucketLike } from '../lib/services/lte-ingestion/r2-storage';

interface Env {
  LTE_SUPABASE_URL: string;
  LTE_SERVICE_ROLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  LTE_ASSETS: R2BucketLike;
}

interface QueueMessage<T> {
  body: T;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
  attempts?: number;
}

interface QueueBatch<T> {
  messages: QueueMessage<T>[];
}

export default {
  async queue(batch: QueueBatch<LTEAssetValidationMessage>, env: Env): Promise<void> {
    const serviceRoleKey = env.LTE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    if (!env.LTE_SUPABASE_URL || !serviceRoleKey) {
      throw new Error('LTE queue consumer requires LTE_SUPABASE_URL and LTE_SERVICE_ROLE_KEY.');
    }

    const supabase = createClient(env.LTE_SUPABASE_URL, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const storage = new R2StorageService(env.LTE_ASSETS);

    for (const message of batch.messages) {
      const body = message.body;
      try {
        await processAssetValidationMessage(body, { supabase, storage });
        message.ack();
      } catch (error) {
        const attempts = Number(message.attempts || 1);
        if (attempts < 3) {
          message.retry({ delaySeconds: 30 });
        } else {
          await markAssetValidationFailed(body.uploadId, body.assetUrl, error, { supabase, storage });
          await finalizePublishJobIfReady(body.uploadId, { supabase, storage });
          message.ack();
        }
      }
    }
  },
};
