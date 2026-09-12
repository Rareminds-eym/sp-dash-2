import { NextRequest, NextResponse } from 'next/server';
import Logger, { getErrorMessage } from '@/lib/logger';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseLTE } from '@/lib/supabase-lte';

const logger = new Logger('LTEMaterializeBatchAPI');

export const runtime = 'nodejs';

/**
 * Batch materializes multiple published levels into course records.
 * Useful for bulk operations after uploading multiple courses.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { user, error: authError } = await authenticateSSORequest(request, ['admin', 'super_admin', 'platform_admin']);
    if (authError || !user) {
      return authError || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { levelIds } = body;

    if (!Array.isArray(levelIds) || levelIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'levelIds array is required and must not be empty' },
        { status: 400 }
      );
    }

    logger.info('Batch materializing levels to courses', { 
      levelCount: levelIds.length, 
      userId: user.id 
    });

    const results = {
      successful: [] as any[],
      failed: [] as any[],
      skipped: [] as any[],
    };

    // Process each level
    for (const levelId of levelIds) {
      try {
        // 1. Fetch the level record
        const { data: level, error: levelError } = await supabaseLTE
          .from('levels')
          .select('*')
          .eq('id', levelId)
          .single();

        if (levelError || !level) {
          results.failed.push({
            levelId,
            error: 'Level not found',
          });
          continue;
        }

        // 2. Check if course already exists
        const courseCode = level.course_code || level.level_code;
        const { data: existingCourse } = await supabaseLTE
          .from('courses')
          .select('id')
          .eq('course_code', courseCode)
          .maybeSingle();

        if (existingCourse) {
          results.skipped.push({
            levelId,
            courseCode,
            reason: 'Course already exists',
            existingCourseId: existingCourse.id,
          });
          continue;
        }

        // 3. Create the course record
        const courseName = level.course_title || level.level_name || courseCode || 'Untitled Course';
        const { data: newCourse, error: courseError } = await supabaseLTE
          .from('courses')
          .insert({
            course_code: courseCode,
            course_name: courseName,
            short_name: courseName,
            description: level.description || '',
            lifecycle_status: 'ACTIVE',
          })
          .select()
          .single();

        if (courseError || !newCourse) {
          results.failed.push({
            levelId,
            courseCode,
            error: courseError?.message || 'Failed to create course',
          });
          continue;
        }

        // 4. Fetch modules for this level
        const { data: modules } = await supabaseLTE
          .from('modules')
          .select('*')
          .eq('level_id', levelId);

        // 5. Create initial course version
        const { data: version, error: versionError } = await supabaseLTE
          .from('course_versions')
          .insert({
            course_id: newCourse.id,
            version_no: 1,
            status: 'PUBLISHED',
            change_reason: 'Initial version created from published level (batch materialize)',
          })
          .select()
          .single();

        if (versionError || !version) {
          // Rollback course creation
          await supabaseLTE.from('courses').delete().eq('id', newCourse.id);
          results.failed.push({
            levelId,
            courseCode,
            error: versionError?.message || 'Failed to create course version',
          });
          continue;
        }

        // 6. Update course with version reference
        await supabaseLTE
          .from('courses')
          .update({
            current_published_version_id: version.id,
          })
          .eq('id', newCourse.id);

        results.successful.push({
          levelId,
          courseCode,
          courseId: newCourse.id,
          versionId: version.id,
        });

      } catch (err) {
        results.failed.push({
          levelId,
          error: getErrorMessage(err),
        });
      }
    }

    logger.info('Batch materialize complete', {
      total: levelIds.length,
      successful: results.successful.length,
      failed: results.failed.length,
      skipped: results.skipped.length,
    });

    return NextResponse.json({
      success: true,
      message: `Batch materialize complete: ${results.successful.length} created, ${results.skipped.length} skipped, ${results.failed.length} failed`,
      results,
    });

  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error('Batch materialize API error', { error: errorMessage });
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
