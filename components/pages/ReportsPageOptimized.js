'use client'

import { useState, useEffect, lazy, Suspense } from 'react'
import { AnimatedPulseLoader, AnimatedCardLoader } from '@/components/ui/animated-loader'
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
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
        <AnimatedPulseLoader />
        <div className="text-center space-y-2">
          <div className="flex items-center gap-2 justify-center">
            <Sparkles className="h-5 w-5 text-purple-500 animate-pulse" />
            <p className="text-lg font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Loading Analytics
            </p>
          </div>
          <p className="text-sm text-muted-foreground">Preparing your insights...</p>
        </div>
      </div>
    )
  }

  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
        <AnimatedPulseLoader />
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Loading reports...</p>
        </div>
      </div>
    }>
      <ReportsPageFull />
    </Suspense>
  )
}
