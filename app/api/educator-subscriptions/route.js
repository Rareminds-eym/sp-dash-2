import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

import Logger from '@/lib/logger';
import { EDUCATOR_EVENT_100K } from '@/lib/educator-events';


const logger = new Logger('EducatorSubscriptionsAPI');

// Query parameters the SSO Worker RPC understands.
const FORWARDED_PARAMS = ['page', 'limit', 'search', 'planType', 'status', 'startDate', 'endDate', 'export'];

// SkillPassport reads are paged/chunked to stay under PostgREST's ~1000 row cap and URL limits.
const SP_PAGE_SIZE = 1000;
const SP_MAX_PAGES = 100;
const SP_ID_CHUNK = 100;

/**
 * Educators registered directly in SkillPassport. They are identified by the internal database
 * condition learners.learner_type = 'teacher'; no other learner type is added.
 * Throws on failure, so the page shows an error instead of silently leaving this group out.
 */
async function fetchEducatorLearners() {
  const educators = [];
  for (let page = 0; page < SP_MAX_PAGES; page++) {
    const from = page * SP_PAGE_SIZE;
    const { data, error } = await supabaseAdmin
      .from('learners')
      .select('user_id, name')
      .eq('learner_type', 'teacher')
      .not('user_id', 'is', null)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('user_id')
      .range(from, from + SP_PAGE_SIZE - 1);

    if (error) throw error;
    (data || []).forEach(row => { educators.push({ id: row.user_id, name: row.name || '' }); });
    if (!data || data.length < SP_PAGE_SIZE) break;
  }
  return educators;
}

/**
 * Event markers (learners.metadata.events) for the educators being returned, keyed by user id.
 * Only the events field is read — no other metadata. Label-only lookups fail softly and
 * all-or-nothing. When explicitly filtering by event, a failed lookup must surface an error
 * instead of returning an incomplete or misleading empty result.
 */
async function fetchEventsByUserId(userIds, required = false) {
  try {
    const eventsByUser = new Map();
    for (let i = 0; i < userIds.length; i += SP_ID_CHUNK) {
      const { data, error } = await supabaseAdmin
        .from('learners')
        .select('user_id, events:metadata->events')
        .in('user_id', userIds.slice(i, i + SP_ID_CHUNK));

      if (error) throw error;
      (data || []).forEach(row => {
        if (Array.isArray(row.events)) {
          eventsByUser.set(row.user_id, row.events.filter(event => typeof event === 'string'));
        }
      });
    }
    return eventsByUser;
  } catch (err) {
    if (required) throw err;
    logger.warn('Failed to fetch educator events from SkillPassport', { error: err.message });
    return new Map();
  }
}

/**
 * Ids of SkillPassport users whose real name contains the search text. SSO has no reliable
 * names, so this lets "search by name" work across the whole list. Fail-soft: the SSO-side
 * name/email search still works if this lookup fails.
 */
async function findUserIdsByName(search) {
  const words = search
    .split(/\s+/)
    .map(word => word.replace(/[%,()*\\"]/g, ''))
    .filter(Boolean)
    .slice(0, 5);
  if (words.length === 0) return [];

  try {
    const orFilter = words
      .flatMap(word => [`"firstName".ilike.%${word}%`, `"lastName".ilike.%${word}%`])
      .join(',');
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, "firstName", "lastName"')
      .or(orFilter)
      .limit(SP_PAGE_SIZE);

    if (error) throw error;
    const needle = search.trim().toLowerCase();
    return (data || [])
      .filter(user => `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase().includes(needle))
      .map(user => user.id);
  } catch (err) {
    logger.warn('Failed to search SkillPassport user names', { error: err.message });
    return [];
  }
}

/**
 * GET /api/educator-subscriptions
 *
 * Current subscription of every educator, from two groups merged into one list:
 *   1. Organization educators — SSO roles educator / school_educator / college_educator
 *      (personal subscription first, otherwise their organization's subscription).
 *   2. Educators registered in SkillPassport — identified by the internal condition
 *      learners.learner_type = 'teacher' (personal subscription only).
 * Pagination and filtering happen in the SSO Worker RPC, like /api/sales/clients, after the
 * two groups are merged; this layer only adds the educator list, the real names and the
 * event labels. An optional event filter narrows the eligible result set before pagination;
 * it does not change educator eligibility or subscription selection.
 *
 * Query: page, limit, search, planType (freemium|premium|other), status, startDate, endDate,
 *        event=100k educators, export=true (every matching row, for the CSV download)
 */
export async function GET(request) {
  try {
    const { error } = await authenticateSSORequest(request, ['super_admin', 'admin', 'rm_admin']);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const event = searchParams.get('event');
    if (event && event !== EDUCATOR_EVENT_100K) {
      return NextResponse.json({ error: 'Invalid educator event filter' }, { status: 400 });
    }
    const rpcParams = new URLSearchParams();
    for (const key of FORWARDED_PARAMS) {
      const value = searchParams.get(key);
      if (value) rpcParams.set(key, value);
    }
    // SSO knows eligibility/subscriptions, but not SkillPassport events. Obtain the full
    // matching eligible set for event filtering, then paginate locally below.
    if (event) rpcParams.set('export', 'true');

    let educatorLearners;
    try {
      educatorLearners = await fetchEducatorLearners();
    } catch (spError) {
      logger.error('Failed to fetch educators from SkillPassport', { error: spError.message });
      return NextResponse.json(
        { error: 'Failed to fetch educator subscriptions' },
        { status: 500 }
      );
    }

    const search = searchParams.get('search')?.trim();
    const nameMatchIds = search ? await findUserIdsByName(search) : [];

    const { createSSOServiceClient } = await import('@/lib/sso-service-client');
    const ssoClient = await createSSOServiceClient();

    let ssoData;
    try {
      // `teachers` is the SSO RPC's option name (kept as is, so the SSO worker needs no change).
      ssoData = await ssoClient.getEducatorSubscriptions(rpcParams.toString(), { teachers: educatorLearners, nameMatchIds });
    } catch (ssoError) {
      logger.error('SSO Worker RPC error', { error: ssoError.message });
      return NextResponse.json(
        { error: 'Failed to fetch educator subscriptions' },
        { status: 500 }
      );
    }

    const educators = ssoData?.data || [];

    // Real names from SkillPassport (SSO has the email, not a reliable name).
    const spUserMap = {};
    if (educators.length > 0) {
      try {
        const ids = educators.map(e => e.id);
        for (let i = 0; i < ids.length; i += SP_ID_CHUNK) {
          const { data: spUsers, error: spError } = await supabaseAdmin
            .from('users')
            .select('id, "firstName", "lastName"')
            .in('id', ids.slice(i, i + SP_ID_CHUNK));

          if (!spError && spUsers) {
            spUsers.forEach(spUser => { spUserMap[spUser.id] = spUser; });
          }
        }
      } catch (err) {
        logger.warn('Failed to fetch SkillPassport user names', { error: err.message });
      }
    }

    // Event labels for the educators being returned (empty when none, or if the lookup fails).
    const eventsByUser = educators.length > 0
      ? await fetchEventsByUserId(educators.map(e => e.id), Boolean(event))
      : new Map();

    const enriched = educators.map(educator => {
      const spUser = spUserMap[educator.id];
      const spName = `${spUser?.firstName || ''} ${spUser?.lastName || ''}`.trim();
      return {
        ...educator,
        name: spName || educator.name || educator.email,
        events: eventsByUser.get(educator.id) ?? [],
      };
    });

    const page = ssoData?.pagination?.page ?? 1;
    const limit = ssoData?.pagination?.limit ?? 20;
    if (event) {
      const matching = enriched.filter(educator => educator.events.includes(event));
      if (searchParams.get('export') === 'true') {
        return NextResponse.json({
          data: matching,
          pagination: { page: 1, limit: matching.length, total: matching.length, totalPages: 1 },
        });
      }
      const rawPage = Number(searchParams.get('page') ?? '1');
      const rawLimit = Number(searchParams.get('limit') ?? '20');
      const requestedPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
      const requestedLimit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20;
      const offset = (requestedPage - 1) * requestedLimit;
      return NextResponse.json({
        data: matching.slice(offset, offset + requestedLimit),
        pagination: { page: requestedPage, limit: requestedLimit, total: matching.length, totalPages: Math.ceil(matching.length / requestedLimit) },
      });
    }
    return NextResponse.json({
      data: enriched,
      pagination: ssoData?.pagination || { page, limit, total: 0, totalPages: 0 },
    });
  } catch (error) {
    logger.error('Error fetching educator subscriptions', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
