import { NextResponse } from 'next/server'

const protectedRoutes = ['/dashboard', '/users', '/passports', '/recruiters', '/reports', '/audit-logs', '/integrations', '/settings']
const publicRoutes = ['/login', '/reset-password']

export async function middleware(req) {
  const path = req.nextUrl.pathname
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route))
  const isPublicRoute = publicRoutes.includes(path)

  // Quick check: if not a protected or public route, skip middleware
  if (!isProtectedRoute && !isPublicRoute) {
    return NextResponse.next()
  }

  // Check for SSO session cookies
  const ssoAccessToken = req.cookies.get('sso_access_token')?.value
  const ssoUser = req.cookies.get('sso_user')?.value

  const hasValidSession = !!(ssoAccessToken && ssoUser)

  // Redirect to /login if accessing protected route without valid session
  if (isProtectedRoute && !hasValidSession) {
    console.log('[Middleware] No valid SSO session, redirecting to login')
    const redirectUrl = new URL('/login', req.url)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect to /dashboard if accessing login with valid session
  if (isPublicRoute && hasValidSession) {
    console.log('[Middleware] Valid SSO session found, redirecting to dashboard')
    const redirectUrl = new URL('/dashboard', req.url)
    return NextResponse.redirect(redirectUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}