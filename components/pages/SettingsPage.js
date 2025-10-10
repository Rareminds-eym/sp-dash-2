'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/use-toast'
import { RefreshCw, Database, CheckCircle2 } from 'lucide-react'

export default function SettingsPage({ user }) {
  const { toast } = useToast()
  const [isUpdating, setIsUpdating] = useState(false)

  const handleUpdateMetrics = async () => {
    setIsUpdating(true)
    try {
      const response = await fetch('/api/update-metrics', {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast({
          title: 'Metrics Updated Successfully',
          description: `Snapshot ${data.message.includes('created') ? 'created' : 'updated'} for ${data.data.snapshotDate}`,
          variant: 'default',
        })
      } else {
        throw new Error(data.error || 'Failed to update metrics')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update metrics snapshot',
        variant: 'destructive',
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted-foreground">Manage your account and application settings</p>
      </div>

      {/* System Management Section - Only for Super Admin */}
      {user.role === 'super_admin' && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="bg-blue-50 dark:bg-blue-950/30">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-blue-900 dark:text-blue-100">System Management</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-start justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <p className="font-semibold text-blue-900 dark:text-blue-100">Update Metrics Snapshot</p>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                  Calculate and save current metrics to the metrics_snapshots table. This creates a historical record for trend analysis.
                </p>
                <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-3 py-2 rounded-md">
                  <strong>Note:</strong> Dashboard KPI cards fetch real-time data, but updating snapshots helps track historical trends in the analytics charts.
                </div>
              </div>
            </div>
            <Button 
              onClick={handleUpdateMetrics}
              disabled={isUpdating}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Updating Metrics...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Update Metrics Now
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
      

      <Card>
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={user.email} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input id="role" value={user.role.replace('_', ' ')} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-muted-foreground">Receive email updates on important actions</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Real-time Alerts</p>
              <p className="text-sm text-muted-foreground">Get instant alerts for critical events</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Two-Factor Authentication</p>
              <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
            </div>
            <Button variant="outline" size="sm">Enable</Button>
          </div>
          <div className="space-y-2">
            <Label>Change Password</Label>
            <Button variant="outline" className="w-full">Update Password</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
