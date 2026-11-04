export const RECOVERY_PARAM = '__sso_recovered'

// Only navigate to local app pages after authentication.
export function safeReturnTo(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20]/.test(value)) return '/dashboard'
  try {
    const target = new URL(value, 'https://dashboard.invalid')
    const decodedPath = decodeURIComponent(target.pathname)
    if (/[\\\x00-\x20]/.test(decodedPath) || decodedPath.startsWith('//')) return '/dashboard'
    const normalized = new URL(decodedPath, 'https://dashboard.invalid')
    if (normalized.origin !== 'https://dashboard.invalid' || /^\/(?:login|reset-password|auth|api|_next)(?:\/|$)/.test(normalized.pathname)) return '/dashboard'
    target.searchParams.delete(RECOVERY_PARAM)
    return target.pathname + target.search + target.hash
  } catch {
    return '/dashboard'
  }
}

export function loginUrl(returnTo) {
  return '/login?' + new URLSearchParams({ next: safeReturnTo(returnTo) })
}
