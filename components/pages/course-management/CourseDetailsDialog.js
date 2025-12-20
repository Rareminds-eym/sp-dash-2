import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
    Clock, 
    BookOpen, 
    Calendar, 
    Award, 
    User, 
    Building2,
    Target,
    FileText
} from 'lucide-react'
import { useState } from 'react'

export function CourseDetailsDialog({ course, open, onOpenChange }) {
    const [imageError, setImageError] = useState(false)

    if (!course) return null

    const getStatusConfig = (status) => {
        const configs = {
            'approved': { 
                bg: 'bg-emerald-500/10', 
                text: 'text-emerald-700 dark:text-emerald-400', 
                border: 'border-emerald-500/30',
                dot: 'bg-emerald-500'
            },
            'pending': { 
                bg: 'bg-amber-500/10', 
                text: 'text-amber-700 dark:text-amber-400', 
                border: 'border-amber-500/30',
                dot: 'bg-amber-500'
            },
            'rejected': { 
                bg: 'bg-red-500/10', 
                text: 'text-red-700 dark:text-red-400', 
                border: 'border-red-500/30',
                dot: 'bg-red-500'
            },
            'Draft': { 
                bg: 'bg-slate-500/10', 
                text: 'text-slate-700 dark:text-slate-400', 
                border: 'border-slate-500/30',
                dot: 'bg-slate-500'
            },
        }
        return configs[status] || configs['pending']
    }

    const statusConfig = getStatusConfig(course.approval_status)

    const InfoCard = ({ icon: Icon, label, value, color = 'blue' }) => {
        const colorClasses = {
            blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
            purple: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400',
            green: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
            amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
            slate: 'bg-slate-50 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400',
        }
        
        return (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700/50">
                <div className={`flex items-center justify-center h-10 w-10 rounded-lg ${colorClasses[color]}`}>
                    <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{value || '—'}</p>
                </div>
            </div>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0 gap-0 [&>button[class]]:absolute [&>button[class]]:right-4 [&>button[class]]:top-4 [&>button[class]]:z-50 [&>button[class]]:h-8 [&>button[class]]:w-8 [&>button[class]]:rounded-full [&>button[class]]:bg-black/50 [&>button[class]]:backdrop-blur-sm [&>button[class]]:text-white [&>button[class]]:opacity-100 [&>button[class]]:hover:bg-black/70 [&>button[class]]:flex [&>button[class]]:items-center [&>button[class]]:justify-center [&>button[class]]:transition-colors">
                {/* Accessible title and description for screen readers */}
                <DialogTitle className="sr-only">{course.name}</DialogTitle>
                <DialogDescription className="sr-only">
                    Course details for {course.name}. Code: {course.course_code}. {course.description?.slice(0, 100)}
                </DialogDescription>

                {/* Header with Thumbnail */}
                <div className="relative">
                    {/* Thumbnail */}
                    <div className="h-48 w-full overflow-hidden">
                        {course.thumbnail_url && !imageError ? (
                            <>
                                <img
                                    src={course.thumbnail_url}
                                    alt={course.name}
                                    className="w-full h-full object-cover"
                                    onError={() => setImageError(true)}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
                            </>
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center">
                                <BookOpen className="h-20 w-20 text-white/20" strokeWidth={1} />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            </div>
                        )}
                    </div>

                    {/* Title Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-white/20 backdrop-blur-sm text-white text-xs font-mono font-semibold">
                                        {course.course_code}
                                    </span>
                                    <Badge 
                                        variant="outline" 
                                        className={`${statusConfig.bg} ${statusConfig.text} border-white/20 backdrop-blur-sm`}
                                    >
                                        <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot} mr-1.5`} />
                                        {course.approval_status}
                                    </Badge>
                                </div>
                                <h2 className="text-2xl font-bold leading-tight line-clamp-2">
                                    {course.name}
                                </h2>
                                {course.university && (
                                    <div className="flex items-center gap-1.5 mt-2 text-white/80 text-sm">
                                        <Building2 className="h-4 w-4" />
                                        <span>{course.university}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="overflow-y-auto max-h-[calc(90vh-12rem)] p-6 space-y-6">
                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <InfoCard icon={Clock} label="Duration" value={course.duration} color="blue" />
                        <InfoCard icon={Award} label="Credits" value={course.credits ? `${course.credits} Credits` : null} color="amber" />
                        <InfoCard icon={BookOpen} label="Category" value={course.category} color="purple" />
                        <InfoCard icon={Calendar} label="Created" value={course.created_at ? new Date(course.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null} color="slate" />
                    </div>

                    {/* Educator Info */}
                    {course.educator_name && (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
                            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-500 text-white">
                                <User className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Instructor</p>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{course.educator_name}</p>
                            </div>
                        </div>
                    )}

                    <Separator />

                    {/* Description Section */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                <FileText className="h-4 w-4" />
                            </div>
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Course Description</h3>
                        </div>
                        <div className="pl-10">
                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                {course.description || 'No description available for this course.'}
                            </p>
                        </div>
                    </div>

                    {/* Learning Outcomes Section */}
                    {course.target_outcomes && (
                        <>
                            <Separator />
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                        <Target className="h-4 w-4" />
                                    </div>
                                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">Learning Outcomes</h3>
                                </div>
                                <div className="pl-10">
                                    <div className="space-y-2">
                                        {(Array.isArray(course.target_outcomes)
                                            ? course.target_outcomes
                                            : course.target_outcomes?.split('\n').filter(o => o.trim())
                                        )?.map((outcome, index) => (
                                            <div 
                                                key={index} 
                                                className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10"
                                            >
                                                <div className="flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500 text-white text-xs font-semibold shrink-0 mt-0.5">
                                                    {index + 1}
                                                </div>
                                                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                                    {outcome}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Metadata Footer */}
                    {course.updated_at && (
                        <>
                            <Separator />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Last updated: {new Date(course.updated_at).toLocaleDateString('en-US', { 
                                    month: 'long', 
                                    day: 'numeric', 
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}</span>
                                {course.id && (
                                    <span className="font-mono text-[10px] bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded">
                                        ID: {course.id.slice(0, 8)}...
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
