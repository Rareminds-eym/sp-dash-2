import { beforeEach, expect, it, vi } from 'vitest';
const { upload } = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock('@/lib/services/course-upload-client', () => ({ queueCourseFileUpload: upload }));
import { uploadCourseImage } from '@/lib/services/coursesService';
beforeEach(() => vi.clearAllMocks());
it('uses the R2 upload route for thumbnails in development too', async () => {
  const file = new File(['png'], 'image.png', { type: 'image/png' });
  upload.mockResolvedValue({ r2Url: 'http://localhost:3000/api/courses/thumbnails?key=image' });
  expect(await uploadCourseImage(file)).toEqual({ success: true, url: 'http://localhost:3000/api/courses/thumbnails?key=image' });
  expect(upload).toHaveBeenCalledWith(file, 'image', 'courses thumbnail', 'course-image');
});
it('reports a missing image URL instead of a false upload success', async () => {
  upload.mockResolvedValue({ success: true });
  expect((await uploadCourseImage(new File(['png'], 'image.png', { type: 'image/png' }))).success).toBe(false);
});
