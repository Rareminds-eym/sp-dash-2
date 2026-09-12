import { NextRequest, NextResponse } from 'next/server';
import Logger, { getErrorMessage } from '@/lib/logger';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseLTE } from '@/lib/supabase-lte';

const logger = new Logger('LTEMaterializeAPI');

export const runtime = 'nodejs';

/**
 * Materializes a published level into a course record with initial version.
 * This allows content teams to view and edit course details after upload/publish.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { user, error: authError } = await authenticateSSORequest(request, ['admin', 'super_admin', 'platform_admin']);
    if (authError || !user) {
      return authError || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { levelId } = body;

    if (!levelId) {
      return NextResponse.json(
        { success: false, error: 'Level ID is required' },
        { status: 400 }
      );
    }

    logger.info('Materializing level to course', { levelId, userId: user.id });

    // 1. Fetch the level record
    const { data: level, error: levelError } = await supabaseLTE
      .from('levels')
      .select('*')
      .eq('id', levelId)
      .single();

    if (levelError || !level) {
      logger.error('Level not found', { levelId, error: levelError });
      return NextResponse.json(
        { success: false, error: 'Level not found' },
        { status: 404 }
      );
    }

    // 2. Check if course already exists for this level
    const { data: existingCourse } = await supabaseLTE
      .from('courses')
      .select('id')
      .eq('course_code', level.course_code || level.level_code)
      .maybeSingle();

    if (existingCourse) {
      logger.warn('Course already exists for this level', { levelId, courseId: existingCourse.id });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Course already exists for this level',
          courseId: existingCourse.id 
        },
        { status: 409 }
      );
    }

    // 3. Create the course record
    const courseName = level.course_title || level.level_name || level.course_code || level.level_code || 'Untitled Course';
    const { data: newCourse, error: courseError } = await supabaseLTE
      .from('courses')
      .insert({
        course_code: level.course_code || level.level_code,
        course_name: courseName,
        short_name: courseName,
        description: level.description || '',
        lifecycle_status: 'ACTIVE',
      })
      .select()
      .single();

    if (courseError || !newCourse) {
      logger.error('Failed to create course', { levelId, error: courseError });
      return NextResponse.json(
        { success: false, error: `Failed to create course: ${courseError?.message || 'Unknown error'}` },
        { status: 500 }
      );
    }

    // 4. Fetch all modules for this level
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
        change_reason: 'Initial version created from published level',
      })
      .select()
      .single();

    if (versionError || !version) {
      logger.error('Failed to create course version', { courseId: newCourse.id, error: versionError });
      // Rollback course creation
      await supabaseLTE.from('courses').delete().eq('id', newCourse.id);
      return NextResponse.json(
        { success: false, error: `Failed to create course version: ${versionError?.message || 'Unknown error'}` },
        { status: 500 }
      );
    }

    // 6. Update course with published version references
    const { error: updateError } = await supabaseLTE
      .from('courses')
      .update({
        current_published_version_id: version.id,
        // Note: current_assignable_version_id should be set after assets are ready
      })
      .eq('id', newCourse.id);

    if (updateError) {
      logger.error('Failed to update course with version', { courseId: newCourse.id, error: updateError });
    }

    logger.info('Successfully materialized level to course', {
      levelId,
      courseId: newCourse.id,
      versionId: version.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Level successfully materialized to course',
      course: newCourse,
      version: version,
    });

  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error('Materialize API error', { error: errorMessage });
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
