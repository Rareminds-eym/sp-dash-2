'use client'

import { useState, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  X, Plus, Check, ChevronLeft, ChevronRight, Upload, Image as ImageIcon,
  BookOpen, Loader2, Trash2, Target, Layers, GraduationCap, Clock, Hash, 
  Building2, CheckCircle2, PlayCircle, Briefcase, Globe, Palette, Search, BookMarked
} from 'lucide-react'
import { 
  SKILL_CATEGORIES, 
  CLASSES, 
  THIRD_PARTY_PLATFORMS,
  uploadCourseImage,
  createCourse,
  updateCourse
} from '@/lib/services/coursesService'

const STEPS = [
  { id: 0, title: 'Course Source' },
  { id: 1, title: 'Basic Info' },
  { id: 2, title: 'Skill Mapping' },
  { id: 3, title: 'Course Structure' },
  { id: 4, title: 'Confirmation' }
]

export function CreateCourseModal({
  open,
  onOpenChange,
  editingCourse = null,
  onSuccess,
  currentUser,
  universities = [],
  schoolId = null
}) {
  const [currentStep, setCurrentStep] = useState(editingCourse ? 1 : 0)
  const [courseSource, setCourseSource] = useState(editingCourse ? 'create' : null)
  const [importPlatform, setImportPlatform] = useState('')
  const [importUrl, setImportUrl] = useState('')
  
  const [courseData, setCourseData] = useState({
    title: '', code: '', description: '', duration: '', thumbnail: '',
    status: 'Draft', university: '', category: '', credits: '',
    skillsCovered: [], targetOutcomes: [''], linkedClasses: [], modules: []
  })

  const [newModule, setNewModule] = useState({ title: '', description: '', skillTags: [] })
  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [errors, setErrors] = useState({})
  const fileInputRef = useRef(null)

  // Initialize form when editing
  useEffect(() => {
    if (editingCourse && open) {
      setCourseData({
        title: editingCourse.name || '',
        code: editingCourse.course_code || '',
        description: editingCourse.description || '',
        duration: editingCourse.duration || '',
        thumbnail: editingCourse.thumbnail_url || '',
        status: editingCourse.status || 'Draft',
        university: editingCourse.university || '',
        category: editingCourse.category || '',
        credits: editingCourse.credits?.toString() || '',
        skillsCovered: [],
        targetOutcomes: editingCourse.target_outcomes 
          ? (Array.isArray(editingCourse.target_outcomes) ? editingCourse.target_outcomes : [editingCourse.target_outcomes])
          : [''],
        linkedClasses: [],
        modules: []
      })
      setCurrentStep(1)
      setCourseSource('create')
    }
  }, [editingCourse, open])

  const resetForm = () => {
    setCurrentStep(editingCourse ? 1 : 0)
    setCourseSource(editingCourse ? 'create' : null)
    setImportPlatform('')
    setImportUrl('')
    setCourseData({
      title: '', code: '', description: '', duration: '', thumbnail: '',
      status: 'Draft', university: '', category: '', credits: '',
      skillsCovered: [], targetOutcomes: [''], linkedClasses: [], modules: []
    })
    setNewModule({ title: '', description: '', skillTags: [] })
    setErrors({})
  }

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      // Small delay to let close animation complete before resetting
      const timer = setTimeout(resetForm, 200)
      return () => clearTimeout(timer)
    }
  }, [open])

  const handleClose = () => onOpenChange(false)

  const canProceed = () => {
    switch (currentStep) {
      case 0: return courseSource !== null && (courseSource === 'create' || importPlatform !== '')
      case 1: return courseData.title && courseData.code && courseData.description && courseData.duration
      case 2: return courseData.skillsCovered.length > 0
      default: return true
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    try {
      const result = await uploadCourseImage(file)
      if (result.success) setCourseData(prev => ({ ...prev, thumbnail: result.url }))
      else setErrors(prev => ({ ...prev, thumbnail: result.error }))
    } catch { setErrors(prev => ({ ...prev, thumbnail: 'Failed to upload' })) }
    finally { setUploadingImage(false) }
  }

  const toggleSkill = (skill) => setCourseData(prev => ({
    ...prev,
    skillsCovered: prev.skillsCovered.includes(skill)
      ? prev.skillsCovered.filter(s => s !== skill) : [...prev.skillsCovered, skill]
  }))

  const toggleClass = (cls) => setCourseData(prev => ({
    ...prev,
    linkedClasses: prev.linkedClasses.includes(cls)
      ? prev.linkedClasses.filter(c => c !== cls) : [...prev.linkedClasses, cls]
  }))

  const addOutcome = () => setCourseData(prev => ({ ...prev, targetOutcomes: [...prev.targetOutcomes, ''] }))
  const updateOutcome = (i, v) => setCourseData(prev => ({ ...prev, targetOutcomes: prev.targetOutcomes.map((o, idx) => idx === i ? v : o) }))
  const removeOutcome = (i) => courseData.targetOutcomes.length > 1 && setCourseData(prev => ({ ...prev, targetOutcomes: prev.targetOutcomes.filter((_, idx) => idx !== i) }))

  const addModule = () => {
    if (!newModule.title) return
    setCourseData(prev => ({ ...prev, modules: [...prev.modules, { ...newModule, id: Date.now().toString() }] }))
    setNewModule({ title: '', description: '', skillTags: [] })
  }

  const removeModule = (i) => setCourseData(prev => ({ ...prev, modules: prev.modules.filter((_, idx) => idx !== i) }))
  const toggleModuleSkill = (skill) => setNewModule(prev => ({
    ...prev, skillTags: prev.skillTags.includes(skill) ? prev.skillTags.filter(s => s !== skill) : [...prev.skillTags, skill]
  }))

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const educatorId = currentUser?.user?.id
      const educatorName = currentUser?.user?.user_metadata?.name || currentUser?.user?.email || ''
      const payload = { ...courseData, targetOutcomes: courseData.targetOutcomes.filter(o => o.trim()), credits: courseData.credits ? Number(courseData.credits) : null }
      
      if (editingCourse) await updateCourse(editingCourse.id, payload, educatorId)
      else await createCourse(payload, educatorId, educatorName, schoolId)
      
      onSuccess?.()
      handleClose()
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to save course' })
    } finally { setLoading(false) }
  }

  const goNext = () => canProceed() && setCurrentStep(prev => currentStep === 2 && courseSource === 'import' ? 4 : Math.min(prev + 1, 4))
  const goBack = () => setCurrentStep(prev => currentStep === 4 && courseSource === 'import' ? 2 : Math.max(prev - 1, editingCourse ? 1 : 0))

  const visibleSteps = editingCourse ? STEPS.slice(1) : STEPS

  // Step 0: Source Selection
  const renderSourceStep = () => (
    <div className="p-6">
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <GraduationCap className="h-7 w-7 text-white" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">How would you like to start?</h2>
        <p className="text-gray-500 mt-1">Choose your preferred method to create a course</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <button
          onClick={() => { setCourseSource('create'); setImportPlatform('') }}
          className={`group relative p-5 rounded-xl border-2 transition-all text-left ${
            courseSource === 'create'
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-md'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 hover:shadow-sm'
          }`}
        >
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-colors ${
            courseSource === 'create' ? 'bg-indigo-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 group-hover:bg-gray-200'
          }`}>
            <Plus className="h-5 w-5" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Create from Scratch</h3>
          <p className="text-sm text-gray-500 mt-1">Build a custom course with full control</p>
          {courseSource === 'create' && (
            <div className="absolute top-3 right-3 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
              <Check className="h-3 w-3 text-white" />
            </div>
          )}
        </button>

        <button
          onClick={() => setCourseSource('import')}
          className={`group relative p-5 rounded-xl border-2 transition-all text-left ${
            courseSource === 'import'
              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-md'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 hover:shadow-sm'
          }`}
        >
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-colors ${
            courseSource === 'import' ? 'bg-purple-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 group-hover:bg-gray-200'
          }`}>
            <Upload className="h-5 w-5" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Import Course</h3>
          <p className="text-sm text-gray-500 mt-1">Import from external learning platforms</p>
          {courseSource === 'import' && (
            <div className="absolute top-3 right-3 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
              <Check className="h-3 w-3 text-white" />
            </div>
          )}
        </button>
      </div>

      {courseSource === 'import' && (
        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <Label className="text-sm font-medium">Select Platform</Label>
          <div className="grid grid-cols-4 gap-2">
            {THIRD_PARTY_PLATFORMS.map(p => {
              const platformConfig = {
                udemy: { icon: BookMarked, bgColor: 'bg-purple-600' },
                coursera: { icon: GraduationCap, bgColor: 'bg-blue-600' },
                edx: { icon: BookOpen, bgColor: 'bg-red-600' },
                linkedin: { icon: Briefcase, bgColor: 'bg-blue-700' },
                skillshare: { icon: Palette, bgColor: 'bg-emerald-600' },
                google: { icon: Search, bgColor: 'bg-red-500' },
                youtube: { icon: PlayCircle, bgColor: 'bg-red-600' },
                other: { icon: Globe, bgColor: 'bg-gray-600' }
              }[p.id] || { icon: Globe, bgColor: 'bg-gray-600' }
              
              const PlatformIcon = platformConfig.icon
              
              return (
                <button
                  key={p.id}
                  onClick={() => setImportPlatform(p.id)}
                  className={`p-3 rounded-lg border transition-all flex flex-col items-center gap-1.5 ${
                    importPlatform === p.id ? 'border-indigo-500 bg-white dark:bg-gray-800 shadow-sm' : 'border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${platformConfig.bgColor}`}>
                    <PlatformIcon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{p.name}</span>
                </button>
              )
            })}
          </div>
          {importPlatform && (
            <div className="pt-2">
              <Label htmlFor="importUrl" className="text-sm">Course URL</Label>
              <Input id="importUrl" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="https://..." className="mt-1.5" />
            </div>
          )}
        </div>
      )}
    </div>
  )

  // Step 1: Basic Information
  const renderBasicInfoStep = () => (
    <div className="p-6 space-y-6">
      {/* Section: Course Identity */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
          <BookOpen className="h-4 w-4 text-indigo-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Course Identity</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="title" className="text-sm">Course Title <span className="text-red-500">*</span></Label>
            <Input id="title" value={courseData.title} onChange={(e) => setCourseData(prev => ({ ...prev, title: e.target.value }))} placeholder="e.g., Introduction to Data Science" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="code" className="text-sm">Code <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input id="code" value={courseData.code} onChange={(e) => setCourseData(prev => ({ ...prev, code: e.target.value }))} placeholder="CS301" className="pl-9" />
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-sm">Description <span className="text-red-500">*</span></Label>
          <Textarea id="description" value={courseData.description} onChange={(e) => setCourseData(prev => ({ ...prev, description: e.target.value }))} placeholder="Provide a comprehensive description..." rows={3} />
        </div>
      </div>

      {/* Section: Course Settings */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
          <Layers className="h-4 w-4 text-indigo-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Course Settings</h3>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="duration" className="text-sm">Duration <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input id="duration" value={courseData.duration} onChange={(e) => setCourseData(prev => ({ ...prev, duration: e.target.value }))} placeholder="12 weeks" className="pl-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Status</Label>
            <Select value={courseData.status} onValueChange={(v) => setCourseData(prev => ({ ...prev, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Draft', 'Active', 'Upcoming', 'Archived'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">University</Label>
            <Select value={courseData.university} onValueChange={(v) => setCourseData(prev => ({ ...prev, university: v }))}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                {universities.map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="credits" className="text-sm">Credits</Label>
            <Input id="credits" type="number" min="0" step="0.5" value={courseData.credits} onChange={(e) => setCourseData(prev => ({ ...prev, credits: e.target.value }))} placeholder="3" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="category" className="text-sm">Category / Department</Label>
          <Input id="category" value={courseData.category} onChange={(e) => setCourseData(prev => ({ ...prev, category: e.target.value }))} placeholder="e.g., Computer Science, Business" />
        </div>
      </div>

      {/* Section: Media & Outcomes */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            <ImageIcon className="h-4 w-4 text-indigo-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Thumbnail</h3>
          </div>
          <div onClick={() => fileInputRef.current?.click()} className="relative h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-all overflow-hidden group">
            {courseData.thumbnail ? (
              <img src={courseData.thumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
            ) : uploadingImage ? (
              <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
            ) : (
              <>
                <Upload className="h-6 w-6 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                <span className="text-xs text-gray-500 mt-1.5">Click to upload</span>
                <span className="text-xs text-gray-400">PNG, JPG up to 5MB</span>
              </>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            <Target className="h-4 w-4 text-indigo-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Learning Outcomes</h3>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {courseData.targetOutcomes.map((o, i) => (
              <div key={i} className="flex gap-2">
                <Input value={o} onChange={(e) => updateOutcome(i, e.target.value)} placeholder={`Outcome ${i + 1}`} className="text-sm" />
                {courseData.targetOutcomes.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeOutcome(i)} className="shrink-0 h-9 w-9">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addOutcome} className="w-full">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Outcome
          </Button>
        </div>
      </div>
    </div>
  )

  // Step 2: Skill Mapping
  const renderSkillMappingStep = () => (
    <div className="p-6 space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
          <Target className="h-4 w-4 text-indigo-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Skill Categories</h3>
          <span className="text-xs text-gray-500 ml-auto">{courseData.skillsCovered.length} selected</span>
        </div>
        <p className="text-sm text-gray-500">Select the skills this course will help students develop</p>
        <div className="grid grid-cols-4 gap-2">
          {SKILL_CATEGORIES.map(skill => (
            <button
              key={skill}
              onClick={() => toggleSkill(skill)}
              className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                courseData.skillsCovered.includes(skill)
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 shadow-sm'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {courseData.skillsCovered.includes(skill) && <Check className="h-3.5 w-3.5" />}
              {skill}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
          <Building2 className="h-4 w-4 text-emerald-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Assign to Classes</h3>
          <span className="text-xs text-gray-500 ml-auto">{courseData.linkedClasses.length} selected</span>
        </div>
        <p className="text-sm text-gray-500">Choose which classes will have access to this course</p>
        <div className="grid grid-cols-4 gap-2">
          {CLASSES.map(cls => (
            <label
              key={cls}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                courseData.linkedClasses.includes(cls)
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 shadow-sm'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                courseData.linkedClasses.includes(cls) ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300 dark:border-gray-600'
              }`}>
                {courseData.linkedClasses.includes(cls) && <Check className="h-2.5 w-2.5 text-white" />}
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{cls}</span>
              <input type="checkbox" checked={courseData.linkedClasses.includes(cls)} onChange={() => toggleClass(cls)} className="sr-only" />
            </label>
          ))}
        </div>
      </div>
    </div>
  )

  // Step 3: Course Structure
  const renderStructureStep = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
        <Layers className="h-4 w-4 text-indigo-500" />
        <h3 className="font-semibold text-gray-900 dark:text-white">Course Modules</h3>
        <Badge variant="secondary" className="ml-auto">{courseData.modules.length} modules</Badge>
      </div>

      {courseData.modules.length > 0 && (
        <div className="space-y-2">
          {courseData.modules.map((mod, i) => (
            <div key={mod.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 group">
              <div className="w-7 h-7 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 dark:text-white text-sm">{mod.title}</h4>
                {mod.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{mod.description}</p>}
                {mod.skillTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {mod.skillTags.map(tag => <Badge key={tag} variant="outline" className="text-xs py-0">{tag}</Badge>)}
                  </div>
                )}
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeModule(i)} className="opacity-0 group-hover:opacity-100 h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl space-y-4 bg-gray-50/50 dark:bg-gray-800/30">
        <h4 className="font-medium text-gray-700 dark:text-gray-300 text-sm">Add New Module</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Module Title</Label>
            <Input value={newModule.title} onChange={(e) => setNewModule(prev => ({ ...prev, title: e.target.value }))} placeholder="e.g., Introduction to Python" className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description (optional)</Label>
            <Input value={newModule.description} onChange={(e) => setNewModule(prev => ({ ...prev, description: e.target.value }))} placeholder="Brief description..." className="text-sm" />
          </div>
        </div>
        {courseData.skillsCovered.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs">Tag Skills</Label>
            <div className="flex flex-wrap gap-1.5">
              {courseData.skillsCovered.map(skill => (
                <button key={skill} type="button" onClick={() => toggleModuleSkill(skill)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    newModule.skillTags.includes(skill) ? 'bg-indigo-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300'
                  }`}
                >{skill}</button>
              ))}
            </div>
          </div>
        )}
        <Button type="button" onClick={addModule} disabled={!newModule.title} size="sm" className="w-full">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Module
        </Button>
      </div>
    </div>
  )

  // Step 4: Review
  const renderReviewStep = () => (
    <div className="p-6 space-y-6">
      <div className="text-center pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
          <CheckCircle2 className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Review & Confirm</h2>
        <p className="text-sm text-gray-500">Please verify all details before creating the course</p>
      </div>

      {errors.submit && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-3">
            <div className="flex items-start gap-3">
              {courseData.thumbnail && <img src={courseData.thumbnail} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />}
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">{courseData.title}</h3>
                <p className="text-sm text-gray-500">{courseData.code} • {courseData.duration}</p>
                <Badge variant={courseData.status === 'Active' ? 'default' : 'secondary'} className="mt-1">{courseData.status}</Badge>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{courseData.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">University</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{courseData.university || '—'}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Category</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{courseData.category || '—'}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-2">Skills ({courseData.skillsCovered.length})</p>
            <div className="flex flex-wrap gap-1">
              {courseData.skillsCovered.map(s => <Badge key={s} variant="outline" className="text-xs bg-white dark:bg-gray-800">{s}</Badge>)}
            </div>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-2">Classes ({courseData.linkedClasses.length})</p>
            <div className="flex flex-wrap gap-1">
              {courseData.linkedClasses.length > 0 
                ? courseData.linkedClasses.map(c => <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>)
                : <span className="text-xs text-gray-500">None assigned</span>
              }
            </div>
          </div>
          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1">Modules</p>
            <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{courseData.modules.length}</p>
          </div>
        </div>
      </div>
    </div>
  )

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: return renderSourceStep()
      case 1: return renderBasicInfoStep()
      case 2: return renderSkillMappingStep()
      case 3: return renderStructureStep()
      case 4: return renderReviewStep()
      default: return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden">
        {/* Accessible title and description for screen readers */}
        <DialogTitle className="sr-only">
          {editingCourse ? 'Edit Course' : 'Create New Course'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Multi-step wizard to {editingCourse ? 'edit an existing' : 'create a new'} course. Currently on step {currentStep + 1}: {STEPS[currentStep]?.title}.
        </DialogDescription>
        
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-900 dark:text-white">
              {editingCourse ? 'Edit Course' : 'Create New Course'}
            </h1>
            <p className="text-xs text-gray-500">{STEPS[currentStep]?.title} • Step {visibleSteps.findIndex(s => s.id === currentStep) + 1} of {visibleSteps.length}</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            {visibleSteps.map((step, index) => {
              const isActive = currentStep === step.id
              const isCompleted = currentStep > step.id
              const stepNumber = index + 1
              const isLast = index === visibleSteps.length - 1
              
              return (
                <div key={step.id} className={`flex items-center ${isLast ? '' : 'flex-1'}`}>
                  {/* Step indicator */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                      isCompleted 
                        ? 'bg-indigo-600 text-white' 
                        : isActive 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-white dark:bg-gray-800 text-gray-400 border-2 border-gray-300 dark:border-gray-600'
                    }`}>
                      {isCompleted ? <Check className="h-4 w-4" strokeWidth={3} /> : stepNumber}
                    </div>
                    <span className={`text-sm font-medium whitespace-nowrap ${
                      isActive || isCompleted ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {step.title}
                    </span>
                  </div>
                  
                  {/* Connector line */}
                  {!isLast && (
                    <div className={`flex-1 h-0.5 mx-3 min-w-[20px] ${
                      isCompleted ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="max-h-[calc(90vh-200px)]">
          {renderStepContent()}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <Button variant="outline" onClick={currentStep === (editingCourse ? 1 : 0) ? handleClose : goBack}>
            {currentStep === (editingCourse ? 1 : 0) ? 'Cancel' : <><ChevronLeft className="h-4 w-4 mr-1" /> Back</>}
          </Button>
          <div className="flex items-center gap-2">
            {!canProceed() && currentStep < 4 && (
              <span className="text-xs text-amber-600 dark:text-amber-400">Please complete required fields</span>
            )}
            {currentStep === 4 ? (
              <Button onClick={handleSubmit} disabled={loading} className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white min-w-[140px]">
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : <><Check className="h-4 w-4 mr-2" /> {editingCourse ? 'Update' : 'Create'} Course</>}
              </Button>
            ) : (
              <Button onClick={goNext} disabled={!canProceed()} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white min-w-[100px]">
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
