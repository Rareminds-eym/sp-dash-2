'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { 
  Download, 
  FileSpreadsheet, 
  Building2, 
  Users, 
  TrendingUp, 
  MapPin,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Minus,
  Eye,
  Search,
  UserCheck,
  Award,
  Target,
  Briefcase,
  BarChart3,
  Activity,
  PieChart as PieChartIcon,
  Globe,
  Brain,
  Rocket,
  Star,
  Trophy,
  Zap,
  TrendingDown
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts'

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-4 rounded-2xl shadow-xl border border-white/20 dark:border-slate-700/50">
        <p className="font-semibold text-slate-900 dark:text-white mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            ></div>
            <span className="text-slate-700 dark:text-slate-300">
              {entry.name}: {entry.value}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function ReportsPage() {
  const [loading, setLoading] = useState({
    university: true,
    recruiter: true,
    placement: true,
    heatmap: true,
    insights: true
  })
  const [analyticsData, setAnalyticsData] = useState({
    universityReports: [],
    recruiterMetrics: {},
    placementConversion: {},
    stateHeatmap: [],
    aiInsights: {}
  })
  const [activeTab, setActiveTab] = useState('universities')
  const { toast } = useToast()

  useEffect(() => {
    // Fetch data progressively - start with first tab
    fetchTabData('universities')
    
    // Listen for refresh events from the layout
    const handleRefreshEvent = () => {
      fetchTabData(activeTab)
    }
    window.addEventListener('refreshPage', handleRefreshEvent)
    
    return () => {
      window.removeEventListener('refreshPage', handleRefreshEvent)
    }
  }, [activeTab])

  const fetchTabData = async (tab) => {
    // If data already loaded for this tab, skip
    if (tab === 'universities' && analyticsData.universityReports.length > 0) return
    if (tab === 'recruiters' && Object.keys(analyticsData.recruiterMetrics).length > 0) return
    if (tab === 'placements' && Object.keys(analyticsData.placementConversion).length > 0) return
    if (tab === 'heatmap' && analyticsData.stateHeatmap.length > 0) return
    if (tab === 'insights' && Object.keys(analyticsData.aiInsights).length > 0) return

    try {
      switch(tab) {
        case 'universities':
          setLoading(prev => ({ ...prev, university: true }))
          const universityRes = await fetch('/api/analytics/university-reports')
          const universityReports = await universityRes.json()
          setAnalyticsData(prev => ({ ...prev, universityReports }))
          setLoading(prev => ({ ...prev, university: false }))
          break
        
        case 'recruiters':
          setLoading(prev => ({ ...prev, recruiter: true }))
          const recruiterRes = await fetch('/api/analytics/recruiter-metrics')
          const recruiterMetrics = await recruiterRes.json()
          setAnalyticsData(prev => ({ ...prev, recruiterMetrics }))
          setLoading(prev => ({ ...prev, recruiter: false }))
          break
        
        case 'placements':
          setLoading(prev => ({ ...prev, placement: true }))
          const placementRes = await fetch('/api/analytics/placement-conversion')
          const placementConversion = await placementRes.json()
          setAnalyticsData(prev => ({ ...prev, placementConversion }))
          setLoading(prev => ({ ...prev, placement: false }))
          break
        
        case 'heatmap':
          setLoading(prev => ({ ...prev, heatmap: true }))
          const heatmapRes = await fetch('/api/analytics/state-heatmap')
          const stateHeatmap = await heatmapRes.json()
          setAnalyticsData(prev => ({ ...prev, stateHeatmap }))
          setLoading(prev => ({ ...prev, heatmap: false }))
          break
        
        case 'insights':
          setLoading(prev => ({ ...prev, insights: true }))
          const insightsRes = await fetch('/api/analytics/ai-insights')
          const aiInsights = await insightsRes.json()
          setAnalyticsData(prev => ({ ...prev, aiInsights }))
          setLoading(prev => ({ ...prev, insights: false }))
          break
      }
    } catch (error) {
      console.error(`Error fetching ${tab} data:`, error)
      toast({
        title: 'Error',
        description: `Failed to load ${tab} data`,
        variant: 'destructive'
      })
      // Set loading to false even on error
      const loadingKey = tab === 'universities' ? 'university' : 
                        tab === 'recruiters' ? 'recruiter' :
                        tab === 'placements' ? 'placement' :
                        tab === 'heatmap' ? 'heatmap' : 'insights'
      setLoading(prev => ({ ...prev, [loadingKey]: false }))
    }
  }

  const handleTabChange = (value) => {
    setActiveTab(value)
    // Prefetch data for the selected tab
    fetchTabData(value)
  }

  const handleExport = async (type, section) => {
    try {
      toast({
        title: 'Export Started',
        description: `Preparing ${section} export...`
      })

      let endpoint = ''
      let filename = ''

      // Map section to API endpoint
      switch(section) {
        case 'University Reports':
          endpoint = '/api/analytics/university-reports/export'
          filename = `university-reports-${new Date().toISOString().split('T')[0]}.csv`
          break
        case 'Recruiter Metrics':
          endpoint = '/api/analytics/recruiter-metrics/export'
          filename = `recruiter-metrics-${new Date().toISOString().split('T')[0]}.csv`
          break
        case 'Placement Analytics':
          endpoint = '/api/analytics/placement-conversion/export'
          filename = `placement-conversion-${new Date().toISOString().split('T')[0]}.csv`
          break
        case 'State Analytics':
          endpoint = '/api/analytics/state-heatmap/export'
          filename = `state-heatmap-${new Date().toISOString().split('T')[0]}.csv`
          break
        case 'AI Insights':
          endpoint = '/api/analytics/ai-insights/export'
          filename = `ai-insights-${new Date().toISOString().split('T')[0]}.csv`
          break
        default:
          throw new Error('Unknown section')
      }

      const response = await fetch(endpoint)
      
      if (!response.ok) {
        throw new Error('Export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)

      toast({
        title: 'Export Complete',
        description: `${section} file has been downloaded successfully`
      })
    } catch (error) {
      console.error('Export error:', error)
      toast({
        title: 'Export Failed',
        description: 'Unable to export data. Please try again.',
        variant: 'destructive'
      })
    }
  }

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'rising': return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'declining': return <TrendingDown className="h-4 w-4 text-red-500" />
      default: return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  const colors = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899']

  const isAnyLoading = Object.values(loading).some(val => val === true)

  const handleRefresh = () => {
    // Refresh current active tab data
    fetchTabData(activeTab)
  }

  return (
    <div className="space-y-6">

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="universities" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Universities
          </TabsTrigger>
          <TabsTrigger value="recruiters" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Recruiters
          </TabsTrigger>
          <TabsTrigger value="placements" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Placements
          </TabsTrigger>
          <TabsTrigger value="heatmap" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Heat Map
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Insights
          </TabsTrigger>
        </TabsList>

        {/* University Reports Tab */}
        <TabsContent value="universities" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              University-wise Reports
            </h3>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleExport('CSV', 'University Reports')}
                disabled={loading.university}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            {loading.university ? (
              // Loading skeleton
              Array.from({ length: 3 }).map((_, index) => (
                <Card key={index} className="neu-card animate-pulse">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="h-5 w-48 bg-slate-200 dark:bg-slate-700 rounded"></div>
                        <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded"></div>
                      </div>
                      <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="text-center space-y-2">
                          <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded mx-auto"></div>
                          <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded mx-auto"></div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              analyticsData.universityReports.map((university, index) => (
                <Card key={university.universityId} className="neu-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{university.universityName}</CardTitle>
                      <p className="text-sm text-muted-foreground">{university.state}</p>
                    </div>
                    <Badge variant="secondary">{university.enrollmentCount} Students</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{university.enrollmentCount}</div>
                      <div className="text-xs text-muted-foreground">Enrollment</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{university.verifiedPassports}</div>
                      <div className="text-xs text-muted-foreground">Verified</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{university.completionRate}%</div>
                      <div className="text-xs text-muted-foreground">Completion</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{university.verificationRate}%</div>
                      <div className="text-xs text-muted-foreground">Verification</div>
                    </div>
                  </div>
                  
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Completion Rate</span>
                      <span>{university.completionRate}%</span>
                    </div>
                    <Progress value={university.completionRate} className="h-2" />
                  </div>
                </CardContent>
              </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Recruiter Metrics Tab */}
        <TabsContent value="recruiters" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium flex items-center gap-2 text-muted-foreground">
              <Activity className="h-4 w-4" />
              Recruiter Engagement Metrics
            </h3>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleExport('CSV', 'Recruiter Metrics')}
                disabled={loading.recruiter}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="neu-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                    <Search className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{analyticsData.recruiterMetrics.totalSearches || 0}</div>
                    <div className="text-xs text-muted-foreground">Total Searches</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="neu-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                    <Eye className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{analyticsData.recruiterMetrics.profileViews || 0}</div>
                    <div className="text-xs text-muted-foreground">Profile Views</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="neu-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                    <UserCheck className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{analyticsData.recruiterMetrics.contactAttempts || 0}</div>
                    <div className="text-xs text-muted-foreground">Contacts</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="neu-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                    <Award className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{analyticsData.recruiterMetrics.shortlisted || 0}</div>
                    <div className="text-xs text-muted-foreground">Shortlisted</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="neu-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                    <Briefcase className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{analyticsData.recruiterMetrics.hireIntents || 0}</div>
                    <div className="text-xs text-muted-foreground">Hire Intents</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trends Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="neu-card">
              <CardHeader>
                <CardTitle>Monthly Engagement Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analyticsData.recruiterMetrics.searchTrends || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="month" stroke="#64748B" />
                    <YAxis stroke="#64748B" />
                    <Tooltip content={<CustomTooltip />} />
                    <Line 
                      type="monotone" 
                      dataKey="searches" 
                      stroke="#8B5CF6" 
                      strokeWidth={3}
                      dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 4 }}
                      name="Searches"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="views" 
                      stroke="#06B6D4" 
                      strokeWidth={3}
                      dot={{ fill: '#06B6D4', strokeWidth: 2, r: 4 }}
                      name="Views"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="contacts" 
                      stroke="#10B981" 
                      strokeWidth={3}
                      dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                      name="Contacts"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="neu-card">
              <CardHeader>
                <CardTitle>Top Skills in Demand</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData.recruiterMetrics.topSkillsSearched || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="skill" stroke="#64748B" />
                    <YAxis stroke="#64748B" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="searches" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Searches" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Placement Conversion Tab */}
        <TabsContent value="placements" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium flex items-center gap-2 text-muted-foreground">
              <Target className="h-4 w-4" />
              Placement Conversion Analytics
            </h3>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleExport('CSV', 'Placement Analytics')}
                disabled={loading.placement}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversion Funnel */}
            <Card className="neu-card">
              <CardHeader>
                <CardTitle>Placement Conversion Funnel</CardTitle>
                <p className="text-sm text-muted-foreground">From verified profile to successful placement</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analyticsData.placementConversion.conversionFunnel?.map((stage, index) => (
                    <div key={stage.stage} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>{stage.stage}</span>
                        <span className="font-medium">{stage.count} ({stage.percentage}%)</span>
                      </div>
                      <Progress value={stage.percentage} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Monthly Conversions */}
            <Card className="neu-card">
              <CardHeader>
                <CardTitle>Monthly Conversion Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analyticsData.placementConversion.monthlyConversions || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="month" stroke="#64748B" />
                    <YAxis stroke="#64748B" />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="applied"
                      stackId="1"
                      stroke="#8B5CF6"
                      fill="#8B5CF6"
                      fillOpacity={0.6}
                      name="Applied"
                    />
                    <Area
                      type="monotone"
                      dataKey="hired"
                      stackId="2"
                      stroke="#10B981"
                      fill="#10B981"
                      fillOpacity={0.8}
                      name="Hired"
                    />
                    <Area
                      type="monotone"
                      dataKey="retained"
                      stackId="3"
                      stroke="#F59E0B"
                      fill="#F59E0B"
                      fillOpacity={0.8}
                      name="Retained"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* State Heat Map Tab */}
        <TabsContent value="heatmap" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium flex items-center gap-2 text-muted-foreground">
              <Globe className="h-4 w-4" />
              State/District Heat Map
            </h3>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleExport('CSV', 'State Analytics')}
                disabled={loading.heatmap}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            {analyticsData.stateHeatmap.map((state) => (
              <Card key={state.state} className="neu-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    {state.state}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-600">{state.universities}</div>
                      <div className="text-xs text-muted-foreground">Universities</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">{state.students}</div>
                      <div className="text-xs text-muted-foreground">Students</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-purple-600">{state.verifiedPassports}</div>
                      <div className="text-xs text-muted-foreground">Verified</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-orange-600">{state.engagementScore}</div>
                      <div className="text-xs text-muted-foreground">Engagement</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-red-600">{state.employabilityIndex}</div>
                      <div className="text-xs text-muted-foreground">Employability</div>
                    </div>
                  </div>
                  
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>Engagement Score</span>
                        <span>{state.engagementScore}/100</span>
                      </div>
                      <Progress value={state.engagementScore} className="h-2" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>Employability Index</span>
                        <span>{state.employabilityIndex}/100</span>
                      </div>
                      <Progress value={state.employabilityIndex} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* AI Insights Tab */}
        <TabsContent value="insights" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium flex items-center gap-2 text-muted-foreground">
              <Brain className="h-4 w-4" />
              AI Insight Panel
            </h3>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleExport('CSV', 'AI Insights')}
                disabled={loading.insights}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Emerging Skills */}
          <Card className="neu-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-purple-600" />
                Top Emerging Skill Clusters
              </CardTitle>
              <p className="text-sm text-muted-foreground">Skills showing highest growth in demand</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {analyticsData.aiInsights.emergingSkills?.map((skill, index) => (
                  <div key={skill.skill} className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="text-lg font-bold text-purple-600">#{index + 1}</div>
                      <div>
                        <div className="font-semibold">{skill.skill}</div>
                        <div className="text-sm text-muted-foreground">{skill.category}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={skill.growth.startsWith('+') ? 'default' : 'secondary'}>
                        {skill.growth}
                      </Badge>
                      {getTrendIcon(skill.trend)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Most Sought Skills */}
          <Card className="neu-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-600" />
                Most Sought Skill Tags
              </CardTitle>
              <p className="text-sm text-muted-foreground">Popular job roles and their market rates</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {analyticsData.aiInsights.soughtSkillTags?.map((tag, index) => (
                  <div key={tag.tag} className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/10 dark:to-cyan-900/10 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="text-lg font-bold text-blue-600">#{index + 1}</div>
                      <div>
                        <div className="font-semibold">{tag.tag}</div>
                        <div className="text-sm text-muted-foreground">{tag.mentions} mentions</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">₹{(tag.avgSalary / 100000).toFixed(1)}L</div>
                      <div className="text-xs text-muted-foreground">Avg Package</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Universities */}
          <Card className="neu-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-600" />
                Top Performing Universities
              </CardTitle>
              <p className="text-sm text-muted-foreground">Universities ranked by performance metrics</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {analyticsData.aiInsights.topUniversities?.map((uni, index) => (
                  <div key={uni.name} className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="text-xl font-bold text-green-600">#{index + 1}</div>
                      <div>
                        <div className="font-semibold">{uni.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {uni.placementRate}% placement • ₹{(uni.avgPackage / 100000).toFixed(1)}L avg package
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-bold text-purple-600">{uni.performanceScore}</div>
                        <div className="text-xs text-muted-foreground">Score</div>
                      </div>
                      {getTrendIcon(uni.trend)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
