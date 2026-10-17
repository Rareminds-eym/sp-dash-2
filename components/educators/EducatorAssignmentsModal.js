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

  useEffect(() => {
    if (!educator) return
    let alive = true
    setLoading(true)
    setError('')
    fetch(`/api/educators/${educator.id}/assignments`, { cache: 'no-store' })
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Failed to load assignments')
        if (alive) {
          setAssignments(body.data?.assignments || [])
          setTasks(body.data?.tasks || [])
        }
      })
      .catch(e => {
        if (alive) setError(e.message)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [educator])

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
              {assignments.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-gray-200 dark:border-gray-800 space-y-2">
                  <BookOpen className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No teaching allocations found</p>
                  <p className="text-xs text-muted-foreground">This educator has not been allocated to any colleges or batches yet.</p>
                </div>
              ) : (
                assignments.map(a => <AssignmentCard key={a.id} assignment={a} />)
              )}
            </TabsContent>

            <TabsContent value="tasks" className="space-y-4 mt-2">
              {tasks.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-gray-200 dark:border-gray-800 space-y-2">
                  <ClipboardList className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No tasks created yet</p>
                  <p className="text-xs text-muted-foreground">Tasks and student evaluations created by this external trainer will appear here.</p>
                </div>
              ) : (
                tasks.map(t => <TaskCard key={t.id} task={t} />)
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
