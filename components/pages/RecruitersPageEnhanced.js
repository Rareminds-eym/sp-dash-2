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
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import {
    Briefcase,
    CheckCircle2,
    RefreshCw,
    Search,
    UserCheck,
    UserX,
    XCircle,
    Building2,
    Download,
    ChevronLeft,
    ChevronRight,
    Filter,
    SortAsc,
    Eye,
    Mail,
    Phone,
    Globe,
    MapPin,
    Calendar,
    Users
} from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function RecruitersPageEnhanced({ currentUser }) {
  const [recruiters, setRecruiters] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionDialog, setActionDialog] = useState({ open: false, recruiter: null, action: null })
  const [detailsDialog, setDetailsDialog] = useState({ open: false, recruiter: null, loading: false })
  const { toast } = useToast()
  
  // Overall stats (don't change with filters)
  const [overallStats, setOverallStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    active: 0
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
    status: 'all',
    active: 'all',
    state: 'all',
    sortBy: 'createdat',
    sortOrder: 'desc'
  })
  
  // States list for dropdown
  const [states, setStates] = useState([])
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkActionDialog, setBulkActionDialog] = useState({ open: false, action: null })
  
  // Active tab
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => {
    fetchStates()
    fetchOverallStats()
  }, [])

  useEffect(() => {
    fetchRecruiters()
  }, [pagination.page, pagination.limit, filters, activeTab])

  const fetchStates = async () => {
    try {
      const response = await fetch('/api/recruiters/states')
      const data = await response.json()
      setStates(data || [])
    } catch (error) {
      console.error('Error fetching states:', error)
    }
  }

  const fetchOverallStats = async () => {
    try {
      // Fetch all recruiters without pagination to get accurate stats
      const response = await fetch('/api/recruiters?page=1&limit=1000')
      const data = await response.json()
      const allRecruiters = data.data || []
      
      setOverallStats({
        total: data.pagination?.total || 0,
        pending: allRecruiters.filter(r => r.verificationStatus === 'pending').length,
        approved: allRecruiters.filter(r => r.verificationStatus === 'approved').length,
        rejected: allRecruiters.filter(r => r.verificationStatus === 'rejected').length,
        active: allRecruiters.filter(r => r.isActive).length
      })
    } catch (error) {
      console.error('Error fetching overall stats:', error)
    }
  }

  const fetchRecruiters = async () => {
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
      if (filters.state && filters.state !== 'all') params.append('state', filters.state)
      
      // Handle tab-based filtering
      if (activeTab === 'pending') {
        params.append('status', 'pending')
      } else if (activeTab === 'approved') {
        params.append('status', 'approved')
      } else if (activeTab === 'rejected') {
        params.append('status', 'rejected')
      } else if (filters.status && filters.status !== 'all') {
        params.append('status', filters.status)
      }
      
      if (filters.active && filters.active !== 'all') params.append('active', filters.active)
      
      const response = await fetch(`/api/recruiters?${params}`)
      const data = await response.json()
      
      setRecruiters(data.data || [])
      setPagination(prev => ({
        ...prev,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0
      }))
      setSelectedIds([]) // Clear selection on page change
    } catch (error) {
      console.error('Error fetching recruiters:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch recruiters',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAction = (recruiter, action) => {
    setActionDialog({ open: true, recruiter, action })
  }

  const confirmAction = async () => {
    const { recruiter, action } = actionDialog
    try {
      let endpoint = ''
      let body = {}

      if (action === 'approve') {
        endpoint = '/api/approve-recruiter'
        body = { recruiterId: recruiter.id, userId: currentUser?.id, note: 'Recruiter approved' }
      } else if (action === 'reject') {
        endpoint = '/api/reject-recruiter'
        body = { recruiterId: recruiter.id, userId: currentUser?.id, reason: 'Failed verification criteria' }
      } else if (action === 'suspend') {
        endpoint = '/api/suspend-recruiter'
        body = { recruiterId: recruiter.id, userId: currentUser?.id, reason: 'Suspended by admin' }
      } else if (action === 'activate') {
        endpoint = '/api/activate-recruiter'
        body = { recruiterId: recruiter.id, userId: currentUser?.id, note: 'Recruiter activated' }
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
        fetchRecruiters()
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
      setActionDialog({ open: false, recruiter: null, action: null })
    }
  }

  const handleBulkAction = (action) => {
    if (selectedIds.length === 0) {
      toast({
        title: 'No Selection',
        description: 'Please select at least one recruiter',
        variant: 'destructive'
      })
      return
    }
    setBulkActionDialog({ open: true, action })
  }

  const confirmBulkAction = async () => {
    const { action } = bulkActionDialog
    try {
      const response = await fetch('/api/recruiters/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recruiterIds: selectedIds,
          action: action,
          userId: currentUser?.id,
          note: `Bulk ${action} action`,
          reason: `Bulk ${action} action`
        })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Success',
          description: data.message
        })
        setSelectedIds([])
        fetchRecruiters()
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Bulk action failed',
        variant: 'destructive'
      })
    } finally {
      setBulkActionDialog({ open: false, action: null })
    }
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.search) params.append('search', filters.search)
      if (filters.status) params.append('status', filters.status)
      if (filters.state) params.append('state', filters.state)
      if (filters.active !== '') params.append('active', filters.active)
      
      const response = await fetch(`/api/recruiters/export?${params}`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `recruiters-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      
      toast({
        title: 'Success',
        description: 'Recruiters exported successfully'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Export failed',
        variant: 'destructive'
      })
    }
  }

  const handleViewDetails = async (recruiter) => {
    setDetailsDialog({ open: true, recruiter: null, loading: true })
    
    try {
      const response = await fetch(`/api/recruiter/${recruiter.id}`)
      const data = await response.json()
      setDetailsDialog({ open: true, recruiter: data, loading: false })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load recruiter details',
        variant: 'destructive'
      })
      setDetailsDialog({ open: false, recruiter: null, loading: false })
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === recruiters.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(recruiters.map(r => r.id))
    }
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const getVerificationBadge = (status) => {
    const colors = {
      approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    }
    return colors[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Recruiter Management</h2>
          <p className="text-muted-foreground">Verify and manage recruiter organizations</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={fetchRecruiters} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="neu-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Recruiters</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Building2 className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="neu-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <Briefcase className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="neu-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="neu-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-blue-600">{stats.active}</p>
              </div>
              <UserCheck className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for status categories */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          <Card className="neu-card">
            <CardHeader>
              <div className="space-y-4">
                {/* Search and Filters Row */}
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, email, or phone..."
                      value={filters.search}
                      onChange={(e) => {
                        setFilters(prev => ({ ...prev, search: e.target.value }))
                        setPagination(prev => ({ ...prev, page: 1 }))
                      }}
                      className="pl-10"
                      disabled={loading}
                    />
                  </div>
                  
                  <Select
                    value={filters.state}
                    onValueChange={(value) => {
                      setFilters(prev => ({ ...prev, state: value }))
                      setPagination(prev => ({ ...prev, page: 1 }))
                    }}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filter by State" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All States</SelectItem>
                      {states.map(state => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select
                    value={filters.active}
                    onValueChange={(value) => {
                      setFilters(prev => ({ ...prev, active: value }))
                      setPagination(prev => ({ ...prev, page: 1 }))
                    }}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Active Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
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
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="createdat-desc">Newest First</SelectItem>
                      <SelectItem value="createdat-asc">Oldest First</SelectItem>
                      <SelectItem value="name-asc">Name A-Z</SelectItem>
                      <SelectItem value="name-desc">Name Z-A</SelectItem>
                      <SelectItem value="userCount-desc">Most Users</SelectItem>
                      <SelectItem value="userCount-asc">Least Users</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Bulk Actions */}
                {selectedIds.length > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <span className="text-sm font-medium">{selectedIds.length} selected</span>
                    {(currentUser?.role === 'super_admin' || currentUser?.role === 'admin') && (
                      <div className="flex gap-2 ml-auto">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleBulkAction('approve')}
                          className="text-green-600 hover:text-green-700"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleBulkAction('reject')}
                          className="text-red-600 hover:text-red-700"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleBulkAction('suspend')}
                        >
                          <UserX className="h-4 w-4 mr-1" />
                          Suspend
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleBulkAction('activate')}
                        >
                          <UserCheck className="h-4 w-4 mr-1" />
                          Activate
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg animate-pulse dark:bg-gray-800/50">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 bg-gray-300 rounded-full dark:bg-gray-700"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-300 rounded w-1/4 dark:bg-gray-700"></div>
                          <div className="h-3 bg-gray-300 rounded w-1/3 dark:bg-gray-700"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {recruiters.length > 0 ? (
                    <>
                      {/* Select All */}
                      {recruiters.length > 0 && (
                        <div className="flex items-center gap-2 pb-2 border-b">
                          <Checkbox
                            checked={selectedIds.length === recruiters.length}
                            onCheckedChange={toggleSelectAll}
                          />
                          <span className="text-sm text-muted-foreground">Select All</span>
                        </div>
                      )}
                      
                      {recruiters.map((recruiter) => (
                        <div key={recruiter.id} className="flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors dark:bg-gray-800/50 dark:hover:bg-gray-800">
                          <Checkbox
                            checked={selectedIds.includes(recruiter.id)}
                            onCheckedChange={() => toggleSelect(recruiter.id)}
                          />
                          
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <Briefcase className="h-6 w-6 text-white" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="font-medium dark:text-white truncate">{recruiter.name}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge className={getVerificationBadge(recruiter.verificationStatus)}>
                                {recruiter.verificationStatus?.charAt(0).toUpperCase() + recruiter.verificationStatus?.slice(1)}
                              </Badge>
                              <Badge variant={recruiter.isActive ? 'default' : 'secondary'}>
                                {recruiter.isActive ? 'Active' : 'Suspended'}
                              </Badge>
                              {recruiter.state && (
                                <span className="text-xs text-muted-foreground">
                                  {recruiter.state}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span>Registered: {formatDate(recruiter.createdAt)}</span>
                              {recruiter.userCount > 0 && (
                                <span>• {recruiter.userCount} user{recruiter.userCount !== 1 ? 's' : ''}</span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(recruiter)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            
                            {(currentUser?.role === 'super_admin' || currentUser?.role === 'admin') && (
                              <>
                                {recruiter.verificationStatus === 'pending' && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleAction(recruiter, 'approve')}
                                      className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                                    >
                                      <CheckCircle2 className="h-4 w-4 mr-2" />
                                      Approve
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleAction(recruiter, 'reject')}
                                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Reject
                                    </Button>
                                  </>
                                )}
                                {recruiter.verificationStatus === 'approved' && (
                                  recruiter.isActive ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleAction(recruiter, 'suspend')}
                                    >
                                      <UserX className="h-4 w-4 mr-2" />
                                      Suspend
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleAction(recruiter, 'activate')}
                                    >
                                      <UserCheck className="h-4 w-4 mr-2" />
                                      Activate
                                    </Button>
                                  )
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No recruiters found</p>
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
        </TabsContent>
      </Tabs>

      {/* Action Confirmation Dialog */}
      <AlertDialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ ...actionDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.action === 'approve' && 'Approve Recruiter'}
              {actionDialog.action === 'reject' && 'Reject Recruiter'}
              {actionDialog.action === 'suspend' && 'Suspend Recruiter'}
              {actionDialog.action === 'activate' && 'Activate Recruiter'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {actionDialog.action} <strong>{actionDialog.recruiter?.name}</strong>?
              {actionDialog.action === 'approve' && ' This will allow the recruiter to access the platform.'}
              {actionDialog.action === 'reject' && ' This will reject the recruiter registration.'}
              {actionDialog.action === 'suspend' && ' This will temporarily suspend the recruiter\'s access.'}
              {actionDialog.action === 'activate' && ' This will restore the recruiter\'s access.'}
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

      {/* Bulk Action Confirmation Dialog */}
      <AlertDialog open={bulkActionDialog.open} onOpenChange={(open) => setBulkActionDialog({ ...bulkActionDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bulk {bulkActionDialog.action?.charAt(0).toUpperCase() + bulkActionDialog.action?.slice(1)}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {bulkActionDialog.action} <strong>{selectedIds.length}</strong> recruiter(s)?
              This action will be applied to all selected recruiters.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkAction}>
              Confirm Bulk Action
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialog.open} onOpenChange={(open) => setDetailsDialog({ ...detailsDialog, open })}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recruiter Details</DialogTitle>
            <DialogDescription>Complete information and history</DialogDescription>
          </DialogHeader>
          
          {detailsDialog.loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
              <div className="h-4 bg-gray-300 rounded w-1/2"></div>
              <div className="h-4 bg-gray-300 rounded w-2/3"></div>
            </div>
          ) : detailsDialog.recruiter ? (
            <div className="space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{detailsDialog.recruiter.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge className={getVerificationBadge(detailsDialog.recruiter.verificationStatus)}>
                      {detailsDialog.recruiter.verificationStatus}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">State</p>
                    <p className="font-medium">{detailsDialog.recruiter.state || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">District</p>
                    <p className="font-medium">{detailsDialog.recruiter.district || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Contact Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{detailsDialog.recruiter.email || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{detailsDialog.recruiter.phone || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span>{detailsDialog.recruiter.website || 'N/A'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                    <span>{detailsDialog.recruiter.address || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Metadata</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Created</p>
                      <p className="text-sm">{formatDate(detailsDialog.recruiter.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Users</p>
                      <p className="text-sm">{detailsDialog.recruiter.userCount}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Verification History */}
              {detailsDialog.recruiter.verificationHistory?.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Verification History</h3>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {detailsDialog.recruiter.verificationHistory.map((item, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">{item.action}</span>
                          <span className="text-muted-foreground">{formatDate(item.timestamp)}</span>
                        </div>
                        <p className="text-muted-foreground mt-1">{item.note}</p>
                        <p className="text-xs text-muted-foreground mt-1">By: {item.users?.email}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Audit History */}
              {detailsDialog.recruiter.auditHistory?.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Audit Trail</h3>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {detailsDialog.recruiter.auditHistory.map((item, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">{item.action}</span>
                          <span className="text-muted-foreground">{formatDate(item.timestamp)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">By: {item.users?.email}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
