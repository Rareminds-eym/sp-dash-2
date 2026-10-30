import { queueCourseFileUpload, waitForCourseUploadJob } from '@/lib/services/course-upload-client'

function basename(path) {
  return String(path || '').split(/[\\/]/).pop() || ''
}

export async function queueResourceFiles(resources, files, { importGoogle = false } = {}) {
  const fileByName = new Map()
  for (const file of files) {
    fileByName.set(file.name, file)
    const base = basename(file.name)
    if (!fileByName.has(base)) fileByName.set(base, file)
  }

  const uploadTargets = new Map()
  const queuedByResource = new Map()
  for (const resource of resources) {
    if (importGoogle && String(resource.resource_type || '').toLowerCase() === 'document' && /^https:\/\/docs\.google\.com\/(presentation|document)\/d\/[a-zA-Z0-9_-]+(?:\/|\?|$)/i.test(resource.resource_url || '')) {
      const uploadKey = `google\u0000${resource.resource_url}`
      if (!uploadTargets.has(uploadKey)) uploadTargets.set(uploadKey, { googleUrl: resource.resource_url, resourceName: resource.resource_name })
      queuedByResource.set(resource, uploadKey)
      continue
    }
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
  // Serial imports avoid buffering several large files simultaneously.
  const workers = Array.from({ length: Math.min(1, targets.length) }, async () => {
    while (nextTarget < targets.length) {
      const targetIndex = nextTarget++
      const [key, target] = targets[targetIndex]
      let upload
      if (target.googleUrl) {
        const response = await fetch('/api/courses/import-google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: target.googleUrl, name: target.resourceName }) })
        const result = await response.json().catch(() => ({}))
        if (!response.ok || !result.success) throw new Error(result.error || 'Google file import failed')
        upload = result.jobId ? await waitForCourseUploadJob(result.jobId, target.resourceName) : result
      } else upload = await queueCourseFileUpload(target.file, target.resourceType, target.resourceName)
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
      ? { ...resource, resource_name: targetName(resource, upload), resource_url: upload.r2Url, file_size: upload.fileSize }
      : resource
  })
}

function targetName(resource, upload) {
  if (!/^https:\/\/docs\.google\.com\//i.test(resource.resource_url || '')) return resource.resource_name
  const extension = upload.fileName?.match(/\.(pptx|docx)$/i)?.[0]
  return extension ? `${String(resource.resource_name || 'Document').replace(/\.(pptx?|docx?)$/i, '')}${extension}` : resource.resource_name
}

export async function queueCourseFilesInCourses(courses, files) {
  const resources = courses.flatMap((course) =>
    (course.modules || []).flatMap((module) =>
      (module.lessons || []).flatMap((lesson) => lesson.resources || []),
    ),
  )
  const queuedResources = await queueResourceFiles(resources, files, { importGoogle: true })
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
