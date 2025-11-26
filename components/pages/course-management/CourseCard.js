import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { GraduationCap, MoreVertical, Eye, Edit, Trash2, Clock, Award, BookOpen } from 'lucide-react'

export function CourseCard({ course, selected, onSelect, onEdit, onDelete, onViewDetails, getStatusBadge }) {
    return (
        <Card className={`group relative overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/20 ${selected
                ? 'ring-2 ring-blue-500 shadow-xl shadow-blue-500/30 scale-[1.02]'
                : 'hover:scale-[1.02]'
            }`}>
            {/* Gradient Background Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Selection Checkbox - Modern Position */}
            <div className="absolute top-3 left-3 z-20">
                <Checkbox
                    checked={selected}
                    onCheckedChange={onSelect}
                    className="h-5 w-5 rounded-md border-2 border-white/80 bg-white/90 backdrop-blur-sm shadow-lg data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-blue-500 data-[state=checked]:to-blue-600 data-[state=checked]:border-blue-600 transition-all duration-200"
                />
            </div>

            {/* Actions Menu - Glassmorphic */}
            <div className="absolute top-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-all duration-300">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-white/20 shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-200"
                        >
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={onViewDetails} className="cursor-pointer">
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Course
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={onDelete}
                            className="text-red-600 focus:text-red-600 cursor-pointer"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Course
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Thumbnail Section with Overlay */}
            <div className="relative h-56 overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600">
                {course.thumbnail_url ? (
                    <div className="relative h-full w-full">
                        <img
                            src={course.thumbnail_url}
                            alt={course.name}
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                            onError={(e) => {
                                e.target.style.display = 'none'
                            }}
                        />
                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    </div>
                ) : (
                    // Fallback gradient with icon for courses without thumbnail
                    <div className="relative h-full w-full flex items-center justify-center">
                        <BookOpen className="h-20 w-20 text-white/30" strokeWidth={1.5} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                    </div>
                )}

                {/* Title Overlay on Thumbnail */}
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="text-xl font-bold line-clamp-2 leading-tight drop-shadow-lg">
                            {course.name}
                        </h3>
                    </div>
                    <p className="text-xs font-mono text-white/90 font-semibold tracking-wide">
                        {course.course_code}
                    </p>
                </div>

                {/* Status Badge - Top Right on Thumbnail */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-0 transition-opacity">
                    {getStatusBadge(course.approval_status)}
                </div>
            </div>

            {/* Card Content */}
            <CardContent className="p-5 space-y-4">
                {/* Status Badge - Visible when not hovering */}
                <div className="flex items-center justify-between">
                    {getStatusBadge(course.approval_status)}
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 min-h-[3.75rem]">
                    {course.description || 'No description available'}
                </p>

                {/* Metadata Grid - Modern Layout */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/50">
                    {course.university && (
                        <div className="flex items-center gap-2 text-xs">
                            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                <GraduationCap className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground">University</p>
                                <p className="text-sm font-medium truncate">{course.university}</p>
                            </div>
                        </div>
                    )}

                    {course.category && (
                        <div className="flex items-center gap-2 text-xs">
                            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                                <BookOpen className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground">Category</p>
                                <p className="text-sm font-medium truncate">{course.category}</p>
                            </div>
                        </div>
                    )}

                    {course.duration && (
                        <div className="flex items-center gap-2 text-xs">
                            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400">
                                <Clock className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground">Duration</p>
                                <p className="text-sm font-medium truncate">{course.duration}</p>
                            </div>
                        </div>
                    )}

                    {course.credits && (
                        <div className="flex items-center gap-2 text-xs">
                            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
                                <Award className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground">Credits</p>
                                <p className="text-sm font-medium truncate">{course.credits}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Quick Actions Bar - Appears on Hover */}
                <div className="flex items-center gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                    <Button
                        onClick={onViewDetails}
                        variant="outline"
                        size="sm"
                        className="flex-1 h-9 text-xs font-medium hover:bg-blue-500 hover:text-white hover:border-blue-500 transition-all duration-200"
                    >
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        View
                    </Button>
                    <Button
                        onClick={onEdit}
                        variant="outline"
                        size="sm"
                        className="flex-1 h-9 text-xs font-medium hover:bg-purple-500 hover:text-white hover:border-purple-500 transition-all duration-200"
                    >
                        <Edit className="h-3.5 w-3.5 mr-1.5" />
                        Edit
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
