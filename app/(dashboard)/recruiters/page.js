import RecruitersPageEnhanced from '@/components/pages/RecruitersPageEnhanced'
import { getSession } from '@/lib/supabase-rls'

export const runtime = 'edge'

export default async function Recruiters() {
    const session = await getSession()

    return <RecruitersPageEnhanced currentUser={session?.user} />
}
