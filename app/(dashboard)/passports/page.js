import PassportsPage from '@/components/pages/PassportsPage'
import { getSession } from '@/lib/session'

export default async function Passports() {
  const session = await getSession()
  
  return <PassportsPage currentUser={session?.user} />
}