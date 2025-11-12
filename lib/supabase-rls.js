import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Creates a Supabase client with proper RLS context for API routes
 * This client respects Row Level Security policies and uses the authenticated user's context
 * 
 * @param {Request} request - The incoming request object (optional, for extracting cookies from API routes)
 * @returns {Promise<Object>} Object containing supabase client and user
 */
export async function createRLSClient(request = null) {
  let cookieStore
  
  if (request) {
    // For API routes - extract cookies from request
    const cookieHeader = request.headers.get('cookie') || ''
    const parsedCookies = parseCookieHeader(cookieHeader)
    
    cookieStore = {
      getAll() {
        return Object.entries(parsedCookies).map(([name, value]) => ({ name, value }))
      },
      get(name) {
        return parsedCookies[name] ? { name, value: parsedCookies[name] } : undefined
      }
    }
  } else {
    // For server components - use Next.js cookies
    cookieStore = await cookies()
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              if (cookieStore.set) {
                cookieStore.set(name, value, options)
              }
            })
          } catch {
            // Ignore errors in API routes where we can't set cookies
          }
        },
      },
    }
  )

  // Get the authenticated user
  const { data: { user }, error } = await supabase.auth.getUser()

  return {
    supabase,
    user,
    error
  }
}

/**
 * Helper function to parse cookie header string
 */
function parseCookieHeader(cookieHeader) {
  const cookies = {}
  if (!cookieHeader) return cookies
  
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=')
    if (name && rest.length > 0) {
      cookies[name.trim()] = rest.join('=').trim()
    }
  })
  
  return cookies
}

/**
 * Middleware helper to ensure user is authenticated
 * Returns user or throws error
 */
export async function requireAuth(request) {
  const { supabase, user, error } = await createRLSClient(request)
  
  if (error || !user) {
    throw new Error('Unauthorized')
  }
  
  return { supabase, user }
}

/**
 * Get user's role and entity information for authorization checks
 */
export async function getUserContext(supabase, user) {
  if (!user) return null
  
  // Fetch user details from users table
  const { data: userData, error } = await supabase
    .from('users')
    .select('id, email, isActive, metadata, organizationId')
    .eq('email', user.email)
    .maybeSingle()
  
  if (error || !userData) {
    console.error('Error fetching user context:', error)
    return null
  }

  // Fetch admin role from admin_users table
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('admin_role')
    .eq('user_id', userData.id)
    .maybeSingle()
  
  // Fetch organization data if applicable
  let organizationData = null
  if (userData.organizationId) {
    const { data: orgData } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', userData.organizationId)
      .maybeSingle()
    organizationData = orgData
  }
  
  return {
    id: userData.id,
    authId: user.id,
    email: userData.email,
    role: adminUser?.admin_role || null,
    organizationId: userData.organizationId,
    organization: organizationData,
    isActive: userData.isActive,
    metadata: userData.metadata,
    name: userData.metadata?.name || user.user_metadata?.name || user.email.split('@')[0]
  }
}

/**
 * Check if user has required permission
 */
export async function hasPermission(supabase, userRole, permissionName) {
  const { data: permissions } = await supabase
    .from('role_permissions')
    .select(`
      permissions (
        name
      )
    `)
    .eq('role', userRole)
  
  if (!permissions || permissions.length === 0) {
    return false
  }
  
  return permissions.some(p => p.permissions?.name === permissionName)
}

/**
 * Get session with RLS-aware Supabase client
 * This function is designed for server components (pages)
 * Returns user session with full context and respects Row Level Security
 */
export async function getSession() {
  const { supabase, user, error } = await createRLSClient()
  
  if (error || !user) {
    // Handle JWT expiration and other auth errors gracefully
    if (error?.message?.includes('JWT') || error?.message?.includes('expired')) {
      console.warn('JWT expired or invalid:', error.message)
    }
    return null
  }
  
  // Fetch additional user data from users table (with RLS applied)
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, email, firstName, lastName, role, isActive, organizationId, createdAt, metadata')
    .eq('email', user.email)
    .maybeSingle()
  
  // Fetch organization data separately if organizationId exists
  let organizationData = null
  if (userData && userData.organizationId) {
    const { data: orgData } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', userData.organizationId)
      .maybeSingle()
    organizationData = orgData
  }
  
  if (userError) {
    console.error('Error fetching user data:', userError)
    // Return basic auth user data if custom user data fetch fails
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email.split('@')[0],
        role: user.user_metadata?.role || 'user',
      }
    }
  }
  
  const userName = userData?.metadata?.name || user.user_metadata?.name || user.email.split('@')[0]
  
  return {
    user: {
      id: userData.id,
      email: userData.email,
      name: userName,
      role: userData.role,
      organizationId: userData.organizationId,
      organization: organizationData,
      isActive: userData.isActive,
    }
  }
}
