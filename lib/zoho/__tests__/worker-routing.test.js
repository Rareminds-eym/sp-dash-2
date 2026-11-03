import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ fetch: vi.fn(), lte: vi.fn(), course: vi.fn(), zoho: vi.fn(), scheduled: vi.fn() }));
vi.mock('../../../workers/lte-asset-validation-consumer.ts', () => ({ default: { queue: f.lte } }));
vi.mock('../../../workers/course-upload-consumer.ts', () => ({ default: { queue: f.course } }));
vi.mock('../runtime', () => ({ integrationRuntime: () => ({ queue: f.zoho, scheduled: f.scheduled }) }));
import { dashboardRuntime } from '../../dashboard-runtime';
const worker = dashboardRuntime({ fetch: f.fetch });
beforeEach(() => { vi.clearAllMocks(); f.zoho.mockResolvedValue(false); });
describe('existing worker queue routing', () => {
  it('preserves HTTP forwarding, course and LTE queue handlers', async () => {
    const request = new Request('https://dash.example/'); const env = {}; const ctx = {};
    worker.fetch(request, env, ctx); expect(f.fetch).toHaveBeenCalledWith(request, env, ctx);
    const course = { queue: 'course-management-uploads-dev', messages: [] };
    await worker.queue(course, env, ctx); expect(f.course).toHaveBeenCalledExactlyOnceWith(course, env, ctx);
    const lte = { queue: 'lte-asset-validation-dev', messages: [] };
    await worker.queue(lte, env, ctx); expect(f.lte).toHaveBeenCalledExactlyOnceWith(lte, env, ctx);
  });
  it('does not pass handled or mismatched Zoho queues to unrelated consumers', async () => {
    f.zoho.mockResolvedValueOnce(true);
    await worker.queue({ queue: 'zoho-recruit-discovery-dev', messages: [] }, {}, {});
    const message = { retry: vi.fn() };
    await worker.queue({ queue: 'zoho-recruit-approved-qa', messages: [message] }, {}, {});
    expect(message.retry).toHaveBeenCalledWith({ delaySeconds: 300 });
    expect(f.lte).not.toHaveBeenCalled(); expect(f.course).not.toHaveBeenCalled();
  });
  it('delegates recovery to the same runtime', async () => {
    const controller = { cron: '*/2 * * * *' }; const env = {};
    await worker.scheduled(controller, env); expect(f.scheduled).toHaveBeenCalledWith(controller);
  });
});
