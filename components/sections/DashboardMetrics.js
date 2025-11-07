// Server Component for Phase 3
import { DashboardKPIs } from './DashboardKPIs'
import { KPICardSkeleton } from '@/components/ui/chart-skeleton'

export async function DashboardMetrics({ metricsPromise }) {
  const metrics = await metricsPromise
  
  if (!metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5].map((i) => <KPICardSkeleton key={i} />)}
      </div>
    )
  }
  
  return <DashboardKPIs metrics={metrics} />
}
