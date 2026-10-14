/** Local workbook comparisons against preloaded records; no database access. */
import { DB_UNIQUE_LOOKUP_COLUMNS, EXISTING_REFERENCE_TABLES } from './constants';

export interface ExistingRecordResult {
  existingUUIDs: Set<string>;
  existingUniqueKeys: Map<string, Set<string>>;
  referenceTableRecords: Map<string, any[]>;
}

export function isReferenceTable(table: string): boolean {
  return EXISTING_REFERENCE_TABLES.has(table);
}

/**
 * Check if a row exists in the database
 * 
 * @param row - Row data with id and unique columns
 * @param table - Table name
 * @param existingResult - Preloaded record sets
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
  const uniqueColumns = Object.hasOwn(DB_UNIQUE_LOOKUP_COLUMNS, table) ? DB_UNIQUE_LOOKUP_COLUMNS[table] : undefined;
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
  const uniqueColumns = Object.hasOwn(DB_UNIQUE_LOOKUP_COLUMNS, table) ? DB_UNIQUE_LOOKUP_COLUMNS[table] : undefined;
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
