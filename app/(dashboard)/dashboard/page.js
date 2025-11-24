import DashboardOptimized from '@/components/pages/DashboardOptimized'
import { getSession } from '@/lib/supabase-rls'
import { createRLSClient } from '@/lib/supabase-rls'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'edge'

async function getDashboardData() {
  // Temporary delay to demonstrate loader
  await new Promise(resolve => setTimeout(resolve, 3000));

  const { supabase } = await createRLSClient()

  // Fetch metrics
  const metrics = await getDashboardMetrics(supabase)

  // Fetch trends
  const { data: trendData } = await supabaseAdmin
    .from('metrics_snapshots')
    .select('*')
    .order('snapshotDate', { ascending: true })
    .limit(30)

  const trends = trendData?.map(m => ({
    date: m.snapshotDate,
    employability: parseFloat(m.employabilityIndex) || 0
  })) || []

  // Fetch state distribution
  // Fetch state distribution from universities and recruiters
  const [universitiesResult, recruitersResult] = await Promise.all([
    supabaseAdmin.from('universities').select('state').eq('isactive', true),
    supabaseAdmin.from('recruiters').select('state').eq('isactive', true)
  ])

  const combinedStateData = [
    ...(universitiesResult.data || []),
    ...(recruitersResult.data || [])
  ]

  // Process state data
  const stateMap = combinedStateData.reduce((acc, curr) => {
    const state = curr.state || 'Unknown'
    acc[state] = (acc[state] || 0) + 1
    return acc
  }, {})

  const processedStateData = Object.entries(stateMap)
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Fetch placement conversion
  // Note: Simplified for this example, ideally should be in a service
  const placementData = {
    total: metrics.registeredStudents || 0,
    placed: metrics.jobSecured || 0,
    rate: metrics.registeredStudents ? ((metrics.jobSecured / metrics.registeredStudents) * 100).toFixed(1) : 0
  }

  return {
    metrics,
    trends,
    stateData: processedStateData,
    placementData
  }
}

export default async function DashboardPage() {
  const session = await getSession()
  const initialData = await getDashboardData()

  return <DashboardOptimized user={session?.user} initialData={initialData} />
}
