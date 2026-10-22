import { beforeAll, describe, expect, it, vi } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
const fixture = vi.hoisted(() => ({ jwks: { keys: [] as any[] } }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/sso-service-client', () => ({ createSSOServiceClient: async () => ({ getJWKS: async () => fixture.jwks }) }));
import { verifyJWT } from '../jwt-utils';
let privateKey: CryptoKey;
beforeAll(async () => {
  const pair = await generateKeyPair('RS256'); privateKey = pair.privateKey;
  fixture.jwks = { keys: [{ ...await exportJWK(pair.publicKey), alg: 'RS256' }] };
});
const options = { issuer: 'sso-api', audience: 'sso-client', enforceClaims: true, allowDevelopmentFallback: false };
async function token(issuer = 'sso-api', audience = 'sso-client') {
  return new SignJWT({ sub: 'admin-1' }).setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt().setExpirationTime('5m').setIssuer(issuer).setAudience(audience).sign(privateKey);
}
describe('strict educator-admin JWT verification', () => {
  it('accepts the actual SSO issuer and audience', async () => expect((await verifyJWT(await token(), options)).valid).toBe(true));
  it('rejects signed tokens for another issuer/audience', async () => {
    expect((await verifyJWT(await token('other'), options)).valid).toBe(false);
    expect((await verifyJWT(await token('sso-api', 'other'), options)).valid).toBe(false);
  });
  it('does not use decode-only fallback for a forged token, including in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    try { expect((await verifyJWT(`${(await token()).split('.').slice(0, 2).join('.')}.invalid`, options)).valid).toBe(false); }
    finally { vi.unstubAllEnvs(); }
  });
});
