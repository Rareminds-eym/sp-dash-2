import { NextResponse } from 'next/server';

/**
 * Test endpoint to verify SSO Worker RPC connection
 * GET /api/test-sso
 */
export async function GET() {
  try {
    // Get SSO service binding
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = await getCloudflareContext({ async: true });
    
    if (!env.SSO) {
      return NextResponse.json({
        success: false,
        error: 'SSO service binding not available',
        hint: 'Make sure wrangler.toml has the service binding configured and both workers are running'
      }, { status: 500 });
    }

    // Test 1: Call getJWKS (simple RPC method that doesn't require auth)
    console.log('[Test] Calling SSO.getJWKS()...');
    const jwks = await env.SSO.getJWKS();
    
    // Test 2: Call listRoles (another simple method)
    console.log('[Test] Calling SSO.listRoles()...');
    const roles = await env.SSO.listRoles();

    return NextResponse.json({
      success: true,
      message: 'SSO Worker RPC connection successful!',
      tests: {
        jwks: {
          success: true,
          keyCount: jwks?.keys?.length || 0
        },
        roles: {
          success: true,
          roleCount: roles?.roles?.length || 0,
          roles: roles?.roles?.map(r => r.name) || []
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Test] SSO RPC test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      hint: 'Check that both sso-worker and sp-dash-2 are running with wrangler dev'
    }, { status: 500 });
  }
}
