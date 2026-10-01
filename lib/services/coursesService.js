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
export async function createCourse(courseData, educatorId = null, schoolId = null) {
  const response = await fetch('/api/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...courseData,
      educatorId,
      schoolId
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || errorData.details || `Failed to create course (Status ${response.status})`)
  }

  const result = await response.json()
  return result.data || result
}

/**
 * Update an existing course
 */
export async function updateCourse(courseId, updates, educatorId = null) {
  const response = await fetch(`/api/courses/${courseId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...updates,
      educatorId
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || errorData.details || `Failed to update course (Status ${response.status})`)
  }

  const result = await response.json()
  return result.data || result
}
