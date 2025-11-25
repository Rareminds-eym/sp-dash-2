import { Button } from '@/components/ui/button'
import { Loader2, BookOpen } from 'lucide-react'
import { CourseCard } from './CourseCard'

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
    getStatusBadge
}) {
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
    )
}
