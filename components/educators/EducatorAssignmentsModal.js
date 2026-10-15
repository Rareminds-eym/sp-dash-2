'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, BookOpen, Building2, CalendarDays } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

const STATUS_STYLES = {
  active: 'bg-green-100 text-green-700 border-green-200',
  upcoming: 'bg-amber-100 text-amber-700 border-amber-200',
  ended: 'bg-gray-100 text-gray-600 border-gray-200',
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function AssignmentCard({ assignment }) {
  const taughtCount = new Set((assignment.history || []).map(s => s.courseId).filter(Boolean)).size
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3 bg-white dark:bg-gray-900/40">
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
          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200">
            <Building2 className="h-3 w-3 mr-1" />
            {assignment.collegeName}
          </Badge>
        )}
        {assignment.departmentName && (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <BookOpen className="h-3 w-3 mr-1" />
            {assignment.departmentName}
          </Badge>
        )}
        {assignment.sectionName && (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
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
                    ? 'bg-orange-50 text-orange-700 border-orange-200'
                    : 'bg-gray-50 text-gray-500 border-gray-200'}
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
                  className={session.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'}
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

export default function EducatorAssignmentsModal({ educator, onClose }) {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!educator) return
    let alive = true
    setLoading(true)
    setError('')
    fetch(`/api/educators/${educator.id}/assignments`, { cache: 'no-store' })
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Failed to load assignments')
        if (alive) setAssignments(body.data?.assignments || [])
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
    <Dialog open={!!educator} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {educator?.firstName} {educator?.lastName} — Assignments
          </DialogTitle>
          <DialogDescription>
            {educator?.email}
            {educator?.employeeId ? ` · ${educator.employeeId}` : ''}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Couldn&apos;t load assignments</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No assignments yet.</p>
        ) : (
          <div className="space-y-4">
            {assignments.map(a => (
              <AssignmentCard key={a.id} assignment={a} />
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
