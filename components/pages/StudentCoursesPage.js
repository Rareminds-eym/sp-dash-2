'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { BookOpen, Search, Users, TrendingUp, Download } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useDebounce } from '@/hooks/use-debounce'

export default function StudentCoursesPage() {
    const { toast } = useToast()
    const [courses, setCourses] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const debouncedSearch = useDebounce(searchQuery, 500)
    const [stats, setStats] = useState({
        totalEnrollments: 0,
        activeCourses: 0,
        completionRate: 0
    })

    useEffect(() => {
        fetchCourses()
    }, [debouncedSearch])

    const fetchCourses = async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams({
                page: '1',
                limit: '50'
            })
            if (debouncedSearch) params.append('search', debouncedSearch)

            const response = await fetch(`/api/student-dashboard/courses?${params}`)
            const data = await response.json()

            if (response.ok && data.data) {
                setCourses(data.data)
                setStats(data.stats || stats)
            } else {
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
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/20 dark:border-slate-700/50">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/25">
                        <BookOpen className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Student Courses
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            View student course enrollments and progress
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalEnrollments}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Courses</CardTitle>
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.activeCourses}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.completionRate}%</div>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <div className="flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search courses..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Courses List */}
            <div className="grid grid-cols-1 gap-4">
                {loading ? (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground">Loading courses...</p>
                    </div>
                ) : courses.length === 0 ? (
                    <div className="text-center py-12">
                        <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No courses found</p>
                    </div>
                ) : (
                    courses.map((course) => (
                        <Card key={course.id}>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <CardTitle>{course.name}</CardTitle>
                                        <CardDescription className="mt-2">
                                            {course.description}
                                        </CardDescription>
                                    </div>
                                    <Badge variant={course.status === 'Active' ? 'default' : 'secondary'}>
                                        {course.status}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <p className="text-muted-foreground">Enrollments</p>
                                        <p className="font-semibold">{course.enrollments || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Completed</p>
                                        <p className="font-semibold">{course.completed || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">In Progress</p>
                                        <p className="font-semibold">{course.inProgress || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Completion Rate</p>
                                        <p className="font-semibold">{course.completionRate || 0}%</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    )
}
