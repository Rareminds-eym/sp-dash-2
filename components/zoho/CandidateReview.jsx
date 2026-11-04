import { Button } from '@/components/ui/button';
import { candidateApprovalReady } from '@/lib/zoho/candidate-review-selection';

export default function CandidateReview({ record, review, loading, acknowledged, onReview, onAcknowledge }) {
  return <section className="mt-6 border-t border-border pt-5" aria-label="Canonical candidate review">
    <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-semibold">Account and access review</h4>
      <Button variant="outline" size="sm" disabled={loading || Boolean(record.validation_errors?.length)} onClick={onReview}>
        {loading ? 'Checking…' : review ? 'Refresh check' : 'Check canonical account'}
      </Button></div>
    {!review ? <p className="mt-3 text-xs leading-5 text-muted-foreground">Check the canonical account before approval. Review the matching identity and the access that will be granted or preserved.</p> : <>
      <p className="mt-3 text-sm font-medium">{review.decision === 'create' ? 'Create a new learner' : review.decision === 'preserve_existing' ? 'Preserve the existing learner' : 'Blocked for operator review'}</p>
      <dl className="mt-4 space-y-3 text-xs">
        <div><dt className="text-muted-foreground">Identity match</dt><dd className="mt-1 break-all">{review.identity.email} · {review.identity.outcome.replaceAll('_', ' ')}</dd></div>
        {review.identity.targetId && <div><dt className="text-muted-foreground">Matched account</dt><dd className="mt-1 break-all font-mono">{review.identity.targetId}</dd></div>}
        <div><dt className="text-muted-foreground">Profile</dt><dd className="mt-1">{review.identity.profileAction === 'create' ? `Create ${review.identity.name}` : 'Preserve current name, credentials and preferences; create a private learner mirror if missing'}</dd></div>
        <div><dt className="text-muted-foreground">Learning access</dt><dd className="mt-1">{review.entitlements.action === 'grant_discover' ? 'Grant Discover (free)' : review.entitlements.action === 'preserve' ? 'Preserve existing access' : 'No access change authorized'}{review.entitlements.planCodes.length > 0 && ` · ${review.entitlements.planCodes.join(', ')}`}</dd></div>
        <div><dt className="text-muted-foreground">Existing entitlements</dt><dd className="mt-1">{review.entitlements.paidAccessPreserved ? 'Paid access preserved. ' : ''}{review.entitlements.organizationAccessPreserved ? 'Organization access preserved. ' : ''}{review.decision === 'create' ? 'No existing account changed.' : 'No replacement or downgrade.'}</dd></div>
        <div><dt className="text-muted-foreground">Sign-in</dt><dd className="mt-1">{review.identity.activationState === 'activation_pending' ? 'Activation pending; the candidate can use Google sign-in with the same provider-verified address. No invitation or activation email is sent.' : review.identity.activationState === 'existing_sign_in_preserved' ? 'Existing sign-in preserved' : 'Blocked'}</dd></div>
      </dl>
      {review.blockers.length > 0 && <ul className="mt-4 list-inside list-disc space-y-2 text-xs text-destructive">{review.blockers.map((blocker, index) => <li key={index}>{blocker}</li>)}</ul>}
      <p className="mt-4 text-xs text-muted-foreground">Check expires {new Date(review.expiresAt).toLocaleString()}. Account changes require a new review.</p>
      <Button className="mt-4 w-full" size="sm" disabled={loading || acknowledged || !candidateApprovalReady(record, review, review.reviewHash)} onClick={onAcknowledge}>
        {acknowledged ? 'Account and access reviewed' : 'Acknowledge and select'}
      </Button>
    </>}
  </section>;
}
