// Local HTTP adapter for the existing dashboard BFF. Production uses sp-dash-worker.js.
import { dashboardRuntime } from '../lib/dashboard-runtime';

export { ZohoExecutionAuthority } from './zoho-execution-authority';

export default dashboardRuntime({
  fetch(request, env) {
    const target = new URL(env.LOCAL_DASHBOARD_ORIGIN);
    if (target.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(target.hostname) ||
        target.pathname !== '/' || target.username || target.password || target.search || target.hash)
      return new Response('Local dashboard origin is invalid', { status: 503 });
    const source = new URL(request.url);
    target.pathname = source.pathname;
    target.search = source.search;
    return fetch(new Request(target, request), { redirect: 'manual' });
  },
});

export { JobIndexService } from './job-index-service';
export { JobIndexCoordinator } from '../lib/job-index/coordinator';
