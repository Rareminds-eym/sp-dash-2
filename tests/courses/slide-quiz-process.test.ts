import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ quizRows: [] as any[], failQuiz: false }));
vi.mock('@/lib/middleware/sso-auth', () => ({ authenticateSSORequest: vi.fn(async () => ({ user: { id: 'admin' }, error: null })) }));
vi.mock('@/lib/services/course-upload-runtime', () => ({ isCourseUploadWorkerRequest: vi.fn(async () => true) }));
vi.mock('@/lib/services/queue-bulk-course-job', () => ({ CourseManagementQueueUnavailableError: class extends Error {}, queueBulkCourseManagementJob: vi.fn() }));
vi.mock('@/lib/services/course-assets-r2', () => ({ CourseAssetsBindingError: class extends Error {}, getCourseAssetsBucket: vi.fn(async () => ({ delete: vi.fn() })) }));
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: { from(table: string) {
  return {
    select: () => ({ in: async () => ({ data: [], error: null }) }),
    insert: (value: any) => {
      if (table === 'ppt_slide_quizzes') {
        mocks.quizRows.push(...value);
        return Promise.resolve({ error: mocks.failQuiz ? { message: 'quiz insert failed' } : null });
      }
      const ids: Record<string, object> = { courses: { course_id: 'course-id' }, course_modules: { module_id: 'module-id' }, lessons: { lesson_id: 'lesson-id' }, lesson_resources: { resource_id: 'resource-id' } };
      return { select: () => ({ single: async () => ({ data: ids[table], error: null }) }) };
    },
    delete: () => ({ eq: async () => ({ error: null }), in: async () => ({ error: null }) }),
  };
} } }));
import { POST } from '@/app/api/courses/bulk-upload/process/route';

function payload() {
  return { courses: [{ course_code: 'TEST', course_title: 'Test', modules: [{ module_title: 'Module', module_order: 1, lessons: [{ lesson_title: 'Lesson', lesson_order: 1, resources: [{ resource_name: 'Slides.pptx', resource_type: 'document', resource_url: 'https://example.com/slides.pptx', slide_questions: [
    { slide_number: 4, question: 'First?', options: ['a', 'b', 'c', 'd'], correct_option: 'A' },
    { slide_number: 4, question: 'Second?', options: ['a', 'b', 'c', 'd'], correct_option: 'B' },
    { slide_number: 5, question: 'Third?', options: ['a', 'b', 'c', 'd'], correct_option: 'C' },
  ] }] }] }] }] };
}
describe('bulk slide quiz creation', () => {
  beforeEach(() => { mocks.quizRows.length = 0; mocks.failQuiz = false; });
  it('saves grouped questions against the newly created PPTX resource', async () => {
    const request = new NextRequest('http://localhost/api/courses/bulk-upload/process', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()) });
    const result = await POST(request);
    expect(result.status).toBe(200);
    expect((await result.json()).processedCourses).toBe(1);
    expect(mocks.quizRows).toHaveLength(2);
    expect(mocks.quizRows[0]).toMatchObject({ resource_id: 'resource-id', slide_number: 4 });
    expect(mocks.quizRows[0].questions).toHaveLength(2);
    expect(mocks.quizRows[1].slide_number).toBe(5);
  });
});
