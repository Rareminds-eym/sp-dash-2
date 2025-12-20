'use client'

import { createClient } from '@/lib/supabase-browser'

// Constants
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
]

export const THIRD_PARTY_PLATFORMS = [
  { id: 'udemy', name: 'Udemy', color: 'bg-purple-600' },
  { id: 'coursera', name: 'Coursera', color: 'bg-blue-600' },
  { id: 'edx', name: 'edX', color: 'bg-red-600' },
  { id: 'linkedin', name: 'LinkedIn', color: 'bg-blue-700' },
  { id: 'skillshare', name: 'Skillshare', color: 'bg-emerald-600' },
  { id: 'google', name: 'Google', color: 'bg-red-500' },
  { id: 'youtube', name: 'YouTube', color: 'bg-red-600' },
  { id: 'other', name: 'Other', color: 'bg-gray-600' }
]

/**
 * Upload image to Supabase Storage
 */
export async function uploadCourseImage(file, folder = 'courses') {
  const supabase = createClient()
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    return { success: false, error: 'Please upload an image file' }
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: 'Image size must be less than 5MB' }
  }

  // Generate unique filename
  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(2, 15)
  const extension = file.name.split('.').pop()
  const filename = `${folder}/${timestamp}-${randomString}.${extension}`

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('course-images')
    .upload(filename, file, { cacheControl: '3600', upsert: false })

  if (error) {
    console.error('Upload error:', error)
    return { success: false, error: error.message }
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('course-images')
    .getPublicUrl(filename)

  return { success: true, url: publicUrl }
}

/**
 * Create a new course with all related data
 */
export async function createCourse(courseData, educatorId, schoolId = null) {
  const supabase = createClient()

  // 1. Insert into courses table
  const { data: courseRow, error: courseError } = await supabase
    .from('courses')
    .insert({
      title: courseData.title,
      code: courseData.code,
      description: courseData.description,
      thumbnail: courseData.thumbnail,
      status: 'Active',
      approval_status: 'approved',
      duration: courseData.duration,
      skills_mapped: courseData.skillsCovered?.length || 0,
      total_skills: courseData.skillsCovered?.length || 0,
      target_outcomes: courseData.targetOutcomes,
      educator_id: educatorId,
      school_id: schoolId,
      credits: courseData.credits
    })
    .select()
    .single()

  if (courseError) {
    console.error('Error creating course:', courseError)
    throw courseError
  }

  const courseId = courseRow.course_id

  // 2. Insert skills into course_skills (if table exists)
  if (courseData.skillsCovered?.length > 0) {
    const skillsToInsert = courseData.skillsCovered.map(skill => ({
      course_id: courseId,
      skill_name: skill
    }))
    
    const { error: skillsError } = await supabase
      .from('course_skills')
      .insert(skillsToInsert)
    
    if (skillsError) {
      console.warn('Skills insert warning:', skillsError.message)
    }
  }

  // 3. Insert classes into course_classes (only if schoolId is provided - not for platform courses)
  if (schoolId && courseData.linkedClasses?.length > 0) {
    const classesToInsert = courseData.linkedClasses.map(className => ({
      course_id: courseId,
      class_name: className
    }))
    
    const { error: classesError } = await supabase
      .from('course_classes')
      .insert(classesToInsert)
    
    if (classesError) {
      console.warn('Classes insert warning:', classesError.message)
    }
  }

  // 4. Insert modules (if any)
  if (courseData.modules?.length > 0) {
    for (const module of courseData.modules) {
      const { data: moduleRow, error: moduleError } = await supabase
        .from('course_modules')
        .insert({
          course_id: courseId,
          title: module.title,
          description: module.description,
          order_index: module.order || 0,
          skill_tags: module.skillTags || [],
          activities: module.activities || []
        })
        .select()
        .single()

      if (moduleError) {
        console.warn('Module insert warning:', moduleError.message)
        continue
      }

      // Insert lessons for this module
      if (module.lessons?.length > 0) {
        for (const lesson of module.lessons) {
          const { data: lessonRow, error: lessonError } = await supabase
            .from('lessons')
            .insert({
              module_id: moduleRow.module_id,
              title: lesson.title,
              description: lesson.description,
              content: lesson.content,
              duration: lesson.duration,
              order_index: lesson.order || 0
            })
            .select()
            .single()

          if (lessonError) {
            console.warn('Lesson insert warning:', lessonError.message)
            continue
          }

          // Insert resources for this lesson
          if (lesson.resources?.length > 0) {
            const resourcesToInsert = lesson.resources.map((resource, index) => ({
              lesson_id: lessonRow.lesson_id,
              name: resource.name,
              type: resource.type,
              url: resource.url,
              file_size: resource.size,
              thumbnail_url: resource.thumbnailUrl,
              embed_url: resource.embedUrl,
              order_index: index
            }))
            
            await supabase.from('lesson_resources').insert(resourcesToInsert)
          }
        }
      }
    }
  }

  return {
    id: courseId,
    ...courseData,
    createdAt: courseRow.created_at,
    updatedAt: courseRow.updated_at
  }
}

/**
 * Update an existing course
 */
export async function updateCourse(courseId, updates, educatorId) {
  const supabase = createClient()

  // 1. Update courses table
  const { error: updateError } = await supabase
    .from('courses')
    .update({
      title: updates.title,
      code: updates.code,
      description: updates.description,
      thumbnail: updates.thumbnail,
      status: updates.status,
      duration: updates.duration,
      skills_mapped: updates.skillsCovered?.length || 0,
      total_skills: updates.skillsCovered?.length || 0,
      target_outcomes: updates.targetOutcomes,
      credits: updates.credits,
      updated_at: new Date().toISOString()
    })
    .eq('course_id', courseId)

  if (updateError) throw updateError

  // 2. Update skills (delete existing, insert new)
  if (updates.skillsCovered) {
    await supabase.from('course_skills').delete().eq('course_id', courseId)
    
    if (updates.skillsCovered.length > 0) {
      const skillsToInsert = updates.skillsCovered.map(skill => ({
        course_id: courseId,
        skill_name: skill
      }))
      await supabase.from('course_skills').insert(skillsToInsert)
    }
  }

  // 3. Update classes (delete existing, insert new)
  if (updates.linkedClasses) {
    await supabase.from('course_classes').delete().eq('course_id', courseId)
    
    if (updates.linkedClasses.length > 0) {
      const classesToInsert = updates.linkedClasses.map(className => ({
        course_id: courseId,
        class_name: className
      }))
      await supabase.from('course_classes').insert(classesToInsert)
    }
  }

  return { id: courseId, ...updates }
}
