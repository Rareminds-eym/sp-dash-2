import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

export async function getUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }
  
  return user
}

export async function getSession() {
  const supabase = await createClient()
  const { data: { session }, error } = await supabase.auth.getSession()
  
  if (error || !session) {
    return null
  }
  
  // Fetch additional user data from users table (lookup by email since IDs may not match)
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', session.user.email)
    .maybeSingle()
  
  // Fetch organization data separately if organizationId exists
  let organizationData = null
  if (userData && userData.organizationId) {
    const { data: orgData } = await supabase
      .from('organizations')
      .select('id, name, type')
      .eq('id', userData.organizationId)
      .maybeSingle()
    organizationData = orgData
  }
  
  if (userError) {
    console.error('Error fetching user data:', userError)
    // Return basic auth user data if custom user data fetch fails
    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.user_metadata?.name || session.user.email.split('@')[0],
        role: session.user.user_metadata?.role || 'user',
      }
    }
  }
  
  const userName = userData?.metadata?.name || session.user.user_metadata?.name || session.user.email.split('@')[0]
  
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