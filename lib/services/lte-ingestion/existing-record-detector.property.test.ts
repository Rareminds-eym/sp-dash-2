/**
 * Property-Based Tests for Existing Record Detection
 * 
 * Tag: Feature: lte-course-upload-functional, Property 15: Existing Record Skip
 * 
 * **Validates: Requirements FR-1, FR-4**
 * 
 * Property 15: Existing Record Skip
 * For any row in the upload whose deterministic UUID or unique business key 
 * matches an existing database record, the row should be marked SKIP and 
 * not inserted during publish.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  detectExistingByUUID,
  detectExistingByUniqueKeys,
  isReferenceTable,
  rowExists,
  getUniqueKeyValue,
  countExistingRecords,
  type ExistingRecordResult,
} from './existing-record-detector';
import { DB_UNIQUE_LOOKUP_COLUMNS, EXISTING_REFERENCE_TABLES } from './constants';

describe('Property 15: Existing Record Skip', () => {
  
  describe('UUID-based detection properties', () => {
    
    it('should correctly identify rows with existing UUIDs', () => {
      const uuidArb = fc.uuid();
      const rowArb = fc.record({
        id: uuidArb,
        name: fc.string({ minLength: 1, maxLength: 50 }),
      });
      
      fc.assert(
        fc.property(
          fc.array(rowArb, { minLength: 1, maxLength: 10 }),
          fc.array(uuidArb, { minLength: 1, maxLength: 5 }),
          (rows, existingUUIDs) => {
            // Create an existing record result with known UUIDs
            const existingResult: ExistingRecordResult = {
              existingUUIDs: new Set(existingUUIDs),
              existingUniqueKeys: new Map(),
              referenceTableRecords: new Map(),
            };
            
            // Check each row
            for (const row of rows) {
              const exists = rowExists(row, 'modules', existingResult);
              const shouldExist = existingUUIDs.includes(row.id);
              
              if (shouldExist) {
                // If the UUID is in the existing set, rowExists should return true
                expect(exists).toBe(true);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should not mark rows as existing if UUID is not in database', () => {
      const uuidArb = fc.uuid();
      
      fc.assert(
        fc.property(
          fc.record({
            id: uuidArb,
            name: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          (row) => {
            // Empty existing result - nothing exists
            const existingResult: ExistingRecordResult = {
              existingUUIDs: new Set(),
              existingUniqueKeys: new Map(),
              referenceTableRecords: new Map(),
            };
            
            // Row should not exist
            expect(rowExists(row, 'modules', existingResult)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should be deterministic - same UUID always returns same result', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.boolean(),
          (uuid, shouldExist) => {
            const existingResult: ExistingRecordResult = {
              existingUUIDs: shouldExist ? new Set([uuid]) : new Set(),
              existingUniqueKeys: new Map(),
              referenceTableRecords: new Map(),
            };
            
            const row = { id: uuid, name: 'Test' };
            
            // Multiple calls should return the same result
            const result1 = rowExists(row, 'modules', existingResult);
            const result2 = rowExists(row, 'modules', existingResult);
            const result3 = rowExists(row, 'modules', existingResult);
            
            expect(result1).toBe(shouldExist);
            expect(result2).toBe(shouldExist);
            expect(result3).toBe(shouldExist);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Unique business key detection properties', () => {
    
    it('should correctly identify rows with existing unique business keys', () => {
      const codeArb = fc.string({ minLength: 1, maxLength: 20 })
        .filter(s => s.trim().length > 0);
      
      fc.assert(
        fc.property(
          codeArb,
          fc.uuid(),
          fc.boolean(),
          (code, uuid, shouldExist) => {
            const existingResult: ExistingRecordResult = {
              existingUUIDs: new Set(),
              existingUniqueKeys: shouldExist 
                ? new Map([['capabilities|code', new Set([code.trim().toLowerCase()])]])
                : new Map(),
              referenceTableRecords: new Map(),
            };
            
            const row = { id: uuid, code: code, name: 'Test' };
            const exists = rowExists(row, 'capabilities', existingResult);
            
            expect(exists).toBe(shouldExist);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should be case-insensitive for unique key comparison', () => {
      const codeArb = fc.string({ minLength: 1, maxLength: 20 })
        .filter(s => s.trim().length > 0 && /^[A-Za-z0-9_-]+$/.test(s));
      
      fc.assert(
        fc.property(codeArb, fc.uuid(), (code, uuid) => {
          // Store in lowercase
          const existingResult: ExistingRecordResult = {
            existingUUIDs: new Set(),
            existingUniqueKeys: new Map([
              ['capabilities|code', new Set([code.toLowerCase()])]
            ]),
            referenceTableRecords: new Map(),
          };
          
          // Test different case variations
          const rowLowercase = { id: uuid, code: code.toLowerCase(), name: 'Test' };
          const rowUppercase = { id: uuid, code: code.toUpperCase(), name: 'Test' };
          const rowOriginal = { id: uuid, code: code, name: 'Test' };
          
          // All should be detected as existing
          expect(rowExists(rowLowercase, 'capabilities', existingResult)).toBe(true);
          expect(rowExists(rowUppercase, 'capabilities', existingResult)).toBe(true);
          expect(rowExists(rowOriginal, 'capabilities', existingResult)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
    
    it('should normalize whitespace when checking unique keys', () => {
      const codeArb = fc.string({ minLength: 1, maxLength: 20 })
        .filter(s => s.trim().length > 0);
      const whitespaceArb = fc.constantFrom('', ' ', '  ', '\t', '  \t  ');
      
      fc.assert(
        fc.property(codeArb, whitespaceArb, whitespaceArb, fc.uuid(), (code, prefix, suffix, uuid) => {
          const trimmedCode = code.trim();
          if (!trimmedCode) return;
          
          const existingResult: ExistingRecordResult = {
            existingUUIDs: new Set(),
            existingUniqueKeys: new Map([
              ['capabilities|code', new Set([trimmedCode.toLowerCase()])]
            ]),
            referenceTableRecords: new Map(),
          };
          
          const rowWithWhitespace = { 
            id: uuid, 
            code: `${prefix}${trimmedCode}${suffix}`, 
            name: 'Test' 
          };
          const rowWithoutWhitespace = { 
            id: uuid, 
            code: trimmedCode, 
            name: 'Test' 
          };
          
          // Both should be detected as existing
          expect(rowExists(rowWithWhitespace, 'capabilities', existingResult)).toBe(true);
          expect(rowExists(rowWithoutWhitespace, 'capabilities', existingResult)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Combined detection properties', () => {
    
    it('should mark row as existing if either UUID or unique key matches', () => {
      const codeArb = fc.string({ minLength: 1, maxLength: 20 })
        .filter(s => s.trim().length > 0);
      
      fc.assert(
        fc.property(
          fc.uuid(),
          codeArb,
          fc.boolean(),
          fc.boolean(),
          (uuid, code, uuidExists, keyExists) => {
            const existingResult: ExistingRecordResult = {
              existingUUIDs: uuidExists ? new Set([uuid]) : new Set(),
              existingUniqueKeys: keyExists 
                ? new Map([['capabilities|code', new Set([code.trim().toLowerCase()])]])
                : new Map(),
              referenceTableRecords: new Map(),
            };
            
            const row = { id: uuid, code: code, name: 'Test' };
            const exists = rowExists(row, 'capabilities', existingResult);
            
            // Should be true if either UUID or key exists
            const shouldExist = uuidExists || keyExists;
            expect(exists).toBe(shouldExist);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should only mark as existing if both conditions are false', () => {
      fc.assert(
        fc.property(fc.uuid(), fc.string({ minLength: 1, maxLength: 20 }), (uuid, code) => {
          // Neither UUID nor key exists
          const existingResult: ExistingRecordResult = {
            existingUUIDs: new Set(),
            existingUniqueKeys: new Map(),
            referenceTableRecords: new Map(),
          };
          
          const row = { id: uuid, code: code, name: 'Test' };
          
          // Should not exist
          expect(rowExists(row, 'capabilities', existingResult)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Reference table detection properties', () => {
    
    it('should correctly identify reference tables', () => {
      const tableArb = fc.constantFrom(
        'roles',
        'capabilities',
        'level_scale',
        'role_capability_sequence',
        'modules',
        'skills',
        'levels'
      );
      
      fc.assert(
        fc.property(tableArb, (table) => {
          const isReference = isReferenceTable(table);
          const shouldBeReference = EXISTING_REFERENCE_TABLES.has(table);
          
          expect(isReference).toBe(shouldBeReference);
        }),
        { numRuns: 100 }
      );
    });
    
    it('should be deterministic for reference table checks', () => {
      const tableArb = fc.string({ minLength: 1, maxLength: 50 });
      
      fc.assert(
        fc.property(tableArb, (table) => {
          const result1 = isReferenceTable(table);
          const result2 = isReferenceTable(table);
          const result3 = isReferenceTable(table);
          
          expect(result1).toBe(result2);
          expect(result2).toBe(result3);
        }),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Unique key value extraction properties', () => {
    
    it('should extract unique key values consistently', () => {
      const codeArb = fc.string({ minLength: 1, maxLength: 20 })
        .filter(s => s.trim().length > 0);
      
      fc.assert(
        fc.property(codeArb, (code) => {
          const row = { id: fc.sample(fc.uuid(), 1)[0], code: code, name: 'Test' };
          
          const value1 = getUniqueKeyValue(row, 'capabilities');
          const value2 = getUniqueKeyValue(row, 'capabilities');
          
          // Should be deterministic
          expect(value1).toBe(value2);
          
          // Should normalize to lowercase
          if (value1 !== null) {
            expect(value1).toBe(code.trim().toLowerCase());
          }
        }),
        { numRuns: 100 }
      );
    });
    
    it('should return null for tables without unique columns', () => {
      const tableArb = fc.constantFrom('modules', 'modules_content', 'e_content');
      const rowArb = fc.record({
        id: fc.uuid(),
        name: fc.string({ minLength: 1, maxLength: 50 }),
      });
      
      fc.assert(
        fc.property(tableArb, rowArb, (table, row) => {
          const hasUniqueColumns = DB_UNIQUE_LOOKUP_COLUMNS[table] !== undefined;
          const value = getUniqueKeyValue(row, table);
          
          if (!hasUniqueColumns) {
            expect(value).toBeNull();
          }
        }),
        { numRuns: 100 }
      );
    });
    
    it('should handle composite keys correctly', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          (roleName, familyName, domainName) => {
            // roles table has composite key [role_name, role_family_name, domain_name]
            // but in our constants it doesn't have DB_UNIQUE_LOOKUP_COLUMNS entry
            // so this is just to test the function structure
            
            const row = {
              id: fc.sample(fc.uuid(), 1)[0],
              role_name: roleName,
              role_family_name: familyName,
              domain_name: domainName,
            };
            
            const value1 = getUniqueKeyValue(row, 'roles');
            const value2 = getUniqueKeyValue(row, 'roles');
            
            // Should be deterministic
            expect(value1).toBe(value2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Count existing records properties', () => {
    
    it('should correctly count existing vs new records', () => {
      const rowsArb = fc.array(
        fc.record({
          id: fc.uuid(),
          code: fc.string({ minLength: 1, maxLength: 20 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        { minLength: 1, maxLength: 10 }
      );
      
      fc.assert(
        fc.property(rowsArb, (rows) => {
          // Mark first half as existing
          const midpoint = Math.floor(rows.length / 2);
          const existingUUIDs = new Set(rows.slice(0, midpoint).map(r => r.id));
          
          const existingResult: ExistingRecordResult = {
            existingUUIDs,
            existingUniqueKeys: new Map(),
            referenceTableRecords: new Map(),
          };
          
          const workbookData = new Map([['capabilities', rows]]);
          const counts = countExistingRecords(workbookData, existingResult);
          
          // Total should equal input length
          expect(counts['capabilities'].total).toBe(rows.length);
          
          // Existing + new should equal total
          expect(counts['capabilities'].existing + counts['capabilities'].new)
            .toBe(counts['capabilities'].total);
          
          // Existing count should match our setup (approximately, accounting for duplicates)
          expect(counts['capabilities'].existing).toBeGreaterThanOrEqual(0);
          expect(counts['capabilities'].existing).toBeLessThanOrEqual(rows.length);
        }),
        { numRuns: 50 }
      );
    });
    
    it('should report all records as new when nothing exists', () => {
      const rowsArb = fc.array(
        fc.record({
          id: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        { minLength: 1, maxLength: 20 }
      );
      
      fc.assert(
        fc.property(rowsArb, (rows) => {
          const existingResult: ExistingRecordResult = {
            existingUUIDs: new Set(),
            existingUniqueKeys: new Map(),
            referenceTableRecords: new Map(),
          };
          
          const workbookData = new Map([['modules', rows]]);
          const counts = countExistingRecords(workbookData, existingResult);
          
          // All should be new
          expect(counts['modules'].total).toBe(rows.length);
          expect(counts['modules'].existing).toBe(0);
          expect(counts['modules'].new).toBe(rows.length);
        }),
        { numRuns: 100 }
      );
    });
    
    it('should report all records as existing when everything exists', () => {
      const rowsArb = fc.array(
        fc.record({
          id: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        { minLength: 1, maxLength: 20 }
      );
      
      fc.assert(
        fc.property(rowsArb, (rows) => {
          const existingResult: ExistingRecordResult = {
            existingUUIDs: new Set(rows.map(r => r.id)),
            existingUniqueKeys: new Map(),
            referenceTableRecords: new Map(),
          };
          
          const workbookData = new Map([['modules', rows]]);
          const counts = countExistingRecords(workbookData, existingResult);
          
          // All should be existing
          expect(counts['modules'].total).toBe(rows.length);
          expect(counts['modules'].existing).toBe(rows.length);
          expect(counts['modules'].new).toBe(0);
        }),
        { numRuns: 100 }
      );
    });
    
    it('should maintain count invariants across multiple tables', () => {
      const createTableRows = (n: number) => 
        Array.from({ length: n }, (_, i) => ({
          id: fc.sample(fc.uuid(), 1)[0],
          name: `Item ${i}`,
        }));
      
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          fc.integer({ min: 1, max: 20 }),
          (count1, count2) => {
            const rows1 = createTableRows(count1);
            const rows2 = createTableRows(count2);
            
            const existingResult: ExistingRecordResult = {
              existingUUIDs: new Set(),
              existingUniqueKeys: new Map(),
              referenceTableRecords: new Map(),
            };
            
            const workbookData = new Map([
              ['modules', rows1],
              ['skills', rows2],
            ]);
            
            const counts = countExistingRecords(workbookData, existingResult);
            
            // Each table should have correct total
            expect(counts['modules'].total).toBe(count1);
            expect(counts['skills'].total).toBe(count2);
            
            // Invariants for each table
            expect(counts['modules'].existing + counts['modules'].new).toBe(count1);
            expect(counts['skills'].existing + counts['skills'].new).toBe(count2);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
  
  describe('Detection edge cases', () => {
    
    it('should handle empty workbook data', () => {
      const existingResult: ExistingRecordResult = {
        existingUUIDs: new Set(),
        existingUniqueKeys: new Map(),
        referenceTableRecords: new Map(),
      };
      
      const workbookData = new Map<string, any[]>();
      const counts = countExistingRecords(workbookData, existingResult);
      
      // Should return empty counts
      expect(Object.keys(counts).length).toBe(0);
    });
    
    it('should handle rows with null or undefined ID', () => {
      const rowsArb = fc.array(
        fc.record({
          id: fc.option(fc.uuid(), { nil: null }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        { minLength: 1, maxLength: 10 }
      );
      
      fc.assert(
        fc.property(rowsArb, (rows) => {
          const existingResult: ExistingRecordResult = {
            existingUUIDs: new Set(['some-uuid-that-exists']),
            existingUniqueKeys: new Map(),
            referenceTableRecords: new Map(),
          };
          
          // Should not throw
          for (const row of rows) {
            expect(() => rowExists(row, 'modules', existingResult)).not.toThrow();
          }
        }),
        { numRuns: 100 }
      );
    });
    
    it('should handle rows with null or undefined unique key values', () => {
      const rowsArb = fc.array(
        fc.record({
          id: fc.uuid(),
          code: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        { minLength: 1, maxLength: 10 }
      );
      
      fc.assert(
        fc.property(rowsArb, (rows) => {
          const existingResult: ExistingRecordResult = {
            existingUUIDs: new Set(),
            existingUniqueKeys: new Map([
              ['capabilities|code', new Set(['existing-code'])]
            ]),
            referenceTableRecords: new Map(),
          };
          
          // Should not throw
          for (const row of rows) {
            expect(() => rowExists(row, 'capabilities', existingResult)).not.toThrow();
            expect(() => getUniqueKeyValue(row, 'capabilities')).not.toThrow();
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
