import { ZOHO_POLICY } from './contracts';
import { candidateApprovalReady, candidateReviewUnavailable } from './candidate-review-selection';

// Keep the overall review bound, but load through the indexed, 50-record page API.
export const BULK_CANDIDATE_LIMIT = 100000;
const reviewBatchSize = 10;
const version = row => ({ id: row.id, revision: row.revision, sourceHash: row.source_hash,
  configRevision: row.config_revision, targetId: row.target_id });
const reviewInput = (connectionId, row) => {
  const { id: recordId, ...fields } = version(row);
  return { connectionId, recordId, ...fields };
};

/** Orchestrates existing authenticated BFF calls; every decision retains server verification. */
export function createBulkCandidateApproval({ api, connection, currentConnection, onChange, requestId = () => crypto.randomUUID() }) {
  let state = { phase: 'idle', total: null, loadedCount: 0, pagesLoaded: 0, checked: 0, eligible: [], skipped: [], approved: 0, processed: 0,
    pendingDelivery: 0, approvedIds: [], rechecking: 0, batchSize: 0, error: '', stopRequested: false, pendingBatch: false, reviewRequired: false, mode: 'review' };
  let rows = [], reviewOffset = 0, approvalOffset = 0, pending = null, reason = '', running = false, loaded = false;
  let loadingStarted = false, cursor = null;
  const seen = new Set();
  const emit = patch => { state = { ...state, ...patch }; onChange(state); };
  const post = (action, input) => api('', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(action === 'decide' ? 120000 : 60000), body: JSON.stringify({ action, input }) });
  function assertSource() {
    const source = currentConnection();
    if (source?.id !== connection.id || source.status !== 'connected' || source.configRevision !== connection.configRevision)
      throw new Error('The source connection changed. Review the remaining staged candidates again.');
  }
  function localIssue(row) {
    return candidateReviewUnavailable(row, connection) ||
      (!Array.isArray(row.validation_errors) || row.validation_errors.length ? 'Resolve source validation issues and discover again.' : null);
  }
  async function checks(batch, onProgress) {
    const results = [];
    for (let i = 0; i < batch.length; i += reviewBatchSize) {
      if (state.stopRequested) return null;
      assertSource();
      const group = batch.slice(i, i + reviewBatchSize);
      const eligible = group.filter(row => !localIssue(row));
      let reviews = [];
      if (eligible.length) {
        const response = await post('review_candidates', { connectionId: connection.id,
          items: eligible.map(row => { const { connectionId, ...item } = reviewInput(connection.id, row); return item; }) });
        reviews = response.reviews;
        if (!Array.isArray(reviews) || reviews.length !== eligible.length ||
            new Set(reviews.map(item => item?.recordId)).size !== eligible.length ||
            reviews.some(item => !item || !eligible.some(row => row.id === item.recordId) ||
              (typeof item.issue === 'string' ? !item.issue.trim() || item.review !== undefined : !item.review)))
          throw new Error('An account check returned an invalid result. Retry the account checks.');
      }
      assertSource();
      for (const row of group) {
        const issue = localIssue(row);
        if (issue) { results.push({ record: row, issue }); continue; }
        const result = reviews.find(item => item.recordId === row.id);
        if (result.issue) { results.push({ record: row, issue: result.issue }); continue; }
        const review = result.review;
        if (!candidateApprovalReady(row, review, review?.reviewHash)) {
          if (review?.decision === 'blocked' && review.blockers?.length) {
            results.push({ record: row, issue: review.blockers.join(' ') }); continue;
          }
          throw new Error('An account check returned an invalid or expired result. Retry the account checks.');
        }
        results.push({ record: row, review });
      }
      onProgress?.(results.length);
    }
    return results;
  }
  async function guarded(work) {
    if (running) return;
    running = true;
    emit({ error: '', stopRequested: false });
    try { await work(); }
    catch (error) {
      const timeout = ['TimeoutError', 'AbortError'].includes(error.name) || /signal timed out|timed out|due to timeout/i.test(error.message);
      const message = !timeout ? error.message : state.mode === 'load'
        ? `Loading candidate page ${state.pagesLoaded + 1} timed out. ${state.loadedCount} candidates have been loaded. Retry loading to continue from this page. No approvals were recorded.`
        : pending ? 'The approval response timed out. Retry the pending batch to recover its original decision without creating another approval.'
          : 'An account check timed out. Continue to retry the unfinished checks. No new approval was recorded by this request.';
      emit({ phase: 'error', error: message, pendingBatch: Boolean(pending) });
    }
    finally { running = false; }
  }
  function invalidList(message = 'The staged candidate list changed while loading. Review the remaining staged candidates again. No approvals were recorded.') {
    emit({ reviewRequired: true });
    throw new Error(message);
  }
  async function loadRemaining() {
    assertSource();
    if (state.reviewRequired) throw new Error('Review the remaining staged candidates again.');
    emit({ phase: 'loading', mode: 'load' });
    while (!loaded && !state.stopRequested) {
      assertSource();
      const query = new URLSearchParams({ view: 'records', connectionId: connection.id, module: 'Candidates', state: 'pending_approval' });
      if (cursor) { query.set('before', cursor.timestamp); query.set('beforeId', cursor.id); }
      const page = await api(`?${query}`, { signal: AbortSignal.timeout(30000) });
      assertSource();
      if (!Array.isArray(page.records) || page.records.length > ZOHO_POLICY.pageSize || !Number.isSafeInteger(page.total) || page.total < 0 ||
        page.records.some(row => !row || typeof row.id !== 'string' || row.module !== 'Candidates' || row.connection_id !== connection.id ||
          row.decision !== 'pending_approval' || !Number.isFinite(Date.parse(row.created_at))))
        invalidList('A complete staged candidate list could not be loaded. No candidates were approved.');
      if (state.total === null) {
        if (page.total > BULK_CANDIDATE_LIMIT) invalidList(`Bulk review supports up to ${BULK_CANDIDATE_LIMIT.toLocaleString()} candidates. No candidates were approved.`);
        emit({ total: page.total });
      }
      // Validate the complete page before committing its cursor, so retry never omits rows.
      const ids = new Set(page.records.map(row => row.id));
      if (ids.size !== page.records.length || page.records.some(row => seen.has(row.id))) invalidList();
      if (rows.length + page.records.length > state.total) invalidList();
      rows.push(...page.records); ids.forEach(id => seen.add(id));
      const last = page.records.at(-1);
      if (last) cursor = { timestamp: last.created_at, id: last.id };
      emit({ loadedCount: rows.length, pagesLoaded: state.pagesLoaded + 1 });
      if (page.records.length < ZOHO_POLICY.pageSize) {
        if (rows.length !== state.total) invalidList();
        loaded = true;
      }
    }
    if (state.stopRequested) { emit({ phase: 'paused', mode: loaded ? 'review' : 'load' }); return; }
    await reviewRemaining();
  }
  async function reviewRemaining() {
    emit({ phase: 'checking', mode: 'review' });
    while (reviewOffset < rows.length && !state.stopRequested) {
      const batch = rows.slice(reviewOffset, reviewOffset + reviewBatchSize);
      const results = await checks(batch);
      if (!results) break;
      assertSource();
      const eligible = results.filter(item => !item.issue), skipped = results.filter(item => item.issue);
      reviewOffset += batch.length;
      emit({ checked: reviewOffset, eligible: state.eligible.concat(eligible), skipped: state.skipped.concat(skipped) });
    }
    emit({ phase: state.stopRequested ? 'paused' : 'ready' });
  }
  async function deliverPending() {
    // Keep this exact request on transport failure: replay recovers a committed decision.
    let result;
    try { ({ result } = await post('decide', pending.input)); }
    catch (error) {
      if ([400, 409, 422].includes(error.status)) {
        // A definitive server refusal recorded no local approval. Do not retry stale evidence forever.
        pending = null;
        emit({ pendingBatch: false, reviewRequired: true });
        throw new Error(`${error.message} Review the remaining staged candidates again. Earlier approvals are retained.`);
      }
      throw error;
    }
    if (result?.decision !== 'approve' || result.count !== pending.count)
      throw new Error('The approval result is uncertain. Retry this batch to recover its original decision.');
    approvalOffset += pending.advance;
    emit({ approved: state.approved + pending.count, processed: approvalOffset,
      approvedIds: state.approvedIds.concat(pending.input.items.map(item => item.id)),
      pendingDelivery: state.pendingDelivery + (result.delivery !== 'queued' ? pending.count : 0), pendingBatch: false });
    pending = null;
  }
  async function approveRemaining() {
    emit({ phase: 'approving', mode: 'approve' });
    if (pending) await deliverPending();
    while (approvalOffset < state.eligible.length && !state.stopRequested) {
      assertSource();
      const batch = state.eligible.slice(approvalOffset, approvalOffset + ZOHO_POLICY.maxApprovalBatch);
      emit({ rechecking: 0, batchSize: batch.length });
      // Renew unchanged checks just before each batch, so large runs do not expire mid-way.
      const fresh = await checks(batch.map(item => item.record), count => emit({ rechecking: count }));
      if (!fresh || state.stopRequested) break;
      assertSource();
      const changed = [], items = [];
      fresh.forEach((item, index) => {
        if (item.issue || item.review.reviewHash !== batch[index].review.reviewHash)
          changed.push({ record: item.record, issue: item.issue || 'Account or access changed after the bulk review. Review this candidate again.' });
        else items.push({ ...version(item.record), candidateReviewHash: item.review.reviewHash });
      });
      if (changed.length) emit({ skipped: state.skipped.concat(changed) });
      if (!items.length) { approvalOffset += batch.length; emit({ processed: approvalOffset }); continue; }
      pending = { count: items.length, advance: batch.length, input: {
        connectionId: connection.id, decision: 'approve', reason, requestId: requestId(), items,
      } };
      emit({ pendingBatch: true });
      await deliverPending();
    }
    emit({ phase: state.stopRequested ? 'paused' : 'done' });
  }
  return {
    get state() { return state; },
    stop() { if (running) emit({ stopRequested: true }); },
    prepare() { return guarded(async () => {
      if (pending) throw new Error('Recover the pending batch before starting another review.');
      assertSource();
      loaded = false; loadingStarted = true; cursor = null; rows = []; seen.clear();
      reviewOffset = 0; approvalOffset = 0; reason = '';
      emit({ phase: 'loading', mode: 'load', total: null, loadedCount: 0, pagesLoaded: 0, checked: 0, eligible: [], skipped: [],
        approved: 0, approvedIds: [], processed: 0, pendingDelivery: 0, reviewRequired: false });
      await loadRemaining();
    }); },
    approve(value) { return guarded(async () => {
      if (state.reviewRequired) throw new Error('Review the remaining staged candidates again.');
      if (!loaded || !['ready', 'paused', 'error'].includes(state.phase) || state.checked !== state.total)
        throw new Error('Complete the account checks before approving.');
      if (!reason) {
        if (typeof value !== 'string' || value.trim().length < 3 || value.trim().length > 500)
          throw new Error('Enter a decision reason between 3 and 500 characters.');
        reason = value.trim();
      }
      await approveRemaining();
    }); },
    resume() { return !loadingStarted ? this.prepare() : state.mode === 'load' ? guarded(loadRemaining)
      : state.mode === 'approve' ? this.approve(reason) : guarded(reviewRemaining); },
  };
}
