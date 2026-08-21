/**
 * JSON and Pipe-delimited Field Parser
 * Ported from excel_to_lte_seed.py normalize_json_value() and split_pipe()
 */

import {
  PIPE_JSON_COLUMNS,
  PIPE_KEY_VALUE_COLUMNS,
  MODULE_STRUCTURED_JSON_KEYS,
  EMPTY_JSON_OBJECT_COLUMNS,
  EMPTY_JSON_ARRAY_COLUMNS,
  JSON_NULL_TEXT_VALUES,
} from './constants';

/**
 * Split pipe-delimited text into array of strings
 * Validates format and rejects empty sections
 */
export function splitPipe(value: string): string[] {
  const text = value.trim();
  
  // Check for word "PIPE" (common Excel mistake)
  if (/(?:^|\s)PIPE(?:\s|$)/i.test(text)) {
    throw new Error('Use the | symbol in Excel, not the word PIPE');
  }
  
  // Check for malformed pipe usage
  if (text.startsWith('|') || text.endsWith('|') || text.includes('||')) {
    throw new Error('Pipe text contains an empty section');
  }
  
  const parts = text.split('|').map(p => p.trim());
  
  // Validate no empty sections
  if (parts.some(p => !p)) {
    throw new Error('Pipe text contains an empty section');
  }
  
  return parts;
}

/**
 * Parse pipe-delimited key:value pairs into object
 * Format: "key1: value1 | key2: value2"
 */
export function parsePipeKeyValues(value: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  
  for (const part of splitPipe(value)) {
    const keyMatch = part.match(/^([A-Za-z][A-Za-z0-9_ ]{1,80}):\s*(.*)$/s);
    
    if (!keyMatch) {
      throw new Error(`Pipe section has no key: ${part}`);
    }
    
    const key = keyMatch[1].trim().toLowerCase().replace(/\s+/g, '_');
    const parsedValue = keyMatch[2].trim();
    
    if (!parsedValue) {
      throw new Error(`Pipe section '${key}' is blank`);
    }
    
    if (key in parsed) {
      throw new Error(`Pipe section '${key}' appears more than once`);
    }
    
    parsed[key] = parsedValue;
  }
  
  return parsed;
}

/**
 * Parse artifact_questions.instructions field
 * Special format: "Required: ... | Pass Criteria: ... | Critical Fail: ..."
 */
export function parseArtifactInstructions(value: string): Record<string, string> {
  const parsed = {
    required_fields: '',
    pass_criteria: '',
    critical_fail: '',
  };
  
  const unmatchedParts: string[] = [];
  
  for (const part of splitPipe(value)) {
    const text = part.trim();
    const lowerText = text.toLowerCase();
    
    if (lowerText.startsWith('required:')) {
      parsed.required_fields = text.split(':', 2)[1].trim();
      continue;
    }
    if (lowerText.startsWith('required fields:')) {
      parsed.required_fields = text.split(':', 2)[1].trim();
      continue;
    }
    if (lowerText.startsWith('required fields include')) {
      parsed.required_fields = text;
      continue;
    }
    if (lowerText.startsWith('pass criteria:') || lowerText.startsWith('pass_criteria:')) {
      parsed.pass_criteria = text.split(':', 2)[1].trim();
      continue;
    }
    if (lowerText.startsWith('critical fail:') || lowerText.startsWith('critical_fail:')) {
      parsed.critical_fail = text.split(':', 2)[1].trim();
      continue;
    }
    
    unmatchedParts.push(text);
  }
  
  // If we have unmatched parts and no required_fields, use them as required_fields
  if (unmatchedParts.length > 0 && !parsed.required_fields) {
    parsed.required_fields = unmatchedParts.join(' | ');
  }
  
  return parsed;
}

/**
 * Check if pipe text contains key:value pairs
 */
export function pipeTextHasKeyValues(value: string): boolean {
  try {
    const parts = splitPipe(value);
    return parts.every(p => /^[A-Za-z][A-Za-z0-9_ ]{1,80}:\s*.+$/s.test(p));
  } catch {
    return false;
  }
}

/**
 * Normalize JSON/pipe value for a specific table/column
 * Returns parsed JSON object/array, or the original value
 */
export function normalizeJsonValue(
  table: string,
  column: string,
  value: any
): any {
  // Handle null/empty
  if (value === null || value === undefined) {
    return value;
  }
  
  if (typeof value === 'string' && !value.trim()) {
    return value;
  }
  
  // Already parsed
  if (typeof value === 'object') {
    return value;
  }
  
  const text = String(value).trim();
  const tableColumn = `${table}|${column}`;
  
  // Try parsing as JSON first
  try {
    return JSON.parse(text);
  } catch {
    // Not valid JSON, continue to pipe parsing
  }
  
  // levels.problem_statement: "title: ... | description: ..."
  if (tableColumn === 'levels|problem_statement') {
    const parsed = parsePipeKeyValues(text);
    const missing = ['title', 'description'].filter(k => !(k in parsed));
    
    if (missing.length > 0) {
      throw new Error(
        `levels.problem_statement is missing pipe section(s): ${missing.join(', ')}`
      );
    }
    
    return {
      title: parsed.title,
      description: parsed.description,
    };
  }
  
  // levels.observable_behavior: pipe array
  if (tableColumn === 'levels|observable_behavior') {
    return splitPipe(text);
  }
  
  // levels.example_outputs: pipe array
  if (tableColumn === 'levels|example_outputs') {
    return splitPipe(text);
  }
  
  // modules_content.curriculum_reference: key:value OR array
  if (tableColumn === 'modules_content|curriculum_reference') {
    if (pipeTextHasKeyValues(text)) {
      return parsePipeKeyValues(text);
    }
    return splitPipe(text);
  }
  
  // artifact_questions.instructions: special format
  if (tableColumn === 'artifact_questions|instructions') {
    return parseArtifactInstructions(text);
  }
  
  // skills.tags: pipe array
  if (tableColumn === 'skills|tags') {
    return splitPipe(text);
  }
  
  // modules.tools: wrap in object
  if (tableColumn === 'modules|tools') {
    return { items: splitPipe(text) };
  }
  
  // modules.support: key:value OR fallback object
  if (tableColumn === 'modules|support') {
    if (pipeTextHasKeyValues(text)) {
      return parsePipeKeyValues(text);
    }
    return { ai_support_tips: text };
  }
  
  // Check for structured JSON keys
  const expectedKeys = MODULE_STRUCTURED_JSON_KEYS[tableColumn];
  if (expectedKeys && pipeTextHasKeyValues(text)) {
    return parsePipeKeyValues(text);
  }
  
  // Generic pipe JSON column
  if (PIPE_JSON_COLUMNS.has(tableColumn)) {
    return splitPipe(text);
  }
  
  // Return as-is
  return text;
}

/**
 * Get default value for empty JSON columns
 */
export function getDefaultJsonValue(table: string, column: string): any {
  const tableColumn = `${table}|${column}`;
  
  if (EMPTY_JSON_ARRAY_COLUMNS.has(tableColumn)) {
    return [];
  }
  
  if (EMPTY_JSON_OBJECT_COLUMNS.has(tableColumn) || column === 'metadata') {
    return {};
  }
  
  return null;
}

/**
 * Check if text value represents JSON null
 */
export function isJsonNullText(value: any): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  
  return JSON_NULL_TEXT_VALUES.has(value.trim().toLowerCase());
}
