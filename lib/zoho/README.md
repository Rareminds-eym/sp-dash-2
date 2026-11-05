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
