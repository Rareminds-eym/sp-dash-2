# Create Course Feature - Complete Implementation Prompt

## Overview

Implement a "Create Course" button and complete course creation functionality for an **Admin Portal**. This feature allows administrators to create new courses with a multi-step wizard modal, including course details, skill mapping, course structure (modules), and confirmation.

**Target**: Admin Portal (School/College/University Admin)
**Backend**: Supabase (PostgreSQL)
**Image Storage**: Supabase Storage (bucket: `course-images`) with optional Cloudflare R2 fallback

---

## 1. Database Schema

The feature uses the following Supabase tables:

### 1.1 `courses` (Main Table)
```sql
CREATE TABLE courses (
  course_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR NOT NULL,
  code VARCHAR NOT NULL,
  description TEXT NOT NULL,
  thumbnail TEXT,
  status VARCHAR DEFAULT 'Draft',  -- 'Active', 'Draft', 'Upcoming', 'Archived'
  duration VARCHAR NOT NULL,
  enrollment_count INTEGER DEFAULT 0,
  completion_rate INTEGER DEFAULT 0,
  evidence_pending INTEGER DEFAULT 0,
  skills_mapped INTEGER DEFAULT 0,
  total_skills INTEGER DEFAULT 0,
  educator_id UUID NOT NULL,
  educator_name VARCHAR,
  school_id UUID,
  target_outcomes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ  -- Soft delete
);
```

### 1.2 `course_skills` (Many-to-Many: Course ↔ Skills)
```sql
CREATE TABLE course_skills (
  course_skill_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(course_id),
  skill_name VARCHAR NOT NULL,
  proficiency_level VARCHAR,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);
```

### 1.3 `course_classes` (Many-to-Many: Course ↔ Classes)
```sql
CREATE TABLE course_classes (
  course_class_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(course_id),
  class_name VARCHAR NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);
```

### 1.4 `course_modules` (Course Structure)
```sql
CREATE TABLE course_modules (
  module_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(course_id),
  title VARCHAR NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  skill_tags JSONB DEFAULT '[]'::jsonb,
  activities JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);
```

### 1.5 `lessons` (Module Lessons)
```sql
CREATE TABLE lessons (
  lesson_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES course_modules(module_id),
  title VARCHAR NOT NULL,
  description TEXT,
  content TEXT,
  duration VARCHAR,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);
```

### 1.6 `lesson_resources` (Lesson Attachments)
```sql
CREATE TABLE lesson_resources (
  resource_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(lesson_id),
  name VARCHAR NOT NULL,
  type VARCHAR NOT NULL,  -- 'pdf', 'video', 'image', 'document', 'link', 'youtube', 'drive'
  url TEXT NOT NULL,
  file_size VARCHAR,
  thumbnail_url TEXT,
  embed_url TEXT,
  order_index INTEGER DEFAULT 0,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);
```

### 1.7 `course_co_educators` (Optional)
```sql
CREATE TABLE course_co_educators (
  co_educator_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(course_id),
  educator_id UUID NOT NULL,
  educator_name VARCHAR,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);
```

---

## 2. TypeScript Interfaces

```typescript
// Course Types
export interface Course {
  id: string;
  title: string;
  code: string;
  description: string;
  thumbnail?: string;
  status: 'Active' | 'Draft' | 'Upcoming' | 'Archived';
  skillsCovered: string[];
  skillsMapped: number;
  totalSkills: number;
  enrollmentCount: number;
  completionRate: number;
  evidencePending: number;
  linkedClasses: string[];
  modules: CourseModule[];
  targetOutcomes: string[];
  duration: string;
  createdAt: string;
  updatedAt: string;
  coEducators?: string[];
}

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  skillTags: string[];
  lessons: Lesson[];
  activities: string[];
  order: number;
  isExpanded?: boolean;
}

export interface Lesson {
  id: string;
  title: string;
  content: string;
  description?: string;
  resources: Resource[];
  duration: string;
  order: number;
}

export interface Resource {
  id: string;
  name: string;
  type: 'pdf' | 'video' | 'image' | 'document' | 'link' | 'youtube' | 'drive';
  url: string;
  size?: string;
  uploadProgress?: number;
  thumbnailUrl?: string;
  embedUrl?: string;
}
```

---

## 3. Constants

```typescript
export const SKILL_CATEGORIES = [
  'Creativity',
  'Collaboration',
  'Critical Thinking',
  'Leadership',
  'Communication',
  'Problem Solving',
  'Technical Skills',
  'Data Analysis',
  'Programming',
  'Research',
  'Strategic Thinking',
  'Innovation'
];

export const CLASSES = [
  'Class 9A',
  'Class 9B',
  'Class 10A',
  'Class 10B',
  'Class 11A',
  'Class 11B',
  'Class 12A'
];
```

---

## 4. UI/UX Specifications

### 4.1 Create Course Button
- Location: Top-right of the Courses page header
- Style: Primary button (indigo/blue background, white text)
- Icon: Plus icon on the left
- Text: "Create Course"
- Visibility: Always visible to admin users

```tsx
<button
  onClick={() => setShowCreateModal(true)}
  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm"
>
  <PlusIcon className="h-5 w-5" />
  Create Course
</button>
```

### 4.2 Multi-Step Modal Wizard

The modal has 5 steps for creating a new course (4 steps when editing):

#### Step 0: Course Source Selection (New courses only)
- Two options: "Create New Course" or "Import from Platform"
- Import platforms: Udemy, Coursera, edX, LinkedIn Learning, Skillshare, Google Courses, YouTube, Other
- If import selected, show platform selection grid and URL input field

#### Step 1: Basic Information
Required fields:
- Course Title (text input)
- Course Code (text input, e.g., "CS301")
- Description (textarea, 5 rows)
- Duration (text input, e.g., "12 weeks")
- Status (dropdown: Draft, Active, Upcoming, Archived)
- Thumbnail (image upload component)
- Target Learning Outcomes (dynamic list of text inputs with add/remove)

#### Step 2: Skill Mapping
- Skill Categories: Grid of toggle buttons (3 columns)
- At least one skill must be selected to proceed
- Assign to Classes: Checkbox grid (4 columns)

#### Step 3: Course Structure (Skip for imported courses)
- Display existing modules
- Add new module form:
  - Module Title (text input)
  - Module Description (textarea)
  - Module Skills (toggle buttons from selected course skills)
  - "Add Module" button

#### Step 4: Confirmation
- Review summary showing:
  - Basic Information (title, code, duration, status)
  - Skills Covered (tags)
  - Linked Classes (tags)
  - Course Structure (module count)

### 4.3 Modal Layout
- Max width: 4xl (max-w-4xl)
- Max height: 90vh
- Header: Title, step indicator, close button
- Progress bar: Horizontal stepper with numbered circles
- Content: Scrollable area
- Footer: Cancel/Back button (left), Next/Create button (right)

---

## 5. Service Layer (Supabase Integration)

### 5.1 Create Course Function

```typescript
export const createCourse = async (
  courseData: Omit<Course, 'id' | 'createdAt' | 'updatedAt' | 'enrollmentCount' | 'completionRate' | 'evidencePending'>,
  educatorId: string,
  educatorName: string,
  schoolId?: string
): Promise<Course> => {
  // 1. Insert into courses table
  const { data: courseRow, error: courseError } = await supabase
    .from('courses')
    .insert({
      title: courseData.title,
      code: courseData.code,
      description: courseData.description,
      thumbnail: courseData.thumbnail,
      status: courseData.status,
      duration: courseData.duration,
      skills_mapped: courseData.skillsMapped,
      total_skills: courseData.totalSkills,
      target_outcomes: courseData.targetOutcomes,
      educator_id: educatorId,
      educator_name: educatorName,
      school_id: schoolId
    })
    .select()
    .single();

  if (courseError) throw courseError;

  // 2. Insert skills into course_skills
  if (courseData.skillsCovered.length > 0) {
    const skillsToInsert = courseData.skillsCovered.map(skill => ({
      course_id: courseRow.course_id,
      skill_name: skill
    }));
    await supabase.from('course_skills').insert(skillsToInsert);
  }

  // 3. Insert classes into course_classes
  if (courseData.linkedClasses.length > 0) {
    const classesToInsert = courseData.linkedClasses.map(className => ({
      course_id: courseRow.course_id,
      class_name: className
    }));
    await supabase.from('course_classes').insert(classesToInsert);
  }

  // 4. Insert modules (with nested lessons and resources)
  if (courseData.modules.length > 0) {
    for (const module of courseData.modules) {
      const { data: moduleRow } = await supabase
        .from('course_modules')
        .insert({
          course_id: courseRow.course_id,
          title: module.title,
          description: module.description,
          order_index: module.order,
          skill_tags: module.skillTags,
          activities: module.activities
        })
        .select()
        .single();

      // Insert lessons for this module
      for (const lesson of module.lessons) {
        const { data: lessonRow } = await supabase
          .from('lessons')
          .insert({
            module_id: moduleRow.module_id,
            title: lesson.title,
            description: lesson.description,
            content: lesson.content,
            duration: lesson.duration,
            order_index: lesson.order
          })
          .select()
          .single();

        // Insert resources for this lesson
        if (lesson.resources.length > 0) {
          const resourcesToInsert = lesson.resources.map((resource, index) => ({
            lesson_id: lessonRow.lesson_id,
            name: resource.name,
            type: resource.type,
            url: resource.url,
            file_size: resource.size,
            thumbnail_url: resource.thumbnailUrl,
            embed_url: resource.embedUrl,
            order_index: index
          }));
          await supabase.from('lesson_resources').insert(resourcesToInsert);
        }
      }
    }
  }

  return newCourse;
};
```

### 5.2 Get All Courses Function

```typescript
export const getAllCourses = async (): Promise<Course[]> => {
  // 1. Fetch basic course data
  const { data: coursesData, error } = await supabase
    .from('courses')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!coursesData) return [];

  const courseIds = coursesData.map(c => c.course_id);

  // 2. Fetch related data in parallel
  const [skillsResult, classesResult, modulesResult, coEducatorsResult] = await Promise.allSettled([
    supabase.from('course_skills').select('course_id, skill_name').in('course_id', courseIds),
    supabase.from('course_classes').select('course_id, class_name').in('course_id', courseIds),
    supabase.from('course_modules').select(`*, lessons (*, lesson_resources (*))`).in('course_id', courseIds).order('order_index'),
    supabase.from('course_co_educators').select('course_id, educator_name').in('course_id', courseIds)
  ]);

  // 3. Build lookup maps and transform data
  // ... (see full implementation in coursesService.ts)
};
```

### 5.3 Update Course Function

```typescript
export const updateCourse = async (courseId: string, updates: Partial<Course>): Promise<Course> => {
  // 1. Update courses table
  await supabase
    .from('courses')
    .update({
      title: updates.title,
      code: updates.code,
      description: updates.description,
      thumbnail: updates.thumbnail,
      status: updates.status,
      duration: updates.duration,
      skills_mapped: updates.skillsMapped,
      total_skills: updates.totalSkills,
      target_outcomes: updates.targetOutcomes
    })
    .eq('course_id', courseId);

  // 2. Update skills (delete existing, insert new)
  if (updates.skillsCovered) {
    await supabase.from('course_skills').delete().eq('course_id', courseId);
    if (updates.skillsCovered.length > 0) {
      const skillsToInsert = updates.skillsCovered.map(skill => ({
        course_id: courseId,
        skill_name: skill
      }));
      await supabase.from('course_skills').insert(skillsToInsert);
    }
  }

  // 3. Update classes (delete existing, insert new)
  if (updates.linkedClasses) {
    await supabase.from('course_classes').delete().eq('course_id', courseId);
    if (updates.linkedClasses.length > 0) {
      const classesToInsert = updates.linkedClasses.map(className => ({
        course_id: courseId,
        class_name: className
      }));
      await supabase.from('course_classes').insert(classesToInsert);
    }
  }

  return updatedCourse;
};
```

---

## 6. Image Upload Component

### 6.1 ImageUpload Component Props
```typescript
interface ImageUploadProps {
  currentImage?: string;
  onImageChange: (url: string) => void;
  folder?: string;  // Default: 'courses'
  label?: string;   // Default: 'Thumbnail/Icon'
  className?: string;
}
```

### 6.2 Upload Logic
```typescript
export async function uploadToStorage(file: File, folder: string = 'courses'): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  // Validate file type (must be image)
  if (!file.type.startsWith('image/')) {
    return { success: false, error: 'Please upload an image file' };
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: 'Image size must be less than 5MB' };
  }

  // Generate unique filename
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = file.name.split('.').pop();
  const filename = `${folder}/${timestamp}-${randomString}.${extension}`;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('course-images')
    .upload(filename, file, { cacheControl: '3600', upsert: false });

  if (error) return { success: false, error: error.message };

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('course-images')
    .getPublicUrl(filename);

  return { success: true, url: publicUrl };
}
```

### 6.3 Supabase Storage Bucket Setup
Create a public bucket named `course-images` in Supabase Storage with the following policy:
```sql
-- Allow public read access
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'course-images');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'course-images' AND auth.role() = 'authenticated'
);
```

---

## 7. State Management

### 7.1 Page-Level State (Courses.tsx)
```typescript
const [courses, setCourses] = useState<Course[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [adminId, setAdminId] = useState<string | null>(null);
const [adminName, setAdminName] = useState<string>('');
const [schoolId, setSchoolId] = useState<string | null>(null); // Institution ID
const [showCreateModal, setShowCreateModal] = useState(false);
const [editingCourse, setEditingCourse] = useState<Course | null>(null);
```

### 7.2 Modal-Level State (CreateCourseModal.tsx)
```typescript
const [courseSource, setCourseSource] = useState<'create' | 'import' | null>(null);
const [importPlatform, setImportPlatform] = useState<string>('');
const [currentStep, setCurrentStep] = useState(0);
const [courseData, setCourseData] = useState<Partial<Course>>({
  title: '',
  code: '',
  description: '',
  duration: '',
  thumbnail: '',
  skillsCovered: [],
  targetOutcomes: [''],
  linkedClasses: [],
  modules: [],
  status: 'Draft'
});
const [newModule, setNewModule] = useState<Partial<CourseModule>>({
  title: '',
  description: '',
  skillTags: [],
  lessons: [],
  activities: [],
  order: 0
});
```

---

## 8. Validation Rules

### Step 0 (Course Source)
- Must select either "Create New" or "Import"
- If "Import" selected, must select a platform

### Step 1 (Basic Info)
- Title: Required, non-empty string
- Code: Required, non-empty string
- Description: Required, non-empty string
- Duration: Required, non-empty string

### Step 2 (Skill Mapping)
- At least one skill must be selected

### Step 3 (Course Structure)
- Optional - can proceed without adding modules

### Step 4 (Confirmation)
- No validation - review only

```typescript
const canProceedToNextStep = () => {
  switch (currentStep) {
    case 0:
      return courseSource !== null && (courseSource === 'create' || importPlatform !== '');
    case 1:
      return courseData.title && courseData.code && courseData.description && courseData.duration;
    case 2:
      return (courseData.skillsCovered?.length || 0) > 0;
    case 3:
      return true; // Optional step
    default:
      return true;
  }
};
```

---

## 9. Admin Context & Institution ID

Since this is an admin portal, the admin user should have access to their institution (school/college/university) ID. This ID is used when creating courses to associate them with the institution.

```typescript
// Get admin's institution ID from auth context or user profile
const getAdminInstitutionId = async (adminId: string) => {
  // Option 1: From school_admins table
  const { data: schoolAdmin } = await supabase
    .from('school_admins')
    .select('school_id, schools(name)')
    .eq('user_id', adminId)
    .maybeSingle();

  if (schoolAdmin) {
    return { 
      institutionId: schoolAdmin.school_id, 
      institutionType: 'school',
      institutionName: schoolAdmin.schools?.name 
    };
  }

  // Option 2: From college_admins table
  const { data: collegeAdmin } = await supabase
    .from('college_admins')
    .select('college_id, colleges(name)')
    .eq('user_id', adminId)
    .maybeSingle();

  if (collegeAdmin) {
    return { 
      institutionId: collegeAdmin.college_id, 
      institutionType: 'college',
      institutionName: collegeAdmin.colleges?.name 
    };
  }

  return null;
};
```

When creating a course, pass the institution ID:
```typescript
const handleCreateCourse = async (courseData: Partial<Course>) => {
  const newCourse = await createCourse(
    courseData,
    adminId,      // Creator ID
    adminName,    // Creator name
    schoolId      // Institution ID - associates course with the institution
  );
};
```

---

## 10. Third-Party Platform Import Options

```typescript
const thirdPartyPlatforms = [
  { id: 'udemy', name: 'Udemy', logo: '📚', color: 'from-purple-500 to-pink-500' },
  { id: 'coursera', name: 'Coursera', logo: '🎓', color: 'from-blue-500 to-cyan-500' },
  { id: 'edx', name: 'edX', logo: '📖', color: 'from-red-500 to-orange-500' },
  { id: 'linkedin', name: 'LinkedIn Learning', logo: '💼', color: 'from-blue-600 to-blue-400' },
  { id: 'skillshare', name: 'Skillshare', logo: '🎨', color: 'from-green-500 to-teal-500' },
  { id: 'google', name: 'Google Courses', logo: '🔍', color: 'from-red-500 to-yellow-500' },
  { id: 'youtube', name: 'YouTube', logo: '▶️', color: 'from-red-600 to-red-400' },
  { id: 'other', name: 'Other Platform', logo: '🌐', color: 'from-gray-500 to-gray-400' }
];
```

---

## 11. Icons Required

From Heroicons (v2, outline):
- `PlusIcon` - Create button, Add outcome/module
- `XMarkIcon` - Close modal, Remove items
- `PhotoIcon` - Image upload placeholder
- `CheckIcon` - Completed step indicator
- `BookOpenIcon` - Course icon
- `AcademicCapIcon` - Affiliation icon

---

## 12. Styling Notes

- Use Tailwind CSS for styling
- Primary color: Indigo (indigo-600, indigo-700)
- Success color: Emerald (emerald-600)
- Border radius: rounded-lg (8px), rounded-xl (12px), rounded-2xl (16px)
- Shadows: shadow-sm, shadow-xl
- Transitions: transition-colors, transition-all
- Focus states: focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500

---

## 13. Error Handling

- Display error messages in a dismissible banner at the top of the page
- Show toast notifications for success/error on course creation
- Log errors to console with detailed information
- Handle network errors gracefully with retry option

```typescript
try {
  const newCourse = await createCourse(courseData, educatorId, educatorName);
  toast.success('Course created successfully!');
} catch (err) {
  console.error('Error creating course:', err);
  setError('Failed to create course: ' + (err?.message || 'Unknown error'));
}
```

---

## 14. Dependencies

```json
{
  "@heroicons/react": "^2.x",
  "@supabase/supabase-js": "^2.x",
  "react-hot-toast": "^2.x"
}
```

---

## 15. File Structure

```
src/
├── components/
│   ├── common/
│   │   └── ImageUpload.tsx
│   └── educator/
│       └── courses/
│           └── CreateCourseModal.tsx
├── pages/
│   └── educator/
│       └── Courses.tsx
├── services/
│   └── educator/
│       └── coursesService.ts
├── types/
│   └── educator/
│       └── course.ts
├── data/
│   └── educator/
│       └── mockCourses.ts  (contains SKILL_CATEGORIES, CLASSES)
└── utils/
    └── cloudflareR2Upload.ts  (or storageUpload.ts)
```

---

## 16. Testing Checklist

- [ ] Create Course button appears for admin users
- [ ] Modal opens on button click
- [ ] Step navigation works (Next/Back)
- [ ] Form validation prevents proceeding without required fields
- [ ] Image upload works and shows preview
- [ ] Skills can be selected/deselected
- [ ] Classes can be selected/deselected
- [ ] Modules can be added with skill tags
- [ ] Course is saved to database on submit
- [ ] Related data (skills, classes, modules) is saved correctly
- [ ] Modal closes and form resets after successful creation
- [ ] Error messages display correctly
- [ ] Edit mode populates form with existing data
- [ ] Update course works correctly
- [ ] Course is associated with admin's institution (school_id)

---

## Summary

This prompt provides everything needed to implement the Create Course feature in an **Admin Portal**:
1. Complete database schema with all related tables
2. TypeScript interfaces for type safety
3. UI/UX specifications for the multi-step modal
4. Service layer functions for Supabase CRUD operations
5. Image upload component with storage integration
6. State management patterns
7. Validation rules
8. Error handling
9. Admin context and institution ID handling

The implementation should follow React best practices with functional components and hooks, use Tailwind CSS for styling, and integrate with Supabase for backend operations.

**Key difference from educator portal**: Admins always have permission to create courses, and courses are automatically associated with their institution (school/college/university) via the `school_id` field.
