export const LOCAL_DASHBOARD_PORT = 3010;
export const LOCAL_WORKER_PORT = 8896;

export function loopbackDatabase(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
      !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash;
  } catch { return false; }
}

export function dashboardArguments(args) {
  let port = LOCAL_DASHBOARD_PORT;
  let hostname = '127.0.0.1';
  const extra = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (['--port', '-p', '--hostname', '-H'].includes(arg)) {
      const value = args[++index];
      if (arg === '--port' || arg === '-p') port = Number(value);
      else hostname = value;
    } else if (arg.startsWith('--port=')) port = Number(arg.slice(7));
    else if (arg.startsWith('--hostname=')) hostname = arg.slice(11);
    else extra.push(arg);
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535 || port === LOCAL_WORKER_PORT)
    throw new Error('Choose a valid dashboard port different from the local Worker port.');
  if (!['localhost', '127.0.0.1', '0.0.0.0', '::1', '::'].includes(hostname))
    throw new Error('Use a loopback or wildcard dashboard hostname.');
  // Avoid DNS-dependent IPv4/IPv6 binding when the operator requests localhost.
  if (hostname === 'localhost') hostname = '127.0.0.1';
  return { port, hostname, extra };
}

/** Derive local infrastructure from the existing dashboard deployment, never a new service. */
export function localDashboardConfig(infrastructure, canonicalServices, settings, { port, main, hostname = '127.0.0.1' }) {
  const database = settings.SKILLPASSPORT_SUPABASE_URL || settings.NEXT_PUBLIC_SUPABASE_URL || settings.SUPABASE_URL;
  const aliases = ['SKILLPASSPORT_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL']
    .map(key => settings[key]).filter(Boolean);
  if (!loopbackDatabase(database) || !aliases.every(loopbackDatabase))
    throw new Error('Local BFF startup requires loopback database URLs in .env.local or .dev.vars. Remote databases are not supported by this launcher.');
  const databaseIdentity = value => {
    const url = new URL(value);
    return `${url.protocol}//loopback:${url.port || (url.protocol === 'https:' ? '443' : '80')}`;
  };
  if (aliases.some(value => databaseIdentity(value) !== databaseIdentity(database)))
    throw new Error('Conflicting local database URLs. Align the dashboard database settings before starting.');
  const proxyHost = ['::1', '::'].includes(hostname) ? '[::1]' : '127.0.0.1';
  const config = {
    name: infrastructure.name,
    main,
    compatibility_date: infrastructure.compatibility_date,
    compatibility_flags: infrastructure.compatibility_flags.filter(flag => flag !== 'global_fetch_strictly_public'),
    workers_dev: false,
    preview_urls: false,
    vars: {
      ...infrastructure.vars,
      ENVIRONMENT: 'development',
      NEXT_PUBLIC_SUPABASE_URL: database,
      SKILLPASSPORT_SUPABASE_URL: database,
      SSO_WORKER_URL: 'http://127.0.0.1:8787',
      LOCAL_DASHBOARD_ORIGIN: `http://${proxyHost}:${port}`,
    },
    services: canonicalServices.map(service => ({ ...service, remote: false })),
    queues: structuredClone(infrastructure.queues),
    kv_namespaces: infrastructure.kv_namespaces.map(binding => ({ ...binding, remote: false })),
    r2_buckets: infrastructure.r2_buckets.map(binding => ({ ...binding, remote: false })),
    triggers: infrastructure.triggers,
  };
  const variables = { ...settings, ENVIRONMENT: 'development',
    NEXT_PUBLIC_SUPABASE_URL: database, SKILLPASSPORT_SUPABASE_URL: database,
    LOCAL_DASHBOARD_ORIGIN: config.vars.LOCAL_DASHBOARD_ORIGIN };
  const proxy = { ...config, name: `${config.name}-ui-local`, queues: { producers: config.queues.producers } };
  delete proxy.main;
  delete proxy.triggers;
  return { worker: config, proxy, variables };
}

export function serializeVariables(values) {
  return Object.entries(values).map(([key, value]) => {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key) || typeof value !== 'string')
      throw new Error('Invalid local setting name or value.');
    // Dotenv delimiters are not JSON escapes. Preserve keyrings and PEM keys literally.
    const delimiter = ["'", '`', '"'].find(quote => !value.includes(quote) &&
      (quote !== '"' || !/[\\\r\n]/.test(value)));
    if (!delimiter) throw new Error('Local setting cannot be represented safely.');
    return `${key}=${delimiter}${value}${delimiter}`;
  }).join('\n') + '\n';
}
