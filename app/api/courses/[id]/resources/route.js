import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { chunkArray, SUPABASE_IN_CHUNK_SIZE } from '@/lib/services/course-resource-validation';
import Logger from '@/lib/logger';

const logger = new Logger('Course Resources API');

/**
 * GET /api/courses/[id]/resources
 * Returns course modules, lessons, and their lesson resources in display order.
 */
export async function GET(request, { params }) {
  try {
    const { error: authError } = await authenticateSSORequest(request, ['super_admin', 'admin', 'rm_admin']);
    if (authError) return authError;

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
    }

    // Verify the course exists (and is not soft-deleted) before returning
    // child rows: unknown IDs get a 404, not a misleading empty success.
    // (Generic message avoids leaking which IDs exist to unauthorized callers;
    // this route already requires an authenticated course role.)
    const courseResult = await supabaseAdmin
      .from('courses')
      .select('course_id')
      .eq('course_id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (courseResult.error) {
      logger.error('Failed to verify course', { error: courseResult.error });
      return NextResponse.json({ error: 'Failed to load course resources', details: courseResult.error.message }, { status: 500 });
    }
    if (!courseResult.data) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const modulesResult = await supabaseAdmin
      .from('course_modules')
      .select('module_id, title, description, order_index')
      .eq('course_id', id)
      .order('order_index', { ascending: true })
      .order('title', { ascending: true });

    if (modulesResult.error) {
      logger.error('Failed to fetch course modules', { error: modulesResult.error });
      return NextResponse.json({ error: 'Failed to load course resources', details: modulesResult.error.message }, { status: 500 });
    }

    const moduleIds = (modulesResult.data || []).map(module => module.module_id);
    // Empty collections are valid (new course / module without lessons):
    // skip the `.in()` query instead of issuing an invalid empty filter.
    // Chunk ID lists to respect PostgREST URL limits.
    let lessonRows = [];
    if (moduleIds.length > 0) {
      for (const chunk of chunkArray(moduleIds, SUPABASE_IN_CHUNK_SIZE)) {
        if (chunk.length === 0) continue;
        const lessonsResult = await supabaseAdmin
          .from('lessons')
          .select('lesson_id, module_id, title, description, duration, order_index')
          .in('module_id', chunk)
          .order('order_index', { ascending: true });

        if (lessonsResult.error) {
          logger.error('Failed to fetch course lessons', { error: lessonsResult.error });
          return NextResponse.json({ error: 'Failed to load course resources', details: lessonsResult.error.message }, { status: 500 });
        }
        lessonRows = lessonRows.concat(lessonsResult.data || []);
      }
    }

    const lessonIds = lessonRows.map(lesson => lesson.lesson_id);
    let resourceRows = [];
    if (lessonIds.length > 0) {
      for (const chunk of chunkArray(lessonIds, SUPABASE_IN_CHUNK_SIZE)) {
        if (chunk.length === 0) continue;
        const resourcesResult = await supabaseAdmin
          .from('lesson_resources')
          .select('resource_id, lesson_id, name, type, url, file_size, thumbnail_url, embed_url, order_index')
          .in('lesson_id', chunk)
          .order('order_index', { ascending: true });

        if (resourcesResult.error) {
          logger.error('Failed to fetch course resources', { error: resourcesResult.error });
          return NextResponse.json({ error: 'Failed to load course resources', details: resourcesResult.error.message }, { status: 500 });
        }
        resourceRows = resourceRows.concat(resourcesResult.data || []);
      }
    }

    const lessonsByModule = new Map();
    for (const lesson of lessonRows) {
      const moduleLessons = lessonsByModule.get(lesson.module_id) || [];
      moduleLessons.push(lesson);
      lessonsByModule.set(lesson.module_id, moduleLessons);
    }

    const resourcesByLesson = new Map();
    for (const resource of resourceRows) {
      const lessonResources = resourcesByLesson.get(resource.lesson_id) || [];
      lessonResources.push(resource);
      resourcesByLesson.set(resource.lesson_id, lessonResources);
    }

    const modules = (modulesResult.data || []).map(module => ({
      id: module.module_id,
      title: module.title,
      description: module.description || '',
      orderIndex: module.order_index,
      lessons: (lessonsByModule.get(module.module_id) || [])
        .sort((a, b) => Number(a.order_index) - Number(b.order_index))
        .map(lesson => ({
          id: lesson.lesson_id,
          title: lesson.title,
          description: lesson.description || '',
          duration: lesson.duration || '',
          orderIndex: lesson.order_index,
          resources: (resourcesByLesson.get(lesson.lesson_id) || [])
            .sort((a, b) => Number(a.order_index) - Number(b.order_index))
            .map(resource => ({
              id: resource.resource_id,
              name: resource.name,
              type: resource.type,
              url: resource.url,
              fileSize: resource.file_size,
              thumbnailUrl: resource.thumbnail_url,
              embedUrl: resource.embed_url,
              orderIndex: resource.order_index,
            })),
        })),
    }));

    return NextResponse.json({ success: true, data: modules });
  } catch (error) {
    logger.error('Course resources API error', { error });
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
