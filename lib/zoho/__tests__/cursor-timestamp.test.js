import { describe, expect, it, vi } from 'vitest';
import { cursorTimestamp } from '../cursor-timestamp';
import { createZohoControlPlane } from '../control-plane';

describe('query timestamp cursors', () => {
  it.each(['Candidates', 'Job_Openings'])('preserves the exact %s cursor through adapter query decoding', async module => {
    const timestamp = '2026-11-12T07:22:25.407343+00:00';
    const id = '84835121-aace-40aa-9a11-93cfbdc1beb1';
    const query = new URLSearchParams({ connectionId: id, module, state: 'pending_approval',
      before: cursorTimestamp(timestamp), beforeId: id });
    // Model the extra decoding observed in deployed QA before URLSearchParams.
    const input = Object.fromEntries(new URLSearchParams(decodeURIComponent(query.toString())));
    const rpc = vi.fn(async () => ({ data: { records: [] }, error: null }));
    await createZohoControlPlane({ rpc }).reviewPage(input);
    expect(rpc).toHaveBeenCalledWith('zoho_review_page', expect.objectContaining({
      p_before: '2026-11-12T07:22:25.407343Z', p_before_id: id,
    }));
    expect(cursorTimestamp(timestamp)).toBe('2026-11-12T07:22:25.407343Z');
  });

  it('preserves UTC cursors and fractional precision without rounding', () => {
    for (const timestamp of ['2026-11-12T07:22:25Z', '2026-11-12T07:22:25.000001Z',
      '2026-11-12T07:22:25.999999Z']) expect(cursorTimestamp(timestamp)).toBe(timestamp);
  });
});
