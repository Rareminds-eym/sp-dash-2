'use client'

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TableLoader } from '@/components/ui/page-loader'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useToast } from '@/hooks/use-toast'
import {
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Clock,
    Crown,
    Mail,
    Plus,
    Search,
    Shield,
    ShieldCheck,
    UserCheck,
    Users,
    UserX
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export default function UsersPageEnhanced({ currentUser }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionDialog, setActionDialog] = useState({ open: false, user: null, action: null })
  const [addAdminDialog, setAddAdminDialog] = useState(false)
  const [addAdminForm, setAddAdminForm] = useState({ email: '', fullName: '', role: 'platform_admin' })
  const [addAdminLoading, setAddAdminLoading] = useState(false)
  const { toast } = useToast()
  
  // Overall stats (don't change with filters)
  const [overallStats, setOverallStats] = useState({
    total: 0,
    active: 0,
    suspended: 0,
    superAdmins: 0,
    platformAdmins: 0
  })
  
  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })
  
  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    role: 'all',
    active: 'all',
    sortBy: 'granted_at',
    sortOrder: 'desc'
  })
  
  // Debounce timer for search
  const searchDebounceRef = useRef(null)

  useEffect(() => {
    fetchOverallStats()
    
    // Listen for refresh events from the layout
    const handleRefresh = () => {
      fetchUsers()
      fetchOverallStats()
    }
    window.addEventListener('refreshPage', handleRefresh)
    
    return () => {
      window.removeEventListener('refreshPage', handleRefresh)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [pagination.page, pagination.limit, filters])

  const fetchOverallStats = async () => {
    try {
      // Fetch all admin users without pagination to get accurate stats
      const response = await fetch('/api/users?page=1&limit=10000')
      const data = await response.json()
      const allUsers = data.data || []
      
      setOverallStats({
        total: data.pagination?.total || 0,
        active: allUsers.filter(u => u.isActive).length,
        suspended: allUsers.filter(u => !u.isActive).length,
        superAdmins: allUsers.filter(u => u.role === 'super_admin').length,
        platformAdmins: allUsers.filter(u => u.role === 'platform_admin').length
      })
    } catch (error) {
      console.error('Error fetching overall stats:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      })
      
      // Add filters
      if (filters.search) params.append('search', filters.search)
      if (filters.role && filters.role !== 'all') params.append('role', filters.role)
      if (filters.active && filters.active !== 'all') params.append('active', filters.active)
      
      const response = await fetch(`/api/users?${params}`)
      const data = await response.json()
      
      setUsers(data.data || [])
      setPagination(prev => ({
        ...prev,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0
      }))
    } catch (error) {
      console.error('Error fetching users:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch admin users',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (user, action) => {
    setActionDialog({ open: true, user, action })
  }

  const confirmAction = async () => {
    const { user, action } = actionDialog
    try {
      let endpoint = ''
      let body = {}

      if (action === 'suspend') {
        endpoint = '/api/users/suspend'
        body = { targetUserId: user.id, actorId: currentUser?.id, reason: 'Admin action' }
      } else if (action === 'activate') {
        endpoint = '/api/users/activate'
        body = { targetUserId: user.id, actorId: currentUser?.id, note: 'User activated' }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Success',
          description: data.message
        })
        fetchUsers()
        fetchOverallStats()
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Action failed',
        variant: 'destructive'
      })
    } finally {
      setActionDialog({ open: false, user: null, action: null })
    }
  }

  const handleAddAdmin = async () => {
    // Validate form
    if (!addAdminForm.email || !addAdminForm.fullName || !addAdminForm.role) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      })
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(addAdminForm.email)) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid email address',
        variant: 'destructive'
      })
      return
    }

    try {
      setAddAdminLoading(true)
      
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addAdminForm)
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Success',
          description: data.message || 'Admin user created successfully'
        })
        
        // Reset form and close dialog
        setAddAdminForm({ email: '', fullName: '', role: 'platform_admin' })
        setAddAdminDialog(false)
        
        // Refresh the user list
        fetchUsers()
        fetchOverallStats()
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to create admin user',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error adding admin:', error)
      toast({
        title: 'Error',
        description: 'An error occurred while creating the admin user',
        variant: 'destructive'
      })
    } finally {
      setAddAdminLoading(false)
    }
  }

  const handleResendEmail = async (user) => {
    try {
      const response = await fetch('/api/users/resend-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Email Sent',
          description: data.message || 'Password reset email sent successfully'
        })
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to send email',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error resending email:', error)
      toast({
        title: 'Error',
        description: 'An error occurred while sending the email',
        variant: 'destructive'
      })
    }
  }

  const handleSearchChange = (e) => {
    const value = e.target.value
    setFilters(prev => ({ ...prev, search: value }))
    
    // Clear existing debounce timer
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
    }
    
    // Set new debounce timer
    searchDebounceRef.current = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }))
    }, 300)
  }

  const getRoleBadge = (role) => {
    const colors = {
      super_admin: 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border border-purple-200 dark:from-purple-900/40 dark:to-pink-900/40 dark:text-purple-300 dark:border-purple-700',
      platform_admin: 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 border border-blue-200 dark:from-blue-900/40 dark:to-indigo-900/40 dark:text-blue-300 dark:border-blue-700'
    }
    return colors[role] || 'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
  }

  const getRoleLabel = (role) => {
    return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  return (
    <div className="space-y-6">

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="neu-card bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Admin Users</p>
                <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{overallStats.total}</p>
              </div>
              <div className="p-3 bg-blue-200 dark:bg-blue-900/40 rounded-xl">
                <Users className="h-7 w-7 text-blue-600 dark:text-blue-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="neu-card bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20 border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Active</p>
                <p className="text-3xl font-bold text-green-900 dark:text-green-100">{overallStats.active}</p>
              </div>
              <div className="p-3 bg-green-200 dark:bg-green-900/40 rounded-xl">
                <UserCheck className="h-7 w-7 text-green-600 dark:text-green-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="neu-card bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/20 border-red-200 dark:border-red-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Suspended</p>
                <p className="text-3xl font-bold text-red-900 dark:text-red-100">{overallStats.suspended}</p>
              </div>
              <div className="p-3 bg-red-200 dark:bg-red-900/40 rounded-xl">
                <UserX className="h-7 w-7 text-red-600 dark:text-red-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="neu-card bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Super Admins</p>
                <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">{overallStats.superAdmins}</p>
              </div>
              <div className="p-3 bg-purple-200 dark:bg-purple-900/40 rounded-xl">
                <Crown className="h-7 w-7 text-purple-600 dark:text-purple-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="neu-card bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/30 dark:to-indigo-900/20 border-indigo-200 dark:border-indigo-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Platform Admins</p>
                <p className="text-3xl font-bold text-indigo-900 dark:text-indigo-100">{overallStats.platformAdmins}</p>
              </div>
              <div className="p-3 bg-indigo-200 dark:bg-indigo-900/40 rounded-xl">
                <ShieldCheck className="h-7 w-7 text-indigo-600 dark:text-indigo-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="neu-card">
        <CardHeader>
          <div className="space-y-4">
            {/* Title and Add Admin Button */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Users Management</h2>
                <p className="text-sm text-muted-foreground mt-1">Manage admin users and their roles</p>
              </div>
              {currentUser?.role === 'super_admin' && (
                <Button
                  onClick={() => setAddAdminDialog(true)}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Admin
                </Button>
              )}
            </div>

            {/* Search and Filters Row */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email, name, or role..."
                  value={filters.search}
                  onChange={handleSearchChange}
                  className="pl-10"
                />
              </div>
              
              <Select
                value={filters.role}
                onValueChange={(value) => {
                  setFilters(prev => ({ ...prev, role: value }))
                  setPagination(prev => ({ ...prev, page: 1 }))
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Admin Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="platform_admin">Platform Admin</SelectItem>
                </SelectContent>
              </Select>
              
              <Select
                value={filters.active}
                onValueChange={(value) => {
                  setFilters(prev => ({ ...prev, active: value }))
                  setPagination(prev => ({ ...prev, page: 1 }))
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="true">Active Only</SelectItem>
                  <SelectItem value="false">Suspended Only</SelectItem>
                </SelectContent>
              </Select>
              
              <Select
                value={`${filters.sortBy}-${filters.sortOrder}`}
                onValueChange={(value) => {
                  const [sortBy, sortOrder] = value.split('-')
                  setFilters(prev => ({ ...prev, sortBy, sortOrder }))
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="granted_at-desc">Recently Granted</SelectItem>
                  <SelectItem value="granted_at-asc">Oldest Granted</SelectItem>
                  <SelectItem value="email-asc">Email A-Z</SelectItem>
                  <SelectItem value="email-desc">Email Z-A</SelectItem>
                  <SelectItem value="admin_role-asc">Role A-Z</SelectItem>
                  <SelectItem value="admin_role-desc">Role Z-A</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Results count */}
            <div className="text-sm text-muted-foreground">
              {!loading && `Showing ${users.length} of ${pagination.total} users`}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableLoader rows={5} />
          ) : (
            <div className="space-y-4">
              {users.length > 0 ? (
                users.map((user) => (
                  <div key={user.id} className="group p-5 bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 hover:to-gray-50 dark:from-gray-800/50 dark:to-gray-900/50 dark:hover:from-gray-800 dark:hover:to-gray-800/80 rounded-xl transition-all duration-200 border border-gray-200 dark:border-gray-700 hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          user.role === 'super_admin' 
                            ? 'bg-gradient-to-br from-purple-500 to-pink-500' 
                            : 'bg-gradient-to-br from-blue-500 to-indigo-500'
                        }`}>
                          {user.role === 'super_admin' ? (
                            <Crown className="h-7 w-7 text-white" />
                          ) : (
                            <ShieldCheck className="h-7 w-7 text-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <p className="font-semibold text-lg dark:text-white">{user.email}</p>
                            <Badge variant={user.isActive ? 'default' : 'secondary'} className="font-medium">
                              {user.isActive ? '● Active' : '○ Suspended'}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm">
                            <Badge className={getRoleBadge(user.role)}>
                              {getRoleLabel(user.role)}
                            </Badge>
                            {user.metadata?.name && (
                              <span className="text-muted-foreground flex items-center gap-1">
                                <span className="font-medium">Name:</span> {user.metadata.name}
                              </span>
                            )}
                          </div>
                          {user.grantedByEmail && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <Shield className="h-3.5 w-3.5" />
                                <span className="font-medium">Granted by:</span> {user.grantedByEmail}
                              </span>
                              {user.grantedAt && (
                                <span className="flex items-center gap-1.5">
                                  <Clock className="h-3.5 w-3.5" />
                                  <span className="font-medium">On:</span> {new Date(user.grantedAt).toISOString().replace('T', ' ').substring(0, 16)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {currentUser?.role === 'super_admin' && user.id !== currentUser?.id && (
                          user.isActive ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAction(user, 'suspend')}
                              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                            >
                              <UserX className="h-4 w-4 mr-2" />
                              Suspend
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAction(user, 'activate')}
                              className="border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20"
                            >
                              <UserCheck className="h-4 w-4 mr-2" />
                              Activate
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                    <Shield className="h-8 w-8 text-muted-foreground opacity-50" />
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">No admin users found</p>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                    {filters.search || filters.role !== 'all' || filters.active !== 'all' 
                      ? 'Try adjusting your filters to see more results'
                      : 'The admin_users table is currently empty. Admin users will appear here once they are granted admin roles.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {!loading && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </span>
                <Select
                  value={pagination.limit.toString()}
                  onValueChange={(value) => {
                    setPagination(prev => ({ ...prev, limit: parseInt(value), page: 1 }))
                  }}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 / page</SelectItem>
                    <SelectItem value="20">20 / page</SelectItem>
                    <SelectItem value="50">50 / page</SelectItem>
                    <SelectItem value="100">100 / page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i
                    } else {
                      pageNum = pagination.page - 2 + i
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={pagination.page === pageNum ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ ...actionDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.action === 'suspend' ? 'Suspend User' : 'Activate User'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {actionDialog.action} {actionDialog.user?.email}?
              {actionDialog.action === 'suspend' && ' This will prevent the user from accessing the system.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={addAdminDialog} onOpenChange={setAddAdminDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Add New Admin User</DialogTitle>
            <DialogDescription>
              Create a new admin user. They will receive an email with a password reset link to set up their account.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={addAdminForm.email}
                onChange={(e) => setAddAdminForm(prev => ({ ...prev, email: e.target.value }))}
                disabled={addAdminLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-medium">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={addAdminForm.fullName}
                onChange={(e) => setAddAdminForm(prev => ({ ...prev, fullName: e.target.value }))}
                disabled={addAdminLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role" className="text-sm font-medium">
                Admin Role <span className="text-red-500">*</span>
              </Label>
              <Select
                value={addAdminForm.role}
                onValueChange={(value) => setAddAdminForm(prev => ({ ...prev, role: value }))}
                disabled={addAdminLoading}
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="platform_admin">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-blue-600" />
                      <span>Platform Admin</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="super_admin">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-purple-600" />
                      <span>Super Admin</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Super Admins have full system access. Platform Admins have limited permissions.
              </p>
            </div>

            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-900 dark:text-blue-100">
                  <p className="font-medium mb-1">Password Setup</p>
                  <p className="text-blue-700 dark:text-blue-300">
                    The new admin will receive an email with a secure password reset link. They must verify their email and set their password before accessing the system.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddAdminDialog(false)
                setAddAdminForm({ email: '', fullName: '', role: 'platform_admin' })
              }}
              disabled={addAdminLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddAdmin}
              disabled={addAdminLoading}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {addAdminLoading ? (
                <>
                  <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Admin
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
