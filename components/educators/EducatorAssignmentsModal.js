'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertCircle,
  BookOpen,
  Building2,
  CalendarDays,
  Clock,
  ClipboardList,
  GraduationCap,
  MessageSquare,
  Award,
  ChevronDown,
  ChevronUp,
  Filter,
  X,
} from 'lucide-react'
import { formatSlotLabel } from '@/components/educators/CollegeAssignmentForm'
import { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

const STATUS_STYLES = {
  active: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800',
  upcoming: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  ended: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
}

const TASK_STATUS_STYLES = {
  graded: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  submitted: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  'in-progress': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  todo: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
}

function formatDate(value) {
  if (!value) return '—'
  const d = value.includes('T') ? new Date(value) : new Date(value + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function AssignmentCard({ assignment }) {
  const taughtCount = new Set((assignment.history || []).map(s => s.courseId).filter(Boolean)).size
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3 bg-white dark:bg-gray-900/40 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-gray-900 dark:text-gray-100">
          {assignment.programLabel || 'Unassigned program'}
        </p>
        <Badge variant="outline" className={STATUS_STYLES[assignment.status] || STATUS_STYLES.active}>
          {assignment.status === 'active' ? '● Active' : assignment.status === 'upcoming' ? '○ Upcoming' : '○ Ended'}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2 items-center text-xs">
        {assignment.collegeName && (
          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300">
            <Building2 className="h-3 w-3 mr-1" />
            {assignment.collegeName}
          </Badge>
        )}
        {assignment.departmentName && (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300">
            <BookOpen className="h-3 w-3 mr-1" />
            {assignment.departmentName}
          </Badge>
        )}
        {assignment.sectionName && (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300">
            Section {assignment.sectionName}{assignment.semester ? ` - Sem ${assignment.semester}` : ''}
          </Badge>
        )}
      </div>

      {assignment.allocatedCourses?.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
            Allocated courses ({assignment.allocatedCourses.length})
            {taughtCount > 0 && (
              <span className="font-normal"> · {taughtCount} taken up by college</span>
            )}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {assignment.allocatedCourses.map(course => {
              const taken = (assignment.history || []).filter(s => s.courseId === course.id).length
              return (
                <Badge
                  key={course.id}
                  variant="outline"
                  title={taken > 0 ? `${taken} session${taken === 1 ? '' : 's'} held` : 'No sessions held yet'}
                  className={taken > 0
                    ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300'
                    : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400'}
                >
                  <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${taken > 0 ? 'bg-orange-500' : 'bg-gray-300'}`} />
                  {course.title || course.code || course.id}
                  {taken > 0 && <span className="ml-1 font-semibold">· {taken}</span>}
                </Badge>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" />
          Start: {formatDate(assignment.startDate)}
        </span>
        <span>End: {formatDate(assignment.endDate)}</span>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
          Time slots {assignment.timeSlots?.length > 0 ? `(${(assignment.timeSlots || []).length})` : ''}
        </p>
        {(assignment.timeSlots || []).length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {(assignment.timeSlots || []).map((slot, i) => (
              <Badge key={i} variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300">
                <Clock className="h-3 w-3 mr-1" />
                {formatSlotLabel(slot)}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Available for any session in the date range.</p>
        )}
      </div>

      <div className="pt-1">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
          Attendance history {assignment.historyTotal > 0 && `(${assignment.historyTotal} session${assignment.historyTotal === 1 ? '' : 's'})`}
        </p>
        {assignment.history?.length > 0 ? (
          <ul className="space-y-1.5">
            {assignment.history.map(session => (
              <li
                key={session.id}
                className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-xs"
              >
                <span className="font-medium whitespace-nowrap">{formatDate(session.date)}</span>
                <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{session.subject}</span>
                <Badge
                  variant="outline"
                  className={session.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300' : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400'}
                >
                  {session.status}
                </Badge>
                <span className="text-muted-foreground whitespace-nowrap">
                  {session.present}/{session.total} · {Math.round(session.percentage || 0)}%
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No sessions held yet.</p>
        )}
      </div>
    </div>
  )
}

function TaskCard({ task }) {
  const [showLearners, setShowLearners] = useState(true)
  const learners = task.learners || []
  const stats = task.stats || {
    totalAssigned: learners.length,
    submittedCount: 0,
    gradedCount: 0,
    pendingCount: 0,
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4 bg-white dark:bg-gray-900/40 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-base">
              {task.title || 'Untitled Task'}
            </h4>
          </div>
          {task.courseName && (
            <p className="text-xs font-medium text-purple-700 dark:text-purple-300">
              {task.courseName} {task.courseCode ? `(${task.courseCode})` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {task.assignmentType && (
            <Badge variant="outline" className="capitalize bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 text-xs">
              {task.assignmentType}
            </Badge>
          )}
          {task.totalPoints !== null && task.totalPoints !== undefined && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 text-xs">
              <Award className="h-3 w-3 mr-1" />
              {task.totalPoints} pts
            </Badge>
          )}
        </div>
      </div>

      {/* Badges for College, Program, Section, Due date */}
      <div className="flex flex-wrap gap-2 items-center text-xs">
        {task.collegeName && (
          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300">
            <Building2 className="h-3 w-3 mr-1" />
            {task.collegeName}
          </Badge>
        )}
        {task.departmentName && (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300">
            <BookOpen className="h-3 w-3 mr-1" />
            {task.departmentName}
          </Badge>
        )}
        {task.sectionName && (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300">
            Section {task.sectionName}{task.semester ? ` - Sem ${task.semester}` : ''}
          </Badge>
        )}
        {task.dueDate && (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300">
            <CalendarDays className="h-3 w-3 mr-1" />
            Due: {formatDate(task.dueDate)}
          </Badge>
        )}
      </div>

      {/* Description / Instructions if present */}
      {(task.description || task.instructions) && (
        <div className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/40 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
          {task.description && <p>{task.description}</p>}
          {task.instructions && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              <span className="font-semibold">Instructions:</span> {task.instructions}
            </p>
          )}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
          <p className="text-[11px] text-muted-foreground font-medium">Assigned</p>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{stats.totalAssigned}</p>
        </div>
        <div className="p-2 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
          <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">Submitted</p>
          <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{stats.submittedCount}</p>
        </div>
        <div className="p-2 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
          <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">Graded</p>
          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{stats.gradedCount}</p>
        </div>
        <div className="p-2 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
          <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">Pending Review</p>
          <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{stats.pendingCount}</p>
        </div>
      </div>

      {/* Learner Evaluations Section */}
      <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-between h-8 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 px-1"
          onClick={() => setShowLearners(prev => !prev)}
        >
          <span className="flex items-center gap-1.5">
            <GraduationCap className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
            <span>Learner Submissions & Feedback ({learners.length})</span>
          </span>
          {showLearners ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>

        {showLearners && (
          <div className="mt-3 space-y-2.5">
            {learners.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">No learners assigned to this task yet.</p>
            ) : (
              learners.map(learner => {
                const isGraded = learner.status === 'graded' || (learner.gradePercentage !== null && learner.gradePercentage !== undefined)
                return (
                  <div
                    key={learner.id}
                    className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/50 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-xs text-gray-900 dark:text-gray-100">
                          {learner.learnerName}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {learner.learnerEmail || (learner.rollNumber ? `Roll: ${learner.rollNumber}` : '—')}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={TASK_STATUS_STYLES[learner.status] || TASK_STATUS_STYLES.todo}
                        >
                          {learner.status === 'graded'
                            ? 'Graded'
                            : learner.status === 'submitted'
                            ? 'Submitted'
                            : learner.status === 'in-progress'
                            ? 'In Progress'
                            : 'Pending'}
                        </Badge>
                        {isGraded && (
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            {learner.gradeReceived !== null && learner.gradeReceived !== undefined
                              ? `${learner.gradeReceived} / ${task.totalPoints || 100} (${Math.round(learner.gradePercentage || 0)}%)`
                              : `${Math.round(learner.gradePercentage || 0)}%`}
                          </span>
                        )}
                      </div>
                    </div>

                    {learner.instructorFeedback ? (
                      <div className="p-2.5 rounded-md bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 text-xs">
                        <div className="flex items-center gap-1 font-semibold text-purple-700 dark:text-purple-300 text-[11px] mb-1">
                          <MessageSquare className="h-3 w-3" />
                          <span>Trainer Feedback:</span>
                          {learner.feedbackDate && (
                            <span className="text-[10px] font-normal text-muted-foreground ml-auto">
                              {formatDate(learner.feedbackDate)}
                            </span>
                          )}
                        </div>
                        <p className="text-purple-900 dark:text-purple-200 text-xs italic">
                          &ldquo;{learner.instructorFeedback}&rdquo;
                        </p>
                      </div>
                    ) : isGraded ? (
                      <p className="text-[11px] text-muted-foreground italic">No written feedback provided.</p>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function EducatorAssignmentsModal({ educator, onClose }) {
  const [assignments, setAssignments] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('teaching')
  const [filterOptions, setFilterOptions] = useState({ 
    colleges: [], 
    departments: [], 
    courses: [],
    attendanceHistoryOptions: [],
    taskNames: [],
    taskColleges: [],
    taskDepartments: [],
    taskTypes: [],
    taskCourses: [],
    taskStatuses: [],
  })
  
  // Filter states for Teaching & Attendance tab
  const [filters, setFilters] = useState({
    status: 'all',
    collegeId: '',
    departmentId: '',
    startDateFrom: '',
    startDateTo: '',
    courseId: '',
    sessionStatus: ''
  })
  
  // Filter states for Tasks & Evaluations tab
  const [taskFilters, setTaskFilters] = useState({
    taskId: '',
    taskType: '',
    taskCollegeId: '',
    taskDepartmentId: '',
    taskCourseId: '',
    taskStatus: 'all',
  })
  
  const [showFilters, setShowFilters] = useState(false)
  const [showTaskFilters, setShowTaskFilters] = useState(false)

  const fetchAssignments = async () => {
    if (!educator) return
    setLoading(true)
    setError('')
    
    try {
      // Build query params
      const params = new URLSearchParams()
      
      // Teaching & Attendance filters
      if (filters.status && filters.status !== 'all') params.append('status', filters.status)
      if (filters.collegeId) params.append('collegeId', filters.collegeId)
      if (filters.departmentId) params.append('departmentId', filters.departmentId)
      if (filters.startDateFrom) params.append('startDateFrom', filters.startDateFrom)
      if (filters.startDateTo) params.append('startDateTo', filters.startDateTo)
      if (filters.courseId) params.append('courseId', filters.courseId)
      if (filters.sessionStatus) params.append('sessionStatus', filters.sessionStatus)
      
      // Tasks & Evaluations filters
      if (taskFilters.taskId) params.append('taskId', taskFilters.taskId)
      if (taskFilters.taskType) params.append('taskType', taskFilters.taskType)
      if (taskFilters.taskCollegeId) params.append('taskCollegeId', taskFilters.taskCollegeId)
      if (taskFilters.taskDepartmentId) params.append('taskDepartmentId', taskFilters.taskDepartmentId)
      if (taskFilters.taskCourseId) params.append('taskCourseId', taskFilters.taskCourseId)
      if (taskFilters.taskStatus && taskFilters.taskStatus !== 'all') params.append('taskStatus', taskFilters.taskStatus)
      
      const queryString = params.toString()
      const url = `/api/educators/${educator.id}/assignments${queryString ? `?${queryString}` : ''}`
      
      const response = await fetch(url, { cache: 'no-store' })
      const body = await response.json()
      
      if (!response.ok) throw new Error(body.error || 'Failed to load assignments')
      
      setAssignments(body.data?.assignments || [])
      setTasks(body.data?.tasks || [])
      setFilterOptions(body.data?.filterOptions || { 
        colleges: [], 
        departments: [], 
        courses: [], 
        attendanceHistoryOptions: [],
        taskColleges: [], 
        taskDepartments: [], 
        taskTypes: [], 
        taskCourses: [], 
        taskStatuses: [], 
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAssignments()
  }, [educator, filters, taskFilters])
  
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }
  
  const clearFilters = () => {
    setFilters({
      status: 'all',
      collegeId: '',
      departmentId: '',
      startDateFrom: '',
      startDateTo: '',
      courseId: '',
      sessionStatus: ''
    })
  }
  
  const handleTaskFilterChange = (key, value) => {
    setTaskFilters(prev => ({ ...prev, [key]: value }))
  }
  const clearTaskFilters = () => {
    setTaskFilters({
      taskId: '',
      taskType: '',
      taskCollegeId: '',
      taskDepartmentId: '',
      taskCourseId: '',
      taskStatus: 'all',
    })
  }
  
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'status') return value !== 'all'
    return value !== '' && value !== null && value !== undefined
  }).length
  
  const activeTaskFilterCount = Object.entries(taskFilters).filter(([key, value]) => {
    if (key === 'taskStatus') return value !== 'all'
    return value !== '' && value !== null && value !== undefined
  }).length

  return (
    <Sheet open={!!educator} onOpenChange={open => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl md:max-w-3xl overflow-y-auto p-6 flex flex-col gap-5"
      >
        <SheetHeader className="text-left space-y-1.5 pr-6">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {educator?.firstName} {educator?.lastName}
            </SheetTitle>
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 text-xs font-medium">
              External Educator
            </Badge>
          </div>
          <SheetDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
            <span>{educator?.email}</span>
            {educator?.employeeId && (
              <>
                <span>•</span>
                <span className="font-mono">{educator.employeeId}</span>
              </>
            )}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="space-y-4 py-2">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-36 w-full rounded-xl" />
            <Skeleton className="h-36 w-full rounded-xl" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Couldn&apos;t load details</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
            <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <TabsTrigger value="teaching" className="flex items-center gap-2 text-xs sm:text-sm font-medium">
                <BookOpen className="h-4 w-4" />
                <span>Teaching & Attendance</span>
                <Badge variant="secondary" className="ml-1 text-[11px] px-1.5 py-0 h-4 min-w-4 flex items-center justify-center">
                  {assignments.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex items-center gap-2 text-xs sm:text-sm font-medium">
                <ClipboardList className="h-4 w-4" />
                <span>Tasks & Evaluations</span>
                <Badge variant="secondary" className="ml-1 text-[11px] px-1.5 py-0 h-4 min-w-4 flex items-center justify-center">
                  {tasks.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="teaching" className="space-y-4 mt-2">
              {/* Filter Section */}
              <div className="space-y-3 border-b border-gray-200 dark:border-gray-800 pb-4">
                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className="gap-2"
                  >
                    <Filter className="h-4 w-4" />
                    <span>Filters</span>
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
                        {activeFilterCount}
                      </Badge>
                    )}
                    {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                  
                  {activeFilterCount > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                      Clear filters
                    </Button>
                  )}
                </div>
                
                {showFilters && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800">
                    {/* Status Filter */}
                    <div className="space-y-1.5">
                      <Label htmlFor="filter-status" className="text-xs font-medium">Status</Label>
                      <Select value={filters.status} onValueChange={(v) => handleFilterChange('status', v)}>
                        <SelectTrigger id="filter-status" className="h-9 text-xs">
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="upcoming">Upcoming</SelectItem>
                          <SelectItem value="ended">Ended</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* College Filter */}
                    <div className="space-y-1.5">
                      <Label htmlFor="filter-college" className="text-xs font-medium">College</Label>
                      <Select value={filters.collegeId} onValueChange={(v) => handleFilterChange('collegeId', v)}>
                        <SelectTrigger id="filter-college" className="h-9 text-xs">
                          <SelectValue placeholder="All colleges" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All colleges</SelectItem>
                          {filterOptions.colleges.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Department Filter */}
                    <div className="space-y-1.5">
                      <Label htmlFor="filter-department" className="text-xs font-medium">Department</Label>
                      <Select value={filters.departmentId} onValueChange={(v) => handleFilterChange('departmentId', v)}>
                        <SelectTrigger id="filter-department" className="h-9 text-xs">
                          <SelectValue placeholder="All departments" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All departments</SelectItem>
                          {filterOptions.departments.map(d => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name} {d.code ? `(${d.code})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Start Date From */}
                    <div className="space-y-1.5">
                      <Label htmlFor="filter-start-from" className="text-xs font-medium">Start Date From</Label>
                      <Input
                        id="filter-start-from"
                        type="date"
                        value={filters.startDateFrom}
                        onChange={(e) => handleFilterChange('startDateFrom', e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    
                    {/* Start Date To */}
                    <div className="space-y-1.5">
                      <Label htmlFor="filter-start-to" className="text-xs font-medium">Start Date To</Label>
                      <Input
                        id="filter-start-to"
                        type="date"
                        value={filters.startDateTo}
                        onChange={(e) => handleFilterChange('startDateTo', e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    
                    {/* Course Filter */}
                    <div className="space-y-1.5">
                      <Label htmlFor="filter-course" className="text-xs font-medium">Course</Label>
                      <Select value={filters.courseId} onValueChange={(v) => handleFilterChange('courseId', v)}>
                        <SelectTrigger id="filter-course" className="h-9 text-xs">
                          <SelectValue placeholder="All courses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All courses</SelectItem>
                          {filterOptions.courses.map(c => (
                            <SelectItem key={c.course_id} value={c.course_id}>
                              {c.title || c.code || c.course_id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Attendance Session Status Filter */}
                    <div className="space-y-1.5">
                      <Label htmlFor="filter-session-status" className="text-xs font-medium">Attendance Session Status</Label>
                      <Select value={filters.sessionStatus} onValueChange={(v) => handleFilterChange('sessionStatus', v)}>
                        <SelectTrigger id="filter-session-status" className="h-9 text-xs">
                          <SelectValue placeholder="All sessions" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All sessions</SelectItem>
                          {filterOptions.attendanceHistoryOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Results */}
              {assignments.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-gray-200 dark:border-gray-800 space-y-2">
                  <BookOpen className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {activeFilterCount > 0 ? 'No assignments match the filters' : 'No teaching allocations found'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeFilterCount > 0 
                      ? 'Try adjusting your filters to see more results.' 
                      : 'This educator has not been allocated to any colleges or batches yet.'}
                  </p>
                  {activeFilterCount > 0 && (
                    <Button variant="outline" size="sm" onClick={clearFilters} className="mt-2">
                      Clear all filters
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="text-xs text-muted-foreground px-1">
                    Showing {assignments.length} assignment{assignments.length === 1 ? '' : 's'}
                  </div>
                  {assignments.map(a => <AssignmentCard key={a.id} assignment={a} />)}
                </>
              )}
            </TabsContent>

            <TabsContent value="tasks" className="space-y-4 mt-2">
              {/* Task Filter Section */}
              <div className="space-y-3 border-b border-gray-200 dark:border-gray-800 pb-4">
                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTaskFilters(!showTaskFilters)}
                    className="gap-2"
                  >
                    <Filter className="h-4 w-4" />
                    <span>Filters</span>
                    {activeTaskFilterCount > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
                        {activeTaskFilterCount}
                      </Badge>
                    )}
                    {showTaskFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                  
                  {activeTaskFilterCount > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearTaskFilters}
                      className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                      Clear filters
                    </Button>
                  )}
                </div>
                
                {showTaskFilters && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800">
                    {/* Task Name Filter */}
                    <div className="space-y-1.5">
                      <Label htmlFor="task-name" className="text-xs font-medium">Task Name</Label>
                      <Select value={taskFilters.taskId} onValueChange={(v) => handleTaskFilterChange('taskId', v)}>
                        <SelectTrigger id="task-name" className="h-9 text-xs">
                          <SelectValue placeholder="All tasks" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All tasks</SelectItem>
                          {filterOptions.taskNames.map(task => (
                            <SelectItem key={task.id} value={task.id}>
                              {task.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Assignment Type Filter */}
                    <div className="space-y-1.5">
                      <Label htmlFor="task-type" className="text-xs font-medium">Assignment Type</Label>
                      <Select value={taskFilters.taskType} onValueChange={(v) => handleTaskFilterChange('taskType', v)}>
                        <SelectTrigger id="task-type" className="h-9 text-xs">
                          <SelectValue placeholder="All types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All types</SelectItem>
                          {filterOptions.taskTypes.map(type => (
                            <SelectItem key={type} value={type} className="capitalize">
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* College Filter */}
                    <div className="space-y-1.5">
                      <Label htmlFor="task-college" className="text-xs font-medium">College</Label>
                      <Select value={taskFilters.taskCollegeId} onValueChange={(v) => handleTaskFilterChange('taskCollegeId', v)}>
                        <SelectTrigger id="task-college" className="h-9 text-xs">
                          <SelectValue placeholder="All colleges" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All colleges</SelectItem>
                          {filterOptions.taskColleges.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Department Filter */}
                    <div className="space-y-1.5">
                      <Label htmlFor="task-department" className="text-xs font-medium">Department</Label>
                      <Select value={taskFilters.taskDepartmentId} onValueChange={(v) => handleTaskFilterChange('taskDepartmentId', v)}>
                        <SelectTrigger id="task-department" className="h-9 text-xs">
                          <SelectValue placeholder="All departments" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All departments</SelectItem>
                          {filterOptions.taskDepartments.map(d => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name} {d.code ? `(${d.code})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Course Filter */}
                    <div className="space-y-1.5">
                      <Label htmlFor="task-course" className="text-xs font-medium">Course</Label>
                      <Select value={taskFilters.taskCourseId} onValueChange={(v) => handleTaskFilterChange('taskCourseId', v)}>
                        <SelectTrigger id="task-course" className="h-9 text-xs">
                          <SelectValue placeholder="All courses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All courses</SelectItem>
                          {filterOptions.taskCourses.map(course => (
                            <SelectItem key={course.id || course} value={course.id || course}>
                              {course.title || course.name || course}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Status Filter */}
                    <div className="space-y-1.5">
                      <Label htmlFor="task-status" className="text-xs font-medium">Status/Progress</Label>
                      <Select value={taskFilters.taskStatus} onValueChange={(v) => handleTaskFilterChange('taskStatus', v)}>
                        <SelectTrigger id="task-status" className="h-9 text-xs">
                          <SelectValue placeholder="All tasks" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All tasks</SelectItem>
                          {/* Actual database status values from backend only */}
                          {filterOptions.taskStatuses.map(status => (
                            <SelectItem key={status} value={status} className="capitalize">
                              {status === 'in-progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                  </div>
                )}
              </div>
              
              {/* Results */}
              {tasks.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-gray-200 dark:border-gray-800 space-y-2">
                  <ClipboardList className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {activeTaskFilterCount > 0 ? 'No tasks match the filters' : 'No tasks created yet'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeTaskFilterCount > 0 
                      ? 'Try adjusting your filters to see more results.' 
                      : 'Tasks and student evaluations created by this external trainer will appear here.'}
                  </p>
                  {activeTaskFilterCount > 0 && (
                    <Button variant="outline" size="sm" onClick={clearTaskFilters} className="mt-2">
                      Clear all filters
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="text-xs text-muted-foreground px-1">
                    Showing {tasks.length} task{tasks.length === 1 ? '' : 's'}
                  </div>
                  {tasks.map(t => <TaskCard key={t.id} task={t} />)}
                </>
              )}
            </TabsContent>
          </Tabs>
        )}

        <div className="flex justify-end pt-4 mt-auto border-t border-gray-100 dark:border-gray-800">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
