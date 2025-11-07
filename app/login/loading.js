'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Sparkles } from 'lucide-react'

export default function LoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors duration-300 animate-in fade-in duration-300">
      <Card className="w-full max-w-md mx-4 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-white/20 dark:border-slate-700/50 shadow-2xl shadow-slate-200/50 dark:shadow-slate-900/50">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/25 animate-pulse">
              <span className="text-white text-2xl font-bold">RM</span>
            </div>
          </div>
          <div className="h-9 w-64 mx-auto bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg animate-pulse mb-2"></div>
          <div className="h-6 w-48 mx-auto bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
        </CardHeader>
        <CardContent className="p-8">
          <div className="space-y-6">
            {/* Email field skeleton */}
            <div className="space-y-3">
              <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-12 w-full bg-white/50 dark:bg-slate-800/50 rounded-xl border border-white/20 dark:border-slate-700/50 animate-pulse"></div>
            </div>
            
            {/* Password field skeleton */}
            <div className="space-y-3">
              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-12 w-full bg-white/50 dark:bg-slate-800/50 rounded-xl border border-white/20 dark:border-slate-700/50 animate-pulse"></div>
            </div>
            
            {/* Button skeleton */}
            <div className="h-12 w-full bg-gradient-to-r from-blue-400 to-purple-400 dark:from-blue-600 dark:to-purple-600 rounded-2xl animate-pulse"></div>
            
            {/* Credentials box skeleton */}
            <div className="mt-8 p-4 bg-white/30 dark:bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-slate-700/50">
              <div className="h-5 w-32 mx-auto bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-3"></div>
              <div className="space-y-2">
                <div className="h-4 w-3/4 mx-auto bg-gray-100 dark:bg-gray-800 rounded animate-pulse"></div>
                <div className="h-4 w-2/3 mx-auto bg-gray-100 dark:bg-gray-800 rounded animate-pulse"></div>
                <div className="h-4 w-3/4 mx-auto bg-gray-100 dark:bg-gray-800 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
