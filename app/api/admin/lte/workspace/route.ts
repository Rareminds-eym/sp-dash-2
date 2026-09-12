import { NextRequest, NextResponse } from 'next/server';
import Logger, { getErrorMessage } from '@/lib/logger';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseLTE } from '@/lib/supabase-lte';
import { formatText } from '@/lib/services/lte-ingestion/text-formatter';

const logger = new Logger('LTECatalogWorkspaceAPI');

export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { user, error: authError } = await authenticateSSORequest(request, ['admin', 'super_admin', 'platform_admin']);
    if (authError || !user) {
      return authError || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'summary';
    const id = searchParams.get('id');

    switch (view) {
      case 'dashboard':
        return await handleDashboardView();
      case 'summary':
        return await handleSummaryView();
      case 'capabilities':
        return await handleCapabilitiesView();
      case 'capability_detail':
        return await handleCapabilityDetailView(id);
      case 'roles':
        return await handleRolesView();
      case 'role_detail':
        return await handleRoleDetailView(id);
      case 'courses':
        return await handleCoursesView();
      case 'course_detail':
        return await handleCourseDetailView(id, searchParams.get('source'));
      default:
        return NextResponse.json({ success: false, error: `Invalid view parameter: ${view}` }, { status: 400 });
    }
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error('Catalog Workspace API error', { error: errorMessage });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

/**
 * Load the complete workspace from canonical tables in one authenticated API
 * request. Queries are independent and run concurrently; no upload snapshots,
 * levels, or synthetic rows are used as course fallbacks.
 */
async function handleDashboardView(): Promise<NextResponse> {
  const [capsRes, rolesRes, coursesRes, versionsRes, mapsRes, plansRes, roleCapsRes, reviewRes] = await Promise.all([
    supabaseLTE.from('capabilities').select('id, code, name').eq('is_active', true).order('code'),
    supabaseLTE.from('roles').select('id, role_name').is('deleted_at', null).order('role_name'),
    supabaseLTE.from('courses').select('id, course_code, course_name, lifecycle_status, current_published_version_id, current_assignable_version_id').order('course_code'),
    supabaseLTE.from('course_versions').select('id, course_id, version_no, status'),
    supabaseLTE.from('capability_course_map').select('capability_id, course_id').eq('is_active', true),
    supabaseLTE.from('capability_course_plan').select('capability_id, course_id').eq('is_active', true),
    supabaseLTE.from('role_capability_map').select('role_id, capability_id').eq('is_active', true),
    supabaseLTE.from('lte_catalog_uploads').select('id', { count: 'exact', head: true }).eq('status', 'validated'),
  ]);

  const failures = [capsRes, rolesRes, coursesRes, versionsRes, mapsRes, plansRes, roleCapsRes, reviewRes]
    .map((result, index) => result.error ? `query ${index + 1}: ${result.error.message}` : null)
    .filter(Boolean);
  if (failures.length > 0) throw new Error(`Failed to load catalog workspace: ${failures.join('; ')}`);

  const capabilities = capsRes.data || [];
  const roles = rolesRes.data || [];
  const courses = coursesRes.data || [];
  const versions = versionsRes.data || [];
  const activeCourseIds = new Set(courses.filter(course => course.lifecycle_status !== 'RETIRED').map(course => course.id));
  const activeCapabilityIds = new Set(capabilities.map(capability => capability.id));

  const actualCounts = new Map<string, number>();
  for (const row of mapsRes.data || []) {
    if (activeCourseIds.has(row.course_id)) actualCounts.set(row.capability_id, (actualCounts.get(row.capability_id) || 0) + 1);
  }
  const plannedCounts = new Map<string, number>();
  for (const row of plansRes.data || []) {
    if (activeCourseIds.has(row.course_id)) plannedCounts.set(row.capability_id, (plannedCounts.get(row.capability_id) || 0) + 1);
  }
  const roleCapabilityCounts = new Map<string, number>();
  for (const row of roleCapsRes.data || []) {
    if (activeCapabilityIds.has(row.capability_id)) roleCapabilityCounts.set(row.role_id, (roleCapabilityCounts.get(row.role_id) || 0) + 1);
  }
  const versionById = new Map(versions.map(version => [version.id, version]));

  const capabilityList = capabilities.map(capability => {
    const actualCourseCount = actualCounts.get(capability.id) || 0;
    const plannedCourseCount = plannedCounts.has(capability.id) ? plannedCounts.get(capability.id)! : null;
    let coverageStatus = 'NONE';
    if (plannedCourseCount !== null && plannedCourseCount > 0) {
      coverageStatus = actualCourseCount === 0 ? 'NOT_STARTED'
        : actualCourseCount < plannedCourseCount ? 'PARTIAL'
        : actualCourseCount === plannedCourseCount ? 'COMPLETE'
        : 'OVER_PLAN';
    }
    return { ...capability, actualCourseCount, plannedCourseCount, coverageStatus };
  });

  const courseList = courses.map(course => ({
    ...course,
    rowKey: `course:${course.id}`,
    sourceRecordId: course.id,
    sourceType: 'course',
    course_name: formatText(course.course_name, 'Untitled Course'),
    lifecycle_status: course.lifecycle_status || 'ACTIVE',
    publishedVersionNo: course.current_published_version_id
      ? versionById.get(course.current_published_version_id)?.version_no ?? null
      : null,
    assignableStatus: course.current_assignable_version_id ? 'ASSIGNABLE' : 'PENDING_ASSET_READINESS',
  }));

  return NextResponse.json({
    success: true,
    summary: {
      capabilitiesCount: capabilities.length,
      rolesCount: roles.length,
      coursesLogicalCount: courses.length,
      publishedCoursesCount: courses.filter(course => Boolean(course.current_published_version_id)).length,
      assignableCoursesCount: courses.filter(course => Boolean(course.current_assignable_version_id)).length,
      needsReviewCount: reviewRes.count || 0,
      optionalVersionsCount: versions.length,
    },
    capabilities: capabilityList,
    roles: roles.map(role => ({
      id: role.id,
      code: role.role_name || role.id,
      name: role.role_name,
      activeCapabilityCount: roleCapabilityCounts.get(role.id) || 0,
    })),
    courses: courseList,
  });
}

async function handleSummaryView(): Promise<NextResponse> {
  const [capsRes, rolesRes, coursesRes, publishedRes, assignableRes, reviewRes, versionsRes] = await Promise.all([
    supabaseLTE.from('capabilities').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabaseLTE.from('roles').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabaseLTE.from('courses').select('id', { count: 'exact', head: true }),
    supabaseLTE.from('courses').select('id', { count: 'exact', head: true }).not('current_published_version_id', 'is', null),
    supabaseLTE.from('courses').select('id', { count: 'exact', head: true }).not('current_assignable_version_id', 'is', null),
    supabaseLTE.from('lte_catalog_uploads').select('id', { count: 'exact', head: true }).eq('status', 'validated'),
    supabaseLTE.from('course_versions').select('id', { count: 'exact', head: true }),
  ]);

  return NextResponse.json({
    success: true,
    summary: {
      capabilitiesCount: capsRes.count || 0,
      rolesCount: rolesRes.count || 0,
      coursesLogicalCount: coursesRes.count || 0,
      publishedCoursesCount: publishedRes.count || 0,
      assignableCoursesCount: assignableRes.count || 0,
      needsReviewCount: reviewRes.count || 0,
      optionalVersionsCount: versionsRes.count || 0,
    },
  });
}

async function handleCapabilitiesView(): Promise<NextResponse> {
  const [capsResult, mapsResult, plansResult] = await Promise.all([
    supabaseLTE.from('capabilities').select('*').eq('is_active', true).order('code', { ascending: true }),
    supabaseLTE.from('capability_course_map').select('capability_id, course_id').eq('is_active', true),
    supabaseLTE.from('capability_course_plan').select('capability_id, course_id').eq('is_active', true),
  ]);
  const { data: caps, error } = capsResult;

  if (error) {
    throw new Error(`Failed to fetch capabilities: ${error.message}`);
  }

  if (mapsResult.error) throw new Error(`Failed to fetch actual course mappings: ${mapsResult.error.message}`);
  if (plansResult.error) throw new Error(`Failed to fetch planned course mappings: ${plansResult.error.message}`);
  const mapRows = mapsResult.data;
  const planRows = plansResult.data;

  const actualMapCount = new Map<string, number>();
  const planMapCount = new Map<string, number>();

  (mapRows || []).forEach((r) => actualMapCount.set(r.capability_id, (actualMapCount.get(r.capability_id) || 0) + 1));
  (planRows || []).forEach((r) => planMapCount.set(r.capability_id, (planMapCount.get(r.capability_id) || 0) + 1));

  const list = (caps || []).map((c) => {
    const actualCount = actualMapCount.get(c.id) || 0;
    const plannedCount = planMapCount.get(c.id);

    let coverageStatus = 'NONE';
    if (plannedCount !== undefined && plannedCount > 0) {
      if (actualCount === 0) coverageStatus = 'NOT_STARTED';
      else if (actualCount < plannedCount) coverageStatus = 'PARTIAL';
      else if (actualCount === plannedCount) coverageStatus = 'COMPLETE';
      else coverageStatus = 'OVER_PLAN';
    }

    return {
      id: c.id,
      code: c.code,
      name: c.name || c.code,
      actualCourseCount: actualCount,
      plannedCourseCount: plannedCount ?? null,
      coverageStatus,
    };
  });

  return NextResponse.json({ success: true, capabilities: list });
}

async function handleCapabilityDetailView(id: string | null): Promise<NextResponse> {
  if (!id) return NextResponse.json({ success: false, error: 'Capability ID is required' }, { status: 400 });

  const { data: cap, error } = await supabaseLTE.from('capabilities').select('*').eq('id', id).single();
  if (error || !cap) return NextResponse.json({ success: false, error: 'Capability not found' }, { status: 404 });

  const { data: actualMaps } = await supabaseLTE
    .from('capability_course_map')
    .select('*, courses(*)')
    .eq('capability_id', id)
    .eq('is_active', true);

  const { data: planMaps } = await supabaseLTE
    .from('capability_course_plan')
    .select('*, courses(*)')
    .eq('capability_id', id)
    .eq('is_active', true);

  return NextResponse.json({
    success: true,
    capability: cap,
    actualMappedCourses: actualMaps || [],
    plannedCourses: planMaps || [],
  });
}

async function handleRolesView(): Promise<NextResponse> {
  const [rolesResult, roleCapsResult] = await Promise.all([
    supabaseLTE.from('roles').select('*').is('deleted_at', null).order('role_name', { ascending: true }),
    supabaseLTE.from('role_capability_map').select('role_id').eq('is_active', true),
  ]);
  const { data: roles, error } = rolesResult;
  if (error) throw new Error(`Failed to fetch roles: ${error.message}`);
  if (roleCapsResult.error) throw new Error(`Failed to fetch role capability mappings: ${roleCapsResult.error.message}`);
  const roleCaps = roleCapsResult.data;
  const capCount = new Map<string, number>();
  (roleCaps || []).forEach((r) => capCount.set(r.role_id, (capCount.get(r.role_id) || 0) + 1));

  const list = (roles || []).map((r) => ({
    id: r.id,
    code: r.role_name || r.id,
    name: r.role_name,
    activeCapabilityCount: capCount.get(r.id) || 0,
  }));

  return NextResponse.json({ success: true, roles: list });
}

async function handleRoleDetailView(id: string | null): Promise<NextResponse> {
  if (!id) return NextResponse.json({ success: false, error: 'Role ID is required' }, { status: 400 });

  const { data: role, error } = await supabaseLTE.from('roles').select('*').eq('id', id).single();
  if (error || !role) return NextResponse.json({ success: false, error: 'Role not found' }, { status: 404 });

  const { data: mappedCaps } = await supabaseLTE
    .from('role_capability_map')
    .select('*, capabilities(*)')
    .eq('role_id', id)
    .eq('is_active', true);

  return NextResponse.json({
    success: true,
    role,
    mappedCapabilities: mappedCaps || [],
  });
}

async function handleCoursesView(): Promise<NextResponse> {
  const { data: courses, error } = await supabaseLTE
      .from('courses')
      .select('*, course_versions!current_published_version_id(version_no, status)')
      .order('course_code', { ascending: true });
  if (error) throw new Error(`Failed to fetch courses: ${error.message}`);
  const courseList = (courses || []).map(c => ({
            rowKey: `course:${c.id}`,
            sourceRecordId: c.id,
            sourceType: 'course',
            id: c.id,
            course_code: c.course_code,
            course_name: formatText(c.course_name, 'Untitled Course'),
            lifecycle_status: c.lifecycle_status || 'ACTIVE',
            current_published_version_id: c.current_published_version_id,
            current_assignable_version_id: c.current_assignable_version_id,
            publishedVersionNo: c.course_versions?.version_no ?? null,
            assignableStatus: c.current_assignable_version_id ? 'ASSIGNABLE' : 'PENDING_ASSET_READINESS',
          }));

  return NextResponse.json({ success: true, courses: courseList });
}

async function handleCourseDetailView(id: string | null, source: string | null): Promise<NextResponse> {
  if (!id) return NextResponse.json({ success: false, error: 'Course ID is required' }, { status: 400 });

  if (source && source !== 'course') {
    return NextResponse.json({ success: false, error: 'Only canonical course records are supported.' }, { status: 400 });
  }
  const { data: course, error: courseError } = await supabaseLTE.from('courses').select('*').eq('id', id).single();
  if (courseError || !course) return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
  const [versionsRes, assetsRes] = await Promise.all([
    supabaseLTE
        .from('course_versions')
        .select('*')
        .eq('course_id', id)
        .order('version_no', { ascending: false }),
    supabaseLTE
        .from('version_source_assets')
        .select('*')
        .eq('course_id', id),
  ]);
  if (versionsRes.error) throw new Error(`Failed to fetch course versions: ${versionsRes.error.message}`);
  if (assetsRes.error) throw new Error(`Failed to fetch source assets: ${assetsRes.error.message}`);
  return NextResponse.json({ success: true, course, versions: versionsRes.data || [], sourceAssets: assetsRes.data || [] });
}
