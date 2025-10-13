'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { 
  RefreshCw, 
  Database, 
  CheckCircle2, 
  User, 
  Mail, 
  Building2, 
  Shield, 
  Bell, 
  Lock,
  Save,
  Edit3,
  Eye,
  EyeOff,
  Key,
  Settings,
  UserCircle2,
  Sparkles
} from 'lucide-react'

export default function SettingsPage({ user }) {
  const { toast } = useToast()
  const [isUpdating, setIsUpdating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  // Profile form state
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    organizationId: user?.organizationId || '',
    organizationName: user?.organization?.name || ''
  })

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

  const handleSaveProfile = async () => {
    setIsSaving(true)
    try {
      // Simulate API call - replace with actual API endpoint
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      toast({
        title: 'Profile Updated',
        description: 'Your profile information has been updated successfully.',
        variant: 'default',
      })
      setIsEditing(false)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setProfileData({
      name: user?.name || '',
      email: user?.email || '',
      organizationId: user?.organizationId || '',
      organizationName: user?.organization?.name || ''
    })
    setIsEditing(false)
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Settings
          </h2>
          <p className="text-muted-foreground mt-1">Manage your account and application preferences</p>
        </div>
        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
          <Settings className="h-6 w-6 text-white" />
        </div>
      </div>

      {/* Profile Section */}
      <Card className="neu-card border-t-4 border-t-blue-500 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 opacity-10" />
        <CardHeader className="relative pb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-xl">
                  {user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-4 border-white dark:border-slate-800" />
              </div>
              <div>
                <CardTitle className="text-2xl">Profile Information</CardTitle>
                <CardDescription className="text-base mt-1">
                  Update your personal details and organization information
                </CardDescription>
              </div>
            </div>
            {!isEditing && (
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                className="gap-2"
              >
                <Edit3 className="h-4 w-4" />
                Edit Profile
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold flex items-center gap-2">
                <UserCircle2 className="h-4 w-4 text-blue-600" />
                Full Name
              </Label>
              <Input
                id="name"
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                disabled={!isEditing}
                className="h-11"
                placeholder="Enter your full name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-600" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={profileData.email}
                disabled
                className="h-11 bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role" className="text-sm font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-600" />
                Role
              </Label>
              <Input
                id="role"
                value={user?.role ? user.role.replace('_', ' ').toUpperCase() : ''}
                disabled
                className="h-11 bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="organization" className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-600" />
                Organization
              </Label>
              <Input
                id="organization"
                value={profileData.organizationName}
                onChange={(e) => setProfileData({ ...profileData, organizationName: e.target.value })}
                disabled={!isEditing}
                className="h-11"
                placeholder="Enter organization name"
              />
            </div>
          </div>

          {isEditing && (
            <div className="flex gap-3 pt-4 border-t">
              <Button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
              <Button
                onClick={handleCancelEdit}
                variant="outline"
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notifications Card */}
        <Card className="neu-card border-l-4 border-l-green-500">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950/30">
                <Bell className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Manage your notification preferences</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200 dark:border-green-800">
                <div className="flex-1">
                  <p className="font-semibold text-green-900 dark:text-green-100">Email Notifications</p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Get updates on passport verifications and user activities
                  </p>
                </div>
                <Switch defaultChecked className="mt-1" />
              </div>
              
              <div className="flex items-start justify-between p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800">
                <div className="flex-1">
                  <p className="font-semibold text-blue-900 dark:text-blue-100">Real-time Alerts</p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Receive instant alerts for critical system events
                  </p>
                </div>
                <Switch defaultChecked className="mt-1" />
              </div>

              <div className="flex items-start justify-between p-4 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border border-purple-200 dark:border-purple-800">
                <div className="flex-1">
                  <p className="font-semibold text-purple-900 dark:text-purple-100">Weekly Reports</p>
                  <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                    Summary of platform activities sent every week
                  </p>
                </div>
                <Switch className="mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Card */}
        <Card className="neu-card border-l-4 border-l-orange-500">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-950/30">
                <Lock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Protect your account with these features</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                  <Shield className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="font-semibold text-orange-900 dark:text-orange-100">Two-Factor Authentication</p>
                  <p className="text-sm text-orange-700 dark:text-orange-300">Add an extra layer of security</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300"
              >
                Enable
              </Button>
            </div>
            
            <div className="space-y-3 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Key className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-blue-900 dark:text-blue-100">Password</p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">Last changed 3 months ago</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                className="w-full border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300"
              >
                Change Password
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Management Section - Only for Super Admin */}
      {user?.role === 'super_admin' && (
        <Card className="neu-card border-t-4 border-t-indigo-500 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-600 opacity-10" />
          <CardHeader className="relative">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                <Database className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">System Management</CardTitle>
                <CardDescription className="text-base">
                  Administrative tools and system controls
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-6 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/20 dark:via-purple-950/20 dark:to-pink-950/20 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 rounded-xl bg-white dark:bg-slate-800 shadow-md">
                  <Sparkles className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-lg text-indigo-900 dark:text-indigo-100 mb-2">
                    Update Metrics Snapshot
                  </p>
                  <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-3 leading-relaxed">
                    Calculate and save current metrics to the metrics_snapshots table. This creates a historical record for trend analysis and dashboard performance tracking.
                  </p>
                  <div className="flex items-start gap-2 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 px-4 py-3 rounded-xl">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Note:</strong> Dashboard KPI cards fetch real-time data, but updating snapshots helps track historical trends in the analytics charts.
                    </div>
                  </div>
                </div>
              </div>
              <Button 
                onClick={handleUpdateMetrics}
                disabled={isUpdating}
                className="w-full h-12 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white font-semibold shadow-lg"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                    Updating Metrics...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-5 w-5 mr-2" />
                    Update Metrics Now
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
