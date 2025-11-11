"use client";

import { DashboardKPIs } from "@/components/sections/DashboardKPIs";
import { ChartSkeleton, KPICardSkeleton, VerificationListSkeleton } from "@/components/ui/chart-skeleton";
import { Sparkles } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";

// Shimmer effect component
function ShimmerEffect({ className = "" }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 dark:via-white/10 to-transparent"></div>
    </div>
  )
}

// Lazy load heavy chart components (Phase 2)
const EmployabilityChart = lazy(() =>
  import("@/components/charts/DashboardCharts").then((mod) => ({
    default: mod.EmployabilityChart,
  }))
);

const StateDistributionChart = lazy(() =>
  import("@/components/charts/DashboardCharts").then((mod) => ({
    default: mod.StateDistributionChart,
  }))
);

const RecentVerifications = lazy(() =>
  import("@/components/sections/RecentVerifications").then((mod) => ({
    default: mod.RecentVerifications,
  }))
);

export default function DashboardOptimized({ user }) {
  const [metrics, setMetrics] = useState(null);
  const [trends, setTrends] = useState([]);
  const [stateData, setStateData] = useState([]);
  const [recentVerifications, setRecentVerifications] = useState([]);
  const [placementData, setPlacementData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch critical data in parallel
      const [metricsRes, trendsRes, stateRes, placementRes] = await Promise.all([
        fetch("/api/metrics"),
        fetch("/api/analytics/trends"),
        fetch("/api/analytics/state-wise"),
        fetch("/api/analytics/placement-conversion")
      ]);

      // Check for errors in responses
      if (!metricsRes.ok) {
        console.error('Metrics API error:', metricsRes.status);
      }
      if (!trendsRes.ok) {
        console.error('Trends API error:', trendsRes.status);
      }
      if (!stateRes.ok) {
        console.error('State API error:', stateRes.status);
      }
      if (!placementRes.ok) {
        console.error('Placement API error:', placementRes.status);
      }

      const metricsData = await metricsRes.json();
      const trendsData = await trendsRes.json();
      const stateDataRes = await stateRes.json();
      const placementDataRes = await placementRes.json();

      console.log('Dashboard data loaded:', {
        metrics: metricsData,
        trends: trendsData?.length,
        states: stateDataRes?.length,
        placement: placementDataRes
      });

      setMetrics(metricsData);
      setTrends(trendsData);
      setStateData(stateDataRes);
      setPlacementData(placementDataRes);
      setLoading(false);

      // Check if we need to update the snapshot in background
      const today = new Date().toISOString().split('T')[0];
      const shouldUpdate = 
        metricsData.source === 'dynamic' || 
        (metricsData.snapshotDate && metricsData.snapshotDate !== today);

      if (shouldUpdate) {
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

  // Show loading skeleton while data is being fetched
  if (loading) {
    return (
      <div className="space-y-8">
        {/* Welcome Section Skeleton with Shimmer */}
        <div className="relative overflow-hidden bg-gradient-to-br from-campaign-blue1 via-campaign-blue2 to-campaign-red rounded-3xl p-8 text-white shadow-2xl shadow-campaign-blue1/25">
          <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent"></div>
          <ShimmerEffect className="absolute inset-0" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16 animate-ping opacity-20"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12 animate-ping opacity-20" style={{ animationDelay: '0.5s' }}></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                <Sparkles className="h-6 w-6 text-white animate-spin" style={{ animationDuration: '3s' }} />
              </div>
              <div className="space-y-3">
                <div className="relative h-8 w-72 bg-white/20 rounded-lg overflow-hidden">
                  <ShimmerEffect />
                </div>
                <div className="relative h-5 w-96 bg-white/10 rounded-lg overflow-hidden">
                  <ShimmerEffect />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => <KPICardSkeleton key={i} />)}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ChartSkeleton title subtitle />
          <ChartSkeleton title />
        </div>

        {/* Recent Verifications Skeleton */}
        <VerificationListSkeleton />
      </div>
    );
  }

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

      {/* KPI Cards - Load immediately (no lazy loading for above-the-fold content) */}
      <Suspense fallback={
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => <KPICardSkeleton key={i} />)}
        </div>
      }>
        <DashboardKPIs metrics={metrics} placementData={placementData} />
      </Suspense>

      {/* Charts - Lazy loaded (Phase 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Suspense fallback={<ChartSkeleton title subtitle />}>
          <EmployabilityChart data={trends} />
        </Suspense>

        <Suspense fallback={<ChartSkeleton title />}>
          <StateDistributionChart data={stateData} />
        </Suspense>
      </div>

      {/* Recent Verifications - Lazy loaded (Phase 2) */}
      <Suspense fallback={<VerificationListSkeleton />}>
        <RecentVerifications verifications={recentVerifications} />
      </Suspense>
    </div>
  );
}