import { NextResponse } from 'next/server'

const protectedRoutes = ['/dashboard', '/users', '/passports', '/recruiters', '/reports', '/audit-logs', '/integrations', '/settings', '/course-management', '/student-dashboard']
const publicRoutes = ['/login', '/reset-password']

/**
 * Enhanced middleware with automatic token refresh
 */
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
  const ssoRefreshToken = req.cookies.get('sso_refresh_token')?.value

  const hasValidSession = !!(ssoAccessToken && ssoUser)

  // For protected routes
  if (isProtectedRoute) {
    if (!hasValidSession) {
      // No session - redirect to login
      const redirectUrl = new URL('/login', req.url)
      return NextResponse.redirect(redirectUrl)
    }

    // Check if token is about to expire (within 5 minutes)
    try {
      if (ssoAccessToken) {
        const base64 = ssoAccessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(base64));
        const now = Math.floor(Date.now() / 1000)
        const expiresIn = payload.exp - now

        // If token expires in less than 5 minutes and we have a refresh token
        if (expiresIn < 300 && ssoRefreshToken) {
          console.log('[Middleware] Token expires soon, will refresh on next API call')
          // Note: We don't refresh here to avoid blocking the middleware
          // The frontend will handle refresh on the next API call
        }
      }
    } catch (error) {
      console.error('[Middleware] Error checking token expiry:', error)
      // If we can't decode the token, redirect to login
      const redirectUrl = new URL('/login', req.url)
      return NextResponse.redirect(redirectUrl)
    }
  }

  // For public routes - redirect to dashboard if already logged in
  if (isPublicRoute && hasValidSession) {
    const redirectUrl = new URL('/dashboard', req.url)
    return NextResponse.redirect(redirectUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}