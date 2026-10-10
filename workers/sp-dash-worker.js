import openNextWorker from '../.open-next/worker.js';
import lteAssetValidationConsumer from './lte-asset-validation-consumer.ts';
import courseUploadConsumer from './course-upload-consumer.ts';

export default {
  fetch(request, env, ctx) {
    return openNextWorker.fetch(request, env, ctx);
  },

  queue(batch, env, ctx) {
    if (batch.queue?.startsWith('course-management-uploads')) {
      return courseUploadConsumer.queue(batch, env, ctx);
    }
    return lteAssetValidationConsumer.queue(batch, env, ctx);
  },
};
