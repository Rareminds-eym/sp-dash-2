/**
 * Unit Tests for Validation Reporter
 */

import { describe, it, expect } from 'vitest';
import {
  generateValidationReport,
  determinePublishReady,
  generateTableSummaries,
  aggregateValidationErrors,
  ValidationError,
} from './validation-reporter';
import { DuplicateDetectionResult } from './duplicate-detector';
import { ExistingRecordResult } from './existing-record-detector';

describe('Validation Reporter', () => {
  describe('generateValidationReport', () => {
    it('should generate valid report for clean workbook', () => {
      const workbookData = new Map([
        ['roles', [{ id: '123', role_name: 'Engineer' }]],
        ['capabilities', [{ id: '456', code: 'WEB_DEV' }]],
      ]);
      
      const duplicateResults = new Map<string, DuplicateDetectionResult>();
      
      const existingResult: ExistingRecordResult = {
        existingUUIDs: new Set(),
        existingUniqueKeys: new Map(),
        referenceTableRecords: new Map(),
      };
      
      const result = generateValidationReport(
        workbookData,
        duplicateResults,
        existingResult
      );
      
      expect(result.status).toBe('validated');
      expect(result.publishReady).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.validationCards).toHaveLength(3);
    });

    it('should reject modules missing required 6E stage content', () => {
      const workbookData = new Map([
        ['modules', [{ id: 'module-1', title: 'Evidence Intake' }]],
        ['modules_content', [
          { id: 'content-1', module_id: 'module-1', stage_name: 'engage' },
        ]],
        ['e_content', [
          { id: 'content-file-1', modules_content_id: 'content-1' },
        ]],
        ['module_artifacts', []],
        ['artifact_questions', []],
        ['artifact_templates', []],
      ]);

      const duplicateResults = new Map<string, DuplicateDetectionResult>();
      const existingResult: ExistingRecordResult = {
        existingUUIDs: new Set(),
        existingUniqueKeys: new Map(),
        referenceTableRecords: new Map(),
      };

      const result = generateValidationReport(workbookData, duplicateResults, existingResult);

      expect(result.publishReady).toBe(false);
      expect(result.errors.some(error => error.code === 'MISSING_6E_STAGE')).toBe(true);
      expect(result.errors.some(error => error.code === 'MISSING_ARTIFACT_PRACTICE')).toBe(true);
    });

    it('should accept complete 6E module, content, artifact, question, and template links', () => {
      const stageRows = ['engage', 'explore', 'explain', 'express', 'empower', 'evolve'].map((stage, index) => ({
        id: `content-${stage}`,
        module_id: 'module-1',
        stage_name: stage,
        stage_order: index + 1,
      }));
      const workbookData = new Map([
        ['modules', [{ id: 'module-1', title: 'Evidence Intake' }]],
        ['modules_content', stageRows],
        ['e_content', stageRows.map(row => ({ id: `file-${row.id}`, modules_content_id: row.id }))],
        ['module_artifacts', [
          { id: 'artifact-1', modules_content_id: 'content-express' },
          { id: 'artifact-2', modules_content_id: 'content-evolve' },
        ]],
        ['artifact_questions', [
          { id: 'question-1', artifact_id: 'artifact-1' },
          { id: 'question-2', artifact_id: 'artifact-2' },
        ]],
        ['artifact_templates', [
          { id: 'template-1', artifact_id: 'artifact-1' },
          { id: 'template-2', artifact_id: 'artifact-2' },
        ]],
      ]);

      const duplicateResults = new Map<string, DuplicateDetectionResult>();
      const existingResult: ExistingRecordResult = {
        existingUUIDs: new Set(),
        existingUniqueKeys: new Map(),
        referenceTableRecords: new Map(),
      };

      const result = generateValidationReport(workbookData, duplicateResults, existingResult);

      expect(result.publishReady).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should mark as validation_failed when errors exist', () => {
      const workbookData = new Map([
        ['roles', [{ id: '123', role_name: 'Engineer' }]],
      ]);
      
      const duplicateResults = new Map<string, DuplicateDetectionResult>();
      
      const existingResult: ExistingRecordResult = {
        existingUUIDs: new Set(),
        existingUniqueKeys: new Map(),
        referenceTableRecords: new Map(),
      };
      
      const parsingErrors: ValidationError[] = [
        {
          severity: 'ERROR',
          code: 'INVALID_JSON',
          message: 'Invalid JSON field',
          table: 'roles',
          row: 1,
        },
      ];
      
      const result = generateValidationReport(
        workbookData,
        duplicateResults,
        existingResult,
        parsingErrors
      );
      
      expect(result.status).toBe('validation_failed');
      expect(result.publishReady).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    
    it('should include duplicate errors in report', () => {
      const workbookData = new Map([
        ['roles', [
          { id: '123', role_name: 'Engineer' },
          { id: '123', role_name: 'Different' },
        ]],
      ]);
      
      const duplicateResults = new Map<string, DuplicateDetectionResult>([
        [
          'roles',
          {
            duplicates: new Map([
              [1, { action: 'ERROR', reason: 'Conflicting duplicate' }],
            ]),
            errors: [{ row: 2, message: 'Conflicting duplicate UUID "123"' }],
          },
        ],
      ]);
      
      const existingResult: ExistingRecordResult = {
        existingUUIDs: new Set(),
        existingUniqueKeys: new Map(),
        referenceTableRecords: new Map(),
      };
      
      const result = generateValidationReport(
        workbookData,
        duplicateResults,
        existingResult
      );
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].code).toBe('DUPLICATE_CONFLICT');
      expect(result.publishReady).toBe(false);
    });
    
    it('should add warnings for existing records', () => {
      const workbookData = new Map([
        ['roles', [{ id: '123', role_name: 'Engineer' }]],
      ]);
      
      const duplicateResults = new Map<string, DuplicateDetectionResult>();
      
      const existingResult: ExistingRecordResult = {
        existingUUIDs: new Set(['123']),
        existingUniqueKeys: new Map(),
        referenceTableRecords: new Map([
          ['roles', [{ id: '123', role_name: 'Engineer' }]],
        ]),
      };
      
      const result = generateValidationReport(
        workbookData,
        duplicateResults,
        existingResult
      );
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].code).toBe('EXISTING_RECORD_SKIP');
      expect(result.publishReady).toBe(true); // Warnings don't block
    });
  });
  
  describe('generateTableSummaries', () => {
    it('should calculate correct counts for table', () => {
      const workbookData = new Map([
        ['roles', [
          { id: '1', role_name: 'A' },
          { id: '2', role_name: 'B' },
          { id: '3', role_name: 'C' },
          { id: '4', role_name: 'D' },
        ]],
      ]);
      
      const duplicateResults = new Map<string, DuplicateDetectionResult>([
        [
          'roles',
          {
            duplicates: new Map([
              [1, { action: 'SKIP', reason: 'Duplicate' }],
            ]),
            errors: [{ row: 3, message: 'Conflicting duplicate' }],
          },
        ],
      ]);
      
      const existingResult: ExistingRecordResult = {
        existingUUIDs: new Set(['1']),
        existingUniqueKeys: new Map(),
        referenceTableRecords: new Map(),
      };
      
      const summaries = generateTableSummaries(
        workbookData,
        duplicateResults,
        existingResult
      );
      
      expect(summaries.roles.rowCount).toBe(4);
      expect(summaries.roles.skipCount).toBeGreaterThanOrEqual(1);
      expect(summaries.roles.errorCount).toBe(1);
    });
  });
  
  describe('determinePublishReady', () => {
    it('should return true when no errors', () => {
      const result = determinePublishReady([]);
      expect(result).toBe(true);
    });
    
    it('should return true when only warnings', () => {
      const warnings: ValidationError[] = [
        { severity: 'WARNING', code: 'W1', message: 'Warning' },
        { severity: 'INFO', code: 'I1', message: 'Info' },
      ];
      const result = determinePublishReady(warnings);
      expect(result).toBe(true);
    });
    
    it('should return false when any ERROR severity', () => {
      const errors: ValidationError[] = [
        { severity: 'WARNING', code: 'W1', message: 'Warning' },
        { severity: 'ERROR', code: 'E1', message: 'Error' },
      ];
      const result = determinePublishReady(errors);
      expect(result).toBe(false);
    });
  });
  
  describe('aggregateValidationErrors', () => {
    it('should combine errors from multiple sources', () => {
      const parsingErrors: ValidationError[] = [
        { severity: 'ERROR', code: 'PARSE', message: 'Parse error' },
      ];
      
      const fkErrors: ValidationError[] = [
        { severity: 'ERROR', code: 'FK', message: 'FK error' },
      ];
      
      const duplicateResults = new Map<string, DuplicateDetectionResult>([
        [
          'roles',
          {
            duplicates: new Map(),
            errors: [{ row: 1, message: 'Duplicate error' }],
          },
        ],
      ]);
      
      const result = aggregateValidationErrors(
        parsingErrors,
        fkErrors,
        duplicateResults
      );
      
      expect(result.length).toBe(3);
      expect(result.some(e => e.code === 'PARSE')).toBe(true);
      expect(result.some(e => e.code === 'FK')).toBe(true);
      expect(result.some(e => e.code === 'DUPLICATE_CONFLICT')).toBe(true);
    });
  });
});
