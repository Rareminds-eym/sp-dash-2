import HybridPlanActivationPage from '@/components/pages/HybridPlanActivationPage'
import { getSession } from '@/lib/supabase-rls'


export default async function HybridPlan() {
    const session = await getSession()

    return <HybridPlanActivationPage currentUser={session?.user} />
}
