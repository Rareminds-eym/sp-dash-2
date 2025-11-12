import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const secretKey = process.env.SESSION_SECRET

// Warn if SESSION_SECRET is missing but don't crash during module initialization
if (!secretKey) {
  console.warn('⚠️  WARNING: SESSION_SECRET environment variable is not set. Session functionality will not work.')
}

// Helper function to get the key with runtime check
function getKey() {
  if (!secretKey) {
    throw new Error(
      'SESSION_SECRET environment variable is required for authentication. ' +
      'Please set it in your production environment variables.'
    )
  }
  return new TextEncoder().encode(secretKey)
}

export async function encrypt(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(key)
}

export async function decrypt(input) {
  try {
    const { payload } = await jwtVerify(input, key, {
      algorithms: ['HS256'],
    })
    return payload
  } catch (error) {
    return null
  }
}

export async function createSession(user) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  const session = await encrypt({ user, expiresAt })
  
  const cookieStore = await cookies()
  cookieStore.set('session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  })
  
  return session
}

export async function getSession() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  
  if (!session) return null
  
  return await decrypt(session)
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}

export async function updateSession() {
  const session = await getSession()
  
  if (!session) return null
  
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const cookieStore = await cookies()
  cookieStore.set('session', await encrypt({ ...session, expiresAt }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  })
  
  return session
}