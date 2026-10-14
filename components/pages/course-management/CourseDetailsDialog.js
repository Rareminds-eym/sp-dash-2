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
    FileText,
    ChevronDown,
    File,
    Link,
    Loader2,
    AlertCircle
} from 'lucide-react'
import { useEffect, useState } from 'react'

export function CourseDetailsDialog({ course, open, onOpenChange }) {
    const [imageError, setImageError] = useState(false)
    const [modules, setModules] = useState([])
    const [resourcesLoading, setResourcesLoading] = useState(false)
    const [resourcesError, setResourcesError] = useState('')
    const [expandedModules, setExpandedModules] = useState(new Set())

    useEffect(() => {
        if (!open || !course?.id) return

        let cancelled = false
        setResourcesLoading(true)
        setResourcesError('')

        fetch(`/api/courses/${course.id}/resources`, { cache: 'no-store' })
            .then(async response => {
                const data = await response.json()
                if (!response.ok) throw new Error(data.error || 'Failed to load course resources')
                if (!cancelled) setModules(data.data || [])
            })
            .catch(error => {
                if (!cancelled) setResourcesError(error.message || 'Failed to load course resources')
            })
            .finally(() => {
                if (!cancelled) setResourcesLoading(false)
            })

        return () => { cancelled = true }
    }, [course?.id, open])

    useEffect(() => {
        if (!open) {
            setModules([])
            setResourcesError('')
            setExpandedModules(new Set())
        }
    }, [open])

    // An image failure for one course must never suppress valid images for
    // other courses/resources: reset whenever the selected course changes.
    useEffect(() => {
        setImageError(false)
    }, [course?.id, course?.thumbnail_url])

    if (!course) return null

    const toggleModule = (moduleId) => {
        setExpandedModules(previous => {
            const next = new Set(previous)
            if (next.has(moduleId)) next.delete(moduleId)
            else next.add(moduleId)
            return next
        })
    }

    const resourceTypeLabel = (type) => {
        const labels = {
            pdf: 'PDF',
            video: 'Video',
            youtube: 'YouTube',
            document: 'Document',
            image: 'Image',
            link: 'Link',
            drive: 'Google Drive',
            // Legacy stored values
            ppt: 'Presentation',
            file: 'File',
        }
        return labels[type?.toLowerCase()] || type || 'Resource'
    }

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

                    {/* Course Resources Hierarchy */}
                    <Separator />
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                <FileText className="h-4 w-4" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Course Resources</h3>
                                <p className="text-xs text-muted-foreground">Modules → lessons → source files</p>
                            </div>
                        </div>

                        {resourcesLoading && (
                            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading course resources...
                            </div>
                        )}

                        {resourcesError && (
                            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                                <AlertCircle className="h-5 w-5 shrink-0" />
                                <span>{resourcesError}</span>
                            </div>
                        )}

                        {!resourcesLoading && !resourcesError && modules.length === 0 && (
                            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-muted-foreground dark:border-slate-700">
                                No source files have been added to this course yet.
                            </div>
                        )}

                        {!resourcesLoading && !resourcesError && modules.map(module => {
                            const isExpanded = expandedModules.has(module.id)
                            const lessonCount = module.lessons.length
                            const resourceCount = module.lessons.reduce((total, lesson) => total + lesson.resources.length, 0)

                            return (
                                <div key={module.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40">
                                    <button
                                        type="button"
                                        className="flex w-full items-center gap-3 p-4 text-left"
                                        onClick={() => toggleModule(module.id)}
                                        aria-expanded={isExpanded}
                                    >
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white">
                                            {module.title?.charAt(0).toUpperCase() || 'M'}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">{module.title}</span>
                                            <span className="block text-xs text-muted-foreground">{lessonCount} lesson{lessonCount === 1 ? '' : 's'} · {resourceCount} resource{resourceCount === 1 ? '' : 's'}</span>
                                        </span>
                                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isExpanded && (
                                        <div className="space-y-3 border-t border-slate-200 px-4 py-4 dark:border-slate-700">
                                            {module.lessons.length === 0 && (
                                                <p className="text-xs text-muted-foreground">No lessons have been added to this module.</p>
                                            )}
                                            {module.lessons.map(lesson => (
                                                <div key={lesson.id} className="rounded-lg bg-white p-3 shadow-sm dark:bg-slate-900/60">
                                                    <div className="mb-2 flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900 dark:text-white">{lesson.title}</p>
                                                            {lesson.duration && <p className="text-xs text-muted-foreground">{lesson.duration}</p>}
                                                        </div>
                                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                            {lesson.resources.length} file{lesson.resources.length === 1 ? '' : 's'}
                                                        </span>
                                                    </div>

                                                    {lesson.resources.length === 0 && (
                                                        <p className="text-xs text-muted-foreground">No source files attached to this lesson.</p>
                                                    )}
                                                    <div className="space-y-2">
                                                        {lesson.resources.map(resource => {
                                                            const isExternal = /^https?:\/\//i.test(resource.url)
                                                            const href = resource.url || '#'
                                                            const isSafeUrl = isExternal || href.startsWith('/')

                                                            return (
                                                                <a
                                                                    key={resource.id}
                                                                    href={isSafeUrl ? href : '#'}
                                                                    target={isExternal ? '_blank' : undefined}
                                                                    rel={isExternal ? 'noopener noreferrer' : undefined}
                                                                    className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/60 dark:border-slate-700 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/5"
                                                                >
                                                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                                        {isExternal ? <Link className="h-4 w-4" /> : <File className="h-4 w-4" />}
                                                                    </span>
                                                                    <span className="min-w-0 flex-1">
                                                                        <span className="block truncate text-xs font-semibold text-gray-900 dark:text-white">{resource.name}</span>
                                                                        <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">{resourceTypeLabel(resource.type)}{resource.fileSize ? ` · ${resource.fileSize}` : ''}</span>
                                                                    </span>
                                                                    <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-muted-foreground" />
                                                                </a>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

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
