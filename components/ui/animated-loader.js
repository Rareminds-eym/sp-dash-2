export function AnimatedLoader({ className = "" }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg 
        className="animate-spin" 
        width="60" 
        height="60" 
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
          className="opacity-25"
        />
        <path 
          d="M30 5 A 25 25 0 0 1 55 30" 
          stroke="url(#gradient)" 
          strokeWidth="4" 
          strokeLinecap="round"
          className="animate-pulse"
        />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="50%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

export function AnimatedDotsLoader({ className = "" }) {
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      <div className="w-3 h-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
      <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
      <div className="w-3 h-3 bg-gradient-to-r from-cyan-500 to-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
    </div>
  )
}

export function AnimatedPulseLoader({ className = "" }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 animate-ping opacity-75"></div>
        <div className="absolute inset-2 rounded-full bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 animate-pulse"></div>
        <div className="absolute inset-4 rounded-full bg-white dark:bg-slate-900"></div>
      </div>
    </div>
  )
}

export function AnimatedCardLoader({ className = "" }) {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 h-32">
        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
      </div>
      <div className="space-y-2">
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 h-4 w-3/4">
          <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" style={{ animationDelay: '0.2s' }}></div>
        </div>
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 h-4 w-1/2">
          <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
    </div>
  )
}
