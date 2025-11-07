'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, CheckCircle2 } from 'lucide-react'

export function RecentVerifications({ verifications }) {
  return (
    <Card className="neu-card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <CardTitle className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">
            Recent Verifications
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {verifications.length > 0 ? (
            verifications.map((verification, index) => (
              <div
                key={verification.id}
                className="group flex items-center justify-between p-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-slate-700/50 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-3 rounded-2xl shadow-lg transition-transform duration-300 group-hover:scale-110 ${
                      verification.action === 'verify'
                        ? 'bg-gradient-to-br from-campaign-blue1 to-campaign-blue2'
                        : verification.action === 'reject'
                        ? 'bg-gradient-to-br from-campaign-red to-orange-600'
                        : verification.action === 'suspend'
                        ? 'bg-gradient-to-br from-campaign-gold to-amber-600'
                        : 'bg-gradient-to-br from-campaign-blue1 to-campaign-blue2'
                    }`}
                  >
                    <CheckCircle2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {verification.action.charAt(0).toUpperCase() +
                        verification.action.slice(1)}{' '}
                      - {verification.targetTable}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {verification.note}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {verification.users?.email || 'System'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500">
                    {new Date(verification.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-400 to-gray-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Activity className="h-8 w-8 text-white opacity-50" />
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-lg font-medium">
                No recent verifications
              </p>
              <p className="text-slate-500 dark:text-slate-500 text-sm">
                Verification activity will appear here
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
