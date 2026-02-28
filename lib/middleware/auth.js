import { createRLSClient, getUserContext } from '../supabase-rls';
import { NextResponse } from 'next/server';

/**
 * Authentication middleware - creates RLS client and checks authentication
 * @param {Request} request - Next.js request object
 * @param {Array<string>} protectedPaths - Array of path prefixes that require auth
 * @returns {Object} { rlsClient, user, userContext, error }
 */
export async function authenticateRequest(request, protectedPaths = []) {
  const { pathname } = new URL(request.url);
  const path = pathname.replace('/api', '') || '/';
  
  // Create RLS-aware Supabase client with user context
  const { supabase: rlsClient, user, error: authError } = await createRLSClient(request);
  
  // Check if this is a protected endpoint
  const isProtectedEndpoint = protectedPaths.some(endpoint => path.startsWith(endpoint));
  
  // For protected endpoints, ensure user is authenticated
  if (isProtectedEndpoint && (!user || authError)) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      rlsClient: null,
      user: null,
      userContext: null
    };
  }
  
  // Get user context for authorization checks
  let userContext = null;
  if (user) {
    userContext = await getUserContext(rlsClient, user);
  }
  
  return {
    rlsClient,
    user,
    userContext,
    error: null
  };
}
