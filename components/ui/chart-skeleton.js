'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function ChartSkeleton({ title, subtitle }) {
  return (
    <Card className="neu-card animate-pulse">
      <CardHeader className="pb-4">
        {title && <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>}
        {subtitle && <div className="h-4 w-64 bg-gray-100 dark:bg-gray-800 rounded mt-2"></div>}
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
  )
}

export function KPICardSkeleton() {
  return (
    <Card className="neu-card animate-pulse">
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
  )
}

export function VerificationListSkeleton() {
  return (
    <Card className="neu-card animate-pulse">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-200 to-emerald-200 dark:from-green-800 dark:to-emerald-800 rounded-xl"></div>
          <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-white/50 dark:bg-slate-800/50 rounded-2xl">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-200 to-purple-200 dark:from-blue-800 dark:to-purple-800 rounded-2xl"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 w-full bg-gray-100 dark:bg-gray-800 rounded"></div>
                <div className="h-3 w-2/3 bg-gray-50 dark:bg-gray-900 rounded"></div>
              </div>
              <div className="space-y-2 text-right">
                <div className="h-3 w-24 bg-gray-100 dark:bg-gray-800 rounded"></div>
                <div className="h-3 w-16 bg-gray-50 dark:bg-gray-900 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
