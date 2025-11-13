'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Sparkles, LayoutDashboard } from 'lucide-react'

// Shimmer effect component
function ShimmerEffect({ className = "" }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 dark:via-white/10 to-transparent"></div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome Section Skeleton with Shimmer */}
      <div className="relative overflow-hidden bg-gradient-to-br from-campaign-blue1 via-campaign-blue2 to-campaign-red rounded-3xl p-8 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent"></div>
        <ShimmerEffect className="absolute inset-0" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12 animate-pulse"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Sparkles className="h-6 w-6 text-white animate-pulse" />
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

      {/* KPI Cards Skeleton with Modern Shimmer */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="neu-card relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
            <ShimmerEffect className="absolute inset-0 opacity-50" />
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="relative w-14 h-14 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-2xl overflow-hidden">
                  <ShimmerEffect />
                  <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-blue-200/50 to-purple-200/50 dark:from-blue-800/50 dark:to-purple-800/50"></div>
                </div>
                <div className="relative w-16 h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <ShimmerEffect />
                </div>
              </div>
              <div className="space-y-3">
                <div className="relative h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                  <ShimmerEffect />
                </div>
                <div className="relative h-10 w-24 bg-gray-300 dark:bg-gray-600 rounded overflow-hidden">
                  <ShimmerEffect />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Skeleton with Animated Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {[1, 2].map((chartIndex) => (
          <Card key={chartIndex} className="neu-card relative overflow-hidden">
            <ShimmerEffect className="absolute inset-0 opacity-30" />
            <CardHeader className="pb-4 relative z-10">
              <div className="relative h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                <ShimmerEffect />
              </div>
              <div className="relative h-4 w-64 bg-gray-100 dark:bg-gray-800 rounded mt-2 overflow-hidden">
                <ShimmerEffect />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="h-80 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl flex items-end justify-around p-4 gap-2 overflow-hidden">
                {[40, 60, 45, 80, 55, 70, 50, 65].map((height, idx) => (
                  <div
                    key={idx}
                    className="relative w-full rounded-t-lg overflow-hidden"
                    style={{ height: `${height}%` }}
                  >
                    <div 
                      className="absolute inset-0 bg-gradient-to-t from-blue-300 to-purple-300 dark:from-blue-700 dark:to-purple-700 animate-pulse"
                      style={{ animationDelay: `${idx * 150}ms` }}
                    ></div>
                    <ShimmerEffect />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity Skeleton */}
      <Card className="neu-card relative overflow-hidden">
        <ShimmerEffect className="absolute inset-0 opacity-30" />
        <CardHeader className="relative z-10">
          <div className="relative h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
            <ShimmerEffect />
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <div className="relative w-12 h-12 bg-gradient-to-br from-blue-200 to-purple-200 dark:from-blue-800 dark:to-purple-800 rounded-xl overflow-hidden flex-shrink-0">
                  <ShimmerEffect />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="relative h-4 w-full bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                    <ShimmerEffect />
                  </div>
                  <div className="relative h-3 w-2/3 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                    <ShimmerEffect />
                  </div>
                </div>
                <div className="relative h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <ShimmerEffect />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function TableSkeleton({ rows = 10 }) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative h-10 w-64 bg-white/50 dark:bg-slate-800/50 rounded-xl overflow-hidden">
            <ShimmerEffect />
          </div>
          <div className="relative h-10 w-32 bg-white/50 dark:bg-slate-800/50 rounded-xl overflow-hidden">
            <ShimmerEffect />
          </div>
        </div>
        <div className="relative h-10 w-40 bg-gradient-to-r from-blue-200 to-purple-200 dark:from-blue-800 dark:to-purple-800 rounded-xl overflow-hidden">
          <ShimmerEffect />
        </div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="neu-card relative overflow-hidden">
            <ShimmerEffect className="absolute inset-0 opacity-50" />
            <CardContent className="p-6 relative z-10">
              <div className="space-y-3">
                <div className="relative h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                  <ShimmerEffect />
                </div>
                <div className="relative h-8 w-16 bg-gray-300 dark:bg-gray-600 rounded overflow-hidden">
                  <ShimmerEffect />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table Skeleton */}
      <Card className="neu-card relative overflow-hidden">
        <ShimmerEffect className="absolute inset-0 opacity-30" />
        <CardContent className="p-6 relative z-10">
          <div className="space-y-4">
            {/* Table Header */}
            <div className="grid grid-cols-4 gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                  <ShimmerEffect />
                </div>
              ))}
            </div>
            {/* Table Rows */}
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="grid grid-cols-4 gap-4 py-4 border-b border-gray-100 dark:border-gray-800 last:border-0">
                {[1, 2, 3, 4].map((j) => (
                  <div
                    key={j}
                    className="relative h-4 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden"
                    style={{ animationDelay: `${(i * 4 + j) * 50}ms` }}
                  >
                    <ShimmerEffect />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pagination Skeleton */}
      <div className="flex items-center justify-between">
        <div className="relative h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
          <ShimmerEffect />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="relative h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
              <ShimmerEffect />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SimpleSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative p-3 bg-gradient-to-br from-blue-200 to-purple-200 dark:from-blue-800 dark:to-purple-800 rounded-2xl overflow-hidden">
          <LayoutDashboard className="h-6 w-6 text-white" />
          <ShimmerEffect />
        </div>
        <div className="space-y-2">
          <div className="relative h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
            <ShimmerEffect />
          </div>
          <div className="relative h-4 w-64 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
            <ShimmerEffect />
          </div>
        </div>
      </div>

      {/* Content Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="neu-card relative overflow-hidden">
            <ShimmerEffect className="absolute inset-0 opacity-40" />
            <CardHeader className="relative z-10">
              <div className="relative h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                <ShimmerEffect />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="space-y-3">
                <div className="relative h-4 w-full bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                  <ShimmerEffect />
                </div>
                <div className="relative h-4 w-3/4 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                  <ShimmerEffect />
                </div>
                <div className="relative h-4 w-1/2 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                  <ShimmerEffect />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Large Content Block */}
      <Card className="neu-card relative overflow-hidden">
        <ShimmerEffect className="absolute inset-0 opacity-30" />
        <CardHeader className="relative z-10">
          <div className="relative h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
            <ShimmerEffect />
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/30">
                <div className="relative w-12 h-12 bg-gradient-to-br from-blue-200 to-purple-200 dark:from-blue-800 dark:to-purple-800 rounded-xl overflow-hidden flex-shrink-0">
                  <ShimmerEffect />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="relative h-4 w-full bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                    <ShimmerEffect />
                  </div>
                  <div className="relative h-3 w-2/3 bg-gray-50 dark:bg-gray-900 rounded overflow-hidden">
                    <ShimmerEffect />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function SettingsSkeleton() {
  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in duration-500">
      {/* Profile Settings Card */}
      <Card className="neu-card relative overflow-hidden">
        <ShimmerEffect className="absolute inset-0 opacity-30" />
        <CardHeader className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="relative h-7 w-40 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
              <ShimmerEffect />
            </div>
            <div className="relative h-9 w-20 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
              <ShimmerEffect />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="relative h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                  <ShimmerEffect />
                </div>
                <div className="relative h-10 w-full bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden">
                  <ShimmerEffect />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings Card */}
      <Card className="neu-card relative overflow-hidden">
        <ShimmerEffect className="absolute inset-0 opacity-30" />
        <CardHeader className="relative z-10">
          <div className="relative h-7 w-48 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
            <ShimmerEffect />
          </div>
        </CardHeader>
        <CardContent className="space-y-4 relative z-10">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <div className="space-y-2 flex-1">
                <div className="relative h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                  <ShimmerEffect />
                </div>
                <div className="relative h-4 w-64 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                  <ShimmerEffect />
                </div>
              </div>
              <div className="relative h-6 w-11 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
                <ShimmerEffect />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Security Card */}
      <Card className="neu-card relative overflow-hidden">
        <ShimmerEffect className="absolute inset-0 opacity-30" />
        <CardHeader className="relative z-10">
          <div className="relative h-7 w-24 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
            <ShimmerEffect />
          </div>
        </CardHeader>
        <CardContent className="space-y-4 relative z-10">
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1">
              <div className="relative h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                <ShimmerEffect />
              </div>
              <div className="relative h-4 w-56 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                <ShimmerEffect />
              </div>
            </div>
            <div className="relative h-9 w-20 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
              <ShimmerEffect />
            </div>
          </div>
          <div className="space-y-2">
            <div className="relative h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
              <ShimmerEffect />
            </div>
            <div className="relative h-10 w-full bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
              <ShimmerEffect />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
