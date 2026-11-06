'use client';
import React, { useEffect, useState } from 'react';
import { ArrowRight, Ban, CalendarDays, CheckCircle2, Clock3, Database, Download, History, Layers, LoaderCircle, AlertCircle } from 'lucide-react';

import { discoveryTiming, formatDiscoveryDuration } from '@/lib/zoho/discovery-progress';
import styles from './DiscoveryProgress.module.css';

export default function DiscoveryProgress({ progress, connection, errorText, updatedAt, pollDelay = 3000, onViewHistory, capture, checkpointKnown = false }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!progress?.active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [progress?.active, progress?.startedAt]);
  if (!progress) return null;
  const { active, phase, title, run } = progress;
  const historical = !active && phase !== 'paused' && connection?.status === 'connected' &&
    Number.isInteger(connection.configRevision) && Number.isInteger(run?.config_revision) &&
    run.config_revision !== connection.configRevision;
  const startedAt = Date.parse(progress.startedAt);
  const elapsed = Number.isFinite(startedAt) ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const timing = discoveryTiming(progress, now);
  const waiting = timing.waiting;
  const Icon = historical ? History : waiting ? Clock3 : active ? LoaderCircle : phase === 'completed' ? CheckCircle2 : AlertCircle;
  const heading = historical ? 'Fresh discovery required' : waiting ? 'Waiting to retry' : title;
  const tone = historical || waiting || ['paused','incomplete','completed_with_exceptions','cancelled'].includes(phase) ? 'amber' : active ? 'violet' : phase === 'completed' ? 'green' : 'rose';
  const scanDate = Date.parse(progress.startedAt || run?.scan_started_at || run?.created_at);
  const hasScanDate = Number.isFinite(scanDate);
  const checkedDate = new Date(updatedAt ?? NaN);
  const hasCheckedDate = Number.isFinite(checkedDate.getTime());
  const metrics = [
    {value:progress.received,label:'Received',Icon:Download},
    {value:progress.staged,label:'Staged',Icon:Layers},
    {value:progress.deferred,label:'Deferred',Icon:Clock3},
    {value:progress.notStaged,label:'Not staged',Icon:Ban},
    {value:progress.batches,label:'Batches saved',Icon:Database},
  ];
  return <section aria-label="Discovery progress" className={styles.card}>
    <div className={styles.heading}>
      <span data-tone={tone} className={styles.statusIcon}><Icon aria-hidden="true" size={22} className={active && !waiting ? styles.spinning : undefined}/></span>
      <div className={styles.headingText}>
          <h2 className={styles.title}><span role="status" aria-live="polite">{heading}</span></h2>
          <p className={styles.description}>{historical ? 'The previous scan used older source settings. Run a new discovery to use the latest configuration.' : phase === 'submitting' ? 'Saving your request. Candidates and jobs will only be staged for review.'
            : phase === 'queued' ? timing.description
            : phase === 'running' ? (run?.transport === 'bulk' ? 'The background processor is preparing and staging the bulk export. Its checkpoint survives restarts.' : 'Reading saved records, including both conversion states. Total size is not known yet.')
            : phase === 'completed' ? 'Staging finished. Review each record before approving account or job creation.'
            : phase === 'completed_with_exceptions' ? (run?.capture_complete ? 'Source capture finished. Deferred records remain available for recovery and review; approval is separate.' : 'Some source records could not be captured. Review exceptions before treating this inventory as complete.')
            : phase === 'incomplete' ? 'The next discovery continues from the saved checkpoint.'
            : phase === 'paused' ? 'The saved batch is retained. Resume continues from that checkpoint without changing approvals or the connection.'
            : phase === 'cancelled' ? 'Staged records were retained. A new discovery starts a fresh scan.'
            : phase === 'error' ? 'The response was not confirmed. Refresh status before trying again; the request may already be queued.'
            : 'Review the error below before starting a new discovery.'}</p>
      </div>
      {active && <span className={styles.elapsed}>{formatDiscoveryDuration(elapsed)} elapsed</span>}
    </div>
    {active && !waiting && <div role="progressbar" aria-label="Discovery activity" aria-valuetext={title} className={styles.activityBar}><div/></div>}
    {waiting && <p className={styles.retry}>{!timing.validRetry ? 'Waiting for retry scheduling' : timing.remainingSeconds > 0 ? `Retry eligible in ${formatDiscoveryDuration(timing.remainingSeconds)}` : 'Retry eligible now · waiting for the background processor'}</p>}
    <p className="mb-3 text-xs text-muted-foreground">{progress.mode || (run?.modified_since ? 'Incremental discovery' : 'Full reconciliation')}{run?.modified_since ? ` · changes since ${new Date(run.modified_since).toLocaleString()}` : ''}{run?.capture_complete ? ' · Source capture complete; approval and execution are tracked separately.' : ''}</p>
    <p className="mb-2 text-xs text-muted-foreground">This scan only · accumulated records and approved execution are tracked separately.</p>
    <dl className={styles.metrics}>
      {metrics.map(({value,label,Icon:MetricIcon}) => <div key={label} className={styles.metric}>
        <dt><span className={styles.metricIcon}><MetricIcon aria-hidden="true" size={21}/></span>{label}</dt>
        <dd>{(value ?? 0).toLocaleString()}</dd>
      </div>)}
    </dl>
    {run?.transport !== 'bulk' && progress.breakdownAvailable && <p className="mt-3 text-xs text-muted-foreground">{progress.newRecords.toLocaleString()} new · {(progress.changed ?? 0).toLocaleString()} changed · {(progress.unchanged ?? 0).toLocaleString()} unchanged · {(progress.suppressed ?? 0).toLocaleString()} suppressed</p>}
    {run?.transport !== 'bulk' && run?.received_count > 0 && !progress.breakdownAvailable && <p className="mt-3 text-xs text-muted-foreground">Classification breakdown unavailable for this scan. Received and staged counts are retained.</p>}
    {checkpointKnown && <p className="mt-3 text-xs text-muted-foreground">{capture ? `Last successful capture checkpoint: ${new Date(capture.scan_started_at).toLocaleString()}.` : 'No completed capture checkpoint for the current source settings. A full baseline must finish before incremental discovery can begin.'}</p>}
    {!historical && (errorText || progress.message) && <p className={run?.last_error === 'BULK_COVERAGE_VERIFY' ? 'mt-3 text-xs text-muted-foreground' : waiting ? styles.warning : styles.error}>{errorText || progress.message}</p>}
    {waiting && <p className={styles.budgetHelp}>These counts apply to this scan; the shared budget also includes earlier scans and both record types. Connector usage replenishes over a rolling 24 hours, rather than at midnight. See Advanced → Shared API budget for the current allocation and refill times. Starting another scan does not reset usage.</p>}
    <footer className={styles.footer}>
      <p className={styles.scanSummary}><CalendarDays aria-hidden="true" size={18}/><span>{active && hasCheckedDate ? <>Last checked <time dateTime={checkedDate.toISOString()}>{checkedDate.toLocaleTimeString()}</time> · checking about every {Math.round(pollDelay / 1000)} seconds while visible</> : <>{historical?'Previous scan:':run?'Scan started:':'Request started:'} {hasScanDate?<time dateTime={new Date(scanDate).toISOString()}>{new Date(scanDate).toLocaleString()}</time>:'Date unavailable'} · {(progress.staged??0).toLocaleString()} staged</>}</span></p>
      {onViewHistory && <button type="button" className={styles.historyLink} onClick={onViewHistory}>View discovery history<ArrowRight aria-hidden="true" size={17}/></button>}
    </footer>
  </section>;
}
