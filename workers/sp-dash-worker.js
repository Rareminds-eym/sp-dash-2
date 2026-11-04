import openNextWorker from '../.open-next/worker.js';
import { dashboardRuntime } from '../lib/dashboard-runtime';

export default dashboardRuntime(openNextWorker);

export { ZohoExecutionAuthority } from './zoho-execution-authority';
