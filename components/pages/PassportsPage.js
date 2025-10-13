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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Award, CheckCircle2, Filter, RefreshCw, Search, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function PassportsPage({ currentUser }) {
  const [passports, setPassports] = useState([])
  const [filteredPassports, setFilteredPassports] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [nsqfLevelFilter, setNsqfLevelFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0, limit: 20 })
  const [actionDialog, setActionDialog] = useState({ open: false, passport: null, action: null })
  const { toast } = useToast()

  useEffect(() => {
    fetchPassports()
  }, [currentPage])

  useEffect(() => {
    const filtered = passports.filter(passport => {
      const studentName = passport.students?.profile?.name || ''
      const studentEmail = passport.students?.profile?.email || passport.students?.users?.email || ''
      const searchLower = searchTerm.toLowerCase()
      
      // Search filter
      const matchesSearch = studentName.toLowerCase().includes(searchLower) ||
                           studentEmail.toLowerCase().includes(searchLower) ||
                           passport.status.toLowerCase().includes(searchLower)
      
      // Status filter
      const matchesStatus = statusFilter === 'all' || passport.status === statusFilter
      
      // NSQF Level filter
      const matchesNSQF = nsqfLevelFilter === 'all' || 
                         passport.nsqfLevel?.toString() === nsqfLevelFilter
      
      return matchesSearch && matchesStatus && matchesNSQF
    })
    setFilteredPassports(filtered)
  }, [searchTerm, statusFilter, nsqfLevelFilter, passports])
  
  const resetFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setNsqfLevelFilter('all')
  }

  const fetchPassports = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/passports?page=${currentPage}&limit=50`)
      const result = await response.json()
      
      // Handle both old format (array) and new format (object with data and pagination)
      if (Array.isArray(result)) {
        setPassports(result)
        setFilteredPassports(result)
      } else {
        setPassports(result.data || [])
        setFilteredPassports(result.data || [])
        setPagination(result.pagination || { total: 0, totalPages: 0, limit: 50 })
      }
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

  const getStatusBadge = (status) => {
    const colors = {
      verified: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      suspended: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    }
    return colors[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Skill Passports</h2>
          <p className="text-muted-foreground">Verify and manage skill passports</p>
        </div>
        <Button onClick={fetchPassports} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card className="neu-card">
        <CardHeader>
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by student name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Filters:</span>
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={nsqfLevelFilter} onValueChange={setNsqfLevelFilter}>
                <SelectTrigger className="w-[140px]">
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
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={resetFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                Clear Filters
              </Button>
            </div>
            
            {/* Results count */}
            <div className="text-sm text-muted-foreground">
              Showing {filteredPassports.length} of {passports.length} passports on this page
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredPassports.length > 0 ? (
              filteredPassports.map((passport) => (
                <div key={passport.id} className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors dark:bg-gray-800/50 dark:hover:bg-gray-800">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                      <Award className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-medium dark:text-white">
                        {passport.students?.profile?.name || passport.students?.users?.metadata?.name || passport.students?.users?.email || 'Unknown Student'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {/* Show status badge for all statuses */}
                        <Badge className={getStatusBadge(passport.status)}>
                          {passport.status.charAt(0).toUpperCase() + passport.status.slice(1)}
                        </Badge>
                        {passport.nsqfLevel && (
                          <span className="text-xs text-muted-foreground">
                            NSQF Level {passport.nsqfLevel}
                          </span>
                        )}
                      </div>
                      {passport.skills && passport.skills.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {passport.skills.map((skill, idx) => (
                            <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded dark:bg-blue-900/30 dark:text-blue-400">
                              {skill}
                            </span>
                          ))}
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
          
          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing page {currentPage} of {pagination.totalPages} ({pagination.total} total passports)
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages}
                >
                  Next
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