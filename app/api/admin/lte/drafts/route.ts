import { NextRequest, NextResponse } from 'next/server';
import Logger, { getErrorMessage } from '@/lib/logger';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseLTE } from '@/lib/supabase-lte';

const logger = new Logger('LTEDraftsAPI');

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { user, error: authError } = await authenticateSSORequest(request, ['admin', 'super_admin', 'platform_admin']);
    if (authError || !user) return authError || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { courseId } = await request.json();
    if (!courseId) return NextResponse.json({ success: false, error: 'courseId is required' }, { status: 400 });

    const { data: level, error: levelError } = await supabaseLTE
      .from('levels')
      .select('*')
      .eq('id', courseId)
      .single();
    if (levelError || !level) return NextResponse.json({ success: false, error: 'Course level not found' }, { status: 404 });

    const { data: existingDraft, error: draftLookupError } = await supabaseLTE
      .from('catalog_versions')
      .select('*')
      .eq('entity_type', 'level')
      .eq('entity_id', courseId)
      .eq('status', 'DRAFT')
      .maybeSingle();
    if (draftLookupError) throw new Error(`Failed to load active draft: ${draftLookupError.message}`);
    if (existingDraft) return NextResponse.json({ success: true, draft: existingDraft });

    const { data: latestVersion, error: versionError } = await supabaseLTE
      .from('catalog_versions')
      .select('version_no')
      .eq('entity_type', 'level')
      .eq('entity_id', courseId)
      .order('version_no', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (versionError) throw new Error(`Failed to allocate draft version: ${versionError.message}`);

    const { data: newDraft, error: insertError } = await supabaseLTE
      .from('catalog_versions')
      .insert({
        entity_type: 'level',
        entity_id: courseId,
        version_no: (latestVersion?.version_no || 0) + 1,
        status: 'DRAFT',
        snapshot_data: { level },
        change_reason: 'WORKSPACE_EDIT_DRAFT',
        created_by: user.userId,
      })
      .select('*')
      .single();
    if (insertError || !newDraft) throw new Error(`Failed to create draft: ${insertError?.message}`);

    logger.info('Opened level draft', { courseId, draftId: newDraft.id, versionNo: newDraft.version_no });
    return NextResponse.json({ success: true, draft: newDraft });
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error('Failed to create/open draft', { error: errorMessage });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const { user, error: authError } = await authenticateSSORequest(request, ['admin', 'super_admin', 'platform_admin']);
    if (authError || !user) return authError || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { draftId, expectedDraftRevision, snapshotData } = await request.json();
    if (!draftId || expectedDraftRevision === undefined) {
      return NextResponse.json({ success: false, error: 'draftId and expectedDraftRevision are required' }, { status: 400 });
    }

    const newRevision = Number(expectedDraftRevision) + 1;
    const { data: updatedDraft, error: updateError } = await supabaseLTE
      .from('catalog_versions')
      .update({ snapshot_data: snapshotData, draft_revision: newRevision })
      .eq('id', draftId)
      .eq('draft_revision', expectedDraftRevision)
      .eq('status', 'DRAFT')
      .select('*')
      .single();

    if (updateError || !updatedDraft) {
      return NextResponse.json(
        { success: false, errorCode: 'DRAFT_CHANGED', error: 'Draft revision conflict during update.' },
        { status: 409 }
      );
    }

    logger.info('Draft updated successfully', { draftId, newRevision });
    return NextResponse.json({ success: true, draftId, newDraftRevision: newRevision, draft: updatedDraft });
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error('Failed to save draft', { error: errorMessage });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { user, error: authError } = await authenticateSSORequest(request, ['admin', 'super_admin', 'platform_admin']);
    if (authError || !user) return authError || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const draftId = searchParams.get('draftId');
    if (!draftId) return NextResponse.json({ success: false, error: 'draftId is required' }, { status: 400 });

    const { error: updateError } = await supabaseLTE
      .from('catalog_versions')
      .update({ status: 'ABANDONED' })
      .eq('id', draftId)
      .eq('status', 'DRAFT');
    if (updateError) throw new Error(`Failed to abandon draft: ${updateError.message}`);

    logger.info('Draft abandoned', { draftId });
    return NextResponse.json({ success: true, draftId, status: 'ABANDONED' });
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error('Failed to abandon draft', { error: errorMessage });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
