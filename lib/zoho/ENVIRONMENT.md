# Zoho configuration inventory

Nonsecret Zoho policy is owned by application constants. Six Zoho-specific
credential/key names remain external; no credential values belong in source.
Platform bindings and shared infrastructure settings remain with their existing
owners rather than being duplicated into Zoho configuration.

## Credentials and key settings

| Variable | Service | Purpose |
| --- | --- | --- |
| `ZOHO_CLIENT_ID` | sp-dash | OAuth client/API key identifier |
| `ZOHO_CLIENT_SECRET` | sp-dash | OAuth client secret |
| `ZOHO_TOKEN_ENCRYPTION_KEYS` | sp-dash | Encryption keyring containing key material |
| `ZOHO_TOKEN_ENCRYPTION_ACTIVE_KEY_ID` | sp-dash | Selects the current write key in that keyring |
| `ZOHO_TOKEN_ENCRYPTION_KEY` | sp-dash | Single-key mode or legacy-envelope read key |
| `ZOHO_DISCOVERY_DB_TOKEN` | sp-dash | Restricted, expiring discovery-role credential |

Client and active key identifiers are not confidential by themselves, but remain
external as part of key management. Use single-key mode or a keyring with an active
key ID. Retain keys needed to decrypt existing records during rotation.

## Application constants

| Owner | Code-owned settings |
| --- | --- |
| [Dashboard config](./config.js) | Background, discovery, approved execution, job publishing, source operations, privacy cleanup, projection delivery, queue environment, preview policy, OAuth callback, retries, timeouts, response limits and recovery cadence |
| [SSO config](../../../sso-worker/src/lib/zoho-config.ts) | Candidate provisioning, projection delivery and dependency/delivery timeouts |
| [Application config](../../../skillpassport/functions/lib/zoho-config.ts) | Projection delivery, dependency timeout and request-size limit |

Each module exports immutable deployment profiles. The dashboard QA profile enables
discovery, source operations, privacy cleanup and approved job execution. Candidate
projection delivery remains disabled until its private boundary is configured. Production, development, preview
and unknown deployments remain disabled. Existing local loopback database
configuration selects the enabled local profile; `local-review` keeps operations
disabled during local preparation. The isolated acceptance launcher verifies dependency
wiring before selecting the existing `development` platform context. Normal
dashboard development uses `npm run dev`, which starts the existing BFF runtime
and UI with the standard private local settings; see
[local development](../../LOCAL_DEVELOPMENT.md). Database,
credential, source-state, queue and exact-approval checks remain mandatory.
Dashboard background disablement also blocks its nested processing adapters.

The local callback is
`http://localhost:3010/api/integrations/zoho-recruit/oauth/callback`.
The QA callback is configured for `https://sp-dash-2-qa.subashini.workers.dev`;
its exact callback URL must be registered with Zoho. Dev/production callbacks
remain unset. Changing a profile requires a code change and rebuild/restart.
QA discovery also requires its restricted role credential and provider credentials.
Email prohibition and human approval remain enforced independently of profiles.

## Platform bindings, not string variables

| Binding | Service | Purpose |
| --- | --- | --- |
| `ZOHO_DISCOVERY_QUEUE` | sp-dash | Producer for discovery and source-operation references |
| `ZOHO_APPROVED_QUEUE` | sp-dash | Producer for approved execution/recovery references |
| `ZOHO_APPROVER_AUTHORITY` | sp-dash | Named SSO entrypoint for live approver/evidence checks |
| `ZOHO_CANDIDATE_DESTINATION` | sp-dash | Named SSO candidate provisioner |
| `ZOHO_CONTROL_PLANE` | SSO | Named dashboard entrypoint for authoritative operation/projection validation |
| `ZOHO_CANDIDATE_SOURCE` | SkillPassport | Named SSO entrypoint for canonical projection/policy reads and receipt confirmation |

`ZOHO_DISCOVERY_AUTHORITY` is constructed inside the dashboard runtime and
`ZOHO_JOB_DESTINATION` defaults to its in-process job adapter. They are internal
capability objects, not required extra deployable workers or ordinary string vars.

The integration also uses existing bindings: `SSO` (live admin/session authority),
`SYNC_QUEUE` (existing SSO-to-application transport) and `SKILLPASSPORT_ASSETS`
(private bulk artifacts). They remain platform resources in deployment config.

## Shared string dependencies

These are existing infrastructure settings reused by Zoho, not new Zoho switches:

| Setting | Usage |
| --- | --- |
| `ENVIRONMENT` | Existing platform deployment identity; selects a code-owned profile |
| `SKILLPASSPORT_SUPABASE_URL` | Preferred dashboard application database URL; existing fallbacks are `NEXT_PUBLIC_SUPABASE_URL` then `SUPABASE_URL` |
| `SKILLPASSPORT_SERVICE_ROLE_KEY` | Preferred dashboard privileged application credential; falls back to `SUPABASE_SERVICE_ROLE_KEY` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dashboard restricted-reader client key; authorization uses the separate reader token |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | SSO/application server database access; the application admin helper also supports its existing `VITE_SUPABASE_URL` fallback |
| `SSO_WORKER_URL` | Dashboard HTTP JWKS fallback when the normal SSO RPC binding is unavailable |
| `SKILLPASSPORT_SYNC_URL` | Existing auth-sync consumer destination origin |
| `SYNC_API_SECRET` | Existing auth-sync consumer transport credential |
| `INTERNAL_WEBHOOK_SECRET` | Matching application receiver credential; must agree with `SYNC_API_SECRET` |

Existing SSO session/JWT settings still apply to ordinary sign-in/admin approval;
this is not an inventory of every unrelated platform/authentication variable.
Shared public database keys/URLs are configuration; service-role and internal
transport credentials are secrets. None should be duplicated as Zoho constants.

## Retired environment settings

The application no longer reads `ZOHO_BACKGROUND_ENABLED`,
`ZOHO_DISCOVERY_ENABLED`, `ZOHO_EXECUTION_ENABLED`, `ZOHO_JOB_PUBLISHER_ENABLED`,
`ZOHO_SOURCE_OPERATIONS_ENABLED`, `ZOHO_PRIVACY_CLEANUP_ENABLED`,
`ZOHO_PROJECTION_DELIVERY_ENABLED`, `ZOHO_CANDIDATE_PROVISIONING_ENABLED`,
`ZOHO_ENVIRONMENT`, `ZOHO_PREVIEW`, `ZOHO_REDIRECT_URI` or `ZOHO_RECOVERY_CRON`
as external configuration. Remove them from deployment variables when updating
configuration. Legacy names in test fixtures and normalized internal DTOs are not
supported environment overrides. Local tooling removes obsolete entries without
changing credentials.

Wrangler queue/service/R2 bindings and schedules remain infrastructure resources.
The recovery schedule declarations are checked against the code cadence constant.
Source quota, retention, mappings, connection/discovery pause state and approval
records remain audited database-backed operator controls, not deployment flags.

## URL fallback and regression coverage

SkillPassport profile selection resolves its database URL exactly as its admin
client does: a truthy `SUPABASE_URL` wins, otherwise `VITE_SUPABASE_URL` is used.
A remote or malformed primary is never replaced with a local fallback for policy
selection. Existing deployment/preview/review gates still apply with either URL.
SSO and application environment types declare the shared platform context.

The dashboard [runtime profile regression](./__tests__/runtime-profiles.test.js)
uses actual configuration modules with synthetic provider/storage adapters. It
covers queue-to-staging propagation, dormant profiles and malformed/mixed URL
aliases without account or email effects. Separate consumer policy matrices keep
their focused test-only injections.
