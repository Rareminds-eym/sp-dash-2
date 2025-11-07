// Server Component for Phase 3
import { Suspense, lazy } from 'react'
import dynamic from 'next/dynamic'
import { ChartSkeleton } from '@/components/ui/chart-skeleton'

// Use dynamic import for client components in server components
const EmployabilityChart = dynamic(
  () => import('@/components/charts/DashboardCharts').then((mod) => mod.EmployabilityChart),
  { ssr: false, loading: () => <ChartSkeleton title subtitle /> }
)

const StateDistributionChart = dynamic(
  () => import('@/components/charts/DashboardCharts').then((mod) => mod.StateDistributionChart),
  { ssr: false, loading: () => <ChartSkeleton title /> }
)

export async function DashboardChartSection({ trendsPromise, stateDataPromise }) {
  const [trends, stateData] = await Promise.all([trendsPromise, stateDataPromise])
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <EmployabilityChart data={trends} />
      <StateDistributionChart data={stateData} />
    </div>
  )
}
