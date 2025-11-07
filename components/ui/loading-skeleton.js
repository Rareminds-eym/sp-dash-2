'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Sparkles, LayoutDashboard } from 'lucide-react'

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome Section Skeleton */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 rounded-3xl p-8 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent"></div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Sparkles className="h-6 w-6 text-white animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-8 w-64 bg-white/20 rounded-lg animate-pulse"></div>
              <div className="h-5 w-96 bg-white/10 rounded-lg animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="neu-card animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-200 to-purple-200 dark:from-blue-800 dark:to-purple-800 rounded-2xl"></div>
                <div className="w-16 h-6 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-10 w-24 bg-gray-300 dark:bg-gray-600 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {[1, 2].map((i) => (
          <Card key={i} className="neu-card animate-pulse">
            <CardHeader className="pb-4">
              <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-4 w-64 bg-gray-100 dark:bg-gray-800 rounded mt-2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-80 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl flex items-end justify-around p-4 gap-2">
                {[40, 60, 45, 80, 55, 70, 50, 65].map((height, idx) => (
                  <div
                    key={idx}
                    className="bg-gradient-to-t from-blue-300 to-purple-300 dark:from-blue-700 dark:to-purple-700 rounded-t-lg w-full animate-pulse"
                    style={{ height: `${height}%`, animationDelay: `${idx * 100}ms` }}
                  ></div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 10 }) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-10 w-64 bg-white/50 dark:bg-slate-800/50 rounded-xl animate-pulse"></div>
          <div className="h-10 w-32 bg-white/50 dark:bg-slate-800/50 rounded-xl animate-pulse"></div>
        </div>
        <div className="h-10 w-40 bg-gradient-to-r from-blue-200 to-purple-200 dark:from-blue-800 dark:to-purple-800 rounded-xl animate-pulse"></div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="neu-card animate-pulse">
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-8 w-16 bg-gray-300 dark:bg-gray-600 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table Skeleton */}
      <Card className="neu-card">
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Table Header */}
            <div className="grid grid-cols-4 gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              ))}
            </div>
            {/* Table Rows */}
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="grid grid-cols-4 gap-4 py-4 border-b border-gray-100 dark:border-gray-800 last:border-0">
                {[1, 2, 3, 4].map((j) => (
                  <div
                    key={j}
                    className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse"
                    style={{ animationDelay: `${(i * 4 + j) * 50}ms` }}
                  ></div>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pagination Skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
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
        <div className="p-3 bg-gradient-to-br from-blue-200 to-purple-200 dark:from-blue-800 dark:to-purple-800 rounded-2xl animate-pulse">
          <LayoutDashboard className="h-6 w-6 text-white" />
        </div>
        <div className="space-y-2">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
          <div className="h-4 w-64 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
        </div>
      </div>

      {/* Content Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="neu-card animate-pulse">
            <CardHeader>
              <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-4 w-full bg-gray-100 dark:bg-gray-800 rounded"></div>
                <div className="h-4 w-3/4 bg-gray-100 dark:bg-gray-800 rounded"></div>
                <div className="h-4 w-1/2 bg-gray-100 dark:bg-gray-800 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Large Content Block */}
      <Card className="neu-card animate-pulse">
        <CardHeader>
          <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-200 to-purple-200 dark:from-blue-800 dark:to-purple-800 rounded-xl"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-full bg-gray-100 dark:bg-gray-800 rounded"></div>
                  <div className="h-3 w-2/3 bg-gray-50 dark:bg-gray-900 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
