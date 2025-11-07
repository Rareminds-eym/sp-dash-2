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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  AlertTriangle,
  Book,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Eye,
  Filter,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  School,
  Search,
  User,
  XCircle
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export default function ApprovalsPage({ currentUser }) {
  const [universities, setUniversities] = useState([])
  const [recruiters, setRecruiters] = useState([])
  const [colleges, setColleges] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('universities')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    state: 'all',
    dateFrom: '',
    dateTo: '',
    college: 'all',
    branch: 'all'
  })
  
  // Lazy loading state
  const [loadedTabs, setLoadedTabs] = useState({
    universities: false,
    recruiters: false,
    colleges: false,
    students: false
  })
  
  // Infinite scroll state per tab
  const [pagination, setPagination] = useState({
    universities: { page: 1, hasMore: true, loadingMore: false, total: 0 },
    recruiters: { page: 1, hasMore: true, loadingMore: false, total: 0 },
    colleges: { page: 1, hasMore: true, loadingMore: false, total: 0 },
    students: { page: 1, hasMore: true, loadingMore: false, total: 0 }
  })
  
  const [actionDialog, setActionDialog] = useState({ 
    open: false, 
    entity: null, 
    entityType: null, 
    action: null,
    reason: ''
  })
  const [detailsDialog, setDetailsDialog] = useState({ 
    open: false, 
    entity: null, 
    entityType: null,
    loading: false 
  })
  const { toast } = useToast()
  
  // Ref for infinite scroll observer
  const loadMoreRef = useRef(null)

  // Fetch counts for all tabs on initial load
  useEffect(() => {
    fetchAllCounts()
  }, [])

  // Lazy loading: Fetch data only when tab is first opened
  useEffect(() => {
    if (!loadedTabs[activeTab]) {
      fetchTabData(activeTab, true)
    }
    
    // Listen for refresh events
    const handleRefresh = () => {
      fetchTabData(activeTab, true, true) // Force refresh
      fetchAllCounts() // Also refresh counts
    }
    window.addEventListener('refreshPage', handleRefresh)
    
    return () => {
      window.removeEventListener('refreshPage', handleRefresh)
    }
  }, [activeTab])

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && pagination[activeTab].hasMore && !pagination[activeTab].loadingMore && !loading) {
          loadMoreEntities()
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current)
      }
    }
  }, [activeTab, pagination, loading])

  // Fetch counts for all entity types on initial load
  const fetchAllCounts = async () => {
    try {
      const endpoints = [
        { type: 'universities', url: '/api/universities?approval_status=pending&page=1&limit=1' },
        { type: 'recruiters', url: '/api/recruiters?approval_status=pending&page=1&limit=1' },
        { type: 'colleges', url: '/api/colleges?approval_status=pending&page=1&limit=1' },
        { type: 'students', url: '/api/students?approval_status=pending&page=1&limit=1' }
      ]

      const responses = await Promise.all(
        endpoints.map(endpoint => 
          fetch(endpoint.url).then(res => res.json()).catch(() => ({ pagination: { total: 0 } }))
        )
      )

      // Update pagination totals for all tabs
      const newPagination = { ...pagination }
      endpoints.forEach((endpoint, index) => {
        const data = responses[index]
        if (data.pagination) {
          newPagination[endpoint.type] = {
            ...newPagination[endpoint.type],
            total: data.pagination.total || 0
          }
        }
      })
      
      setPagination(newPagination)
    } catch (error) {
      console.error('Failed to fetch counts:', error)
    }
  }

  const fetchTabData = async (tabName, isInitialLoad = false, forceRefresh = false) => {
    if (isInitialLoad) {
      setLoading(true)
    }
    
    const limit = 20 // Items per page
    const page = forceRefresh ? 1 : pagination[tabName].page
    
    try {
      let endpoint = ''
      let response, data
      
      switch(tabName) {
        case 'universities':
          endpoint = `/api/universities?approval_status=pending&page=${page}&limit=${limit}`
          break
        case 'recruiters':
          endpoint = `/api/recruiters?approval_status=pending&page=${page}&limit=${limit}`
          break
        case 'colleges':
          endpoint = `/api/colleges?approval_status=pending&page=${page}&limit=${limit}`
          break
        case 'students':
          endpoint = `/api/students?approval_status=pending&page=${page}&limit=${limit}`
          break
      }
      
      response = await fetch(endpoint)
      data = await response.json()
      
      if (response.ok) {
        const newData = data.data || []
        const paginationInfo = data.pagination || {}
        
        // Update entity data based on tab
        if (forceRefresh) {
          // Replace data on refresh
          switch(tabName) {
            case 'universities':
              setUniversities(newData)
              break
            case 'recruiters':
              setRecruiters(newData)
              break
            case 'colleges':
              setColleges(newData)
              break
            case 'students':
              setStudents(newData)
              break
          }
        } else {
          // Set initial data
          switch(tabName) {
            case 'universities':
              setUniversities(newData)
              break
            case 'recruiters':
              setRecruiters(newData)
              break
            case 'colleges':
              setColleges(newData)
              break
            case 'students':
              setStudents(newData)
              break
          }
        }
        
        // Mark tab as loaded
        setLoadedTabs(prev => ({ ...prev, [tabName]: true }))
        
        // Update pagination info
        setPagination(prev => ({
          ...prev,
          [tabName]: {
            page: paginationInfo.page || 1,
            hasMore: (paginationInfo.page || 1) < (paginationInfo.totalPages || 1),
            loadingMore: false,
            total: paginationInfo.total || 0
          }
        }))
      }
    } catch (error) {
      console.error(`Failed to fetch ${tabName}:`, error)
      toast({
        title: 'Error',
        description: `Failed to load ${tabName}. Please try again later.`,
        variant: 'destructive'
      })
    } finally {
      if (isInitialLoad) {
        setLoading(false)
      }
    }
  }

  const loadMoreEntities = async () => {
    const currentTab = activeTab
    const currentPagination = pagination[currentTab]
    
    if (!currentPagination.hasMore || currentPagination.loadingMore) {
      return
    }
    
    // Set loading more state
    setPagination(prev => ({
      ...prev,
      [currentTab]: { ...prev[currentTab], loadingMore: true }
    }))
    
    const nextPage = currentPagination.page + 1
    const limit = 20
    
    try {
      let endpoint = ''
      
      switch(currentTab) {
        case 'universities':
          endpoint = `/api/universities?approval_status=pending&page=${nextPage}&limit=${limit}`
          break
        case 'recruiters':
          endpoint = `/api/recruiters?approval_status=pending&page=${nextPage}&limit=${limit}`
          break
        case 'colleges':
          endpoint = `/api/colleges?approval_status=pending&page=${nextPage}&limit=${limit}`
          break
        case 'students':
          endpoint = `/api/students?approval_status=pending&page=${nextPage}&limit=${limit}`
          break
      }
      
      const response = await fetch(endpoint)
      const data = await response.json()
      
      if (response.ok) {
        const newData = data.data || []
        const paginationInfo = data.pagination || {}
        
        // Append new data to existing data
        switch(currentTab) {
          case 'universities':
            setUniversities(prev => [...prev, ...newData])
            break
          case 'recruiters':
            setRecruiters(prev => [...prev, ...newData])
            break
          case 'colleges':
            setColleges(prev => [...prev, ...newData])
            break
          case 'students':
            setStudents(prev => [...prev, ...newData])
            break
        }
        
        // Update pagination info
        setPagination(prev => ({
          ...prev,
          [currentTab]: {
            page: nextPage,
            hasMore: nextPage < (paginationInfo.totalPages || 1),
            loadingMore: false,
            total: paginationInfo.total || 0
          }
        }))
      }
    } catch (error) {
      console.error(`Failed to load more ${currentTab}:`, error)
      toast({
        title: 'Error',
        description: `Failed to load more ${currentTab}. Please try again.`,
        variant: 'destructive'
      })
      
      // Reset loading more state on error
      setPagination(prev => ({
        ...prev,
        [currentTab]: { ...prev[currentTab], loadingMore: false }
      }))
    }
  }

  const fetchPendingEntities = () => {
    // Reset and refresh current tab
    fetchTabData(activeTab, true, true)
  }

  const handleApprove = async (entityType, entityId) => {
    try {
      let endpoint, bodyKey;
      
      switch(entityType) {
        case 'university':
          endpoint = '/api/approve-university'
          bodyKey = 'universityId'
          break
        case 'recruiter':
          endpoint = '/api/approve-recruiter'
          bodyKey = 'recruiterId'
          break
        case 'college':
          endpoint = '/api/approve-college'
          bodyKey = 'collegeId'
          break
        case 'student':
          endpoint = '/api/approve-student'
          bodyKey = 'studentId'
          break
        default:
          throw new Error('Unsupported entity type')
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          [bodyKey]: entityId,
          userId: currentUser?.user?.id,
          notes: `Approved by ${currentUser?.user?.name || currentUser?.user?.email}`
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast({
          title: 'Approved',
          description: `${entityType === 'university' ? 'University' : entityType === 'recruiter' ? 'Recruiter' : entityType === 'college' ? 'College' : 'Student'} has been approved successfully`,
        })
        fetchPendingEntities()
      } else {
        throw new Error(data.error || data.message || 'Approval failed')
      }
    } catch (error) {
      console.error('Approval error:', error)
      toast({
        title: 'Error',
        description: error.message || `Failed to approve ${entityType}. Please try again later.`,
        variant: 'destructive'
      })
    }
    setActionDialog({ open: false, entity: null, entityType: null, action: null, reason: '' })
  }

  const handleReject = async (entityType, entityId, reason) => {
    if (!reason || reason.trim() === '') {
      toast({
        title: 'Error',
        description: 'Please provide a reason for rejection',
        variant: 'destructive'
      })
      return
    }

    try {
      let endpoint, bodyKey;
      
      switch(entityType) {
        case 'university':
          endpoint = '/api/reject-university'
          bodyKey = 'universityId'
          break
        case 'recruiter':
          endpoint = '/api/reject-recruiter'
          bodyKey = 'recruiterId'
          break
        case 'college':
          endpoint = '/api/reject-college'
          bodyKey = 'collegeId'
          break
        case 'student':
          endpoint = '/api/reject-student'
          bodyKey = 'studentId'
          break
        default:
          throw new Error('Unsupported entity type')
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          [bodyKey]: entityId,
          userId: currentUser?.user?.id,
          reason: reason,
          notes: `Rejected by ${currentUser?.user?.name || currentUser?.user?.email}`
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast({
          title: 'Rejected',
          description: `${entityType === 'university' ? 'University' : entityType === 'recruiter' ? 'Recruiter' : entityType === 'college' ? 'College' : 'Student'} has been rejected`,
        })
        fetchPendingEntities()
      } else {
        throw new Error(data.error || data.message || 'Rejection failed')
      }
    } catch (error) {
      console.error('Rejection error:', error)
      toast({
        title: 'Error',
        description: error.message || `Failed to reject ${entityType}. Please try again later.`,
        variant: 'destructive'
      })
    }
    setActionDialog({ open: false, entity: null, entityType: null, action: null, reason: '' })
  }

  const openActionDialog = (entity, entityType, action) => {
    setActionDialog({
      open: true,
      entity,
      entityType,
      action,
      reason: ''
    })
  }

  const openDetailsDialog = (entity, entityType) => {
    setDetailsDialog({
      open: true,
      entity,
      entityType,
      loading: false
    })
  }

  // Filter functions for each entity type
  const filterEntities = (entities, entityType) => {
    return entities.filter(entity => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase()
        let matchesSearch = false
        
        switch(entityType) {
          case 'university':
            matchesSearch = (
              entity.name?.toLowerCase().includes(searchLower) ||
              entity.email?.toLowerCase().includes(searchLower) ||
              entity.state?.toLowerCase().includes(searchLower) ||
              entity.district?.toLowerCase().includes(searchLower)
            )
            break
          case 'recruiter':
            matchesSearch = (
              entity.name?.toLowerCase().includes(searchLower) ||
              entity.email?.toLowerCase().includes(searchLower) ||
              entity.state?.toLowerCase().includes(searchLower) ||
              entity.phone?.toLowerCase().includes(searchLower)
            )
            break
          case 'college':
            matchesSearch = (
              entity.name?.toLowerCase().includes(searchLower) ||
              entity.email?.toLowerCase().includes(searchLower) ||
              entity.state?.toLowerCase().includes(searchLower) ||
              entity.city?.toLowerCase().includes(searchLower) ||
              entity.code?.toLowerCase().includes(searchLower)
            )
            break
          case 'student':
            const studentName = entity.profile?.name || entity.name || entity.users?.metadata?.name || ''
            matchesSearch = (
              studentName.toLowerCase().includes(searchLower) ||
              entity.email?.toLowerCase().includes(searchLower) ||
              entity.university?.name?.toLowerCase().includes(searchLower) ||
              entity.college_school_name?.toLowerCase().includes(searchLower) ||
              entity.branch_field?.toLowerCase().includes(searchLower)
            )
            break
        }
        
        if (!matchesSearch) return false
      }
      
      // State filter
      if (filters.state !== 'all' && entity.state !== filters.state) {
        return false
      }
      
      // College filter for students
      if (entityType === 'student' && filters.college && filters.college !== 'all' && 
          entity.college_school_name !== filters.college) {
        return false
      }
      
      // Branch filter for students
      if (entityType === 'student' && filters.branch && filters.branch !== 'all' && 
          entity.branch_field !== filters.branch) {
        return false
      }
      
      // Date range filter
      if (filters.dateFrom && new Date(entity.created_at) < new Date(filters.dateFrom)) {
        return false
      }
      
      if (filters.dateTo && new Date(entity.created_at) > new Date(filters.dateTo)) {
        return false
      }
      
      return true
    })
  }

  const filteredUniversities = filterEntities(universities, 'university')
  const filteredRecruiters = filterEntities(recruiters, 'recruiter')
  const filteredColleges = filterEntities(colleges, 'college')
  const filteredStudents = filterEntities(students, 'student')

  const totalPending = pagination.universities.total + pagination.recruiters.total + pagination.colleges.total + pagination.students.total

  const renderEntityCard = (entity, entityType) => {
    const isUniversity = entityType === 'university'
    const isRecruiter = entityType === 'recruiter'
    const isCollege = entityType === 'college'
    const isStudent = entityType === 'student'
    
    return (
      <Card key={entity.id} className="hover:shadow-lg transition-all duration-300 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {isUniversity ? (
                  <Building2 className="h-5 w-5 text-blue-500" />
                ) : isRecruiter ? (
                  <Briefcase className="h-5 w-5 text-purple-500" />
                ) : isCollege ? (
                  <School className="h-5 w-5 text-green-500" />
                ) : (
                  <User className="h-5 w-5 text-orange-500" />
                )}
                <h3 className="text-lg font-bold truncate">
                  {isStudent ? (entity.profile?.name || entity.users?.metadata?.name || 'Unknown Student') : entity.name}
                </h3>
              </div>
              <Badge variant="secondary" className="mb-2">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Pending Approval
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openDetailsDialog(entity, entityType)}
              className="shrink-0"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {(entity.email || (isStudent && entity.users?.email)) && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span className="truncate">{isStudent ? entity.users?.email : entity.email}</span>
              </div>
            )}
            {entity.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span className="truncate">{entity.phone}</span>
              </div>
            )}
            {entity.state && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{entity.state}{entity.district && `, ${entity.district}`}</span>
              </div>
            )}
            {entity.website && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Globe className="h-4 w-4" />
                <a href={entity.website} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                  {entity.website}
                </a>
              </div>
            )}
            {isStudent && entity.university?.name && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span className="truncate">{entity.university.name}</span>
              </div>
            )}
            {isStudent && entity.college_school_name && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <School className="h-4 w-4" />
                <span className="truncate">{entity.college_school_name}</span>
              </div>
            )}
            {isStudent && entity.branch_field && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Book className="h-4 w-4" />
                <span className="truncate">{entity.branch_field}</span>
              </div>
            )}
            {isStudent && entity.roll_number && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="font-medium">Roll #:</span>
                <span className="truncate">{entity.roll_number}</span>
              </div>
            )}
          </div>
          
          {entity.created_at && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground border-t border-white/20 dark:border-slate-700/50 pt-3">
              <Calendar className="h-3 w-3" />
              <span>Submitted: {new Date(entity.created_at).toLocaleDateString()}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => openActionDialog(entity, entityType, 'approve')}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg shadow-green-500/25"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approve
            </Button>
            <Button
              onClick={() => openActionDialog(entity, entityType, 'reject')}
              variant="destructive"
              className="flex-1 shadow-lg shadow-red-500/25"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Get unique states for filter dropdown
  const getUniqueStates = () => {
    const allEntities = [...universities, ...recruiters, ...colleges, ...students]
    const states = [...new Set(allEntities.map(entity => entity.state).filter(Boolean))]
    return states.sort()
  }

  // Get unique colleges/schools for filter dropdown
  const getUniqueColleges = () => {
    const collegeNames = [...new Set(students.map(student => student.college_school_name).filter(Boolean))]
    return collegeNames.sort()
  }

  // Get unique branches for filter dropdown
  const getUniqueBranches = () => {
    const branches = [...new Set(students.map(student => student.branch_field).filter(Boolean))]
    return branches.sort()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
            Approval Center
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and approve pending registrations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchPendingEntities}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Badge 
            variant="secondary" 
            className="px-4 py-2 text-base bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/20 dark:border-orange-500/30"
          >
            {totalPending} Pending
          </Badge>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={`Search ${activeTab} by name, email, or location...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-white dark:bg-slate-900"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={filters.state} onValueChange={(value) => setFilters({...filters, state: value})}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All States" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {getUniqueStates().map(state => (
                    <SelectItem key={state} value={state}>{state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeTab === 'students' && (
                <>
                  <Select value={filters.college || 'all'} onValueChange={(value) => setFilters({...filters, college: value})}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Colleges" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Colleges</SelectItem>
                      {getUniqueColleges().map(college => (
                        <SelectItem key={college} value={college}>{college}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filters.branch || 'all'} onValueChange={(value) => setFilters({...filters, branch: value})}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Branches" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Branches</SelectItem>
                      {getUniqueBranches().map(branch => (
                        <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                  placeholder="From"
                  className="w-[140px] bg-white dark:bg-slate-900"
                />
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                  placeholder="To"
                  className="w-[140px] bg-white dark:bg-slate-900"
                />
              </div>
              <Button 
                variant="outline" 
                onClick={() => setFilters({state: 'all', dateFrom: '', dateTo: '', college: 'all', branch: 'all'})}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-white/20 dark:border-slate-700/50">
          <TabsTrigger value="universities" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
            <Building2 className="h-4 w-4 mr-2" />
            Universities ({pagination.universities.total})
          </TabsTrigger>
          <TabsTrigger value="recruiters" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
            <Briefcase className="h-4 w-4 mr-2" />
            Recruiters ({pagination.recruiters.total})
          </TabsTrigger>
          <TabsTrigger value="colleges" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
            <School className="h-4 w-4 mr-2" />
            Colleges ({pagination.colleges.total})
          </TabsTrigger>
          <TabsTrigger value="students" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
            <User className="h-4 w-4 mr-2" />
            Students ({pagination.students.total})
          </TabsTrigger>
        </TabsList>

        {/* Universities Tab */}
        <TabsContent value="universities" className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : filteredUniversities.length === 0 ? (
            <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50">
              <CardContent className="text-center py-12">
                <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">All Clear!</h3>
                <p className="text-muted-foreground">
                  {search || filters.state !== 'all' ? 'No universities match your search criteria' : 'No pending university approvals at the moment'}
                </p>
                {!search && filters.state === 'all' && (
                  <Button 
                    variant="outline" 
                    className="mt-4" 
                    onClick={fetchPendingEntities}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Data
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredUniversities.map(univ => renderEntityCard(univ, 'university'))}
              </div>
              
              {/* Infinite scroll trigger and Load More button */}
              {pagination.universities.hasMore && (
                <div className="mt-6 flex flex-col items-center gap-4">
                  {pagination.universities.loadingMore && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading more universities...</span>
                    </div>
                  )}
                  
                  {/* Intersection observer target */}
                  <div ref={loadMoreRef} className="h-4" />
                  
                  {/* Manual Load More button */}
                  <Button
                    variant="outline"
                    onClick={loadMoreEntities}
                    disabled={pagination.universities.loadingMore}
                    className="w-full max-w-md"
                  >
                    {pagination.universities.loadingMore ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        Load More Universities
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({universities.length} of {pagination.universities.total})
                        </span>
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              {!pagination.universities.hasMore && universities.length > 0 && (
                <div className="mt-6 text-center text-sm text-muted-foreground">
                  All {pagination.universities.total} universities loaded
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Recruiters Tab */}
        <TabsContent value="recruiters" className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          ) : filteredRecruiters.length === 0 ? (
            <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50">
              <CardContent className="text-center py-12">
                <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">All Clear!</h3>
                <p className="text-muted-foreground">
                  {search || filters.state !== 'all' ? 'No recruiters match your search criteria' : 'No pending recruiter approvals at the moment'}
                </p>
                {!search && filters.state === 'all' && (
                  <Button 
                    variant="outline" 
                    className="mt-4" 
                    onClick={fetchPendingEntities}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Data
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredRecruiters.map(rec => renderEntityCard(rec, 'recruiter'))}
              </div>
              
              {/* Infinite scroll trigger and Load More button */}
              {pagination.recruiters.hasMore && (
                <div className="mt-6 flex flex-col items-center gap-4">
                  {pagination.recruiters.loadingMore && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading more recruiters...</span>
                    </div>
                  )}
                  
                  {/* Intersection observer target */}
                  <div ref={loadMoreRef} className="h-4" />
                  
                  {/* Manual Load More button */}
                  <Button
                    variant="outline"
                    onClick={loadMoreEntities}
                    disabled={pagination.recruiters.loadingMore}
                    className="w-full max-w-md"
                  >
                    {pagination.recruiters.loadingMore ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        Load More Recruiters
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({recruiters.length} of {pagination.recruiters.total})
                        </span>
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              {!pagination.recruiters.hasMore && recruiters.length > 0 && (
                <div className="mt-6 text-center text-sm text-muted-foreground">
                  All {pagination.recruiters.total} recruiters loaded
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Colleges Tab */}
        <TabsContent value="colleges" className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-green-500" />
            </div>
          ) : filteredColleges.length === 0 ? (
            <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50">
              <CardContent className="text-center py-12">
                <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">All Clear!</h3>
                <p className="text-muted-foreground">
                  {search || filters.state !== 'all' ? 'No colleges match your search criteria' : 'No pending college approvals at the moment'}
                </p>
                {!search && filters.state === 'all' && (
                  <Button 
                    variant="outline" 
                    className="mt-4" 
                    onClick={fetchPendingEntities}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Data
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredColleges.map(college => renderEntityCard(college, 'college'))}
              </div>
              
              {/* Infinite scroll trigger and Load More button */}
              {pagination.colleges.hasMore && (
                <div className="mt-6 flex flex-col items-center gap-4">
                  {pagination.colleges.loadingMore && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading more colleges...</span>
                    </div>
                  )}
                  
                  {/* Intersection observer target */}
                  <div ref={loadMoreRef} className="h-4" />
                  
                  {/* Manual Load More button */}
                  <Button
                    variant="outline"
                    onClick={loadMoreEntities}
                    disabled={pagination.colleges.loadingMore}
                    className="w-full max-w-md"
                  >
                    {pagination.colleges.loadingMore ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        Load More Colleges
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({colleges.length} of {pagination.colleges.total})
                        </span>
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              {!pagination.colleges.hasMore && colleges.length > 0 && (
                <div className="mt-6 text-center text-sm text-muted-foreground">
                  All {pagination.colleges.total} colleges loaded
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Students Tab */}
        <TabsContent value="students" className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50">
              <CardContent className="text-center py-12">
                <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">All Clear!</h3>
                <p className="text-muted-foreground">
                  {search || filters.state !== 'all' || filters.college !== 'all' || filters.branch !== 'all' ? 'No students match your search criteria' : 'No pending student approvals at the moment'}
                </p>
                {!search && filters.state === 'all' && filters.college === 'all' && filters.branch === 'all' && (
                  <Button 
                    variant="outline" 
                    className="mt-4" 
                    onClick={fetchPendingEntities}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Data
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredStudents.map(student => renderEntityCard(student, 'student'))}
              </div>
              
              {/* Infinite scroll trigger and Load More button */}
              {pagination.students.hasMore && (
                <div className="mt-6 flex flex-col items-center gap-4">
                  {pagination.students.loadingMore && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading more students...</span>
                    </div>
                  )}
                  
                  {/* Intersection observer target */}
                  <div ref={loadMoreRef} className="h-4" />
                  
                  {/* Manual Load More button */}
                  <Button
                    variant="outline"
                    onClick={loadMoreEntities}
                    disabled={pagination.students.loadingMore}
                    className="w-full max-w-md"
                  >
                    {pagination.students.loadingMore ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        Load More Students
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({students.length} of {pagination.students.total})
                        </span>
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              {!pagination.students.hasMore && students.length > 0 && (
                <div className="mt-6 text-center text-sm text-muted-foreground">
                  All {pagination.students.total} students loaded
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Action Confirmation Dialog */}
      <AlertDialog open={actionDialog.open} onOpenChange={(open) => !open && setActionDialog({ open: false, entity: null, entityType: null, action: null, reason: '' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.action === 'approve' ? 'Approve' : 'Reject'} {actionDialog.entityType === 'university' ? 'University' : actionDialog.entityType === 'recruiter' ? 'Recruiter' : actionDialog.entityType === 'college' ? 'College' : 'Student'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialog.action === 'approve' ? (
                <>
                  Are you sure you want to approve <strong>{actionDialog.entityType === 'student' ? (actionDialog.entity?.profile?.name || actionDialog.entity?.users?.metadata?.name || 'Unknown Student') : actionDialog.entity?.name}</strong>?
                  <br />
                  This will activate their account and grant them access to the platform.
                </>
              ) : (
                <>
                  <span>
                    Are you sure you want to reject <strong>{actionDialog.entityType === 'student' ? (actionDialog.entity?.profile?.name || actionDialog.entity?.users?.metadata?.name || 'Unknown Student') : actionDialog.entity?.name}</strong>?
                  </span>
                  <br /><br />
                  <label className="text-sm font-medium">Rejection Reason *</label>
                  <br />
                  <Textarea
                    placeholder="Please provide a reason for rejection..."
                    value={actionDialog.reason}
                    onChange={(e) => setActionDialog({ ...actionDialog, reason: e.target.value })}
                    className="min-h-[100px] w-full mt-1"
                  />
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (actionDialog.action === 'approve') {
                  handleApprove(actionDialog.entityType, actionDialog.entity?.id)
                } else {
                  handleReject(actionDialog.entityType, actionDialog.entity?.id, actionDialog.reason)
                }
              }}
              className={actionDialog.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {actionDialog.action === 'approve' ? 'Approve' : 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialog.open} onOpenChange={(open) => !open && setDetailsDialog({ open: false, entity: null, entityType: null, loading: false })}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailsDialog.entityType === 'university' ? (
                <Building2 className="h-5 w-5 text-blue-500" />
              ) : detailsDialog.entityType === 'recruiter' ? (
                <Briefcase className="h-5 w-5 text-purple-500" />
              ) : detailsDialog.entityType === 'college' ? (
                <School className="h-5 w-5 text-green-500" />
              ) : (
                <User className="h-5 w-5 text-orange-500" />
              )}
              {detailsDialog.entityType === 'student' ? (detailsDialog.entity?.profile?.name || detailsDialog.entity?.users?.metadata?.name || 'Unknown Student') : detailsDialog.entity?.name}
            </DialogTitle>
            <DialogDescription>
              Detailed information about this {detailsDialog.entityType}
            </DialogDescription>
          </DialogHeader>
          
          {detailsDialog.entity && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-sm">{detailsDialog.entityType === 'student' ? detailsDialog.entity.users?.email : detailsDialog.entity.email || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Phone</label>
                  <p className="text-sm">{detailsDialog.entity.phone || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">State</label>
                  <p className="text-sm">{detailsDialog.entity.state || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">District</label>
                  <p className="text-sm">{detailsDialog.entity.district || 'N/A'}</p>
                </div>
                {detailsDialog.entity.website && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">Website</label>
                    <p className="text-sm">
                      <a href={detailsDialog.entity.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                        {detailsDialog.entity.website}
                      </a>
                    </p>
                  </div>
                )}
                {detailsDialog.entity.address && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">Address</label>
                    <p className="text-sm">{detailsDialog.entity.address}</p>
                  </div>
                )}
                {detailsDialog.entityType === 'student' && detailsDialog.entity.university?.name && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">University</label>
                    <p className="text-sm">{detailsDialog.entity.university.name}</p>
                  </div>
                )}
                {detailsDialog.entityType === 'student' && detailsDialog.entity.college_school_name && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">College/School</label>
                    <p className="text-sm">{detailsDialog.entity.college_school_name}</p>
                  </div>
                )}
                {detailsDialog.entityType === 'student' && detailsDialog.entity.branch_field && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Branch</label>
                    <p className="text-sm">{detailsDialog.entity.branch_field}</p>
                  </div>
                )}
                {detailsDialog.entityType === 'student' && detailsDialog.entity.roll_number && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Roll Number</label>
                    <p className="text-sm">{detailsDialog.entity.roll_number}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Submitted Date</label>
                  <p className="text-sm">{new Date(detailsDialog.entity.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <Badge variant="secondary">
                    {detailsDialog.entity.approval_status || 'pending'}
                  </Badge>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={() => {
                    setDetailsDialog({ open: false, entity: null, entityType: null, loading: false })
                    openActionDialog(detailsDialog.entity, detailsDialog.entityType, 'approve')
                  }}
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  onClick={() => {
                    setDetailsDialog({ open: false, entity: null, entityType: null, loading: false })
                    openActionDialog(detailsDialog.entity, detailsDialog.entityType, 'reject')
                  }}
                  variant="destructive"
                  className="flex-1"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}