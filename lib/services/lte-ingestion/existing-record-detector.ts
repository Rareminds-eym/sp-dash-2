/**
 * Existing Record Detection Module
 * 
 * Detects which records from an upload already exist in the database,
 * allowing for SKIP logic during publish to avoid duplicate inserts.
 * 
 * Uses two strategies:
 * 1. UUID-based lookup for records with deterministic UUIDs
 * 2. Unique business key lookup for tables with natural unique constraints
 * 
 * Ported from Python reference: excel_to_lte_seed (2).py
 */

import { DB_UNIQUE_LOOKUP_COLUMNS, EXISTING_REFERENCE_TABLES } from './constants';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Result of existing record detection
 */
export interface ExistingRecordResult {
  existingUUIDs: Set<string>;
  existingUniqueKeys: Map<string, Set<string>>;
  referenceTableRecords: Map<string, any[]>;
}

/**
 * Detect existing records in the database by UUID
 * 
 * @param supabase - Supabase client
 * @param table - Table name
 * @param uuids - Array of UUIDs to check
 * @returns Set of UUIDs that exist in the database
 */
export async function detectExistingByUUID(
  supabase: SupabaseClient,
  table: string,
  uuids: string[]
): Promise<Set<string>> {
  if (uuids.length === 0) {
    return new Set();
  }
  
  // Query in batches of 100 to avoid URL length limits
  const batchSize = 100;
  const existingUUIDs = new Set<string>();
  
  for (let i = 0; i < uuids.length; i += batchSize) {
    const batch = uuids.slice(i, i + batchSize);
    
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .in('id', batch);
    
    if (error) {
      throw new Error(`Failed to query existing records for ${table}: ${error.message}`);
    }
    
    if (data) {
      data.forEach(row => existingUUIDs.add(row.id));
    }
  }
  
  return existingUUIDs;
}

/**
 * Detect existing records by unique business keys
 * 
 * @param supabase - Supabase client
 * @param table - Table name
 * @param uniqueColumns - Columns that form unique constraint
 * @param rows - Rows to check for existence
 * @returns Map of column name to set of existing values
 */
export async function detectExistingByUniqueKeys(
  supabase: SupabaseClient,
  table: string,
  uniqueColumns: string[],
  rows: any[]
): Promise<Map<string, Set<string>>> {
  const existingKeys = new Map<string, Set<string>>();
  
  // Initialize sets for each unique column
  uniqueColumns.forEach(column => {
    existingKeys.set(column, new Set());
  });
  
  if (rows.length === 0) {
    return existingKeys;
  }
  
  // For single unique column, we can batch query
  if (uniqueColumns.length === 1) {
    const column = uniqueColumns[0];
    const values = rows
      .map(row => row[column])
      .filter(v => v != null);
    
    if (values.length === 0) {
      return existingKeys;
    }
    
    // Query in batches
    const batchSize = 100;
    for (let i = 0; i < values.length; i += batchSize) {
      const batch = values.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from(table)
        .select(column)
        .in(column, batch);
      
      if (error) {
        throw new Error(`Failed to query unique keys for ${table}.${column}: ${error.message}`);
      }
      
      if (data) {
        const existingSet = existingKeys.get(column)!;
        data.forEach(row => {
          const value = row[column];
          if (value != null) {
            // Normalize to lowercase string for consistent comparison
            const normalized = typeof value === 'string' 
              ? value.toLowerCase() 
              : String(value);
            existingSet.add(normalized);
          }
        });
      }
    }
  } else {
    // For composite unique keys, we need to query each combination
    // This is less efficient but necessary for multi-column uniqueness
    for (const row of rows) {
      const filters: Record<string, any> = {};
      let hasAllValues = true;
      
      for (const column of uniqueColumns) {
        const value = row[column];
        if (value == null) {
          hasAllValues = false;
          break;
        }
        filters[column] = value;
      }
      
      if (!hasAllValues) {
        continue;
      }
      
      // Build query with all unique column filters
      let query = supabase.from(table).select(uniqueColumns.join(','));
      
      for (const [column, value] of Object.entries(filters)) {
        query = query.eq(column, value);
      }
      
      const { data, error } = await query.limit(1);
      
      if (error) {
        throw new Error(`Failed to query composite unique keys for ${table}: ${error.message}`);
      }
      
      if (data && data.length > 0) {
        // Record exists - add all column values to their respective sets
        const record = data[0];
        uniqueColumns.forEach(column => {
          const value = record[column];
          if (value != null) {
            const normalized = typeof value === 'string' 
              ? value.toLowerCase() 
              : String(value);
            existingKeys.get(column)!.add(normalized);
          }
        });
      }
    }
  }
  
  return existingKeys;
}

/**
 * Check if a table is a reference table (populated by seed data)
 * 
 * @param table - Table name
 * @returns True if table is a reference table
 */
export function isReferenceTable(table: string): boolean {
  return EXISTING_REFERENCE_TABLES.has(table);
}

/**
 * Load all records from reference tables
 * 
 * Reference tables are assumed to be small and stable (roles, capabilities, etc.)
 * so we can load them entirely for efficient lookups.
 * 
 * @param supabase - Supabase client
 * @returns Map of table name to array of records
 */
export async function loadReferenceTables(
  supabase: SupabaseClient
): Promise<Map<string, any[]>> {
  const referenceData = new Map<string, any[]>();
  
  for (const table of EXISTING_REFERENCE_TABLES) {
    const { data, error } = await supabase
      .from(table)
      .select('*');
    
    if (error) {
      throw new Error(`Failed to load reference table ${table}: ${error.message}`);
    }
    
    referenceData.set(table, data || []);
  }
  
  return referenceData;
}

/**
 * Detect all existing records for a workbook upload
 * 
 * Combines UUID-based detection, unique key detection, and reference table loading.
 * 
 * @param supabase - Supabase client
 * @param workbookData - Map of table names to row data
 * @returns Combined result of all detection strategies
 */
export async function detectAllExistingRecords(
  supabase: SupabaseClient,
  workbookData: Map<string, any[]>
): Promise<ExistingRecordResult> {
  const existingUUIDs = new Set<string>();
  const existingUniqueKeys = new Map<string, Set<string>>();
  
  // 1. Load reference tables (small, stable tables)
  const referenceTableRecords = await loadReferenceTables(supabase);
  
  // Add reference table UUIDs to existing set
  for (const [table, records] of referenceTableRecords.entries()) {
    records.forEach(record => {
      if (record.id) {
        existingUUIDs.add(record.id);
      }
    });
  }
  
  // 2. For each table in workbook, check for existing records
  for (const [table, rows] of workbookData.entries()) {
    if (rows.length === 0) {
      continue;
    }
    
    // Skip reference tables (already loaded)
    if (isReferenceTable(table)) {
      continue;
    }
    
    // Check by UUID
    const uuids = rows
      .map(row => row.id)
      .filter(id => id != null);
    
    if (uuids.length > 0) {
      const existingByUUID = await detectExistingByUUID(supabase, table, uuids);
      existingByUUID.forEach(uuid => existingUUIDs.add(uuid));
    }
    
    // Check by unique business keys
    const uniqueColumns = DB_UNIQUE_LOOKUP_COLUMNS[table];
    if (uniqueColumns && uniqueColumns.length > 0) {
      const existingByKeys = await detectExistingByUniqueKeys(
        supabase,
        table,
        uniqueColumns,
        rows
      );
      
      // Merge into main map
      for (const [column, values] of existingByKeys.entries()) {
        const key = `${table}|${column}`;
        if (!existingUniqueKeys.has(key)) {
          existingUniqueKeys.set(key, new Set());
        }
        values.forEach(value => existingUniqueKeys.get(key)!.add(value));
      }
    }
  }
  
  return {
    existingUUIDs,
    existingUniqueKeys,
    referenceTableRecords,
  };
}

/**
 * Check if a row exists in the database
 * 
 * @param row - Row data with id and unique columns
 * @param table - Table name
 * @param existingResult - Result from detectAllExistingRecords
 * @returns True if row exists in database
 */
export function rowExists(
  row: any,
  table: string,
  existingResult: ExistingRecordResult
): boolean {
  // Check by UUID
  if (row.id && existingResult.existingUUIDs.has(row.id)) {
    return true;
  }
  
  // Check by unique business keys
  const uniqueColumns = DB_UNIQUE_LOOKUP_COLUMNS[table];
  if (uniqueColumns && uniqueColumns.length > 0) {
    for (const column of uniqueColumns) {
      const value = row[column];
      if (value == null) {
        continue;
      }
      
      const normalized = typeof value === 'string' 
        ? value.trim().toLowerCase() 
        : String(value);
      
      const key = `${table}|${column}`;
      const existingSet = existingResult.existingUniqueKeys.get(key);
      
      if (existingSet && existingSet.has(normalized)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Get unique business key value for a row
 * 
 * @param row - Row data
 * @param table - Table name
 * @returns Unique key value (or composite key), or null if no unique columns
 */
export function getUniqueKeyValue(row: any, table: string): string | null {
  const uniqueColumns = DB_UNIQUE_LOOKUP_COLUMNS[table];
  if (!uniqueColumns || uniqueColumns.length === 0) {
    return null;
  }
  
  const keyParts: string[] = [];
  
  for (const column of uniqueColumns) {
    const value = row[column];
    if (value == null) {
      return null;
    }
    
    const normalized = typeof value === 'string' 
      ? value.trim().toLowerCase() 
      : String(value);
    
    keyParts.push(normalized);
  }
  
  return keyParts.join('|');
}

/**
 * Count existing vs new records in workbook
 * 
 * @param workbookData - Workbook data
 * @param existingResult - Existing record detection result
 * @returns Object with counts per table
 */
export function countExistingRecords(
  workbookData: Map<string, any[]>,
  existingResult: ExistingRecordResult
): Record<string, { total: number; existing: number; new: number }> {
  const counts: Record<string, { total: number; existing: number; new: number }> = {};
  
  for (const [table, rows] of workbookData.entries()) {
    let existingCount = 0;
    let newCount = 0;
    
    for (const row of rows) {
      if (rowExists(row, table, existingResult)) {
        existingCount++;
      } else {
        newCount++;
      }
    }
    
    counts[table] = {
      total: rows.length,
      existing: existingCount,
      new: newCount,
    };
  }
  
  return counts;
}
