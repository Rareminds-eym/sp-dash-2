/**
 * Snapshot Serializer Module
 * 
 * Creates immutable normalized snapshots with deterministic hashing.
 */

import crypto from 'crypto';

export interface NormalizedSnapshot {
  tables: Record<string, {
    columns: string[];
    rows: any[][];
  }>;
  metadata: {
    sourceType: 'xlsx' | 'google_sheets';
    sourceName: string;
    tableCount: number;
    totalRows: number;
    parsedAt: string;
  };
}

/**
 * Create normalized snapshot from workbook data
 */
export function createSnapshot(
  workbookData: Map<string, any[]>,
  sourceType: 'xlsx' | 'google_sheets',
  sourceName: string
): NormalizedSnapshot {
  const tables: Record<string, { columns: string[]; rows: any[][] }> = {};
  let totalRows = 0;
  
  for (const [tableName, rows] of workbookData.entries()) {
    if (rows.length === 0) continue;
    
    // Extract columns from first row
    const columns = Object.keys(rows[0]).sort();
    
    // Convert rows to arrays (ordered by columns)
    const rowArrays = rows.map(row =>
      columns.map(col => row[col])
    );
    
    tables[tableName] = { columns, rows: rowArrays };
    totalRows += rows.length;
  }
  
  return {
    tables,
    metadata: {
      sourceType,
      sourceName,
      tableCount: Object.keys(tables).length,
      totalRows,
      parsedAt: new Date().toISOString(),
    },
  };
}

/**
 * Serialize snapshot to deterministic JSON string
 */
export function serializeSnapshot(snapshot: NormalizedSnapshot): string {
  return JSON.stringify(sortObjectKeys(snapshot));
}

/**
 * Calculate SHA-256 hash of snapshot
 */
export function calculateHash(snapshot: NormalizedSnapshot): string {
  const serialized = serializeSnapshot(snapshot);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

function sortObjectKeys(value: any): any {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, any>>((acc, key) => {
        acc[key] = sortObjectKeys(value[key]);
        return acc;
      }, {});
  }

  return value;
}

/**
 * Verify snapshot hash matches expected value
 */
export function verifyHash(snapshot: NormalizedSnapshot, expectedHash: string): boolean {
  const actualHash = calculateHash(snapshot);
  return actualHash.toLowerCase() === expectedHash.toLowerCase();
}
