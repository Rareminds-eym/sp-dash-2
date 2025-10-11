import PassportsPage from '@/components/pages/PassportsPage'
import { getSession } from '@/lib/supabase-server'

export const runtime = 'edge'

export default async function Passports() {
  const session = await getSession()
  
  return <PassportsPage currentUser={session?.user} />
}