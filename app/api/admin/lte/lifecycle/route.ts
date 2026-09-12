import { NextRequest, NextResponse } from 'next/server';
import Logger, { getErrorMessage } from '@/lib/logger';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseLTE } from '@/lib/supabase-lte';
import { ConcurrencyValidator } from '@/lib/services/lte-ingestion/concurrency-validator';

const logger = new Logger('LTELifecycleAPI');

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { user, error: authError } = await authenticateSSORequest(
      request,
      ['super_admin', 'platform_admin'] // Privileged admin actions
    );

    if (authError || !user) {
      return authError || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'RETIRE_COURSE':
        return await handleRetireCourse(body, user.userId);
      case 'REACTIVATE_COURSE':
        return await handleReactivateCourse(body, user.userId);
      case 'ROLLBACK_COURSE_VERSION':
        return await handleRollbackCourseVersion(body, user.userId);
      case 'RENAME_CANONICAL_CODE_WITH_ALIAS':
        return await handleRenameCanonicalCode(body, user.userId);
      default:
        return NextResponse.json({ success: false, error: `Unsupported lifecycle action: ${action}` }, { status: 400 });
    }
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error('Lifecycle action failed', { error: errorMessage });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

async function handleRetireCourse(body: any, userId: string): Promise<NextResponse> {
  const { courseId, reason } = body;
  if (!courseId) return NextResponse.json({ success: false, error: 'courseId is required' }, { status: 400 });

  const { data: course, error } = await supabaseLTE.rpc('change_course_lifecycle', {
    p_course_id: courseId,
    p_target_status: 'RETIRED',
  });

  if (error || !course) {
    throw new Error(`Failed to retire course: ${error?.message}`);
  }

  logger.info('Course retired successfully', { courseId, userId, reason });

  return NextResponse.json({
    success: true,
    action: 'RETIRE_COURSE',
    courseId,
    lifecycleStatus: 'RETIRED',
  });
}

async function handleReactivateCourse(body: any, userId: string): Promise<NextResponse> {
  const { courseId } = body;
  if (!courseId) return NextResponse.json({ success: false, error: 'courseId is required' }, { status: 400 });

  const { data: course, error } = await supabaseLTE.rpc('change_course_lifecycle', {
    p_course_id: courseId,
    p_target_status: 'ACTIVE',
  });

  if (error || !course) {
    throw new Error(`Failed to reactivate course: ${error?.message}`);
  }

  logger.info('Course reactivated successfully', { courseId, userId });

  return NextResponse.json({
    success: true,
    action: 'REACTIVATE_COURSE',
    courseId,
    lifecycleStatus: 'ACTIVE',
  });
}

async function handleRollbackCourseVersion(body: any, userId: string): Promise<NextResponse> {
  const { courseId, rollbackSourceVersionId, confirmDiscardDraft, expectedDraftRevision } = body;

  if (!courseId || !rollbackSourceVersionId) {
    return NextResponse.json(
      { success: false, error: 'courseId and rollbackSourceVersionId are required' },
      { status: 400 }
    );
  }

  if (confirmDiscardDraft && expectedDraftRevision === undefined) {
    return NextResponse.json(
      { success: false, error: 'expectedDraftRevision is required when discarding a draft' },
      { status: 400 }
    );
  }

  // Friendly early conflict response; the database RPC repeats this check under
  // the course lock so this is not the concurrency boundary.
  const validator = new ConcurrencyValidator(supabaseLTE);
  const draftCheck = await validator.validateRollbackActiveDraft(courseId, false);
  if (!draftCheck.isValid && !confirmDiscardDraft) {
    return NextResponse.json(
      {
        success: false,
        errorCode: 'ACTIVE_DRAFT_EXISTS',
        error: draftCheck.errorMessage,
        activeDraftId: draftCheck.activeDraftId,
        activeDraftRevision: draftCheck.details?.draftRevision,
      },
      { status: 409 }
    );
  }

  const { data: newVersion, error: insertError } = await supabaseLTE.rpc(
    'create_course_rollback_draft',
    {
      p_course_id: courseId,
      p_rollback_source_version_id: rollbackSourceVersionId,
      p_expected_draft_revision: expectedDraftRevision ?? null,
      p_discard_existing_draft: Boolean(confirmDiscardDraft),
    }
  );

  if (insertError || !newVersion) {
    const isDraftConflict = insertError?.message?.includes('ACTIVE_DRAFT_EXISTS');
    return NextResponse.json(
      {
        success: false,
        errorCode: isDraftConflict ? 'ACTIVE_DRAFT_EXISTS' : 'ROLLBACK_DRAFT_FAILED',
        error: insertError?.message || 'Failed to create rollback draft',
      },
      { status: isDraftConflict ? 409 : 400 }
    );
  }

  logger.info('Rollback draft created', { courseId, versionNo: newVersion.version_no, rollbackSourceVersionId });

  return NextResponse.json({
    success: true,
    action: 'ROLLBACK_COURSE_VERSION_DRAFT_CREATED',
    courseId,
    newVersionNo: newVersion.version_no,
    newVersionId: newVersion.id,
    rollbackSourceVersionId,
    status: 'DRAFT',
  });
}

async function handleRenameCanonicalCode(body: any, userId: string): Promise<NextResponse> {
  const { entityType, canonicalUuid, oldCode, newCode } = body;

  if (!entityType || !canonicalUuid || !oldCode || !newCode) {
    return NextResponse.json(
      { success: false, error: 'entityType, canonicalUuid, oldCode, and newCode are required' },
      { status: 400 }
    );
  }

  // Save old code into canonical_aliases
  await supabaseLTE.from('canonical_aliases').insert({
    entity_type: entityType,
    alias_code: oldCode,
    canonical_uuid: canonicalUuid,
    canonical_code: newCode,
    created_by: userId,
  });

  // Increment global catalog_revision
  const { data: catRev } = await supabaseLTE.from('catalog_revisions').select('catalog_revision').eq('id', 1).single();
  const nextCatalogRev = (Number(catRev?.catalog_revision) || 1) + 1;
  await supabaseLTE.from('catalog_revisions').update({ catalog_revision: nextCatalogRev, updated_at: new Date().toISOString() }).eq('id', 1);

  logger.info('Canonical code renamed with alias', { entityType, oldCode, newCode, nextCatalogRev });

  return NextResponse.json({
    success: true,
    action: 'RENAME_CANONICAL_CODE_WITH_ALIAS',
    entityType,
    oldCode,
    newCode,
    catalogRevision: nextCatalogRev,
  });
}
