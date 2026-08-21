/**
 * Property-Based Tests for Snapshot Hash Verification
 * 
 * Tag: Feature: lte-course-upload-functional, Property 12: Snapshot Hash Verification
 * **Validates: Requirements FR-4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createSnapshot, calculateHash, verifyHash, serializeSnapshot } from './snapshot-serializer';

describe('Property 12: Snapshot Hash Verification', () => {
  it('should generate deterministic hashes', () => {
    fc.assert(
      fc.property(fc.string(), (sourceName) => {
        const workbookData = new Map([
          ['test_table', [{ id: 'uuid-1', code: 'TEST' }]]
        ]);
        
        const snapshot = createSnapshot(workbookData, 'xlsx', sourceName);
        const hash1 = calculateHash(snapshot);
        const hash2 = calculateHash(snapshot);
        
        expect(hash1).toBe(hash2);
      }),
      { numRuns: 10 }
    );
  });

  it('should verify matching hashes correctly', () => {
    fc.assert(
      fc.property(fc.string(), (sourceName) => {
        const workbookData = new Map([
          ['test_table', [{ id: 'uuid-1', code: 'TEST' }]]
        ]);
        
        const snapshot = createSnapshot(workbookData, 'xlsx', sourceName);
        const hash = calculateHash(snapshot);
        
        expect(verifyHash(snapshot, hash)).toBe(true);
      }),
      { numRuns: 10 }
    );
  });

  it('should detect hash mismatches', () => {
    const workbookData = new Map([
      ['test_table', [{ id: 'uuid-1', code: 'TEST' }]]
    ]);
    
    const snapshot = createSnapshot(workbookData, 'xlsx', 'test.xlsx');
    const wrongHash = 'wrong-hash-value';
    
    expect(verifyHash(snapshot, wrongHash)).toBe(false);
  });
});
