import { NextRequest, NextResponse } from 'next/server';
import * as ExcelJS from 'exceljs';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { saveBulkPreview } from '@/lib/services/bulk-preview-store';
import {
  BULK_MAX_COURSES_PER_BATCH,
  BULK_PREVIEW_MAX_BYTES,
  BULK_PREVIEW_MAX_ROWS,
  CANONICAL_RESOURCE_TYPE_IDS,
  validateResourceType,
  validateResourceUrl,
} from '@/lib/services/course-resource-validation';
import Logger from '@/lib/logger';

const logger = new Logger('Bulk Course Preview');

export const runtime = 'nodejs';

interface ParsedLesson {
  lesson_title: string;
  lesson_order: number;
  lesson_content?: string;
  lesson_duration?: string;
  resources: ParsedResource[];
}

interface ParsedModule {
  module_title: string;
  module_order: number;
  module_description?: string;
  lessons: ParsedLesson[];
}

interface ParsedCourse {
  course_code: string;
  course_title: string;
  course_description?: string;
  university?: string;
  category?: string;
  duration?: string;
  credits?: number;
  skills?: string[];
  modules: ParsedModule[];
}

interface ParsedResource {
  resource_name: string;
  resource_type: string;
  resource_url?: string;
  file_path?: string;
  rowNumber: number;
}

function cellValue(cell: ExcelJS.Cell): string {
  const v = cell?.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if ('text' in v && typeof (v as { text: string }).text === 'string') return (v as { text: string }).text;
    if ('result' in v) return String((v as { result: unknown }).result ?? '');
    return String((v as object).toString?.() ?? '');
  }
  return String(v);
}

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

    const formData = await request.formData();
    const template = formData.get('template');
    if (!template || !(template instanceof File)) {
      return NextResponse.json({ success: false, error: 'Excel template file (template) is required' }, { status: 400 });
    }

    const uploadedFiles: File[] = formData.getAll('files').filter((f): f is File => f instanceof File);
    const uploadedNames = new Set(uploadedFiles.map((f) => f.name));

    if (template.size > BULK_PREVIEW_MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: `Template exceeds ${(BULK_PREVIEW_MAX_BYTES / 1024 / 1024).toFixed(0)} MB. Split the workbook and retry.` },
        { status: 413 }
      );
    }

    const arrayBuffer = await template.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(arrayBuffer));

    const sheet = workbook.getWorksheet('Course_Upload');
    if (!sheet) {
      return NextResponse.json(
        { success: false, error: "Sheet 'Course_Upload' not found. Please use the exported template." },
        { status: 400 }
      );
    }

    // Build header index
    const headerRow = sheet.getRow(1);
    const headerIndex = new Map<string, number>();
    headerRow.eachCell((cell, colNumber) => {
      headerIndex.set(cellValue(cell).trim().toLowerCase(), colNumber);
    });

    const requiredHeaders = ['course_code', 'course_title', 'module_title', 'module_order', 'lesson_title', 'lesson_order'];
    for (const h of requiredHeaders) {
      if (!headerIndex.has(h)) {
        return NextResponse.json(
          { success: false, error: `Required column '${h}' missing in template` },
          { status: 400 }
        );
      }
    }

    const get = (row: ExcelJS.Row, key: string): string => {
      const col = headerIndex.get(key);
      if (!col) return '';
      return cellValue(row.getCell(col)).trim();
    };

    const courseMap = new Map<string, ParsedCourse>();
    const errors: Array<{ row: number; error: string }> = [];
    const seenRowKeys = new Set<string>();
    let dataRowCount = 0;

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      dataRowCount += 1;
      if (dataRowCount > BULK_PREVIEW_MAX_ROWS) {
        if (dataRowCount === BULK_PREVIEW_MAX_ROWS + 1) {
          errors.push({ row: rowNumber, error: `Workbook exceeds ${BULK_PREVIEW_MAX_ROWS} data rows. Split the template and retry.` });
        }
        return;
      }

      const course_code = get(row, 'course_code');
      const course_title = get(row, 'course_title');
      const skills_str = get(row, 'skills');
      const module_title = get(row, 'module_title');
      const module_order_str = get(row, 'module_order');
      const lesson_title = get(row, 'lesson_title');
      const lesson_order_str = get(row, 'lesson_order');

      // Skip fully empty rows
      if (!course_code && !course_title && !module_title && !lesson_title) return;

      // Validate required fields
      if (!course_code) {
        errors.push({ row: rowNumber, error: 'course_code is required' });
        return;
      }
      if (!course_title) {
        errors.push({ row: rowNumber, error: 'course_title is required' });
        return;
      }
      if (!module_title) {
        errors.push({ row: rowNumber, error: 'module_title is required' });
        return;
      }
      const module_order = Number(module_order_str);
      if (!module_order || module_order < 1) {
        errors.push({ row: rowNumber, error: 'module_order must be a positive integer' });
        return;
      }
      if (!lesson_title) {
        errors.push({ row: rowNumber, error: 'lesson_title is required' });
        return;
      }
      const lesson_order = Number(lesson_order_str);
      if (!lesson_order || lesson_order < 1) {
        errors.push({ row: rowNumber, error: 'lesson_order must be a positive integer' });
        return;
      }

      // Get or create course
      if (!courseMap.has(course_code)) {
        // Parse skills from comma-separated string
        const skills = skills_str
          ? skills_str.split(',').map(s => s.trim()).filter(Boolean)
          : [];

        courseMap.set(course_code, {
          course_code,
          course_title,
          course_description: get(row, 'course_description'),
          university: get(row, 'university'),
          category: get(row, 'category'),
          duration: get(row, 'duration'),
          credits: Number(get(row, 'credits')) || undefined,
          skills,
          modules: [],
        });
      }

      const course = courseMap.get(course_code)!;

      // Get or create module
      let module = course.modules.find((m) => m.module_order === module_order);
      if (!module) {
        module = {
          module_title,
          module_order,
          module_description: get(row, 'module_description'),
          lessons: [],
        };
        course.modules.push(module);
      }

      // Get or create lesson
      let lesson = module.lessons.find((l) => l.lesson_order === lesson_order);
      if (!lesson) {
        lesson = {
          lesson_title,
          lesson_order,
          lesson_content: get(row, 'lesson_content'),
          lesson_duration: get(row, 'lesson_duration'),
          resources: [],
        };
        module.lessons.push(lesson);
      }

      // Parse resource if provided
      const resource_name = get(row, 'resource_name');
      const resource_type = get(row, 'resource_type').toLowerCase();
      const resource_url = get(row, 'resource_url');
      const file_path = get(row, 'file_path');

      if (resource_name || resource_type || resource_url || file_path) {
        if (!resource_name) {
          errors.push({ row: rowNumber, error: 'resource_name is required when adding resources' });
          return;
        }
        const typeError = validateResourceType(resource_type);
        if (typeError) {
          errors.push({ row: rowNumber, error: `resource_type must be one of: ${CANONICAL_RESOURCE_TYPE_IDS.join(', ')}` });
          return;
        }
        if (!resource_url && !file_path) {
          errors.push({ row: rowNumber, error: 'Either resource_url or file_path is required' });
          return;
        }
        if (file_path && !uploadedNames.has(file_path) && !uploadedNames.has(file_path.split('/').pop() || '')) {
          errors.push({ row: rowNumber, error: `file_path '${file_path}' does not match any uploaded file` });
          return;
        }
        // Canonical URL check (upload types with explicit URL must be safe).
        const urlError = validateResourceUrl(resource_url, resource_type);
        if (urlError && (resource_url || ['youtube', 'link', 'drive'].includes(resource_type))) {
          errors.push({ row: rowNumber, error: urlError });
          return;
        }

        // Duplicate-row detection (same lesson + resource identity).
        const rowKey = `${course_code}|${module_order_str}|${lesson_order_str}|${resource_type}|${resource_name.toLowerCase()}|${resource_url || file_path}`;
        if (seenRowKeys.has(rowKey)) {
          errors.push({ row: rowNumber, error: 'Duplicate resource row (same lesson, name and URL/file)' });
          return;
        }
        seenRowKeys.add(rowKey);

        lesson.resources.push({
          resource_name,
          resource_type,
          resource_url,
          file_path,
          rowNumber,
        });
      }
    });

    if (courseMap.size === 0) {
      const errorSummary = errors.length > 0
        ? `All row(s) have errors. First 5: ${errors.slice(0, 5).map(e => `Row ${e.row}: ${e.error}`).join('; ')}`
        : 'Template has no filled rows. Please fill in the template with course data.';

      return NextResponse.json(
        { success: false, error: 'No valid courses found in template', details: errorSummary, errors },
        { status: 400 }
      );
    }

    // Sort modules and lessons by order
    const courses = Array.from(courseMap.values());
    if (courses.length > BULK_MAX_COURSES_PER_BATCH) {
      return NextResponse.json(
        { success: false, error: `Import exceeds ${BULK_MAX_COURSES_PER_BATCH} courses. Split the template and retry.`, errors },
        { status: 400 }
      );
    }
    for (const course of courses) {
      course.modules.sort((a, b) => a.module_order - b.module_order);
      for (const module of course.modules) {
        module.lessons.sort((a, b) => a.lesson_order - b.lesson_order);
      }
    }

    const totalModules = courses.reduce((sum, c) => sum + c.modules.length, 0);
    const totalLessons = courses.reduce((sum, c) => sum + c.modules.reduce((s, m) => s + m.lessons.length, 0), 0);
    const totalResources = courses.reduce(
      (sum, c) => sum + c.modules.reduce((s, m) => s + m.lessons.reduce((ls, l) => ls + l.resources.length, 0), 0),
      0
    );
    const filesToUpload = courses.reduce(
      (sum, c) => sum + c.modules.reduce((s, m) => s + m.lessons.reduce((ls, l) => ls + l.resources.filter(r => r.file_path).length, 0), 0),
      0
    );

    // Persist a bounded reference snapshot so process can warn on stale
    // previews. The client always resubmits full courses; process revalidates.
    const previewId = saveBulkPreview(
      courses.slice(0, 50).flatMap((c) => (c.modules || []).slice(0, 5).flatMap((m) => (m.lessons || []).slice(0, 5).flatMap((l) => (l.resources || []).slice(0, 4).map((r) => ({
        rowNumber: r.rowNumber,
        course_id: '',
        course_code: c.course_code,
        course_name: c.course_title,
        module_id: '',
        module_title: m.module_title,
        lesson_id: '',
        lesson_title: l.lesson_title,
        resource_name: r.resource_name,
        resource_type: r.resource_type,
        resource_url: r.resource_url || '',
        file_path: r.file_path || '',
        file_size: '',
        thumbnail_url: '',
        embed_url: '',
        order_index: 0,
        notes: '',
      }))))) .slice(0, 200),
      uploadedFiles.map((f) => f.name),
    );

    return NextResponse.json({
      success: true,
      previewId,
      totalCourses: courses.length,
      totalModules,
      totalLessons,
      totalResources,
      filesToUpload,
      courses,
      errors,
    });
  } catch (error) {
    logger.error('Failed to parse bulk course template', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to parse template', details: (error as Error).message },
      { status: 500 }
    );
  }
}
