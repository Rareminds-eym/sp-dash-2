import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ from: vi.fn(), audit: vi.fn(), auth: vi.fn() }));
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: { from: f.from } }));
vi.mock('@/lib/middleware/sso-auth', () => ({ authenticateSSORequest: f.auth }));
vi.mock('@/lib/services/auditService', () => ({ logAudit: f.audit }));
import { POST } from '@/app/api/courses/route';
import { GET, PUT } from '@/app/api/courses/[id]/route';

const settings = { category: 'Teacher Training', university: 'Example University', skill_type: 'technical', classification: 'teacher', plan_type: 'professional', course_type: 'webinar' };
const body = { title: 'Teaching with AI', code: 'AI-1', description: 'Teacher course', duration: '6 hours', ...settings };
let query: any;
beforeEach(() => {
    vi.clearAllMocks();
    f.auth.mockResolvedValue({ user: { id: null, role: 'admin' }, error: null });
    query = { insert: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { ...body, course_id: 'course', status: 'Active' }, error: null }) };
    f.from.mockReturnValue(query);
});
const request = (method: string, value: any) => new Request('http://localhost:3000/api/courses/course', { method, body: JSON.stringify(value) });
const context = { params: Promise.resolve({ id: 'course' }) };

describe('course settings management', () => {
    it('creates and returns all six settings', async () => {
        const response = await POST(request('POST', body));
        expect(response.status).toBe(201);
        expect(query.insert.mock.calls[0][0][0]).toMatchObject(settings);
        expect((await response.json()).data).toMatchObject(settings);
    });
    it('updates and returns all six settings without replacing the course hierarchy', async () => {
        const response = await PUT(request('PUT', body), context);
        expect(response.status).toBe(200);
        expect(query.update.mock.calls[0][0]).toMatchObject(settings);
        expect((await response.json()).data).toMatchObject(settings);
        expect(f.from.mock.calls.every(([table]: any) => table === 'courses')).toBe(true);
    });
    it('loads the same settings when opening an existing course', async () => {
        const response = await GET(new Request('http://localhost:3000/api/courses/course'), context);
        expect((await response.json()).data).toMatchObject(settings);
    });
    it('preserves omitted settings from older update clients', async () => {
        const response = await PUT(request('PUT', { title: body.title, code: body.code, description: body.description, duration: body.duration }), context);
        expect(response.status).toBe(200);
        const serialized = JSON.parse(JSON.stringify(query.update.mock.calls[0][0]));
        for (const key of Object.keys(settings)) expect(serialized).not.toHaveProperty(key);
    });
    it('allows explicitly clearing optional settings', async () => {
        expect((await PUT(request('PUT', { ...body, category: '', university: '', classification: '', plan_type: '' }), context)).status).toBe(200);
        expect(query.update.mock.calls[0][0]).toMatchObject({ category: null, university: null, classification: null, plan_type: null });
    });
    it.each(['skill_type', 'classification', 'plan_type', 'course_type', 'status', 'approval_status'])('rejects invalid %s before saving', async key => {
        expect((await POST(request('POST', { ...body, [key]: 'invalid-value' }))).status).toBe(400);
        expect((await PUT(request('PUT', { ...body, [key]: 'invalid-value' }), context)).status).toBe(400);
        expect(query.insert).not.toHaveBeenCalled(); expect(query.update).not.toHaveBeenCalled();
    });
    it('loads null legacy values without substituting a paid plan', async () => {
        query.single.mockResolvedValue({ data: { ...body, course_id: 'course', plan_type: null, classification: null }, error: null });
        const response = await GET(new Request('http://localhost:3000/api/courses/course'), context);
        expect((await response.json()).data).toMatchObject({ plan_type: null, classification: null });
    });
    it('saves activation and approval with other edited fields', async () => {
        query.single.mockResolvedValue({ data: { ...body, course_id: 'course', status: 'Active', approval_status: 'approved', category: 'New category' }, error: null });
        const response = await PUT(request('PUT', { ...body, status: 'Active', approval_status: 'approved', category: 'New category' }), context);
        expect(response.status).toBe(200);
        expect(query.update.mock.calls[0][0]).toMatchObject({ status: 'Active', approval_status: 'approved', category: 'New category' });
        expect((await response.json()).data).toMatchObject({ status: 'Active', approval_status: 'approved', category: 'New category' });
    });
    it('does not infer approval from an Active course status', async () => {
        query.single.mockResolvedValue({ data: { ...body, course_id: 'course', status: 'Active', approval_status: 'pending' }, error: null });
        const response = await GET(new Request('http://localhost:3000/api/courses/course'), context);
        expect((await response.json()).data.approval_status).toBe('pending');
    });
    it('prevents non-admin creators from activating or approving their content', async () => {
        f.auth.mockResolvedValue({ user: { id: null, role: 'educator' }, error: null });
        expect((await POST(request('POST', { ...body, status: 'Active', approval_status: 'approved' }))).status).toBe(201);
        expect(query.insert.mock.calls[0][0][0]).toMatchObject({ status: 'Draft', approval_status: 'pending' });
    });
});
