import { NextRequest, NextResponse } from 'next/server';
import Logger, { getErrorMessage } from '@/lib/logger';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseLTE } from '@/lib/supabase-lte';
import { validateAndDownloadAsset } from '@/lib/services/lte-ingestion/asset-validator';
import { getR2StorageService } from '@/lib/services/lte-ingestion/r2-runtime';

const logger = new Logger('LTECourseContentAPI');

export const runtime = 'nodejs';

/**
 * Get full course content including modules, 6Es stages, artifacts, artifact questions, and e_content
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { user, error: authError } = await authenticateSSORequest(request, ['admin', 'super_admin', 'platform_admin']);
    if (authError || !user) {
      return authError || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');

    if (!courseId) {
      return NextResponse.json({ success: false, error: 'courseId is required' }, { status: 400 });
    }

    logger.info('Fetching full course content', { courseId, userId: user.id });

    // The canonical course record is the published level row.
    const { data: level, error: levelError } = await supabaseLTE
      .from('levels')
      .select('*')
      .eq('id', courseId)
      .single();

    if (levelError || !level) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
    }

    const [capabilityRes, levelScaleRes, versionsRes] = await Promise.all([
      level.capability_id
        ? supabaseLTE.from('capabilities').select('id, code, name, description').eq('id', level.capability_id).maybeSingle()
        : { data: null, error: null },
      level.level_id
        ? supabaseLTE.from('level_scale').select('id, level_no, level_label, generic_definition').eq('id', level.level_id).maybeSingle()
        : { data: null, error: null },
      supabaseLTE
        .from('catalog_versions')
        .select('id, version_no, status, change_reason, published_at, created_at')
        .eq('entity_type', 'level')
        .eq('entity_id', level.id)
        .order('version_no', { ascending: false }),
    ]);

    if (capabilityRes.error) throw new Error(`Failed to fetch capability: ${capabilityRes.error.message}`);
    if (levelScaleRes.error) throw new Error(`Failed to fetch level scale: ${levelScaleRes.error.message}`);
    if (versionsRes.error) throw new Error(`Failed to fetch level versions: ${versionsRes.error.message}`);

    const course = {
      ...level,
      course_code: level.level_code,
      course_name: level.title || level.level_code,
      short_name: level.level_code,
      lifecycle_status: level.is_active ? 'ACTIVE' : 'RETIRED',
      capability: capabilityRes.data || null,
      level_scale: levelScaleRes.data || null,
      current_published_version_id: (versionsRes.data || []).find((version: any) => version.status === 'PUBLISHED')?.id || null,
      current_assignable_version_id: null,
    };

    // 3. Get all modules for this level or course
    let modules: any[] = [];
    if (level) {
      const { data: modulesByLevel } = await supabaseLTE
        .from('modules')
        .select('*')
        .eq('level_id', level.id)
        .order('module_no', { ascending: true });

      if (modulesByLevel && modulesByLevel.length > 0) {
        modules = modulesByLevel;
      }
    }

    // 4. Get module content (6Es) and artifacts for each module
    const allContentIds: string[] = [];

    const modulesWithContent = await Promise.all(
      (modules || []).map(async (module) => {
        // Fetch 6Es stage content (modules_content)
        const { data: content } = await supabaseLTE
          .from('modules_content')
          .select('*')
          .eq('module_id', module.id)
          .order('stage_order', { ascending: true });

        const moduleContentList = content || [];
        const contentIds = moduleContentList.map((c: any) => c.id).filter(Boolean);
        allContentIds.push(...contentIds);

        // Artifacts belong to a 6E stage. There is no module_id column on the
        // published module_artifacts table, so resolve them through the stage ids.
        let artifacts: any[] = [];
        if (contentIds.length > 0) {
          const { data: artifactsByContent } = await supabaseLTE
            .from('module_artifacts')
            .select('*')
            .in('modules_content_id', contentIds);

          if (artifactsByContent && artifactsByContent.length > 0) {
            artifacts = artifactsByContent;
          }
        }

        // Get artifact questions and templates for each artifact
        const artifactsWithQuestions = await Promise.all(
          (artifacts || []).map(async (artifact) => {
            const { data: questions } = await supabaseLTE
              .from('artifact_questions')
              .select('*')
              .eq('artifact_id', artifact.id)
              .order('question_order', { ascending: true });

            const { data: templates } = await supabaseLTE
              .from('artifact_templates')
              .select('*')
              .eq('artifact_id', artifact.id);

            return {
              ...artifact,
              // Keep a friendly editable label without pretending that
              // artifact_title is a physical database column.
              artifact_title: artifact.metadata?.title || artifact.artifact_type,
              questions: questions || [],
              templates: templates || [],
            };
          })
        );

        return {
          ...module,
          content: moduleContentList,
          artifacts: artifactsWithQuestions,
        };
      })
    );

    // 5. Get e_content (learning materials)
    let eContent: any[] = [];
    if (allContentIds.length > 0) {
      const { data: eDataByContent } = await supabaseLTE
        .from('e_content')
        .select('*')
        .in('modules_content_id', allContentIds);
      if (eDataByContent && eDataByContent.length > 0) {
        eContent = eDataByContent;
      }
    }

    const activeDraft = (versionsRes.data || []).find((version: any) => version.status === 'DRAFT') || null;

    return NextResponse.json({
      success: true,
      course,
      level: level || null,
      capability: capabilityRes.data || null,
      levelScale: levelScaleRes.data || null,
      versions: versionsRes.data || [],
      activeDraft,
      modules: modulesWithContent,
      eContent,
    });

  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error('Course content API error', { error: errorMessage });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

/**
 * Save course content edits as a DRAFT version.
 * Nothing is written to live tables here — publishing happens via POST so
 * every editor change goes through draft -> review -> publish.
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const { user, error: authError } = await authenticateSSORequest(request, ['admin', 'super_admin', 'platform_admin']);
    if (authError || !user) {
      return authError || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { courseId, updates, changeReason, expectedDraftRevision } = body;

    if (!courseId || !updates) {
      return NextResponse.json({ success: false, error: 'courseId and updates are required' }, { status: 400 });
    }

    logger.info('Saving course content draft', { courseId, userId: user.id });
    stripIdentityFields(updates);

    const { data: activeDraft, error: draftLookupError } = await supabaseLTE
      .from('catalog_versions')
      .select('id, version_no, draft_revision')
      .eq('entity_type', 'level')
      .eq('entity_id', courseId)
      .eq('status', 'DRAFT')
      .maybeSingle();
    if (draftLookupError) throw new Error(`Failed to load active draft: ${draftLookupError.message}`);

    const snapshotData = {
      kind: 'workspace_edit_draft',
      courseId,
      course: updates.course || null,
      modules: updates.modules || null,
      eContent: updates.eContent || null,
      editedBy: user.userId,
      editedAt: new Date().toISOString(),
    };

    if (activeDraft) {
      if (expectedDraftRevision !== undefined && activeDraft.draft_revision !== expectedDraftRevision) {
        return NextResponse.json(
          {
            success: false,
            errorCode: 'DRAFT_CONFLICT',
            error: 'This draft changed elsewhere. Reload and re-apply your edits.',
            draftId: activeDraft.id,
            draftRevision: activeDraft.draft_revision,
          },
          { status: 409 }
        );
      }
      const newRevision = (activeDraft.draft_revision || 0) + 1;
      const { error: updateError } = await supabaseLTE
        .from('catalog_versions')
        .update({
          snapshot_data: snapshotData,
          draft_revision: newRevision,
          change_reason: changeReason || 'WORKSPACE_EDIT_DRAFT',
        })
        .eq('id', activeDraft.id)
        .eq('status', 'DRAFT');
      if (updateError) throw new Error(`Failed to save draft: ${updateError.message}`);
      return NextResponse.json({
        success: true,
        status: 'DRAFT',
        message: `Draft saved (revision ${newRevision}). Publish to make it live.`,
        draftId: activeDraft.id,
        draftRevision: newRevision,
        versionNo: activeDraft.version_no,
      });
    }

    const { data: latestVersion } = await supabaseLTE
      .from('catalog_versions')
      .select('version_no')
      .eq('entity_type', 'level')
      .eq('entity_id', courseId)
      .order('version_no', { ascending: false })
      .limit(1)
      .maybeSingle();
    const newVersionNo = ((latestVersion as any)?.version_no || 0) + 1;
    const { data: newDraft, error: insertError } = await supabaseLTE
      .from('catalog_versions')
      .insert({
        entity_type: 'level',
        entity_id: courseId,
        version_no: newVersionNo,
        status: 'DRAFT',
        draft_revision: 1,
        snapshot_data: snapshotData,
        change_reason: changeReason || 'WORKSPACE_EDIT_DRAFT',
        created_by: user.userId,
      })
      .select('id, version_no')
      .single();
    if (insertError || !newDraft) throw new Error(`Failed to create draft: ${insertError?.message}`);
    return NextResponse.json({
      success: true,
      status: 'DRAFT',
      message: `Draft saved as version ${newVersionNo}. Publish to make it live.`,
      draftId: (newDraft as any).id,
      draftRevision: 1,
      versionNo: newVersionNo,
    });
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error('Course content draft error', { error: errorMessage });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

/**
 * Publish the active draft: applies its pending edits to live tables, then
 * flips the draft row itself to PUBLISHED so version history stays linear.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { user, error: authError } = await authenticateSSORequest(request, ['admin', 'super_admin', 'platform_admin']);
    if (authError || !user) {
      return authError || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { courseId, expectedDraftRevision } = body;
    if (!courseId) {
      return NextResponse.json({ success: false, error: 'courseId is required' }, { status: 400 });
    }

    const { data: draft, error: draftError } = await supabaseLTE
      .from('catalog_versions')
      .select('*')
      .eq('entity_type', 'level')
      .eq('entity_id', courseId)
      .eq('status', 'DRAFT')
      .maybeSingle();
    if (draftError) throw new Error(`Failed to load active draft: ${draftError.message}`);
    if (!draft) {
      return NextResponse.json({ success: false, error: 'No active draft to publish for this course.' }, { status: 404 });
    }
    if (expectedDraftRevision !== undefined && draft.draft_revision !== expectedDraftRevision) {
      return NextResponse.json(
        {
          success: false,
          errorCode: 'DRAFT_CONFLICT',
          error: 'This draft changed elsewhere. Reload before publishing.',
          draftId: draft.id,
          draftRevision: draft.draft_revision,
        },
        { status: 409 }
      );
    }

    const snap = (draft.snapshot_data || {}) as any;
    const updates = { course: snap.course, modules: snap.modules, eContent: snap.eContent };
    stripIdentityFields(updates);
    await stageEditedAssetLinks(courseId, updates, draft.id);

    const { data: publishedVersion, error: publishError } = await supabaseLTE
      .rpc('publish_lte_course_content_draft', {
        p_course_id: courseId,
        p_draft_id: draft.id,
        p_published_by: user.userId,
      })
      .single();
    if (publishError) throw new Error(`Failed to publish draft: ${publishError.message}`);

    logger.info('Draft published', { courseId, versionNo: draft.version_no, draftId: draft.id });
    return NextResponse.json({
      success: true,
      status: 'PUBLISHED',
      message: `Draft published as version ${(publishedVersion as any)?.version_no || draft.version_no}`,
      newVersionNo: (publishedVersion as any)?.version_no || draft.version_no,
      newVersionId: (publishedVersion as any)?.version_id || draft.id,
    });
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error('Draft publish error', { error: errorMessage });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

/**
 * Discard the active draft without touching live tables.
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

    const { error } = await supabaseLTE
      .from('catalog_versions')
      .update({ status: 'ABANDONED' })
      .eq('id', draftId)
      .eq('status', 'DRAFT');
    if (error) throw new Error(`Failed to discard draft: ${error.message}`);
    return NextResponse.json({ success: true, draftId, status: 'ABANDONED' });
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error('Draft discard error', { error: errorMessage });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

function stripIdentityFields(updates: any): void {
  // Capability / level identity is immutable from the editor. Any
  // capability_id, level_id, level_code, or capability object sent by the
  // client is stripped so a course can never be re-parented by editing.
  if (updates?.course) {
    delete updates.course.capability_id;
    delete updates.course.level_id;
    delete updates.course.level_code;
    delete updates.course.course_code;
    delete updates.course.capability;
  }
}

async function stageEditedAssetLinks(courseId: string, updates: unknown, draftId: string): Promise<void> {
  if (!isRecord(updates)) throw new Error('Invalid draft update payload.');

  const editedLinks = collectEditedSourceLinks(updates);
  if (editedLinks.length === 0) return;

  const [levelResult, storage] = await Promise.all([
    supabaseLTE
      .from('levels')
      .select('level_code, capability_id')
      .eq('id', courseId)
      .single(),
    getR2StorageService(),
  ]);

  if (levelResult.error || !levelResult.data) {
    throw new Error(`Failed to load course for asset staging: ${levelResult.error?.message || courseId}`);
  }

  let capabilityCode = 'WORKSPACE_EDIT';
  if (levelResult.data.capability_id) {
    const { data: capability } = await supabaseLTE
      .from('capabilities')
      .select('code')
      .eq('id', levelResult.data.capability_id)
      .maybeSingle();
    capabilityCode = capability?.code || capabilityCode;
  }

  const levelCode = levelResult.data.level_code || courseId;
  const staged = new Map<string, Promise<{ publicUrl: string; mimeType: string }>>();

  const stageUrl = async (
    url: string,
    context: { moduleNo: number; category: 'content' | 'artifact'; artifactType?: string; artifactSubfolder?: 'templates' }
  ) => {
    const cacheKey = `${context.category}|${context.artifactType || ''}|${context.moduleNo}|${url}`;
    if (!staged.has(cacheKey)) {
      staged.set(cacheKey, (async () => {
        const asset = await validateAndDownloadAsset(url);
        const uploaded = await storage.uploadAsset({
          capabilityCode,
          levelCode,
          ...context,
          originalUrl: url,
          contentHash: asset.contentHash,
          mimeType: asset.mimeType,
          bytes: asset.bytes,
          uploadId: draftId,
        });
        return { publicUrl: uploaded.publicUrl, mimeType: asset.mimeType };
      })());
    }
    return staged.get(cacheKey)!;
  };

  for (const module of asArray(updates.modules).filter(isRecord)) {
    const moduleNo = Number(module.module_no || 0);
    for (const artifact of asArray(module.artifacts).filter(isRecord)) {
      const artifactType = String(artifact.artifact_type || 'artifact');
      for (const template of asArray(artifact.templates).filter(isRecord)) {
        if (!template?.file_url || !isImportableWorkspaceSourceUrl(template.file_url)) continue;
        const originalUrl = template.file_url;
        const uploaded = await stageUrl(originalUrl, {
          moduleNo,
          category: 'artifact',
          artifactType,
          artifactSubfolder: 'templates',
        });
        template.file_url = uploaded.publicUrl;
        template.file_type = template.file_type || uploaded.mimeType;
        template.metadata = {
          ...(template.metadata || {}),
          source_url: template.metadata?.source_url || originalUrl,
          staged_from_workspace_edit: true,
        };
      }
    }
  }

  const moduleNoByContentId = new Map<string, number>();
  for (const module of asArray(updates.modules).filter(isRecord)) {
    for (const content of asArray(module.content).filter(isRecord)) {
      if (content?.id) moduleNoByContentId.set(content.id, Number(module.module_no || 0));
    }
  }

  for (const item of asArray(updates.eContent).filter(isRecord)) {
    if (!item?.url || !isImportableWorkspaceSourceUrl(item.url)) continue;
    const moduleNo = moduleNoByContentId.get(item.modules_content_id) || 0;
    const uploaded = await stageUrl(item.url, { moduleNo, category: 'content' });
    const originalUrl = item.url;
    item.url = uploaded.publicUrl;
    item.mime_type = item.mime_type || uploaded.mimeType;
    item.metadata = {
      ...(item.metadata || {}),
      source_url: item.metadata?.source_url || originalUrl,
      staged_from_workspace_edit: true,
    };
  }

  logger.info('Workspace edited asset links staged to R2', {
    courseId,
    draftId,
    stagedCount: staged.size,
  });
}

function collectEditedSourceLinks(updates: unknown): string[] {
  if (!isRecord(updates)) return [];

  const links: string[] = [];
  for (const module of asArray(updates.modules).filter(isRecord)) {
    for (const artifact of asArray(module.artifacts).filter(isRecord)) {
      for (const template of asArray(artifact.templates).filter(isRecord)) {
        if (template?.file_url && isImportableWorkspaceSourceUrl(template.file_url)) links.push(template.file_url);
      }
    }
  }
  for (const item of asArray(updates.eContent).filter(isRecord)) {
    if (item?.url && isImportableWorkspaceSourceUrl(item.url)) links.push(item.url);
  }
  return links;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isImportableWorkspaceSourceUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['docs.google.com', 'drive.google.com'].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}
