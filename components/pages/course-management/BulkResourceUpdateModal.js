'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { queueResourceFiles } from './queue-resource-files'
import { waitForCourseUploadJob } from '@/lib/services/course-upload-client'
import {
  Download, FileSpreadsheet, Upload, CheckCircle2, Loader2,
  ChevronLeft, ChevronRight, X, FileUp, AlertCircle
} from 'lucide-react'

const STEPS = [
  { id: 1, title: 'Export Template', icon: Download },
  { id: 2, title: 'Fill Template', icon: FileSpreadsheet },
  { id: 3, title: 'Upload Template', icon: Upload },
  { id: 4, title: 'Review & Confirm', icon: CheckCircle2 },
]

function getCourseId(course) {
  if (!course) return null
  if (typeof course === 'string') return course
  return course.id || course.course_id || null
}

export function BulkResourceUpdateModal({ open, onOpenChange, selectedCourses = [], onSuccess, initialStep = 1 }) {
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(initialStep)
  const [loading, setLoading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [previewData, setPreviewData] = useState(null)
  const [previewErrors, setPreviewErrors] = useState([])
  const submittingRef = useRef(false)
  const templateInputRef = useRef(null)
  const resourcesInputRef = useRef(null)

  const courseIds = (selectedCourses || []).map(getCourseId).filter(Boolean)

  // Reset every time the modal opens (avoids stale state + close-timeout race).
  useEffect(() => {
    if (open) {
      setCurrentStep(initialStep)
      setLoading(false)
      setUploadedFile(null)
      setUploadedFiles([])
      setPreviewData(null)
      setPreviewErrors([])
      submittingRef.current = false
    }
  }, [open, initialStep])

  const resetState = () => {
    setCurrentStep(initialStep)
    setLoading(false)
    setUploadedFile(null)
    setUploadedFiles([])
    setPreviewData(null)
    setPreviewErrors([])
    submittingRef.current = false
  }

  const handleClose = (nextOpen) => {
    // Radix passes the next open state; only act on close.
    if (nextOpen) {
      onOpenChange(true)
      return
    }
    onOpenChange(false)
  }

  const handleExportTemplate = async () => {
    if (courseIds.length === 0) {
      toast({ title: 'No courses selected', description: 'Select at least one course before exporting a new template', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/courses/bulk-resources/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseIds }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Export failed (Status ${res.status})`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `course-resources-template-${new Date().toISOString().slice(0, 10)}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
      toast({ title: 'Template exported', description: `Template for ${courseIds.length} course(s) downloaded` })
      setCurrentStep(2)
    } catch (err) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async () => {
    if (!uploadedFile) {
      toast({ title: 'No template', description: 'Choose the filled Excel template first', variant: 'destructive' })
      return
    }
    setLoading(true)
    setPreviewErrors([])
    try {
      const formData = new FormData()
      formData.append('template', uploadedFile)
      formData.append('fileNames', JSON.stringify(uploadedFiles.map((file) => file.name)))
      const res = await fetch('/api/courses/bulk-resources/preview', { method: 'POST', body: formData })
      const responseData = await res.json().catch(() => ({}))
      if (!res.ok || !responseData.success) {
        const data = responseData
        setPreviewErrors(Array.isArray(data.errors) ? data.errors : [])
        const details = data.details || data.errors?.map((error) => `Row ${error.row}: ${error.error}`).join('; ')
        throw new Error(details || data.error || `Preview failed (Status ${res.status})`)
      }
      const data = responseData.jobId
        ? await waitForCourseUploadJob(responseData.jobId, 'resource workbook preview')
        : responseData
      if (responseData.jobId) {
        toast({ title: 'Preview queued', description: 'The workbook is being parsed in the background.' })
      }
      setPreviewData({ ...data, allResources: data.resources || data.preview || [] })
      toast({ title: 'Template parsed', description: `${data.totalResources} resource(s) found across ${data.affectedCourses} course(s)` })
      setCurrentStep(4)
    } catch (err) {
      const errorMessage = err.message || 'Unknown error';
      const detailsMatch = errorMessage.match(/First 5: (.+)/);
      const details = detailsMatch ? detailsMatch[1] : errorMessage;

      toast({
        title: 'Preview failed',
        description: details.length > 200 ? details.substring(0, 200) + '...' : details,
        variant: 'destructive',
        duration: 8000
      })
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmUpload = async () => {
    if (!previewData?.previewId) return
    if (submittingRef.current) return
    submittingRef.current = true
    // Full resource list: prefer allResources captured from preview response
    const resources = previewData.allResources?.length > 0 ? previewData.allResources : previewData.preview
    setLoading(true)
    try {
      const queuedResources = await queueResourceFiles(resources, uploadedFiles)
      const formData = new FormData()
      formData.append('payload', JSON.stringify({ previewId: previewData.previewId, resources: queuedResources }))
      const res = await fetch('/api/courses/bulk-resources/process', { method: 'POST', body: formData })
      const queued = await res.json().catch(() => ({}))
      if (!res.ok || !queued.success) {
        throw new Error(queued.error || queued.details || `Processing failed (Status ${res.status})`)
      }
      const data = queued.jobId
        ? await waitForCourseUploadJob(queued.jobId, 'course resource update')
        : queued
      if (queued.jobId) {
        toast({ title: 'Resource update queued', description: 'Course resources are being updated in the background.' })
      }
      if (!data.success) throw new Error(data.error || data.details || 'Course resource update failed.')
      const parts = [`${data.processedResources} resource(s) added`]
      if (data.skippedDuplicates > 0) parts.push(`${data.skippedDuplicates} duplicate(s) skipped`)
      if (data.errors?.length) parts.push(`${data.errors.length} failed`)
      toast({
        title: 'Bulk upload complete',
        description: parts.join(', '),
        variant: data.errors?.length ? 'destructive' : 'default',
      })
      onSuccess?.(data)
      handleClose(false)
    } catch (err) {
      toast({ title: 'Processing failed', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
      submittingRef.current = false
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="p-6 space-y-4 text-center">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center mx-auto">
              <Download className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Export Template</h3>
            <p className="text-sm text-gray-500">
              {courseIds.length > 0
                ? `Download an Excel template pre-filled with all modules and lessons from ${courseIds.length} selected course(s).`
                : 'Import a previously exported Excel template. Its course, module, and lesson IDs are used directly.'}
              Each row represents one lesson. Duplicate rows to add multiple resources to the same lesson.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={handleExportTemplate} disabled={loading || courseIds.length === 0} className="min-w-[200px]">
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Exporting...</> : <><Download className="h-4 w-4 mr-2" /> Export Template</>}
              </Button>
              <Button variant="outline" onClick={() => setCurrentStep(3)} className="min-w-[200px]">
                <Upload className="h-4 w-4 mr-2" /> Import Filled Template
              </Button>
            </div>
            {courseIds.length === 0 && <p className="text-xs text-amber-600">No courses need to be selected when importing an exported template.</p>}
          </div>
        )
      case 2:
        return (
          <div className="p-6 space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center mx-auto mb-3">
                <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Fill Template Offline</h3>
              <p className="text-sm text-gray-500 mt-1">Open the downloaded Excel file and add resource details</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl text-sm text-gray-600 dark:text-gray-400 space-y-1.5">
              <p><strong>1.</strong> DO NOT modify course_id, module_id, lesson_id columns</p>
              <p><strong>2.</strong> Each row = one lesson. To add MULTIPLE resources to one lesson, duplicate that row</p>
              <p><strong>3.</strong> Fill resource_name and resource_type (pdf, video, youtube, document, image, link, drive)</p>
              <p><strong>4.</strong> For file uploads: enter the exact file name in file_path</p>
              <p><strong>5.</strong> For URLs: enter the complete URL in resource_url</p>
              <p><strong>6.</strong> Delete rows for lessons that don't need resources</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 pt-1">💡 Tip: You can add 10 PDFs to one lesson by duplicating that lesson's row 10 times</p>
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>Back</Button>
              <Button onClick={() => setCurrentStep(3)}>Continue to Upload <ChevronRight className="h-4 w-4 ml-1" /></Button>
            </div>
          </div>
        )
      case 3:
        return (
          <div className="p-6 space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Upload className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Upload Template</h3>
              <p className="text-sm text-gray-500 mt-1">Upload the filled template plus any resource files</p>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Filled Excel Template *</p>
                <div className="flex items-center gap-2">
                  <input ref={templateInputRef} type="file" accept=".xlsx,.xls" className="hidden"
                    onChange={(e) => setUploadedFile(e.target.files?.[0] || null)} />
                  <Button type="button" variant="outline" size="sm" onClick={() => templateInputRef.current?.click()}>
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> {uploadedFile ? 'Change File' : 'Choose Template'}
                  </Button>
                  {uploadedFile && <span className="text-xs text-gray-600 truncate">{uploadedFile.name}</span>}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Resource Files <span className="text-gray-500 dark:text-gray-400">(optional; only needed for file_path rows)</span>
                </p>
                <div className="flex items-center gap-2">
                  <input ref={resourcesInputRef} type="file" multiple className="hidden"
                    onChange={(e) => setUploadedFiles(Array.from(e.target.files || []))} />
                  <Button type="button" variant="outline" size="sm" onClick={() => resourcesInputRef.current?.click()}>
                    <FileUp className="h-3.5 w-3.5 mr-1.5" /> {uploadedFiles.length > 0 ? `Change Files (${uploadedFiles.length})` : 'Choose Files'}
                  </Button>
                  {uploadedFiles.length > 0 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setUploadedFiles([])} className="text-xs">
                      <X className="h-3 w-3 mr-1" /> Clear
                    </Button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  Leave this empty for rows that use resource_url. Select files only when file_path is used for binary uploads.
                </p>
                {uploadedFiles.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {uploadedFiles.slice(0, 10).map((f) => <Badge key={`${f.name}-${f.size}-${f.lastModified}`} variant="outline" className="text-xs">{f.name}</Badge>)}
                    {uploadedFiles.length > 10 && <Badge variant="secondary" className="text-xs">+{uploadedFiles.length - 10} more</Badge>}
                  </div>
                )}
                {previewErrors.length > 0 && (
                  <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-xs font-medium text-red-700 dark:text-red-300 flex items-center gap-1 mb-1">
                      <AlertCircle className="h-3.5 w-3.5" /> {previewErrors.length} row(s) need attention
                    </p>
                    <div className="space-y-0.5 max-h-32 overflow-y-auto">
                      {previewErrors.slice(0, 20).map((e, i) => (
                        <p key={`${e.row}-${i}`} className="text-xs text-red-600">Row {e.row}: {e.error}</p>
                      ))}
                      {previewErrors.length > 20 && (
                        <p className="text-xs text-red-500">+{previewErrors.length - 20} more...</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>Back</Button>
              <Button onClick={handleFileUpload} disabled={loading || !uploadedFile} className="min-w-[160px]">
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Parsing...</> : <>Preview <ChevronRight className="h-4 w-4 ml-1" /></>}
              </Button>
            </div>
          </div>
        )
      case 4:
        return (
          <div className="p-6 space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Review & Confirm</h3>
              <p className="text-sm text-gray-500 mt-1">Verify the parsed resources before processing</p>
            </div>
            {previewData ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-center">
                    <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300">{previewData.affectedCourses}</p>
                    <p className="text-xs text-indigo-600">Courses</p>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                    <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{previewData.totalResources}</p>
                    <p className="text-xs text-blue-600">Resources</p>
                  </div>
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-center">
                    <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{previewData.filesToUpload}</p>
                    <p className="text-xs text-purple-600">Files to upload</p>
                  </div>
                </div>
                <ScrollArea className="max-h-48">
                  <div className="space-y-1">
                    {(previewData.preview || []).map((r, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-md border border-gray-200 dark:border-gray-700 text-xs">
                        <Badge variant="outline" className="shrink-0">{r.resource_type}</Badge>
                        <span className="truncate flex-1 text-gray-700 dark:text-gray-300">{r.resource_name}</span>
                        <span className="text-gray-400 truncate max-w-[140px]">{r.lesson_title || r.lesson_id.slice(0, 8)}</span>
                      </div>
                    ))}
                    {previewData.totalResources > (previewData.preview || []).length && (
                      <p className="text-xs text-gray-400 text-center">+{previewData.totalResources - previewData.preview.length} more...</p>
                    )}
                  </div>
                </ScrollArea>
                {previewData.errors?.length > 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1 mb-1">
                      <AlertCircle className="h-3.5 w-3.5" /> {previewData.errors.length} row(s) skipped
                    </p>
                    <div className="space-y-0.5 max-h-20 overflow-y-auto">
                      {previewData.errors.slice(0, 10).map((e, i) => (
                        <p key={i} className="text-xs text-amber-600">Row {e.row}: {e.error}</p>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500 text-center">No preview data. Go back and upload a template.</p>
            )}
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(3)}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
              <Button onClick={handleConfirmUpload} disabled={loading || !previewData} className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white min-w-[160px]">
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</> : <><CheckCircle2 className="h-4 w-4 mr-2" /> Confirm & Process</>}
              </Button>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Bulk Add Resources</DialogTitle>
        <DialogDescription className="sr-only">4-step wizard to bulk upload course resources via Excel template</DialogDescription>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <FileUp className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-900 dark:text-white">Bulk Add Resources</h1>
            <p className="text-xs text-gray-500">{courseIds.length} course(s) selected • Step {currentStep} of 4</p>
          </div>
        </div>
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon
              const isActive = currentStep === step.id
              const isCompleted = currentStep > step.id
              return (
                <div key={step.id} className={`flex items-center ${index < STEPS.length - 1 ? 'flex-1' : ''}`}>
                  <button onClick={() => step.id < currentStep && setCurrentStep(step.id)} className="flex items-center gap-1.5 shrink-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                      isCompleted || isActive ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-400 border-2 border-gray-300 dark:border-gray-600'
                    }`}>
                      {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : <StepIcon className="h-3.5 w-3.5" />}
                    </div>
                    <span className={`text-xs font-medium whitespace-nowrap hidden sm:inline ${isActive || isCompleted ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>{step.title}</span>
                  </button>
                  {index < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-2 min-w-[10px] ${isCompleted ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`} />}
                </div>
              )
            })}
          </div>
        </div>
        <ScrollArea className="max-h-[calc(90vh-260px)]">
          {renderStepContent()}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
