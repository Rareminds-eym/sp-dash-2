import RecruitersPage from '@/components/pages/RecruitersPage'
import { getSession } from '@/lib/session'

export const runtime = 'edge'

export default async function Recruiters() {
  const session = await getSession()
  
  return <RecruitersPage currentUser={session?.user} />
}
