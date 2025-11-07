'use client'

import { useState, useEffect, lazy, Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChartSkeleton } from '@/components/ui/chart-skeleton'
import { Sparkles } from 'lucide-react'

// Lazy load the full reports page for better initial load
const ReportsPageFull = lazy(() => import('./ReportsPage'))

export default function ReportsPageOptimized() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate initial load complete
    const timer = setTimeout(() => setIsLoading(false), 100)
    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl animate-pulse\">
            <Sparkles className=\"h-6 w-6 text-white\" />
          </div>
          <div>
            <div className=\"h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mb-2\"></div>
            <div className=\"h-4 w-64 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse\"></div>
          </div>
        </div>
        <div className=\"grid grid-cols-1 lg:grid-cols-2 gap-6\">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    )
  }

  return (
    <Suspense fallback={
      <div className=\"space-y-6\">
        <div className=\"grid grid-cols-1 lg:grid-cols-2 gap-6\">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    }>
      <ReportsPageFull />
    </Suspense>
  )
}
