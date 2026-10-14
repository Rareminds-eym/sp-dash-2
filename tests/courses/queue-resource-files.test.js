import { beforeEach, describe, expect, it, vi } from 'vitest'

const { queueCourseFileUpload } = vi.hoisted(() => ({
  queueCourseFileUpload: vi.fn(),
}))

vi.mock('@/lib/services/course-upload-client', () => ({ queueCourseFileUpload }))

import {
  queueCourseFilesInCourses,
  queueResourceFiles,
} from '@/components/pages/course-management/queue-resource-files'

describe('Course Management queued resource files', () => {
  beforeEach(() => {
    queueCourseFileUpload.mockReset()
    queueCourseFileUpload.mockResolvedValue({
      r2Key: 'courses/resources/example.pdf',
      r2Url: '/api/courses/assets?key=courses%2Fresources%2Fexample.pdf',
      fileSize: '1 KB',
    })
  })

  it('queues each file and resource type once and returns the queued asset URL', async () => {
    const resource = {
      resource_name: 'Handout',
      resource_type: 'pdf',
      file_path: 'materials/handout.pdf',
    }
    const duplicate = { ...resource, resource_name: 'Copy' }
    const queued = await queueResourceFiles([resource, duplicate], [
      new File(['pdf'], 'handout.pdf', { type: 'application/pdf' }),
    ])

    expect(queueCourseFileUpload).toHaveBeenCalledTimes(1)
    expect(queueCourseFileUpload).toHaveBeenCalledWith(
      expect.any(File),
      'pdf',
      'Handout',
    )
    expect(queued.map((item) => item.resource_url)).toEqual([
      '/api/courses/assets?key=courses%2Fresources%2Fexample.pdf',
      '/api/courses/assets?key=courses%2Fresources%2Fexample.pdf',
    ])
    expect(queued[0].file_size).toBe('1 KB')
    expect(resource.resource_url).toBeUndefined()
  })

  it('updates queued resource files throughout nested course data', async () => {
    const course = {
      course_code: 'QUEUED-1',
      modules: [{
        lessons: [{
          resources: [{
            resource_name: 'Slides',
            resource_type: 'document',
            file_path: 'slides.pptx',
          }],
        }],
      }],
    }

    const [queuedCourse] = await queueCourseFilesInCourses(
      [course],
      [new File(['slides'], 'slides.pptx')],
    )

    expect(queuedCourse.modules[0].lessons[0].resources[0].resource_url).toContain('/api/courses/assets?key=')
    expect(course.modules[0].lessons[0].resources[0].resource_url).toBeUndefined()
  })
})
