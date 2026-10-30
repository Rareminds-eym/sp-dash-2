import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import * as ExcelJS from 'exceljs';
vi.mock('@/lib/middleware/sso-auth', () => ({ authenticateSSORequest: vi.fn(async () => ({ user: { id: 'admin' }, error: null })) }));
vi.mock('@/lib/services/course-upload-runtime', () => ({ isCourseUploadWorkerRequest: vi.fn(async () => true) }));
import { GET } from '@/app/api/courses/bulk-upload/export-template/route';
import { POST } from '@/app/api/courses/bulk-upload/preview/route';

async function workbook() {
  const response = await GET(new NextRequest('http://localhost/api/courses/bulk-upload/export-template?sample=true'));
  const w = new ExcelJS.Workbook();
  await w.xlsx.load(Buffer.from(await response.arrayBuffer()) as never);
  return w;
}
async function preview(w: ExcelJS.Workbook) {
  const form = new FormData();
  form.append('template', new File([await w.xlsx.writeBuffer() as ArrayBuffer], 'course.xlsx'));
  form.append('fileNames', JSON.stringify([]));
  const response = await POST(new NextRequest('http://localhost/api/courses/bulk-upload/preview', { method: 'POST', body: form }));
  return { status: response.status, body: await response.json() };
}

describe('slide quiz workbook preview', () => {
  it('attaches validated questions to the correct PPTX', async () => {
    const result = await preview(await workbook());
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ totalQuizQuestions: 1 });
    const resources = result.body.courses[0].modules[0].lessons[0].resources;
    expect(resources.find((r: any) => r.resource_name === 'Python Slides').slide_questions[0]).toMatchObject({ slide_number: 4, correct_option: 'A' });
  });
  it('accepts older workbooks without a Quiz sheet', async () => {
    const w = await workbook(); w.removeWorksheet(w.getWorksheet('Quiz')!.id);
    const result = await preview(w);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ totalQuizQuestions: 0 });
  });
  it('attaches six questions on one slide in spreadsheet order', async () => {
    const w = await workbook(); const sheet = w.getWorksheet('Quiz')!;
    for (let n = 2; n <= 6; n++) sheet.addRow(['PY101', 1, 1, 'Python Slides', 4, `Question ${n}`, 'A', 'B', 'C', 'D', 'B']);
    const result = await preview(w);
    expect(result.status).toBe(200);
    const resources = result.body.courses[0].modules[0].lessons[0].resources;
    const questions = resources.find((r: any) => r.resource_name === 'Python Slides').slide_questions;
    expect(questions).toHaveLength(6);
    expect(questions.map((q: any) => q.slide_number)).toEqual([4, 4, 4, 4, 4, 4]);
    expect(questions[5].question).toBe('Question 6');
  });
  it.each([['E2', 0, 'slide_number'], ['K2', 'E', 'correct_option'], ['D2', 'Unknown.pptx', 'resource_name']])('rejects invalid %s', async (cell, value, field) => {
    const w = await workbook(); w.getWorksheet('Quiz')!.getCell(cell).value = value;
    const result = await preview(w);
    expect(result.status).toBe(400);
    expect(result.body.errors[0].error).toContain(field);
  });
});
