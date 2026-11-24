# Application-owned job indexing

SkillPassport's application database owns the transactional outbox and verified vectors. The sp-dash application backend owns the leased queue processor, `JobIndexCoordinator` Durable Object alarms, periodic reconciliation, and private `JobIndexService` wake signal. SkillPassport wakes that app service through `JOB_INDEX_SERVICE` after committed writes or when recommendations need indexing.

The embedding worker is a provider adapter. Apps call `EmbeddingService.embedText(text, 'RETRIEVAL_DOCUMENT')`. It returns a vector and model metadata. It receives no database credentials, job identifiers, SQL commands, queue grants, or persistence instructions. Its existing provider authentication and rate-limit mechanisms remain independent of app data.

The app claims at most eight jobs, generates at most two vectors concurrently, and validates the returned model and 1536 finite, nonzero dimensions. Database publication rechecks live source hashes, eligibility and ten-minute leases. One transaction publishes a batch after acquiring all job locks in consistent order. Lost wake signals and restarts recover through app alarms and the app's existing two-minute recovery cron. Full catalogue reconciliation is gated to at most once every five minutes; routine dispatch reads indexed queue windows.

429 responses defer without consuming the eight-attempt failure budget. Other failures back off up to one hour. Terminal failures require explicit retry. The Jobs tab reports source-scoped progress and exposes Zoho-source retries. Verified recommendations remain available during later imports; initial baseline failures are reported honestly.

## Activation

1. Apply SkillPassport migrations `20270307000000_job_matching_background_index.sql` and `20270308000000_job_index_hardening.sql`.
2. Configure sp-dash's existing SkillPassport database credentials. The app reads the index model from `job_index_control` and compares it with `EmbeddingService.getCapabilities()` before claiming work. There is no app model environment override. The provider reports its generation model, dimensions and supported task types without generating a vector or accessing application data. SkillPassport's `MATCHING_EMBEDDING_MODEL` must still agree with the stored index model.
3. Deploy sp-dash with its app-owned SQLite object migration and `JobIndexService` export. SkillPassport's `JOB_INDEX_SERVICE` targets that app; its separate `EMBEDDING_SERVICE` remains available for learner vectors. The embedding worker has no database credentials or indexing alarms. Remove any legacy application-database secrets from its deployment during rollout; only apps keep those credentials.
4. Review/save the Zoho job policy when the database executable surface changes. Do not bypass its reviewed fingerprint.
5. Locally, restart sp-dash's launcher to regenerate worker/proxy bindings, and restart SkillPassport's Pages process with `--service JOB_INDEX_SERVICE=sp-dash-2#JobIndexService`. The embedding worker continues in the normal SSO multi-worker stack.

## Verification

- `skillpassport/scripts/checks/test-job-index-background-sql.mjs`: disposable SQL tests, old/new deadlock control, lease/hash fences and bounded dispatch.
- `sp-dash/lib/job-index/__tests__/processor.test.js`: app-owned processing, provider-only payloads and durable alarm recovery.
- `embedding-worker/scripts/__tests__/provider-boundary.test.ts`: provider cannot acquire app database or orchestration responsibilities.

## Model changes

A changed provider model or incompatible dimensions stops processing before claims are acquired. The app never updates the stored model automatically or relabels old vectors. Deploy the provider capability method before updating the app processor; older providers fail closed until updated. Removing the app environment setting does not require a database migration.

Changing the generation model is a separate, explicit maintenance operation. The current vector schema and processor require **1536 dimensions**. A model with different dimensions needs a reviewed schema/application change before this procedure can be used.

1. Record the current `job_index_control.model`, provider deployment and SkillPassport `MATCHING_EMBEDDING_MODEL` for rollback. Choose the replacement provider model explicitly and verify its `getCapabilities()` reports that exact model, 1536 dimensions and `RETRIEVAL_DOCUMENT` support. Test a real embedding in a non-production environment; matching metadata alone does not verify credentials or provider availability.
2. Enter a maintenance window for AI recommendations and indexing. Pause **all** sp-dash index processors/alarms/cron invocations, indexing maintenance scripts, and opportunity imports/edits in every deployment sharing this database. Stop new recommendation requests that could generate learner vectors. Drain in-flight generation/publication calls before proceeding. Stopping a browser or one local server does not pause deployed Durable Objects or other applications. Keep the job browsing page available if its reads are independent of these writes.
3. Deploy the chosen embedding provider and matching SkillPassport reader configuration while those consumers remain paused. Keep the stored database model unchanged until the following transaction. Confirm each environment's binding resolves to the intended provider; do not point QA and production at a shared model change accidentally.
4. Run the following transaction against the **application database**, as its migration/database owner. Application `service_role` intentionally has only `SELECT` on the control/work tables and cannot perform this operator reset. Supply `old_model` and `new_model` as psql variables, for example through `psql --set=old_model='recorded-current-model' --set=new_model='verified-replacement-model' --file=model-change.sql`. The SQL below is the contents of that operator file; it is not an automatically applied migration.

   ```sql
   \set ON_ERROR_STOP on
   BEGIN;
   SET LOCAL lock_timeout = '5s';
   SET LOCAL statement_timeout = '60s';
   -- Use the same reconciliation lock and prevent source/outbox writes while
   -- changing the contract. Readers can continue; paused processors must drain.
   SELECT pg_advisory_xact_lock(17070307);
   LOCK TABLE public.opportunities IN SHARE ROW EXCLUSIVE MODE;
   LOCK TABLE public.job_index_work IN SHARE ROW EXCLUSIVE MODE;
   SELECT set_config('job_index.expected_old_model', :'old_model', true);
   SELECT set_config('job_index.replacement_model', :'new_model', true);
   DO $$
   DECLARE replacement text := current_setting('job_index.replacement_model');
   BEGIN
     IF replacement = '' OR replacement <> btrim(replacement) THEN
       RAISE EXCEPTION 'Replacement model must be a nonempty, trimmed provider model';
     END IF;
     UPDATE public.job_index_control
     SET model = replacement, baseline_completed_at = NULL, last_reconciled_at = NULL
     WHERE singleton AND model = current_setting('job_index.expected_old_model');
     IF NOT FOUND THEN
       RAISE EXCEPTION 'Stored model changed or control row is missing; reset aborted';
     END IF;
   END $$;
   -- Invalidate every old lease and retry budget, including terminal failures
   -- whose source text has not changed. Reconcile alone would preserve them.
   DELETE FROM public.job_index_work;
   SELECT public.reconcile_job_index(:'new_model');
   SELECT public.job_matching_index_status(:'new_model');
   COMMIT;
   ```

   A timeout or failed precondition aborts the transaction; resolve the competing work/configuration and retry the complete transaction. Do not continue with individual statements after an error. Reconciliation queues every eligible job without a verified vector for the replacement model and leaves closed, expired, inactive jobs and visits excluded. Existing vectors retain their original model labels. The baseline remains incomplete until the new queue finishes; an empty/already-verified catalogue can complete immediately. Deleting the work rows clears previous leases and terminal failures, not jobs, approvals or user accounts.
5. Resume the app-owned index processor and request `JobIndexService.kickJobIndexing()` through its private application binding, or allow the existing two-minute recovery cron to wake it. Keep old-model workers stopped. Resume opportunity writes only after confirming the new processor has started successfully; their transactional outbox will join the same rebuild. Check `job_matching_index_status(new_model)` until `managed = true`, `baseline_ready = true`, `verified = total`, and `failed = 0`. Resolve failed rows explicitly rather than marking the baseline complete manually. A constantly changing catalogue can add new work while rebuilding.
6. Resume recommendation requests with `MATCHING_EMBEDDING_MODEL` equal to the stored/provider model. Existing learner vectors and cached matches are filtered by their model provenance; let normal recommendation processing regenerate learner vectors. Check a real learner response and the Jobs progress view. Never relabel learner/job embeddings or cached matches to avoid regeneration.

Rollback requires the same maintenance/drain procedure: restore the previous provider and reader configuration, then run the same transaction with `old_model` set to the currently stored replacement and `new_model` set to the recorded previous model. Reconciliation reuses only vectors that still genuinely match that previous model and current source hash; vectors overwritten during the rebuild are regenerated. Rolling back the model string alone leaves incompatible leases, retry budgets and baseline state behind.

## Processor status

The app-owned Durable Object stores the last attempt, last successful batch and an allowlisted failure code. Its private `getIndexingStatus()` RPC is read-only; it does not wake processing. The Jobs tab distinguishes blocked, stale and unreported status from queue counts. A heartbeat older than twelve minutes is stale, allowing the existing watchdog and idle reconciliation interval. Status reads time out after three seconds; no raw provider/database messages reach the UI. Initial recommendation preparation returns an explicit unavailable response when the configured app reports blocked, stale or unreported processing. Verified results after baseline remain available. Deploy the app status RPC before the SkillPassport reader; absent bindings/methods retain rolling-deployment compatibility.

The failed-index retry action has a fifteen-second deadline. A timed-out request has an unconfirmed outcome; refresh progress before retrying. Cancelling a browser request does not undo a server-side retry already committed.
