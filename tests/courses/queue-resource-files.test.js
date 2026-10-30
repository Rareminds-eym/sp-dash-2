import { beforeEach, describe, expect, it, vi } from 'vitest'

const { queueCourseFileUpload, waitForCourseUploadJob } = vi.hoisted(() => ({
  queueCourseFileUpload: vi.fn(),
  waitForCourseUploadJob: vi.fn(),
}))

vi.mock('@/lib/services/course-upload-client', () => ({ queueCourseFileUpload, waitForCourseUploadJob }))

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

  it('imports a shared Google presentation once and stores its R2 URL', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ success: true, r2Url: '/api/courses/assets?key=slides', fileName: 'Slides.pptx', fileSize: '2 KB' }) })
    try {
      const resource = { resource_name: 'Slides.ppt', resource_type: 'document', resource_url: 'https://docs.google.com/presentation/d/abc/edit' }
      const queued = await queueResourceFiles([resource, { ...resource }], [], { importGoogle: true })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(queued[0]).toMatchObject({ resource_name: 'Slides.pptx', resource_url: '/api/courses/assets?key=slides' })
      expect(queued[1].resource_url).toBe(queued[0].resource_url)
    } finally { fetchMock.mockRestore() }
  })
})
