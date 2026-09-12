import { NextRequest, NextResponse } from 'next/server';
import Logger, { getErrorMessage } from '@/lib/logger';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseLTE } from '@/lib/supabase-lte';

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

    // 1. Get course details
    const { data: course, error: courseError } = await supabaseLTE
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
    }

    // The canonical logical-course code is the published level_code.
    const { data: level, error: levelError } = await supabaseLTE
      .from('levels')
      .select('*')
      .eq('level_code', course.course_code)
      .maybeSingle();
    if (levelError) throw new Error(`Failed to resolve course level: ${levelError.message}`);

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

    return NextResponse.json({
      success: true,
      course,
      level: level || null,
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
 * Update course content
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const { user, error: authError } = await authenticateSSORequest(request, ['admin', 'super_admin', 'platform_admin']);
    if (authError || !user) {
      return authError || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { courseId, updates } = body;

    if (!courseId || !updates) {
      return NextResponse.json({ success: false, error: 'courseId and updates are required' }, { status: 400 });
    }

    logger.info('Updating course content', { courseId, userId: user.id });

    // Update course basic info
    if (updates.course) {
      const { error: courseError } = await supabaseLTE
        .from('courses')
        .update({
          course_name: updates.course.course_name,
          short_name: updates.course.short_name,
          description: updates.course.description,
          updated_at: new Date().toISOString(),
        })
        .eq('id', courseId);

      if (courseError) {
        throw new Error(`Failed to update course: ${courseError.message}`);
      }
    }

    const writeErrors: string[] = [];

    // Update modules
    if (updates.modules && Array.isArray(updates.modules)) {
      for (const module of updates.modules) {
        if (module.id) {
          const { error: moduleError } = await supabaseLTE
            .from('modules')
            .update({
              title: module.title,
              description: module.description,
              learning_content: module.learning_content,
              prerequisites: module.prerequisites,
              what_youll_learn: module.what_youll_learn,
              is_published: module.is_published,
            })
            .eq('id', module.id);

          if (moduleError) {
            logger.error('Failed to update module', { moduleId: module.id, error: moduleError });
            writeErrors.push(`Module ${module.id}: ${moduleError.message}`);
          }

          // Update 6Es content (modules_content)
          if (module.content && Array.isArray(module.content)) {
            for (const mc of module.content) {
              if (mc.id) {
                const { error: mcError } = await supabaseLTE
                  .from('modules_content')
                  .update({
                    stage_description: mc.stage_description,
                    module_context: mc.module_context,
                    curriculum_reference: mc.curriculum_reference,
                  })
                  .eq('id', mc.id);

                if (mcError) {
                  logger.error('Failed to update modules_content', { mcId: mc.id, error: mcError });
                  writeErrors.push(`6E stage ${mc.id}: ${mcError.message}`);
                }
              }
            }
          }

          // Update artifacts (module_artifacts)
          if (module.artifacts && Array.isArray(module.artifacts)) {
            for (const art of module.artifacts) {
              if (art.id) {
                const { error: artError } = await supabaseLTE
                  .from('module_artifacts')
                  .update({
                    artifact_type: art.artifact_type,
                    total_score: art.total_score,
                    passing_score: art.passing_score,
                    is_active: art.is_active,
                    metadata: {
                      ...(art.metadata || {}),
                      title: art.artifact_title,
                    },
                  })
                  .eq('id', art.id);

                if (artError) {
                  logger.error('Failed to update module_artifacts', { artifactId: art.id, error: artError });
                  writeErrors.push(`Artifact ${art.id}: ${artError.message}`);
                }

                for (const question of art.questions || []) {
                  if (!question.id) continue;
                  const { error: questionError } = await supabaseLTE
                    .from('artifact_questions')
                    .update({
                      question_order: question.question_order,
                      title: question.title,
                      description: question.description,
                      instructions: question.instructions,
                      is_active: question.is_active,
                      metadata: question.metadata,
                    })
                    .eq('id', question.id);
                  if (questionError) {
                    writeErrors.push(`Artifact question ${question.id}: ${questionError.message}`);
                  }
                }

                for (const template of art.templates || []) {
                  if (!template.id) continue;
                  const { error: templateError } = await supabaseLTE
                    .from('artifact_templates')
                    .update({
                      file_name: template.file_name,
                      file_url: template.file_url,
                      file_type: template.file_type,
                      version: template.version,
                      is_downloadable: template.is_downloadable,
                      metadata: template.metadata,
                    })
                    .eq('id', template.id);
                  if (templateError) {
                    writeErrors.push(`Artifact file ${template.id}: ${templateError.message}`);
                  }
                }
              }
            }
          }
        }
      }
    }

    if (Array.isArray(updates.eContent)) {
      for (const item of updates.eContent) {
        if (!item.id) continue;
        const { error: contentError } = await supabaseLTE
          .from('e_content')
          .update({
            content_type: item.content_type,
            title: item.title,
            description: item.description,
            url: item.url,
            sort_order: item.sort_order,
            duration_seconds: item.duration_seconds,
            xp_reward: item.xp_reward,
            mime_type: item.mime_type || null,
            status: item.status,
            metadata: item.metadata,
          })
          .eq('id', item.id);
        if (contentError) {
          writeErrors.push(`Learning asset ${item.id}: ${contentError.message}`);
        }
      }
    }

    if (writeErrors.length > 0) {
      logger.error('Course content update completed with write failures', { courseId, writeErrors });
      return NextResponse.json(
        { success: false, error: 'Some course content could not be saved.', details: writeErrors },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Course content updated successfully',
    });

  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error('Course content update error', { error: errorMessage });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
