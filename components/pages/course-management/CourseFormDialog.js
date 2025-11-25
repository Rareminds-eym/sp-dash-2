import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Loader2, Plus, Edit } from 'lucide-react'

export function CourseFormDialog({
    open,
    onOpenChange,
    editingCourse,
    formData,
    handleChange,
    handleSubmit,
    loading,
    errors,
    universities,
    loadingUniversities,
    setFormData,
    setErrors
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {editingCourse ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                        {editingCourse ? 'Edit Course' : 'Create New Course'}
                    </DialogTitle>
                    <DialogDescription>
                        {editingCourse ? 'Update the course details below.' : 'Fill in the details below to create a new course. All fields are required.'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Information */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">
                            Basic Information
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Course Name */}
                            <div className="space-y-2">
                                <Label htmlFor="name">
                                    Course Name <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="e.g., Introduction to Data Science"
                                    className={errors.name ? 'border-red-500' : ''}
                                />
                                {errors.name && (
                                    <p className="text-sm text-red-500">{errors.name}</p>
                                )}
                            </div>

                            {/* Course Code */}
                            <div className="space-y-2">
                                <Label htmlFor="courseCode">
                                    Course Code <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="courseCode"
                                    name="courseCode"
                                    value={formData.courseCode}
                                    onChange={handleChange}
                                    placeholder="e.g., CS101"
                                    className={errors.courseCode ? 'border-red-500' : ''}
                                />
                                {errors.courseCode && (
                                    <p className="text-sm text-red-500">{errors.courseCode}</p>
                                )}
                            </div>

                            {/* University */}
                            <div className="space-y-2">
                                <Label htmlFor="university">
                                    University/Institution <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={formData.university}
                                    onValueChange={(value) => {
                                        setFormData(prev => ({ ...prev, university: value }))
                                        if (errors.university) {
                                            setErrors(prev => {
                                                const newErrors = { ...prev }
                                                delete newErrors.university
                                                return newErrors
                                            })
                                        }
                                    }}
                                    disabled={loadingUniversities}
                                >
                                    <SelectTrigger className={errors.university ? 'border-red-500' : ''}>
                                        <SelectValue placeholder={loadingUniversities ? "Loading universities..." : "Select a university"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {universities.length > 0 ? (
                                            universities.map(uni => (
                                                <SelectItem key={uni.id} value={uni.name}>
                                                    {uni.name}
                                                </SelectItem>
                                            ))
                                        ) : (
                                            <SelectItem value="none" disabled>
                                                {loadingUniversities ? 'Loading...' : 'No universities available'}
                                            </SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                                {errors.university && (
                                    <p className="text-sm text-red-500">{errors.university}</p>
                                )}
                            </div>

                            {/* Category */}
                            <div className="space-y-2">
                                <Label htmlFor="category">
                                    Category/Department <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="category"
                                    name="category"
                                    value={formData.category}
                                    onChange={handleChange}
                                    placeholder="e.g., Computer Science"
                                    className={errors.category ? 'border-red-500' : ''}
                                />
                                {errors.category && (
                                    <p className="text-sm text-red-500">{errors.category}</p>
                                )}
                            </div>

                            {/* Duration */}
                            <div className="space-y-2">
                                <Label htmlFor="duration">
                                    Duration <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="duration"
                                    name="duration"
                                    value={formData.duration}
                                    onChange={handleChange}
                                    placeholder="e.g., 8 weeks, 3 months"
                                    className={errors.duration ? 'border-red-500' : ''}
                                />
                                {errors.duration && (
                                    <p className="text-sm text-red-500">{errors.duration}</p>
                                )}
                            </div>

                            {/* Credits */}
                            <div className="space-y-2">
                                <Label htmlFor="credits">
                                    Credits <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="credits"
                                    name="credits"
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={formData.credits}
                                    onChange={handleChange}
                                    placeholder="e.g., 3"
                                    className={errors.credits ? 'border-red-500' : ''}
                                />
                                {errors.credits && (
                                    <p className="text-sm text-red-500">{errors.credits}</p>
                                )}
                            </div>
                        </div>

                        {/* Thumbnail URL */}
                        <div className="space-y-2">
                            <Label htmlFor="thumbnailUrl">
                                Thumbnail URL <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="thumbnailUrl"
                                name="thumbnailUrl"
                                type="url"
                                value={formData.thumbnailUrl}
                                onChange={handleChange}
                                placeholder="https://example.com/image.jpg"
                                className={errors.thumbnailUrl ? 'border-red-500' : ''}
                            />
                            {errors.thumbnailUrl && (
                                <p className="text-sm text-red-500">{errors.thumbnailUrl}</p>
                            )}
                        </div>
                    </div>

                    {/* Course Details */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">
                            Course Details
                        </h3>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label htmlFor="description">
                                Description <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="Provide a detailed description of the course..."
                                rows={5}
                                className={errors.description ? 'border-red-500' : ''}
                            />
                            {errors.description && (
                                <p className="text-sm text-red-500">{errors.description}</p>
                            )}
                        </div>

                        {/* Target Outcomes */}
                        <div className="space-y-2">
                            <Label htmlFor="targetOutcomes">
                                Target Outcomes <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                                id="targetOutcomes"
                                name="targetOutcomes"
                                value={formData.targetOutcomes}
                                onChange={handleChange}
                                placeholder="List the learning outcomes and goals for students completing this course..."
                                rows={5}
                                className={errors.targetOutcomes ? 'border-red-500' : ''}
                            />
                            {errors.targetOutcomes && (
                                <p className="text-sm text-red-500">{errors.targetOutcomes}</p>
                            )}
                            <p className="text-sm text-muted-foreground">
                                Tip: List each outcome on a new line for better readability
                            </p>
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="flex gap-4 pt-4 border-t">
                        <Button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    {editingCourse ? 'Updating...' : 'Creating...'}
                                </>
                            ) : (
                                <>
                                    {editingCourse ? <Edit className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                                    {editingCourse ? 'Update Course' : 'Create Course'}
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
