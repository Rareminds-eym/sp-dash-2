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
import { useEffect, useState } from 'react'
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

  return (
    <div className="space-y-6">
      {/* College Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Assignment Details</h3>
        
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

      {/* Course Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Assigned Courses <span className="text-red-500">*</span>
        </h3>
        
        {form.departmentId ? (
          courses.length > 0 ? (
            <div className="max-h-64 overflow-y-auto border rounded-lg p-4 space-y-2">
              {courses.map(course => (
                <div key={course.course_id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`course-${course.course_id}`}
                    checked={form.assignedCourses.includes(course.course_id)}
                    onCheckedChange={() => toggleCourse(course.course_id)}
                  />
                  <label
                    htmlFor={`course-${course.course_id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {course.code} - {course.title}
                  </label>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No courses available for this department</p>
          )
        ) : (
          <p className="text-sm text-muted-foreground">Select a department to see available courses</p>
        )}
        
        {form.assignedCourses.length > 0 && (
          <p className="text-sm text-green-600 dark:text-green-400">
            {form.assignedCourses.length} course(s) selected
          </p>
        )}
      </div>

      {/* Date Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Schedule</h3>
        
        <div className="grid grid-cols-2 gap-4">
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
              End Date (Optional)
            </Label>
            <Input
              id="endDate"
              type="date"
              value={form.endDate}
              onChange={(e) => setForm(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (Optional)</Label>
        <textarea
          id="notes"
          className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Add any special notes about this assignment..."
          value={form.notes}
          onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
        />
      </div>
    </div>
  )
}
