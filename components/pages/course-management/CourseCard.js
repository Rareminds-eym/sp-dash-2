import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { GraduationCap, MoreVertical, Eye, Edit, Trash2 } from 'lucide-react'

export function CourseCard({ course, selected, onSelect, onEdit, onDelete, onViewDetails, getStatusBadge }) {
    return (
        <Card className={`group hover:shadow-lg transition-all duration-300 border-white/20 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 backdrop-blur-xl relative ${selected ? 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/20' : ''}`}>
            <div className="absolute top-4 left-4 z-10">
                <Checkbox
                    checked={selected}
                    onCheckedChange={onSelect}
                    className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                />
            </div>
            <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={onViewDetails}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onEdit}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Course
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={onDelete}
                            className="text-red-600 focus:text-red-600"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Course
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

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
                <div className="flex items-start justify-between gap-2 pr-8 pl-8">
                    <CardTitle className="text-lg line-clamp-2">{course.name}</CardTitle>
                    {getStatusBadge(course.approval_status)}
                </div>
                <CardDescription className="font-mono text-xs pl-8">
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
    )
}
