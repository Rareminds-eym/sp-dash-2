import { refreshAction } from '@/app/actions/auth'
import { loginUrl, safeReturnTo, RECOVERY_PARAM } from '@/lib/auth-redirect'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const returnTo = safeReturnTo(new URL(request.url).searchParams.get('next'))
  const result = await refreshAction()
  if (!result.success && result.status !== 401) {
    // Stop here on temporary errors. A redirect would either retry forever or
    // force a new login even though the refresh credentials remain usable.
    const retryUrl = '/auth/refresh?' + new URLSearchParams({ next: returnTo })
    const response = new NextResponse(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Session recovery</title><main><h1>Session recovery is temporarily unavailable</h1><p>Your session has been kept. Please try again shortly.</p><a href="${retryUrl.replaceAll('&', '&amp;')}">Try again</a></main></html>`, {
      status: result.status === 429 ? 429 : 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': String(result.retryAfterSeconds || 30) },
    })
    return response
  }
  if (!result.success) {
    const cookieStore = await cookies()
    const prefix = process.env.NODE_ENV === 'production' ? '__Host-' : ''
    for (const name of ['sso_access_token', 'sso_user', 'sso_refresh_token']) {
      cookieStore.set(prefix + name, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 })
    }
  }
  const target = new URL(result.success ? returnTo : loginUrl(returnTo), request.url)
  // Bound recovery even if the browser refuses to retain the refreshed cookies.
  if (result.success) target.searchParams.set(RECOVERY_PARAM, '1')
  const response = NextResponse.redirect(target, 303)
  response.headers.set('Cache-Control', 'no-store')
  return response
}
