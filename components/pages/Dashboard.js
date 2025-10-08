'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  GraduationCap, 
  Users, 
  Award, 
  TrendingUp, 
  CheckCircle2, 
  Building2,
  ArrowUp,
  ArrowDown,
  Activity,
  Sparkles
} from 'lucide-react'
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts'

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label, labelFormatter, formatter }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-4 rounded-2xl shadow-xl border border-white/20 dark:border-slate-700/50">
        <p className="font-semibold text-slate-900 dark:text-white mb-2">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            ></div>
            <span className="text-slate-700 dark:text-slate-300">
              {entry.name}: {formatter ? formatter(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function Dashboard({ user }) {
  const [metrics, setMetrics] = useState(null)
  const [trends, setTrends] = useState([])
  const [stateData, setStateData] = useState([])
  const [recentVerifications, setRecentVerifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const [metricsRes, trendsRes, stateRes, verificationsRes] = await Promise.all([
        fetch('/api/metrics'),
        fetch('/api/analytics/trends'),
        fetch('/api/analytics/state-wise'),
        fetch('/api/verifications')
      ])

      const metricsData = await metricsRes.json()
      const trendsData = await trendsRes.json()
      const stateDataRes = await stateRes.json()
      const verificationsData = await verificationsRes.json()

      setMetrics(metricsData)
      setTrends(trendsData)
      setStateData(stateDataRes)
      setRecentVerifications(verificationsData.slice(0, 10))
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-800 rounded-full animate-spin">
            <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-blue-600 rounded-full animate-spin"></div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-blue-600 animate-pulse" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">Loading Dashboard</p>
          <p className="text-sm text-slate-500 dark:text-slate-500">Fetching your data...</p>
        </div>
      </div>
    )
  }

  const kpiCards = [
    {
      title: 'Universities',
      value: metrics?.activeUniversities || 0,
      icon: GraduationCap,
      color: 'bg-blue-500',
      change: '+12%',
      trend: 'up'
    },
    {
      title: 'Students',
      value: metrics?.registeredStudents || 0,
      icon: Users,
      color: 'bg-green-500',
      change: '+18%',
      trend: 'up'
    },
    {
      title: 'Verified Passports',
      value: metrics?.verifiedPassports || 0,
      icon: Award,
      color: 'bg-purple-500',
      change: '+8%',
      trend: 'up'
    },
    {
      title: 'AI Verification',
      value: `${parseFloat(metrics?.aiVerifiedPercent || 0).toFixed(1)}%`,
      icon: CheckCircle2,
      color: 'bg-orange-500',
      change: '+5%',
      trend: 'up'
    },
    {
      title: 'Employability Index',
      value: `${parseFloat(metrics?.employabilityIndex || 0).toFixed(1)}%`,
      icon: TrendingUp,
      color: 'bg-indigo-500',
      change: '+3%',
      trend: 'up'
    },
    {
      title: 'Active Recruiters',
      value: metrics?.activeRecruiters || 0,
      icon: Building2,
      color: 'bg-pink-500',
      change: '+10%',
      trend: 'up'
    },
  ]

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 rounded-3xl p-8 text-white shadow-2xl shadow-blue-500/25">
        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent"></div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Welcome back, {user.email.split('@')[0]}!</h1>
              <p className="text-blue-100 text-lg">Here's what's happening with your platform today.</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {kpiCards.map((card, index) => {
          const Icon = card.icon
          return (
            <Card 
              key={index} 
              className="group overflow-hidden bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-white/20 dark:border-slate-700/50 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 hover:shadow-2xl hover:shadow-slate-300/50 dark:hover:shadow-slate-800/50 transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1"
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className={`${card.color} p-4 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <div className={`flex items-center gap-2 text-sm font-semibold px-3 py-1 rounded-full ${
                    card.trend === 'up' 
                      ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30' 
                      : 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
                  }`}>
                    {card.trend === 'up' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    {card.change}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2 font-medium">{card.title}</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent group-hover:scale-105 transition-transform duration-300 origin-left">
                    {card.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Trends Chart */}
        <Card className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-white/20 dark:border-slate-700/50 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 hover:shadow-2xl transition-all duration-500">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl shadow-lg">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 bg-clip-text text-transparent">
                Performance Trends
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart 
                data={trends.length > 0 ? trends : [
                  { date: '2025-01', employability: 75, aiVerification: 70 },
                  { date: '2025-02', employability: 78, aiVerification: 73 },
                  { date: '2025-03', employability: 80, aiVerification: 76 },
                  { date: '2025-04', employability: 82, aiVerification: 78 },
                ]}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorEmploy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.9}/>
                    <stop offset="50%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="colorAI" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.9}/>
                    <stop offset="50%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="employability" 
                  stroke="#8b5cf6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorEmploy)" 
                  name="Employability Index"
                />
                <Area 
                  type="monotone" 
                  dataKey="aiVerification" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorAI)" 
                  name="AI Verification %"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* State-wise Distribution */}
        <Card className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-white/20 dark:border-slate-700/50 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 hover:shadow-2xl transition-all duration-500">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                <BarChart className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                State-wise Distribution
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart 
                data={stateData.length > 0 ? stateData : [
                  { state: 'Delhi', count: 8 },
                  { state: 'Maharashtra', count: 12 },
                  { state: 'Karnataka', count: 10 },
                  { state: 'Tamil Nadu', count: 7 },
                ]}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#1e40af" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
                <XAxis 
                  dataKey="state" 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="count" 
                  fill="url(#barGradient)" 
                  name="Organizations"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Verifications */}
      <Card className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-white/20 dark:border-slate-700/50 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <CardTitle className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">
              Recent Verifications
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentVerifications.length > 0 ? (
              recentVerifications.map((verification, index) => (
                <div 
                  key={verification.id} 
                  className="group flex items-center justify-between p-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-slate-700/50 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl shadow-lg transition-transform duration-300 group-hover:scale-110 ${
                      verification.action === 'verify' ? 'bg-gradient-to-br from-green-500 to-emerald-600' :
                      verification.action === 'reject' ? 'bg-gradient-to-br from-red-500 to-rose-600' :
                      verification.action === 'suspend' ? 'bg-gradient-to-br from-orange-500 to-amber-600' :
                      'bg-gradient-to-br from-blue-500 to-indigo-600'
                    }`}>
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {verification.action.charAt(0).toUpperCase() + verification.action.slice(1)} - {verification.targetTable}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{verification.note}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {verification.users?.email || 'System'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500">
                      {new Date(verification.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-400 to-gray-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Activity className="h-8 w-8 text-white opacity-50" />
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-lg font-medium">No recent verifications</p>
                <p className="text-slate-500 dark:text-slate-500 text-sm">Verification activity will appear here</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
