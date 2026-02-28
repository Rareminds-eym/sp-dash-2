/**
 * Centralized Page Loader Component
 * Replaces all skeleton loaders with animated SVG loaders
 */

import { ShimmerEffect } from './loading-skeleton'

export function PageLoader({ message = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] py-12">
      {/* Animated SVG Loader */}
      <svg
        className="animate-spin mb-6"
        width="80"
        height="80"
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="40"
          cy="40"
          r="32"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          className="opacity-20 text-gray-300 dark:text-gray-600"
        />
        <path
          d="M40 8 A 32 32 0 0 1 72 40"
          stroke="url(#gradient)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="50%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>
      </svg>

      {/* Loading Message */}
      <p className="text-lg font-medium text-gray-700 dark:text-gray-300 animate-pulse">
        {message}
      </p>

      {/* Animated Dots */}
      <div className="flex items-center gap-2 mt-3">
        <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-gradient-to-r from-cyan-500 to-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
    </div>
  )
}

export function InlineLoader({ message = "Loading...", size = "md" }) {
  const sizeClasses = {
    sm: "w-5 h-5",
    md: "w-8 h-8",
    lg: "w-12 h-12"
  }

  return (
    <div className="flex items-center justify-center gap-3 py-6">
      <svg
        className={`animate-spin ${sizeClasses[size]}`}
        viewBox="0 0 60 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="30"
          cy="30"
          r="25"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          className="opacity-25 text-gray-300 dark:text-gray-600"
        />
        <path
          d="M30 5 A 25 25 0 0 1 55 30"
          stroke="url(#gradient-inline)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="gradient-inline" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="50%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>
      </svg>
      {message && (
        <span className="text-sm text-muted-foreground animate-pulse">{message}</span>
      )}
    </div>
  )
}

export function TableLoader({ rows = 5 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 relative overflow-hidden">
          <ShimmerEffect className="absolute inset-0 opacity-30" />
          <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-xl relative overflow-hidden">
            <ShimmerEffect />
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg w-3/4 relative overflow-hidden">
              <ShimmerEffect />
            </div>
            <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg w-1/2 relative overflow-hidden">
              <ShimmerEffect />
            </div>
          </div>
          <div className="w-24 h-8 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg relative overflow-hidden">
            <ShimmerEffect />
          </div>
        </div>
      ))}
    </div>
  )
}

export function CardGridLoader({ count = 6, columns = 3 }) {
  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  }

  return (
    <div className={`grid ${gridCols[columns]} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-6 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 relative overflow-hidden">
          <ShimmerEffect className="absolute inset-0 opacity-30" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-32 h-4 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg relative overflow-hidden">
              <ShimmerEffect />
            </div>
            <div className="w-8 h-8 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg relative overflow-hidden">
              <ShimmerEffect />
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg relative overflow-hidden">
              <ShimmerEffect />
            </div>
            <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg w-5/6 relative overflow-hidden">
              <ShimmerEffect />
            </div>
            <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg w-4/6 relative overflow-hidden">
              <ShimmerEffect />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <div className="flex-1 h-9 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg relative overflow-hidden">
                <ShimmerEffect />
              </div>
              <div className="flex-1 h-9 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg relative overflow-hidden">
                <ShimmerEffect />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function FullPageLoader({ message = "Loading your data..." }) {
  return (
    <div className="fixed inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="text-center">
        {/* Large Animated SVG Loader */}
        <svg
          className="animate-spin mx-auto mb-6"
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="60"
            cy="60"
            r="50"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            className="opacity-20 text-gray-300 dark:text-gray-600"
          />
          <path
            d="M60 10 A 50 50 0 0 1 110 60"
            stroke="url(#gradient-full)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id="gradient-full" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="33%" stopColor="#06B6D4" />
              <stop offset="66%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>
        </svg>

        {/* Loading Message */}
        <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
          {message}
        </h3>

        {/* Animated Dots */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <div className="w-3 h-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-3 h-3 bg-gradient-to-r from-cyan-500 to-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  )
}
