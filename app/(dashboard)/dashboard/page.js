import Dashboard from '@/components/pages/Dashboard'
import { getSession } from '@/lib/supabase-server'

export const runtime = 'edge'

export default async function DashboardPage() {
  const session = await getSession()
  
  return <Dashboard user={session?.user} />
}