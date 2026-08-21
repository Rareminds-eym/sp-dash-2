/**
 * Pipe-delimited field parser for LTE ingestion
 * 
 * Parses pipe-delimited text fields (split by `|`) with validation rules:
 * - No empty sections
 * - No leading/trailing pipes
 * - No consecutive pipes (`||`)
 * - Rejects text containing the word "PIPE"
 * 
 * Ported from Python reference: excel_to_lte_seed (2).py
 */

/**
 * Split a pipe-delimited string into an array of trimmed non-empty strings
 * 
 * @param value - The pipe-delimited text to split
 * @returns Array of trimmed string segments
 * @throws Error if the text contains the word "PIPE", has empty sections,
 *         or has leading/trailing pipes
 * 
 * @example
 * splitPipe("item1 | item2 | item3") // ["item1", "item2", "item3"]
 * splitPipe("PIPE") // throws Error
 * splitPipe("item1||item2") // throws Error
 * splitPipe("|item1") // throws Error
 */
export function splitPipe(value: string): string[] {
  const text = value.trim();
  
  // Check for the word "PIPE" (case-insensitive, must be a complete word)
  // Pattern: (?i) = case insensitive, (?:^|\s) = start or whitespace, (?:\s|$) = whitespace or end
  if (/(?:^|\s)PIPE(?:\s|$)/i.test(text)) {
    throw new Error("Use the | symbol in Excel, not the word PIPE");
  }
  
  // Check for leading/trailing pipes or consecutive pipes
  if (text.startsWith("|") || text.endsWith("|") || text.includes("||")) {
    throw new Error("Pipe text contains an empty section");
  }
  
  // Split by pipe and trim each part
  const parts = text.split("|").map(part => part.trim());
  
  // Verify no empty parts (after trimming)
  if (parts.some(part => !part)) {
    throw new Error("Pipe text contains an empty section");
  }
  
  return parts;
}

/**
 * Parse pipe-delimited key:value pairs into an object
 * 
 * @param value - The pipe-delimited text with key:value format
 * @returns Object with keys mapped to values
 * @throws Error if any section lacks a key, has a blank value, or contains duplicate keys
 * 
 * @example
 * parseKeyValues("name: John | age: 30") // { name: "John", age: "30" }
 * parseKeyValues("key1: value1 | key1: value2") // throws Error (duplicate key)
 */
export function parseKeyValues(value: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  
  for (const part of splitPipe(value)) {
    // Match key:value pattern
    // Key must start with letter, can contain letters, numbers, underscores, spaces (1-80 chars)
    // Value can be anything (including multiline - use [\s\S]* for ES2017 compatibility)
    const keyMatch = part.match(/^([A-Za-z][A-Za-z0-9_ ]{0,79}):\s*([\s\S]*)$/);
    
    if (!keyMatch) {
      throw new Error(`Pipe section has no key: ${JSON.stringify(part)}`);
    }
    
    const key = keyMatch[1].trim().toLowerCase().replace(/\s+/g, "_");
    const parsedValue = keyMatch[2].trim();
    
    if (!parsedValue) {
      throw new Error(`Pipe section ${JSON.stringify(key)} is blank`);
    }
    
    if (key in parsed) {
      throw new Error(`Pipe section ${JSON.stringify(key)} appears more than once`);
    }
    
    parsed[key] = parsedValue;
  }
  
  return parsed;
}
