'use client'

import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { GraduationCap, Plus, Download } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'

// Import modular components
import { BulkActionBar } from './course-management/BulkActionBar'
import { CourseFilters } from './course-management/CourseFilters'
import { CourseList } from './course-management/CourseList'
import { CourseFormDialog } from './course-management/CourseFormDialog'
import { DeleteConfirmationDialog } from './course-management/DeleteConfirmationDialog'
import { CourseDetailsDialog } from './course-management/CourseDetailsDialog'

export default function CourseManagementPage({ currentUser }) {
    const router = useRouter()
    const { toast } = useToast()

    // Course list state
    const [courses, setCourses] = useState([])
    const [loadingCourses, setLoadingCourses] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterUniversity, setFilterUniversity] = useState('all')
    const [filterCategory, setFilterCategory] = useState('all')
    const [filterStatus, setFilterStatus] = useState('all')
    const [sortBy, setSortBy] = useState('date-newest')
    const [page, setPage] = useState(1)
    const [totalCourses, setTotalCourses] = useState(0)
    const [hasMore, setHasMore] = useState(false)

    // Phase 2: Bulk operations
    const [selectedCourses, setSelectedCourses] = useState(new Set())
    const [bulkDeleting, setBulkDeleting] = useState(false)

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [universities, setUniversities] = useState([])
    const [loadingUniversities, setLoadingUniversities] = useState(true)

    // Edit/Delete/View state
    const [editingCourse, setEditingCourse] = useState(null)
    const [deletingCourse, setDeletingCourse] = useState(null)
    const [viewingCourse, setViewingCourse] = useState(null)
    const [detailsOpen, setDetailsOpen] = useState(false)

    const [formData, setFormData] = useState({
        name: '',
        courseCode: '',
        description: '',
        university: '',
        duration: '',
        credits: '',
        category: '',
        thumbnailUrl: '',
        targetOutcomes: ''
    })

    const [errors, setErrors] = useState({})

    // === Helper Functions ===

    // Export to CSV
    const handleExportCSV = () => {
        try {
            // Create CSV header
            const headers = ['Course Name', 'Course Code', 'University', 'Category', 'Status', 'Duration', 'Credits', 'Created Date', 'Description']

            // Create CSV rows
            const rows = courses.map(course => [
                course.name || '',
                course.course_code || '',
                course.university || '',
                course.category || '',
                course.approval_status || '',
                course.duration || '',
                course.credits || '',
                course.created_at ? new Date(course.created_at).toLocaleDateString() : '',
                (course.description || '').replace(/"/g, '""') // Escape quotes
            ])

            // Combine header and rows
            const csvContent = [
                headers.map(h => `"${h}"`).join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n')

            // Create blob and download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
            const link = document.createElement('a')
            link.href = URL.createObjectURL(blob)
            link.download = `courses_export_${new Date().toISOString().split('T')[0]}.csv`
            link.click()

            toast({
                title: 'Success!',
                description: `Exported ${courses.length} courses to CSV`,
            })
        } catch (error) {
            console.error('Export error:', error)
            toast({
                title: 'Error',
                description: 'Failed to export courses',
                variant: 'destructive'
            })
        }
    }

    // Bulk selection
    const handleSelectCourse = (courseId) => {
        setSelectedCourses(prev => {
            const newSet = new Set(prev)
            if (newSet.has(courseId)) {
                newSet.delete(courseId)
            } else {
                newSet.add(courseId)
            }
            return newSet
        })
    }

    // Bulk delete
    const handleBulkDelete = async () => {
        if (selectedCourses.size === 0) return

        try {
            setBulkDeleting(true)
            const deletePromises = Array.from(selectedCourses).map(courseId =>
                fetch(`/api/courses/${courseId}`, { method: 'DELETE' })
                    .then(response => ({ courseId, ok: response.ok, response }))
            )

            const results = await Promise.all(deletePromises)
            const successful = results.filter(r => r.ok).length
            const failed = results.filter(r => !r.ok).length

            if (successful > 0) {
                toast({
                    title: 'Success!',
                    description: failed > 0
                        ? `Deleted ${successful} course(s). ${failed} failed.`
                        : `Deleted ${successful} course(s) successfully`,
                })
            } else {
                toast({
                    title: 'Error',
                    description: 'Failed to delete courses',
                    variant: 'destructive'
                })
            }

            setSelectedCourses(new Set())
            await fetchCourses(1, false)
        } catch (error) {
            console.error('Bulk delete error:', error)
            toast({
                title: 'Error',
                description: 'Failed to delete some courses',
                variant: 'destructive'
            })
        } finally {
            setBulkDeleting(false)
        }
    }

    // Fetch approved universities on mount
    useEffect(() => {
        const fetchUniversities = async () => {
            try {
                const response = await fetch('/api/universities?approval_status=approved&limit=1000')
                const data = await response.json()

                if (response.ok && data.data) {
                    setUniversities(data.data)
                } else {
                    console.error('Failed to fetch universities:', data.error)
                }
            } catch (error) {
                console.error('Error fetching universities:', error)
            } finally {
                setLoadingUniversities(false)
            }
        }

        fetchUniversities()
    }, [])

    // Fetch courses
    const fetchCourses = async (pageNum = 1, append = false) => {
        try {
            setLoadingCourses(true)

            const params = new URLSearchParams({
                page: pageNum.toString(),
                limit: '20',
                sort: sortBy,
                t: Date.now().toString() // Prevent caching
            })

            if (searchQuery) params.append('search', searchQuery)
            if (filterUniversity !== 'all') params.append('university', filterUniversity)
            if (filterCategory !== 'all') params.append('category', filterCategory)
            if (filterStatus !== 'all') params.append('approval_status', filterStatus)

            const response = await fetch(`/api/courses?${params.toString()}`, {
                cache: 'no-store',
                headers: {
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache'
                }
            })
            const data = await response.json()

            if (response.ok && data.data) {
                if (append) {
                    setCourses(prev => [...prev, ...data.data])
                } else {
                    setCourses(data.data)
                }
                setTotalCourses(data.pagination?.total || 0)
                setHasMore(data.pagination?.page < data.pagination?.totalPages)
                setPage(pageNum)
            } else {
                console.error('Failed to fetch courses:', data.error)
                toast({
                    title: 'Error',
                    description: 'Failed to load courses',
                    variant: 'destructive'
                })
            }
        } catch (error) {
            console.error('Error fetching courses:', error)
            toast({
                title: 'Error',
                description: 'Failed to load courses',
                variant: 'destructive'
            })
        } finally {
            setLoadingCourses(false)
        }
    }

    // Fetch courses on mount and filter/sort changes
    useEffect(() => {
        fetchCourses(1, false)
        setSelectedCourses(new Set()) // Clear selection on filter change
    }, [searchQuery, filterUniversity, filterCategory, filterStatus, sortBy])

    const loadMore = () => {
        if (hasMore && !loadingCourses) {
            fetchCourses(page + 1, true)
        }
    }

    const validateForm = () => {
        const newErrors = {}

        if (!formData.name.trim()) newErrors.name = 'Course name is required'
        if (!formData.courseCode.trim()) newErrors.courseCode = 'Course code is required'
        if (!formData.description.trim()) newErrors.description = 'Description is required'
        if (!formData.university.trim()) newErrors.university = 'University is required'
        if (!formData.duration.trim()) newErrors.duration = 'Duration is required'
        if (!formData.credits.trim()) newErrors.credits = 'Credits is required'
        else if (isNaN(formData.credits) || Number(formData.credits) <= 0) {
            newErrors.credits = 'Credits must be a positive number'
        }
        if (!formData.category.trim()) newErrors.category = 'Category is required'
        if (!formData.thumbnailUrl.trim()) newErrors.thumbnailUrl = 'Thumbnail URL is required'
        else if (!isValidUrl(formData.thumbnailUrl)) {
            newErrors.thumbnailUrl = 'Please enter a valid URL'
        }
        if (!formData.targetOutcomes.trim()) newErrors.targetOutcomes = 'Target outcomes are required'

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const isValidUrl = (string) => {
        try {
            new URL(string)
            return true
        } catch (_) {
            return false
        }
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev }
                delete newErrors[name]
                return newErrors
            })
        }
    }

    const handleReset = () => {
        setFormData({
            name: '',
            courseCode: '',
            description: '',
            university: '',
            duration: '',
            credits: '',
            category: '',
            thumbnailUrl: '',
            targetOutcomes: ''
        })
        setErrors({})
        setEditingCourse(null)
    }

    const handleEdit = (course) => {
        setEditingCourse(course)
        setFormData({
            name: course.name,
            courseCode: course.course_code,
            description: course.description,
            university: course.university || '',
            duration: course.duration || '',
            credits: course.credits?.toString() || '',
            category: course.category || '',
            thumbnailUrl: course.thumbnail_url || '',
            targetOutcomes: Array.isArray(course.target_outcomes) ? course.target_outcomes.join('\n') : course.target_outcomes || ''
        })
        setDialogOpen(true)
    }

    const handleDelete = async () => {
        if (!deletingCourse) return

        try {
            const response = await fetch(`/api/courses/${deletingCourse.id}`, {
                method: 'DELETE'
            })

            const data = await response.json()

            if (response.ok && data.success) {
                toast({
                    title: 'Success!',
                    description: data.message || 'Course deleted successfully',
                })
                setDeletingCourse(null)
                fetchCourses(1, false)
            } else {
                throw new Error(data.error || 'Failed to delete course')
            }
        } catch (error) {
            console.error('Delete error:', error)
            toast({
                title: 'Error',
                description: error.message || 'Failed to delete course. Please try again.',
                variant: 'destructive'
            })
        }
    }

    const handleViewDetails = (course) => {
        setViewingCourse(course)
        setDetailsOpen(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!validateForm()) {
            toast({
                title: 'Validation Error',
                description: 'Please fill in all required fields correctly.',
                variant: 'destructive'
            })
            return
        }

        setLoading(true)

        try {
            const endpoint = editingCourse ? `/api/courses/${editingCourse.id}` : '/api/courses'
            const method = editingCourse ? 'PUT' : 'POST'

            const response = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    course_code: formData.courseCode,
                    description: formData.description,
                    university: formData.university,
                    duration: formData.duration,
                    credits: Number(formData.credits),
                    category: formData.category,
                    thumbnail_url: formData.thumbnailUrl,
                    target_outcomes: formData.targetOutcomes,
                    approval_status: 'approved',
                    created_by: currentUser?.user?.id
                })
            })

            const data = await response.json()

            if (response.ok && data.success) {
                toast({
                    title: 'Success!',
                    description: editingCourse ? 'Course updated successfully.' : 'Course created successfully.',
                })
                handleReset()
                setDialogOpen(false)
                fetchCourses(1, false)
            } else {
                throw new Error(data.error || data.message || `Failed to ${editingCourse ? 'update' : 'create'} course`)
            }
        } catch (error) {
            console.error('Course operation error:', error)
            toast({
                title: 'Error',
                description: error.message || `Failed to ${editingCourse ? 'update' : 'create'} course. Please try again.`,
                variant: 'destructive'
            })
        } finally {
            setLoading(false)
        }
    }

    const getStatusBadge = (status) => {
        const statusMap = {
            'Draft': 'secondary',
            'pending': 'secondary',
            'Active': 'default',
            'approved': 'default',
            'rejected': 'destructive'
        }
        return (
            <Badge variant={statusMap[status] || 'secondary'}>
                {status}
            </Badge>
        )
    }

    return (
        <div className="space-y-6">
            {/* Bulk Action Bar */}
            <BulkActionBar
                selectedCount={selectedCourses.size}
                onClearSelection={() => setSelectedCourses(new Set())}
                onDelete={handleBulkDelete}
                isDeleting={bulkDeleting}
            />

            {/* Page Header */}
            <div className={`flex items-center justify-between pb-4 border-b border-white/20 dark:border-slate-700/50 ${selectedCourses.size > 0 ? 'mt-16' : ''}`}>
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                        <GraduationCap className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Course Management
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Manage courses and course catalog ({totalCourses} total)
                        </p>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={handleExportCSV}
                        disabled={courses.length === 0}
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                    </Button>

                    <Button
                        onClick={() => {
                            handleReset()
                            setDialogOpen(true)
                        }}
                        className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Course
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <CourseFilters
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                filterUniversity={filterUniversity}
                setFilterUniversity={setFilterUniversity}
                filterCategory={filterCategory}
                setFilterCategory={setFilterCategory}
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                sortBy={sortBy}
                setSortBy={setSortBy}
                universities={universities}
                loadingUniversities={loadingUniversities}
            />

            {/* Course List */}
            <CourseList
                courses={courses}
                loadingCourses={loadingCourses}
                selectedCourses={selectedCourses}
                onSelectCourse={handleSelectCourse}
                onEdit={handleEdit}
                onDelete={(course) => setDeletingCourse(course)}
                onViewDetails={handleViewDetails}
                hasMore={hasMore}
                loadMore={loadMore}
                getStatusBadge={getStatusBadge}
            />

            {/* Dialogs */}
            <CourseFormDialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open)
                    if (!open) handleReset()
                }}
                editingCourse={editingCourse}
                formData={formData}
                handleChange={handleChange}
                handleSubmit={handleSubmit}
                loading={loading}
                errors={errors}
                universities={universities}
                loadingUniversities={loadingUniversities}
                setFormData={setFormData}
                setErrors={setErrors}
            />

            <DeleteConfirmationDialog
                course={deletingCourse}
                open={!!deletingCourse}
                onOpenChange={() => setDeletingCourse(null)}
                onConfirm={handleDelete}
            />

            <CourseDetailsDialog
                course={viewingCourse}
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
            />
        </div>
    )
}
