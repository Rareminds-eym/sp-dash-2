import { NextRequest, NextResponse } from 'next/server';
import Logger, { getErrorMessage } from '@/lib/logger';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseLTE } from '@/lib/supabase-lte';
import { ConcurrencyValidator } from '@/lib/services/lte-ingestion/concurrency-validator';

const logger = new Logger('LTEDraftsAPI');

export const runtime = 'nodejs';

/**
 * POST /api/admin/lte/drafts
 * Open or create active draft for a course
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { user, error: authError } = await authenticateSSORequest(request, ['admin', 'super_admin', 'platform_admin']);
    if (authError || !user) {
      return authError || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { courseId } = await request.json();
    if (!courseId) {
      return NextResponse.json({ success: false, error: 'courseId is required' }, { status: 400 });
    }

    // Load the source data used for a new draft. Allocation and the one-draft
    // invariant are enforced atomically by open_course_version_draft().
    const { data: course, error: courseError } = await supabaseLTE
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
    }

    const { data: newDraft, error: insertError } = await supabaseLTE.rpc(
      'open_course_version_draft',
      {
        p_course_id: courseId,
        p_snapshot_data: { course_name: course.course_name, course_code: course.course_code },
        p_change_reason: 'WORKSPACE_EDIT_DRAFT',
      }
    );

    if (insertError || !newDraft) {
      throw new Error(`Failed to create draft: ${insertError?.message}`);
    }

    logger.info('Opened course draft', { courseId, draftId: newDraft.id, versionNo: newDraft.version_no });

    return NextResponse.json({
      success: true,
      draft: newDraft,
    });
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error('Failed to create/open draft', { error: errorMessage });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

/**
 * PUT /api/admin/lte/drafts
 * Save draft edits using expected_draft_revision (Optimistic Concurrency)
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const { user, error: authError } = await authenticateSSORequest(request, ['admin', 'super_admin', 'platform_admin']);
    if (authError || !user) {
      return authError || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { draftId, expectedDraftRevision, snapshotData } = await request.json();

    if (!draftId || expectedDraftRevision === undefined) {
      return NextResponse.json(
        { success: false, error: 'draftId and expectedDraftRevision are required' },
        { status: 400 }
      );
    }

    const validator = new ConcurrencyValidator(supabaseLTE);
    const validation = await validator.validateDraftRevision(draftId, Number(expectedDraftRevision));

    if (!validation.isValid) {
      logger.warn('Draft save conflict detected', { draftId, expectedDraftRevision, errorCode: validation.errorCode });
      return NextResponse.json(
        {
          success: false,
          errorCode: validation.errorCode,
          error: validation.errorMessage,
        },
        { status: 409 }
      );
    }

    const newRevision = Number(expectedDraftRevision) + 1;

    const { data: updatedDraft, error: updateError } = await supabaseLTE
      .from('course_versions')
      .update({
        snapshot_data: snapshotData,
        draft_revision: newRevision,
      })
      .eq('id', draftId)
      .eq('draft_revision', expectedDraftRevision)
      .select('*')
      .single();

    if (updateError || !updatedDraft) {
      return NextResponse.json(
        { success: false, errorCode: 'DRAFT_CHANGED', error: 'Draft revision conflict during update.' },
        { status: 409 }
      );
    }

    logger.info('Draft updated successfully', { draftId, newRevision });

    return NextResponse.json({
      success: true,
      draftId,
      newDraftRevision: newRevision,
      draft: updatedDraft,
    });
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error('Failed to save draft', { error: errorMessage });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/lte/drafts
 * Abandon an active draft
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { user, error: authError } = await authenticateSSORequest(request, ['admin', 'super_admin', 'platform_admin']);
    if (authError || !user) {
      return authError || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const draftId = searchParams.get('draftId');

    if (!draftId) {
      return NextResponse.json({ success: false, error: 'draftId is required' }, { status: 400 });
    }

    const { error: updateError } = await supabaseLTE
      .from('course_versions')
      .update({ status: 'ABANDONED' })
      .eq('id', draftId);

    if (updateError) {
      throw new Error(`Failed to abandon draft: ${updateError.message}`);
    }

    logger.info('Draft abandoned', { draftId });

    return NextResponse.json({ success: true, draftId, status: 'ABANDONED' });
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error('Failed to abandon draft', { error: errorMessage });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
