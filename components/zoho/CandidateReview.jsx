import { ShieldCheck, UserRound, KeyRound, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { candidateApprovalReady } from '@/lib/zoho/candidate-review-selection';

export default function CandidateReview({ record, review, loading, acknowledged, unavailableReason, error, onReview, onAcknowledge }) {
  const expired = review && Date.parse(review.expiresAt) <= Date.now();
  return <section className="mt-3 rounded-xl border border-violet-200/70 bg-violet-50/30 p-3 dark:border-violet-400/20 dark:bg-violet-400/5" aria-label="Canonical candidate review">
    <div className="flex flex-col items-start gap-2.5"><h4 className="flex items-center gap-1.5 text-xs font-semibold"><ShieldCheck aria-hidden="true" size={14} className="text-violet-600 dark:text-violet-300" />Account and access review</h4>
      <Button variant="outline" size="sm" className="h-9 w-full rounded-lg border-violet-200 bg-background px-2.5 text-xs shadow-sm hover:bg-violet-50 dark:border-violet-400/30 dark:hover:bg-violet-400/10" disabled={loading || Boolean(unavailableReason) || Boolean(record.validation_errors?.length)} onClick={onReview}>
        {loading ? 'Checking…' : review ? 'Refresh check' : 'Check canonical account'}
      </Button></div>
    {unavailableReason&&<p role="status" className="mt-2.5 rounded-lg border border-destructive/20 bg-destructive/5 p-2 text-xs leading-4 text-destructive">{unavailableReason}</p>}
    {error&&<p role="alert" className="mt-2.5 rounded-lg border border-destructive/20 bg-destructive/5 p-2 text-xs leading-4 text-destructive">{error}</p>}
    {!review ? <p className="mt-2.5 text-xs leading-4 text-muted-foreground">Check the canonical account before approval. Review the matching identity and the access that will be granted or preserved.</p> : <>
      <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-violet-200/70 bg-background px-2 py-1 text-xs font-semibold dark:border-violet-400/20"><UserRound aria-hidden="true" size={14} className="text-violet-600 dark:text-violet-300" />{review.decision === 'create' ? 'Create a new learner' : review.decision === 'preserve_existing' ? 'Preserve the existing learner' : 'Blocked for operator review'}</p>
      <dl className="mt-3 divide-y divide-violet-200/60 rounded-lg border border-violet-200/60 bg-background px-2.5 text-xs leading-4 [&>div]:py-2 dark:divide-violet-400/15 dark:border-violet-400/20">
        <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identity match</dt><dd className="mt-1 break-all">{review.identity.email} · {review.identity.outcome.replaceAll('_', ' ')}</dd></div>
        {review.identity.targetId && <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Matched account</dt><dd className="mt-1 break-all font-mono">{review.identity.targetId}</dd></div>}
        <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profile</dt><dd className="mt-1">{review.identity.profileAction === 'create' ? `Create ${review.identity.name}` : 'Preserve current name, credentials and preferences; create a private learner mirror if missing'}</dd></div>
        <div><dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><KeyRound aria-hidden="true" size={12} />Learning access</dt><dd className="mt-1">{review.entitlements.action === 'grant_discover' ? 'Grant Discover (free)' : review.entitlements.action === 'preserve' ? 'Preserve existing access' : 'No access change authorized'}{review.entitlements.planCodes.length > 0 && ` · ${review.entitlements.planCodes.join(', ')}`}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Existing entitlements</dt><dd className="mt-1">{review.entitlements.paidAccessPreserved ? 'Paid access preserved. ' : ''}{review.entitlements.organizationAccessPreserved ? 'Organization access preserved. ' : ''}{review.decision === 'create' ? 'No existing account changed.' : 'No replacement or downgrade.'}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sign-in</dt><dd className="mt-1">{review.identity.activationState === 'activation_pending' ? 'Activation pending; the candidate can use Google sign-in with the same provider-verified address. No invitation or activation email is sent.' : review.identity.activationState === 'existing_sign_in_preserved' ? 'Existing sign-in preserved' : 'Blocked'}</dd></div>
      </dl>
      {review.blockers.length > 0 && <ul className="mt-3 list-inside list-disc space-y-1 text-xs leading-4 text-destructive">{review.blockers.map((blocker, index) => <li key={index}>{blocker}</li>)}</ul>}
      <p className="mt-3 flex items-start gap-1.5 text-xs leading-4 text-muted-foreground"><Clock3 aria-hidden="true" size={12} className="mt-0.5 shrink-0" /><span>Check expires {new Date(review.expiresAt).toLocaleString()}. Account changes require a new review.</span></p>
      {expired&&<p role="status" className="mt-2 text-xs leading-4 text-destructive">Account check expired. Click Refresh check, review the result, then acknowledge again.</p>}
      <Button className="mt-3 h-9 w-full rounded-lg px-2 text-xs bg-violet-600 text-white shadow-sm hover:bg-violet-700 disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-400" size="sm" disabled={loading || Boolean(unavailableReason) || acknowledged || !candidateApprovalReady(record, review, review.reviewHash)} onClick={onAcknowledge}>
        {acknowledged ? 'Account and access reviewed' : 'Acknowledge and select'}
      </Button>
    </>}
  </section>;
}
