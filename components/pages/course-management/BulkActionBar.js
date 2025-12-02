import { Button } from '@/components/ui/button'
import { Loader2, Trash2, X } from 'lucide-react'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export function BulkActionBar({ selectedCount, onClearSelection, onDelete, isDeleting, totalCourses, onSelectAll }) {
    if (selectedCount === 0) return null

    return (
        <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white py-3 px-6 shadow-lg">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <span className="font-semibold">{selectedCount} course(s) selected</span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearSelection}
                        className="text-white hover:bg-blue-700"
                    >
                        <X className="h-4 w-4 mr-2" />
                        Clear Selection
                    </Button>
                    {totalCourses > selectedCount && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onSelectAll}
                            className="text-white hover:bg-blue-700"
                        >
                            Select All ({totalCourses})
                        </Button>
                    )}
                </div>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button
                            variant="destructive"
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Selected
                                </>
                            )}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete {selectedCount} course(s)?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the selected courses.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={onDelete}
                                className="bg-red-600 hover:bg-red-700"
                            >
                                Delete {selectedCount} Course(s)
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    )
}