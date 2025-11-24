import { redirect } from 'next/navigation'
import { getSession } from '@/lib/supabase-rls'
import ApprovalsPage from '@/components/pages/ApprovalsPage'

export const runtime = 'nodejs'

export const metadata = {
  title: 'Approval Center - Rareminds Admin',
  description: 'Review and approve pending registrations',
}

export default async function ApprovalsCenterPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return <ApprovalsPage currentUser={session} />
}
