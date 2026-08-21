/**
 * Property-Based Tests for Duplicate Detection
 * 
 * Tag: Feature: lte-course-upload-functional, Property 14: Duplicate Detection Accuracy
 * **Validates: Requirements FR-1**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { detectDuplicates, getConflictAction } from './duplicate-detector';

describe('Property 14: Duplicate Detection Accuracy', () => {
  it('should mark identical duplicates as SKIP', () => {
    fc.assert(
      fc.property(fc.record({ id: fc.uuid(), code: fc.string() }), (row) => {
        const rows = [row, { ...row }]; // Identical rows
        const result = detectDuplicates('capabilities', rows);
        
        expect(result.duplicates.has(1)).toBe(true);
        expect(result.duplicates.get(1)?.action).toBe('SKIP');
      }),
      { numRuns: 15 }
    );
  });

  it('should mark conflicting duplicates as ERROR', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.string(), fc.string(), (uuid, code1, code2) => {
        if (code1 === code2) return;
        
        const rows = [
          { id: uuid, code: code1 },
          { id: uuid, code: code2 }, // Same UUID, different data
        ];
        const result = detectDuplicates('capabilities', rows);
        
        expect(result.duplicates.has(1)).toBe(true);
        expect(result.duplicates.get(1)?.action).toBe('ERROR');
        expect(result.errors.length).toBeGreaterThan(0);
      }),
      { numRuns: 15 }
    );
  });

  it('should not mark unique rows as duplicates', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ id: fc.uuid(), code: fc.string() }), { minLength: 1, maxLength: 5 })
          .filter(rows => {
            const ids = rows.map(r => r.id);
            return new Set(ids).size === ids.length; // All unique
          }),
        (rows) => {
          const result = detectDuplicates('capabilities', rows);
          expect(result.duplicates.size).toBe(0);
          expect(result.errors.length).toBe(0);
        }
      ),
      { numRuns: 15 }
    );
  });
});
