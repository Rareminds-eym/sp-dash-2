/**
 * ID and UUID utilities
 * Ported from excel_to_lte_seed.py
 */

import { UUID_NAMESPACE } from './constants';
import { createHash } from 'crypto';

/**
 * Check if a value is a valid UUID
 */
export function isUUID(value: any): boolean {
  if (!value) return false;
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(String(value));
}

/**
 * Generate deterministic UUID v5 from namespace and name
 * Equivalent to Python's uuid.uuid5()
 */
export function deterministicUUID(table: string, value: any): string {
  const name = `${table}:${String(value).trim()}`;
  
  // UUID v5 uses SHA-1 hash
  const hash = createHash('sha1').update(name).digest();
  
  // Convert namespace UUID to bytes
  const namespace = UUID_NAMESPACE.replace(/-/g, '');
  const namespaceBytes = Buffer.from(namespace, 'hex');
  
  // Combine namespace and hash
  const combined = Buffer.concat([namespaceBytes, Buffer.from(name)]);
  const finalHash = createHash('sha1').update(combined).digest();
  
  // Set version (5) and variant bits
  finalHash[6] = (finalHash[6] & 0x0f) | 0x50; // Version 5
  finalHash[8] = (finalHash[8] & 0x3f) | 0x80; // Variant 10
  
  // Format as UUID string
  const hex = finalHash.toString('hex', 0, 16);
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32),
  ].join('-');
}

/**
 * Normalize UUID - if valid UUID return as-is, otherwise generate deterministic one
 */
export function normalizeUUID(table: string, value: any): string {
  if (isUUID(value)) {
    return String(value).toLowerCase();
  }
  
  return deterministicUUID(table, value);
}

/**
 * Generate SHA-256 hash of a string
 */
export function sha256Hash(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Create canonical JSON string for hashing
 * Ensures consistent ordering of keys
 */
export function canonicalJSON(obj: any): string {
  if (obj === null || obj === undefined) {
    return JSON.stringify(obj);
  }
  
  if (Array.isArray(obj)) {
    return '[' + obj.map(item => canonicalJSON(item)).join(',') + ']';
  }
  
  if (typeof obj === 'object') {
    const keys = Object.keys(obj).sort();
    const pairs = keys.map(key => `"${key}":${canonicalJSON(obj[key])}`);
    return '{' + pairs.join(',') + '}';
  }
  
  return JSON.stringify(obj);
}
