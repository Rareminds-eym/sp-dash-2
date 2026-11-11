import { requestJobIndexWake } from './job-index/coordinator';
import lteAssetValidationConsumer from '../workers/lte-asset-validation-consumer.ts';
import courseUploadConsumer from '../workers/course-upload-consumer.ts';
import { integrationRuntime } from './zoho/runtime';

export function dashboardRuntime(openNextWorker) {
  return {
    fetch(request, env, ctx) {
      return openNextWorker.fetch(request, env, ctx);
    },

    async queue(batch, env, ctx) {
      if (await integrationRuntime(env).queue(batch)) return;
      // Never route a Zoho queue from another environment to the LTE consumer.
      if (batch.queue?.startsWith('zoho-recruit-')) {
        for (const message of batch.messages) message.retry({ delaySeconds: 300 });
        return;
      }
      if (batch.queue?.startsWith('course-management-uploads')) {
        return courseUploadConsumer.queue(batch, env, ctx);
      }
      return lteAssetValidationConsumer.queue(batch, env, ctx);
    },

    async scheduled(controller, env) {
      const outcomes = await Promise.allSettled([
        integrationRuntime(env).scheduled(controller),
        env.JOB_INDEX_COORDINATOR ? requestJobIndexWake(env) : Promise.resolve(),
      ]);
      if (outcomes.some(result => result.status === 'rejected')) throw new Error('Application background recovery incomplete');
    },
  };
}
