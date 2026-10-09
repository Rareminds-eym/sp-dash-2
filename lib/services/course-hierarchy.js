'use client';

/**
 * Normalize DB-shaped course hierarchy into CreateCourseModal state shape.
 *
 * Preservation rules (P0):
 * - Every supported field survives the round-trip; unknown extra fields on
 *   modules/lessons are passed through untouched.
 * - Both `order` and `orderIndex` aliases are populated so the POST/PUT
 *   endpoints (which read `order ?? orderIndex ?? index`) and the UI
 *   (which reads `orderIndex`) never disagree.
 * - Resource aliases (`size`/`fileSize`, `thumbnailUrl`/`thumbnail_url`,
 *   `embedUrl`/`embed_url`) are normalized the same way.
 * - Nothing is dropped for new (client-side) modules: missing ids stay
 *   undefined so the server treats them as inserts.
 */

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeResource(resource, resourceIndex) {
  if (!resource || typeof resource !== 'object') return resource;
  const order = toNumber(
    resource.order ?? resource.orderIndex ?? resource.order_index ?? resourceIndex,
    resourceIndex
  );
  const size = resource.size ?? resource.fileSize ?? resource.file_size ?? '';
  const thumbnailUrl =
    resource.thumbnailUrl ?? resource.thumbnail_url ?? null;
  const embedUrl = resource.embedUrl ?? resource.embed_url ?? null;
  return {
    ...resource,
    id: resource.id ?? resource.resource_id,
    name: resource.name,
    type: resource.type,
    url: resource.url,
    size,
    fileSize: size,
    thumbnailUrl,
    embedUrl,
    order,
    orderIndex: order,
  };
}

function normalizeLesson(lesson, lessonIndex) {
  if (!lesson || typeof lesson !== 'object') return lesson;
  const order = toNumber(
    lesson.order ?? lesson.orderIndex ?? lesson.order_index ?? lessonIndex,
    lessonIndex
  );
  return {
    ...lesson,
    id: lesson.id ?? lesson.lesson_id,
    title: lesson.title,
    description: lesson.description || '',
    content: lesson.content || '',
    duration: lesson.duration || '',
    order,
    orderIndex: order,
    resources: (lesson.resources || []).map(normalizeResource),
  };
}

export function normalizeCourseHierarchy(modules) {
  return (modules || []).map((module, moduleIndex) => {
    if (!module || typeof module !== 'object') return module;
    const order = toNumber(
      module.order ?? module.orderIndex ?? module.order_index ?? moduleIndex,
      moduleIndex
    );
    const skillTags =
      module.skillTags ?? module.skill_tags ?? [];
    return {
      ...module,
      id: module.id ?? module.module_id,
      title: module.title,
      description: module.description || '',
      order,
      orderIndex: order,
      skillTags: Array.isArray(skillTags) ? skillTags : [],
      activities: module.activities || [],
      lessons: (module.lessons || []).map(normalizeLesson),
    };
  });
}
