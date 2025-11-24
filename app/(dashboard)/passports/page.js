import PassportsPageEnhanced from '@/components/pages/PassportsPageEnhanced'
import { getSession } from '@/lib/supabase-rls'

export const runtime = 'edge'

export default async function Passports() {
  const session = await getSession()

  return <PassportsPageEnhanced currentUser={session?.user} />
}
