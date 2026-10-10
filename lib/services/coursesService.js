'use client'

import { createClient } from '@/lib/supabase-browser'
import { queueCourseFileUpload } from '@/lib/services/course-upload-client'

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

/** Queue a course thumbnail upload and return its public image URL. */
export async function uploadCourseImage(file, folder = 'courses') {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    return { success: false, error: 'Please upload an image file' }
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: 'Image size must be less than 5MB' }
  }

  try {
    if (process.env.NODE_ENV === 'development') {
      const supabase = createClient()
      const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 15)}.${file.name.split('.').pop()}`
      const { error } = await supabase.storage
        .from('course-images')
        .upload(filename, file, { cacheControl: '3600', upsert: false })
      if (error) return { success: false, error: error.message }
      const { data } = supabase.storage.from('course-images').getPublicUrl(filename)
      return { success: true, url: data.publicUrl }
    }
    const result = await queueCourseFileUpload(file, 'image', `${folder} thumbnail`, 'course-image')
    return { success: true, url: result.url }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload image',
    }
  }
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
  const payload = { ...updates }
  if (educatorId) {
    payload.educatorId = educatorId
  }
  const response = await fetch(`/api/courses/${courseId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || errorData.details || `Failed to update course (Status ${response.status})`)
  }

  const result = await response.json()
  return result.data || result
}
