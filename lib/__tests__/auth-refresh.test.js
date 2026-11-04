import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/jwt-utils', () => ({ verifyJWT: vi.fn(), extractUserFromJWT: vi.fn(), getTimeUntilExpiry: vi.fn(), getTokenExpiry: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn() }))
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: {} }))
vi.mock('@/lib/sso-service-client', () => ({ createSSOServiceClient: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: vi.fn(), headers: vi.fn() }))
import { refreshAction } from '../../app/actions/auth'
import { createSSOServiceClient } from '@/lib/sso-service-client'
import { cookies } from 'next/headers'
import { verifyJWT, extractUserFromJWT } from '@/lib/jwt-utils'

let store, refresh
beforeEach(() => {
  vi.clearAllMocks()
  store = { get: vi.fn(() => ({ value: 'refresh-token' })), delete: vi.fn(), set: vi.fn() }
  refresh = vi.fn()
  cookies.mockResolvedValue(store)
  createSSOServiceClient.mockResolvedValue({ refresh })
})
describe('actual refresh action', () => {
  it.each(['unavailable', 'timeout', 'cancelled', 'rate_limited'])('preserves credentials for %s', async kind => {
    refresh.mockResolvedValue({ kind, retryAfterSeconds: 90 })
    const result = await refreshAction()
    expect(result).toMatchObject({ success: false, status: kind === 'rate_limited' ? 429 : 503, retryable: true })
    expect(store.delete).not.toHaveBeenCalled()
    expect(store.set).not.toHaveBeenCalled()
    if (kind === 'rate_limited') expect(result.retryAfterSeconds).toBe(90)
  })
  it('preserves credentials when the RPC transport throws', async () => {
    refresh.mockRejectedValue(new Error('Connection lost'))
    expect(await refreshAction()).toMatchObject({ status: 503, retryable: true })
    expect(store.delete).not.toHaveBeenCalled()
  })
  it('clears credentials only after definitive rejection', async () => {
    refresh.mockResolvedValue({ kind: 'rejected', code: 'expired' })
    expect(await refreshAction()).toMatchObject({ status: 401, retryable: false })
    expect(store.delete.mock.calls.map(([name]) => name)).toEqual(['sso_refresh_token', 'sso_access_token', 'sso_user'])
  })
  it.each(['rotated', 'overlap'])('writes the new session for %s', async kind => {
    refresh.mockResolvedValue({ kind, session: { accessToken: 'new-access', refreshToken: 'new-refresh' } })
    verifyJWT.mockResolvedValue({ valid: true })
    extractUserFromJWT.mockReturnValue({ id: 'admin', email: 'admin@example.test', roles: ['super_admin'], expiresAt: Math.floor(Date.now() / 1000) + 3600 })
    expect(await refreshAction()).toMatchObject({ success: true, user: { id: 'admin' } })
    expect(store.set).toHaveBeenCalledWith('sso_access_token', 'new-access', expect.any(Object))
    expect(store.set).toHaveBeenCalledWith('sso_refresh_token', 'new-refresh', expect.any(Object))
    expect(store.delete).not.toHaveBeenCalled()
  })
})
