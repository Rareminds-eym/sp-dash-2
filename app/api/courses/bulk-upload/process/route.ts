import { NextRequest, NextResponse } from 'next/server';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCourseAssetsBucket, CourseAssetsBindingError } from '@/lib/services/course-assets-r2';
import { isCourseUploadWorkerRequest } from '@/lib/services/course-upload-runtime';
import {
  CourseManagementQueueUnavailableError,
  queueBulkCourseManagementJob,
} from '@/lib/services/queue-bulk-course-job';
import {
  BULK_MAX_COURSES_PER_BATCH,
  chunkArray,
  isUrlResourceType,
  SUPABASE_IN_CHUNK_SIZE,
  validateResourceType,
  validateResourceUrl,
} from '@/lib/services/course-resource-validation';
import Logger from '@/lib/logger';

const logger = new Logger('Bulk Course Process');

export const runtime = 'nodejs';
export const maxDuration = 300;

/** Max total lesson_resources accepted per process call (Worker memory bound). */
const BULK_MAX_TOTAL_RESOURCES = 1000;

interface IncomingLesson {
  lesson_title: string;
  lesson_order: number;
  lesson_content?: string;
  lesson_duration?: string;
  resources: IncomingResource[];
}

interface IncomingModule {
  module_title: string;
  module_order: number;
  module_description?: string;
  lessons: IncomingLesson[];
}

interface IncomingCourse {
  course_code: string;
  course_title: string;
  course_description?: string;
  university?: string;
  category?: string;
  duration?: string;
  credits?: number;
  skills?: string[];
  modules: IncomingModule[];
}

interface IncomingResource {
  resource_name: string;
  resource_type: string;
  resource_url?: string;
  file_size?: string;
  file_path?: string;
  rowNumber?: number;
}

/**
 * Validate one logical course (server-side, never trusts client mappings).
 * Returns an error string or null. Checks required fields, order values,
 * duplicate module/lesson orders within the course, and resource shape via
 * the canonical hierarchy validator.
 */
function validateIncomingCourse(course: IncomingCourse): string | null {
  if (!course || typeof course !== 'object') return 'course must be an object';
  if (!String(course.course_code || '').trim()) return 'course_code is required';
  if (!String(course.course_title || '').trim()) return 'course_title is required';
  if (!Array.isArray(course.modules)) return 'modules must be an array';
  if (course.modules.length > 200) return 'Maximum 200 modules per course';
  if (course.credits !== undefined && !(Number.isFinite(Number(course.credits)) && Number(course.credits) >= 0)) {
    return 'credits must be a non-negative number';
  }
  const moduleOrders = new Set<number>();
  for (const m of course.modules) {
    if (!String(m.module_title || '').trim()) return 'module_title is required';
    if (!Number.isInteger(m.module_order) || m.module_order < 1) return 'module_order must be a positive integer';
    if (moduleOrders.has(m.module_order)) return `duplicate module_order ${m.module_order}`;
    moduleOrders.add(m.module_order);
    if (!Array.isArray(m.lessons)) return 'lessons must be an array';
    if (m.lessons.length > 500) return 'Maximum 500 lessons per module';
    const lessonOrders = new Set<number>();
    for (const l of m.lessons) {
      if (!String(l.lesson_title || '').trim()) return 'lesson_title is required';
      if (!Number.isInteger(l.lesson_order) || l.lesson_order < 1) return 'lesson_order must be a positive integer';
      if (lessonOrders.has(l.lesson_order)) return `duplicate lesson_order ${l.lesson_order} in module '${m.module_title}'`;
      lessonOrders.add(l.lesson_order);
      if (!Array.isArray(l.resources)) return 'resources must be an array';
      if (l.resources.length > 100) return 'Maximum 100 resources per lesson';
    }
  }
  // Canonical per-resource checks (type + URL shape) on the mapped shape.
  // file_path rows resolve to R2 asset URLs at insert time and get their
  // FINAL URL re-validated after upload (see insert loop below).
  for (const m of course.modules) {
    for (const l of m.lessons) {
      for (const r of l.resources) {
        if (!String(r.resource_name || '').trim()) return 'resource_name is required';
        const typeError = validateResourceType(String(r.resource_type || '').toLowerCase());
        if (typeError) return typeError;
        const url = (r.resource_url || '').trim();
        if (url) {
          const urlError = validateResourceUrl(url, String(r.resource_type).toLowerCase());
          if (urlError) return urlError;
        } else if (!r.file_path) {
          return `resource '${r.resource_name}' requires resource_url or file_path`;
        } else if (isUrlResourceType(String(r.resource_type).toLowerCase())) {
          return `Resource type '${r.resource_type}' requires resource_url, not file_path`;
        }
      }
    }
  }
  return null;
}

/** Best-effort per-course rollback: remove rows created for a failed course. */
async function rollbackCourse(courseId: string, uploadedKeys: string[], bucket: { delete(k: string): Promise<unknown> }) {
  for (const key of uploadedKeys) {
    try {
      await bucket.delete(key);
    } catch (e) {
      logger.warn('Failed to clean up R2 object during course rollback', { key, e });
    }
  }
  try {
    const { data: modules } = await supabaseAdmin
      .from('course_modules')
      .select('module_id')
      .eq('course_id', courseId);
    const moduleIds = (modules || []).map((m) => m.module_id);
    for (const chunk of chunkArray(moduleIds, SUPABASE_IN_CHUNK_SIZE)) {
      if (chunk.length === 0) continue;
      const { data: lessons } = await supabaseAdmin
        .from('lessons')
        .select('lesson_id')
        .in('module_id', chunk);
      const lessonIds = (lessons || []).map((l) => l.lesson_id);
      for (const lchunk of chunkArray(lessonIds, SUPABASE_IN_CHUNK_SIZE)) {
        if (lchunk.length === 0) continue;
        await supabaseAdmin.from('lesson_resources').delete().in('lesson_id', lchunk);
      }
      await supabaseAdmin.from('lessons').delete().in('module_id', chunk);
    }
    await supabaseAdmin.from('course_skills').delete().eq('course_id', courseId);
    await supabaseAdmin.from('courses').delete().eq('course_id', courseId);
  } catch (e) {
    logger.error('Course rollback incomplete; manual cleanup may be required', { courseId, e });
  }
}

export async function POST(request: NextRequest) {
  try {
    const isInternal = await isCourseUploadWorkerRequest(request);
    let uploaderId = '';
    if (isInternal) {
      uploaderId = request.headers.get('x-course-upload-uploader-id') || 'unknown';
    } else {
      const { user, error: authError } = await authenticateSSORequest(request, [
        'admin',
        'super_admin',
        'rm_admin',
      ]);
      if (authError || !user) {
        return authError || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
      uploaderId = String((user as { userId?: string; id?: string }).userId ||
        (user as { id?: string }).id || 'unknown');
    }

    let payload: { previewId?: string; courses?: IncomingCourse[] };
    try {
      if (isInternal) {
        payload = await request.json();
      } else {
        const formData = await request.formData();
        const payloadRaw = formData.get('payload');
        if (!payloadRaw || typeof payloadRaw !== 'string') {
          return NextResponse.json({ success: false, error: 'payload JSON field is required' }, { status: 400 });
        }
        payload = JSON.parse(payloadRaw);
        const files = formData.getAll('files').filter((f): f is File => f instanceof File);
        if (files.length > 0) {
          return NextResponse.json(
            { success: false, error: 'Course resource files must be uploaded through the Course Management queue before processing.' },
            { status: 400 },
          );
        }
      }
    } catch {
      return NextResponse.json({ success: false, error: 'payload must be valid JSON' }, { status: 400 });
    }

    const courses = Array.isArray(payload.courses) ? payload.courses : [];
    if (courses.length === 0) {
      return NextResponse.json({ success: false, error: 'No courses to process' }, { status: 400 });
    }
    if (courses.length > BULK_MAX_COURSES_PER_BATCH) {
      return NextResponse.json(
        { success: false, error: `Maximum ${BULK_MAX_COURSES_PER_BATCH} courses per batch. Split the import and retry.` },
        { status: 400 }
      );
    }

    if (!isInternal && process.env.NODE_ENV !== 'development') {
      try {
        const jobId = await queueBulkCourseManagementJob({
          kind: 'bulk-course-process',
          ownerId: uploaderId,
          fileName: 'Course import',
          payload,
        });
        return NextResponse.json(
          { success: true, jobId, status: 'queued' },
          { status: 202 },
        );
      } catch (error) {
        if (error instanceof CourseManagementQueueUnavailableError) {
          return NextResponse.json({ success: false, error: error.message }, { status: 503 });
        }
        throw error;
      }
    }
    // Processing jobs carry JSON only (queue-bulk-course-job stages
    // payload.json). Resource bytes are never inline here: the frontend
    // pre-queues files via queueResourceFiles (/api/courses/resource-upload
    // → worker → R2) and the payload must already contain the resulting
    // resource_url. There is intentionally no second upload path.

    // ---- Centralized pre-validation (no writes before this point) ----
    const rowErrors: Array<{ course: string; row?: number; error: string }> = [];
    const seenCodes = new Map<string, number>();
    let totalResources = 0;
    courses.forEach((c, idx) => {
      const code = String(c.course_code || '').trim();
      if (code) {
        seenCodes.set(code, (seenCodes.get(code) || 0) + 1);
      }
      const err = validateIncomingCourse(c);
      if (err) rowErrors.push({ course: code || `#${idx + 1}`, error: err });
      for (const m of c.modules || []) {
        for (const l of m.lessons || []) totalResources += (l.resources || []).length;
      }
    });
    for (const [code, count] of seenCodes) {
      if (count > 1) rowErrors.push({ course: code, error: `duplicate course_code '${code}' appears ${count} times in this import` });
    }
    if (totalResources > BULK_MAX_TOTAL_RESOURCES) {
      return NextResponse.json(
        { success: false, error: `Import exceeds ${BULK_MAX_TOTAL_RESOURCES} total resources. Split the import and retry.` },
        { status: 400 }
      );
    }
    if (rowErrors.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Import validation failed', errors: rowErrors },
        { status: 400 }
      );
    }

    // ---- Duplicate-code guard (chunked, error-checked, empty-safe) ----
    // Runs BEFORE any insert so a retry is never blocked by this run's own
    // partial writes; per-course rollback below keeps that invariant.
    const courseCodes = courses.map((c) => String(c.course_code).trim());
    const existingCodes = new Set<string>();
    for (const chunk of chunkArray(courseCodes, SUPABASE_IN_CHUNK_SIZE)) {
      if (chunk.length === 0) continue;
      const { data, error } = await supabaseAdmin.from('courses').select('code').in('code', chunk);
      if (error) {
        logger.error('Failed duplicate-code check', { error });
        return NextResponse.json(
          { success: false, error: 'Failed to validate course codes', details: error.message },
          { status: 500 }
        );
      }
      for (const row of data || []) existingCodes.add(row.code);
    }
    if (existingCodes.size > 0) {
      const dups = [...existingCodes].join(', ');
      return NextResponse.json(
        {
          success: false,
          error: `Duplicate course codes found: ${dups}. These courses already exist.`,
          errors: [...existingCodes].map((code) => ({
            course: code,
            error: 'course_code already exists. Delete the existing draft or use a new code, then retry.',
          })),
        },
        { status: 409 }
      );
    }

    const bucket = await getCourseAssetsBucket().catch((err) => {
      if (err instanceof CourseAssetsBindingError) return null;
      throw err;
    });
    if (!bucket) {
      return NextResponse.json(
        { success: false, error: 'Resource storage is not configured. Contact support.' },
        { status: 503 }
      );
    }
    let processedCourses = 0;
    let totalModules = 0;
    let totalLessons = 0;
    let totalResourcesInserted = 0;
    const errors: Array<{ course: string; error: string }> = [];

    for (const courseData of courses) {
      const courseCode = String(courseData.course_code).trim();
      let courseId: string | null = null;
      // Retained for rollbackCourse signature: process creates no R2 objects
      // itself (pre-queued assets live outside this route), so this stays
      // empty and rollback only removes DB rows created by this course.
      const uploadedKeys: string[] = [];
      try {
        const { data: newCourse, error: courseError } = await supabaseAdmin
          .from('courses')
          .insert({
            title: String(courseData.course_title).trim(),
            code: courseCode,
            description: courseData.course_description || '',
            university: courseData.university || '',
            category: courseData.category || '',
            duration: courseData.duration || '',
            credits: Number(courseData.credits) || 0,
            thumbnail: '',
            target_outcomes: [],
            status: 'Draft',
            approval_status: 'pending',
            skills_mapped: courseData.skills?.length || 0,
            total_skills: courseData.skills?.length || 0,
          })
          .select('course_id')
          .single();

        if (courseError || !newCourse) throw new Error(`Course creation failed: ${courseError?.message || 'unknown error'}`);
        courseId = newCourse.course_id;

        if (courseData.skills && courseData.skills.length > 0) {
          const skillsToInsert = courseData.skills.map(skill => ({
            course_id: courseId,
            skill_name: String(skill).trim(),
          }));
          const { error: skillsError } = await supabaseAdmin.from('course_skills').insert(skillsToInsert);
          if (skillsError) throw new Error(`Skills insert failed: ${skillsError.message}`);
        }

        for (const moduleData of courseData.modules) {
          const { data: newModule, error: moduleError } = await supabaseAdmin
            .from('course_modules')
            .insert({
              course_id: courseId,
              title: String(moduleData.module_title).trim(),
              description: moduleData.module_description || null,
              order_index: moduleData.module_order,
            })
            .select('module_id')
            .single();

          if (moduleError || !newModule) throw new Error(`Module creation failed: ${moduleError?.message || 'unknown error'}`);
          const moduleId = newModule.module_id;
          totalModules++;

          for (const lessonData of moduleData.lessons) {
            const { data: newLesson, error: lessonError } = await supabaseAdmin
              .from('lessons')
              .insert({
                module_id: moduleId,
                title: String(lessonData.lesson_title).trim(),
                content: lessonData.lesson_content || null,
                duration: lessonData.lesson_duration || null,
                order_index: lessonData.lesson_order,
              })
              .select('lesson_id')
              .single();

            if (lessonError || !newLesson) throw new Error(`Lesson creation failed: ${lessonError?.message || 'unknown error'}`);
            const lessonId = newLesson.lesson_id;
            totalLessons++;

            for (const resourceData of lessonData.resources) {
              try {
                const type = String(resourceData.resource_type || '').toLowerCase();
                const typeError = validateResourceType(type);
                if (typeError) throw new Error(typeError);
                if (!String(resourceData.resource_name || '').trim()) throw new Error('resource_name is required');

                const url = (resourceData.resource_url || '').trim();
                const fileSize = resourceData.file_size || '';

                // File-based rows must arrive with a previously queued R2
                // reference. queueResourceFiles uploads bytes before process
                // and stamps resource_url; process never accepts inline file
                // bytes (payloads are JSON via payload.json staging).
                if (!url && resourceData.file_path) {
                  if (isUrlResourceType(type)) {
                    throw new Error(`Resource type '${type}' requires resource_url, not file_path`);
                  }
                  throw new Error(
                    `Uploaded file not found for file_path '${resourceData.file_path}'. Upload resource files through the Course Management queue before processing.`
                  );
                }

                if (!url) throw new Error('Either resource_url or a previously queued file reference is required');
                // Re-validate the FINAL URL (preview may have passed with file_path).
                // Only https:// external URLs and app-controlled
                // /api/courses/assets?key=... references are accepted.
                const urlError = validateResourceUrl(url, type);
                if (urlError) throw new Error(urlError);

                const { error: insertError } = await supabaseAdmin.from('lesson_resources').insert({
                  lesson_id: lessonId,
                  name: String(resourceData.resource_name).trim(),
                  type,
                  url,
                  file_size: fileSize || null,
                  order_index: 0,
                });
                if (insertError) throw new Error(insertError.message);
                totalResourcesInserted++;
              } catch (err) {
                // Per-row failure: nothing is persisted for this row and the
                // reason is reported (course continues; row reported).
                errors.push({ course: courseCode, error: (err as Error).message });
                logger.warn(`Resource creation failed for lesson ${lessonData.lesson_title}`, { error: err });
              }
            }
          }
        }

        processedCourses++;
      } catch (err) {
        // Per-course atomicity: a mid-course failure rolls back everything
        // this course created (DB rows + R2 objects) so retries see a clean
        // slate and no stranded partial hierarchies remain.
        if (courseId) {
          await rollbackCourse(courseId, uploadedKeys, bucket);
        }
        errors.push({ course: courseCode, error: (err as Error).message });
        logger.error(`Failed to create course ${courseCode} (rolled back)`, { error: err });
      }
    }

    return NextResponse.json({
      success: true,
      processedCourses,
      totalModules,
      totalLessons,
      totalResources: totalResourcesInserted,
      totalReceived: courses.length,
      errors,
      atomicity: 'per-course (rolled back on failure). Cross-course batches are not single-transaction; see API docs.',
    });
  } catch (error) {
    logger.error('Failed to process bulk courses', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to process bulk courses', details: (error as Error).message },
      { status: 500 }
    );
  }
}
