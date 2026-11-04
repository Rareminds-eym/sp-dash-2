import { beforeEach, describe, expect, it, vi } from 'vitest'
import { safeReturnTo, loginUrl, RECOVERY_PARAM } from '../auth-redirect'

vi.mock('next/server', () => ({ NextResponse: class extends Response {
  static next() { return { next: true } }
  static redirect(url, status = 307) {
    const response = new this(null, { status, headers: { Location: String(url) } })
    Object.defineProperty(response, 'url', { value: String(url) })
    return response
  }
} }))
vi.mock('@/app/actions/auth', () => ({ refreshAction: vi.fn(), getSessionAction: vi.fn(), loginAction: vi.fn(), logoutAction: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))
import { middleware } from '../../middleware'
import { GET } from '../../app/auth/refresh/route'
import { refreshAction, getSessionAction } from '@/app/actions/auth'
import { cookies } from 'next/headers'

function request(path, values = {}) {
  const url = new URL(path, 'http://localhost:3010')
  return { url: url.href, nextUrl: url, method: 'GET', headers: new Headers(), cookies: { get: name => values[name] ? { value: values[name] } : undefined } }
}
const token = exp => 'header.' + Buffer.from(JSON.stringify({ exp })).toString('base64url') + '.signature'
const validSession = () => ({ sso_user: '{}', sso_access_token: token(Date.now() / 1000 + 3600) })

beforeEach(() => vi.clearAllMocks())

describe('safe return destinations', () => {
  it.each(['https://evil.test', '//evil.test', '/\\evil.test', '/login?next=/users', '/auth/refresh', '/api/users', '/a/../login', '/users\n', '/%6cogin', '/%2f%2fevil.test', '/%5cevil.test', '/%zz'])('rejects %j', value => {
    expect(safeReturnTo(value)).toBe('/dashboard')
  })
  it('keeps the original path, query and fragment', () => {
    expect(safeReturnTo('/integrations/zoho-recruit?source=123#jobs')).toBe('/integrations/zoho-recruit?source=123#jobs')
  })
})

describe('reload routing', () => {
  it('keeps a valid session on its original page', () => {
    expect(middleware(request('/integrations/zoho-recruit?source=123', validSession()))).toEqual({ next: true })
  })
  it.each(['expired', 'missing', 'malformed'])('recovers a %s access token before rendering', kind => {
    const values = { sso_user: '{}', sso_refresh_token: 'refresh' }
    if (kind !== 'missing') values.sso_access_token = kind === 'expired' ? token(1) : 'broken'
    const response = middleware(request('/integrations/zoho-recruit?source=123', values))
    const target = new URL(response.url)
    expect(target.pathname).toBe('/auth/refresh')
    expect(target.searchParams.get('next')).toBe('/integrations/zoho-recruit?source=123')
  })
  it.each(['/approvals?tab=students', '/educators', '/educator/subscriptions', '/users'])('preserves %s through login without refresh credentials', path => {
    expect(middleware(request(path)).url).toBe('http://localhost:3010' + loginUrl(path))
  })
  it.each(['/login', '/reset-password'])('does not bounce %s based on cookies', path => {
    expect(middleware(request(path, { sso_user: '{}', sso_access_token: 'broken' }))).toEqual({ next: true })
  })
  it('allows session and refresh Server Actions to run after access-token expiry', () => {
    const req = request('/reports', { sso_refresh_token: 'refresh' })
    req.method = 'POST'
    req.headers.set('next-action', 'refresh-action-id')
    expect(middleware(req)).toEqual({ next: true })
  })
  it('does not capture unrelated routes with a shared prefix', () => {
    expect(middleware(request('/users-public'))).toEqual({ next: true })
  })
})

describe('refresh navigation', () => {
  it('returns to the original page after recovery without caching the redirect', async () => {
    refreshAction.mockResolvedValue({ success: true })
    const response = await GET(request('/auth/refresh?next=%2Freports%3Ftab%3Dplacements'))
    expect(response.url).toBe('http://localhost:3010/reports?tab=placements&' + RECOVERY_PARAM + '=1')
    expect(response.status).toBe(303)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
  it('clears stale cookies after failed refresh and preserves the login destination', async () => {
    refreshAction.mockResolvedValue({ success: false, status: 401 })
    const set = vi.fn()
    cookies.mockResolvedValue({ set })
    const response = await GET(request('/auth/refresh?next=%2Freports%3Ftab%3Dplacements'))
    expect(new URL(response.url).pathname).toBe('/login')
    expect(new URL(response.url).searchParams.get('next')).toBe('/reports?tab=placements')
    expect(set.mock.calls.map(call => call[0])).toEqual(['sso_access_token', 'sso_user', 'sso_refresh_token'])
    for (const call of set.mock.calls) expect(call[2]).toMatchObject({ maxAge: 0, path: '/' })
  })
  it('does not redirect to an external destination', async () => {
    refreshAction.mockResolvedValue({ success: true })
    expect((await GET(request('/auth/refresh?next=https://evil.test'))).url).toBe('http://localhost:3010/dashboard?' + RECOVERY_PARAM + '=1')
  })
})

describe('client session recovery', () => {
  it('refreshes when session validation fails, before deciding to navigate to login', async () => {
    // No browser globals: avoid starting the module auto-refresh timer.
    const { authClient } = await import('../auth-client')
    authClient.clearAuthState()
    getSessionAction.mockResolvedValue({ authenticated: false })
    refreshAction.mockResolvedValue({ success: true, user: { id: 'admin' }, expiresAt: Date.now() + 3600000 })
    expect(await authClient.checkAuth()).toEqual({ authenticated: true, user: { id: 'admin' } })
    expect(refreshAction).toHaveBeenCalledTimes(1)
    authClient.clearAuthState()
  })
})

describe('production session cookies', () => {
  it('recognizes host-prefixed cookies and preserves the request origin', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.resetModules()
    try {
      const { middleware: productionMiddleware } = await import('../../middleware')
      const req = request('/reports', { '__Host-sso_user': '{}', '__Host-sso_access_token': token(Date.now() / 1000 + 3600) })
      expect(productionMiddleware(req)).toEqual({ next: true })
      const missing = request('/reports?tab=placements')
      missing.url = 'https://admin.example.test/reports?tab=placements'
      expect(productionMiddleware(missing).url).toBe('https://admin.example.test' + loginUrl('/reports?tab=placements'))
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

describe('bounded recovery', () => {
  it('stops at login if cookies were not retained after a successful refresh', async () => {
    const staleCookies = { sso_refresh_token: 'refresh' }
    const initial = middleware(request('/reports?tab=placements', staleCookies))
    refreshAction.mockResolvedValue({ success: true })
    const recovered = await GET(request(initial.url))
    const next = middleware(request(recovered.url, staleCookies))
    expect(new URL(next.url).pathname).toBe('/login')
    expect(new URL(next.url).searchParams.get('next')).toBe('/reports?tab=placements')
    expect(middleware(request(next.url, staleCookies))).toEqual({ next: true })
    expect(refreshAction).toHaveBeenCalledTimes(1)
  })
  it('removes the recovery marker and renders the original route when cookies persist', async () => {
    refreshAction.mockResolvedValue({ success: true })
    const recovered = await GET(request('/auth/refresh?next=%2Freports%3Ftab%3Dplacements'))
    const cleaned = middleware(request(recovered.url, validSession()))
    expect(cleaned.url).toBe('http://localhost:3010/reports?tab=placements')
    expect(middleware(request(cleaned.url, validSession()))).toEqual({ next: true })
  })
  it.each([429, 503, 500])('stops on HTTP %s without redirecting or clearing credentials', async status => {
    refreshAction.mockResolvedValue({ success: false, status, retryable: true, retryAfterSeconds: 60 })
    const response = await GET(request('/auth/refresh?next=%2Freports%3Ftab%3Dplacements'))
    expect(response.status).toBe(status === 429 ? 429 : 503)
    expect(response.headers.get('Location')).toBeNull()
    expect(response.headers.get('Retry-After')).toBe('60')
    expect(cookies).not.toHaveBeenCalled()
    expect(await response.text()).toContain('Try again')
  })
})

describe('retryable client failures', () => {
  it('keeps cached state and respects rate-limit backoff without navigating', async () => {
    const { authClient } = await import('../auth-client')
    authClient.clearAuthState()
    authClient.refreshFailure = null
    authClient.refreshRetryAt = 0
    authClient.authState = { authenticated: true, user: { id: 'admin' }, expiresAt: Date.now() - 1000 }
    getSessionAction.mockResolvedValue({ authenticated: false })
    refreshAction.mockResolvedValue({ success: false, status: 429, error: 'Try again shortly', retryAfterSeconds: 120 })
    const navigate = vi.spyOn(authClient, 'handleAuthFailure')
    const result = await authClient.checkAuth()
    expect(result).toMatchObject({ authenticated: false, retryable: true })
    expect(authClient.authState.user).toEqual({ id: 'admin' })
    expect(navigate).not.toHaveBeenCalled()
    await authClient.refreshToken()
    expect(refreshAction).toHaveBeenCalledTimes(1)
    navigate.mockRestore()
    authClient.clearAuthState()
    authClient.refreshFailure = null
    authClient.refreshRetryAt = 0
  })
  it('does not treat a session transport exception as a logout', async () => {
    const { authClient } = await import('../auth-client')
    getSessionAction.mockRejectedValue(new Error('Network unavailable'))
    const navigate = vi.spyOn(authClient, 'handleAuthFailure')
    expect(await authClient.checkAuth()).toMatchObject({ authenticated: false, retryable: true })
    expect(navigate).not.toHaveBeenCalled()
    navigate.mockRestore()
  })
})
