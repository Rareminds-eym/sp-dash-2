# Zoho integration modules — existing services only

There is no standalone Zoho Worker deployment. The discovery, staging-authority,
approved-dispatch and reconciliation code in this directory is reusable local code.
It is connected through the existing runtime's queue/scheduled handlers and the
authenticated API. Enable flags default off. The supported candidate and job paths
now have synthetic local acceptance; candidate readiness independently checks both
database boundaries and installed runtime dependencies. Real provider/browser and
release acceptance remain required. See the current checkpoint at the end below.

## Overview counts

Overview shows separate Candidates and Job openings KPI rows for the selected
source: awaiting approval, approved, completed and staged exceptions. Counts come
from the complete database snapshot, independent of table pagination or filters.
`countsByConnectionAndModule` groups states by connection and module; existing
combined snapshot fields remain available to the Approvals queue and older callers.
If grouped counts are absent, the UI shows unavailable values rather than copying
combined counts or presenting an unverified zero.

## Implemented runtime wiring

### Recovering approved operations

Recovery throughput and phase reporting require
[the recovery migration](../../../skillpassport/supabase/migrations/20270225000000_zoho_recovery_throughput.sql).
A positively matched SSO `projection_pending` receipt now records a lease-fenced
`destination_phase` marker. This is observability only: it cannot authorize another
write or mark the operation completed. The progress partition adds **Syncing
application** so a confirmed account is not described as an unknown creation.
Legacy pending receipts acquire that marker during reconciliation. Overdue counts
warn about operations past their retry time or lease by ten minutes, independently
of terminal attention counts.

Scheduled recovery reserves up to 100 receipt reads and processes them directly,
three at a time, with a 15-second window for starting/awaiting reads. This prevents
receipt acknowledgement from sitting behind a large execution queue. Failed or
unstarted reads retain durable queue fallback; queue sends are chunked to at most
100 messages. Manual source recovery likewise checks up to 25 receipts immediately
and distinguishes checked receipts/confirmed completions from scheduled work.
New execution remains on the existing queue and retains every approval fence.

SSO projection recovery drains up to ten leased batches of ten references per run,
stopping between batches after 15 seconds, an incomplete batch, or a completely
failed publication batch. It does not increase the per-record retry budget and
does not send identity/profile data or emails on that queue.

Local service discovery also matters: the pinned SSO development toolchain is
Wrangler 4.151.1 with compatible Worker types. Older 4.120.1 Miniflare heartbeats
do not recreate deleted registry entries; the HTTP port may remain open while RPC
bindings report `Worker not found`. Start the existing SSO `dev:stack` using its
installed CLI so all companion services use that toolchain. Readiness requires a
working named service binding, not only a listening port.

Execution progress reads every saved operation for the selected source and record
type through the private `zoho_execution_progress` RPC. Apply
[the progress migration](../../../skillpassport/supabase/migrations/20270224000000_zoho_execution_progress.sql)
to the application database before deploying this panel. The local migration
catalog includes it. Counts are independent of the loaded history page and include
earlier revisions/runs: completed, queued, active processing, checking unknown
outcomes, waiting for retry, and needs attention form an exclusive partition.
Expired/exhausted details are subsets of attention and can overlap.

Only confirmed receipts advance the completion percentage. The panel refreshes
every 15 seconds while visible with pending work, backs off outages to 60 seconds,
retains previous counts with a stale-data warning, and stops polling when no
automatic work remains. Switching source/type discards the prior scope's response.
Reloading reads persisted database progress; no browser session state establishes
completion. Scheduling recovery is reported separately from execution progress.

The Approvals tab includes **Recover approved operations**, separately for candidates
and jobs. This authenticated, source-scoped command schedules at most 25 due retries
and 25 interrupted-operation receipt checks through the existing approved queue.
It never creates a new approval, resets attempts, extends expiry, or treats a missing
receipt as proof that an account was not created. Repeated delivery uses the same
operation IDs and remains protected by SQL claims and destination receipt idempotency.
Transport failures can safely be retried. A scheduling acknowledgement is not a
completion acknowledgement.

Queued/failed operations require an unexpired approval, fewer than eight attempts,
and a due retry time. Background retry selection also excludes expired approvals,
so expired rows cannot consume its first 25 recovery slots. Interrupted operations
remain receipt-only even after expiry or writer unavailability. No receipt means
the outcome remains unresolved and requires investigation; recovery does not invent
a safe-to-retry result. The history now distinguishes active processing, interrupted
operations, expiry, exhausted retries, queued work, and confirmed completion.

The overview's **Needs attention** count includes held records, failed executions,
and unresolved outcomes; it is not limited to source validation errors.

### Approve all staged candidates

The Candidate records toolbar offers **Approve all staged candidates**. It loads
every `pending_approval` candidate for the selected source, independently of table
filters and pagination. Held, rejected and previously approved records are excluded.
Loading uses the existing indexed, 50-record review-page API instead of one large
review-window response. Progress shows the number loaded and pages received. A
failed or stopped load resumes from its last successful timestamp/ID cursor.
Incomplete, duplicate or changed lists are refused before account checks begin;
the overall review limit remains 100,000 records. The list is frozen before account
checking, so new discoveries are not silently included in the decision.

Account checks run with three concurrent requests. The dialog lists eligible and
blocked candidates, provides searchable paged results, and requires explicit bulk
acknowledgement and a decision reason before any approvals are recorded. Confirming
once queues the eligible set through existing authenticated BFF decisions in batches
of up to 50. Each batch rechecks canonical state; unchanged hashes renew their review
expiry, while changed records remain staged for another review. Existing server
verification, audit evidence, ledger recovery and the no-email policy still apply.

Keep the page open while approvals are queued. Stop finishes in-flight requests and
prevents subsequent batches; queued approvals are retained. Continue resumes the
remaining frozen list. Transport failures retain the exact request ID and manifest
for idempotent retry. A definitive refusal requires a fresh review of the remaining
staged candidates. Completion is reported separately in execution history.

- The existing [sp-dash runtime](../../workers/sp-dash-worker.js) now has explicit
  environment-scoped Zoho queue routing and scheduled recovery. Existing course-upload
  and LTE handlers are preserved. Deploy through the existing [configuration](../../wrangler.toml).
- The restricted [staging handler](./discovery-authority.js) runs locally inside that existing
  trusted service, without a public route. It supplies only fixed staging commands to the [source reader](./discovery-consumer.js).
- The [approved coordinator](./approved-consumer.js) runs in that same existing runtime,
  with separate queue routing, enable flags and SQL claims. A discovery queue message
  cannot select execution mode or mint approval.
- Restricted entrypoints on the existing SSO deployment handle approver checks,
  signed human approval evidence and the disabled identity/Discover transaction.
  The existing auth-sync consumer now transports candidate operation references;
  SkillPassport projection writes/confirmation now exist locally; integrated verification
  and opportunity effects remain pending.

New queues/DLQs, migrations and narrow methods on existing services are permissible;
new Worker services, names, standalone configurations or deployments are not required.
All environment configuration remains explicit, and previews must not consume queues
or run recovery schedules against shared data.

## Boundaries and readiness

Shared runtime modules are not separate security principals. Removing a database key
from the reader's argument object does not isolate it from the hosting service's
credentials. Discovery storage now uses a separate expiring JWT for the `zoho_discovery`
PostgREST role, with grants only to seven fixed staging/recovery functions. SQL tests
exercise denied approval calls and operation updates. The host remains a trusted
component with privileged credentials for unrelated admin work; it is not isolated
from itself. Before canonical effects, implement independently verified human approval
and target-aware canonical validation. Audit inherited PUBLIC grants in the target
database as part of deployment preflight; the fixture does not model every legacy RPC.

Existing sp-dash and SSO runtimes contain mail bindings used by unrelated features.
Integration code must receive no mail capability and must enforce `emailPolicy=forbidden`
at each owning handler, outbox, projection and notification boundary. Do not remove
mail bindings used elsewhere or claim their mere absence proves zero email.

The API now checks local adapters for the actual existing-runtime consumers; no
standalone-service readiness binding is used. Background readiness requires enabled
flags, an allowed environment, the configured recovery cron, a valid reader credential,
provider configuration and queue producer. Execution additionally requires restricted
approver/destination contracts. Readiness is not live tenant or cryptographic token
validation: PostgREST validates the reader JWT on use. The candidate projection path
remains unverified end to end, and the job writer remains unimplemented, so account/job
approval remains unavailable.

## Retained local behavior

Saved-record discovery is explicit; drafts remain excluded and must be disclosed.
The regular reader caps a run at 500 pages of 20 records and reports incomplete
inventory at that limit. Bulk/delta/deletion capture is separate pending work.
SQL persists an eight-failure/24-hour budget, jittered backoff, Retry-After guidance,
read leases and credential-generation fencing across fresh queue deliveries.
OAuth renewal preserves uncertain canonical effects. Receipt reconciliation reserves
fair due-times and never infers permission to retry from a missing receipt. Existing
target IDs are frozen at approval and checked on completion.

## Local validation

Run `npx vitest run lib/zoho/__tests__` from sp-dash and `npm run test:zoho:sql`
from SkillPassport. SQL tests use synthetic disposable local databases and remove
them afterward. They neither install persistent migrations nor create real users/jobs.
Mock destinations and passing module tests do not establish end-to-end readiness,
tenant coverage or downstream zero-email behavior.

## Deployment configuration and verification

The existing Wrangler configuration declares separate discovery/approved queues and
DLQs for production/dev/QA and a two-minute recovery cron on the existing deployment.
Provision those queues/DLQs before deploying the changed configuration. All integration
enable flags default false. Previews disable background work and have no Zoho queue
bindings. Wrong-environment Zoho queues are retried, never sent to LTE processing.
No Worker service, queue, credential or persistent migration was created by local tests.

Apply the eight application migrations and four SSO authority/evidence/candidate/delivery migrations through
the normal release process. The discovery migration provisions a NOLOGIN/NOINHERIT
role and grants only the fixed staging entrypoints. A trusted project-compatible JWT
issuer must supply a signed expiring role token via `ZOHO_DISCOVERY_DB_TOKEN`; do not
put signing keys or tokens into the plan or source control. Configure the project anon
key via `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then rotate the reader token before expiry.
The runtime refuses a missing, malformed, expired or service-role reader token and
never substitutes the host's privileged key. Actual token signatures are checked by
PostgREST, so readiness alone does not prove database access or migration installation.

Local checks include actual discovery-to-staging module routing, disabled/preview
fencing, environment mismatch, malformed messages, recovery schedule, existing queue
routing and mail/account capability traps. A Wrangler dry run validates bundling and
configuration without deployment. Canonical writers, authenticated import E2E and
live no-email/tenant evidence remain pending; these checks must not be relabelled as
complete provisioning.

The existing SSO reader binding is configured per environment on its existing service;
release its entrypoint and authority/evidence migrations before the sp-dash binding is deployed.
The targeted SSO reader tests pass separately. OpenNext currently rejects the installed
Next.js 15.5.26 on support-policy grounds: a local override may diagnose bundle
compatibility, but it does not satisfy the normal framework release gate. No dependency
upgrade or support-policy bypass is added to deployment scripts/configuration here.

## Record recovery and access-token renewal

A page accounts for each record by staging it or retaining a durable deferred outcome.
An unresolved execution keeps its original approved snapshot and effect fence; unrelated
records and the page checkpoint can progress. The existing scheduler revisits waiting
changes and returns them to pending approval after execution reconciliation. It never
creates approval or retries an uncertain destination effect. The dashboard exposes
source-scoped deferred metadata separately from staged exceptions. Invalid source rows
require correction and another discovery read.

Deferred source snapshots expire after 30 days, and payloads are scrubbed on resolution
or expiry. Confirm that retention policy before rollout. Expired snapshots and changed
configuration require a fresh source read. Read leases last three minutes. Refresh
reservations last at most 45 seconds and are fenced by the read lease and credential
generation. A source 401 permits at most one coordinated refresh and one read retry;
invalid grants or repeated unauthorized responses stop for operator recovery.

The admin API requires explicit `is_blocked === false`. Null, missing and malformed
states fail closed. Shared-database environment ownership remains unresolved and is
explicitly deferred by the user; environment-named queues do not resolve that gate.

## Canonical human evidence

Approvals now require the browser-reviewed source hash, config revision and target in
addition to ID/revision. The API registers a metadata-only immutable manifest with the
existing restricted SSO authority using the signed human access token before local
approval/dispatch. SSO independently verifies that token and live platform authority;
the access token is never stored or queued. Replays cannot change intent or extend the
original 24-hour expiry. Dispatch also checks the matching canonical evidence.

This closes the service-role-only human-evidence gap, but canonical execution remains
unfinished: destination writers must independently check the live operation/lease,
validate reviewed canonical identity/entitlement diffs, bind the operation and source
linkage, and commit the effect/outbox/receipt atomically while rechecking evidence.
Null staged targets do not authorize unreviewed linking. SSO also requires live readback through the existing dashboard named execution
authority. Its fixed SQL reader checks the full processing claim and cannot mutate it.
A missing/denied/timed-out authority fails closed. The candidate core now binds the
approved static context and source revision to an atomic local receipt.
All destination readiness and enable flags remain fail-closed until those guarantees
and downstream projections/no-email verification are implemented.


## Disabled SSO candidate core

The existing SSO service now includes a flag-gated candidate transaction and receipt
reader. A supported new learner receives unverified identity, learner/product membership
and canonical free Discover access with an atomic source link/outbox/receipt. Supported
reviewed existing learners keep their current personal access and security/preferences;
unreviewed targets and unsupported context/entitlement cases are blocked. No signup,
learner-admission, email or session method is called. Receipts stay projection_pending.

The SSO provisioning and projection-delivery flags are false everywhere. The dashboard
now binds the existing SSO candidate entrypoint; that binding does not enable execution.
Capabilities return ready=false until application learner/entitlement projections,
version guards and independent postcondition confirmation exist. Follow sections 28–29
and 32 of the root plan for exact supported cases and remaining release gates.
The full integration is not complete. Environment isolation remains user-deferred.


## Latest audit corrections

The canonical candidate transaction now checks and locks active organization-level
SkillPassport access before creating a new identity. Its SQL fixtures use the actual
claim resolver and verify both unavailable-context rollback and enabled product claims.
Malformed source IDs are null/code diagnostic outcomes; the private staging contract
also rejects unsafe IDs so healthy rows can progress through PostgreSQL JSON/page commit.

Exact decisions recover through a new service-only immutable-batch lookup before current
record/readiness checks. Recoveries never renew evidence, create operations or republish
queue messages. Changed requests conflict, new decisions retain all approval checks, and
the dashboard identifies recovered intent separately from current execution outcomes.
See section 31 of the root plan for acceptance evidence and remaining release gates.

## Disabled projection delivery foundation

The existing scheduler can independently recover already-committed candidate outbox
entries through the SSO candidate entrypoint. Separate default-off delivery flags and
the existing background/environment/preview/cron guards apply. Pausing new execution
does not itself prevent repair of a committed effect. Durable SQL reservations use
leases, SKIP LOCKED, ten-reference batches, backoff and an eight-publication budget.
Published queue messages are operation/source-hash references with emailPolicy=forbidden;
publication never marks the receipt completed.

The existing auth-sync consumer sends those references only to the configured fixed
SkillPassport projection endpoint. Every projection failure, including unexpected
TypeErrors, is retained for retry. Dead letters are acknowledged only after private
reference-only archival succeeds. Missing storage retries the message. There is no new
Worker or queue service, and no profile/subscription payload is placed on this queue.

SSO provides a bounded authoritative current snapshot, including current paid and
cancelled subscription state. Its exact JSON text and hash must survive transport
without parse/stringify re-encoding. The supported snapshot scope is 1–25 personal
SkillPassport subscription rows, including history; other cases fail closed.

The confirmation entrypoint requires an independent application postcondition reader
before the private canonical completion transition. That reader and the SkillPassport
projection SQL/HTTP endpoint now exist locally. Unit HTTP fixtures and the DB-owner
canonical-transition fixture are not end-to-end postcondition evidence. Readiness
therefore remains false. See sections 32 and 35 of the root plan for verification and next work.

## D1–D3 audit corrections

Existing-account provisioning now requires usable SkillPassport access on the same
active learner membership and holds the contributing rows through commit. Missing
membership product, disabled organization product and product access on a different
non-learner membership are denied without connector effects. Real two-session SQL
checks confirm that product, membership and role revocation serialize with commit.

The API admin client, queue runtime and live execution authority now share the
[application database resolver](../skillpassport-db-config.js): SkillPassport-specific
settings take precedence, followed by the public application URL and generic fallback.
This does not change the deferred environment ownership issue.

The existing auth-sync projection transport enforces an origin-only destination and
constructs its fixed endpoint with the URL API; path/query/fragment/user-info overrides
are rejected before sending credentials. Section 34 of the root plan records permanent
regression evidence. End-to-end projection and readiness remain unfinished.

## Application projection and readback

The existing SkillPassport Pages deployment now has a default-off projection route
and a binding to the existing SSO candidate entrypoint. It accepts only authenticated
bounded references, fetches canonical snapshot text independently and applies it through
one service-only transaction. New independent users/learners, shadows, plan/subscription
mirrors and receipts commit together. Existing profiles/preferences remain unchanged;
newer/equal-conflicting cache versions and deleted-profile tombstones fail closed.

New imported profiles receive explicit false notification settings. Section 39 of the
root plan records the replacement of the original RLS proposal with server-only
filtered readers and actual-grant checks before private writes. Inherited views/RPCs, service-role API/search/export
visibility and provider automation checks remain separate release gates; RLS alone does not prove
application-wide privacy or zero email. The named dashboard receipt reader independently
checks current app postconditions before SSO completion. Section 35 of the root plan
records the tests and remaining integrated two-database/race acceptance work. All flags
remain off; candidate capabilities remain ready=false.

Section 36 of the root plan preserves two audit findings: an inherited owner-run
view exposes imported profile name/email despite base-table RLS, and generic sync's
derived plan label can conflict with the new projection at the same canonical version.
Section 37 records the historical caller-RLS attempt, superseded by sections 38–39.
Only a derived-label difference may still be reconciled at an otherwise identical
canonical version; that correction remains independent of privacy enforcement. Permanent SQL tests and a real generic-handler DTO contract pass. Other
inherited readers and service-role APIs still require privacy acceptance; the corrected
view is not proof of application-wide privacy. All approval/readiness gates remain off.


## No-RLS audit correction

Section 38 of the [root plan](../../../ZOHO_RECRUIT_INTEGRATION_PLAN.md) supersedes the
RLS-based privacy completion claim above. The user does not use Supabase RLS. A
local disposable probe confirms that disabling RLS leaves imported learners readable
through both the base table and the caller-invoker view. Existing service-role recruiter
list/detail/copilot readers also lack a private-import visibility filter; contact masking
does not make the profile private. This is not a claim that deployed imports exist.

Replace the Zoho-specific RLS dependency with verified SSO/server authorization and a
private data boundary that also covers direct table/view/RPC access where exposed.
Do not globally remove existing policies, and do not treat internal database grants as
RLS. The label-only compatibility fix remains valid. Full no-RLS reader acceptance,
zero-email evidence and integrated E2E remain pending; all flags/readiness remain off.


## Explicit no-RLS correction implemented locally

Section 39 of the [root plan](../../../ZOHO_RECRUIT_INTEGRATION_PLAN.md) supersedes
older RLS completion descriptions. Local Zoho migrations now omit RLS enablement,
private-profile policies and the Supabase subject helper. Existing unrelated policies
and grants are untouched. Database grants still protect integration internals.

Recruiter lists/details, copilot, pipeline and copied candidate activity use server-only
filtered views; semantic matching filters before ranking and unlock refuses private
candidates before charging. CHECK OPTION protects writes through those surfaces.
Private application projection/confirmation and new SSO identity creation check actual
browser grants, dependent views and callable privileged routines, and refuse unsafe
storage with 42501. Existing legacy browser permissions can intentionally block this
check; no blanket revocation or client migration was applied.

Focused reader/permission/endpoint tests, disposable no-RLS SQL/transaction/race tests
and migration rules pass. Full authenticated owner/admin and embedded PostgREST HTTP
acceptance and the remaining rollout gates are still required. Keep every enable flag
false and capabilities ready=false; none of these checks enables import or sends email.


## First browser-reader migration

Section 40 of the [root plan](../../../ZOHO_RECRUIT_INTEGRATION_PLAN.md) records
owner-scoped assessment lookups, private-filtered public/by-email reads and the new
academic roster API on the existing Pages deployment. The roster checks active mirrored
membership, organization type and current-year teaching assignments, with bounded
keyset pagination. No private owner access is granted through discovery views.

The scoped browser AST inventory now reports zero literal references to the four
protected relations. Thirty-eight imported anonymous-client calls to other assessment,
adaptive and notification relations remain, plus separately labelled unresolved legacy
references. Read-only local catalogs confirm legacy browser permissions and callable
routines still need review/closure. These checks do not change persistent permissions
or prove deployed access controls. Full cleanup and E2E remain pending; all flags stay off.


## Historical audit: interview privacy finding (corrected below)

Section 41 of the [root plan](../../../ZOHO_RECRUIT_INTEGRATION_PLAN.md) records a
reproduced key mismatch: interviews references learners.user_id, but its new filtered
view compares learners.id. A disposable test with the actual FK returned copied private
interview name/email through that view. This is not fixed yet; earlier pipeline/core
fixtures did not establish interview coverage. Keep imports/readiness off.

A mounted-hook owner-switch defect was also reproduced, but the exported legacy hook
has no current invocation found in non-test source; it is not reported as an active-page
leak. Refreshed browser counts remain zero scoped protected references and 38 imported
anonymous calls. These counts and harmless routine grants are not themselves evidence
of a confidentiality exploit. Permission cleanup and full integration acceptance remain open.


## Interview and latent hook corrections

Section 42 of the [root plan](../../../ZOHO_RECRUIT_INTEGRATION_PLAN.md) records the
local correction of section 41's interview-key defect: the filtered view now compares
the interview user UUID to learners.user_id. SQL fixtures load the real interview
definition and actual activity learner FKs, and test public/private reads plus private
insert/reassignment denial. The exported legacy assessment hook also resets by owner
generation and fences stale async state/results, including sign-out and unmount.
Its active-page reachability was not established; the correction remains a module fix.

100 focused tests, both projection contract tests and migration rules pass. Wider
legacy grant/API/E2E/no-email and release gates remain open; all flags/readiness stay
off. These local corrections do not install persistent migrations or send email.


## Authenticated assessment record readers

Section 43 of the [root plan](../../../ZOHO_RECRUIT_INTEGRATION_PLAN.md) records the
next browser-access migration: history, attempt/results, responses, latest/adaptive
results and eligibility dates now use owner-scoped authenticated SkillPassport Pages
reads. Foreign parents fail before child reads, linked data checks learner ownership,
and paginated clients reject incomplete/repeating continuations. Existing export shapes
and history ordering are retained. No new Worker or RLS dependency was introduced.

112 focused tests and local Pages compilation pass. Full repository typing/CI and real
authenticated HTTP/PostgREST acceptance remain separate gates. The static inventory is
now 30 imported anonymous SDK call sites, down from 38, with zero scoped protected
references; legacy grants and remaining read/write migrations are still open. All
integration flags/readiness remain off and persistent migrations remain unapplied.


## Historical alternate-reader audit (corrected below)

Section 44 of the [root plan](../../../ZOHO_RECRUIT_INTEGRATION_PLAN.md) reproduces an
unfixed legacy learner-profile action boundary: an ordinary learner context can request
another learner's assessment or raw private profile without owner/organization checks.
The assessment barrel's active latest-result helper still uses that action, and also
has completion-filter/user-alias contract gaps. The new owner-scoped records route
denies the same foreign reference; its local success does not close alternate readers.

Synthetic probes confirm handler/helper behavior, not a deployed incident or a fix.
The old result reader's learner-ID/subject fallback is a conditional hardening gap;
no real UUID collision is established. Static counts remain 30 imported anonymous calls
plus 38 unresolved/legacy calls, not 68 leaks. Full API authorization and the existing
integration/release gates remain open; every integration enable/readiness flag stays off.


## Alternate-reader corrections implemented locally

Section 45 of the [root plan](../../../ZOHO_RECRUIT_INTEGRATION_PLAN.md) supersedes
section 44's open H1/H2 status. Every legacy profile action now passes an explicit
server capability gate: owner binding, live academic admin scope, filtered non-owner
profiles, SQL-scoped lists/counts, guarded updates/enrollment and conversation identity
checks. Unsupported capabilities fail closed. Educator rosters continue through their
separate assignment-scoped API; generic educator roles do not gain broad admin reads.

The actual public assessment helper now resolves aliases through that authorized API,
requests completed-only results and propagates errors. Five assessment handlers remove
the learner-ID/subject fallback. Permanent ownership, private/admin, mutation and helper
regressions supplement the prior tests; local Pages compilation passes. Full repository
typing, real signed HTTP/PostgREST and wider integration/no-email acceptance remain open.
The filtered-view/private-state migrations must precede these reader deployments.
All flags/readiness remain off, migrations remain local/unapplied, and no new Worker,
provider operation, real account/job or email was created.


## Atomic owner progress and read-only resume

Section 46 of the [root plan](../../../ZOHO_RECRUIT_INTEGRATION_PLAN.md) records the
next browser-access migration. Authenticated progress/response/abandon handlers share
a service-only SQL transaction that locks ownership and the attempt, merges maps,
protects terminal states and checks adaptive-session ownership. Resume readers are
read-only and propagate storage failures rather than silently abandoning/reopening
attempts. No RLS or new Worker service is introduced.

256 focused tests, the disposable no-RLS SQL/concurrent-merge suite, Pages compilation
and all 171 migration filename/history checks pass. Full typing, signed HTTP and wider
integration/no-email acceptance remain separate gates. Static imported anonymous calls
are down from 30 to 21; unresolved legacy calls remain separately classified.

The new assessment owner-progress migration must precede these handler deployments.
Nine application feature migrations (eight Zoho and one assessment) plus four SSO
migrations remain local/unapplied. All integration flags/readiness remain off; this work
does not import real accounts/jobs, call providers or send email.

## Follow-up audit: three open assessment findings

Section 47 of the [root plan](../../../ZOHO_RECRUIT_INTEGRATION_PLAN.md) records
reproduced issues in the active answer-sync queue, legacy optional-null progress
compatibility, and the alternate adaptive-link endpoint's early metadata response.
They remain unfixed. Five temporary probes plus the existing 30 progress-handler
tests passed by confirming current behavior; this is evidence of the findings, not
acceptance. The probes were removed. The null-contract finding has bounded legacy
reach; the link probe establishes metadata disclosure, not a foreign write.

Earlier SQL merge evidence remains valid for that transaction. Anonymous call counts
are not leak counts. Full integration, no-email and release gates remain open, all
enable flags stay off, and B1 remains deferred. No persistent data or deployment was
changed by the audit.

## Local corrections for the follow-up audit

Section 48 of the [root plan](../../../ZOHO_RECRUIT_INTEGRATION_PLAN.md) supersedes
the three open findings above. The active assessment sync queue now acknowledges
only sent answer versions and drains newer batches; legacy optional null progress
fields preserve stored values; the alternate adaptive-link route now uses the same
owner-locked transaction instead of direct reads/writes. Permanent hook, transport
and route regressions and expanded disposable SQL link/race coverage verify these
local corrections. Existing completed links remain immutable; replacement returns
409 instead of skipped success. Terminal attempts reject linking.

The owner-progress migration must precede adaptive-link deployment too. All feature
migrations remain local/unapplied, full typing and wider release/no-email acceptance
remain open, all integration enable flags remain off, and B1 remains deferred.
No new Worker, RLS dependency, live import, email or deployment was introduced.

## Individual-response writer migration

Section 49 of the [root plan](../../../ZOHO_RECRUIT_INTEGRATION_PLAN.md) moves legacy
and modern individual-answer saves through one authenticated owner-locked response
transaction. Foreign/missing attempts are indistinguishable, terminal attempts reject
writes, and client correctness is never stored. Raw answers remain untrusted input;
question assignment, trusted grading and other assessment writers remain open.

317 focused tests, the expanded disposable no-RLS SQL suite (including concurrent
response upserts and a save/abandonment race), Pages compilation and all 172 migration
filename/history checks pass. Imported anonymous SDK calls drop from 21 to 20; these
counts are inventories, not confirmed leaks. Full typing and broader acceptance
remain open. The owner-response migration must precede handler deployment.

Ten application feature migrations and four SSO migrations remain local/unapplied.
Enable/readiness flags stay off; B1 remains deferred. No live import, email, new Worker,
RLS dependency, persistent migration, commit, push or deployment was introduced.

## Follow-up finalization audit

Section 50 of the [root plan](../../../ZOHO_RECRUIT_INTEGRATION_PLAN.md) reproduces
three defects in the still-unfinished results/submission scope: missing result-write
ownership, terminal-attempt submission, and a success response after partial result/
attempt finalization. A fourth, bounded issue affects the new response path: accepted
uppercase UUIDs mismatch PostgreSQL's lowercase receipt. These findings remain open.

Five temporary probes plus 35 existing response/transport checks passed by verifying
current behavior; temporary probes were removed. The disposable no-RLS SQL ownership/
race suite also passes, so the raw-response transaction's protections remain valid.
No live incident, zero-score regression, foreign raw-response save or clean full CI
was established. Full integration/release/no-email gates remain open, migrations
remain unapplied, enable flags stay off, and B1 stays deferred.

## Local finalization and UUID corrections

Section 51 of the [root plan](../../../ZOHO_RECRUIT_INTEGRATION_PLAN.md) supersedes
the four open section 50 findings. Submission and report saving now share a service-only
owner-locked transaction that derives canonical context, rejects abandoned attempts,
preserves unchanged completed retries and permits a submitted report placeholder to
be filled once. Result/attempt/trigger writes commit together; partial failure is never
acknowledged as success. Bound adaptive sessions/results are checked independently.
Legacy owner-supplied reports remain distinct from trusted grading evidence.

Response/progress transport and server handlers now normalize UUID case consistently.
352 focused tests, disposable SQL ownership/rollback/race checks, Pages compilation
and all 173 migration filename/history checks pass. Full typing and broader acceptance
remain open. Deploy the finalization migration, including canonical nullable result
streams, before these handler changes. Eleven application feature migrations and four
SSO migrations remain local/unapplied; enable flags stay off and B1 stays deferred.
No live import, email, new Worker, RLS dependency, commit, push or deployment occurred.

## Assessment creation/start migration

Section 52 of the [root plan](../../../ZOHO_RECRUIT_INTEGRATION_PLAN.md) moves browser
attempt creation and modern start to one owner-serialized server transaction. Active
stream grade is authoritative; modern retries reuse matching progress without resets,
while explicit legacy creation requires resume/abandon if an attempt is already open.
Canonical question loading and expired zero-timer preservation have regression coverage.

386 focused tests, disposable SQL creation/mutation/finalization races, Pages compilation
and all 174 migration filename/history checks pass. Imported anonymous SDK calls fall
from 20 to 19; full typing, wider privacy migration and integrated acceptance remain
open. Apply the owner-start migration before the new creation/modern start handlers.
Twelve application feature migrations and four SSO migrations remain local/unapplied.
Enable flags stay off, B1 stays deferred, and no live import, email, new Worker, RLS
dependency, commit, push or deployment occurred.

## Start/resume client integration audit

Section 53 of the [root plan](../../../ZOHO_RECRUIT_INTEGRATION_PLAN.md) records three
open integration gaps: the public start helper drops reused attempt state, the active
page retains requested rather than canonical grade, and fresh store initialization
can retain an older attempt's answers/position/adaptive state. Server-side ownership,
creation serialization and retained reuse state remain valid; complete page hydration
and attempt-state isolation still need implementation and integration tests.

Three temporary API/real-store probes and 31 existing handler tests verified current
behavior; probes were removed. Earlier localStorage persistence wording is corrected:
the inspected store is in-memory and does not use persist middleware. No deployed
cross-account incident, SQL answer erasure or clean full CI was established. Full
integration/release gates remain open, flags stay off and B1 stays deferred.


## Active assessment start/resume corrections

Section 54 of the [root plan](../../../ZOHO_RECRUIT_INTEGRATION_PLAN.md) supersedes the
three open client findings in section 53: canonical grade/nullable stream are retained,
reused starts enter validated resume hydration, and fresh initialization clears old
answers/navigation/adaptive/results state. Owner/generation fences prevent late local
start/resume/AI/adaptive/sync results from repopulating a replaced session. Saved zero
timers and section timings are preserved, and restored answers are not resubmitted as
new edits. The store remains in-memory; no durable browser recovery is claimed.

414 tests across 22 files pass, including rendered-page and deferred-response cases;
Pages Functions compile. This is local acceptance for these corrections, not clean
full CI or integrated provider/two-database/no-email E2E acceptance. Wider candidate
matching/diffs, job publishing, lifecycle/privacy and rollout work remain pending.
Flags remain off, migrations remain unapplied and B1 remains deferred. No live import,
email, new Worker, RLS dependency, commit/push or deployment occurred.

The final TypeScript comparison adds no diagnostics to the previous baseline; existing
repository errors still fail the full check. The AST-only graph refresh completed with
22,002 nodes and 40,288 edges. See section 54 for the exact evidence and remaining gates.


## Candidate review and job publishing implementation checkpoint

Section 55 of the [root plan](../../../ZOHO_RECRUIT_INTEGRATION_PLAN.md) records new
canonical candidate matching/review, approval-hash binding and an existing-runtime job
publisher. The dashboard includes explicit account/access acknowledgement and reviewed
job status/employment policy controls. Policy changes require fresh discovery/approval;
unknown mappings and changed database effects stay blocked. No-email trigger review is
an operator gate, not proof that every external dependency is email-free.

New module, SQL/concurrency and two-database tests are written but not yet executed:
agent test escalation returned `rejected by user`; parent verification permission is
pending. Earlier passing counts must not be reused as evidence for these new changes.
Candidate capabilities remain deliberately unavailable pending the actual release
checks. Fourteen application and five SSO feature migrations remain unapplied; flags
remain off. Broader backfill/deletion/privacy/activation/legacy/CI/rollout gates remain.

Receipt recovery is separated from write readiness: paused modules can reconcile
committed receipts without approver/write-capability probes, while internal background,
environment and preview gates still control recovery. New effects are queued only for
writable modules. Corresponding dispatcher/runtime tests are written and pending.


## Current audit status

Section 56 of the [root plan](../../../ZOHO_RECRUIT_INTEGRATION_PLAN.md) supersedes the
pending-check status above. 187 dashboard and 50 SSO module tests plus job/control-plane
SQL suites pass. The unmodified candidate migration and two-database setup fail on an
SSO CASE-expression syntax error. Separate probes reproduce a missing job-default drift
gate, deterministic job rejections stranded as unknown outcomes, and candidate version
readiness gaps for eligible NULL-version catalog data. These four findings remain open.
Approval response-loss replay, digest-bound canonical matches and ordinary timestamp
update triggers were checked and excluded as false positives. Existing missing-profile,
activation/privacy/lifecycle/CI and rollout gates remain; flags stay off and migrations
remain unapplied. No live effect, email, deployment or production source fix occurred.


## Four audit findings corrected locally

Section 57 of the [root plan](../../../ZOHO_RECRUIT_INTEGRATION_PLAN.md) supersedes the
four open findings above. The actual SSO migration installs; canonical versions are checked
before approval/commit; executable-catalog review includes defaults/rules/non-public
helpers and denies drift; durable SQL no-effect proofs return anticipated job rejections
to fresh review, including receipt recovery after timeout/expiry. Generic failures and
missing receipts remain ambiguous.

259 tests across 23 files and candidate/job/control SQL suites pass. The dashboard page
bundles and Pages Functions compile; migration validation passes for 179 SQL files.
Existing Functions typing errors add no new diagnostics. Full CI and production/provider/
no-email/activation/lifecycle/privacy acceptance remain open; these local fixes do not
make the entire integration complete. Fifteen application/five SSO feature migrations
and two upgrade seeds remain unapplied. Flags remain off; no live effects or deployment.

SSO bundle dry run and all three AST-only graph refreshes also complete successfully.
The schema-only rule correction places legacy approval invalidation in matching dev/
production upgrade seeds; runtime guards already reject those approvals before seeds.
No persistent migration or seed was executed by these local checks.

## Current local acceptance checkpoint

Section 58 of the [root plan](../../../ZOHO_RECRUIT_INTEGRATION_PLAN.md) supersedes the
earlier hardcoded-readiness/activation/missing-mirror statements. Runtime capabilities
now require positive SSO and independent application schema/privacy probes, queue and
authority dependencies. Execution checks again before the canonical transaction. No
readiness probe creates an identity, sends a message, or returns candidate data.

Existing verified Google sign-in activates the same imported identity without email.
Missing mirrors for supported canonical learners are created privately while preserving
existing identity, entitlement and profile state. Deleted/conflicting contexts remain
blocked. Source discovery supports durable checkpoints, clean overlapping delta scans
and daily reconciliation through the existing schedule.

The dashboard includes source suppression, review retention, cleanup, pause/resume and
disconnect. Suppression/expiry never silently renew an approval. Unknown effects retain
their reconciliation evidence. Deferred payload copies follow the same retention policy.
The code profile’s `privacyCleanup` setting permits the dedicated scheduled cleanup path independently of new import permission; manual operator cleanup and deferred-recovery retention enforcement remain separate. The retired environment variable does not control these actions;
Deployment profiles default that scheduled path to false; the local profile enables it. Disconnect removes local credentials, not provider access.

Run `npm run test:zoho:local` from [SkillPassport](../../../skillpassport) for synthetic
acceptance. See the [local test guide](../../../ZOHO_LOCAL_TESTING.md). The module and
two-database suites pass, along with the SQL suites; the final deferred-retention SQL
check also passes. Builds cover dashboard/API bundles, Pages Functions and SSO dry run.
These paragraphs record the earlier implementation audit, not current rollout readiness.
Current behavior and validation are described in the dated operator-page audit below.
No new Worker or RLS was added.

## Historical subsequent audit — three findings

Section 59 of the [root plan](../../../ZOHO_RECRUIT_INTEGRATION_PLAN.md) records reproduced
gaps missed by the earlier suite: later imported OAuth sign-in can replay generic
membership sync and create an unmarked learner; capture-time-expired reviews can still
be approved before cleanup; and fresh staging can retain historical completed-operation
payload copies beyond retention. Temporary unit/real-database probes reproduce them;
they are not fixed by that evidence. Temporary repository probes were removed and
production source remains unchanged. First provider activation, fail-closed readiness
and preservation of unresolved recovery evidence were checked and are not new defects.

## Audit corrections validated locally

Section 60 of the [root plan](../../../ZOHO_RECRUIT_INTEGRATION_PLAN.md) supersedes the
three open findings above. Durable SSO provenance controls later OAuth/password recovery;
application generic user/membership replay consults canonical and local private/tombstone
policy. Capture-time expiry is enforced at preview, approval, claim and live authority;
leases cannot extend payload TTL. Safe historical operation copies expire by their own
capture/approval timestamps while fresh staged data and unknown effects survive.

396 tests (337 Zoho/application cases plus 59 existing sync compatibility cases) and all
SQL suites pass. Migrations must precede bundles, and the existing candidate-source
binding must retain its subject-policy method during pauses. Flags stay off and all
feature migrations/seeds remain unapplied. Full CI and the broader rollout gates remain.


## Configuration ownership (4 November 2026)

Use [config.js](./config.js) to maintain the dashboard's immutable Zoho profiles,
callback URLs, queue identity, processing policy and transport defaults. SSO owns
its provisioning/projection profile in [zoho-config.ts](../../../sso-worker/src/lib/zoho-config.ts);
SkillPassport owns its receiver profile in [zoho-config.ts](../../../skillpassport/functions/lib/zoho-config.ts).
These server modules contain no credentials and must not enter browser bundles.

All Zoho-specific nonsecret switches now come from code. Old environment flags,
preview/queue identity, callback and cron variables cannot override profiles.
Existing platform identity and local loopback database wiring select the profile;
remote profiles stay disabled and their callbacks remain unset until the actual
origins are supplied. Local preparation selects the disabled review profile;
the enable command verifies dependency wiring before activating the local profile.
Changing a profile requires a reviewed code change and rebuild/restart.

See [ENVIRONMENT.md](./ENVIRONMENT.md) for the six remaining credential/key names,
shared infrastructure settings, bindings and retired names. Secrets, keyring
rotation, live authority, exact approvals and no-email enforcement retain their
existing independent validators. Source quotas, retention, mappings and pause
controls remain database-backed operator settings. SQL retains durable lease,
transactional and quota enforcement.

Source controls and their consumer share processing readiness; the background
gate also fences nested runtime adapters. Existing queue/service/R2 resources and
recovery schedules remain in Wrangler. No new worker or migration is required.

After changing workspace tooling, synchronize the versioned copies in
SkillPassport's `workspace-support/zoho/` directory. The read-only installer should
report zero missing or conflicting files in the configured workspace.

## Dynamic plan detection and source allocation

`source-license.js` reads Recruit's organization `license_details.plan_type` and
`license_details.no_of_users` after verifying the exact source organization ID.
Verified live India bundle responses omit `plan_type` and instead return
`paid_type: "Zoho One"` and `subscription: "Zoho One"`. This alternative requires
`paid: true` and `trial: false`; conflicting edition fields, malformed flags and
trial-only labels never grant a paid estimate. Licensed totals use `no_of_users`,
not the `$users.used` count. `trial_type` and support-plan labels are not editions.
OAuth completion reuses its already verified organization response. The existing
source-operations scheduler and discovery queue refresh metadata every 24 hours;
no new worker, secret or OAuth scope is introduced.

Apply SkillPassport migration `20270220000000_zoho_dynamic_source_allocation.sql`
before releasing this code. Existing quota rows remain manual overrides. New quota
rows default to automatic allocation: 20% of the documented base allowance,
excluding add-ons, with concurrency at half the documented primary limit, capped
at five. The percentage is configurable from 1–100 in Advanced → Shared API budget.
Saving the existing budget/concurrency fields selects manual mode. Metadata
refresh never replaces a manual override or resets rolling usage/provider cooldown.

The UI shows detected plan, licensed users, estimate, freshness and connector
usage. These are not provider-wide remaining credits: connector read costs remain
conservative and other applications' consumption is unknown. Unsupported plans,
invalid user counts or observations older than 24 hours grant no paid estimate;
automatic requests fall back to at most 1000 units and two concurrent calls, while
preserving lower allocations. A refreshed downgrade applies on the next reservation.
Refresh failure backs off without fabricating plan data. Metadata requests use the
same budget, so an exhausted manual cap must replenish or be explicitly changed
before an already connected legacy source can first detect its plan.

Refresh leases are shared per region/organization and fenced by connection and
credential generation. Provider responses cannot change source identity. Private
RPCs remain service-only; no RLS policy or browser database access is introduced.

## Operator-page audit — 2026-11-05

The settings dialog and advanced operations mount their panels only when opened.
Job policy reads return a fingerprint, object count and counts by kind; definitions
are fetched ten at a time, with explicit truncation notices. The complete catalog
remains the server-side execution boundary. Catalog names use text throughout and
fingerprint ordering is deterministic. Existing job policy attestations must be
reviewed again after the new DDL; source approval/configuration fences still apply.

Long discovery cooldowns check about once a minute while the tab is visible;
active discovery checks about every three seconds. Failures back off to a maximum
of two minutes. A conditional record-window read revalidates every loaded record
and returns no payload rows when the window has not changed. State changes,
redaction and records leaving filters still invalidate affected selections.

Manual global cleanup requires a separate confirmation and reason. Its service-only
transaction stores the authenticated actor, a reason hash and result counts in
`zoho_payload_cleanup_audit`; automated retention enforcement remains independent.
No email is introduced by these actions.

Run `npm run test:zoho`, `npm run test:zoho-ui` and `npm run test:zoho-scripts`
from this repository. CI runs these suites independently of sibling repositories.
UI suites run sequentially with a 512 MB heap per process. LOW-8 (migration to the
shared auth packages) is explicitly excluded; neither auth package was added.
The audit migration is applied to the local SkillPassport DB only. Deployment and
remote database changes remain outside this work.


### Retry visibility follow-up — 2026-11-05

Advanced bulk/deletion polling follows persisted next-attempt timestamps: runnable
work checks about every five seconds, near retries every fifteen seconds, long waits
once a minute. Outages back off up to two minutes. This changes UI checks only, not
source scheduling. OAuth callback authority/refresh outages show temporary service
unavailability rather than claiming session expiry.

The shared quota snapshot reports local remaining units, the next usage expiry,
and earliest budget/cooldown-compatible three-unit read. Concurrent leases, token
refreshes, other work and scheduling can still postpone execution. An allocation
below three units explicitly reports that a read cannot fit. These read-only
estimates exclude provider-wide remaining credits and never reset usage/cooldowns.
Midnight, restarting discovery and pausing do not reset the rolling 24-hour ledger.
New scan record counts are independent of usage shared across scans and record types.

Migration `20270222000000_zoho_retry_visibility.sql` is applied locally only.


### Large imports: bounded network batching

Discovery uses Zoho Recruit's documented maximum of 200 records per request for
new candidate scans. Job scans use 20 because full descriptions are large. Both
conversion streams share the persisted `zoho_discovery_runs.page_size`; a commit
contains at most twice that size. Existing scans/checkpoint continuations preserve
their original page size. A legacy worker cannot claim a run using larger pages.
Provider responses retain a 1 MB limit except allowlisted Job_Openings collection
GETs, which allow 3 MB for full descriptions. Only private staging commits allow
8 MB to carry both bounded streams; other staging commands retain 1 MB. Provider quota reservations, cooldowns and explicit approvals are unchanged.

Bulk account reviews use one authenticated BFF request per ten candidates, with at
most five independent canonical checks in flight. The request shares its source
and staging reads. Each payload freshness check and canonical review still runs
independently. Approval rechecks share staging reads across the selected fifty
records but independently verify every canonical review hash before recording
human evidence. Source changes/outages stop the batch; record conflicts are
reported as exclusions. Lost approval responses replay the original request ID.

Queue invocations coalesce destination readiness probes for at most five seconds.
This cache exists only within that invocation. Live approver, approval evidence,
lease and destination checks still run for each operation. Candidate creation and
job publication remain independent idempotent transactions with their own receipts.

Projection publication sends ten immutable references in one queue batch and
acknowledges them through one private SQL batch. Every acknowledgement retains its
original operation/lease/expiry fence. An ambiguous batch send does not trigger
individual fallback sends. Queue acceptance never means application completion;
private projection proof is still required for each record. Legacy adapters that
only implement `send` retain the individual transport path.

Request-count regressions cover these reductions (excluding OAuth refresh,
metadata retries, failures and final short/empty pages):

| Stage | Previous | Current |
| --- | --- | --- |
| Candidate discovery per full stream page | 10 records/request | 200 records/request |
| Job discovery per full stream page | 10 records/request | 20 records/request |
| Browser reviews for 123 candidates, initial + renewal | 246 requests | 26 requests |
| Staging metadata reads for 50 approval-time checks | 100 reads | 2 reads |
| Publication of 100 candidate projections | 210 calls: reserve + send + acknowledgement | 30 calls: 10 reservations + 10 queue batches + 10 SQL batches |

Apply the application migration
[`20270226000000_zoho_discovery_batch_pages.sql`](../../../skillpassport/supabase/migrations/20270226000000_zoho_discovery_batch_pages.sql)
and the canonical migration
[`20270226010000_zoho_publication_batch.sql`](../../../sso-worker/supabase/migrations/20270226010000_zoho_publication_batch.sql)
before deploying the new services. Both are included in the local migration catalog.
Only the local databases were migrated during this change. The pagination SQL
fixture stages 400 synthetic candidates, tests legacy and large-page checkpoint
continuations, mixed workers, pause controls, oversized pages and private grants.


### Polling and response-budget follow-up

During discovery, background refresh reads the summary and shared run progress.
It revalidates the record window only while a record tab is visible. Execution
and deferred histories refresh while visible or while their known work is pending;
fast discovery ticks throttle these secondary reads to fifteen seconds. Selecting
a tab refreshes its content immediately. Explicit status refresh and mutation
follow-ups retain complete revalidation. Authority failures still stop request
fan-out and trigger backoff; hidden documents and overlapping ticks are skipped.
Source-wide approved/processing/reconciliation totals keep progress polling alive
even when the first twenty execution-history rows are already completed.

Full-size Unicode job tests exercise both twenty-record streams, including a
normalized commit above the former 4 MB staging limit. Streaming reads are
cancelled above the 3 MB job limit, and OAuth, candidates, metadata, non-GET and
untrusted-host requests retain the smaller budget. No checkpoint geometry or
approval/receipt behavior changes in this follow-up.

The database staging budget is 128 KB for jobs and remains 64 KB for candidates.
The additive `20270227000000_zoho_job_payload_budget.sql` migration updates only
the inner size guard, preserving publisher policy and the outer privacy/retention
fences. Its SQL fixture stages forty full-size Unicode jobs, checks stable
revisions, retains mapping blockers and rejects oversized jobs/candidates.

### Durable incremental synchronization

Integration settings → Synchronization configures candidates and job openings independently:

- Automatic checks default to 15 minutes after the first manually started discovery. Disabling automation stops new scheduled scans; use Pause/Stop for an active scan.
- Full reconciliation defaults to seven days, capped by source payload retention. Delta scans replay a ten-minute overlap from the last durably captured scan start. Known IDs may be fetched again when modified; unchanged normalized data preserves the existing revision and approval.
- Capture completion is separate from approval/execution. Normalized deferred proposals remain recoverable without invalidating the entire baseline. Schema-invalid rows prevent checkpoint advancement. Counts distinguish new, changed, unchanged and suppressed records; deferred work is shown separately.
- The first baseline prefers Bulk Read when the existing encrypted private artifact store, source-operation runtime and OAuth configuration are available. REST is the fallback. A successful bulk export is followed by a canonical REST coverage pass before the incremental checkpoint advances: Recruit does not document equivalent conversion/approval filters for Bulk Read. This deliberately avoids claiming complete coverage from an ambiguous export. Provider permission errors, unsupported/oversized exports and validation failures never imply a complete baseline. Export POSTs with unknown outcomes are not blindly retried.
- Bulk archives retain the existing bounded archive/expanded-file limits; jobs stage in 20-row chunks and candidates in 200-row chunks. The archive is decompressed and indexed once into independently authenticated encrypted batches in one tracked private object. Resumed batches use ETag-fenced R2 byte ranges to read the encrypted index and their own batch; they do not rescan the CSV. Legacy encrypted ZIPs are upgraded atomically at the same key. Indexed objects are capped at 24 MiB plus a bounded index; oversize preparation falls back to REST. Exports exceeding those bounds fall back to paginated REST rather than increasing Worker memory without a bound.
- Existing database leases, organization-wide quota accounting, retry deadlines, approval evidence, receipts and execution outboxes remain authoritative. Restarting a process or closing the browser does not reset them. Paused/cancelled scans are not automatically restarted.

Workflow notifications are optional acceleration. In Integration settings, generate a webhook secret, then configure Zoho Recruit workflow POST actions for both modules at `/api/integrations/zoho-recruit/webhook`. Send `connectionId`, `module` (`Candidates` or `Job_Openings`) and `secret` in a JSON or URL-encoded body; an optional numeric `externalId` is accepted but not persisted. Do not include credentials in the URL. Only a SHA-256 digest of the random 256-bit secret is stored. Rotation invalidates the old secret immediately; relevant source configuration changes also invalidate it.

The endpoint stores one coalesced hint per source/module, not candidate data. The existing recovery cron dispatches conditional discovery after an active scan finishes, with a minimum one-minute debounce. Scheduled polling repairs lost notifications. Provider deletion evidence is checked separately (daily or after a hint); absence from an incomplete inventory never deletes anything. Lifecycle effects retain their explicit approval requirements. No account, job or email is created by webhook acceptance.

Deploy the additive `20270228000000_zoho_sync_coordinator.sql` and `20270301000000_zoho_bulk_capture_coverage.sql` and `20270302000000_zoho_sync_recovery_fences.sql` and `20270303000000_zoho_bulk_index_upgrade.sql` migrations before the updated dashboard/runtime. Production processing still follows the existing deployment profiles; installing this change does not turn disabled environments on. Migration rollback must account for the function wrappers and captured checkpoints; use a forward fix rather than replaying old migrations.

The recovery-fence migration retires obsolete-configuration scan intents before a fresh manual start and during scheduled housekeeping. It does not restart paused/cancelled work or mint new approvals. The planner pins transport on run creation; REST commits also verify transport ownership. A manually running export is skipped by automatic module planning, and a bulk run with a live lease cannot consume a discovery dispatch slot. Source-local serialization conflicts do not abort other sources' scheduling.

Legacy ZIP replacement has its own durable write marker before changing the object. Cleanup cannot acknowledge deletion while that replacement is unconfirmed. Recovery requires the indexed object's exact write token; merely observing the previous ZIP does not prove the replacement finished. Old writer acknowledgements cannot clear an index-upgrade marker. Erasure racing a late replacement therefore retains a tracked pointer until the new write can be confirmed and deleted.

### Discovery status consistency

The initial discovery-history read can request `live=1`. Its history page and cursor stay unchanged; separate bounded per-module heads and completed capture checkpoints prevent a busy candidate history from hiding job activity. Status reads require the same live administrator authorization as history reads. A failed status read is an outage, never an empty successful checkpoint.

Visible idle pages revalidate every 45 seconds, with outage backoff capped at two minutes, and refresh on window focus or visibility return. Active work retains its faster existing cadence. Hidden pages skip polling. Checkpoints update open synchronization settings without resetting unsaved form edits or the one-time webhook secret. Checkpoints from older source configuration revisions are excluded.

The discovery card labels metrics as belonging to this scan and uses the original `scan_started_at` across checkpoint continuations. Legacy or incomplete classification counters are shown as unavailable instead of inventing a zero breakdown. Received/staged counts remain intact. Cancellation preserves staged records and does not establish a completed capture checkpoint or cancel approved execution.
