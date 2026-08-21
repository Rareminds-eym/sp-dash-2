/**
 * Property-Based Tests for Deterministic UUID Generation
 * 
 * Tag: Feature: lte-course-upload-functional, Property 4: Deterministic UUID Generation
 * 
 * **Validates: Requirements FR-1**
 * 
 * Property 4: Deterministic UUID Generation
 * For any table name and text ID combination, calling deterministicUUID() 
 * multiple times should always return the same UUID value.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  deterministicUUID,
  isUUID,
  ensureUUID,
  batchEnsureUUIDs,
  createUUIDMapping,
  validateDeterministicUUID,
} from './uuid-generator';

describe('Property 4: Deterministic UUID Generation', () => {
  
  describe('Determinism properties', () => {
    
    it('should always generate the same UUID for the same table and text ID', () => {
      const tableArb = fc.constantFrom('capabilities', 'skills', 'levels', 'modules', 'roles');
      const textIdArb = fc.string({ minLength: 1, maxLength: 100 });
      
      fc.assert(
        fc.property(tableArb, textIdArb, (table, textId) => {
          const uuid1 = deterministicUUID(table, textId);
          const uuid2 = deterministicUUID(table, textId);
          const uuid3 = deterministicUUID(table, textId);
          
          // All calls should return identical UUIDs
          expect(uuid1).toBe(uuid2);
          expect(uuid2).toBe(uuid3);
          
          // All should be valid UUIDs
          expect(isUUID(uuid1)).toBe(true);
          expect(isUUID(uuid2)).toBe(true);
          expect(isUUID(uuid3)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
    
    it('should be stable across multiple calls with whitespace variations', () => {
      const textIdArb = fc.string({ minLength: 1, maxLength: 50 });
      const whitespaceArb = fc.constantFrom('', ' ', '  ', '\t', '  \t  ');
      
      fc.assert(
        fc.property(textIdArb, whitespaceArb, whitespaceArb, (textId, prefix, suffix) => {
          const trimmedId = textId.trim();
          if (!trimmedId) return; // Skip empty strings
          
          const uuid1 = deterministicUUID('table', trimmedId);
          const uuid2 = deterministicUUID('table', `${prefix}${trimmedId}${suffix}`);
          
          // Should generate same UUID regardless of surrounding whitespace
          expect(uuid1).toBe(uuid2);
        }),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Uniqueness properties', () => {
    
    it('should generate different UUIDs for different text IDs', () => {
      const textIdPair = fc.tuple(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 })
      ).filter(([a, b]) => a.trim() !== b.trim());
      
      fc.assert(
        fc.property(textIdPair, ([textId1, textId2]) => {
          const uuid1 = deterministicUUID('capabilities', textId1);
          const uuid2 = deterministicUUID('capabilities', textId2);
          
          // Different text IDs should produce different UUIDs
          expect(uuid1).not.toBe(uuid2);
        }),
        { numRuns: 100 }
      );
    });
    
    it('should generate different UUIDs for different tables with same text ID', () => {
      const tableArb = fc.constantFrom('capabilities', 'skills', 'levels', 'modules');
      const textIdArb = fc.string({ minLength: 1, maxLength: 50 });
      
      fc.assert(
        fc.property(
          fc.tuple(tableArb, tableArb).filter(([t1, t2]) => t1 !== t2),
          textIdArb,
          ([table1, table2], textId) => {
            const uuid1 = deterministicUUID(table1, textId);
            const uuid2 = deterministicUUID(table2, textId);
            
            // Same text ID in different tables should produce different UUIDs
            expect(uuid1).not.toBe(uuid2);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should generate unique UUIDs for a set of text IDs', () => {
      const textIdSet = fc.array(
        fc.string({ minLength: 1, maxLength: 30 }),
        { minLength: 2, maxLength: 20 }
      ).filter(arr => {
        // Ensure all text IDs are unique after trimming
        const trimmed = arr.map(s => s.trim()).filter(s => s);
        return new Set(trimmed).size === trimmed.length;
      });
      
      fc.assert(
        fc.property(textIdSet, (textIds) => {
          const uuids = textIds.map(id => deterministicUUID('capabilities', id));
          const uniqueUUIDs = new Set(uuids);
          
          // All generated UUIDs should be unique
          expect(uniqueUUIDs.size).toBe(uuids.length);
        }),
        { numRuns: 100 }
      );
    });
  });
  
  describe('UUID format properties', () => {
    
    it('should always generate valid UUID format', () => {
      const tableArb = fc.string({ minLength: 1, maxLength: 50 });
      const textIdArb = fc.string({ minLength: 0, maxLength: 200 });
      
      fc.assert(
        fc.property(tableArb, textIdArb, (table, textId) => {
          const uuid = deterministicUUID(table, textId);
          
          // Should match UUID format
          expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
          
          // Should pass isUUID validation
          expect(isUUID(uuid)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
    
    it('should generate lowercase UUIDs', () => {
      const textIdArb = fc.string({ minLength: 1, maxLength: 50 });
      
      fc.assert(
        fc.property(textIdArb, (textId) => {
          const uuid = deterministicUUID('table', textId);
          
          // UUID should be lowercase
          expect(uuid).toBe(uuid.toLowerCase());
        }),
        { numRuns: 100 }
      );
    });
  });
  
  describe('ensureUUID properties', () => {
    
    it('should be idempotent - ensureUUID(ensureUUID(x)) === ensureUUID(x)', () => {
      const textIdArb = fc.string({ minLength: 1, maxLength: 50 });
      
      fc.assert(
        fc.property(textIdArb, (textId) => {
          const uuid1 = ensureUUID('capabilities', textId);
          const uuid2 = ensureUUID('capabilities', uuid1);
          const uuid3 = ensureUUID('capabilities', uuid2);
          
          // All should return the same UUID
          expect(uuid1).toBe(uuid2);
          expect(uuid2).toBe(uuid3);
        }),
        { numRuns: 100 }
      );
    });
    
    it('should preserve valid UUIDs', () => {
      // Generate a deterministic UUID first, then use it as input
      const textIdArb = fc.string({ minLength: 1, maxLength: 50 });
      
      fc.assert(
        fc.property(textIdArb, (textId) => {
          const generatedUUID = deterministicUUID('capabilities', textId);
          const preservedUUID = ensureUUID('capabilities', generatedUUID);
          
          // Should preserve the UUID (in lowercase)
          expect(preservedUUID).toBe(generatedUUID.toLowerCase());
        }),
        { numRuns: 100 }
      );
    });
    
    it('should normalize UUID case', () => {
      const textIdArb = fc.string({ minLength: 1, maxLength: 50 });
      
      fc.assert(
        fc.property(textIdArb, (textId) => {
          const uuid = deterministicUUID('capabilities', textId);
          const uppercase = uuid.toUpperCase();
          const lowercase = uuid.toLowerCase();
          
          // Both should normalize to the same lowercase UUID
          expect(ensureUUID('capabilities', uppercase)).toBe(lowercase);
          expect(ensureUUID('capabilities', lowercase)).toBe(lowercase);
        }),
        { numRuns: 100 }
      );
    });
  });
  
  describe('batchEnsureUUIDs properties', () => {
    
    it('should preserve array length', () => {
      const textIdArray = fc.array(
        fc.string({ minLength: 1, maxLength: 30 }),
        { minLength: 0, maxLength: 20 }
      );
      
      fc.assert(
        fc.property(textIdArray, (textIds) => {
          const uuids = batchEnsureUUIDs('capabilities', textIds);
          
          // Output array should have same length as input
          expect(uuids.length).toBe(textIds.length);
        }),
        { numRuns: 100 }
      );
    });
    
    it('should preserve array order', () => {
      const textIdArray = fc.array(
        fc.string({ minLength: 1, maxLength: 30 }),
        { minLength: 2, maxLength: 10 }
      );
      
      fc.assert(
        fc.property(textIdArray, (textIds) => {
          const uuids = batchEnsureUUIDs('capabilities', textIds);
          
          // Each UUID should match its corresponding text ID
          for (let i = 0; i < textIds.length; i++) {
            expect(uuids[i]).toBe(ensureUUID('capabilities', textIds[i]));
          }
        }),
        { numRuns: 100 }
      );
    });
    
    it('should produce all valid UUIDs', () => {
      const textIdArray = fc.array(
        fc.string({ minLength: 1, maxLength: 30 }),
        { minLength: 1, maxLength: 20 }
      );
      
      fc.assert(
        fc.property(textIdArray, (textIds) => {
          const uuids = batchEnsureUUIDs('capabilities', textIds);
          
          // All results should be valid UUIDs
          expect(uuids.every(uuid => isUUID(uuid))).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });
  
  describe('createUUIDMapping properties', () => {
    
    it('should create consistent mappings', () => {
      const textIdArray = fc.array(
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        { minLength: 1, maxLength: 10 }
      );
      
      fc.assert(
        fc.property(textIdArray, (textIds) => {
          const mapping1 = createUUIDMapping('capabilities', textIds);
          const mapping2 = createUUIDMapping('capabilities', textIds);
          
          // Both mappings should be identical
          expect(mapping1.size).toBe(mapping2.size);
          
          for (const [key, value] of mapping1.entries()) {
            expect(mapping2.get(key)).toBe(value);
          }
        }),
        { numRuns: 100 }
      );
    });
    
    it('should map text IDs to valid UUIDs', () => {
      const textIdArray = fc.array(
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        { minLength: 1, maxLength: 10 }
      );
      
      fc.assert(
        fc.property(textIdArray, (textIds) => {
          const mapping = createUUIDMapping('capabilities', textIds);
          
          // All mapped values should be valid UUIDs
          for (const uuid of mapping.values()) {
            expect(isUUID(uuid)).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });
    
    it('should handle duplicate text IDs correctly', () => {
      const textIdArb = fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0);
      const arrayWithDuplicates = fc.array(textIdArb, { minLength: 5, maxLength: 10 });
      
      fc.assert(
        fc.property(arrayWithDuplicates, (textIds) => {
          const mapping = createUUIDMapping('capabilities', textIds);
          const uniqueTextIds = new Set(textIds.map(id => id.trim()));
          
          // Mapping size should equal number of unique text IDs
          expect(mapping.size).toBe(uniqueTextIds.size);
          
          // All unique text IDs should be in mapping
          for (const textId of uniqueTextIds) {
            expect(mapping.has(textId)).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
  
  describe('validateDeterministicUUID properties', () => {
    
    it('should validate correctly generated UUIDs', () => {
      const textIdArb = fc.string({ minLength: 1, maxLength: 50 });
      
      fc.assert(
        fc.property(textIdArb, (textId) => {
          const uuid = deterministicUUID('capabilities', textId);
          
          // Should validate as correct
          expect(validateDeterministicUUID('capabilities', textId, uuid)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
    
    it('should be case-insensitive for UUID comparison', () => {
      const textIdArb = fc.string({ minLength: 1, maxLength: 50 });
      
      fc.assert(
        fc.property(textIdArb, (textId) => {
          const uuid = deterministicUUID('capabilities', textId);
          const uppercase = uuid.toUpperCase();
          const lowercase = uuid.toLowerCase();
          const mixedCase = uuid.split('').map((c, i) => i % 2 === 0 ? c.toUpperCase() : c).join('');
          
          // All case variations should validate correctly
          expect(validateDeterministicUUID('capabilities', textId, uppercase)).toBe(true);
          expect(validateDeterministicUUID('capabilities', textId, lowercase)).toBe(true);
          expect(validateDeterministicUUID('capabilities', textId, mixedCase)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
    
    it('should reject UUIDs from different text IDs', () => {
      const textIdPair = fc.tuple(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 })
      ).filter(([a, b]) => a.trim() !== b.trim());
      
      fc.assert(
        fc.property(textIdPair, ([textId1, textId2]) => {
          const uuid1 = deterministicUUID('capabilities', textId1);
          const uuid2 = deterministicUUID('capabilities', textId2);
          
          // UUID from textId1 should not validate for textId2
          expect(validateDeterministicUUID('capabilities', textId2, uuid1)).toBe(false);
          
          // UUID from textId2 should not validate for textId1
          expect(validateDeterministicUUID('capabilities', textId1, uuid2)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Cross-function consistency properties', () => {
    
    it('should maintain consistency between deterministicUUID and createUUIDMapping', () => {
      const textIdArray = fc.array(
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        { minLength: 1, maxLength: 10 }
      );
      
      fc.assert(
        fc.property(textIdArray, (textIds) => {
          const mapping = createUUIDMapping('capabilities', textIds);
          
          // Each mapped UUID should match what deterministicUUID generates
          for (const textId of textIds) {
            const trimmedId = textId.trim();
            const directUUID = deterministicUUID('capabilities', trimmedId);
            const mappedUUID = mapping.get(trimmedId);
            
            expect(mappedUUID).toBe(directUUID);
          }
        }),
        { numRuns: 100 }
      );
    });
    
    it('should maintain consistency between batchEnsureUUIDs and ensureUUID', () => {
      const textIdArray = fc.array(
        fc.string({ minLength: 1, maxLength: 30 }),
        { minLength: 1, maxLength: 10 }
      );
      
      fc.assert(
        fc.property(textIdArray, (textIds) => {
          const batchUUIDs = batchEnsureUUIDs('capabilities', textIds);
          const individualUUIDs = textIds.map(id => ensureUUID('capabilities', id));
          
          // Both approaches should produce identical results
          expect(batchUUIDs).toEqual(individualUUIDs);
        }),
        { numRuns: 100 }
      );
    });
  });
});
