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
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  BookOpen,
  Briefcase,
  Building2,
  CheckCircle2,
  Loader2,
  RefreshCw,
  School,
  User,
  Users,
  XCircle
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CardGridLoader } from '@/components/ui/page-loader'

// Import modular components
import ApprovalSearchFilter from '@/components/approvals/ApprovalSearchFilter'
import CardView from '@/components/approvals/views/CardView'
import TableView from '@/components/approvals/views/TableView'
import ListView from '@/components/approvals/views/ListView'
import CompactGridView from '@/components/approvals/views/CompactGridView'
import { useApprovalView } from '@/components/approvals/ApprovalViewContext'

export default function ApprovalsPage({ currentUser }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  // Get active tab from URL, default to 'universities'
  const activeTab = searchParams.get('tab') || 'universities'

  const [universities, setUniversities] = useState([])
  const [recruiters, setRecruiters] = useState([])
  const [colleges, setColleges] = useState([])
  const [students, setStudents] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState({
    universities: false,
    recruiters: false,
    colleges: false,
    students: false,
    courses: false
  })
  const [filtering, setFiltering] = useState(false)

  // View type from context
  const { viewType, isHydrated } = useApprovalView()

  // Separate search and filter states for each tab
  const [universitySearch, setUniversitySearch] = useState('')
  const [recruiterSearch, setRecruiterSearch] = useState('')
  const [collegeSearch, setCollegeSearch] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [courseSearch, setCourseSearch] = useState('')

  const [universityFilters, setUniversityFilters] = useState({
    state: 'all'
  })

  const [recruiterFilters, setRecruiterFilters] = useState({
    state: 'all'
  })

  const [collegeFilters, setCollegeFilters] = useState({
    state: 'all'
  })

  const [studentFilters, setStudentFilters] = useState({
    state: 'all',
    college: 'all',
    branch: 'all'
  })

  const [courseFilters, setCourseFilters] = useState({
    state: 'all'
  })

  // Cache for all unique filter options (accumulated as we load students)
  const [allUniqueColleges, setAllUniqueColleges] = useState([])
  const [allUniqueBranches, setAllUniqueBranches] = useState([])
  const [allUniqueStates, setAllUniqueStates] = useState([])

  // Sort states for each tab (loaded from localStorage)
  const [universitySort, setUniversitySort] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('approvalSort_universities') || 'date-newest'
    }
    return 'date-newest'
  })

  const [recruiterSort, setRecruiterSort] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('approvalSort_recruiters') || 'date-newest'
    }
    return 'date-newest'
  })

  const [collegeSort, setCollegeSort] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('approvalSort_colleges') || 'date-newest'
    }
    return 'date-newest'
  })

  const [studentSort, setStudentSort] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('approvalSort_students') || 'date-newest'
    }
    return 'date-newest'
  })

  const [courseSort, setCourseSort] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('approvalSort_courses') || 'date-newest'
    }
    return 'date-newest'
  })

  // Save sort preferences to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('approvalSort_universities', universitySort)
    }
  }, [universitySort])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('approvalSort_recruiters', recruiterSort)
    }
  }, [recruiterSort])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('approvalSort_colleges', collegeSort)
    }
  }, [collegeSort])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('approvalSort_students', studentSort)
    }
  }, [studentSort])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('approvalSort_courses', courseSort)
    }
  }, [courseSort])

  // Lazy loading state
  const [loadedTabs, setLoadedTabs] = useState({
    universities: false,
    recruiters: false,
    colleges: false,
    students: false,
    courses: false
  })

  // Infinite scroll state per tab
  const [pagination, setPagination] = useState({
    universities: { page: 1, hasMore: true, loadingMore: false, total: 0 },
    recruiters: { page: 1, hasMore: true, loadingMore: false, total: 0 },
    colleges: { page: 1, hasMore: true, loadingMore: false, total: 0 },
    students: { page: 1, hasMore: true, loadingMore: false, total: 0 },
    courses: { page: 1, hasMore: true, loadingMore: false, total: 0 }
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

  // Refs for infinite scroll observer - one per tab
  const universitiesLoadMoreRef = useRef(null)
  const recruitersLoadMoreRef = useRef(null)
  const collegesLoadMoreRef = useRef(null)
  const studentsLoadMoreRef = useRef(null)
  const coursesLoadMoreRef = useRef(null)

  // Get the correct ref for the active tab
  const getLoadMoreRef = (tab) => {
    switch (tab) {
      case 'universities': return universitiesLoadMoreRef
      case 'recruiters': return recruitersLoadMoreRef
      case 'colleges': return collegesLoadMoreRef
      case 'students': return studentsLoadMoreRef
      case 'courses': return coursesLoadMoreRef
      default: return universitiesLoadMoreRef
    }
  }

  // Fetch counts for all tabs on initial load
  useEffect(() => {
    fetchAllCounts()
    // Also dispatch a refresh event to update sidebar counts
    window.dispatchEvent(new CustomEvent('refreshPage'))
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

  // Use refs to track current pagination state for intersection observer
  const paginationRef = useRef(pagination)
  const loadingRef = useRef(loading)
  const activeTabRef = useRef(activeTab)
  
  // Keep refs in sync with state
  useEffect(() => {
    paginationRef.current = pagination
  }, [pagination])
  
  useEffect(() => {
    loadingRef.current = loading
  }, [loading])
  
  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const currentRef = getLoadMoreRef(activeTab)
    
    const observer = new IntersectionObserver(
      (entries) => {
        const tab = activeTabRef.current
        const pag = paginationRef.current[tab]
        const isLoading = loadingRef.current[tab]
        
        if (entries[0].isIntersecting && pag?.hasMore && !pag?.loadingMore && !isLoading) {
          loadMoreEntities()
        }
      },
      { threshold: 0.1 }
    )

    if (currentRef.current) {
      observer.observe(currentRef.current)
    }

    return () => {
      if (currentRef.current) {
        observer.unobserve(currentRef.current)
      }
    }
  }, [activeTab]) // Only re-create observer when tab changes

  // Refetch when university filters/search/sort change
  useEffect(() => {
    if (loadedTabs.universities) {
      setPagination(prev => ({
        ...prev,
        universities: { ...prev.universities, page: 1, hasMore: true }
      }))
      fetchTabData('universities', false, true, true)
    }
  }, [universitySearch, universityFilters, universitySort])

  // Refetch when recruiter filters/search/sort change
  useEffect(() => {
    if (loadedTabs.recruiters) {
      setPagination(prev => ({
        ...prev,
        recruiters: { ...prev.recruiters, page: 1, hasMore: true }
      }))
      fetchTabData('recruiters', false, true, true)
    }
  }, [recruiterSearch, recruiterFilters, recruiterSort])

  // Refetch when college filters/search/sort change
  useEffect(() => {
    if (loadedTabs.colleges) {
      setPagination(prev => ({
        ...prev,
        colleges: { ...prev.colleges, page: 1, hasMore: true }
      }))
      fetchTabData('colleges', false, true, true)
    }
  }, [collegeSearch, collegeFilters, collegeSort])

  // Refetch when student filters/search/sort change
  useEffect(() => {
    if (loadedTabs.students) {
      setPagination(prev => ({
        ...prev,
        students: { ...prev.students, page: 1, hasMore: true }
      }))
      fetchTabData('students', false, true, true)
    }
  }, [studentSearch, studentFilters, studentSort])

  // Refetch when course filters/search/sort change
  useEffect(() => {
    if (loadedTabs.courses) {
      setPagination(prev => ({
        ...prev,
        courses: { ...prev.courses, page: 1, hasMore: true }
      }))
      fetchTabData('courses', false, true, true)
    }
  }, [courseSearch, courseFilters, courseSort])

  // Fetch counts for all entity types on initial load
  const fetchAllCounts = async () => {
    try {
      const endpoints = [
        { type: 'universities', url: '/api/universities?approval_status=pending&page=1&limit=1' },
        { type: 'recruiters', url: '/api/recruiters?approval_status=pending&page=1&limit=1' },
        { type: 'colleges', url: '/api/colleges?approval_status=pending&page=1&limit=1' },
        { type: 'students', url: '/api/students?approval_status=pending&page=1&limit=1' },
        { type: 'courses', url: '/api/courses?approval_status=pending&page=1&limit=1' }
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

  // Update accumulated unique values whenever students data changes
  const updateStudentFilterOptions = (newStudents) => {
    if (!newStudents || newStudents.length === 0) return

    // Accumulate unique values
    const existingColleges = new Set(allUniqueColleges)
    const existingBranches = new Set(allUniqueBranches)
    const existingStates = new Set(allUniqueStates)

    newStudents.forEach(student => {
      if (student.college_school_name) existingColleges.add(student.college_school_name)
      if (student.branch_field) existingBranches.add(student.branch_field)
      if (student.state) existingStates.add(student.state)
    })

    setAllUniqueColleges(Array.from(existingColleges).sort())
    setAllUniqueBranches(Array.from(existingBranches).sort())
    setAllUniqueStates(Array.from(existingStates).sort())
  }

  const fetchTabData = async (tabName, isInitialLoad = false, forceRefresh = false, isFiltering = false) => {
    if (isInitialLoad) {
      setLoading(prev => ({ ...prev, [tabName]: true }))
    } else if (isFiltering) {
      setFiltering(true)
    }

    const limit = 20 // Items per page
    const page = forceRefresh ? 1 : pagination[tabName].page

    try {
      let endpoint = ''
      let response, data

      // Build endpoint with filters
      const buildEndpoint = (base, filters, search, sort) => {
        const params = new URLSearchParams({
          approval_status: 'pending',
          page: page.toString(),
          limit: limit.toString(),
          sort: sort
        })

        if (search) {
          params.append('search', search)
        }
        if (filters.state && filters.state !== 'all') {
          params.append('state', filters.state)
        }
        if (filters.college && filters.college !== 'all') {
          params.append('college_school_name', filters.college)
        }
        if (filters.branch && filters.branch !== 'all') {
          params.append('branch_field', filters.branch)
        }

        return `${base}?${params.toString()}`
      }

      switch (tabName) {
        case 'universities':
          endpoint = buildEndpoint('/api/universities', universityFilters, universitySearch, universitySort)
          break
        case 'recruiters':
          endpoint = buildEndpoint('/api/recruiters', recruiterFilters, recruiterSearch, recruiterSort)
          break
        case 'colleges':
          endpoint = buildEndpoint('/api/colleges', collegeFilters, collegeSearch, collegeSort)
          break
        case 'students':
          endpoint = buildEndpoint('/api/students', studentFilters, studentSearch, studentSort)
          break
        case 'courses':
          endpoint = buildEndpoint('/api/courses', courseFilters, courseSearch, courseSort)
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
          switch (tabName) {
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
              updateStudentFilterOptions(newData)
              break
            case 'courses':
              setCourses(newData)
              break
          }
        } else {
          // Set initial data
          switch (tabName) {
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
              updateStudentFilterOptions(newData)
              break
            case 'courses':
              setCourses(newData)
              break
          }
        }

        // Mark tab as loaded
        setLoadedTabs(prev => ({ ...prev, [tabName]: true }))

        // Calculate hasMore properly
        const currentPage = paginationInfo.page || 1
        const totalPages = paginationInfo.totalPages || 0
        const totalItems = paginationInfo.total || 0

        // hasMore is false if:
        // - No data returned (newData.length === 0)
        // - We've loaded all items (newData.length >= totalItems)
        // - We're on or past the last page (currentPage >= totalPages)
        // - totalPages is 0 or 1 (only one page of data)
        const hasMoreItems = newData.length > 0 && newData.length < totalItems && currentPage < totalPages

        // Update pagination info
        setPagination(prev => ({
          ...prev,
          [tabName]: {
            page: currentPage,
            hasMore: hasMoreItems,
            loadingMore: false,
            total: totalItems
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
        setLoading(prev => ({ ...prev, [tabName]: false }))
      }
      if (isFiltering) {
        setFiltering(false)
      }
    }
  }

  const loadMoreEntities = async () => {
    const currentTab = activeTab
    const currentPagination = pagination[currentTab]

    // Early exit if no more data to load
    if (!currentPagination.hasMore || currentPagination.loadingMore) {
      return
    }

    // Get current loaded count for this tab
    let currentLoadedCount = 0
    switch (currentTab) {
      case 'universities': currentLoadedCount = universities.length; break
      case 'recruiters': currentLoadedCount = recruiters.length; break
      case 'colleges': currentLoadedCount = colleges.length; break
      case 'students': currentLoadedCount = students.length; break
      case 'courses': currentLoadedCount = courses.length; break
    }

    // If we've already loaded all items, set hasMore to false and exit
    if (currentPagination.total > 0 && currentLoadedCount >= currentPagination.total) {
      setPagination(prev => ({
        ...prev,
        [currentTab]: { ...prev[currentTab], hasMore: false }
      }))
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

      // Build endpoint with filters
      const buildEndpoint = (base, filters, search, sort) => {
        const params = new URLSearchParams({
          approval_status: 'pending',
          page: nextPage.toString(),
          limit: limit.toString(),
          sort: sort
        })

        if (search) {
          params.append('search', search)
        }
        if (filters.state && filters.state !== 'all') {
          params.append('state', filters.state)
        }
        if (filters.college && filters.college !== 'all') {
          params.append('college_school_name', filters.college)
        }
        if (filters.branch && filters.branch !== 'all') {
          params.append('branch_field', filters.branch)
        }

        return `${base}?${params.toString()}`
      }

      switch (currentTab) {
        case 'universities':
          endpoint = buildEndpoint('/api/universities', universityFilters, universitySearch, universitySort)
          break
        case 'recruiters':
          endpoint = buildEndpoint('/api/recruiters', recruiterFilters, recruiterSearch, recruiterSort)
          break
        case 'colleges':
          endpoint = buildEndpoint('/api/colleges', collegeFilters, collegeSearch, collegeSort)
          break
        case 'students':
          endpoint = buildEndpoint('/api/students', studentFilters, studentSearch, studentSort)
          break
        case 'courses':
          endpoint = buildEndpoint('/api/courses', courseFilters, courseSearch, courseSort)
          break
      }

      const response = await fetch(endpoint)
      const data = await response.json()

      if (response.ok) {
        const newData = data.data || []
        const paginationInfo = data.pagination || {}

        // Append new data to existing data
        switch (currentTab) {
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
            updateStudentFilterOptions(newData)
            break
          case 'courses':
            setCourses(prev => [...prev, ...newData])
            break
        }

        // Calculate hasMore properly
        const totalPages = paginationInfo.totalPages || 0
        const totalItems = paginationInfo.total || 0

        // Get updated loaded count after appending new data
        let newLoadedCount = 0
        switch (currentTab) {
          case 'universities': newLoadedCount = universities.length + newData.length; break
          case 'recruiters': newLoadedCount = recruiters.length + newData.length; break
          case 'colleges': newLoadedCount = colleges.length + newData.length; break
          case 'students': newLoadedCount = students.length + newData.length; break
          case 'courses': newLoadedCount = courses.length + newData.length; break
        }

        // hasMore is false if:
        // - No data returned (newData.length === 0)
        // - We've loaded all items (newLoadedCount >= totalItems)
        // - We're on or past the last page (nextPage >= totalPages)
        const hasMoreItems = newData.length > 0 && newLoadedCount < totalItems && nextPage < totalPages

        // Update pagination info
        setPagination(prev => ({
          ...prev,
          [currentTab]: {
            page: nextPage,
            hasMore: hasMoreItems,
            loadingMore: false,
            total: totalItems
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
    // Also refresh counts
    fetchAllCounts()
    // Dispatch refresh event to update sidebar counts
    window.dispatchEvent(new CustomEvent('refreshPage'))
  }

  const handleApprove = async (entityType, entityId) => {
    try {
      let endpoint, bodyKey;

      switch (entityType) {
        case 'university':
          endpoint = '/api/universities/approve'
          bodyKey = 'universityId'
          break
        case 'recruiter':
          endpoint = '/api/recruiters/approve'
          bodyKey = 'recruiterId'
          break
        case 'college':
          endpoint = '/api/colleges/approve'
          bodyKey = 'collegeId'
          break
        case 'student':
          endpoint = '/api/students/approve'
          bodyKey = 'studentId'
          break
        case 'course':
          endpoint = '/api/courses/approve'
          bodyKey = 'courseId'
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

      switch (entityType) {
        case 'university':
          endpoint = '/api/universities/reject'
          bodyKey = 'universityId'
          break
        case 'recruiter':
          endpoint = '/api/recruiters/reject'
          bodyKey = 'recruiterId'
          break
        case 'college':
          endpoint = '/api/colleges/reject'
          bodyKey = 'collegeId'
          break
        case 'student':
          endpoint = '/api/students/reject'
          bodyKey = 'studentId'
          break
        case 'course':
          endpoint = '/api/courses/reject'
          bodyKey = 'courseId'
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

  // No client-side filtering/sorting needed - all done in database queries

  const totalPending = pagination.universities.total + pagination.recruiters.total + pagination.colleges.total + pagination.students.total + pagination.courses.total

  // Render view based on selected view type
  const renderView = (entities, entityType) => {
    const commonProps = {
      entities,
      entityType,
      onViewDetails: openDetailsDialog,
      onApprove: (entity, type) => openActionDialog(entity, type, 'approve'),
      onReject: (entity, type) => openActionDialog(entity, type, 'reject')
    }

    // Use 'card' view until hydrated to prevent hydration mismatch
    const effectiveViewType = isHydrated ? viewType : 'card'

    switch (effectiveViewType) {
      case 'card':
        return <CardView {...commonProps} />
      case 'table':
        return <TableView {...commonProps} />
      case 'list':
        return <ListView {...commonProps} />
      case 'compact':
        return <CompactGridView {...commonProps} />
      default:
        return <CardView {...commonProps} />
    }
  }

  // Get unique states for filter dropdown
  const getUniqueStates = (entities) => {
    const states = [...new Set(entities.map(entity => entity.state).filter(Boolean))]
    return states.sort()
  }

  // Get unique colleges/schools for filter dropdown
  const getUniqueColleges = () => {
    // Use accumulated values if available, otherwise compute from current students
    if (allUniqueColleges.length > 0) {
      return allUniqueColleges
    }
    const collegeNames = [...new Set(students.map(student => student.college_school_name).filter(Boolean))]
    return collegeNames.sort()
  }

  // Get unique branches for filter dropdown
  const getUniqueBranches = () => {
    // Use accumulated values if available, otherwise compute from current students
    if (allUniqueBranches.length > 0) {
      return allUniqueBranches
    }
    const branches = [...new Set(students.map(student => student.branch_field).filter(Boolean))]
    return branches.sort()
  }

  // Get tab info
  const getTabInfo = () => {
    const tabsInfo = {
      universities: { name: 'Universities', icon: Building2, count: pagination.universities.total },
      recruiters: { name: 'Recruiters', icon: Briefcase, count: pagination.recruiters.total },
      colleges: { name: 'Colleges', icon: School, count: pagination.colleges.total },
      students: { name: 'Students', icon: Users, count: pagination.students.total },
      courses: { name: 'Courses', icon: BookOpen, count: pagination.courses.total }
    }
    return tabsInfo[activeTab] || tabsInfo.universities
  }

  const currentTabInfo = getTabInfo()
  const TabIcon = currentTabInfo.icon

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center gap-4 pb-4 border-b border-white/20 dark:border-slate-700/50">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
          <TabIcon className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {currentTabInfo.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {currentTabInfo.count} {currentTabInfo.count === 1 ? 'item' : 'items'} pending approval
          </p>
        </div>
      </div>

      {/* Universities Content */}
      {activeTab === 'universities' && (
        <div className="space-y-6">
          {/* Search and Filters for Universities */}
          <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50 mb-6">
            <CardContent className="pt-6">
              <ApprovalSearchFilter
                searchValue={universitySearch}
                onSearchChange={setUniversitySearch}
                filters={universityFilters}
                onFilterChange={setUniversityFilters}
                sortValue={universitySort}
                onSortChange={setUniversitySort}
                uniqueStates={getUniqueStates(universities)}
                entityType="university"
                placeholder="Search universities by name, email, or location..."
                showViewSwitcher={true}
              />
            </CardContent>
          </Card>

          {loading.universities ? (
            <CardGridLoader count={6} columns={3} />
          ) : universities.length === 0 ? (
            <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50">
              <CardContent className="text-center py-12">
                <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">All Clear!</h3>
                <p className="text-muted-foreground">
                  {universitySearch || universityFilters.state !== 'all' ? 'No universities match your search criteria' : 'No pending university approvals at the moment'}
                </p>
                {!universitySearch && universityFilters.state === 'all' && (
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
            <div className="relative">
              {/* Filtering overlay */}
              {filtering && (
                <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground bg-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-lg">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Filtering...</span>
                  </div>
                </div>
              )}

              {renderView(universities, 'university')}

              {/* Infinite scroll trigger and Load More button */}
              {pagination.universities.hasMore && (
                <div className="mt-6 flex flex-col items-center gap-4">
                  {/* Intersection observer target */}
                  <div ref={universitiesLoadMoreRef} className="h-4" />

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
            </div>
          )}
        </div>
      )}

      {/* Recruiters Content */}
      {activeTab === 'recruiters' && (
        <div className="space-y-6">
          {/* Search and Filters for Recruiters */}
          <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50 mb-6">
            <CardContent className="pt-6">
              <ApprovalSearchFilter
                searchValue={recruiterSearch}
                onSearchChange={setRecruiterSearch}
                filters={recruiterFilters}
                onFilterChange={setRecruiterFilters}
                sortValue={recruiterSort}
                onSortChange={setRecruiterSort}
                uniqueStates={getUniqueStates(recruiters)}
                entityType="recruiter"
                placeholder="Search recruiters by name, email, or location..."
                showViewSwitcher={true}
              />
            </CardContent>
          </Card>

          {loading.recruiters ? (
            <CardGridLoader count={6} columns={3} />
          ) : recruiters.length === 0 ? (
            <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50">
              <CardContent className="text-center py-12">
                <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">All Clear!</h3>
                <p className="text-muted-foreground">
                  {recruiterSearch || recruiterFilters.state !== 'all' ? 'No recruiters match your search criteria' : 'No pending recruiter approvals at the moment'}
                </p>
                {!recruiterSearch && recruiterFilters.state === 'all' && (
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
            <div className="relative">
              {/* Filtering overlay */}
              {filtering && (
                <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground bg-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-lg">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Filtering...</span>
                  </div>
                </div>
              )}

              {renderView(recruiters, 'recruiter')}

              {/* Infinite scroll trigger and Load More button */}
              {pagination.recruiters.hasMore && (
                <div className="mt-6 flex flex-col items-center gap-4">
                  {/* Intersection observer target */}
                  <div ref={recruitersLoadMoreRef} className="h-4" />

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
            </div>
          )}
        </div>
      )}

      {/* Colleges Content */}
      {activeTab === 'colleges' && (
        <div className="space-y-6">
          {/* Search and Filters for Colleges */}
          <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50 mb-6">
            <CardContent className="pt-6">
              <ApprovalSearchFilter
                searchValue={collegeSearch}
                onSearchChange={setCollegeSearch}
                filters={collegeFilters}
                onFilterChange={setCollegeFilters}
                sortValue={collegeSort}
                onSortChange={setCollegeSort}
                uniqueStates={getUniqueStates(colleges)}
                entityType="college"
                placeholder="Search colleges by name, email, or location..."
                showViewSwitcher={true}
              />
            </CardContent>
          </Card>

          {loading.colleges ? (
            <CardGridLoader count={6} columns={3} />
          ) : colleges.length === 0 ? (
            <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50">
              <CardContent className="text-center py-12">
                <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">All Clear!</h3>
                <p className="text-muted-foreground">
                  {collegeSearch || collegeFilters.state !== 'all' ? 'No colleges match your search criteria' : 'No pending college approvals at the moment'}
                </p>
                {!collegeSearch && collegeFilters.state === 'all' && (
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
            <div className="relative">
              {/* Filtering overlay */}
              {filtering && (
                <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground bg-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-lg">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Filtering...</span>
                  </div>
                </div>
              )}

              {renderView(colleges, 'college')}

              {/* Infinite scroll trigger and Load More button */}
              {pagination.colleges.hasMore && (
                <div className="mt-6 flex flex-col items-center gap-4">
                  {/* Intersection observer target */}
                  <div ref={collegesLoadMoreRef} className="h-4" />

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
            </div>
          )}
        </div>
      )}

      {/* Students Content */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          {/* Search and Filters for Students */}
          <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50 mb-6">
            <CardContent className="pt-6">
              <ApprovalSearchFilter
                searchValue={studentSearch}
                onSearchChange={setStudentSearch}
                filters={studentFilters}
                onFilterChange={setStudentFilters}
                sortValue={studentSort}
                onSortChange={setStudentSort}
                uniqueStates={getUniqueStates(students)}
                uniqueColleges={getUniqueColleges()}
                uniqueBranches={getUniqueBranches()}
                entityType="student"
                placeholder="Search students by name, email, university, or college..."
                showViewSwitcher={true}
              />
            </CardContent>
          </Card>

          {loading.students ? (
            <CardGridLoader count={6} columns={3} />
          ) : students.length === 0 ? (
            <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50">
              <CardContent className="text-center py-12">
                <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">All Clear!</h3>
                <p className="text-muted-foreground">
                  {studentSearch || studentFilters.state !== 'all' || studentFilters.college !== 'all' || studentFilters.branch !== 'all' ? 'No students match your search criteria' : 'No pending student approvals at the moment'}
                </p>
                {!studentSearch && studentFilters.state === 'all' && studentFilters.college === 'all' && studentFilters.branch === 'all' && (
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
            <div className="relative">
              {/* Filtering overlay */}
              {filtering && (
                <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground bg-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-lg">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Filtering...</span>
                  </div>
                </div>
              )}

              {renderView(students, 'student')}

              {/* Infinite scroll trigger and Load More button */}
              {pagination.students.hasMore && (
                <div className="mt-6 flex flex-col items-center gap-4">
                  {/* Intersection observer target */}
                  <div ref={studentsLoadMoreRef} className="h-4" />

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
            </div>
          )}
        </div>
      )}

      {/* Courses Content */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          {/* Search and Filters for Courses */}
          <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50 mb-6">
            <CardContent className="pt-6">
              <ApprovalSearchFilter
                searchValue={courseSearch}
                onSearchChange={setCourseSearch}
                filters={courseFilters}
                onFilterChange={setCourseFilters}
                sortValue={courseSort}
                onSortChange={setCourseSort}
                uniqueStates={getUniqueStates(courses)}
                entityType="course"
                placeholder="Search courses by name, code, or university..."
                showViewSwitcher={true}
              />
            </CardContent>
          </Card>

          {loading.courses ? (
            <CardGridLoader count={6} columns={3} />
          ) : courses.length === 0 ? (
            <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50">
              <CardContent className="text-center py-12">
                <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">All Clear!</h3>
                <p className="text-muted-foreground">
                  {courseSearch || courseFilters.state !== 'all' ? 'No courses match your search criteria' : 'No pending course approvals at the moment'}
                </p>
                {!courseSearch && courseFilters.state === 'all' && (
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
            <div className="relative">
              {/* Filtering overlay */}
              {filtering && (
                <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground bg-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-lg">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Filtering...</span>
                  </div>
                </div>
              )}

              {renderView(courses, 'course')}

              {/* Infinite scroll trigger and Load More button */}
              {pagination.courses.hasMore && (
                <div className="mt-6 flex flex-col items-center gap-4">
                  {/* Intersection observer target */}
                  <div ref={coursesLoadMoreRef} className="h-4" />

                  {/* Manual Load More button */}
                  <Button
                    variant="outline"
                    onClick={loadMoreEntities}
                    disabled={pagination.courses.loadingMore}
                    className="w-full max-w-md"
                  >
                    {pagination.courses.loadingMore ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        Load More Courses
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({courses.length} of {pagination.courses.total})
                        </span>
                      </>
                    )}
                  </Button>
                </div>
              )}

              {!pagination.courses.hasMore && courses.length > 0 && (
                <div className="mt-6 text-center text-sm text-muted-foreground">
                  All {pagination.courses.total} courses loaded
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action Confirmation Dialog */}
      <AlertDialog open={actionDialog.open} onOpenChange={(open) => !open && setActionDialog({ open: false, entity: null, entityType: null, action: null, reason: '' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.action === 'approve' ? 'Approve' : 'Reject'} {actionDialog.entityType === 'university' ? 'University' : actionDialog.entityType === 'recruiter' ? 'Recruiter' : actionDialog.entityType === 'college' ? 'College' : actionDialog.entityType === 'course' ? 'Course' : 'Student'}
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
              ) : detailsDialog.entityType === 'course' ? (
                <BookOpen className="h-5 w-5 text-indigo-500" />
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