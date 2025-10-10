import Dashboard from '@/components/pages/Dashboard'
import { getSession } from '@/lib/session'

export const runtime = 'edge'

export default async function DashboardPage() {
  const session = await getSession()
  
  return <Dashboard user={session?.user} />
}