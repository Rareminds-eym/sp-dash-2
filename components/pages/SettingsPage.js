'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { RefreshCw, Database, CheckCircle2, Save, Edit3, Lock, Eye, EyeOff } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase-browser'

export default function SettingsPage({ user }) {
  const { toast } = useToast()
  const [isUpdating, setIsUpdating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  
  // Password update dialog state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  
  // Profile form state  
  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    organizationName: user?.organization?.name || ''
  })

  // Sync profileData with user prop when it changes
  useEffect(() => {
    if (user) {
      console.log('User data received:', user)
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        organizationName: user.organization?.name || ''
      })
    }
  }, [user])

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
    console.log('handleSaveProfile called')
    console.log('Profile data to save:', profileData)
    
    // Validate email exists
    if (!profileData.email) {
      console.error('Email is missing from profileData!')
      toast({
        title: 'Error',
        description: 'Email is required. Please refresh the page and try again.',
        variant: 'destructive',
      })
      return
    }
    
    setIsSaving(true)
    try {
      console.log('Sending PUT request to /api/users/profile...')
      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: profileData.email,
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          organizationName: profileData.organizationName,
        }),
      })

      console.log('Response status:', response.status)
      const data = await response.json()
      console.log('Response data:', data)

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile')
      }
      
      toast({
        title: 'Profile Updated',
        description: 'Your profile information has been updated successfully.',
        variant: 'default',
      })
      setIsEditing(false)
    } catch (error) {
      console.error('Profile update error:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setProfileData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      organizationName: user?.organization?.name || ''
    })
    setIsEditing(false)
  }

  const validatePassword = (pwd) => {
    if (pwd.length < 8) {
      return 'Password must be at least 8 characters long'
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'Password must contain at least one uppercase letter'
    }
    if (!/[a-z]/.test(pwd)) {
      return 'Password must contain at least one lowercase letter'
    }
    if (!/[0-9]/.test(pwd)) {
      return 'Password must contain at least one number'
    }
    return null
  }

  const handleUpdatePassword = async () => {
    // Validate inputs
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast({
        title: 'Error',
        description: 'All fields are required',
        variant: 'destructive',
      })
      return
    }

    // Validate passwords match
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: 'Error',
        description: 'New passwords do not match',
        variant: 'destructive',
      })
      return
    }

    // Validate password strength
    const validationError = validatePassword(passwordData.newPassword)
    if (validationError) {
      toast({
        title: 'Error',
        description: validationError,
        variant: 'destructive',
      })
      return
    }

    setIsUpdatingPassword(true)

    try {
      const supabase = createClient()

      // First, verify current password by trying to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordData.currentPassword,
      })

      if (signInError) {
        toast({
          title: 'Error',
          description: 'Current password is incorrect',
          variant: 'destructive',
        })
        setIsUpdatingPassword(false)
        return
      }

      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      })

      if (updateError) {
        toast({
          title: 'Error',
          description: updateError.message || 'Failed to update password',
          variant: 'destructive',
        })
        setIsUpdatingPassword(false)
        return
      }

      // Success
      toast({
        title: 'Password Updated',
        description: 'Your password has been updated successfully',
        variant: 'default',
      })

      // Reset form and close dialog
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      setShowPasswordDialog(false)
    } catch (error) {
      console.error('Password update error:', error)
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  const handleCancelPasswordUpdate = () => {
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    })
    setShowPasswordDialog(false)
  }

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Profile Settings */}
      <Card className="neu-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Profile Settings</CardTitle>
            {!isEditing && (
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                size="sm"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={profileData.firstName}
                onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                disabled={!isEditing}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={profileData.lastName}
                onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                disabled={!isEditing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={profileData.email}
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                value={user?.role ? user.role.replace('_', ' ').toUpperCase() : ''}
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="organization">Organization</Label>
              <Input
                id="organization"
                value={profileData.organizationName}
                onChange={(e) => setProfileData({ ...profileData, organizationName: e.target.value })}
                disabled={!isEditing}
                placeholder={user?.organization?.name ? "Enter organization name" : "No organization assigned - contact admin to link organization"}
              />
              {!user?.organization?.name && (
                <p className="text-xs text-muted-foreground">
                  You are not currently linked to an organization. Contact your administrator to be assigned to one.
                </p>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="flex gap-3 pt-4 border-t">
              <Button
                onClick={handleSaveProfile}
                disabled={isSaving}
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

      {/* Notification Settings */}
      <Card className="neu-card">
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
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Weekly Reports</p>
              <p className="text-sm text-muted-foreground">Summary of platform activities sent every week</p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="neu-card">
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
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setShowPasswordDialog(true)}
            >
              <Lock className="h-4 w-4 mr-2" />
              Update Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System Management Section - Only for Super Admin */}
      {user?.role === 'super_admin' && (
        <Card className="neu-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <CardTitle>System Management</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <p className="font-semibold">Update Metrics Snapshot</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Calculate and save current metrics to the metrics_snapshots table. This creates a historical record for trend analysis.
              </p>
              <div className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md">
                <strong>Note:</strong> Dashboard KPI cards fetch real-time data, but updating snapshots helps track historical trends in the analytics charts.
              </div>
            </div>
            <Button 
              onClick={handleUpdateMetrics}
              disabled={isUpdating}
              className="w-full"
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

      {/* Password Update Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Update Password
            </DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new secure password.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                  disabled={isUpdatingPassword}
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  disabled={isUpdatingPassword}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Enter new password"
                  disabled={isUpdatingPassword}
                  autoComplete="new-password"
                  minLength={8}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  disabled={isUpdatingPassword}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters with uppercase, lowercase, and number
              </p>
            </div>

            {/* Confirm New Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                  disabled={isUpdatingPassword}
                  autoComplete="new-password"
                  minLength={8}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isUpdatingPassword}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelPasswordUpdate}
              disabled={isUpdatingPassword}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpdatePassword}
              disabled={isUpdatingPassword}
            >
              {isUpdatingPassword ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Update Password
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
