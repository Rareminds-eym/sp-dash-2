import { redirect } from 'next/navigation'
import { loginUrl } from '@/lib/auth-redirect'
import { getSession } from '@/lib/supabase-rls'
import ApprovalsPage from '@/components/pages/ApprovalsPage'


export const metadata = {
  title: 'Approval Center - Rareminds Admin',
  description: 'Review and approve pending registrations',
}

export default async function ApprovalsCenterPage({ searchParams }) {
  const session = await getSession()

  if (!session) {
    const query = new URLSearchParams(await searchParams).toString()
    const returnTo = '/approvals' + (query ? '?' + query : '')
    // Middleware handles expired sessions. A failed server verification must
    // stop at login rather than starting another automatic recovery cycle.
    redirect(loginUrl(returnTo))
  }

  return <ApprovalsPage currentUser={session} />
}
