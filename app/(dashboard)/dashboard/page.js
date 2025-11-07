import DashboardOptimized from '@/components/pages/DashboardOptimized'
import { getSession } from '@/lib/supabase-server'

export const runtime = 'edge'

export default async function DashboardPage() {
  const session = await getSession()
  
  return <DashboardOptimized user={session?.user} />
}