import { queueCourseFileUpload } from '@/lib/services/course-upload-client'

function basename(path) {
  return String(path || '').split(/[\\/]/).pop() || ''
}

export async function queueResourceFiles(resources, files) {
  const fileByName = new Map()
  for (const file of files) {
    fileByName.set(file.name, file)
    const base = basename(file.name)
    if (!fileByName.has(base)) fileByName.set(base, file)
  }

  const uploadTargets = new Map()
  const queuedByResource = new Map()
  for (const resource of resources) {
    if (resource.resource_url || !resource.file_path) continue
    const path = String(resource.file_path)
    const file = fileByName.get(path) || fileByName.get(basename(path))
    if (!file) continue

    const resourceType = String(resource.resource_type || '').toLowerCase()
    const uploadKey = `${file.name}\u0000${resourceType}`
    if (!uploadTargets.has(uploadKey)) {
      uploadTargets.set(uploadKey, {
        file,
        resourceType,
        resourceName: resource.resource_name || file.name,
      })
    }
    queuedByResource.set(resource, uploadKey)
  }

  const targets = Array.from(uploadTargets.entries())
  let nextTarget = 0
  const workers = Array.from({ length: Math.min(3, targets.length) }, async () => {
    while (nextTarget < targets.length) {
      const targetIndex = nextTarget++
      const [key, target] = targets[targetIndex]
      const upload = await queueCourseFileUpload(target.file, target.resourceType, target.resourceName)
      uploadTargets.set(key, upload)
    }
  })
  const results = await Promise.allSettled(workers)
  const failure = results.find((result) => result.status === 'rejected')
  if (failure) throw failure.reason

  return resources.map((resource) => {
    const uploadKey = queuedByResource.get(resource)
    const upload = uploadKey ? uploadTargets.get(uploadKey) : null
    return upload
      ? { ...resource, resource_url: upload.r2Url, file_size: upload.fileSize }
      : resource
  })
}

export async function queueCourseFilesInCourses(courses, files) {
  const resources = courses.flatMap((course) =>
    (course.modules || []).flatMap((module) =>
      (module.lessons || []).flatMap((lesson) => lesson.resources || []),
    ),
  )
  const queuedResources = await queueResourceFiles(resources, files)
  const byOriginalResource = new Map(resources.map((resource, index) => [
    resource,
    queuedResources[index],
  ]))

  return courses.map((course) => ({
    ...course,
    modules: (course.modules || []).map((module) => ({
      ...module,
      lessons: (module.lessons || []).map((lesson) => ({
        ...lesson,
        resources: (lesson.resources || []).map((resource) =>
          byOriginalResource.get(resource) || resource,
        ),
      })),
    })),
  }))
}
