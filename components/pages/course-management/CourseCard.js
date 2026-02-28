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
import { GraduationCap, MoreVertical, Eye, Edit, Trash2, Clock, Award, BookOpen, User, Calendar } from 'lucide-react'
import { useState } from 'react'

export function CourseCard({ course, selected, onSelect, onEdit, onDelete, onViewDetails }) {
    const [imageError, setImageError] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)

    const getStatusConfig = (status) => {
        const configs = {
            'approved': { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20' },
            'pending': { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20' },
            'rejected': { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/20' },
            'Draft': { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/20' },
        }
        return configs[status] || configs['pending']
    }

    const statusConfig = getStatusConfig(course.approval_status)

    const handleCardClick = (e) => {
        // Don't trigger if menu is open or clicking on interactive elements
        if (menuOpen || e.target.closest('[data-no-card-click]') || e.target.closest('button') || e.target.closest('[role="checkbox"]') || e.target.closest('[role="menuitem"]')) {
            return
        }
        onViewDetails()
    }

    return (
        <Card 
            onClick={handleCardClick}
            className={`group relative overflow-hidden transition-all duration-300 hover:shadow-xl border-0 bg-white dark:bg-slate-900 cursor-pointer ${selected
                ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20'
                : 'shadow-sm hover:shadow-lg'
            }`}
        >
            {/* Selection Checkbox */}
            <div className="absolute top-3 left-3 z-20" data-no-card-click>
                <Checkbox
                    checked={selected}
                    onCheckedChange={onSelect}
                    className="h-5 w-5 rounded-md border-2 border-white/90 bg-white/95 backdrop-blur-sm shadow-md data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 transition-all"
                />
            </div>

            {/* Actions Menu */}
            <div className="absolute top-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200" data-no-card-click>
                <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm shadow-md hover:shadow-lg transition-all"
                            aria-label="Course actions"
                        >
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem 
                            onClick={(e) => {
                                e.stopPropagation()
                                onViewDetails()
                            }} 
                            className="cursor-pointer"
                        >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                            onClick={(e) => {
                                e.stopPropagation()
                                onEdit()
                            }} 
                            className="cursor-pointer"
                        >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                            onClick={(e) => {
                                e.stopPropagation()
                                onDelete()
                            }} 
                            className="text-red-600 focus:text-red-600 cursor-pointer"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Thumbnail */}
            <div className="relative h-44 overflow-hidden">
                {course.thumbnail_url && !imageError ? (
                    <>
                        <img
                            src={course.thumbnail_url}
                            alt={course.name}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            onError={() => setImageError(true)}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    </>
                ) : (
                    <div className="h-full w-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
                        <BookOpen className="h-16 w-16 text-white/30" strokeWidth={1.5} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    </div>
                )}

                {/* Course Code Badge on Thumbnail */}
                <div className="absolute bottom-3 left-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-sm text-white text-xs font-mono font-medium">
                        {course.course_code}
                    </span>
                </div>
            </div>

            {/* Content */}
            <CardContent className="p-4 space-y-3">
                {/* Header: Title + Status */}
                <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug flex-1">
                            {course.name}
                        </h3>
                        <Badge 
                            variant="outline" 
                            className={`shrink-0 text-[10px] font-medium px-2 py-0.5 ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                        >
                            {course.approval_status}
                        </Badge>
                    </div>
                    
                    {/* University */}
                    {course.university && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <GraduationCap className="h-3.5 w-3.5" />
                            <span className="truncate">{course.university}</span>
                        </div>
                    )}
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                    {course.description || 'No description available'}
                </p>

                {/* Metadata Pills */}
                <div className="flex flex-wrap gap-2 pt-1">
                    {course.category && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-medium">
                            <BookOpen className="h-3 w-3" />
                            {course.category}
                        </span>
                    )}
                    {course.duration && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium">
                            <Clock className="h-3 w-3" />
                            {course.duration}
                        </span>
                    )}
                    {course.credits && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium">
                            <Award className="h-3 w-3" />
                            {course.credits} Credits
                        </span>
                    )}
                </div>

                {/* Footer: Educator + Date */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-800">
                    {course.educator_name ? (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                            <span className="truncate max-w-[120px]">{course.educator_name}</span>
                        </div>
                    ) : (
                        <div />
                    )}
                    {course.created_at && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(course.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
