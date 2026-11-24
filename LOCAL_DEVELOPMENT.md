# Local dashboard BFF

Run `npm run dev` in this repository. The default UI origin is
`http://localhost:3010`; `npm run dev -- --port 3020` overrides the UI port.
Keep the Zoho callback registered for the code-owned callback origin when testing OAuth.

The command starts Next.js and the **existing sp-dash Worker runtime** together.
The Worker owns queue consumption, scheduled recovery and the
`ZohoExecutionAuthority` entrypoint. Next owns the pages and authenticated BFF
routes. Both use the same private local settings and matching queue producers.
The launcher also invokes the existing recovery handler at the configured UTC cron
boundaries; Wrangler does not run cron automatically in local development. Ticks
are bounded, do not overlap, and are cancelled when the launcher stops.
Stopping the command stops both processes. It does not deploy, migrate a database,
start an email service, or start a separate Zoho Worker.

Start the existing SSO, auth-sync and application services normally for candidate
execution and account projection. The dashboard binds to their canonical local
SSO identity (`sso-api`), and SSO calls back to `sp-dash-2`. Approval and no-email
checks use the same application code as the deployed BFF.
The application's `npm run pages:dev` and `npm run pages:start` commands explicitly
select the existing development context. Loopback database configuration is still
required for local Zoho delivery; remote profiles remain disabled.

## Settings

Use the normal `.env.local` and `.dev.vars` files. The launcher reads development
dotenv files in Next precedence, with `.dev.vars` taking precedence for Worker
bindings. Values already supplied in the process environment override matching
file settings. Every configured database URL must be loopback; this launcher
refuses remote or mixed local/remote databases.
Conflicting local database ports or protocols are rejected rather than silently
rewritten. Loopback hostname aliases for the same endpoint are accepted.
IPv4 and IPv6 loopback/wildcard UI bindings are supported; the local Worker uses
the matching loopback address when forwarding requests to Next.

Keep OAuth credentials, token-encryption key material and the restricted discovery
database token in `.dev.vars`. Preserve existing encryption keys: replacing them
can make saved connections unreadable. See the
[Zoho configuration inventory](./lib/zoho/ENVIRONMENT.md). Missing credentials or
expired reader tokens keep discovery unavailable; local startup does not invent
credentials, renew database permissions, or authorize a source.

Infrastructure is derived from the existing development queues, storage and
schedule in [wrangler.toml](./wrangler.toml), with canonical local service names.
Generated local configuration stays under the ignored `.wrangler/local-dashboard/`
directory. The Next binding proxy has producers only; a single dashboard runtime
consumes queues and runs recovery. Secrets are written only to an ignored private
bindings file and are never printed.

The workspace Zoho launcher remains available for isolated acceptance fixtures.
Normal dashboard operation no longer depends on it or its private configuration.
Remote profiles and release configuration are unchanged.
