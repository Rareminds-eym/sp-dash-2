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
  Award,
  CheckCircle2,
  RefreshCw,
  Search,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function PassportsPageEnhanced({ currentUser }) {
  const [passports, setPassports] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionDialog, setActionDialog] = useState({ open: false, passport: null, action: null })
  const { toast } = useToast()
  
  // Overall stats (don't change with filters)
  const [overallStats, setOverallStats] = useState({
    total: 0,
    verified: 0,
    pending: 0,
    rejected: 0
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
    nsqfLevel: 'all',
    university: 'all',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  })
  
  // Universities list for dropdown
  const [universities, setUniversities] = useState([])
  
  // Debounce timer for search
  const searchDebounceRef = useRef(null)

  useEffect(() => {
    fetchUniversities()
    fetchOverallStats()
  }, [])

  useEffect(() => {
    fetchPassports()
  }, [pagination.page, pagination.limit, filters])

  const fetchUniversities = async () => {
    try {
      const response = await fetch('/api/passports/universities')
      const data = await response.json()
      setUniversities(data || [])
    } catch (error) {
      console.error('Error fetching universities:', error)
    }
  }

  const fetchOverallStats = async () => {
    try {
      // Fetch all passports without pagination to get accurate stats
      const response = await fetch('/api/passports?page=1&limit=10000')
      const data = await response.json()
      const allPassports = data.data || []
      
      setOverallStats({
        total: data.pagination?.total || 0,
        verified: allPassports.filter(p => p.status === 'verified').length,
        pending: allPassports.filter(p => p.status === 'pending').length,
        rejected: allPassports.filter(p => p.status === 'rejected').length
      })
    } catch (error) {
      console.error('Error fetching overall stats:', error)
    }
  }

  const fetchPassports = async () => {
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
      if (filters.status && filters.status !== 'all') params.append('status', filters.status)
      if (filters.nsqfLevel && filters.nsqfLevel !== 'all') params.append('nsqfLevel', filters.nsqfLevel)
      if (filters.university && filters.university !== 'all') params.append('university', filters.university)
      
      const response = await fetch(`/api/passports?${params}`)
      const data = await response.json()
      
      setPassports(data.data || [])
      setPagination(prev => ({
        ...prev,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0
      }))
    } catch (error) {
      console.error('Error fetching passports:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch passports',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAction = (passport, action) => {
    setActionDialog({ open: true, passport, action })
  }

  const confirmAction = async () => {
    const { passport, action } = actionDialog
    try {
      let endpoint = ''
      let body = {}

      if (action === 'verify') {
        endpoint = '/api/verify'
        body = { passportId: passport.id, userId: currentUser?.id, note: 'Passport verified by admin' }
      } else if (action === 'reject') {
        endpoint = '/api/reject-passport'
        body = { passportId: passport.id, userId: currentUser?.id, reason: 'Failed verification criteria' }
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
        fetchPassports()
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
      setActionDialog({ open: false, passport: null, action: null })
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

  const getStatusBadge = (status) => {
    const colors = {
      verified: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      suspended: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    }
    return colors[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={fetchPassports} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="neu-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Passports</p>
                <p className="text-2xl font-bold">{overallStats.total}</p>
              </div>
              <Award className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="neu-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Verified</p>
                <p className="text-2xl font-bold text-green-600">{overallStats.verified}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="neu-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{overallStats.pending}</p>
              </div>
              <RefreshCw className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="neu-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold text-red-600">{overallStats.rejected}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="neu-card">
        <CardHeader>
          <div className="space-y-4">
            {/* Search and Filters Row */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by student name, email, or passport ID..."
                  value={filters.search}
                  onChange={handleSearchChange}
                  className="pl-10"
                />
              </div>
              
              <Select
                value={filters.status}
                onValueChange={(value) => {
                  setFilters(prev => ({ ...prev, status: value }))
                  setPagination(prev => ({ ...prev, page: 1 }))
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              
              <Select
                value={filters.nsqfLevel}
                onValueChange={(value) => {
                  setFilters(prev => ({ ...prev, nsqfLevel: value }))
                  setPagination(prev => ({ ...prev, page: 1 }))
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="NSQF Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="1">Level 1</SelectItem>
                  <SelectItem value="2">Level 2</SelectItem>
                  <SelectItem value="3">Level 3</SelectItem>
                  <SelectItem value="4">Level 4</SelectItem>
                  <SelectItem value="5">Level 5</SelectItem>
                  <SelectItem value="6">Level 6</SelectItem>
                  <SelectItem value="7">Level 7</SelectItem>
                </SelectContent>
              </Select>
              
              <Select
                value={filters.university}
                onValueChange={(value) => {
                  setFilters(prev => ({ ...prev, university: value }))
                  setPagination(prev => ({ ...prev, page: 1 }))
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="University" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Universities</SelectItem>
                  {universities.map(univ => (
                    <SelectItem key={univ.id} value={univ.id}>{univ.name}</SelectItem>
                  ))}
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
                  <SelectItem value="createdAt-desc">Newest First</SelectItem>
                  <SelectItem value="createdAt-asc">Oldest First</SelectItem>
                  <SelectItem value="studentName-asc">Student A-Z</SelectItem>
                  <SelectItem value="studentName-desc">Student Z-A</SelectItem>
                  <SelectItem value="nsqfLevel-desc">NSQF High-Low</SelectItem>
                  <SelectItem value="nsqfLevel-asc">NSQF Low-High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Results count */}
            <div className="text-sm text-muted-foreground">
              {loading ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading passports...
                </span>
              ) : (
                `Showing ${passports.length} of ${pagination.total} passports`
              )}
            </div>
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
              {passports.length > 0 ? (
                passports.map((passport) => (
                  <div key={passport.id} className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors dark:bg-gray-800/50 dark:hover:bg-gray-800">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <Award className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="font-medium dark:text-white">
                          {passport.students?.profile?.name || passport.students?.users?.metadata?.name || passport.students?.users?.email || 'Unknown Student'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={getStatusBadge(passport.status)}>
                            {passport.status.charAt(0).toUpperCase() + passport.status.slice(1)}
                          </Badge>
                          {passport.nsqfLevel && (
                            <span className="text-xs text-muted-foreground">
                              NSQF Level {passport.nsqfLevel}
                            </span>
                          )}
                          {passport.students?.university?.name && (
                            <span className="text-xs text-muted-foreground">
                              • {passport.students.university.name}
                            </span>
                          )}
                        </div>
                        {passport.skills && passport.skills.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {passport.skills.slice(0, 3).map((skill, idx) => (
                              <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded dark:bg-blue-900/30 dark:text-blue-400">
                                {skill}
                              </span>
                            ))}
                            {passport.skills.length > 3 && (
                              <span className="text-xs text-muted-foreground px-2 py-1">
                                +{passport.skills.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(currentUser?.role === 'super_admin' || currentUser?.role === 'admin') && passport.status === 'pending' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAction(passport, 'verify')}
                            className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Verify
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAction(passport, 'reject')}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">No passports found</p>
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

      {/* Action Confirmation Dialog */}
      <AlertDialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ ...actionDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.action === 'verify' ? 'Verify Passport' : 'Reject Passport'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {actionDialog.action} this skill passport?
              {actionDialog.action === 'reject' ? ' This action will mark the passport as rejected.' : ''}
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
    </div>
  )
}
