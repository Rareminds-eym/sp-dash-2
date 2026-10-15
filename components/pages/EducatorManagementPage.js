'use client'
import EducatorTeachingManager from '@/components/educators/EducatorTeachingManager';
import EducatorAssignmentsModal from '@/components/educators/EducatorAssignmentsModal';

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
import CollegeAssignmentForm from '@/components/educators/CollegeAssignmentForm'
import {
  BookOpen,
  Building2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  Upload,
  UserCheck,
  Users,
  UserX
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export default function EducatorManagementPage({ currentUser }) {
  const [managedEducator,setManagedEducator]=useState(null)
  const [assignmentsEducator,setAssignmentsEducator]=useState(null)
  const [educators, setEducators] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionDialog, setActionDialog] = useState({ open: false, educator: null, action: null })
  const [addEducatorDialog, setAddEducatorDialog] = useState(false)
  const [addEducatorLoading, setAddEducatorLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(1) // Step 1: Trainer Info, Step 2: College Assignment
  const [createdTrainerId, setCreatedTrainerId] = useState(null) // Store trainer ID after Step 1
  const [onboardingResult, setOnboardingResult] = useState(null)
  const creationRequestId = useRef(null)
  const { toast } = useToast()
  
  // Form state with all fields from the Faculty Onboarding UI
  const [educatorForm, setEducatorForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    employeeId: '',
    phone: '',
    organizationId: '', // SkillPassport Platform organization
    platformRole: 'Trainer', // Platform role (Trainer, Educator, etc.)
    qualification: '',
    experienceYears: 0,
    dateOfJoining: '',
    degreeCertificate: null,
    idProof: null,
    experienceLetters: null,
    subjects: [] // Array of {subjectName, level, yearsOfExperience}
  })
  
  // Form state for Step 2: College Assignment
  const [collegeAssignmentForm, setCollegeAssignmentForm] = useState({
    trainerId: '',
    collegeId: '',
    departmentId: '',
    programId: '', // optional
    sectionId: '', // optional
    assignedCourses: [], // array of course IDs
    startDate: '',
    endDate: '', // optional
    notes: '' // optional
  })
  
  // Organizations for Step 1 dropdown only
  const [organizations, setOrganizations] = useState([])

  const [currentSubject, setCurrentSubject] = useState({
    subjectName: '',
    level: 'Intermediate',
    yearsOfExperience: 0
  })

  // File input refs
  const degreeCertificateRef = useRef(null)
  const idProofRef = useRef(null)
  const experienceLettersRef = useRef(null)
  
  // Overall stats
  const [overallStats, setOverallStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    professors: 0,
    lecturers: 0
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
    department: 'all',
    facultyRole: 'all',
    status: 'all',
    sortBy: 'dateOfJoining',
    sortOrder: 'desc'
  })
  
  // Debounce timer for search
  const searchDebounceRef = useRef(null)

  useEffect(() => {
    fetchOverallStats()
    fetchOrganizations() // Fetch organizations for dropdown
    
    // Listen for refresh events from the layout
    const handleRefresh = () => {
      fetchEducators()
      fetchOverallStats()
    }
    window.addEventListener('refreshPage', handleRefresh)
    
    return () => {
      window.removeEventListener('refreshPage', handleRefresh)
    }
  }, [])

  useEffect(() => {
    fetchEducators()
  }, [pagination.page, pagination.limit, filters])

  const fetchOverallStats = async () => {
    try {
      console.log('📊 [FRONTEND] Fetching overall stats...')
      
      // Fetch all educators for stats calculation
      const response = await fetch('/api/educators?page=1&limit=10000')
      const data = await response.json()
      
      if (data.success) {
        const allEducators = data.data || []
        
        const stats = {
          total: allEducators.length,
          active: allEducators.filter(e => e.status === 'active').length,
          inactive: allEducators.filter(e => e.status === 'inactive').length,
          professors: allEducators.filter(e => 
            e.facultyRole?.toLowerCase().includes('professor')
          ).length,
          lecturers: allEducators.filter(e => 
            e.facultyRole?.toLowerCase().includes('lecturer')
          ).length
        }
        
        setOverallStats(stats)
        console.log('✅ [FRONTEND] Stats calculated:', stats)
      } else {
        setOverallStats({
          total: 0,
          active: 0,
          inactive: 0,
          professors: 0,
          lecturers: 0
        })
      }
    } catch (error) {
      console.error('❌ [FRONTEND] Error fetching overall stats:', error)
      setOverallStats({
        total: 0,
        active: 0,
        inactive: 0,
        professors: 0,
        lecturers: 0
      })
    }
  }
  
  const fetchOrganizations = async () => {
    try {
      console.log('Fetching organizations from /api/organizations...')
      const response = await fetch('/api/organizations')
      console.log('Response status:', response.status)
      
      const data = await response.json()
      console.log('Organizations data:', data)
      
      if (data.success) {
        // Filter to show ONLY SkillPassport Platform (RareMinds) for trainer creation
        const platformOrg = (data.data || []).filter(org => 
          org.id === '00000000-0000-0000-0000-000000000001'
        )
        setOrganizations(platformOrg)
        console.log(`Loaded ${platformOrg.length} platform organization (RareMinds only)`)
      } else {
        console.error('Failed to fetch organizations:', data.error)
        toast({
          title: 'Warning',
          description: 'Could not load organizations. The dropdown may be empty.',
          variant: 'warning'
        })
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch organizations',
        variant: 'destructive'
      })
    }
  }

  const fetchEducators = async () => {
    try {
      setLoading(true)
      console.log('📋 [FRONTEND] Fetching educators...')
      
      // Build query params
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      })
      
      if (filters.search) params.append('search', filters.search)
      if (filters.department && filters.department !== 'all') params.append('department', filters.department)
      if (filters.facultyRole && filters.facultyRole !== 'all') params.append('facultyRole', filters.facultyRole)
      if (filters.status && filters.status !== 'all') params.append('status', filters.status)
      
      console.log('📋 [FRONTEND] Query params:', params.toString())
      
      const response = await fetch(`/api/educators?${params}`)
      const data = await response.json()
      
      console.log('📋 [FRONTEND] API response:', data)
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch educators')
      }
      
      if (data.success) {
        setEducators(data.data || [])
        setPagination(prev => ({
          ...prev,
          total: data.pagination?.total || 0,
          totalPages: data.pagination?.totalPages || 0
        }))
        console.log(`✅ [FRONTEND] Loaded ${data.data?.length || 0} educators`)
      } else {
        throw new Error(data.error || 'Failed to fetch educators')
      }
    } catch (error) {
      console.error('❌ [FRONTEND] Error fetching educators:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch educators',
        variant: 'destructive'
      })
      setEducators([])
      setPagination(prev => ({
        ...prev,
        total: 0,
        totalPages: 0
      }))
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (educator, action) => {
    setActionDialog({ open: true, educator, action })
  }

  const confirmAction = async () => {
    const { educator, action } = actionDialog
    try {
      const reason=window.prompt('Reason for deactivating this educator');
      if(!reason)return;
      const response=await fetch('/api/educators/teaching',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'deactivate_staff',payload:{staffId:educator.id,reason}})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Deactivation failed');
        toast({
          title: 'Success',
          description: `Educator ${action}d successfully`
        })
        fetchEducators()
        fetchOverallStats()
      // } else {
      //   throw new Error(data.error)
      // }
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Action failed',
        variant: 'destructive'
      })
    } finally {
      setActionDialog({ open: false, educator: null, action: null })
    }
  }

  const handleAddSubject = () => {
    if (!currentSubject.subjectName) {
      toast({
        title: 'Validation Error',
        description: 'Please enter subject name',
        variant: 'destructive'
      })
      return
    }

    setEducatorForm(prev => ({
      ...prev,
      subjects: [...prev.subjects, { ...currentSubject }]
    }))

    setCurrentSubject({
      subjectName: '',
      level: 'Intermediate',
      yearsOfExperience: 0
    })
  }

  const handleRemoveSubject = (index) => {
    setEducatorForm(prev => ({
      ...prev,
      subjects: prev.subjects.filter((_, i) => i !== index)
    }))
  }

  const handleFileChange = (field, e) => {
    const file = e.target.files[0]
    if (file) {
      setEducatorForm(prev => ({ ...prev, [field]: file }))
    }
  }

  const handleAddEducator = async () => {
    console.log('=== EDUCATOR ONBOARDING STARTED ===')
    console.log('Step 1: Validating form data...')
    
    // Validate required fields
    if (!educatorForm.firstName || !educatorForm.lastName || !educatorForm.email || 
        !educatorForm.employeeId || !educatorForm.organizationId || !educatorForm.dateOfJoining) {
      console.error('❌ Validation failed: Missing required fields')
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields (Name, Email, Employee ID, Organization, Date of Joining)',
        variant: 'destructive'
      })
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(educatorForm.email)) {
      console.error('❌ Validation failed: Invalid email format')
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid email address',
        variant: 'destructive'
      })
      return
    }

    console.log('✅ Validation passed')
    console.log('Form data:', {
      firstName: educatorForm.firstName,
      lastName: educatorForm.lastName,
      email: educatorForm.email,
      employeeId: educatorForm.employeeId,
      organizationId: educatorForm.organizationId,
      department: educatorForm.department,
      hasDocuments: {
        degree: !!educatorForm.degreeCertificate,
        id: !!educatorForm.idProof,
        experience: !!educatorForm.experienceLetters
      }
    })

    try {
      setAddEducatorLoading(true)
      
      // Generate temporary educator ID for document uploads
      const tempEducatorId = `edu_${Date.now()}_${Math.random().toString(36).substring(7)}`
      console.log(`Step 2: Generated temp educator ID: ${tempEducatorId}`)
      
      // Step 3: Upload documents to R2
      console.log('Step 3: Uploading documents to R2...')
      const documentUrls = {
        degreeCertificateUrl: null,
        idProofUrl: null,
        experienceLettersUrl: null
      }

      // Upload degree certificate
      if (educatorForm.degreeCertificate) {
        console.log('  → Uploading degree certificate...')
        const formData = new FormData()
        formData.append('file', educatorForm.degreeCertificate)
        formData.append('educatorId', tempEducatorId)
        formData.append('documentType', 'degree-certificate')

        const degreeResponse = await fetch('/api/educators/upload-document', {
          method: 'POST',
          body: formData
        })

        const degreeData = await degreeResponse.json()
        
        if (!degreeData.success) {
          throw new Error(`Degree certificate upload failed: ${degreeData.error}`)
        }
        
        documentUrls.degreeCertificateUrl = degreeData.url
        console.log('  ✅ Degree certificate uploaded:', degreeData.url)
      }

      // Upload ID proof
      if (educatorForm.idProof) {
        console.log('  → Uploading ID proof...')
        const formData = new FormData()
        formData.append('file', educatorForm.idProof)
        formData.append('educatorId', tempEducatorId)
        formData.append('documentType', 'id-proof')

        const idResponse = await fetch('/api/educators/upload-document', {
          method: 'POST',
          body: formData
        })

        const idData = await idResponse.json()
        
        if (!idData.success) {
          throw new Error(`ID proof upload failed: ${idData.error}`)
        }
        
        documentUrls.idProofUrl = idData.url
        console.log('  ✅ ID proof uploaded:', idData.url)
      }

      // Upload experience letters
      if (educatorForm.experienceLetters) {
        console.log('  → Uploading experience letters...')
        const formData = new FormData()
        formData.append('file', educatorForm.experienceLetters)
        formData.append('educatorId', tempEducatorId)
        formData.append('documentType', 'experience-letters')

        const expResponse = await fetch('/api/educators/upload-document', {
          method: 'POST',
          body: formData
        })

        const expData = await expResponse.json()
        
        if (!expData.success) {
          throw new Error(`Experience letters upload failed: ${expData.error}`)
        }
        
        documentUrls.experienceLettersUrl = expData.url
        console.log('  ✅ Experience letters uploaded:', expData.url)
      }

      console.log('✅ All documents uploaded successfully')

      // Step 4: Prepare user_metadata for API (password generated by backend)
      const userMetadata = {
        firstName: educatorForm.firstName,
        lastName: educatorForm.lastName,
        employeeId: educatorForm.employeeId,
        phone: educatorForm.phone || null,
        platformRole: educatorForm.platformRole,
        qualification: educatorForm.qualification || null,
        experienceYears: parseInt(educatorForm.experienceYears) || 0,
        dateOfJoining: educatorForm.dateOfJoining,
        subjects: educatorForm.subjects,
        ...documentUrls
      }

      console.log('Step 5: Payload:', {
        email: educatorForm.email,
        org_id: educatorForm.organizationId === 'none' ? null : educatorForm.organizationId,
        user_metadata: userMetadata
      })

      // Step 6: Call API (password generated on backend)
      const ssoResponse = await fetch('/api/educators/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requestId: creationRequestId.current || (creationRequestId.current = crypto.randomUUID()),
          email: educatorForm.email,
          // NO password here - backend generates it!
          org_id: educatorForm.organizationId === 'none' ? null : educatorForm.organizationId,
          user_metadata: userMetadata
        })
      })

      if (!ssoResponse.ok) {
        const errorData = await ssoResponse.json()
        throw new Error(errorData.details || errorData.error || 'Failed to create educator')
      }

      const ssoData = await ssoResponse.json()
      const trainerId = ssoData.data?.authUserId
      if (!trainerId || !ssoData.data?.staffId) throw new Error('Staff profile is not ready. Retry creation.')
      setOnboardingResult(ssoData.data)

      toast({
        title: 'Success',
        description: ssoData.data.message,
        duration: 5000
      })
      
      // Store trainer ID and move to Step 2
      setCreatedTrainerId(trainerId)
      setCollegeAssignmentForm(prev => ({ ...prev, trainerId: trainerId }))
      setCurrentStep(2)
      
    } catch (error) {
      console.error('=== EDUCATOR ONBOARDING FAILED ===')
      console.error('Error:', error)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
      
      toast({
        title: 'Error',
        description: error.message || 'An error occurred while adding the educator',
        variant: 'destructive',
        duration: 7000
      })
    } finally {
      setAddEducatorLoading(false)
    }
  }

  const handleCollegeAssignment = async () => {
    console.log('=== COLLEGE ASSIGNMENT STARTED ===')
    console.log('Assignment data:', collegeAssignmentForm)
    
    // Validate required fields
    if (!collegeAssignmentForm.collegeId || !collegeAssignmentForm.departmentId || 
        !collegeAssignmentForm.programId || !collegeAssignmentForm.sectionId || collegeAssignmentForm.assignedCourses.length === 0 || !collegeAssignmentForm.startDate) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in College, Department, Program, Section, Courses, and Start Date',
        variant: 'destructive'
      })
      return
    }

    try {
      setAddEducatorLoading(true)
      
      // Call API to create assignment
      const response = await fetch('/api/educators/assign-college', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collegeAssignmentForm)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to assign trainer to college')
      }

      console.log('=== COLLEGE ASSIGNMENT COMPLETED ===')
      
      toast({
        title: 'Success',
        description: 'Trainer assigned to college successfully!',
        duration: 5000
      })
      
      // Close dialog and refresh
      resetForm()
      setAddEducatorDialog(false)
      fetchEducators()
      fetchOverallStats()
      
    } catch (error) {
      console.error('=== COLLEGE ASSIGNMENT FAILED ===')
      console.error('Error:', error)
      
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign trainer to college',
        variant: 'destructive',
        duration: 7000
      })
    } finally {
      setAddEducatorLoading(false)
    }
  }

  const resetForm = () => {
    setOnboardingResult(null)
    setCreatedTrainerId(null)
    setCurrentStep(1)
    creationRequestId.current = null
    setEducatorForm({
      firstName: '',
      lastName: '',
      email: '',
      employeeId: '',
      phone: '',
      organizationId: '',
      platformRole: 'Trainer',
      qualification: '',
      experienceYears: 0,
      dateOfJoining: '',
      degreeCertificate: null,
      idProof: null,
      experienceLetters: null,
      subjects: []
    })
    setCurrentSubject({
      subjectName: '',
      level: 'Intermediate',
      yearsOfExperience: 0
    })
    setCurrentStep(1)
    setCreatedTrainerId(null)
  }

  const handleSearchChange = (e) => {
    const value = e.target.value
    setFilters(prev => ({ ...prev, search: value }))
    
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
    }
    
    searchDebounceRef.current = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }))
    }, 300)
  }

  return (
    <div className="space-y-6">

      {managedEducator&&<EducatorTeachingManager educator={managedEducator} onClose={()=>setManagedEducator(null)} onSaved={fetchEducators}/>}
      {assignmentsEducator&&<EducatorAssignmentsModal educator={assignmentsEducator} onClose={()=>setAssignmentsEducator(null)}/>}
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="neu-card bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Educators</p>
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
        <Card className="neu-card bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950/30 dark:to-gray-900/20 border-gray-200 dark:border-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Inactive</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{overallStats.inactive}</p>
              </div>
              <div className="p-3 bg-gray-200 dark:bg-gray-900/40 rounded-xl">
                <UserX className="h-7 w-7 text-gray-600 dark:text-gray-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="neu-card bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Professors</p>
                <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">{overallStats.professors}</p>
              </div>
              <div className="p-3 bg-purple-200 dark:bg-purple-900/40 rounded-xl">
                <GraduationCap className="h-7 w-7 text-purple-600 dark:text-purple-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="neu-card bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/30 dark:to-indigo-900/20 border-indigo-200 dark:border-indigo-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Lecturers</p>
                <p className="text-3xl font-bold text-indigo-900 dark:text-indigo-100">{overallStats.lecturers}</p>
              </div>
              <div className="p-3 bg-indigo-200 dark:bg-indigo-900/40 rounded-xl">
                <BookOpen className="h-7 w-7 text-indigo-600 dark:text-indigo-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="neu-card">
        <CardHeader>
          <div className="space-y-4">
            {/* Title and Add Educator Button */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Educator Management</h2>
                <p className="text-sm text-muted-foreground mt-1">Add new faculty members with documents and subject expertise</p>
              </div>
              <Button
                onClick={() => setAddEducatorDialog(true)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Educator
              </Button>
            </div>

            {/* Search and Filters Row */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or employee ID..."
                  value={filters.search}
                  onChange={handleSearchChange}
                  className="pl-10"
                />
              </div>
              
              <Select
                value={filters.department}
                onValueChange={(value) => {
                  setFilters(prev => ({ ...prev, department: value }))
                  setPagination(prev => ({ ...prev, page: 1 }))
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  <SelectItem value="Computer Science">Computer Science</SelectItem>
                  <SelectItem value="Mathematics">Mathematics</SelectItem>
                  <SelectItem value="Physics">Physics</SelectItem>
                  <SelectItem value="Chemistry">Chemistry</SelectItem>
                </SelectContent>
              </Select>
              
              <Select
                value={filters.facultyRole}
                onValueChange={(value) => {
                  setFilters(prev => ({ ...prev, facultyRole: value }))
                  setPagination(prev => ({ ...prev, page: 1 }))
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Faculty Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="Professor">Professor</SelectItem>
                  <SelectItem value="Associate Professor">Associate Professor</SelectItem>
                  <SelectItem value="Assistant Professor">Assistant Professor</SelectItem>
                  <SelectItem value="Lecturer">Lecturer</SelectItem>
                </SelectContent>
              </Select>
              
              <Select
                value={filters.status}
                onValueChange={(value) => {
                  setFilters(prev => ({ ...prev, status: value }))
                  setPagination(prev => ({ ...prev, page: 1 }))
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Results count */}
            <div className="text-sm text-muted-foreground">
              {!loading && `Showing ${educators.length} of ${pagination.total} educators`}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableLoader rows={5} />
          ) : (
            <div className="space-y-4">
              {educators.length > 0 ? (
                educators.map((educator, index) => (
                  <div key={educator.id || `educator-${index}`} className="group p-5 bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 hover:to-gray-50 dark:from-gray-800/50 dark:to-gray-900/50 dark:hover:from-gray-800 dark:hover:to-gray-800/80 rounded-xl transition-all duration-200 border border-gray-200 dark:border-gray-700 hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-blue-500 to-indigo-500">
                          <GraduationCap className="h-7 w-7 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <p className="font-semibold text-lg dark:text-white">{educator.firstName} {educator.lastName}</p>
                            <Badge variant={educator.status === 'active' ? 'default' : 'secondary'} className="font-medium">
                              {educator.status === 'active' ? '● Active' : '○ Inactive'}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm mb-2">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3.5 w-3.5" />
                              {educator.email}
                            </span>
                            {educator.phone && (
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3.5 w-3.5" />
                                {educator.phone}
                              </span>
                            )}
                            <Badge className="bg-blue-100 text-blue-700 border border-blue-200">
                              {educator.facultyRole}
                            </Badge>
                            <Badge className="bg-purple-100 text-purple-700 border border-purple-200">
                              {educator.department}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium">Employee ID:</span> {educator.employeeId} | 
                            <span className="font-medium ml-2">Experience:</span> {educator.experienceYears} years
                          </div>
                          
                          {/* Assignment Details */}
                          {educator.assignments && educator.assignments.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">College Assignments:</p>
                              {educator.assignments.length === 1 ? (
                                <div className="mb-2 last:mb-0">
                                  <div className="flex flex-wrap gap-2 items-center text-xs">
                                    {educator.assignments[0].collegeName && (
                                      <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200">
                                        <Building2 className="h-3 w-3 mr-1" />
                                        {educator.assignments[0].collegeName}
                                      </Badge>
                                    )}
                                    {educator.assignments[0].departmentName && (
                                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                        <BookOpen className="h-3 w-3 mr-1" />
                                        {educator.assignments[0].departmentName}
                                      </Badge>
                                    )}
                                    {(educator.assignments[0].programLabel || educator.assignments[0].programName) && (
                                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                        <GraduationCap className="h-3 w-3 mr-1" />
                                        {educator.assignments[0].programLabel || educator.assignments[0].programName}
                                      </Badge>
                                    )}
                                    {educator.assignments[0].sectionName && (
                                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                        Section {educator.assignments[0].sectionName} - Sem {educator.assignments[0].semester}
                                      </Badge>
                                    )}
                                    {educator.assignments[0].assignedCourses && educator.assignments[0].assignedCourses.length > 0 && (
                                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                        {educator.assignments[0].assignedCourses.length} Course(s)
                                      </Badge>
                                    )}
                                    <Button variant="outline" size="sm" onClick={() => setAssignmentsEducator(educator)}>
                                      Details
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-2 items-center text-xs">
                                  {educator.assignments[0].collegeName && (
                                    <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200">
                                      <Building2 className="h-3 w-3 mr-1" />
                                      {educator.assignments[0].collegeName}
                                    </Badge>
                                  )}
                                  {educator.assignments[0].departmentName && (
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                      <BookOpen className="h-3 w-3 mr-1" />
                                      {educator.assignments[0].departmentName}
                                    </Badge>
                                  )}
                                  {(educator.assignments[0].programLabel || educator.assignments[0].programName) && (
                                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                      <GraduationCap className="h-3 w-3 mr-1" />
                                      {educator.assignments[0].programLabel || educator.assignments[0].programName}
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                    {educator.assignments.reduce((n, a) => n + (a.assignedCourses?.length || 0), 0)} Course(s) total
                                  </Badge>
                                  <Button variant="outline" size="sm" onClick={() => setAssignmentsEducator(educator)}>
                                    View all {educator.assignments.length}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button variant="outline" size="sm" onClick={()=>setManagedEducator(educator)}>Manage teaching</Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAction(educator, 'deactivate')}
                          aria-label={`Deactivate ${educator.firstName}`}
                          className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                    <GraduationCap className="h-8 w-8 text-muted-foreground opacity-50" />
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">No educators found</p>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                    {filters.search || filters.department !== 'all' || filters.facultyRole !== 'all' 
                      ? 'Try adjusting your filters to see more results'
                      : 'Get started by adding your first educator using the "Add Educator" button above.'}
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

      {/* Action Confirmation Dialog */}
      <AlertDialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ ...actionDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.action === 'delete' ? 'Delete Educator' : `${actionDialog.action} Educator`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {actionDialog.action} {actionDialog.educator?.firstName} {actionDialog.educator?.lastName}?
              {actionDialog.action === 'delete' && ' This action cannot be undone.'}
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

      {/* Add Educator Dialog */}
      <Dialog open={addEducatorDialog} onOpenChange={(open) => {
        if (addEducatorLoading) return
        if (!open) resetForm()
        setAddEducatorDialog(open)
      }}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {currentStep === 1 ? 'Step 1: Create Trainer' : 'Step 2: Assign to College'}
            </DialogTitle>
            <DialogDescription>
              {currentStep === 1 
                ? 'Add trainer information with documents and subject expertise'
                : 'Assign the trainer to a college with department, program, and courses'}
            </DialogDescription>
            
            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-2 pt-4">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${currentStep === 1 ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'}`}>
                {currentStep === 1 ? '1' : '✓'}
              </div>
              <div className="w-16 h-1 bg-gray-300 dark:bg-gray-700"></div>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${currentStep === 2 ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-600'}`}>
                2
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {currentStep === 1 ? (
              // STEP 1: Trainer Information Form (existing code stays here)
              <>
            {/* Personal Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Personal Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">
                    First Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    value={educatorForm.firstName}
                    onChange={(e) => setEducatorForm(prev => ({ ...prev, firstName: e.target.value }))}
                    placeholder="Enter first name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">
                    Last Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    value={educatorForm.lastName}
                    onChange={(e) => setEducatorForm(prev => ({ ...prev, lastName: e.target.value }))}
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={educatorForm.email}
                    onChange={(e) => setEducatorForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter email address"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="employeeId">
                    Employee ID <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="employeeId"
                    value={educatorForm.employeeId}
                    onChange={(e) => setEducatorForm(prev => ({ ...prev, employeeId: e.target.value }))}
                    placeholder="e.g., FAC001, EMP123"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={educatorForm.phone}
                    onChange={(e) => setEducatorForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Enter phone number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="organizationId">
                    Organization <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={educatorForm.organizationId}
                    onValueChange={(value) => setEducatorForm(prev => ({ ...prev, organizationId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Organization" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Platform-wide)</SelectItem>
                      {organizations.map(org => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="platformRole">
                    Platform Role <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={educatorForm.platformRole}
                    onValueChange={(value) => setEducatorForm(prev => ({ ...prev, platformRole: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Trainer">Trainer</SelectItem>
                      <SelectItem value="Educator">Educator</SelectItem>
                      <SelectItem value="Platform Staff">Platform Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="qualification">Qualification</Label>
                  <Input
                    id="qualification"
                    value={educatorForm.qualification}
                    onChange={(e) => setEducatorForm(prev => ({ ...prev, qualification: e.target.value }))}
                    placeholder="e.g., Ph.D. in Computer Science"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="experienceYears">Experience (Years)</Label>
                  <Input
                    id="experienceYears"
                    type="number"
                    min="0"
                    value={educatorForm.experienceYears}
                    onChange={(e) => setEducatorForm(prev => ({ ...prev, experienceYears: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateOfJoining">
                    Date of Joining <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="dateOfJoining"
                    type="date"
                    value={educatorForm.dateOfJoining}
                    onChange={(e) => setEducatorForm(prev => ({ ...prev, dateOfJoining: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Documents Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Documents</h3>
              
              <div className="space-y-2">
                <Label htmlFor="degreeCertificate">
                  Degree Certificate <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => degreeCertificateRef.current?.click()}
                    className="w-full justify-start"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {educatorForm.degreeCertificate ? educatorForm.degreeCertificate.name : 'Upload degree certificate'}
                  </Button>
                  <input
                    ref={degreeCertificateRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileChange('degreeCertificate', e)}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="idProof">
                  ID Proof <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => idProofRef.current?.click()}
                    className="w-full justify-start"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {educatorForm.idProof ? educatorForm.idProof.name : 'Upload ID proof'}
                  </Button>
                  <input
                    ref={idProofRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileChange('idProof', e)}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="experienceLetters">
                  Experience Letters <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => experienceLettersRef.current?.click()}
                    className="w-full justify-start"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {educatorForm.experienceLetters ? educatorForm.experienceLetters.name : 'Upload experience letters'}
                  </Button>
                  <input
                    ref={experienceLettersRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileChange('experienceLetters', e)}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            {/* Subject Expertise Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Subject Expertise <span className="text-red-500">*</span>
              </h3>
              
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-5">
                  <Input
                    placeholder="Subject name"
                    value={currentSubject.subjectName}
                    onChange={(e) => setCurrentSubject(prev => ({ ...prev, subjectName: e.target.value }))}
                  />
                </div>
                <div className="col-span-4">
                  <Select
                    value={currentSubject.level}
                    onValueChange={(value) => setCurrentSubject(prev => ({ ...prev, level: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Beginner">Beginner</SelectItem>
                      <SelectItem value="Intermediate">Intermediate</SelectItem>
                      <SelectItem value="Advanced">Advanced</SelectItem>
                      <SelectItem value="Expert">Expert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={currentSubject.yearsOfExperience}
                    onChange={(e) => setCurrentSubject(prev => ({ ...prev, yearsOfExperience: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="col-span-1 flex items-center">
                  <Button
                    type="button"
                    onClick={handleAddSubject}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white w-full"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Subject List */}
              {educatorForm.subjects.length > 0 && (
                <div className="space-y-2">
                  {educatorForm.subjects.map((subject, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{subject.subjectName}</p>
                        <p className="text-sm text-muted-foreground">
                          {subject.level} • {subject.yearsOfExperience} years
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSubject(index)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
              </>
            ) : (
              // STEP 2: College Assignment Form
              <>
              {onboardingResult && (
                <div className="mb-4 space-y-2 rounded-lg border p-4" role="status">
                  <h3 className="font-semibold">Educator login details</h3>
                  <p className="text-sm">Email: {onboardingResult.email}</p>
                  <p className="break-all text-sm">SkillPassport: {onboardingResult.loginUrl}</p>
                  <p className="text-sm">Invitation: {onboardingResult.emailStatus === 'queued'
                    ? 'Credentials email queued; inbox delivery is not yet confirmed.'
                    : onboardingResult.emailStatus === 'reset_requested'
                      ? 'Password reset requested. The original temporary password cannot be recovered.'
                      : 'Email was not queued. Share the one-time login details or use password recovery.'}</p>
                  {onboardingResult.temporaryPassword && (
                    <div>
                      <Label htmlFor="educator-temporary-password">One-time temporary password</Label>
                      <Input id="educator-temporary-password" type="password" readOnly
                        value={onboardingResult.temporaryPassword} autoComplete="off" />
                      <Button type="button" variant="outline" className="mt-2" onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(onboardingResult.temporaryPassword)
                          toast({ title: 'Temporary password copied' })
                        } catch { toast({ title: 'Copy unavailable', description: 'Use the credentials email or password recovery.', variant: 'destructive' }) }
                      }}>Copy temporary password</Button>
                      <p className="mt-1 text-sm">This password is cleared when this dialog closes.</p>
                    </div>
                  )}
                  <p className="text-sm">{onboardingResult.teachingAccessStatus==='granted'
                    ? 'Assigned teaching access granted. Complete course/class mapping below.'
                    : 'Teaching access needs administrator provisioning.'}</p>
                </div>
              )}
              <CollegeAssignmentForm
                form={collegeAssignmentForm}
                setForm={setCollegeAssignmentForm}
                trainerId={createdTrainerId}
                onSubmit={handleCollegeAssignment}
                isLoading={addEducatorLoading}
              />
              </>
            )}
          </div>

          <DialogFooter>
            {currentStep === 1 ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    resetForm()
                    setAddEducatorDialog(false)
                  }}
                  disabled={addEducatorLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddEducator}
                  disabled={addEducatorLoading}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                >
                  {addEducatorLoading ? 'Creating Trainer...' : 'Next: Assign to College →'}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  disabled={addEducatorLoading || Boolean(createdTrainerId)}
                >
                  ← Back
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    // Skip college assignment - just create trainer
                    resetForm()
                    setAddEducatorDialog(false)
                    toast({
                      title: 'Trainer Created',
                      description: 'You can assign them to colleges later from the list.'
                    })
                  }}
                  disabled={addEducatorLoading}
                >
                  Skip for Now
                </Button>
                <Button
                  onClick={handleCollegeAssignment}
                  disabled={addEducatorLoading}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                >
                  {addEducatorLoading ? 'Assigning...' : 'Assign to College'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
