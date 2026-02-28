import { Button } from '@/components/ui/button'
import { Loader2, BookOpen, MoreVertical, Eye, Edit, Trash2 } from 'lucide-react'
import { CourseCard } from './CourseCard'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Checkbox } from '@/components/ui/checkbox'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useEffect, useRef } from 'react'

export function CourseList({
    courses,
    loadingCourses,
    selectedCourses,
    onSelectCourse,
    onEdit,
    onDelete,
    onViewDetails,
    hasMore,
    loadMore,
    getStatusBadge,
    viewMode
}) {
    const observerTarget = useRef(null)

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore && !loadingCourses) {
                    loadMore()
                }
            },
            { threshold: 1.0 }
        )

        if (observerTarget.current) {
            observer.observe(observerTarget.current)
        }

        return () => {
            if (observerTarget.current) {
                observer.unobserve(observerTarget.current)
            }
        }
    }, [hasMore, loadingCourses, loadMore])

    if (loadingCourses && courses.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        )
    }

    if (!loadingCourses && courses.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <BookOpen className="h-12 w-12 mb-4 opacity-20" />
                <p>No courses found</p>
            </div>
        )
    }

    return (
        <>
            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses.map(course => (
                        <CourseCard
                            key={course.id}
                            course={course}
                            selected={selectedCourses.has(course.id)}
                            onSelect={() => onSelectCourse(course.id)}
                            onEdit={() => onEdit(course)}
                            onDelete={() => onDelete(course)}
                            onViewDetails={() => onViewDetails(course)}
                            getStatusBadge={getStatusBadge}
                        />
                    ))}
                </div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]"></TableHead>
                                <TableHead>Course</TableHead>
                                <TableHead>Code</TableHead>
                                <TableHead>University</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {courses.map((course) => (
                                <TableRow key={course.id}>
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedCourses.has(course.id)}
                                            onCheckedChange={() => onSelectCourse(course.id)}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-3">
                                            {course.thumbnail_url ? (
                                                <img
                                                    src={course.thumbnail_url}
                                                    alt={course.name}
                                                    className="h-10 w-10 rounded object-cover"
                                                    onError={(e) => {
                                                        e.target.style.display = 'none'
                                                    }}
                                                />
                                            ) : (
                                                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                                                    <BookOpen className="h-5 w-5 text-muted-foreground" />
                                                </div>
                                            )}
                                            <span>{course.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{course.course_code}</TableCell>
                                    <TableCell>{course.university}</TableCell>
                                    <TableCell>{course.category}</TableCell>
                                    <TableCell>{getStatusBadge(course.approval_status)}</TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => onViewDetails(course)}>
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    View Details
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => onEdit(course)}>
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Edit Course
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => onDelete(course)}
                                                    className="text-red-600"
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete Course
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Infinity Loader Sentinel */}
            <div ref={observerTarget} className="flex justify-center py-6 h-20">
                {loadingCourses && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading more courses...
                    </div>
                )}
            </div>
        </>
    )
}
