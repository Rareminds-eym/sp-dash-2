'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { 
  History, 
  Search, 
  Download, 
  Filter, 
  X,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Eye,
  ArrowUpDown,
  Activity
} from 'lucide-react'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { format } from 'date-fns'

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAction, setSelectedAction] = useState('all')
  const [selectedUser, setSelectedUser] = useState('all')
  const [dateFrom, setDateFrom] = useState(null)
  const [dateTo, setDateTo] = useState(null)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  
  // Available options
  const [actionTypes, setActionTypes] = useState([])
  const [users, setUsers] = useState([])
  
  // Detail modal
  const [selectedLog, setSelectedLog] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  
  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    fetchActionTypes()
    fetchUsers()
  }, [])

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
  }, [pagination.page, pagination.limit, debouncedSearch, selectedAction, selectedUser, dateFrom, dateTo, sortBy, sortOrder])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder
      })
      
      if (debouncedSearch) params.append('search', debouncedSearch)
      if (selectedAction && selectedAction !== 'all') params.append('action', selectedAction)
      if (selectedUser && selectedUser !== 'all') params.append('userId', selectedUser)
      if (dateFrom) params.append('dateFrom', dateFrom.toISOString())
      if (dateTo) params.append('dateTo', dateTo.toISOString())
      
      const response = await fetch(`/api/audit-logs?${params}`)
      const data = await response.json()
      
      setLogs(data.logs || [])
      setPagination(data.pagination || pagination)
    } catch (error) {
      console.error('Error fetching logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchActionTypes = async () => {
    try {
      const response = await fetch('/api/audit-logs/actions')
      const data = await response.json()
      setActionTypes(data)
    } catch (error) {
      console.error('Error fetching action types:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/audit-logs/users')
      const data = await response.json()
      setUsers(data)
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      
      if (debouncedSearch) params.append('search', debouncedSearch)
      if (selectedAction && selectedAction !== 'all') params.append('action', selectedAction)
      if (selectedUser && selectedUser !== 'all') params.append('userId', selectedUser)
      if (dateFrom) params.append('dateFrom', dateFrom.toISOString())
      if (dateTo) params.append('dateTo', dateTo.toISOString())
      
      const response = await fetch(`/api/audit-logs/export?${params}`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error exporting logs:', error)
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedAction('all')
    setSelectedUser('all')
    setDateFrom(null)
    setDateTo(null)
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const hasActiveFilters = searchQuery || selectedAction !== 'all' || selectedUser !== 'all' || dateFrom || dateTo

  const getActionBadge = (action) => {
    const colors = {
      login: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      logout: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
      verify_passport: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      reject_passport: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      suspend_user: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      activate_user: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      delete_user: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      update_profile: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      approve_recruiter: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
      reject_recruiter: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      suspend_recruiter: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      activate_recruiter: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
    }
    return colors[action] || 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-300'
  }

  const getActionIcon = (action) => {
    if (action.includes('login')) return '🔐'
    if (action.includes('verify')) return '✅'
    if (action.includes('reject')) return '❌'
    if (action.includes('suspend')) return '🚫'
    if (action.includes('activate')) return '✔️'
    if (action.includes('delete')) return '🗑️'
    if (action.includes('update')) return '✏️'
    if (action.includes('approve')) return '👍'
    return '📝'
  }

  // Group logs by date
  const groupedLogs = useMemo(() => {
    const groups = {}
    logs.forEach(log => {
      const date = format(new Date(log.createdAt), 'yyyy-MM-dd')
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(log)
    })
    return groups
  }, [logs])

  const viewLogDetails = (log) => {
    setSelectedLog(log)
    setShowDetailModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="neu-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground dark:text-gray-400">Total Logs</p>
                <p className="text-2xl font-bold dark:text-white">{pagination.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="neu-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <History className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground dark:text-gray-400">Current Page</p>
                <p className="text-2xl font-bold dark:text-white">{logs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="neu-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Filter className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground dark:text-gray-400">Action Types</p>
                <p className="text-2xl font-bold dark:text-white">{actionTypes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="neu-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Eye className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground dark:text-gray-400">Active Users</p>
                <p className="text-2xl font-bold dark:text-white">{users.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Card */}
      <Card className="neu-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              <span className="font-semibold">Filters & Search</span>
            </div>
            <div className="flex gap-2">
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear Filters
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-gray-300">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Action Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-gray-300">Action Type</label>
              <Select value={selectedAction} onValueChange={setSelectedAction}>
                <SelectTrigger>
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {actionTypes.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action.replace(/_/g, ' ').toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* User Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-gray-300">User</label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-gray-300">Date Range</label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1">
                      <CalendarIcon className="h-4 w-4 mr-1" />
                      {dateFrom ? format(dateFrom, 'MMM dd') : 'From'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1">
                      <CalendarIcon className="h-4 w-4 mr-1" />
                      {dateTo ? format(dateTo, 'MMM dd') : 'To'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Sorting and Page Size */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t dark:border-gray-700">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium dark:text-gray-300">Sort By:</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Date</SelectItem>
                  <SelectItem value="action">Action</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                <ArrowUpDown className="h-4 w-4 mr-1" />
                {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
              </Button>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <label className="text-sm font-medium dark:text-gray-300">Show:</label>
              <Select 
                value={pagination.limit.toString()} 
                onValueChange={(val) => setPagination(prev => ({ ...prev, limit: parseInt(val), page: 1 }))}
              >
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Card */}
      <Card className="neu-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5" />
            <span className="font-semibold">Audit Logs</span>
            <span className="text-sm text-muted-foreground ml-2">
              ({pagination.total} total records)
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {/* Loading skeletons */}
              {[1, 2, 3, 4, 5].map((i) => (
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
          ) : logs.length > 0 ? (
            <div className="space-y-6">
              {Object.entries(groupedLogs).map(([date, dateLogs]) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {format(new Date(date), 'MMMM dd, yyyy')}
                    </span>
                    <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
                  </div>
                  
                  <div className="space-y-3">
                    {dateLogs.map((log) => (
                      <div 
                        key={log.id} 
                        className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer group"
                        onClick={() => viewLogDetails(log)}
                      >
                        <div className="text-2xl mt-1">{getActionIcon(log.action)}</div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge className={getActionBadge(log.action)}>
                              {log.action.replace(/_/g, ' ').toUpperCase()}
                            </Badge>
                            <span className="text-sm font-medium dark:text-white">
                              {log.users?.name || log.users?.email || 'System'}
                            </span>
                            <span className="text-xs text-muted-foreground dark:text-gray-400">
                              {format(new Date(log.createdAt), 'HH:mm:ss')}
                            </span>
                          </div>
                          
                          <p className="text-sm dark:text-gray-300 truncate">
                            Target: <span className="font-medium">{log.target || 'N/A'}</span>
                          </p>
                          
                          {log.ip && (
                            <p className="text-xs text-muted-foreground mt-1 dark:text-gray-400">
                              IP: {log.ip}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation()
                              viewLogDetails(log)
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <History className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-muted-foreground dark:text-gray-400">No audit logs found</p>
              {hasActiveFilters && (
                <Button variant="link" onClick={clearFilters} className="mt-2">
                  Clear filters to see all logs
                </Button>
              )}
            </div>
          )}

          {/* Pagination */}
          {!loading && logs.length > 0 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t dark:border-gray-700">
              <div className="text-sm text-muted-foreground dark:text-gray-400">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} logs
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
                
                {/* Page numbers */}
                <div className="flex gap-1">
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
                        variant={pagination.page === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                        className="w-8 h-8 p-0"
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

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Audit Log Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Action</label>
                  <div className="mt-1">
                    <Badge className={getActionBadge(selectedLog.action)}>
                      {selectedLog.action.replace(/_/g, ' ').toUpperCase()}
                    </Badge>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Timestamp</label>
                  <p className="mt-1 text-sm dark:text-white">
                    {format(new Date(selectedLog.createdAt), 'PPpp')}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">User</label>
                  <p className="mt-1 text-sm dark:text-white">
                    {selectedLog.users?.name || selectedLog.users?.email || 'System'}
                  </p>
                  {selectedLog.users?.email && (
                    <p className="text-xs text-muted-foreground dark:text-gray-400">
                      {selectedLog.users.email}
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">IP Address</label>
                  <p className="mt-1 text-sm dark:text-white">
                    {selectedLog.ip || 'N/A'}
                  </p>
                </div>
                
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Target</label>
                  <p className="mt-1 text-sm dark:text-white">
                    {selectedLog.target || 'N/A'}
                  </p>
                </div>
                
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Log ID</label>
                  <p className="mt-1 text-xs font-mono text-gray-600 dark:text-gray-400">
                    {selectedLog.id}
                  </p>
                </div>
              </div>
              
              {selectedLog.payload && Object.keys(selectedLog.payload).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Payload / Additional Data</label>
                  <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}