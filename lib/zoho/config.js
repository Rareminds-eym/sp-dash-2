// Nonsecret runtime policy. Credentials and service bindings stay in the Worker environment.

const MEBIBYTE = 1024 * 1024;

export const ZOHO_DEFAULTS = Object.freeze({
  recoveryCron: '*/2 * * * *',
  requestTimeoutMs: 15_000,
  dependencyTimeoutMs: 5_000,
  retryDelaySeconds: 300,
  maxProviderResponseBytes: MEBIBYTE,
  maxJobPageResponseBytes: 3 * MEBIBYTE,
  maxStagingCommitBytes: 8 * MEBIBYTE,
});

/** Retired environment variable names, retained for compatibility and auditing. */
export const ZOHO_FLAG_NAMES = Object.freeze({
  background: 'ZOHO_BACKGROUND_ENABLED',
  discovery: 'ZOHO_DISCOVERY_ENABLED',
  execution: 'ZOHO_EXECUTION_ENABLED',
  jobPublisher: 'ZOHO_JOB_PUBLISHER_ENABLED',
  projectionDelivery: 'ZOHO_PROJECTION_DELIVERY_ENABLED',
  privacyCleanup: 'ZOHO_PRIVACY_CLEANUP_ENABLED',
  sourceOperations: 'ZOHO_SOURCE_OPERATIONS_ENABLED',
});

const DISABLED_FEATURES = Object.fromEntries(Object.keys(ZOHO_FLAG_NAMES).map(name => [name, false]));
const CALLBACK_PATH = '/api/integrations/zoho-recruit/oauth/callback';
const LOCAL_CALLBACK = `http://localhost:3010${CALLBACK_PATH}`;

function createProfile({ environment = null, redirectUri = null, preview = false, features = {} } = {}) {
  return Object.freeze({
    ...DISABLED_FEATURES,
    ...features,
    environment,
    redirectUri,
    preview,
    emailPolicy: 'forbidden',
    requiresApproval: true,
  });
}

// A null callback means OAuth is not configured. Connecting does not enable processing.
export const ZOHO_PROFILES = Object.freeze({
  production: createProfile({ environment: 'production' }),
  dev: createProfile({ environment: 'dev' }),
  qa: createProfile({
    environment: 'qa',
    redirectUri: `https://sp-dash-2-qa.subashini.workers.dev${CALLBACK_PATH}`,
    features: { background: true, discovery: true, sourceOperations: true, privacyCleanup: true,
      execution: true, jobPublisher: true, projectionDelivery: true },
  }),
  preview: createProfile({ preview: true }),
  'local-review': createProfile({ environment: 'dev', redirectUri: LOCAL_CALLBACK }),
  local: createProfile({
    environment: 'dev',
    redirectUri: LOCAL_CALLBACK,
    features: {
      background: true,
      discovery: true,
      execution: true,
      jobPublisher: true,
      projectionDelivery: true,
      privacyCleanup: true,
      sourceOperations: true,
    },
  }),
  blocked: createProfile(),
});

/** All configured aliases must identify a bare loopback database endpoint. */
function isLocalDatabaseUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) &&
      !url.username && !url.password &&
      url.pathname === '/' && !url.search && !url.hash;
  } catch {
    return false;
  }
}

/** Resolve environment identity without consulting retired feature overrides. */
export function zohoProfileName(env = {}) {
  const environment = env?.ENVIRONMENT;
  if (environment === 'preview') return 'preview';

  const databaseUrls = [env?.SKILLPASSPORT_SUPABASE_URL, env?.NEXT_PUBLIC_SUPABASE_URL, env?.SUPABASE_URL]
    .filter(value => value !== undefined && value !== null && value !== '');
  const localDatabases = databaseUrls.length > 0 && databaseUrls.every(isLocalDatabaseUrl);

  if (environment === 'local-review') return localDatabases ? 'local-review' : 'blocked';
  // Explicit local mode permits injected adapters, but rejects any remote database URL.
  if (environment === 'local') return databaseUrls.length === 0 || localDatabases ? 'local' : 'blocked';

  const development = environment === undefined || environment === 'development' || environment === 'dev';
  if (development && localDatabases) return 'local';

  switch (environment) {
    case 'development':
    case 'dev': return 'dev';
    case 'qa': return 'qa';
    case 'production': return 'production';
    default: return 'blocked';
  }
}

/** Return an immutable policy; secrets and mutable environment values stay out. */
export function readZohoConfig(env = {}) {
  return ZOHO_PROFILES[zohoProfileName(env)];
}

/** Shared gate for operator controls and the existing source-operation consumer. */
export function sourceProcessingEnabled(env = {}) {
  const config = readZohoConfig(env);
  return config.background && config.discovery && config.sourceOperations &&
    typeof env?.ZOHO_DISCOVERY_QUEUE?.send === 'function';
}
