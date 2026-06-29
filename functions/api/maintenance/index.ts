/**
 * Cloudflare Pages Function for maintenance mode
 * Sends queue announcements for realtime-worker to process
 */

/**
 * GET - Not supported
 * Maintenance state is managed by skillpassport. This endpoint only sends queue announcements.
 */
export async function GET(request, env) {
  return new Response(JSON.stringify({
    error: 'GET not supported. Maintenance state is managed by skillpassport.'
  }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * POST - Generate or revoke maintenance bypass token
 */
export async function POST(request, env) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action !== 'generate' && action !== 'revoke') {
      return new Response('Invalid action. Must be generate or revoke', { status: 400 });
    }

    let newTokenValue = null;
    if (action === 'generate') {
      newTokenValue = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
    } else if (action === 'revoke') {
      newTokenValue = null;
    }

    // Send queue announcement for realtime-worker to process
    if (env?.MAINTENANCE_EVENTS_QUEUE) {
      await env.MAINTENANCE_EVENTS_QUEUE.send({
        target: 'broadcast',
        event: {
          type: '__INTERNAL_MAINTENANCE_UPDATE',
          action: 'bypass_token',
          data: { action, token: newTokenValue },
          from: 'sp-dash',
        },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      bypassToken: newTokenValue
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Maintenance POST Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

/**
 * PUT - Toggle maintenance mode
 */
export async function PUT(request, env) {
  try {
    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return new Response('Invalid input: enabled must be a boolean', { status: 400 });
    }

    // Send queue announcement for realtime-worker to process
    if (env?.MAINTENANCE_EVENTS_QUEUE) {
      await env.MAINTENANCE_EVENTS_QUEUE.send({
        target: 'broadcast',
        event: {
          type: '__INTERNAL_MAINTENANCE_UPDATE',
          action: 'toggle',
          data: { enabled },
          from: 'sp-dash',
        },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'} successfully`,
      enabled
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Maintenance PUT Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
