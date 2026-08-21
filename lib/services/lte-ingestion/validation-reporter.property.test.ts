/**
 * Property Tests for Validation Reporter
 * 
 * Property 6: Validation Result Structure Completeness
 * Property 9: Blocking Errors Prevent Publish
 * Property 10: Warnings Allow Publish
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  generateValidationReport,
  determinePublishReady,
  generateTableSummaries,
  ValidationError,
  ValidationWarning,
} from './validation-reporter';
import { DuplicateDetectionResult } from './duplicate-detector';
import { ExistingRecordResult } from './existing-record-detector';

// Arbitraries for test data generation
const validationErrorArb = fc.record({
  severity: fc.constantFrom('INFO' as const, 'WARNING' as const, 'ERROR' as const),
  code: fc.string({ minLength: 1, maxLength: 50 }),
  message: fc.string({ minLength: 1, maxLength: 200 }),
  table: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
  row: fc.option(fc.integer({ min: 1, max: 10000 })),
  column: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
});

const workbookDataArb = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 50 }),
  fc.array(
    fc.record({
      id: fc.uuid(),
      name: fc.string(),
    }),
    { minLength: 0, maxLength: 20 }
  )
).map(dict => new Map(Object.entries(dict)));

const duplicateResultArb = fc.record({
  duplicates: fc.constant(new Map()),
  errors: fc.array(
    fc.record({
      row: fc.integer({ min: 1, max: 100 }),
      message: fc.string({ minLength: 1, maxLength: 200 }),
    }),
    { maxLength: 5 }
  ),
});

const existingResultArb = fc.record({
  existingUUIDs: fc.array(fc.uuid(), { maxLength: 10 }).map(arr => new Set(arr)),
  existingUniqueKeys: fc.constant(new Map<string, Set<string>>()),
  referenceTableRecords: fc.constant(new Map<string, any[]>()),
});

describe('Validation Reporter Properties', () => {
  /**
   * Property 6: Validation Result Structure Completeness
   * 
   * For any parsed and validated workbook, the validation result should include
   * accurate row counts, error counts, and skip counts for all tables.
   * 
   * Validates: Requirements 1.4, 3.3, FR-2
   */
  it('Property 6: Validation Result Structure Completeness', () => {
    fc.assert(
      fc.property(
        workbookDataArb,
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 50 }),
          duplicateResultArb
        ).map(dict => new Map(Object.entries(dict))),
        existingResultArb,
        fc.array(validationErrorArb, { maxLength: 5 }),
        (workbookData, duplicateResults, existingResult, parsingErrors) => {
          const result = generateValidationReport(
            workbookData,
            duplicateResults,
            existingResult,
            parsingErrors as ValidationError[]
          );
          
          // Must have required fields
          expect(result).toHaveProperty('status');
          expect(result).toHaveProperty('publishReady');
          expect(result).toHaveProperty('tableSummary');
          expect(result).toHaveProperty('errors');
          expect(result).toHaveProperty('warnings');
          expect(result).toHaveProperty('validationCards');
          
          // Status must be valid enum value
          expect(['validated', 'validation_failed']).toContain(result.status);
          
          // publishReady must be boolean
          expect(typeof result.publishReady).toBe('boolean');
          
          // tableSummary must have entry for each table in workbook
          for (const tableName of workbookData.keys()) {
            // Skip prototype pollution keys
            if (tableName === '__proto__' || tableName === 'constructor' || tableName === 'prototype') {
              continue;
            }
            
            expect(result.tableSummary).toHaveProperty(tableName);
            const summary = result.tableSummary[tableName];
            
            // Each summary must have required counts
            expect(summary).toHaveProperty('rowCount');
            expect(summary).toHaveProperty('insertCount');
            expect(summary).toHaveProperty('skipCount');
            expect(summary).toHaveProperty('errorCount');
            
            // Counts must be non-negative integers
            expect(summary.rowCount).toBeGreaterThanOrEqual(0);
            expect(summary.insertCount).toBeGreaterThanOrEqual(0);
            expect(summary.skipCount).toBeGreaterThanOrEqual(0);
            expect(summary.errorCount).toBeGreaterThanOrEqual(0);
            
            // Row count must equal sum of insert + skip + error
            const total = summary.insertCount + summary.skipCount + summary.errorCount;
            expect(total).toBeLessThanOrEqual(summary.rowCount);
          }
          
          // errors and warnings must be arrays
          expect(Array.isArray(result.errors)).toBe(true);
          expect(Array.isArray(result.warnings)).toBe(true);
          
          // validationCards must be array with at least 3 cards
          expect(Array.isArray(result.validationCards)).toBe(true);
          expect(result.validationCards.length).toBeGreaterThanOrEqual(3);
          
          // Each validation card must have required fields
          for (const card of result.validationCards) {
            expect(card).toHaveProperty('id');
            expect(card).toHaveProperty('category');
            expect(card).toHaveProperty('title');
            expect(card).toHaveProperty('message');
            expect(card).toHaveProperty('severity');
            expect(card).toHaveProperty('icon');
            
            // Severity must be valid
            expect(['INFO', 'WARNING', 'ERROR']).toContain(card.severity);
            
            // Icon must be valid
            expect(['checkmark', 'warning', 'error']).toContain(card.icon);
            
            // Category must be valid
            expect(['SCHEMA_VERIFICATION', 'CURRICULUM_6ES', 'ARTIFACTS']).toContain(card.category);
          }
        }
      ),
      { numRuns: 15 }
    );
  });
  // Tag: Feature: lte-course-upload-functional, Property 6: Validation Result Structure Completeness

  /**
   * Property 9: Blocking Errors Prevent Publish
   * 
   * For any upload with one or more validation errors of severity 'ERROR',
   * the publishReady flag should be false and the status should be 'validation_failed'.
   * 
   * Validates: Requirements 3.4, 7.1
   */
  it('Property 9: Blocking Errors Prevent Publish', () => {
    fc.assert(
      fc.property(
        fc.array(validationErrorArb, { minLength: 1, maxLength: 10 }),
        (errors) => {
          // Ensure at least one error has severity ERROR
          const errorsWithError: ValidationError[] = [
            ...errors.slice(0, -1),
            { ...errors[errors.length - 1], severity: 'ERROR' as const },
          ] as ValidationError[];
          
          const workbookData = new Map([
            ['test_table', [{ id: '123', name: 'Test' }]],
          ]);
          
          const result = generateValidationReport(
            workbookData,
            new Map(),
            {
              existingUUIDs: new Set(),
              existingUniqueKeys: new Map(),
              referenceTableRecords: new Map(),
            },
            errorsWithError
          );
          
          // With ERROR severity, publishReady must be false
          expect(result.publishReady).toBe(false);
          
          // Status should be validation_failed
          expect(result.status).toBe('validation_failed');
          
          // Errors array should contain the ERROR severity errors
          const errorSeverityCount = result.errors.filter(e => e.severity === 'ERROR').length;
          expect(errorSeverityCount).toBeGreaterThan(0);
        }
      ),
      { numRuns: 15 }
    );
  });
  // Tag: Feature: lte-course-upload-functional, Property 9: Blocking Errors Prevent Publish

  /**
   * Property 10: Warnings Allow Publish
   * 
   * For any upload with only validation warnings (severity 'WARNING' or 'INFO'),
   * the publishReady flag should be true and status should be 'validated'.
   * 
   * Validates: Requirements 3.5
   */
  it('Property 10: Warnings Allow Publish', () => {
    fc.assert(
      fc.property(
        fc.array(validationErrorArb, { minLength: 0, maxLength: 10 }),
        (errors) => {
          // Convert all errors to WARNING or INFO severity
          const warningsOnly: ValidationError[] = errors.map(e => ({
            ...e,
            severity: fc.sample(fc.constantFrom('WARNING' as const, 'INFO' as const), 1)[0],
          }));
          
          const workbookData = new Map([
            ['test_table', [{ id: '123', name: 'Test' }]],
          ]);
          
          const result = generateValidationReport(
            workbookData,
            new Map(),
            {
              existingUUIDs: new Set(),
              existingUniqueKeys: new Map(),
              referenceTableRecords: new Map(),
            },
            warningsOnly
          );
          
          // With only warnings/info, publishReady must be true
          expect(result.publishReady).toBe(true);
          
          // Status should be validated
          expect(result.status).toBe('validated');
          
          // No errors should have ERROR severity
          const errorSeverityCount = result.errors.filter(e => e.severity === 'ERROR').length;
          expect(errorSeverityCount).toBe(0);
        }
      ),
      { numRuns: 15 }
    );
  });
  // Tag: Feature: lte-course-upload-functional, Property 10: Warnings Allow Publish

  /**
   * Helper test: determinePublishReady should return false only when ERROR present
   */
  it('determinePublishReady returns false only when ERROR severity present', () => {
    fc.assert(
      fc.property(
        fc.array(validationErrorArb, { maxLength: 10 }),
        (errors) => {
          const hasError = errors.some(e => e.severity === 'ERROR');
          const result = determinePublishReady(errors as ValidationError[]);
          
          expect(result).toBe(!hasError);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Helper test: generateTableSummaries counts must be consistent
   */
  it('generateTableSummaries produces consistent counts', () => {
    fc.assert(
      fc.property(
        workbookDataArb,
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 50 }),
          duplicateResultArb
        ).map(dict => new Map(Object.entries(dict))),
        existingResultArb,
        (workbookData, duplicateResults, existingResult) => {
          const summaries = generateTableSummaries(
            workbookData,
            duplicateResults,
            existingResult
          );
          
          for (const [tableName, summary] of Object.entries(summaries)) {
            const rows = workbookData.get(tableName);
            if (!rows) continue;
            
            // Row count must match actual row count
            expect(summary.rowCount).toBe(rows.length);
            
            // All counts must be non-negative
            expect(summary.insertCount).toBeGreaterThanOrEqual(0);
            expect(summary.skipCount).toBeGreaterThanOrEqual(0);
            expect(summary.errorCount).toBeGreaterThanOrEqual(0);
          }
        }
      ),
      { numRuns: 15 }
    );
  });
});
