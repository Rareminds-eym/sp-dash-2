// Server Component for Phase 3
import dynamic from 'next/dynamic'
import { VerificationListSkeleton } from '@/components/ui/chart-skeleton'

const RecentVerifications = dynamic(
  () => import('@/components/sections/RecentVerifications').then((mod) => mod.RecentVerifications),
  { ssr: false, loading: () => <VerificationListSkeleton /> }
)

export async function DashboardVerificationsSection({ verificationsPromise }) {
  const verifications = await verificationsPromise
  
  return <RecentVerifications verifications={verifications} />
}
