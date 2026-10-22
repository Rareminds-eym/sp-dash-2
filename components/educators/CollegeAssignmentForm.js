'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useToast } from '@/hooks/use-toast'

// Mirrors skillpassport's formatProgramLabel (src/shared/lib/programLabel.ts):
// "Program Name" when it has no specializations, "CODE - Spec1, Spec2"
// when it does (falls back to the name if code is missing). Accepts the DB
// shape (text[]), a legacy comma-separated string, null, or undefined.
function getProgramSpecializations(program) {
  const specs = program?.specializations
  if (Array.isArray(specs)) {
    return specs.map((s) => String(s).trim()).filter(Boolean)
  }
  if (typeof specs === 'string') {
    return specs.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return []
}

// Compact chip label shared by the educator card and assignments modal.
export function formatSlotLabel(slot) {
  if (!slot || !slot.start_time || !slot.end_time) return ''
  return `${String(slot.start_time).slice(0, 5)}–${String(slot.end_time).slice(0, 5)}`
}

function emptySlot() {
  return { start_time: '', end_time: '' }
}

// Required-slot validation shared by both save paths. Returns an error
// message, or '' when the rows are acceptable (backend re-validates).
export function validateTimeSlots(slots) {
  if (!Array.isArray(slots) || slots.length === 0) {
    return 'Add at least one time slot.'
  }
  for (const s of slots) {
    if (!s.start_time || !s.end_time) {
      return 'Every time slot needs a start and end time.'
    }
    if (s.start_time >= s.end_time) {
      return 'Time slot start must be before its end.'
    }
  }
  return ''
}
function slotOverlapWarning(slots) {
  const ranges = (slots || [])
    .filter(s => s.start_time && s.end_time && s.start_time < s.end_time)
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      if (ranges[i].start_time < ranges[j].end_time && ranges[j].start_time < ranges[i].end_time) {
        return 'Two time slots overlap — the server will reject this.'
      }
    }
  }
  return ''
}

function formatSlotSummary(slot) {
  if (slot.start_time && slot.end_time) return `${slot.start_time}–${slot.end_time}`
  return 'pick times'
}

function formatProgramLabel(program) {
  const specs = getProgramSpecializations(program)
  if (specs.length === 0) return program.name
  const code = typeof program?.code === 'string' && program.code.trim().length > 0
    ? program.code.trim()
    : program.name
  return `${code} - ${specs.join(', ')}`
}

export default function CollegeAssignmentForm({ 
  form, 
  setForm, 
  trainerId,
  onSubmit,
  isLoading 
}) {
  const { toast } = useToast()
  
  // State for cascading dropdowns
  const [colleges, setColleges] = useState([])
  const [departments, setDepartments] = useState([])
  const [programs, setPrograms] = useState([])
  const [specializations, setSpecializations] = useState([]) // New: for selected program's specializations
  const [sections, setSections] = useState([])
  const [courses, setCourses] = useState([])
  const [courseSearch, setCourseSearch] = useState('')
  
  // Fetch colleges on mount
  useEffect(() => {
    fetchColleges()
  }, [])
  
  // Fetch departments when college changes
  useEffect(() => {
    if (form.collegeId) {
      fetchDepartments(form.collegeId)
    } else {
      setDepartments([])
      setPrograms([])
      setSections([])
      setCourses([])
      // Clear assigned courses when college changes
      setForm(prev => ({ ...prev, assignedCourses: [] }))
    }
  }, [form.collegeId])
  
  // Fetch programs when department changes
  useEffect(() => {
    if (form.departmentId) {
      fetchPrograms(form.departmentId)
      fetchCourses(form.departmentId) // Fetch courses for this department

    } else {
      setPrograms([])
      setSections([])
      setCourses([])
      setForm(prev => ({ ...prev, assignedCourses: [] }))
    }
  }, [form.departmentId])
  
  // Fetch sections when program changes
  useEffect(() => {
    if (form.programId) {
      fetchSections(form.programId)
      // Load specializations from the selected program
      const selectedProgram = programs.find(p => p.id === form.programId)
      if (selectedProgram && selectedProgram.specializations && selectedProgram.specializations.length > 0) {
        setSpecializations(selectedProgram.specializations)
      } else {
        setSpecializations([])
      }
    } else {
      setSections([])
      setSpecializations([])
    }
  }, [form.programId, programs])
  
  const fetchColleges = async () => {
    try {
      const response = await fetch('/api/colleges')
      const data = await response.json()
      if (data.success) {
        setColleges(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching colleges:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch colleges',
        variant: 'destructive'
      })
    }
  }
  
  const fetchDepartments = async (collegeId) => {
    try {
      const response = await fetch(`/api/departments?collegeId=${collegeId}`)
      const data = await response.json()
      if (data.success) {
        setDepartments(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching departments:', error)
    }
  }
  
  const fetchPrograms = async (departmentId) => {
    try {
      const response = await fetch(`/api/programs?departmentId=${departmentId}`)
      const data = await response.json()
      if (data.success) {
        setPrograms(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching programs:', error)
    }
  }
  
  const fetchSections = async (programId) => {
    try {
      const response = await fetch(`/api/sections?programId=${programId}`)
      const data = await response.json()
      if (data.success) {
        setSections(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching sections:', error)
    }
  }
  
  const fetchCourses = async (departmentId) => {
    try {
      const response = await fetch(`/api/courses?departmentId=${departmentId}`)
      const data = await response.json()
      if (data.success) {
        setCourses(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching courses:', error)
    }
  }
  
  const toggleCourse = (courseId) => {
    setForm(prev => ({
      ...prev,
      assignedCourses: prev.assignedCourses.includes(courseId)
        ? prev.assignedCourses.filter(id => id !== courseId)
        : [...prev.assignedCourses, courseId]
    }))
  }

  const filteredCourses = useMemo(() => {
    const q = courseSearch.trim().toLowerCase()
    if (!q) return courses
    return courses.filter(c =>
      `${c.code || ''} ${c.title || ''}`.toLowerCase().includes(q)
    )
  }, [courses, courseSearch])

  const toggleFilteredCourses = (select) => {
    setForm(prev => {
      const ids = filteredCourses.map(c => c.course_id)
      const next = new Set(prev.assignedCourses)
      ids.forEach(id => {
        if (select) next.add(id)
        else next.delete(id)
      })
      return { ...prev, assignedCourses: [...next] }
    })
  }

  const timeSlots = form.timeSlots || []
  const overlapWarning = slotOverlapWarning(timeSlots)

  const updateSlot = (index, patch) => {
    setForm(prev => ({
      ...prev,
      timeSlots: (prev.timeSlots || []).map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }))
  }

  const addSlot = () => {
    setForm(prev => ({ ...prev, timeSlots: [...(prev.timeSlots || []), emptySlot()] }))
  }

  const removeSlot = (index) => {
    setForm(prev => ({ ...prev, timeSlots: (prev.timeSlots || []).filter((_, i) => i !== index) }))
  }

  const selectedCount = form.assignedCourses.length

  return (
    <div className="space-y-8">
      {/* Step 1 — Placement */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">1</span>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Placement</h3>
        </div>

        <div className="space-y-4 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
        <div className="space-y-2">
          <Label htmlFor="collegeId">
            Select College <span className="text-red-500">*</span>
          </Label>
          <Select
            value={form.collegeId}
            onValueChange={(value) => setForm(prev => ({ 
              ...prev, 
              collegeId: value,
              departmentId: '',
              programId: '',
              sectionId: '',
              assignedCourses: []
            }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select College" />
            </SelectTrigger>
            <SelectContent>
              {colleges.map(college => (
                <SelectItem key={college.id} value={college.id}>
                  {college.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="departmentId">
            Select Department <span className="text-red-500">*</span>
          </Label>
          <Select
            value={form.departmentId}
            onValueChange={(value) => setForm(prev => ({ 
              ...prev, 
              departmentId: value,
              programId: '',
              sectionId: '',
              assignedCourses: []
            }))}
            disabled={!form.collegeId}
          >
            <SelectTrigger>
              <SelectValue placeholder={form.collegeId ? "Select Department" : "Select College First"} />
            </SelectTrigger>
            <SelectContent>
              {departments.map(dept => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name} ({dept.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="programId">
            Select Program *
          </Label>
          <Select
            value={form.programId || 'all'}
            onValueChange={(value) => setForm(prev => ({ 
              ...prev, 
              programId: value === 'all' ? '' : value,
              specializationId: '', // Reset specialization when program changes
              sectionId: ''
            }))}
            disabled={!form.departmentId}
          >
            <SelectTrigger>
              <SelectValue placeholder={form.departmentId ? "Select Program *" : "Select Department First"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" disabled>Select Program</SelectItem>
              {programs.map(program => (
                <SelectItem key={program.id} value={program.id}>
                  {formatProgramLabel(program)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* New: Specialization Dropdown */}
        <div className="space-y-2">
          <Label htmlFor="specializationId">
            Select Specialization (Optional)
          </Label>
          <Select
            value={form.specializationId || 'all'}
            onValueChange={(value) => setForm(prev => ({ ...prev, specializationId: value === 'all' ? '' : value }))}
            disabled={!form.programId || specializations.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={
                !form.programId 
                  ? "Select Program First" 
                  : specializations.length === 0 
                    ? "No Specializations Available" 
                    : "Select Specialization (Optional)"
              } />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Specializations</SelectItem>
              {specializations.map((spec, index) => (
                <SelectItem key={index} value={spec}>
                  {spec}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sectionId">
            Select Section *
          </Label>
          <Select
            value={form.sectionId || 'all'}
            onValueChange={(value) => setForm(prev => ({ ...prev, sectionId: value === 'all' ? '' : value }))}
            disabled={!form.programId}
          >
            <SelectTrigger>
              <SelectValue placeholder={form.programId ? "Select Section *" : "Select Program First"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" disabled>Select Section</SelectItem>
              {sections.map(section => (
                <SelectItem key={section.id} value={section.id}>
                  Section {section.section} - Semester {section.semester} - {section.academic_year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      </section>

      {/* Step 2 — Courses */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">2</span>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Courses <span className="text-red-500">*</span>
            </h3>
          </div>
          {selectedCount > 0 && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              {selectedCount} selected
            </Badge>
          )}
        </div>

        {form.departmentId ? (
          courses.length > 0 ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 px-3 py-2.5">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  placeholder="Search courses…"
                  className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
                {filteredCourses.length > 0 && (
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleFilteredCourses(true)}>
                      All
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleFilteredCourses(false)}>
                      Clear
                    </Button>
                  </div>
                )}
              </div>
              {filteredCourses.length > 0 ? (
                <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                  {filteredCourses.map(course => {
                    const checked = form.assignedCourses.includes(course.course_id)
                    return (
                      <label
                        key={course.course_id}
                        className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${checked ? 'bg-blue-50 dark:bg-blue-950/40' : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'}`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleCourse(course.course_id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium leading-snug">
                            {course.title}
                          </span>
                          <span className="block text-xs text-muted-foreground">{course.code}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              ) : (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No courses match “{courseSearch}”.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No courses available for this department</p>
          )
        ) : (
          <p className="text-sm text-muted-foreground">Select a department to see available courses</p>
        )}
      </section>

      {/* Step 3 — Schedule */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">3</span>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Schedule & notes</h3>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">
                Start Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="startDate"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">
                End Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="endDate"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                Time slots <span className="text-red-500">*</span>
              </p>
              <Button type="button" variant="outline" size="sm" onClick={addSlot}>
                Add slot
              </Button>
            </div>

            {timeSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add at least one time slot — sessions can only be created inside these hours.
            </p>
            ) : (
              <div className="space-y-3">
                {timeSlots.map((slot, index) => (
                  <div key={index} className="space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground truncate">
                        {formatSlotSummary(slot)}
                      </p>
                      <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 text-red-600 hover:text-red-700" onClick={() => removeSlot(index)}>
                        Remove
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Start</Label>
                        <Input
                          type="time"
                          value={slot.start_time}
                          onChange={(e) => updateSlot(index, { start_time: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>End</Label>
                        <Input
                          type="time"
                          value={slot.end_time}
                          onChange={(e) => updateSlot(index, { end_time: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {overlapWarning && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    {overlapWarning}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              rows={3}
              placeholder="Add any special notes about this assignment..."
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
