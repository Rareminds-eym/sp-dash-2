import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authenticateSSORequest } from '@/lib/middleware/sso-auth'
import { logAudit } from '@/lib/services/auditService'

export const runtime = 'edge'

export async function GET(request) {
  try {
    // Authenticate user
    const { user, error: authError } = await authenticateSSORequest(request)
    
    if (authError || !user) {
      return authError || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only super_admin can view this settings
    const hasAccess = user.roles?.includes('super_admin');

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = supabaseAdmin

    // Fetch current maintenance mode status and bypass token
    const { data, error } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', ['maintenance_mode', 'maintenance_bypass_token'])

    if (error) {
      console.error('Error fetching maintenance config:', error)
      return NextResponse.json({ error: 'Failed to fetch maintenance status' }, { status: 500 })
    }

    const modeConfig = data?.find(d => d.key === 'maintenance_mode')
    const tokenConfig = data?.find(d => d.key === 'maintenance_bypass_token')

    const isEnabled = modeConfig?.value === 'true'
    const bypassToken = tokenConfig?.value || null

    return NextResponse.json({ enabled: isEnabled, bypassToken })
  } catch (error) {
    console.error('Maintenance GET Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { user, error: authError } = await authenticateSSORequest(request)
    
    if (authError || !user) {
      return authError || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasAccess = user.roles?.includes('super_admin');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { action } = body

    if (action !== 'generate' && action !== 'revoke') {
      return NextResponse.json({ error: 'Invalid action. Must be generate or revoke' }, { status: 400 })
    }

    const supabase = supabaseAdmin
    let newTokenValue = null

    if (action === 'generate') {
      newTokenValue = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').substring(0, 16)
      
      const { error } = await supabase
        .from('app_config')
        .upsert({ key: 'maintenance_bypass_token', value: newTokenValue }, { onConflict: 'key' })

      if (error) throw error
    } else if (action === 'revoke') {
      const { error } = await supabase
        .from('app_config')
        .delete()
        .eq('key', 'maintenance_bypass_token')

      if (error) throw error
    }

    await logAudit(
      user.id,
      'MAINTENANCE_BYPASS_TOKEN',
      'app_config:maintenance_bypass_token',
      { action, toggled_by: user.email || user.id },
      request.headers.get('x-forwarded-for') || '',
    )

    return NextResponse.json({ 
      success: true, 
      bypassToken: newTokenValue 
    })
  } catch (error) {
    console.error('Maintenance POST Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    // Authenticate user
    const { user, error: authError } = await authenticateSSORequest(request)
    
    if (authError || !user) {
      return authError || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only super_admin can toggle maintenance mode
    const hasAccess = user.roles?.includes('super_admin');

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden: Only super_admin can toggle maintenance mode' }, { status: 403 })
    }

    const body = await request.json()
    const { enabled } = body

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid input: enabled must be a boolean' }, { status: 400 })
    }

    const supabase = supabaseAdmin

    // Upsert the config value
    const { error: updateError } = await supabase
      .from('app_config')
      .upsert({ 
        key: 'maintenance_mode', 
        value: enabled ? 'true' : 'false' 
      }, { onConflict: 'key' })

    if (updateError) {
      console.error('Error updating maintenance mode:', updateError)
      return NextResponse.json({ error: 'Failed to update maintenance mode' }, { status: 500 })
    }

    // Audit log
    await logAudit(
      user.id,
      'MAINTENANCE_MODE_TOGGLE',
      'app_config:maintenance_mode',
      { enabled, toggled_by: user.email || user.id },
      request.headers.get('x-forwarded-for') || '',
    )

    return NextResponse.json({ 
      success: true, 
      message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'} successfully`,
      enabled 
    })
  } catch (error) {
    console.error('Maintenance PUT Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
