'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { GraduationCap, Loader2, Plus, RotateCcw, Search, Filter, BookOpen } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

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
    const [page, setPage] = useState(1)
    const [totalCourses, setTotalCourses] = useState(0)
    const [hasMore, setHasMore] = useState(false)

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [universities, setUniversities] = useState([])
    const [loadingUniversities, setLoadingUniversities] = useState(true)

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
                sort: 'date-newest'
            })

            if (searchQuery) params.append('search', searchQuery)
            if (filterUniversity !== 'all') params.append('university', filterUniversity)
            if (filterCategory !== 'all') params.append('category', filterCategory)
            if (filterStatus !== 'all') params.append('approval_status', filterStatus)

            const response = await fetch(`/api/courses?${params.toString()}`)
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

    // Fetch courses on mount and filter changes
    useEffect(() => {
        fetchCourses(1, false)
    }, [searchQuery, filterUniversity, filterCategory, filterStatus])

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
            const response = await fetch('/api/courses', {
                method: 'POST',
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
                    description: 'Course created successfully.',
                })
                handleReset()
                setDialogOpen(false)
                // Refresh course list
                fetchCourses(1, false)
            } else {
                throw new Error(data.error || data.message || 'Failed to create course')
            }
        } catch (error) {
            console.error('Course creation error:', error)
            toast({
                title: 'Error',
                description: error.message || 'Failed to create course. Please try again.',
                variant: 'destructive'
            })
        } finally {
            setLoading(false)
        }
    }

    const getStatusBadge = (status) => {
        const statusMap = {
            'Draft': 'secondary',
            'Active': 'default',
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
            {/* Page Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/20 dark:border-slate-700/50">
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

                {/* Create Course Button */}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white">
                            <Plus className="h-4 w-4 mr-2" />
                            Create Course
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Plus className="h-5 w-5" />
                                Create New Course
                            </DialogTitle>
                            <DialogDescription>
                                Fill in the details below to create a new course. All fields are required.
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Basic Information */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">
                                    Basic Information
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Course Name */}
                                    <div className="space-y-2">
                                        <Label htmlFor="name">
                                            Course Name <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="name"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            placeholder="e.g., Introduction to Data Science"
                                            className={errors.name ? 'border-red-500' : ''}
                                        />
                                        {errors.name && (
                                            <p className="text-sm text-red-500">{errors.name}</p>
                                        )}
                                    </div>

                                    {/* Course Code */}
                                    <div className="space-y-2">
                                        <Label htmlFor="courseCode">
                                            Course Code <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="courseCode"
                                            name="courseCode"
                                            value={formData.courseCode}
                                            onChange={handleChange}
                                            placeholder="e.g., CS101"
                                            className={errors.courseCode ? 'border-red-500' : ''}
                                        />
                                        {errors.courseCode && (
                                            <p className="text-sm text-red-500">{errors.courseCode}</p>
                                        )}
                                    </div>

                                    {/* University */}
                                    <div className="space-y-2">
                                        <Label htmlFor="university">
                                            University/Institution <span className="text-red-500">*</span>
                                        </Label>
                                        <Select
                                            value={formData.university}
                                            onValueChange={(value) => {
                                                setFormData(prev => ({ ...prev, university: value }))
                                                if (errors.university) {
                                                    setErrors(prev => {
                                                        const newErrors = { ...prev }
                                                        delete newErrors.university
                                                        return newErrors
                                                    })
                                                }
                                            }}
                                            disabled={loadingUniversities}
                                        >
                                            <SelectTrigger className={errors.university ? 'border-red-500' : ''}>
                                                <SelectValue placeholder={loadingUniversities ? "Loading universities..." : "Select a university"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {universities.length > 0 ? (
                                                    universities.map(uni => (
                                                        <SelectItem key={uni.id} value={uni.name}>
                                                            {uni.name}
                                                        </SelectItem>
                                                    ))
                                                ) : (
                                                    <SelectItem value="none" disabled>
                                                        {loadingUniversities ? 'Loading...' : 'No universities available'}
                                                    </SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                        {errors.university && (
                                            <p className="text-sm text-red-500">{errors.university}</p>
                                        )}
                                    </div>

                                    {/* Category */}
                                    <div className="space-y-2">
                                        <Label htmlFor="category">
                                            Category/Department <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="category"
                                            name="category"
                                            value={formData.category}
                                            onChange={handleChange}
                                            placeholder="e.g., Computer Science"
                                            className={errors.category ? 'border-red-500' : ''}
                                        />
                                        {errors.category && (
                                            <p className="text-sm text-red-500">{errors.category}</p>
                                        )}
                                    </div>

                                    {/* Duration */}
                                    <div className="space-y-2">
                                        <Label htmlFor="duration">
                                            Duration <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="duration"
                                            name="duration"
                                            value={formData.duration}
                                            onChange={handleChange}
                                            placeholder="e.g., 8 weeks, 3 months"
                                            className={errors.duration ? 'border-red-500' : ''}
                                        />
                                        {errors.duration && (
                                            <p className="text-sm text-red-500">{errors.duration}</p>
                                        )}
                                    </div>

                                    {/* Credits */}
                                    <div className="space-y-2">
                                        <Label htmlFor="credits">
                                            Credits <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="credits"
                                            name="credits"
                                            type="number"
                                            min="0"
                                            step="0.5"
                                            value={formData.credits}
                                            onChange={handleChange}
                                            placeholder="e.g., 3"
                                            className={errors.credits ? 'border-red-500' : ''}
                                        />
                                        {errors.credits && (
                                            <p className="text-sm text-red-500">{errors.credits}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Thumbnail URL */}
                                <div className="space-y-2">
                                    <Label htmlFor="thumbnailUrl">
                                        Thumbnail URL <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="thumbnailUrl"
                                        name="thumbnailUrl"
                                        type="url"
                                        value={formData.thumbnailUrl}
                                        onChange={handleChange}
                                        placeholder="https://example.com/image.jpg"
                                        className={errors.thumbnailUrl ? 'border-red-500' : ''}
                                    />
                                    {errors.thumbnailUrl && (
                                        <p className="text-sm text-red-500">{errors.thumbnailUrl}</p>
                                    )}
                                </div>
                            </div>

                            {/* Course Details */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">
                                    Course Details
                                </h3>

                                {/* Description */}
                                <div className="space-y-2">
                                    <Label htmlFor="description">
                                        Description <span className="text-red-500">*</span>
                                    </Label>
                                    <Textarea
                                        id="description"
                                        name="description"
                                        value={formData.description}
                                        onChange={handleChange}
                                        placeholder="Provide a detailed description of the course..."
                                        rows={5}
                                        className={errors.description ? 'border-red-500' : ''}
                                    />
                                    {errors.description && (
                                        <p className="text-sm text-red-500">{errors.description}</p>
                                    )}
                                </div>

                                {/* Target Outcomes */}
                                <div className="space-y-2">
                                    <Label htmlFor="targetOutcomes">
                                        Target Outcomes <span className="text-red-500">*</span>
                                    </Label>
                                    <Textarea
                                        id="targetOutcomes"
                                        name="targetOutcomes"
                                        value={formData.targetOutcomes}
                                        onChange={handleChange}
                                        placeholder="List the learning outcomes and goals for students completing this course..."
                                        rows={5}
                                        className={errors.targetOutcomes ? 'border-red-500' : ''}
                                    />
                                    {errors.targetOutcomes && (
                                        <p className="text-sm text-red-500">{errors.targetOutcomes}</p>
                                    )}
                                    <p className="text-sm text-muted-foreground">
                                        Tip: List each outcome on a new line for better readability
                                    </p>
                                </div>
                            </div>

                            {/* Form Actions */}
                            <div className="flex gap-4 pt-4 border-t">
                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Creating Course...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="h-4 w-4 mr-2" />
                                            Create Course
                                        </>
                                    )}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleReset}
                                    disabled={loading}
                                >
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                    Reset Form
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Search and Filters */}
            <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50">
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Search */}
                        <div className="space-y-2">
                            <Label htmlFor="search">Search</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="search"
                                    placeholder="Course name or code..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        {/* University Filter */}
                        <div className="space-y-2">
                            <Label>University</Label>
                            <Select value={filterUniversity} onValueChange={setFilterUniversity}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All universities" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All universities</SelectItem>
                                    {universities.map(uni => (
                                        <SelectItem key={uni.id} value={uni.name}>
                                            {uni.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Category Filter */}
                        <div className="space-y-2">
                            <Label>Category</Label>
                            <Select value={filterCategory} onValueChange={setFilterCategory}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All categories" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All categories</SelectItem>
                                    <SelectItem value="Computer Science">Computer Science</SelectItem>
                                    <SelectItem value="Engineering">Engineering</SelectItem>
                                    <SelectItem value="Business">Business</SelectItem>
                                    <SelectItem value="Arts">Arts</SelectItem>
                                    <SelectItem value="Science">Science</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Status Filter */}
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All statuses</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="approved">Approved</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Course List */}
            {loadingCourses && courses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    <p className="text-muted-foreground">Loading courses...</p>
                </div>
            ) : courses.length === 0 ? (
                <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50">
                    <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
                        <BookOpen className="h-12 w-12 text-muted-foreground" />
                        <div className="text-center">
                            <h3 className="text-lg font-semibold mb-2">No courses found</h3>
                            <p className="text-muted-foreground">
                                {searchQuery || filterUniversity !== 'all' || filterCategory !== 'all' || filterStatus !== 'all'
                                    ? 'Try adjusting your search or filters'
                                    : 'Create your first course to get started'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {courses.map(course => (
                            <Card key={course.id} className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50 hover:shadow-lg transition-shadow">
                                <CardHeader className="space-y-0 pb-2">
                                    {course.thumbnail_url && (
                                        <div className="w-full h-40 mb-4 rounded-lg overflow-hidden bg-gradient-to-br from-blue-500/10 to-purple-600/10">
                                            <img
                                                src={course.thumbnail_url}
                                                alt={course.name}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    e.target.style.display = 'none'
                                                }}
                                            />
                                        </div>
                                    )}
                                    <div className="flex items-start justify-between gap-2">
                                        <CardTitle className="text-lg line-clamp-2">{course.name}</CardTitle>
                                        {getStatusBadge(course.approval_status)}
                                    </div>
                                    <CardDescription className="font-mono text-xs">
                                        {course.course_code}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <p className="text-sm text-muted-foreground line-clamp-3">
                                        {course.description}
                                    </p>
                                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground pt-2 border-t">
                                        {course.university && (
                                            <span className="flex items-center gap-1">
                                                <GraduationCap className="h-3 w-3" />
                                                {course.university}
                                            </span>
                                        )}
                                        {course.category && (
                                            <span>• {course.category}</span>
                                        )}
                                        {course.duration && (
                                            <span>• {course.duration}</span>
                                        )}
                                        {course.credits && (
                                            <span>• {course.credits} credits</span>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Load More Button */}
                    {hasMore && (
                        <div className="flex justify-center pt-6">
                            <Button
                                onClick={loadMore}
                                disabled={loadingCourses}
                                variant="outline"
                                className="min-w-[200px]"
                            >
                                {loadingCourses ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    'Load More Courses'
                                )}
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
