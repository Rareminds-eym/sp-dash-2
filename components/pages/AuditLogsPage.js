'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { History, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLogs()
    
    // Listen for refresh events from the layout
    const handleRefresh = () => {
      fetchLogs()
    }
    window.addEventListener('refreshPage', handleRefresh)
    
    return () => {
      window.removeEventListener('refreshPage', handleRefresh)
    }
  }, [])

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/audit-logs')
      const data = await response.json()
      setLogs(data)
    } catch (error) {
      console.error('Error fetching logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActionBadge = (action) => {
    const colors = {
      login: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      verify_passport: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      reject_passport: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      suspend_user: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      activate_user: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      delete_user: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    }
    return colors[action] || 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-300'
  }

  return (
    <div className="space-y-6">

      <Card className="neu-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5" />
            <span className="font-semibold">Recent Activity</span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {/* Loading skeletons */}
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg animate-pulse dark:bg-gray-800/50">
                  <div className="w-2 h-2 bg-gray-300 rounded-full mt-2 dark:bg-gray-700"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-300 rounded w-1/4 dark:bg-gray-700"></div>
                    <div className="h-3 bg-gray-300 rounded w-1/2 dark:bg-gray-700"></div>
                  </div>
                  <div className="h-3 bg-gray-300 rounded w-24 dark:bg-gray-700"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {logs.length > 0 ? (
              logs.map((log) => (
                <div key={log.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg dark:bg-gray-800/50 dark:hover:bg-gray-800">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={getActionBadge(log.action)}>
                        {log.action.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-sm text-muted-foreground dark:text-gray-300">
                        {log.users?.email || 'System'}
                      </span>
                    </div>
                    <p className="text-sm dark:text-white">
                      Target: <span className="font-medium">{log.target || 'N/A'}</span>
                    </p>
                    {log.ip && (
                      <p className="text-xs text-muted-foreground mt-1 dark:text-gray-400">IP: {log.ip}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground dark:text-gray-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No audit logs found</p>
            )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}