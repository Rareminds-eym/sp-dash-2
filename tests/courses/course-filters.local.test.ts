import { beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/middleware/sso-auth', () => ({ authenticateSSORequest: async () => ({ user: { id: 'local-check', role: 'admin' }, error: null }) }));
vi.mock('@/lib/supabase-admin', async () => {
    if (process.env.COURSE_FILTERS_LOCAL_TEST !== '1') return { supabaseAdmin: {} };
    const { readFileSync } = await import('node:fs');
    const { parse } = await import('dotenv');
    const { createClient } = await import('@supabase/supabase-js');
    const env = parse(readFileSync('.env.local'));
    const url = env.SKILLPASSPORT_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
    if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Filter checks require the local database');
    return { supabaseAdmin: createClient(url, env.SKILLPASSPORT_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }) };
});
import { GET } from '@/app/api/courses/route';

import { supabaseAdmin } from '@/lib/supabase-admin';

// Read-only integration checks; authentication is mocked, queries use local Postgres.
describe.skipIf(process.env.COURSE_FILTERS_LOCAL_TEST !== '1')('course filters against local catalog', () => {
    let rows: any[];
    beforeAll(async () => {
        const result = await supabaseAdmin.from('courses').select('course_id,title,code,description,category,university,status,approval_status,created_at,credits').is('deleted_at', null);
        if (result.error) throw result.error;
        rows = result.data!;
    });
    async function list(params = '') {
        const response = await GET(new Request(`http://localhost:3000/api/courses?limit=100&${params}`));
        expect(response.status).toBe(200);
        return response.json();
    }
    it('offers the actual saved categories and universities', async () => {
        const response = await GET(new Request('http://localhost:3000/api/courses?filter_options=true'));
        const { data } = await response.json();
        for (const field of ['category', 'university']) {
            const expected = [...new Set(rows.map(row => row[field]).filter(value => value?.trim()))].sort((a: any, b: any) => a.localeCompare(b));
            expect(data[field === 'category' ? 'categories' : 'universities']).toEqual(expected);
        }
    });
    it.each(['approved', 'pending', 'rejected'])('filters approval state %s', async state => {
        const result = await list(`approval_status=${state}`);
        expect(result.pagination.total).toBe(rows.filter(row => row.approval_status === state).length);
        expect(result.data.every((row: any) => row.approval_status === state)).toBe(true);
    });
    it.each(['Active', 'Upcoming', 'Draft', 'Archived'])('filters %s using course status, including bulk selection', async status => {
        const expected = rows.filter(row => row.status === status).length;
        const result = await list(`status=${status}`);
        expect(result.pagination.total).toBe(expected);
        expect(result.data.every((row: any) => row.status === status)).toBe(true);
        expect((await list(`status=${status}&all=true`)).data).toHaveLength(expected);
    });
    it('filters a real category and combined approval state', async () => {
        const category = rows.find(row => row.category)?.category;
        expect(category).toBeTruthy();
        const result = await list(`category=${encodeURIComponent(category)}&approval_status=pending`);
        expect(result.pagination.total).toBe(rows.filter(row => row.category === category && row.approval_status === 'pending').length);
        expect(result.data.every((row: any) => row.category === category && row.approval_status === 'pending')).toBe(true);
    });
    it('searches course titles and codes', async () => {
        for (const term of ['SQL', 'CS1']) {
            const result = await list(`search=${term}`);
            const expected = rows.filter(row => [row.title, row.code, row.description].some(value => value?.toLowerCase().includes(term.toLowerCase())));
            expect(result.pagination.total).toBe(expected.length);
        }
    });
    it('returns no courses for an unassigned university', async () => {
        expect((await list('university=__unassigned_filter_check__')).pagination.total).toBe(0);
    });
    it.each(['date-newest', 'date-oldest', 'credits-desc'])('sorts %s', async sort => {
        const result = await list(`sort=${sort}`);
        const values = result.data.map((row: any) => sort === 'credits-desc' ? row.credits : Date.parse(row.created_at)).filter((value: any) => value !== null);
        for (let i = 1; i < values.length; i++) {
            if (sort === 'date-oldest') expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
            else expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
        }
    });
    it('keeps pagination stable between consecutive pages', async () => {
        const first = await list('page=1'); const second = await list('page=2');
        const firstIds = new Set(first.data.map((row: any) => row.id));
        expect(second.data.some((row: any) => firstIds.has(row.id))).toBe(false);
        expect(first.pagination.total).toBe(rows.length);
    });
    it.each([
        ['name-asc', 'title', true],
        ['name-desc', 'title', false],
        ['university-asc', 'university', true],
    ] as const)('maps %s to the correct database sort', async (sort, column, ascending) => {
        const result = await list(`sort=${sort}`);
        const expected = await supabaseAdmin.from('courses').select('course_id')
            .is('deleted_at', null).order(column, { ascending, nullsFirst: false })
            .order('course_id', { ascending: true }).range(0, 99);
        expect(expected.error).toBeNull();
        expect(result.data.map((row: any) => row.id)).toEqual(expected.data?.map(row => row.course_id));
    });
});
