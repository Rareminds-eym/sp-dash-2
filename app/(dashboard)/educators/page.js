import EducatorManagementPage from '@/components/pages/EducatorManagementPage'
import { getSession } from '@/lib/supabase-rls'

export default async function Educators() {
  const session = await getSession()

  return <EducatorManagementPage currentUser={session?.user} />
}
