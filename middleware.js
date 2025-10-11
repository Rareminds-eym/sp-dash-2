import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

const protectedRoutes = ['/dashboard', '/users', '/passports', '/reports', '/audit-logs', '/integrations', '/settings']
const publicRoutes = ['/login']

export async function middleware(req) {
  const path = req.nextUrl.pathname
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route))
  const isPublicRoute = publicRoutes.includes(path)

  // Quick check: if not a protected or public route, skip middleware
  if (!isProtectedRoute && !isPublicRoute) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request: req,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Use getUser() instead of getSession() for better security and JWT validation
  const { data: { user }, error } = await supabase.auth.getUser()

  // Redirect to /login if accessing protected route without valid user
  if (isProtectedRoute && (!user || error)) {
    // Handle JWT expiration gracefully
    if (error?.message?.includes('JWT') || error?.message?.includes('expired')) {
      console.warn('JWT expired in middleware, redirecting to login')
    }
    const redirectUrl = new URL('/login', req.url)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect to /dashboard if accessing login with valid user
  if (isPublicRoute && user && !error) {
    const redirectUrl = new URL('/dashboard', req.url)
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}