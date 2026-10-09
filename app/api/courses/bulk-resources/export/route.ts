import { NextRequest, NextResponse } from 'next/server';
import * as ExcelJS from 'exceljs';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  BULK_MAX_EXPORT_COURSES,
  CANONICAL_RESOURCE_TYPE_IDS,
  chunkArray,
  SUPABASE_IN_CHUNK_SIZE,
} from '@/lib/services/course-resource-validation';
import Logger from '@/lib/logger';

const logger = new Logger('Bulk Resource Export');

export const runtime = 'nodejs';

const RESOURCE_COLUMNS = [
  { header: 'course_id', key: 'course_id', width: 40 },
  { header: 'course_code', key: 'course_code', width: 15 },
  { header: 'course_name', key: 'course_name', width: 30 },
  { header: 'module_id', key: 'module_id', width: 40 },
  { header: 'module_title', key: 'module_title', width: 30 },
  { header: 'lesson_id', key: 'lesson_id', width: 40 },
  { header: 'lesson_title', key: 'lesson_title', width: 30 },
  { header: 'resource_name', key: 'resource_name', width: 30 },
  { header: 'resource_type', key: 'resource_type', width: 15 },
  { header: 'resource_url', key: 'resource_url', width: 50 },
  { header: 'file_path', key: 'file_path', width: 40 },
  { header: 'file_size', key: 'file_size', width: 15 },
  { header: 'thumbnail_url', key: 'thumbnail_url', width: 50 },
  { header: 'embed_url', key: 'embed_url', width: 50 },
  { header: 'order_index', key: 'order_index', width: 12 },
  { header: 'notes', key: 'notes', width: 40 },
];

const INSTRUCTIONS = [
  'BULK COURSE RESOURCE UPLOAD - INSTRUCTIONS',
  '',
  '1. DO NOT modify course_id, module_id, lesson_id columns (they identify where resources go)',
  '2. Each row = one lesson. To add multiple resources to one lesson, DUPLICATE the row.',
  '3. Fill in resource details for each resource:',
  '   - resource_name: Display name (e.g., "Introduction Video")',
   '   - resource_type: Choose from dropdown: pdf, video, youtube, document, image, link, drive',
  '   - file_path: For uploads, enter EXACT filename (e.g., "intro.mp4")',
  '   - resource_url: For external links, enter full URL (e.g., "https://youtube.com/...")',
  '4. You can delete rows for lessons that don\'t need resources',
  '5. Save and upload back to system via Bulk Add Resources > Upload Template',
  '',
  'EXAMPLE:',
  'lesson_id     | lesson_title    | resource_name      | resource_type | file_path',
  'uuid-123-abc  | Introduction    | Intro Video        | video         | intro.mp4',
  'uuid-123-abc  | Introduction    | Intro Slides       | pdf           | slides.pdf',
  'uuid-456-def  | Chapter 1       | Chapter 1 Reading  | pdf           | ch1.pdf',
  '',
   'SUPPORTED FILE TYPES: PDF, Video (mp4/avi/mov), PowerPoint, Word, Images (jpg/png)',
   'RESOURCE TYPES: pdf, video, youtube, document, image, link, drive',
];

/**
 * POST /api/courses/bulk-resources/export - Export Excel template with course structure.
 * Body: { courseIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateSSORequest(request, [
      'admin',
      'super_admin',
      'rm_admin',
    ]);
    if (authError || !user) {
      return authError || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const courseIds: string[] = Array.isArray(body.courseIds) ? body.courseIds : [];

    logger.info('Received bulk resource export request', { courseIds, count: courseIds.length });

    if (courseIds.length === 0) {
      return NextResponse.json({ success: false, error: 'courseIds array is required' }, { status: 400 });
    }
    if (courseIds.length > BULK_MAX_EXPORT_COURSES) {
      return NextResponse.json({ success: false, error: `Maximum ${BULK_MAX_EXPORT_COURSES} courses per export` }, { status: 400 });
    }

    // Fetch courses (chunked `.in()` to respect URL-length limits)
    const courses: Array<{ course_id: string; code: string; title: string }> = [];
    for (const chunk of chunkArray(courseIds, SUPABASE_IN_CHUNK_SIZE)) {
      const { data, error: coursesError } = await supabaseAdmin
        .from('courses')
        .select('course_id, code, title')
        .in('course_id', chunk)
        .is('deleted_at', null);
      if (coursesError) {
        logger.error('Failed to fetch courses', { error: coursesError });
        return NextResponse.json({ success: false, error: 'Failed to fetch courses', details: coursesError.message }, { status: 500 });
      }
      courses.push(...(data || []));
    }

    logger.info('Fetched courses', { courses: (courses || []).map(c => ({ id: c.course_id, title: c.title })) });

    // Fetch modules for these courses (chunked `.in()`)
    const modules: Array<{ module_id: string; course_id: string; title: string }> = [];
    for (const chunk of chunkArray(courseIds, SUPABASE_IN_CHUNK_SIZE)) {
      const { data, error: modulesError } = await supabaseAdmin
        .from('course_modules')
        .select('module_id, course_id, title')
        .in('course_id', chunk)
        .order('order_index', { ascending: true });
      if (modulesError) {
        logger.error('Failed to fetch modules', { error: modulesError });
        return NextResponse.json({ success: false, error: 'Failed to fetch modules', details: modulesError.message }, { status: 500 });
      }
      modules.push(...(data || []));
    }

    const moduleCounts = (modules || []).reduce((acc, m) => {
      acc[m.course_id] = (acc[m.course_id] || 0) + 1;
      return acc;
    }, {});
    logger.info('Fetched modules', { count: (modules || []).length, modulesByCourse: moduleCounts });

    const moduleIds = (modules || []).map((m) => m.module_id);
    let lessons: Array<{ lesson_id: string; module_id: string; title: string }> = [];
    if (moduleIds.length > 0) {
      for (const chunk of chunkArray(moduleIds, SUPABASE_IN_CHUNK_SIZE)) {
        const { data: lessonRows, error: lessonsError } = await supabaseAdmin
          .from('lessons')
          .select('lesson_id, module_id, title')
          .in('module_id', chunk)
          .order('order_index', { ascending: true });
        if (lessonsError) {
          logger.error('Failed to fetch lessons', { error: lessonsError });
          return NextResponse.json({ success: false, error: 'Failed to fetch lessons', details: lessonsError.message }, { status: 500 });
        }
        lessons.push(...(lessonRows || []));
      }
    }

    const lessonCounts = lessons.reduce((acc, l) => {
      acc[l.module_id] = (acc[l.module_id] || 0) + 1;
      return acc;
    }, {});
    logger.info('Fetched lessons', { count: lessons.length, lessonsByModule: lessonCounts });

    const lessonsByModule = new Map<string, typeof lessons>();
    for (const lesson of lessons) {
      const list = lessonsByModule.get(lesson.module_id) || [];
      list.push(lesson);
      lessonsByModule.set(lesson.module_id, list);
    }
    const courseById = new Map((courses || []).map((c) => [c.course_id, c]));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Course Management';
    workbook.created = new Date();

    // Instructions sheet
    const instructionsSheet = workbook.addWorksheet('Instructions');
    instructionsSheet.columns = [{ header: '', key: 'instructions', width: 90 }];
    for (const line of INSTRUCTIONS) {
      instructionsSheet.addRow({ instructions: line });
    }
    instructionsSheet.getRow(1).font = { bold: true, size: 14 };

    // Course_Resources sheet
    const sheet = workbook.addWorksheet('Course_Resources');
    sheet.columns = RESOURCE_COLUMNS;
    sheet.addRow(Object.fromEntries(RESOURCE_COLUMNS.map((c) => [c.key, c.header])));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    let rowCount = 0;
    let skippedEmptyLessons = 0;
    for (const mod of modules || []) {
      const course = courseById.get(mod.course_id);
      const modLessons = lessonsByModule.get(mod.module_id) || [];
      // Modules without lessons are skipped: an empty lesson_id row can never
      // be imported (preview requires lesson_id), so emitting one only forces
      // manual deletion. The count is reported in the Instructions sheet.
      if (modLessons.length === 0) {
        skippedEmptyLessons += 1;
        continue;
      }
      for (const lesson of modLessons) {
        sheet.addRow({
          course_id: mod.course_id,
          course_code: course?.code || '',
          course_name: course?.title || '',
          module_id: mod.module_id,
          module_title: mod.title || '',
          lesson_id: lesson.lesson_id || '',
          lesson_title: lesson.title || '',
          resource_name: '',
          resource_type: '',
          resource_url: '',
          file_path: '',
          file_size: '',
          thumbnail_url: '',
          embed_url: '',
          order_index: 0,
          notes: '',
        });
        rowCount += 1;
      }
    }

    // Data validation for resource_type column (I = 9th column)
    // List is canonical — must match preview/process validation.
    const allowedList = CANONICAL_RESOURCE_TYPE_IDS.join(',');
    if (rowCount > 0) {
      const sheetWithValidation = sheet as unknown as {
        dataValidations: { add: (ref: string, opts: object) => void };
      };
      sheetWithValidation.dataValidations.add(`I2:I${rowCount + 1}`, {
        type: 'list',
        allowBlank: true,
        formulae: [`"${allowedList}"`],
        showErrorMessage: true,
        errorTitle: 'Invalid type',
        error: `Allowed: ${CANONICAL_RESOURCE_TYPE_IDS.join(', ')}`,
      });
    }
    if (skippedEmptyLessons > 0) {
      instructionsSheet.addRow({
        instructions: `NOTE: ${skippedEmptyLessons} module(s) without lessons were skipped — add lessons to them before exporting resources.`,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const dateStamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="course-resources-template-${dateStamp}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logger.error('Failed to export bulk resource template', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to export template', details: (error as Error).message },
      { status: 500 }
    );
  }
}
