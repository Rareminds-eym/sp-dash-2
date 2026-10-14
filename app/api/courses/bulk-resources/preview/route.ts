import { NextRequest, NextResponse } from 'next/server';
import * as ExcelJS from 'exceljs';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { isCourseUploadWorkerRequest } from '@/lib/services/course-upload-runtime';
import {
  CourseManagementQueueUnavailableError,
  queueBulkCourseManagementJob,
} from '@/lib/services/queue-bulk-course-job';
import {
  ParsedBulkResource,
  saveBulkPreview,
} from '@/lib/services/bulk-preview-store';
import {
  BULK_PREVIEW_MAX_BYTES,
  BULK_PREVIEW_MAX_ROWS,
  BULK_MAX_FILES_PER_REQUEST,
  CANONICAL_RESOURCE_TYPE_IDS,
  validateResourceType,
  validateResourceUrl,
} from '@/lib/services/course-resource-validation';
import Logger from '@/lib/logger';

const logger = new Logger('Bulk Resource Preview');

export const runtime = 'nodejs';

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

/**
 * POST /api/courses/bulk-resources/preview - Parse filled Excel template + match resource files.
 * multipart/form-data: template (File, required), files (File[], optional)
 */
export async function POST(request: NextRequest) {
  try {
    const isInternal = await isCourseUploadWorkerRequest(request);
    let uploaderId = '';
    if (!isInternal && process.env.NODE_ENV !== 'development') {
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

    const formData = await request.formData();
    const template = formData.get('template');
    if (!template || !(template instanceof File)) {
      return NextResponse.json({ success: false, error: 'Excel template file (template) is required' }, { status: 400 });
    }

    const uploadedFiles: File[] = formData.getAll('files').filter((f): f is File => f instanceof File);
    let suppliedFileNames: string[] = [];
    const fileNamesRaw = formData.get('fileNames');
    if (typeof fileNamesRaw === 'string') {
      try {
        const fileNames = JSON.parse(fileNamesRaw);
        if (!Array.isArray(fileNames) || fileNames.some((name) => typeof name !== 'string')) {
          throw new Error('fileNames must be a JSON array of file names.');
        }
        suppliedFileNames = fileNames;
      } catch (error) {
        return NextResponse.json(
          { success: false, error: error instanceof Error ? error.message : 'fileNames must be valid JSON.' },
          { status: 400 },
        );
      }
    }
    if (uploadedFiles.length + suppliedFileNames.length > BULK_MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        { success: false, error: `Maximum ${BULK_MAX_FILES_PER_REQUEST} resource files per import.` },
        { status: 400 },
      );
    }
    const uploadedNames = new Set([
      ...uploadedFiles.map((file) => file.name),
      ...suppliedFileNames,
    ]);

    // Reject oversized workbooks before expensive parsing (Worker memory bound).
    if (template.size > BULK_PREVIEW_MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: `Template exceeds ${(BULK_PREVIEW_MAX_BYTES / 1024 / 1024).toFixed(0)} MB. Split the workbook and retry.` },
        { status: 413 }
      );
    }

    if (!isInternal && process.env.NODE_ENV !== 'development') {
      try {
        const jobId = await queueBulkCourseManagementJob({
          kind: 'bulk-resource-preview',
          ownerId: uploaderId,
          fileName: template.name,
          fileNames: Array.from(uploadedNames),
          template,
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

    const arrayBuffer = await template.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(arrayBuffer));

    const sheet = workbook.getWorksheet('Course_Resources');
    if (!sheet) {
      return NextResponse.json(
        { success: false, error: "Sheet 'Course_Resources' not found. Please use the exported template." },
        { status: 400 }
      );
    }

    // Build header index from first row
    const headerRow = sheet.getRow(1);
    const headerIndex = new Map<string, number>();
    headerRow.eachCell((cell, colNumber) => {
      headerIndex.set(cellValue(cell).trim().toLowerCase(), colNumber);
    });

    const requiredHeaders = ['lesson_id', 'resource_name', 'resource_type'];
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
    const isHeaderRow = (row: ExcelJS.Row): boolean => {
      const headerValues = Array.from(headerIndex.keys());
      const rowValues: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        rowValues.push(cellValue(cell).trim().toLowerCase());
      });
      return rowValues.length === headerValues.length
        && rowValues.every((value, index) => value === headerValues[index]);
    };

    const resources: ParsedBulkResource[] = [];
    const errors: Array<{ row: number; error: string }> = [];
    let filePathRows = 0;
    let dataRowCount = 0;

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1 || isHeaderRow(row)) return;
      dataRowCount += 1;
      // Server-side row cap: never parse unbounded workbooks into memory.
      if (dataRowCount > BULK_PREVIEW_MAX_ROWS) {
        if (dataRowCount === BULK_PREVIEW_MAX_ROWS + 1) {
          errors.push({ row: rowNumber, error: `Workbook exceeds ${BULK_PREVIEW_MAX_ROWS} data rows. Split the template and retry.` });
        }
        return;
      }
      const lesson_id = get(row, 'lesson_id');
      const resource_name = get(row, 'resource_name');
      const resource_type = get(row, 'resource_type').toLowerCase();
      const resource_url = get(row, 'resource_url');
      const file_path = get(row, 'file_path');

      // Skip fully empty rows
      if (!lesson_id && !resource_name && !resource_type && !resource_url && !file_path) return;

      if (!lesson_id) {
        errors.push({ row: rowNumber, error: 'lesson_id is required (do not modify ID columns)' });
        return;
      }
      if (!resource_name) {
        errors.push({ row: rowNumber, error: 'resource_name is required' });
        return;
      }
      if (!resource_type || validateResourceType(resource_type)) {
        errors.push({ row: rowNumber, error: `resource_type must be one of: ${CANONICAL_RESOURCE_TYPE_IDS.join(', ')}` });
        return;
      }
      if (!resource_url && !file_path) {
        errors.push({ row: rowNumber, error: 'Either resource_url or file_path is required' });
        return;
      }
      if (!resource_url && file_path) {
        filePathRows += 1;
        if (!uploadedNames.has(file_path) && !uploadedNames.has(file_path.split('/').pop() || '')) {
          errors.push({ row: rowNumber, error: `file_path '${file_path}' does not match any uploaded file` });
          return;
        }
      }
      const urlError = validateResourceUrl(resource_url, resource_type);
      // Canonical validation for every row: URL-based types require a valid
      // URL; upload types with an explicit URL must also be https/asset-safe
      // (empty URL + file_path is the legitimate pre-upload state).
      if (urlError) {
        if (['youtube', 'link', 'drive'].includes(resource_type) || resource_url) {
          errors.push({ row: rowNumber, error: urlError });
          return;
        }
      }

      const orderRaw = get(row, 'order_index');
      resources.push({
        rowNumber,
        course_id: get(row, 'course_id'),
        course_code: get(row, 'course_code'),
        course_name: get(row, 'course_name'),
        module_id: get(row, 'module_id'),
        module_title: get(row, 'module_title'),
        lesson_id,
        lesson_title: get(row, 'lesson_title'),
        resource_name,
        resource_type,
        resource_url,
        file_path,
        file_size: get(row, 'file_size'),
        thumbnail_url: get(row, 'thumbnail_url'),
        embed_url: get(row, 'embed_url'),
        order_index: orderRaw ? Number(orderRaw) || 0 : 0,
        notes: get(row, 'notes'),
      });
    });

    if (resources.length === 0) {
      const errorSummary = errors.length > 0
        ? (filePathRows > 0 && uploadedNames.size === 0
          ? `No resource files were uploaded. ${filePathRows} row(s) use file_path and require matching files in the Resource Files selection.`
          : `All ${errors.length} row(s) have errors. First 5: ${errors.slice(0, 5).map(e => `Row ${e.row}: ${e.error}`).join('; ')}`)
        : 'Template has no filled rows. Please fill in resource_name, resource_type, and resource_url or file_path for each lesson.';

      return NextResponse.json(
        { success: false, error: 'No valid resources found in template', details: errorSummary, errors },
        { status: 400 }
      );
    }

    const affectedCourses = new Set(
      resources.map((r) => r.course_id).filter(Boolean),
    ).size;
    const filesToUpload = resources.filter((r) => r.file_path).length;

    const previewId = saveBulkPreview(resources, Array.from(uploadedNames));

    return NextResponse.json({
      success: true,
      previewId,
      affectedCourses,
      totalResources: resources.length,
      filesToUpload,
      preview: resources.slice(0, 20),
      resources,
      errors,
    });
  } catch (error) {
    logger.error('Failed to parse bulk resource template', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to parse template', details: (error as Error).message },
      { status: 500 }
    );
  }
}
