import 'server-only'

// ============================================================================
// Edge-Compatible Rate Limiter (Cloudflare KV + In-Memory Fallback)
// ============================================================================
// Uses Cloudflare KV namespace (RATE_LIMIT_KV) in production for distributed
// rate limiting across all edge isolates. Falls back to in-memory Map for 
// local development where KV is not available.
//
// Algorithm: Fixed-window counter with KV TTL-based auto-expiry.
// Each key stores a JSON object: { count: number, windowStart: number }
// KV's expirationTtl handles automatic cleanup — no GC needed.
// ============================================================================

/**
 * Get the RATE_LIMIT_KV binding from Cloudflare Pages environment.
 * Returns null if not available (e.g., in local dev without KV).
 */
async function getRateLimitKV() {
  try {
    const { getRequestContext } = await import('@cloudflare/next-on-pages')
    const { env } = getRequestContext()
    return env.RATE_LIMIT_KV || null
  } catch {
    return null
  }
}

// In-memory fallback for local development only
const localRateLimits = new Map()

/**
 * Check rate limit for a given identifier using Cloudflare KV (production)
 * or in-memory Map (local dev).
 * 
 * @param {string} identifier - Unique key (e.g., `login_${ip}`)
 * @param {number} limit - Max allowed requests in the window (default: 5)
 * @param {number} windowMs - Time window in milliseconds (default: 60000 = 1 min)
 * @returns {Promise<boolean>} true if allowed, false if rate limited
 */
export async function checkRateLimit(identifier, limit = 5, windowMs = 60000) {
  const kv = await getRateLimitKV()

  if (kv) {
    return checkRateLimitKV(kv, identifier, limit, windowMs)
  }

  // Fallback: in-memory for local dev
  return checkRateLimitLocal(identifier, limit, windowMs)
}

/**
 * Cloudflare KV-based rate limiter (distributed, production-grade).
 * Uses KV's built-in expirationTtl for automatic key cleanup.
 */
async function checkRateLimitKV(kv, identifier, limit, windowMs) {
  const now = Date.now()
  const key = `rl:${identifier}`
  const windowSec = Math.ceil(windowMs / 1000)

  try {
    const raw = await kv.get(key)

    if (!raw) {
      // First request in this window — allow and start counter
      await kv.put(key, JSON.stringify({ count: 1, windowStart: now }), {
        expirationTtl: windowSec,
      })
      return true
    }

    const record = JSON.parse(raw)

    // If window has expired, reset (shouldn't normally happen due to TTL, but defensive)
    if (now - record.windowStart > windowMs) {
      await kv.put(key, JSON.stringify({ count: 1, windowStart: now }), {
        expirationTtl: windowSec,
      })
      return true
    }

    // Check if over limit
    if (record.count >= limit) {
      return false
    }

    // Increment counter within window
    record.count++
    // Calculate remaining TTL to avoid extending the window
    const elapsed = now - record.windowStart
    const remainingTtlSec = Math.max(1, Math.ceil((windowMs - elapsed) / 1000))

    await kv.put(key, JSON.stringify(record), {
      expirationTtl: remainingTtlSec,
    })
    return true
  } catch (error) {
    // If KV fails, fail OPEN (allow the request) to avoid blocking legitimate users.
    // Log the error for monitoring.
    console.error('[Rate Limit] KV error, failing open:', error.message)
    return true
  }
}

/**
 * In-memory rate limiter fallback for local development.
 * NOT suitable for production on Cloudflare Edge.
 */
function checkRateLimitLocal(identifier, limit, windowMs) {
  const now = Date.now()
  const record = localRateLimits.get(identifier)

  // Clean up expired records occasionally (1% chance)
  if (Math.random() < 0.01) {
    for (const [key, val] of localRateLimits.entries()) {
      if (now - val.windowStart > windowMs) {
        localRateLimits.delete(key)
      }
    }
  }

  if (!record || now - record.windowStart > windowMs) {
    localRateLimits.set(identifier, { count: 1, windowStart: now })
    return true
  }

  if (record.count >= limit) {
    return false
  }

  record.count++
  return true
}
