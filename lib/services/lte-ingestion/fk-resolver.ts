/**
 * Foreign Key Resolution Module
 * 
 * Resolves foreign key references using natural business keys instead of UUIDs.
 * This allows Excel files to reference related records using human-readable
 * identifiers (e.g., capability code "WEB_DEV") that are then resolved to UUIDs.
 * 
 * Ported from Python reference: excel_to_lte_seed (2).py
 */

import { FK_NATURAL_KEY_LOOKUPS, FK_TABLES } from './constants';
import { deterministicUUID } from './uuid-generator';

/**
 * Natural key lookup configuration
 */
export interface NaturalKeyLookup {
  referencedTable: string;
  referencedColumn: string;
  naturalKeys: string[];
}

/**
 * Parse FK_NATURAL_KEY_LOOKUPS from constants format
 */
function parseNaturalKeyLookups(): Map<string, NaturalKeyLookup> {
  const lookups = new Map<string, NaturalKeyLookup>();
  
  for (const [key, [referencedTable, referencedColumn, naturalKeys]] of Object.entries(FK_NATURAL_KEY_LOOKUPS)) {
    lookups.set(key, {
      referencedTable,
      referencedColumn,
      naturalKeys,
    });
  }
  
  return lookups;
}

const NATURAL_KEY_LOOKUPS = parseNaturalKeyLookups();

/**
 * Resolve a foreign key value using natural key lookups
 * 
 * @param table - The source table containing the FK
 * @param column - The FK column name
 * @param naturalKeyValues - Map of natural key column names to their values
 * @param workbookData - Map of table names to their row data (for in-memory lookups)
 * @returns The resolved UUID, or null if not found
 * 
 * @example
 * // Resolve levels.capability_id using capability code
 * const capabilityId = resolveForeignKey(
 *   'levels',
 *   'capability_id',
 *   { code: 'WEB_DEV' },
 *   workbookData
 * );
 */
export function resolveForeignKey(
  table: string,
  column: string,
  naturalKeyValues: Record<string, any>,
  workbookData: Map<string, any[]>
): string | null {
  const lookupKey = `${table}|${column}`;
  const lookup = NATURAL_KEY_LOOKUPS.get(lookupKey);
  
  if (!lookup) {
    // No natural key lookup configured, return null
    return null;
  }
  
  const { referencedTable, naturalKeys } = lookup;
  
  // Check if all natural key values are provided
  const missingKeys = naturalKeys.filter(key => !(key in naturalKeyValues));
  if (missingKeys.length > 0) {
    throw new Error(
      `Missing natural key values for ${table}.${column}: ${missingKeys.join(', ')}`
    );
  }
  
  // Get referenced table data
  const referencedData = workbookData.get(referencedTable);
  if (!referencedData) {
    throw new Error(`Referenced table ${referencedTable} not found in workbook data`);
  }
  
  // Find matching row by natural keys
  for (const row of referencedData) {
    const matches = naturalKeys.every(key => {
      const rowValue = row[key];
      const searchValue = naturalKeyValues[key];
      
      // Handle null/undefined
      if (rowValue == null && searchValue == null) return true;
      if (rowValue == null || searchValue == null) return false;
      
      // Case-insensitive string comparison
      if (typeof rowValue === 'string' && typeof searchValue === 'string') {
        return rowValue.trim().toLowerCase() === searchValue.trim().toLowerCase();
      }
      
      // Exact match for other types
      return rowValue === searchValue;
    });
    
    if (matches) {
      // Return the ID from the matched row
      return row.id;
    }
  }
  
  // No matching row found
  return null;
}

/**
 * Resolve multiple foreign keys in batch
 * 
 * @param table - The source table
 * @param column - The FK column
 * @param naturalKeyValuesList - Array of natural key value maps
 * @param workbookData - Workbook data map
 * @returns Array of resolved UUIDs (null for unresolved)
 */
export function resolveForeignKeyBatch(
  table: string,
  column: string,
  naturalKeyValuesList: Record<string, any>[],
  workbookData: Map<string, any[]>
): (string | null)[] {
  return naturalKeyValuesList.map(values => 
    resolveForeignKey(table, column, values, workbookData)
  );
}

/**
 * Get the referenced table for a foreign key column
 * 
 * @param table - The source table
 * @param column - The FK column
 * @returns The referenced table name, or null if not a FK
 * 
 * @example
 * getReferencedTable('level_skills', 'level_id') // 'levels'
 * getReferencedTable('modules', 'title') // null (not a FK)
 */
export function getReferencedTable(table: string, column: string): string | null {
  const lookupKey = `${table}|${column}`;
  
  // Check natural key lookups first
  const naturalKeyLookup = NATURAL_KEY_LOOKUPS.get(lookupKey);
  if (naturalKeyLookup) {
    return naturalKeyLookup.referencedTable;
  }
  
  // Check standard FK tables
  const standardFK = FK_TABLES[lookupKey];
  if (standardFK) {
    return standardFK;
  }
  
  return null;
}

/**
 * Check if a column is a foreign key
 * 
 * @param table - The table name
 * @param column - The column name
 * @returns True if the column is a foreign key
 */
export function isForeignKey(table: string, column: string): boolean {
  return getReferencedTable(table, column) !== null;
}

/**
 * Get natural key columns for a foreign key
 * 
 * @param table - The source table
 * @param column - The FK column
 * @returns Array of natural key column names, or null if no natural keys
 */
export function getNaturalKeyColumns(table: string, column: string): string[] | null {
  const lookupKey = `${table}|${column}`;
  const lookup = NATURAL_KEY_LOOKUPS.get(lookupKey);
  
  return lookup ? lookup.naturalKeys : null;
}

/**
 * Build a lookup map for foreign key resolution
 * 
 * Creates an in-memory index for fast FK resolution by natural keys.
 * 
 * @param referencedTable - The table being referenced
 * @param naturalKeys - The natural key columns
 * @param rows - The table rows
 * @returns Map from natural key values to UUIDs
 * 
 * @example
 * const capabilityMap = buildFKLookupMap(
 *   'capabilities',
 *   ['code'],
 *   capabilityRows
 * );
 * // Map { 'WEB_DEV' => 'uuid-1', 'API_DEV' => 'uuid-2' }
 */
export function buildFKLookupMap(
  referencedTable: string,
  naturalKeys: string[],
  rows: any[]
): Map<string, string> {
  const lookupMap = new Map<string, string>();
  
  for (const row of rows) {
    // Build composite key from natural key values
    const keyParts = naturalKeys.map(key => {
      const value = row[key];
      if (value == null) return '';
      
      // Normalize strings to lowercase
      if (typeof value === 'string') {
        return value.trim().toLowerCase();
      }
      
      return String(value);
    });
    
    const compositeKey = keyParts.join('|');
    const uuid = row.id;
    
    if (uuid) {
      lookupMap.set(compositeKey, uuid);
    }
  }
  
  return lookupMap;
}

/**
 * Resolve FK using a pre-built lookup map (faster for batch operations)
 * 
 * @param naturalKeyValues - Natural key values for lookup
 * @param naturalKeys - Natural key column names (in order)
 * @param lookupMap - Pre-built lookup map
 * @returns Resolved UUID or null
 */
export function resolveFKFromMap(
  naturalKeyValues: Record<string, any>,
  naturalKeys: string[],
  lookupMap: Map<string, string>
): string | null {
  const keyParts = naturalKeys.map(key => {
    const value = naturalKeyValues[key];
    if (value == null) return '';
    
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    
    return String(value);
  });
  
  const compositeKey = keyParts.join('|');
  return lookupMap.get(compositeKey) || null;
}

/**
 * Generate SQL subquery for database FK resolution
 * 
 * For cases where FK needs to be resolved from database rather than
 * in-memory workbook data.
 * 
 * @param table - Source table
 * @param column - FK column
 * @param naturalKeyValues - Natural key values
 * @returns SQL WHERE clause for matching the natural keys
 * 
 * @example
 * generateFKSubquery('levels', 'capability_id', { code: 'WEB_DEV' })
 * // Returns: "code = 'WEB_DEV'"
 */
export function generateFKSubquery(
  table: string,
  column: string,
  naturalKeyValues: Record<string, any>
): string | null {
  const lookupKey = `${table}|${column}`;
  const lookup = NATURAL_KEY_LOOKUPS.get(lookupKey);
  
  if (!lookup) {
    return null;
  }
  
  const { naturalKeys } = lookup;
  const conditions: string[] = [];
  
  for (const key of naturalKeys) {
    const value = naturalKeyValues[key];
    
    if (value == null) {
      conditions.push(`${key} IS NULL`);
    } else if (typeof value === 'string') {
      // Escape single quotes
      const escaped = value.replace(/'/g, "''");
      conditions.push(`${key} = '${escaped}'`);
    } else if (typeof value === 'number') {
      conditions.push(`${key} = ${value}`);
    } else if (typeof value === 'boolean') {
      conditions.push(`${key} = ${value ? 'TRUE' : 'FALSE'}`);
    }
  }
  
  return conditions.join(' AND ');
}

/**
 * Validate foreign key relationships in workbook data
 * 
 * Checks that all FK references can be resolved to existing records.
 * 
 * @param workbookData - Map of table names to row data
 * @returns Array of validation errors
 */
export interface FKValidationError {
  table: string;
  column: string;
  row: number;
  naturalKeyValues: Record<string, any>;
  referencedTable: string;
  message: string;
}

export function validateForeignKeys(
  workbookData: Map<string, any[]>
): FKValidationError[] {
  const errors: FKValidationError[] = [];
  
  for (const [tableName, rows] of workbookData.entries()) {
    rows.forEach((row, rowIndex) => {
      for (const [key, lookup] of NATURAL_KEY_LOOKUPS.entries()) {
        const [table, column] = key.split('|');
        
        if (table !== tableName) continue;
        
        const { referencedTable, naturalKeys } = lookup;
        
        // Extract natural key values from row
        const naturalKeyValues: Record<string, any> = {};
        for (const naturalKey of naturalKeys) {
          naturalKeyValues[naturalKey] = row[naturalKey];
        }
        
        // Skip if all natural key values are null/undefined
        if (Object.values(naturalKeyValues).every(v => v == null)) {
          continue;
        }
        
        // Try to resolve FK
        try {
          const resolvedId = resolveForeignKey(table, column, naturalKeyValues, workbookData);
          
          if (resolvedId === null) {
            errors.push({
              table,
              column,
              row: rowIndex + 1,
              naturalKeyValues,
              referencedTable,
              message: `Cannot resolve foreign key ${table}.${column} using natural keys: ${JSON.stringify(naturalKeyValues)}`,
            });
          }
        } catch (error) {
          errors.push({
            table,
            column,
            row: rowIndex + 1,
            naturalKeyValues,
            referencedTable,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });
  }
  
  return errors;
}
