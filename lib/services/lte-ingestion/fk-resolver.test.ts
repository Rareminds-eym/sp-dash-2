/**
 * Unit Tests for Foreign Key Resolution Module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveForeignKey,
  resolveForeignKeyBatch,
  getReferencedTable,
  isForeignKey,
  getNaturalKeyColumns,
  buildFKLookupMap,
  resolveFKFromMap,
  generateFKSubquery,
  validateForeignKeys,
} from './fk-resolver';

describe('Foreign Key Resolution', () => {
  let workbookData: Map<string, any[]>;
  
  beforeEach(() => {
    // Setup test workbook data
    workbookData = new Map();
    
    // Capabilities table
    workbookData.set('capabilities', [
      { id: 'cap-uuid-1', code: 'WEB_DEV', name: 'Web Development' },
      { id: 'cap-uuid-2', code: 'API_DEV', name: 'API Development' },
      { id: 'cap-uuid-3', code: 'DATA_SCI', name: 'Data Science' },
    ]);
    
    // Level scale table
    workbookData.set('level_scale', [
      { id: 'level-uuid-1', level_no: 1, name: 'Beginner' },
      { id: 'level-uuid-2', level_no: 2, name: 'Intermediate' },
      { id: 'level-uuid-3', level_no: 3, name: 'Advanced' },
    ]);
    
    // Roles table
    workbookData.set('roles', [
      { 
        id: 'role-uuid-1',
        role_name: 'Software Engineer',
        role_family_name: 'Engineering',
        domain_name: 'Technology'
      },
      {
        id: 'role-uuid-2',
        role_name: 'Data Analyst',
        role_family_name: 'Analytics',
        domain_name: 'Data'
      },
    ]);
  });
  
  describe('resolveForeignKey', () => {
    it('should resolve FK using single natural key (capability code)', () => {
      const result = resolveForeignKey(
        'levels',
        'capability_id',
        { code: 'WEB_DEV' },
        workbookData
      );
      
      expect(result).toBe('cap-uuid-1');
    });
    
    it('should resolve FK using single natural key (level_no)', () => {
      const result = resolveForeignKey(
        'levels',
        'level_id',
        { level_no: 2 },
        workbookData
      );
      
      expect(result).toBe('level-uuid-2');
    });
    
    it('should resolve FK using multiple natural keys (role)', () => {
      const result = resolveForeignKey(
        'role_capability_sequence',
        'role_id',
        {
          role_name: 'Software Engineer',
          role_family_name: 'Engineering',
          domain_name: 'Technology'
        },
        workbookData
      );
      
      expect(result).toBe('role-uuid-1');
    });
    
    it('should be case-insensitive for string natural keys', () => {
      const result = resolveForeignKey(
        'levels',
        'capability_id',
        { code: 'web_dev' },
        workbookData
      );
      
      expect(result).toBe('cap-uuid-1');
    });
    
    it('should trim whitespace from string natural keys', () => {
      const result = resolveForeignKey(
        'levels',
        'capability_id',
        { code: '  WEB_DEV  ' },
        workbookData
      );
      
      expect(result).toBe('cap-uuid-1');
    });
    
    it('should return null if no match found', () => {
      const result = resolveForeignKey(
        'levels',
        'capability_id',
        { code: 'NONEXISTENT' },
        workbookData
      );
      
      expect(result).toBeNull();
    });
    
    it('should return null if column has no natural key lookup configured', () => {
      const result = resolveForeignKey(
        'modules',
        'level_id',
        { level_code: 'L1' },
        workbookData
      );
      
      expect(result).toBeNull();
    });
    
    it('should throw error if natural key values are missing', () => {
      expect(() => {
        resolveForeignKey(
          'role_capability_sequence',
          'role_id',
          { role_name: 'Software Engineer' }, // Missing role_family_name and domain_name
          workbookData
        );
      }).toThrow('Missing natural key values');
    });
    
    it('should throw error if referenced table not in workbook', () => {
      const emptyWorkbook = new Map();
      
      expect(() => {
        resolveForeignKey(
          'levels',
          'capability_id',
          { code: 'WEB_DEV' },
          emptyWorkbook
        );
      }).toThrow('Referenced table capabilities not found');
    });
  });
  
  describe('resolveForeignKeyBatch', () => {
    it('should resolve multiple FKs in batch', () => {
      const results = resolveForeignKeyBatch(
        'levels',
        'capability_id',
        [
          { code: 'WEB_DEV' },
          { code: 'API_DEV' },
          { code: 'DATA_SCI' },
        ],
        workbookData
      );
      
      expect(results).toEqual(['cap-uuid-1', 'cap-uuid-2', 'cap-uuid-3']);
    });
    
    it('should handle mixed resolved and unresolved FKs', () => {
      const results = resolveForeignKeyBatch(
        'levels',
        'capability_id',
        [
          { code: 'WEB_DEV' },
          { code: 'NONEXISTENT' },
          { code: 'API_DEV' },
        ],
        workbookData
      );
      
      expect(results).toEqual(['cap-uuid-1', null, 'cap-uuid-2']);
    });
    
    it('should handle empty array', () => {
      const results = resolveForeignKeyBatch(
        'levels',
        'capability_id',
        [],
        workbookData
      );
      
      expect(results).toEqual([]);
    });
  });
  
  describe('getReferencedTable', () => {
    it('should return referenced table for natural key FK', () => {
      expect(getReferencedTable('levels', 'capability_id')).toBe('capabilities');
    });
    
    it('should return referenced table for standard FK', () => {
      expect(getReferencedTable('level_skills', 'level_id')).toBe('levels');
      expect(getReferencedTable('level_skills', 'skill_id')).toBe('skills');
    });
    
    it('should return null for non-FK columns', () => {
      expect(getReferencedTable('capabilities', 'code')).toBeNull();
      expect(getReferencedTable('modules', 'title')).toBeNull();
    });
  });
  
  describe('isForeignKey', () => {
    it('should return true for FK columns', () => {
      expect(isForeignKey('levels', 'capability_id')).toBe(true);
      expect(isForeignKey('level_skills', 'level_id')).toBe(true);
    });
    
    it('should return false for non-FK columns', () => {
      expect(isForeignKey('capabilities', 'code')).toBe(false);
      expect(isForeignKey('modules', 'title')).toBe(false);
    });
  });
  
  describe('getNaturalKeyColumns', () => {
    it('should return natural key columns for configured FKs', () => {
      expect(getNaturalKeyColumns('levels', 'capability_id')).toEqual(['code']);
      expect(getNaturalKeyColumns('levels', 'level_id')).toEqual(['level_no']);
      expect(getNaturalKeyColumns('role_capability_sequence', 'role_id')).toEqual([
        'role_name',
        'role_family_name',
        'domain_name'
      ]);
    });
    
    it('should return null for FKs without natural keys', () => {
      expect(getNaturalKeyColumns('level_skills', 'level_id')).toBeNull();
    });
    
    it('should return null for non-FK columns', () => {
      expect(getNaturalKeyColumns('capabilities', 'code')).toBeNull();
    });
  });
  
  describe('buildFKLookupMap', () => {
    it('should build lookup map from single natural key', () => {
      const capabilities = workbookData.get('capabilities')!;
      const lookupMap = buildFKLookupMap('capabilities', ['code'], capabilities);
      
      expect(lookupMap.size).toBe(3);
      expect(lookupMap.get('web_dev')).toBe('cap-uuid-1');
      expect(lookupMap.get('api_dev')).toBe('cap-uuid-2');
      expect(lookupMap.get('data_sci')).toBe('cap-uuid-3');
    });
    
    it('should build lookup map from multiple natural keys', () => {
      const roles = workbookData.get('roles')!;
      const lookupMap = buildFKLookupMap(
        'roles',
        ['role_name', 'role_family_name', 'domain_name'],
        roles
      );
      
      expect(lookupMap.size).toBe(2);
      expect(lookupMap.get('software engineer|engineering|technology')).toBe('role-uuid-1');
      expect(lookupMap.get('data analyst|analytics|data')).toBe('role-uuid-2');
    });
    
    it('should normalize string keys to lowercase', () => {
      const capabilities = [
        { id: 'uuid-1', code: 'WEB_DEV' },
        { id: 'uuid-2', code: 'Api_Dev' },
      ];
      const lookupMap = buildFKLookupMap('capabilities', ['code'], capabilities);
      
      expect(lookupMap.get('web_dev')).toBe('uuid-1');
      expect(lookupMap.get('api_dev')).toBe('uuid-2');
    });
    
    it('should handle null/undefined natural key values', () => {
      const rows = [
        { id: 'uuid-1', code: 'CODE1' },
        { id: 'uuid-2', code: null },
        { id: 'uuid-3', code: undefined },
      ];
      const lookupMap = buildFKLookupMap('table', ['code'], rows);
      
      expect(lookupMap.size).toBe(3);
      expect(lookupMap.get('code1')).toBe('uuid-1');
      expect(lookupMap.get('')).toBe('uuid-3'); // undefined becomes empty string
    });
  });
  
  describe('resolveFKFromMap', () => {
    it('should resolve FK using pre-built lookup map', () => {
      const capabilities = workbookData.get('capabilities')!;
      const lookupMap = buildFKLookupMap('capabilities', ['code'], capabilities);
      
      const result = resolveFKFromMap(
        { code: 'WEB_DEV' },
        ['code'],
        lookupMap
      );
      
      expect(result).toBe('cap-uuid-1');
    });
    
    it('should be case-insensitive', () => {
      const capabilities = workbookData.get('capabilities')!;
      const lookupMap = buildFKLookupMap('capabilities', ['code'], capabilities);
      
      const result = resolveFKFromMap(
        { code: 'web_dev' },
        ['code'],
        lookupMap
      );
      
      expect(result).toBe('cap-uuid-1');
    });
    
    it('should return null if not found', () => {
      const capabilities = workbookData.get('capabilities')!;
      const lookupMap = buildFKLookupMap('capabilities', ['code'], capabilities);
      
      const result = resolveFKFromMap(
        { code: 'NONEXISTENT' },
        ['code'],
        lookupMap
      );
      
      expect(result).toBeNull();
    });
  });
  
  describe('generateFKSubquery', () => {
    it('should generate SQL WHERE clause for single natural key', () => {
      const sql = generateFKSubquery(
        'levels',
        'capability_id',
        { code: 'WEB_DEV' }
      );
      
      expect(sql).toBe("code = 'WEB_DEV'");
    });
    
    it('should generate SQL WHERE clause for multiple natural keys', () => {
      const sql = generateFKSubquery(
        'role_capability_sequence',
        'role_id',
        {
          role_name: 'Software Engineer',
          role_family_name: 'Engineering',
          domain_name: 'Technology'
        }
      );
      
      expect(sql).toContain("role_name = 'Software Engineer'");
      expect(sql).toContain("role_family_name = 'Engineering'");
      expect(sql).toContain("domain_name = 'Technology'");
      expect(sql).toContain(' AND ');
    });
    
    it('should handle NULL values', () => {
      const sql = generateFKSubquery(
        'levels',
        'capability_id',
        { code: null }
      );
      
      expect(sql).toBe('code IS NULL');
    });
    
    it('should escape single quotes in strings', () => {
      const sql = generateFKSubquery(
        'levels',
        'capability_id',
        { code: "O'Reilly" }
      );
      
      expect(sql).toBe("code = 'O''Reilly'");
    });
    
    it('should handle numeric values', () => {
      const sql = generateFKSubquery(
        'levels',
        'level_id',
        { level_no: 2 }
      );
      
      expect(sql).toBe('level_no = 2');
    });
    
    it('should handle boolean values', () => {
      const sql = generateFKSubquery(
        'table',
        'column',
        { is_active: true }
      );
      
      expect(sql).toContain('TRUE');
    });
    
    it('should return null for non-FK columns', () => {
      const sql = generateFKSubquery(
        'capabilities',
        'code',
        { value: 'test' }
      );
      
      expect(sql).toBeNull();
    });
  });
  
  describe('validateForeignKeys', () => {
    it('should return empty array if all FKs are valid', () => {
      // Add a levels row that references valid capability and level_scale
      workbookData.set('levels', [
        {
          id: 'level-uuid-1',
          level_code: 'L1-WEB',
          code: 'WEB_DEV',
          level_no: 1
        }
      ]);
      
      const errors = validateForeignKeys(workbookData);
      
      expect(errors).toEqual([]);
    });
    
    it('should detect invalid FK references', () => {
      workbookData.set('levels', [
        {
          id: 'level-uuid-1',
          level_code: 'L1-INVALID',
          code: 'NONEXISTENT_CODE',
          level_no: 1
        }
      ]);
      
      const errors = validateForeignKeys(workbookData);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].table).toBe('levels');
      expect(errors[0].column).toBe('capability_id');
      expect(errors[0].referencedTable).toBe('capabilities');
    });
    
    it('should skip rows where all natural key values are null', () => {
      workbookData.set('levels', [
        {
          id: 'level-uuid-1',
          level_code: 'L1',
          code: null,
          level_no: null
        }
      ]);
      
      const errors = validateForeignKeys(workbookData);
      
      expect(errors).toEqual([]);
    });
  });
});
