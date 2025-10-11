"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Award,
  BarChart3,
  Building2,
  CheckCircle2,
  GraduationCap,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Custom Tooltip Component
const CustomTooltip = ({
  active,
  payload,
  label,
  labelFormatter,
  formatter,
}) => {
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
    );
  }
  return null;
};

export default function Dashboard({ user }) {
  const [metrics, setMetrics] = useState(null);
  const [trends, setTrends] = useState([]);
  const [stateData, setStateData] = useState([]);
  const [recentVerifications, setRecentVerifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch critical data in parallel - remove slow verifications call
      const [metricsRes, trendsRes, stateRes] = await Promise.all([
        fetch("/api/metrics"),
        fetch("/api/analytics/trends"),
        fetch("/api/analytics/state-wise"),
      ]);

      const metricsData = await metricsRes.json();
      const trendsData = await trendsRes.json();
      const stateDataRes = await stateRes.json();

      setMetrics(metricsData);
      setTrends(trendsData);
      setStateData(stateDataRes);
      setLoading(false);

      // Check if we need to update the snapshot in background
      const today = new Date().toISOString().split('T')[0];
      const shouldUpdate = 
        metricsData.source === 'dynamic' || 
        (metricsData.snapshotDate && metricsData.snapshotDate !== today);

      if (shouldUpdate) {
        // Trigger update in the background (don't wait for it)
        fetch("/api/update-metrics", { method: "POST" })
          .catch(err => console.error('Error updating metrics:', err));
      }

      // Load verifications in background after page is interactive
      fetch("/api/verifications")
        .then(res => res.json())
        .then(data => setRecentVerifications(data.slice(0, 10)))
        .catch(err => console.error("Error fetching verifications:", err));
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setLoading(false);
    }
  };

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
          <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">
            Loading Dashboard
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500">
            Fetching your data...
          </p>
        </div>
      </div>
    );
  }

  const kpiCards = [
    {
      title: "Active Recruiters",
      value: metrics?.activeRecruiters || 0,
      icon: Building2,
      color: "bg-campaign-blue1", // Using single campaign blue1 color
      change: "+10%",
      trend: "up",
    },
    {
      title: "Universities",
      value: metrics?.activeUniversities || 0,
      icon: GraduationCap,
      color: "bg-campaign-blue1", // Using single campaign blue1 color
      change: "+12%",
      trend: "up",
    },
    {
      title: "Students",
      value: metrics?.registeredStudents || 0,
      icon: Users,
      color: "bg-campaign-blue1", // Using single campaign blue1 color
      change: "+18%",
      trend: "up",
    },
    {
      title: "Verified Passports",
      value: metrics?.verifiedPassports || 0,
      icon: Award,
      color: "bg-campaign-blue1", // Using single campaign blue1 color
      change: "+8%",
      trend: "up",
    },
    {
      title: "Skill Verification",
      value: `${parseFloat(metrics?.aiVerifiedPercent || 0).toFixed(1)}%`,
      icon: CheckCircle2,
      color: "bg-campaign-blue1", // Using single campaign blue1 color
      change: "+5%",
      trend: "up",
    },
    {
      title: "Employability Index",
      value: `${parseFloat(metrics?.employabilityIndex || 0).toFixed(1)}%`,
      icon: TrendingUp,
      color: "bg-campaign-blue1", // Using single campaign blue1 color
      change: "+3%",
      trend: "up",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-campaign-blue1 via-campaign-blue2 to-campaign-red rounded-3xl p-8 text-white shadow-2xl shadow-campaign-blue1/25">
        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent"></div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">
                Welcome back
                {user?.email ? `, ${user.email.split("@")[0].charAt(0).toUpperCase() + user.email.split("@")[0].slice(1)}` : ''}
                !
              </h1>
              <p className="text-blue-100 text-lg">
                Here's what's happening with your platform today.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {kpiCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card
              key={index}
              className="neu-card group overflow-hidden"
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div
                    className={`${card.color} p-4 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300`}
                  >
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <div
                    className={`flex items-center gap-2 text-sm font-semibold px-3 py-1 rounded-full ${
                      card.trend === "up"
                        ? "text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30"
                        : "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30"
                    }`}
                  >
                    {card.trend === "up" ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    )}
                    {card.change}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2 font-medium">
                    {card.title}
                  </p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent group-hover:scale-105 transition-transform duration-300 origin-left">
                    {card.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Employability Index Chart */}
        <Card className="neu-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
              Employability Index Trend
            </CardTitle>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Monthly employability scores across all universities
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart
                data={
                  trends.length > 0
                    ? trends
                    : [
                        { date: "Jan", employability: 73 },
                        { date: "Feb", employability: 72 },
                        { date: "Mar", employability: 74 },
                        { date: "Apr", employability: 78 },
                        { date: "May", employability: 80 },
                        { date: "Jun", employability: 85 },
                        { date: "Jul", employability: 90 },
                        { date: "Aug", employability: 82 },
                        { date: "Sep", employability: 75 },
                        { date: "Oct", employability: 78 },
                        { date: "Nov", employability: 82 },
                        { date: "Dec", employability: 80 },
                      ]
                }
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorEmploy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.6} />
                    <stop
                      offset="100%"
                      stopColor="#6366f1"
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="#475569"
                  opacity={0.2}
                  vertical={true}
                  horizontal={true}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="employability"
                  stroke="#818cf8"
                  strokeWidth={2}
                  fill="url(#colorEmploy)"
                  name="Employability Index"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Skill Verification Chart */}
        <Card className="neu-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
              Skill Verification Trend
            </CardTitle>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Monthly Skill verification percentage across all verifications
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart
                data={
                  trends.length > 0
                    ? trends
                    : [
                        { date: "Jan", aiVerification: 68 },
                        { date: "Feb", aiVerification: 70 },
                        { date: "Mar", aiVerification: 72 },
                        { date: "Apr", aiVerification: 75 },
                        { date: "May", aiVerification: 77 },
                        { date: "Jun", aiVerification: 82 },
                        { date: "Jul", aiVerification: 87 },
                        { date: "Aug", aiVerification: 80 },
                        { date: "Sep", aiVerification: 73 },
                        { date: "Oct", aiVerification: 76 },
                        { date: "Nov", aiVerification: 80 },
                        { date: "Dec", aiVerification: 78 },
                      ]
                }
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorAI" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.6} />
                    <stop
                      offset="100%"
                      stopColor="#6366f1"
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="#475569"
                  opacity={0.2}
                  vertical={true}
                  horizontal={true}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="aiVerification"
                  stroke="#818cf8"
                  strokeWidth={2}
                  fill="url(#colorAI)"
                  name="Skill Verification %"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* State-wise Distribution */}
        <Card className="neu-card">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                State-wise Distribution
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={
                  stateData.length > 0
                    ? stateData
                    : [
                        { state: "Delhi", count: 8 },
                        { state: "Maharashtra", count: 12 },
                        { state: "Karnataka", count: 10 },
                        { state: "Tamil Nadu", count: 7 },
                      ]
                }
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#1e40af" />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  opacity={0.3}
                />
                <XAxis
                  dataKey="state"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#64748b" }}
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
      <Card className="neu-card">
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
                    <div
                      className={`p-3 rounded-2xl shadow-lg transition-transform duration-300 group-hover:scale-110 ${
                        verification.action === "verify"
                          ? "bg-gradient-to-br from-campaign-blue1 to-campaign-blue2"
                          : verification.action === "reject"
                          ? "bg-gradient-to-br from-campaign-red to-orange-600"
                          : verification.action === "suspend"
                          ? "bg-gradient-to-br from-campaign-gold to-amber-600"
                          : "bg-gradient-to-br from-campaign-blue1 to-campaign-blue2"
                      }`}
                    >
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {verification.action.charAt(0).toUpperCase() +
                          verification.action.slice(1)}{" "}
                        - {verification.targetTable}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {verification.note}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {verification.users?.email || "System"}
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
                <p className="text-slate-600 dark:text-slate-400 text-lg font-medium">
                  No recent verifications
                </p>
                <p className="text-slate-500 dark:text-slate-500 text-sm">
                  Verification activity will appear here
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
