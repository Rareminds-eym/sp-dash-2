'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'

// Shimmer effect component
function ShimmerEffect({ className = "" }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 dark:via-white/10 to-transparent"></div>
    </div>
  )
}

export function ChartSkeleton({ title, subtitle }) {
  return (
    <Card className="neu-card relative overflow-hidden">
      <ShimmerEffect className="absolute inset-0 opacity-30" />
      <CardHeader className="pb-4 relative z-10">
        {title && (
          <div className="relative h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
            <ShimmerEffect />
          </div>
        )}
        {subtitle && (
          <div className="relative h-4 w-64 bg-gray-100 dark:bg-gray-800 rounded mt-2 overflow-hidden">
            <ShimmerEffect />
          </div>
        )}
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
  )
}

export function KPICardSkeleton() {
  return (
    <Card className="neu-card relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
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
  )
}

export function VerificationListSkeleton() {
  return (
    <Card className="neu-card relative overflow-hidden">
      <ShimmerEffect className="absolute inset-0 opacity-30" />
      <CardHeader className="pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 bg-gradient-to-br from-green-200 to-emerald-200 dark:from-green-800 dark:to-emerald-800 rounded-xl overflow-hidden">
            <ShimmerEffect />
          </div>
          <div className="relative h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
            <ShimmerEffect />
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-white/50 dark:bg-slate-800/50 rounded-2xl relative overflow-hidden">
              <ShimmerEffect className="absolute inset-0 opacity-40" />
              <div className="relative w-12 h-12 bg-gradient-to-br from-blue-200 to-purple-200 dark:from-blue-800 dark:to-purple-800 rounded-2xl overflow-hidden z-10">
                <ShimmerEffect />
              </div>
              <div className="flex-1 space-y-2 relative z-10">
                <div className="relative h-4 w-full bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                  <ShimmerEffect />
                </div>
                <div className="relative h-3 w-2/3 bg-gray-50 dark:bg-gray-900 rounded overflow-hidden">
                  <ShimmerEffect />
                </div>
              </div>
              <div className="space-y-2 text-right relative z-10">
                <div className="relative h-3 w-24 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                  <ShimmerEffect />
                </div>
                <div className="relative h-3 w-16 bg-gray-50 dark:bg-gray-900 rounded overflow-hidden">
                  <ShimmerEffect />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

