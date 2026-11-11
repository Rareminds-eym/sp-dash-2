import { beforeEach, afterEach, expect, it, vi } from 'vitest';
beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-11T00:00:00Z')); });
afterEach(() => vi.useRealTimers());
it('coalesces wake signals from a bulk import and releases RPC results', async () => {
 const { wakeJobIndex } = await import('../wake-job-index');
 const dispose = vi.fn(), kickJobIndexing = vi.fn(async () => ({accepted:true,[Symbol.dispose]:dispose}));
 const env={JOB_INDEX_SERVICE:{kickJobIndexing}};
 await Promise.all(Array.from({length:50},()=>wakeJobIndex(env)));
 expect(kickJobIndexing).toHaveBeenCalledTimes(1); expect(dispose).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(30000); await wakeJobIndex(env);
 expect(kickJobIndexing).toHaveBeenCalledTimes(2);
});
it('an indexing outage cannot fail a committed job or cause a wake stampede',async()=>{
 const { wakeJobIndex } = await import('../wake-job-index');
 const kickJobIndexing=vi.fn(async()=>{throw new Error('offline');});const env={JOB_INDEX_SERVICE:{kickJobIndexing}};
 await expect(wakeJobIndex(env)).resolves.toBeUndefined();
 await Promise.all(Array.from({length:50},()=>wakeJobIndex(env)));
 expect(kickJobIndexing).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(30000); await wakeJobIndex(env);
 expect(kickJobIndexing).toHaveBeenCalledTimes(2);
});
it('bounds a hanging wake without changing the committed write result',async()=>{
 const { wakeJobIndex } = await import('../wake-job-index');
 const kickJobIndexing=vi.fn(()=>new Promise(()=>{}));
 const pending=wakeJobIndex({JOB_INDEX_SERVICE:{kickJobIndexing}});
 await vi.advanceTimersByTimeAsync(3000); await expect(pending).resolves.toBeUndefined();
 expect(vi.getTimerCount()).toBe(0);
});
