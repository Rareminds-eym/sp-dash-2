/**
 * Duplicate Detection Module
 * 
 * Detects duplicate rows within an upload workbook and determines
 * conflict resolution strategy (INSERT/SKIP/ERROR).
 */

import { getUniqueKeyValue } from './existing-record-detector';

export type ConflictAction = 'INSERT' | 'SKIP' | 'ERROR';

export interface DuplicateInfo {
  action: ConflictAction;
  reason: string;
  duplicateOf?: number; // Row index of original
}

export interface DuplicateDetectionResult {
  duplicates: Map<number, DuplicateInfo>; // Row index -> info
  errors: Array<{ row: number; message: string }>;
}

/**
 * Detect duplicate rows within a table
 */
export function detectDuplicates(
  table: string,
  rows: any[]
): DuplicateDetectionResult {
  const duplicates = new Map<number, DuplicateInfo>();
  const errors: Array<{ row: number; message: string }> = [];
  
  // Track seen rows by identity key (UUID or unique key)
  const seenByUUID = new Map<string, number>(); // UUID -> first occurrence row index
  const seenByUniqueKey = new Map<string, number>(); // unique key -> first occurrence row index
  const rowHashes = new Map<number, string>(); // row index -> content hash
  
  rows.forEach((row, index) => {
    const uuid = row.id;
    const uniqueKey = getUniqueKeyValue(row, table);
    const contentHash = hashRowContent(row);
    
    rowHashes.set(index, contentHash);
    
    // Check UUID duplicates
    if (uuid && seenByUUID.has(uuid)) {
      const originalIndex = seenByUUID.get(uuid)!;
      const originalHash = rowHashes.get(originalIndex)!;
      
      if (contentHash === originalHash) {
        // Identical duplicate - SKIP
        duplicates.set(index, {
          action: 'SKIP',
          reason: 'Identical duplicate (same UUID, same data)',
          duplicateOf: originalIndex,
        });
      } else {
        // Conflicting duplicate - ERROR
        duplicates.set(index, {
          action: 'ERROR',
          reason: `Conflicting duplicate UUID: ${uuid}`,
          duplicateOf: originalIndex,
        });
        errors.push({
          row: index + 1,
          message: `Conflicting duplicate UUID "${uuid}" at rows ${originalIndex + 1} and ${index + 1}`,
        });
      }
    } else if (uuid) {
      seenByUUID.set(uuid, index);
    }
    
    // Check unique key duplicates
    if (uniqueKey && seenByUniqueKey.has(uniqueKey)) {
      const originalIndex = seenByUniqueKey.get(uniqueKey)!;
      const originalHash = rowHashes.get(originalIndex)!;
      
      if (contentHash === originalHash) {
        // Identical duplicate - SKIP (if not already marked)
        if (!duplicates.has(index)) {
          duplicates.set(index, {
            action: 'SKIP',
            reason: 'Identical duplicate (same unique key, same data)',
            duplicateOf: originalIndex,
          });
        }
      } else {
        // Conflicting duplicate - ERROR
        if (!duplicates.has(index)) {
          duplicates.set(index, {
            action: 'ERROR',
            reason: `Conflicting duplicate unique key: ${uniqueKey}`,
            duplicateOf: originalIndex,
          });
        }
        errors.push({
          row: index + 1,
          message: `Conflicting duplicate unique key "${uniqueKey}" at rows ${originalIndex + 1} and ${index + 1}`,
        });
      }
    } else if (uniqueKey) {
      seenByUniqueKey.set(uniqueKey, index);
    }
  });
  
  return { duplicates, errors };
}

/**
 * Create content hash for row comparison
 */
function hashRowContent(row: any): string {
  // Simple JSON stringify for content comparison
  // Exclude 'id' from comparison if using unique keys
  const { id, ...content } = row;
  return JSON.stringify(content, Object.keys(content).sort());
}

/**
 * Detect duplicates across all tables in workbook
 */
export function detectAllDuplicates(
  workbookData: Map<string, any[]>
): Map<string, DuplicateDetectionResult> {
  const results = new Map<string, DuplicateDetectionResult>();
  
  for (const [table, rows] of workbookData.entries()) {
    const result = detectDuplicates(table, rows);
    if (result.duplicates.size > 0 || result.errors.length > 0) {
      results.set(table, result);
    }
  }
  
  return results;
}

/**
 * Check if row is a duplicate
 */
export function isDuplicate(
  table: string,
  rowIndex: number,
  duplicateResults: Map<string, DuplicateDetectionResult>
): boolean {
  const result = duplicateResults.get(table);
  return result?.duplicates.has(rowIndex) || false;
}

/**
 * Get conflict action for a row
 */
export function getConflictAction(
  table: string,
  rowIndex: number,
  duplicateResults: Map<string, DuplicateDetectionResult>
): ConflictAction {
  const result = duplicateResults.get(table);
  const info = result?.duplicates.get(rowIndex);
  return info?.action || 'INSERT';
}
