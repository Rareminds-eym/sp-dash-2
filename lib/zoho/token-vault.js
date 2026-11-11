function decode(value) {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}
function encode(value) {
  return btoa(Array.from(value, byte => String.fromCharCode(byte)).join(''));
}
async function key(value) {
  const bytes = decode(value || '');
  if (bytes.length !== 32) throw new Error('Zoho encryption key must contain 32 bytes');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const idPattern = /^[A-Za-z0-9_-]{1,80}$/;
/** Explicit read keyring; missing key IDs never fall back to a different key. */
export function tokenKeyring(env) {
  if (!env.ZOHO_TOKEN_ENCRYPTION_KEYS && !env.ZOHO_TOKEN_ENCRYPTION_ACTIVE_KEY_ID) {
    if (decode(env.ZOHO_TOKEN_ENCRYPTION_KEY || '').length !== 32) throw new Error('Invalid Zoho encryption configuration');
    return env.ZOHO_TOKEN_ENCRYPTION_KEY;
  }
  let keys;
  try { keys = JSON.parse(env.ZOHO_TOKEN_ENCRYPTION_KEYS); } catch { throw new Error('Invalid Zoho encryption configuration'); }
  const activeKeyId = env.ZOHO_TOKEN_ENCRYPTION_ACTIVE_KEY_ID;
  if (!keys || typeof keys !== 'object' || Array.isArray(keys) || typeof activeKeyId !== 'string' || !idPattern.test(activeKeyId) ||
    !Object.hasOwn(keys, activeKeyId) || Object.keys(keys).length > 8 ||
    Object.entries(keys).some(([id, value]) => !idPattern.test(id) || typeof value !== 'string' || decode(value).length !== 32))
    throw new Error('Invalid Zoho encryption configuration');
  const legacyKey = env.ZOHO_TOKEN_ENCRYPTION_KEY;
  if (legacyKey && decode(legacyKey).length !== 32) throw new Error('Invalid Zoho encryption configuration');
  return { activeKeyId, keys, legacyKey };
}
export function hasTokenKeyring(env) { try { tokenKeyring(env); return true; } catch { return false; } }
function material(secret, keyId, writing) {
  if (typeof secret === 'string') {
    if (keyId !== undefined) throw new Error('Token key unavailable');
    return { secret };
  }
  const id = writing ? secret?.activeKeyId : keyId;
  if (id === undefined) {
    if (!secret?.legacyKey) throw new Error('Legacy token key unavailable');
    return { secret: secret.legacyKey };
  }
  if (!idPattern.test(id) || !Object.hasOwn(secret?.keys || {}, id)) throw new Error('Token key unavailable');
  return { secret: secret.keys[id], keyId: id };
}
function associated(connectionId, keyId) {
  return new TextEncoder().encode(keyId === undefined ? connectionId : JSON.stringify([connectionId, keyId]));
}
export async function sealTokens(tokens, secret, connectionId) {
  const selected = material(secret, undefined, true);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: associated(connectionId, selected.keyId) }, await key(selected.secret), new TextEncoder().encode(JSON.stringify(tokens)));
  return { version: 1, ...(selected.keyId ? { keyId: selected.keyId } : {}), iv: encode(iv), ciphertext: encode(new Uint8Array(data)) };
}
export async function openTokens(envelope, secret, connectionId) {
  if (envelope?.version !== 1) throw new Error('Unsupported token envelope');
  const selected = material(secret, envelope.keyId, false);
  const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(envelope.iv), additionalData: associated(connectionId, selected.keyId) }, await key(selected.secret), decode(envelope.ciphertext));
  return JSON.parse(new TextDecoder().decode(data));
}
export async function stateHash(value) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
