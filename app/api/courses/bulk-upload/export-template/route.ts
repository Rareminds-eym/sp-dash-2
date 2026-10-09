import { NextRequest, NextResponse } from 'next/server';
import * as ExcelJS from 'exceljs';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';

export const runtime = 'nodejs';

const TEMPLATE_COLUMNS = [
  { header: 'course_code', key: 'course_code', width: 15 },
  { header: 'course_title', key: 'course_title', width: 30 },
  { header: 'course_description', key: 'course_description', width: 50 },
  { header: 'university', key: 'university', width: 20 },
  { header: 'category', key: 'category', width: 15 },
  { header: 'duration', key: 'duration', width: 15 },
  { header: 'credits', key: 'credits', width: 10 },
  { header: 'skills', key: 'skills', width: 40 },
  { header: 'module_title', key: 'module_title', width: 30 },
  { header: 'module_order', key: 'module_order', width: 12 },
  { header: 'module_description', key: 'module_description', width: 40 },
  { header: 'lesson_title', key: 'lesson_title', width: 30 },
  { header: 'lesson_order', key: 'lesson_order', width: 12 },
  { header: 'lesson_content', key: 'lesson_content', width: 50 },
  { header: 'lesson_duration', key: 'lesson_duration', width: 15 },
  { header: 'resource_name', key: 'resource_name', width: 30 },
  { header: 'resource_type', key: 'resource_type', width: 15 },
  { header: 'resource_url', key: 'resource_url', width: 50 },
  { header: 'file_path', key: 'file_path', width: 40 },
];

const INSTRUCTIONS = [
  'BULK COURSE UPLOAD - INSTRUCTIONS',
  '',
  'This template creates BRAND NEW COURSES from scratch.',
  '',
  '1. Each row represents ONE LESSON in your course structure',
  '2. Group lessons by course using the same course_code (e.g., PY101, JS201)',
  '3. Duplicate course info (title, description, etc.) for each lesson in that course',
  '4. module_order and lesson_order determine the sequence (1, 2, 3...)',
  '',
  'REQUIRED FIELDS:',
  '  - course_code: Unique identifier (e.g., PY101)',
  '  - course_title: Course name',
  '  - module_title: Module/chapter name',
  '  - module_order: Integer (1, 2, 3...)',
  '  - lesson_title: Lesson name',
  '  - lesson_order: Integer (1, 2, 3...)',
  '',
  'OPTIONAL FIELDS:',
  '  - course_description, university, category, duration, credits',
  '  - skills: Comma-separated list (e.g., "Python, Programming, Web Development")',
  '  - module_description',
  '  - lesson_content, lesson_duration',
  '  - resource_name, resource_type, resource_url, file_path',
  '',
  'EXAMPLE:',
  'course_code | course_title  | skills                    | module_title | module_order | lesson_title   | lesson_order',
  'PY101       | Python Basics | Python, Programming, Web  | Introduction | 1            | What is Python | 1',
  'PY101       | Python Basics | Python, Programming, Web  | Introduction | 1            | Installation   | 2',
  'PY101       | Python Basics | Python, Programming, Web  | Variables    | 2            | Basic Types    | 1',
  '',
  'RESOURCE TYPES: pdf, video, youtube, document, image, link',
  '',
  '5. Save and upload via Course Management > Bulk Resources > Import New Courses',
];

/**
 * GET /api/courses/bulk-upload/export-template
 * Downloads a blank Excel template for creating new courses
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateSSORequest(request, [
      'admin',
      'super_admin',
      'rm_admin',
    ]);
    if (authError || !user) {
      return authError || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const withSample = url.searchParams.get('sample') === 'true';

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Course Management';
    workbook.created = new Date();

    // Instructions sheet
    const instructionsSheet = workbook.addWorksheet('Instructions');
    instructionsSheet.columns = [{ header: '', key: 'instructions', width: 100 }];
    for (const line of INSTRUCTIONS) {
      instructionsSheet.addRow({ instructions: line });
    }
    instructionsSheet.getRow(1).font = { bold: true, size: 14 };

    // Course_Upload sheet
    const sheet = workbook.addWorksheet('Course_Upload');
    sheet.columns = TEMPLATE_COLUMNS;
    
    // Add header row
    sheet.addRow(Object.fromEntries(TEMPLATE_COLUMNS.map((c) => [c.key, c.header])));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Add sample data if requested
    if (withSample) {
      const sampleData = [
        {
          course_code: 'PY101',
          course_title: 'Python for Beginners',
          course_description: 'Learn Python programming from scratch',
          university: 'MIT',
          category: 'Computer Science',
          duration: '40 hours',
          credits: 3,
          skills: 'Python, Programming, Web Development',
          module_title: 'Introduction to Python',
          module_order: 1,
          module_description: 'Get started with Python basics',
          lesson_title: 'What is Python?',
          lesson_order: 1,
          lesson_content: 'Python is a high-level programming language...',
          lesson_duration: '30 minutes',
          resource_name: 'Python Introduction Video',
          resource_type: 'youtube',
          resource_url: 'https://youtube.com/watch?v=example',
          file_path: '',
        },
        {
          course_code: 'PY101',
          course_title: 'Python for Beginners',
          course_description: 'Learn Python programming from scratch',
          university: 'MIT',
          category: 'Computer Science',
          duration: '40 hours',
          credits: 3,
          skills: 'Python, Programming, Web Development',
          module_title: 'Introduction to Python',
          module_order: 1,
          module_description: 'Get started with Python basics',
          lesson_title: 'Installing Python',
          lesson_order: 2,
          lesson_content: 'Download and install Python on your computer...',
          lesson_duration: '20 minutes',
          resource_name: 'Installation Guide',
          resource_type: 'pdf',
          resource_url: '',
          file_path: 'python-install-guide.pdf',
        },
        {
          course_code: 'PY101',
          course_title: 'Python for Beginners',
          course_description: 'Learn Python programming from scratch',
          university: 'MIT',
          category: 'Computer Science',
          duration: '40 hours',
          credits: 3,
          skills: 'Python, Programming, Web Development',
          module_title: 'Variables and Data Types',
          module_order: 2,
          module_description: 'Understanding variables in Python',
          lesson_title: 'Basic Data Types',
          lesson_order: 1,
          lesson_content: 'Python has several built-in data types...',
          lesson_duration: '45 minutes',
          resource_name: 'Python Documentation',
          resource_type: 'link',
          resource_url: 'https://docs.python.org/3/tutorial/introduction.html',
          file_path: '',
        },
      ];

      for (const row of sampleData) {
        sheet.addRow(row);
      }
    }

    // Data validation for resource_type column (column P)
    const sheetWithValidation = sheet as unknown as {
      dataValidations: { add: (ref: string, opts: object) => void };
    };
    sheetWithValidation.dataValidations.add('P2:P1000', {
      type: 'list',
      allowBlank: true,
      formulae: ['"pdf,video,youtube,document,image,link"'],
      showErrorMessage: true,
      errorTitle: 'Invalid type',
      error: 'Allowed: pdf, video, youtube, document, image, link',
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = withSample 
      ? `bulk-course-upload-sample-${dateStamp}.xlsx`
      : `bulk-course-upload-template-${dateStamp}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[Bulk Course Upload] Template export error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export template', details: (error as Error).message },
      { status: 500 }
    );
  }
}
