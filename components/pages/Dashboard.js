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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
            <Card key={index} className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`${card.color} p-3 rounded-lg`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-medium ${
                    card.trend === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {card.trend === 'up' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    {card.change}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{card.title}</p>
                  <p className="text-3xl font-bold">{card.value}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trends Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trends.length > 0 ? trends : [
                { date: '2025-01', employability: 75, aiVerification: 70 },
                { date: '2025-02', employability: 78, aiVerification: 73 },
                { date: '2025-03', employability: 80, aiVerification: 76 },
                { date: '2025-04', employability: 82, aiVerification: 78 },
              ]}>
                <defs>
                  <linearGradient id="colorEmploy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorAI" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="employability" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorEmploy)" name="Employability Index" />
                <Area type="monotone" dataKey="aiVerification" stroke="#3b82f6" fillOpacity={1} fill="url(#colorAI)" name="AI Verification %" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* State-wise Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>State-wise Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stateData.length > 0 ? stateData : [
                { state: 'Delhi', count: 8 },
                { state: 'Maharashtra', count: 12 },
                { state: 'Karnataka', count: 10 },
                { state: 'Tamil Nadu', count: 7 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="state" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" name="Organizations" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Verifications */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Verifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentVerifications.length > 0 ? (
              recentVerifications.map((verification) => (
                <div key={verification.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      verification.action === 'verify' ? 'bg-green-100' :
                      verification.action === 'reject' ? 'bg-red-100' :
                      verification.action === 'suspend' ? 'bg-orange-100' :
                      'bg-blue-100'
                    }`}>
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{verification.action.charAt(0).toUpperCase() + verification.action.slice(1)} - {verification.targetTable}</p>
                      <p className="text-sm text-muted-foreground">{verification.note}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{verification.users?.email || 'System'}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(verification.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No recent verifications</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
