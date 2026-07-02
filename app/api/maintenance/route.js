export const runtime = 'edge';
import { NextResponse } from 'next/server'
import { authenticateSSORequest } from '@/lib/middleware/sso-auth'

const SUPABASE_URL = process.env.SKILLPASSPORT_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SKILLPASSPORT_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

async function upsertConfig(key, value) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/app_config?on_conflict=key`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ key, value }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase upsert failed (${res.status}): ${text}`)
  }
}

async function deleteConfig(key) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/app_config?key=eq.${key}`, {
    method: 'DELETE',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase delete failed (${res.status}): ${text}`)
  }
}

async function tryQueueSend(env, enabled) {
  try {
    if (env?.MAINTENANCE_EVENTS_QUEUE) {
      await env.MAINTENANCE_EVENTS_QUEUE.send({
        target: 'broadcast',
        event: {
          type: '__INTERNAL_MAINTENANCE_UPDATE',
          action: 'toggle',
          data: { enabled },
          from: 'sp-dash',
        },
      })
    }
  } catch (err) {
    console.warn('Maintenance queue send failed (non-fatal):', err)
  }
}

async function tryQueueSendToken(env, action, token) {
  try {
    if (env?.MAINTENANCE_EVENTS_QUEUE) {
      await env.MAINTENANCE_EVENTS_QUEUE.send({
        target: 'broadcast',
        event: {
          type: '__INTERNAL_MAINTENANCE_UPDATE',
          action: 'bypass_token',
          data: { action, token },
          from: 'sp-dash',
        },
      })
    }
  } catch (err) {
    console.warn('Maintenance queue send failed (non-fatal):', err)
  }
}

export async function PUT(request) {
  try {
    const { error: authError } = await authenticateSSORequest(request, ['super_admin'])
    if (authError) return authError

    const { getRequestContext } = await import('@cloudflare/next-on-pages')
    const { env } = getRequestContext()

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json(
        { error: 'Supabase credentials not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { enabled } = body

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid input: enabled must be a boolean' },
        { status: 400 }
      )
    }

    await upsertConfig('maintenance_mode', enabled ? 'true' : 'false')

    tryQueueSend(env, enabled)

    return NextResponse.json({
      success: true,
      message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'} successfully`,
      enabled,
    })
  } catch (error) {
    console.error('Maintenance PUT Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    const { error: authError } = await authenticateSSORequest(request, ['super_admin'])
    if (authError) return authError

    const { getRequestContext } = await import('@cloudflare/next-on-pages')
    const { env } = getRequestContext()

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json(
        { error: 'Supabase credentials not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { action } = body

    if (action !== 'generate' && action !== 'revoke') {
      return NextResponse.json(
        { error: 'Invalid action. Must be generate or revoke' },
        { status: 400 }
      )
    }

    let newTokenValue = null
    if (action === 'generate') {
      newTokenValue = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').substring(0, 16)
      await upsertConfig('maintenance_bypass_token', newTokenValue)
    } else {
      await deleteConfig('maintenance_bypass_token')
    }

    tryQueueSendToken(env, action, newTokenValue)

    return NextResponse.json({
      success: true,
      bypassToken: newTokenValue,
    })
  } catch (error) {
    console.error('Maintenance POST Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
