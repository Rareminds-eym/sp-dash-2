// Friendly header aliases mapping (ported from Python script)
// Maps Excel-friendly column names to database column names
export const FRIENDLY_HEADER_ALIASES: Record<string, string> = {
  // Common
  'Id': 'id',
  
  // Levels table
  'total_po': 'total_xp',  // Fix for incorrect column name
  'proficiency_level': 'level_code',
  'capability_code': 'capability_id',  // Will need UUID lookup
  
  // Course/Module fields
  'allowed_file_types (|)': 'allowed_file_types',
  'course_problem_statement (|)': 'problem_statement',
  'curriculum_reference (|)': 'curriculum_reference',
  'Industry_challenge': 'industry_challenge',
  'Industry Challenge': 'industry_challenge',
  'Prerequisites': 'prerequisites',
  'whatYoullLearn': 'what_youll_learn',
  'WhatYoullLearn': 'what_youll_learn',
  "What You'll Learn": 'what_youll_learn',
  'whenToApply': 'when_to_apply',
  'When To Apply': 'when_to_apply',
};

/**
 * Normalize a header string to match database column names
 * - Applies FRIENDLY_HEADER_ALIASES mapping
 * - Removes pipe syntax suffixes "(|)"
 * - Trims and normalizes whitespace
 * 
 * @param header - Raw header string from Excel
 * @returns Normalized column name for database
 */
export function normalizeHeader(header: string): string {
  // Clean and trim whitespace
  let cleaned = header.trim().replace(/\s+/g, ' ');

  // Check if there's a direct alias mapping
  // Use hasOwnProperty to avoid prototype pollution issues
  if (Object.prototype.hasOwnProperty.call(FRIENDLY_HEADER_ALIASES, cleaned)) {
    return FRIENDLY_HEADER_ALIASES[cleaned];
  }

  // Remove pipe suffix "(|)" if present
  cleaned = cleaned.replace(/\s*\(\|\)\s*$/, '').trim();

  return cleaned;
}

/**
 * Normalize all headers in a column array
 * @param headers - Array of raw header strings
 * @returns Array of normalized column names
 */
export function normalizeHeaders(headers: string[]): string[] {
  return headers.map(normalizeHeader);
}

/**
 * Validate that required columns are present after normalization
 * @param normalizedHeaders - Normalized column names
 * @param requiredColumns - Required column names for this table
 * @returns Array of missing column names
 */
export function validateRequiredColumns(
  normalizedHeaders: string[],
  requiredColumns: string[]
): string[] {
  const presentColumns = new Set(normalizedHeaders);
  const missingColumns: string[] = [];

  for (const requiredColumn of requiredColumns) {
    if (!presentColumns.has(requiredColumn)) {
      missingColumns.push(requiredColumn);
    }
  }

  return missingColumns;
}
