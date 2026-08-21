import * as ExcelJS from 'exceljs';
import { REQUIRED_LTE_TABLES as REQUIRED_TABLE_NAMES } from './constants';

// Sheets to ignore during parsing (from Python script)
const IGNORED_SHEETS = new Set([
  'README_INSTRUCTIONS',
  'ENUMS',
  'ENUMS_AND_RULES',
  'WRITING_EXAMPLES',
]);

// 13 LTE catalog tables that should be present in the workbook
// Note: 'courses' and 'lte_catalog_uploads' are not used in this LTE schema
export const REQUIRED_LTE_TABLES = [
  'roles',
  'capabilities',
  'level_scale',
  'role_capability_sequence',
  'skills',
  'levels',
  'level_skills',
  'modules',
  'modules_content',
  'e_content',
  'module_artifacts',
  'artifact_questions',
  'artifact_templates',
] as const;

const REQUIRED_TABLE_SET = new Set<string>(REQUIRED_TABLE_NAMES);

export interface WorksheetData {
  tableName: string;
  columns: string[];
  rows: any[][];
}

export interface ParsedWorkbook {
  worksheets: WorksheetData[];
  metadata: {
    fileName: string;
    totalSheets: number;
    totalRows: number;
    parsedAt: string;
  };
}

/**
 * Parse an XLSX file buffer and extract worksheet data
 * @param fileBuffer - Buffer containing the XLSX file
 * @param fileName - Original file name for metadata
 * @returns Parsed workbook with worksheet data
 */
export async function parseXLSX(
  fileBuffer: Buffer,
  fileName: string
): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);

  const worksheets: WorksheetData[] = [];
  let totalRows = 0;

  // Iterate through each worksheet
  workbook.eachSheet((worksheet, sheetId) => {
    const sheetName = worksheet.name;

    // Skip ignored sheets
    if (IGNORED_SHEETS.has(sheetName)) {
      return;
    }

    // Helper/reference sheets are allowed in source workbooks, but only real
    // LTE database tables should enter the normalized publish snapshot.
    if (!REQUIRED_TABLE_SET.has(sheetName)) {
      return;
    }

    // Extract headers from first row
    const headerRow = worksheet.getRow(1);
    const columns: string[] = [];
    
    headerRow.eachCell((cell, colNumber) => {
      const value = cell.value;
      if (value !== null && value !== undefined) {
        columns.push(String(value));
      }
    });

    // If no columns, skip this sheet
    if (columns.length === 0) {
      return;
    }

    // Extract data rows (starting from row 2)
    const rows: any[][] = [];
    const maxRow = worksheet.rowCount;

    for (let rowNumber = 2; rowNumber <= maxRow; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const rowData: any[] = [];
      let hasData = false;

      // Extract cell values for each column
      for (let colIndex = 1; colIndex <= columns.length; colIndex++) {
        const cell = row.getCell(colIndex);
        let value = cell.value;

        // Handle Excel date values
        if (cell.type === ExcelJS.ValueType.Date && value instanceof Date) {
          value = value.toISOString();
        }
        // Handle formula results
        else if (cell.type === ExcelJS.ValueType.Formula && 'result' in cell) {
          value = (cell as any).result;
        }
        // Handle rich text
        else if (cell.type === ExcelJS.ValueType.RichText) {
          value = (cell.value as any).richText?.map((rt: any) => rt.text).join('') || '';
        }

        rowData.push(value);

        // Check if row has any non-null data
        if (value !== null && value !== undefined && String(value).trim() !== '') {
          hasData = true;
        }
      }

      // Only include rows that have at least one non-empty cell
      if (hasData) {
        rows.push(rowData);
        totalRows++;
      }
    }

    worksheets.push({
      tableName: sheetName,
      columns,
      rows,
    });
  });

  return {
    worksheets,
    metadata: {
      fileName,
      totalSheets: worksheets.length,
      totalRows,
      parsedAt: new Date().toISOString(),
    },
  };
}

/**
 * Validate that required LTE tables are present in the workbook
 * @param worksheets - Parsed worksheets
 * @returns Array of missing table names
 */
export function validateRequiredTables(worksheets: WorksheetData[]): string[] {
  const presentTables = new Set(worksheets.map(ws => ws.tableName));
  const missingTables: string[] = [];

  for (const requiredTable of REQUIRED_LTE_TABLES) {
    if (!presentTables.has(requiredTable)) {
      missingTables.push(requiredTable);
    }
  }

  return missingTables;
}
