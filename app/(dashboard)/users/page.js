import UsersPageEnhanced from '@/components/pages/UsersPageEnhanced'
import { getSession } from '@/lib/supabase-server'

export const runtime = 'edge'

export default async function Users() {
  const session = await getSession()
  
  return <UsersPageEnhanced currentUser={session?.user} />
}