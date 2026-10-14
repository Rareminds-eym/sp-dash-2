const POLL_INTERVAL_MS = 2500
const POLL_TIMEOUT_MS = 15 * 60 * 1000
const MAX_TRANSIENT_ERRORS = 12

export async function queueCourseFileUpload(file, resourceType, resourceName = file.name, uploadTarget = 'resource') {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('resourceType', resourceType)
  formData.append('resourceName', resourceName)
  formData.append('uploadTarget', uploadTarget)

  const response = await fetch('/api/courses/resource-upload', {
    method: 'POST',
    body: formData,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success) {
    throw new Error(data.error || data.details || `Upload could not be queued (Status ${response.status})`)
  }
  if (!data.jobId) return data

  return waitForCourseUploadJob(data.jobId, file.name)
}

export async function waitForCourseUploadJob(jobId, label = 'course import') {
  const deadline = Date.now() + POLL_TIMEOUT_MS
  let transientErrors = 0
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    let statusResponse
    try {
      statusResponse = await fetch(`/api/courses/upload-jobs/${encodeURIComponent(jobId)}`, {
        cache: 'no-store',
      })
    } catch (error) {
      transientErrors += 1
      if (transientErrors >= MAX_TRANSIENT_ERRORS) throw error
      continue
    }

    const status = await statusResponse.json().catch(() => ({}))
    if (!statusResponse.ok || !status.success) {
      throw new Error(status.error || `Failed to read upload status (Status ${statusResponse.status})`)
    }
    transientErrors = 0

    if (status.status === 'completed') return status.result || status
    if (status.status === 'failed') {
      throw new Error(status.error || `Upload failed for ${label}`)
    }
  }

  throw new Error(`Upload is still running for ${label} (job ${jobId}). Check its status before retrying.`)
}
