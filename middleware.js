import { NextResponse } from 'next/server'
import { loginUrl, safeReturnTo, RECOVERY_PARAM } from './lib/auth-redirect'

const isSecure = process.env.NODE_ENV === 'production'
const COOKIE_ACCESS = isSecure ? '__Host-sso_access_token' : 'sso_access_token'
const COOKIE_USER = isSecure ? '__Host-sso_user' : 'sso_user'
const COOKIE_REFRESH = isSecure ? '__Host-sso_refresh_token' : 'sso_refresh_token'

const protectedRoutes = ['/dashboard', '/users', '/passports', '/recruiters', '/reports', '/audit-logs', '/integrations', '/settings', '/course-management', '/student-dashboard', '/sales-dashboard', '/educator-subscriptions', '/lte-course-upload', '/organizations', '/approvals', '/educators', '/educator']

export function middleware(req) {
  // Server Actions include session checks and refresh. They must be able to
  // run with an expired access cookie; their handlers enforce authorization.
  if (req.method === 'POST' && req.headers.get('next-action')) return NextResponse.next()

  const path = req.nextUrl.pathname
  if (!protectedRoutes.some(route => path === route || path.startsWith(route + '/'))) return NextResponse.next()

  const accessToken = req.cookies.get(COOKIE_ACCESS)?.value
  const user = req.cookies.get(COOKIE_USER)?.value
  let unexpired = false
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    unexpired = Number.isFinite(payload.exp) && payload.exp > Math.floor(Date.now() / 1000)
  } catch {
    // Missing or malformed tokens need recovery, just like expired tokens.
  }

  // This is a routing gate; server session checks verify the signature.
  // Public pages must never redirect based on cookie presence alone.
  const recovered = req.nextUrl.searchParams.has(RECOVERY_PARAM)
  const returnTo = safeReturnTo(path + req.nextUrl.search)
  if (user && unexpired) {
    // Remove the one-attempt marker after cookies have reached the browser.
    if (recovered) return NextResponse.redirect(new URL(returnTo, req.url), 303)
    return NextResponse.next()
  }

  const destination = !recovered && req.cookies.get(COOKIE_REFRESH)?.value
    ? '/auth/refresh?' + new URLSearchParams({ next: returnTo })
    : loginUrl(returnTo)
  return NextResponse.redirect(new URL(destination, req.url))
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
