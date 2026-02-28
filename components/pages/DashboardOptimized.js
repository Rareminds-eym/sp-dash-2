"use client";

import { DashboardKPIs } from "@/components/sections/DashboardKPIs";
import { CardGridLoader, PageLoader } from "@/components/ui/page-loader";
import { Sparkles } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";

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

export default function DashboardOptimized({ user, initialData }) {
  const [metrics, setMetrics] = useState(initialData?.metrics || null);
  const [trends, setTrends] = useState(initialData?.trends || []);
  const [stateData, setStateData] = useState(initialData?.stateData || []);
  const [recentVerifications, setRecentVerifications] = useState([]);
  const [placementData, setPlacementData] = useState(initialData?.placementData || null);
  const [loading, setLoading] = useState(!initialData);

  useEffect(() => {
    if (!initialData) {
      fetchDashboardData();
    } else {
      // Background updates if needed
      fetchRecentVerifications();
    }
  }, [initialData]);

  const fetchRecentVerifications = () => {
    fetch("/api/verifications")
      .then(res => res.ok ? res.json() : [])
      .then(data => setRecentVerifications(Array.isArray(data) ? data.slice(0, 10) : []))
      .catch(err => {
        console.error("Error fetching verifications:", err);
        setRecentVerifications([]);
      });
  };

  const fetchDashboardData = async () => {
    try {
      // Fetch critical data in parallel
      const [metricsRes, trendsRes, stateRes, placementRes] = await Promise.all([
        fetch("/api/metrics"),
        fetch("/api/analytics/trends"),
        fetch("/api/analytics/state-wise"),
        fetch("/api/analytics/placement-conversion")
      ]);

      // Parse JSON responses, with fallbacks for errors
      const metricsData = metricsRes.ok ? await metricsRes.json() : {};
      const trendsData = trendsRes.ok ? await trendsRes.json() : [];
      const stateDataRes = stateRes.ok ? await stateRes.json() : [];
      const placementDataRes = placementRes.ok ? await placementRes.json() : null;

      setMetrics(metricsData);
      setTrends(trendsData || []);
      setStateData(stateDataRes || []);
      setPlacementData(placementDataRes);
      setLoading(false);

      fetchRecentVerifications();

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setLoading(false);
    }
  };

  // Show loading while data is being fetched
  if (loading) {
    return <PageLoader message="Loading your dashboard..." />;
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

      {/* KPI Cards - Load immediately */}
      <Suspense fallback={<CardGridLoader count={6} columns={3} />}>
        <DashboardKPIs metrics={metrics} placementData={placementData} />
      </Suspense>

      {/* Charts - Lazy loaded */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Suspense fallback={<CardGridLoader count={1} columns={1} />}>
          <EmployabilityChart data={trends} />
        </Suspense>

        <Suspense fallback={<CardGridLoader count={1} columns={1} />}>
          <StateDistributionChart data={stateData} />
        </Suspense>
      </div>

      {/* Recent Verifications - Lazy loaded */}
      <Suspense fallback={<CardGridLoader count={3} columns={1} />}>
        <RecentVerifications verifications={recentVerifications} />
      </Suspense>
    </div>
  );
}