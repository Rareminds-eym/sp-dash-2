/**
 * Property-Based Tests for Foreign Key Resolution
 * 
 * Tag: Feature: lte-course-upload-functional, Property 5: Natural Key FK Resolution
 * 
 * **Validates: Requirements FR-1**
 * 
 * Property 5: Natural Key FK Resolution
 * For any foreign key with a natural key lookup configuration, resolving 
 * the FK using the natural key values should return the same result as 
 * looking up by the original UUID.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  resolveForeignKey,
  buildFKLookupMap,
  resolveFKFromMap,
  generateFKSubquery,
} from './fk-resolver';

describe('Property 5: Natural Key FK Resolution', () => {
  
  describe('Resolution consistency properties', () => {
    
    it('should consistently resolve the same natural key values to the same UUID', () => {
      const naturalKeyArb = fc.string({ minLength: 1, maxLength: 20 });
      const uuidArb = fc.uuid();
      
      const capabilitiesArb = fc.array(
        fc.record({
          id: uuidArb,
          code: naturalKeyArb,
          name: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        { minLength: 1, maxLength: 10 }
      ).filter(caps => {
        // Ensure unique codes
        const codes = caps.map(c => c.code.trim().toLowerCase());
        return new Set(codes).size === codes.length;
      });
      
      fc.assert(
        fc.property(capabilitiesArb, (capabilities) => {
          const workbookData = new Map();
          workbookData.set('capabilities', capabilities);
          
          // Resolve each capability multiple times
          for (const cap of capabilities) {
            const result1 = resolveForeignKey(
              'levels',
              'capability_id',
              { code: cap.code },
              workbookData
            );
            const result2 = resolveForeignKey(
              'levels',
              'capability_id',
              { code: cap.code },
              workbookData
            );
            const result3 = resolveForeignKey(
              'levels',
              'capability_id',
              { code: cap.code },
              workbookData
            );
            
            // All resolutions should return the same UUID
            expect(result1).toBe(cap.id);
            expect(result2).toBe(cap.id);
            expect(result3).toBe(cap.id);
          }
        }),
        { numRuns: 50 }
      );
    });
    
    it('should be case-insensitive for string natural keys', () => {
      const codeArb = fc.string({ minLength: 1, maxLength: 20 })
        .filter(s => s.trim().length > 0 && /^[A-Za-z0-9_-]+$/.test(s));
      
      fc.assert(
        fc.property(codeArb, fc.uuid(), (code, uuid) => {
          const workbookData = new Map();
          workbookData.set('capabilities', [
            { id: uuid, code: code, name: 'Test' }
          ]);
          
          // Try different case variations
          const lowercase = resolveForeignKey(
            'levels',
            'capability_id',
            { code: code.toLowerCase() },
            workbookData
          );
          const uppercase = resolveForeignKey(
            'levels',
            'capability_id',
            { code: code.toUpperCase() },
            workbookData
          );
          const original = resolveForeignKey(
            'levels',
            'capability_id',
            { code: code },
            workbookData
          );
          
          // All should resolve to the same UUID
          expect(lowercase).toBe(uuid);
          expect(uppercase).toBe(uuid);
          expect(original).toBe(uuid);
        }),
        { numRuns: 100 }
      );
    });
    
    it('should handle whitespace consistently', () => {
      const codeArb = fc.string({ minLength: 1, maxLength: 20 })
        .filter(s => s.trim().length > 0);
      const whitespaceArb = fc.constantFrom('', ' ', '  ', '\t', '  \t  ');
      
      fc.assert(
        fc.property(codeArb, whitespaceArb, whitespaceArb, fc.uuid(), (code, prefix, suffix, uuid) => {
          const trimmedCode = code.trim();
          if (!trimmedCode) return;
          
          const workbookData = new Map();
          workbookData.set('capabilities', [
            { id: uuid, code: trimmedCode, name: 'Test' }
          ]);
          
          // Resolve with various whitespace combinations
          const withWhitespace = resolveForeignKey(
            'levels',
            'capability_id',
            { code: `${prefix}${trimmedCode}${suffix}` },
            workbookData
          );
          const withoutWhitespace = resolveForeignKey(
            'levels',
            'capability_id',
            { code: trimmedCode },
            workbookData
          );
          
          // Both should resolve to the same UUID
          expect(withWhitespace).toBe(uuid);
          expect(withoutWhitespace).toBe(uuid);
        }),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Lookup map consistency properties', () => {
    
    it('should produce equivalent results using lookup map vs direct resolution', () => {
      const capabilitiesArb = fc.array(
        fc.record({
          id: fc.uuid(),
          code: fc.string({ minLength: 1, maxLength: 20 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        { minLength: 1, maxLength: 10 }
      ).filter(caps => {
        const codes = caps.map(c => c.code.trim().toLowerCase());
        return new Set(codes).size === codes.length;
      });
      
      fc.assert(
        fc.property(capabilitiesArb, (capabilities) => {
          const workbookData = new Map();
          workbookData.set('capabilities', capabilities);
          
          // Build lookup map
          const lookupMap = buildFKLookupMap('capabilities', ['code'], capabilities);
          
          // Compare direct resolution vs map-based resolution
          for (const cap of capabilities) {
            const directResult = resolveForeignKey(
              'levels',
              'capability_id',
              { code: cap.code },
              workbookData
            );
            const mapResult = resolveFKFromMap(
              { code: cap.code },
              ['code'],
              lookupMap
            );
            
            // Both methods should return the same UUID
            expect(mapResult).toBe(directResult);
            expect(mapResult).toBe(cap.id);
          }
        }),
        { numRuns: 50 }
      );
    });
    
    it('should build deterministic lookup maps', () => {
      const capabilitiesArb = fc.array(
        fc.record({
          id: fc.uuid(),
          code: fc.string({ minLength: 1, maxLength: 20 }),
        }),
        { minLength: 1, maxLength: 10 }
      );
      
      fc.assert(
        fc.property(capabilitiesArb, (capabilities) => {
          const map1 = buildFKLookupMap('capabilities', ['code'], capabilities);
          const map2 = buildFKLookupMap('capabilities', ['code'], capabilities);
          
          // Both maps should be identical
          expect(map1.size).toBe(map2.size);
          
          for (const [key, value] of map1.entries()) {
            expect(map2.get(key)).toBe(value);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Multiple natural key properties', () => {
    
    it('should resolve using all natural keys in combination', () => {
      const roleArb = fc.record({
        id: fc.uuid(),
        role_name: fc.string({ minLength: 1, maxLength: 30 }),
        role_family_name: fc.string({ minLength: 1, maxLength: 30 }),
        domain_name: fc.string({ minLength: 1, maxLength: 30 }),
      });
      
      const rolesArb = fc.array(roleArb, { minLength: 1, maxLength: 5 })
        .filter(roles => {
          // Ensure unique combinations
          const keys = roles.map(r => 
            `${r.role_name.trim().toLowerCase()}|${r.role_family_name.trim().toLowerCase()}|${r.domain_name.trim().toLowerCase()}`
          );
          return new Set(keys).size === keys.length;
        });
      
      fc.assert(
        fc.property(rolesArb, (roles) => {
          const workbookData = new Map();
          workbookData.set('roles', roles);
          
          for (const role of roles) {
            const result = resolveForeignKey(
              'role_capability_sequence',
              'role_id',
              {
                role_name: role.role_name,
                role_family_name: role.role_family_name,
                domain_name: role.domain_name,
              },
              workbookData
            );
            
            expect(result).toBe(role.id);
          }
        }),
        { numRuns: 50 }
      );
    });
    
    it('should not match if any natural key differs', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            role_name: fc.string({ minLength: 1, maxLength: 20 }),
            role_family_name: fc.string({ minLength: 1, maxLength: 20 }),
            domain_name: fc.string({ minLength: 1, maxLength: 20 }),
          }),
          fc.string({ minLength: 1, maxLength: 20 }),
          (role, differentValue) => {
            const workbookData = new Map();
            workbookData.set('roles', [role]);
            
            // Try with one different key
            const result = resolveForeignKey(
              'role_capability_sequence',
              'role_id',
              {
                role_name: differentValue, // Different
                role_family_name: role.role_family_name,
                domain_name: role.domain_name,
              },
              workbookData
            );
            
            if (differentValue.trim().toLowerCase() === role.role_name.trim().toLowerCase()) {
              // If by chance they're the same, should match
              expect(result).toBe(role.id);
            } else {
              // Otherwise, should not match
              expect(result).toBeNull();
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
  
  describe('SQL subquery generation properties', () => {
    
    it('should generate valid SQL WHERE clauses', () => {
      const codeArb = fc.string({ minLength: 1, maxLength: 50 })
        .filter(s => s.trim().length > 0);
      
      fc.assert(
        fc.property(codeArb, (code) => {
          const sql = generateFKSubquery(
            'levels',
            'capability_id',
            { code: code }
          );
          
          expect(sql).toBeDefined();
          expect(sql).toContain('code');
          expect(sql).toContain('=');
          
          // Should quote string values
          if (sql !== null) {
            expect(sql).toContain("'");
          }
        }),
        { numRuns: 100 }
      );
    });
    
    it('should escape single quotes in SQL strings', () => {
      const stringsWithQuotes = fc.string({ minLength: 1, maxLength: 50 })
        .filter(s => s.includes("'"));
      
      fc.assert(
        fc.property(stringsWithQuotes, (value) => {
          const sql = generateFKSubquery(
            'levels',
            'capability_id',
            { code: value }
          );
          
          if (sql !== null) {
            // Single quotes should be doubled (SQL escaping)
            const singleQuoteCount = (value.match(/'/g) || []).length;
            const escapedQuoteCount = (sql.match(/''/g) || []).length;
            
            expect(escapedQuoteCount).toBe(singleQuoteCount);
          }
        }),
        { numRuns: 50 }
      );
    });
    
    it('should generate deterministic SQL for same inputs', () => {
      const naturalKeyArb = fc.record({
        code: fc.string({ minLength: 1, maxLength: 20 }),
      });
      
      fc.assert(
        fc.property(naturalKeyArb, (values) => {
          const sql1 = generateFKSubquery('levels', 'capability_id', values);
          const sql2 = generateFKSubquery('levels', 'capability_id', values);
          
          expect(sql1).toBe(sql2);
        }),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Resolution failure properties', () => {
    
    it('should return null for non-existent natural key values', () => {
      const existingCodeArb = fc.string({ minLength: 1, maxLength: 20 });
      const nonExistentCodeArb = fc.string({ minLength: 1, maxLength: 20 });
      
      fc.assert(
        fc.property(
          fc.tuple(existingCodeArb, nonExistentCodeArb)
            .filter(([existing, nonExistent]) => 
              existing.trim().toLowerCase() !== nonExistent.trim().toLowerCase()
            ),
          fc.uuid(),
          ([existingCode, nonExistentCode], uuid) => {
            const workbookData = new Map();
            workbookData.set('capabilities', [
              { id: uuid, code: existingCode, name: 'Test' }
            ]);
            
            // Existing code should resolve
            const existingResult = resolveForeignKey(
              'levels',
              'capability_id',
              { code: existingCode },
              workbookData
            );
            expect(existingResult).toBe(uuid);
            
            // Non-existent code should return null
            const nonExistentResult = resolveForeignKey(
              'levels',
              'capability_id',
              { code: nonExistentCode },
              workbookData
            );
            expect(nonExistentResult).toBeNull();
          }
        ),
        { numRuns: 50 }
      );
    });
  });
  
  describe('Numeric natural key properties', () => {
    
    it('should handle numeric natural keys correctly', () => {
      const levelNumberArb = fc.integer({ min: 1, max: 10 });
      
      fc.assert(
        fc.property(levelNumberArb, fc.uuid(), (levelNo, uuid) => {
          const workbookData = new Map();
          workbookData.set('level_scale', [
            { id: uuid, level_no: levelNo, name: `Level ${levelNo}` }
          ]);
          
          const result = resolveForeignKey(
            'levels',
            'level_id',
            { level_no: levelNo },
            workbookData
          );
          
          expect(result).toBe(uuid);
        }),
        { numRuns: 100 }
      );
    });
    
    it('should not match different numeric values', () => {
      fc.assert(
        fc.property(
          fc.tuple(fc.integer({ min: 1, max: 100 }), fc.integer({ min: 1, max: 100 }))
            .filter(([a, b]) => a !== b),
          fc.uuid(),
          ([level1, level2], uuid) => {
            const workbookData = new Map();
            workbookData.set('level_scale', [
              { id: uuid, level_no: level1, name: `Level ${level1}` }
            ]);
            
            // Correct level should resolve
            const correctResult = resolveForeignKey(
              'levels',
              'level_id',
              { level_no: level1 },
              workbookData
            );
            expect(correctResult).toBe(uuid);
            
            // Different level should not resolve
            const incorrectResult = resolveForeignKey(
              'levels',
              'level_id',
              { level_no: level2 },
              workbookData
            );
            expect(incorrectResult).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
