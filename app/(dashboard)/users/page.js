import UsersPage from '@/components/pages/UsersPage'
import { getSession } from '@/lib/session'

export default async function Users() {
  const session = await getSession()
  
  return <UsersPage currentUser={session?.user} />
}