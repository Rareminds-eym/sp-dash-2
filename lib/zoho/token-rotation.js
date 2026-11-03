import { openTokens, sealTokens, tokenKeyring } from './token-vault';

/** Called only after the existing admin authorization and explicit operator
 * confirmation. Pausing and generation/envelope CAS fence revoke/reconnect and
 * refresh races. Result never includes the envelope or token/key material. */
export async function rotateConnectionTokens(db, env, { connectionId, actor, expectedGeneration, reason }) {
  if (!actor || !Number.isInteger(expectedGeneration) || expectedGeneration < 0 ||
    typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 500) throw new Error('Explicit rotation confirmation required');
  const keyring = tokenKeyring(env);
  if (typeof keyring === 'string') throw new Error('A current key ID and read keyring are required for rotation');
  const connection = await db.from('zoho_connections').select('id,status,credential_generation').eq('id', connectionId).single();
  if (connection.error || connection.data?.status !== 'paused' || connection.data.credential_generation !== expectedGeneration)
    throw new Error('Pause the current connection before rotating credentials');
  const stored = await db.from('zoho_connection_secrets').select('envelope').eq('connection_id', connectionId).single();
  if (stored.error || !stored.data?.envelope) throw new Error('Stored credentials are unavailable; reconnect is required');
  let envelope;
  try { envelope = await sealTokens(await openTokens(stored.data.envelope, keyring, connectionId), keyring, connectionId); }
  catch { throw new Error('Stored credentials cannot be decrypted; restore the approved read key or reconnect'); }
  const result = await db.rpc('zoho_rotate_connection_tokens', { p_connection: connectionId, p_generation: expectedGeneration,
    p_expected: stored.data.envelope, p_envelope: envelope, p_actor: actor, p_reason: reason.trim() });
  if (result.error) throw new Error('Credentials changed during rotation; review the connection before retrying');
  return result.data;
}
