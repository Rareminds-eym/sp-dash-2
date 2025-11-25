import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { GraduationCap, Clock, BookOpen, Calendar, CheckCircle2 } from 'lucide-react'

export function CourseDetailsDialog({ course, open, onOpenChange }) {
    if (!course) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                {course && (
                    <>
                        <DialogHeader>
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                        {course.name}
                                    </DialogTitle>
                                    <DialogDescription className="mt-1 flex items-center gap-2">
                                        <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs">
                                            {course.course_code}
                                        </span>
                                        <span>•</span>
                                        <span>{course.university}</span>
                                    </DialogDescription>
                                </div>
                                <Badge variant={course.approval_status === 'approved' ? 'default' : 'secondary'}>
                                    {course.approval_status}
                                </Badge>
                            </div>
                        </DialogHeader>

                        <div className="space-y-6 mt-4">
                            {/* Thumbnail */}
                            {course.thumbnail_url && (
                                <div className="w-full h-64 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                                    <img
                                        src={course.thumbnail_url}
                                        alt={course.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            )}

                            {/* Key Info Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                        <Clock className="h-4 w-4" />
                                        <span className="text-xs font-medium uppercase">Duration</span>
                                    </div>
                                    <p className="font-semibold">{course.duration}</p>
                                </div>
                                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                        <BookOpen className="h-4 w-4" />
                                        <span className="text-xs font-medium uppercase">Credits</span>
                                    </div>
                                    <p className="font-semibold">{course.credits} Credits</p>
                                </div>
                                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                        <GraduationCap className="h-4 w-4" />
                                        <span className="text-xs font-medium uppercase">Category</span>
                                    </div>
                                    <p className="font-semibold">{course.category}</p>
                                </div>
                                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                        <Calendar className="h-4 w-4" />
                                        <span className="text-xs font-medium uppercase">Created</span>
                                    </div>
                                    <p className="font-semibold">
                                        {new Date(course.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="space-y-3">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <BookOpen className="h-5 w-5 text-blue-500" />
                                    Course Description
                                </h3>
                                <div className="prose dark:prose-invert max-w-none text-muted-foreground">
                                    <p className="whitespace-pre-wrap leading-relaxed">
                                        {course.description}
                                    </p>
                                </div>
                            </div>

                            {/* Target Outcomes */}
                            <div className="space-y-3">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    Learning Outcomes
                                </h3>
                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                                    <ul className="space-y-3">
                                        {Array.isArray(course.target_outcomes)
                                            ? course.target_outcomes.map((outcome, index) => (
                                                <li key={index} className="flex items-start gap-3 text-muted-foreground">
                                                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                                                    <span>{outcome}</span>
                                                </li>
                                            ))
                                            : course.target_outcomes?.split('\n').map((outcome, index) => (
                                                <li key={index} className="flex items-start gap-3 text-muted-foreground">
                                                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                                                    <span>{outcome}</span>
                                                </li>
                                            ))
                                        }
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
