import UsersPage from '@/components/pages/UsersPage'
import { getSession } from '@/lib/supabase-server'

export const runtime = 'edge'

export default async function Users() {
  const session = await getSession()
  
  return <UsersPage currentUser={session?.user} />
}