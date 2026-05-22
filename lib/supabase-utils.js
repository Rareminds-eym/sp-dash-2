/**
 * Supabase Query Utilities
 * Helper functions for safe query construction
 */

/**
 * Escapes special characters in PostgREST filter strings
 * PostgREST uses special characters: . , ( ) " * and %
 * @param {string} value - The value to escape
 * @returns {string} - Escaped value safe for PostgREST filters
 */
export function escapePostgRESTValue(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }

  // Escape special PostgREST characters
  // Reference: https://postgrest.org/en/stable/api.html#operators
  return value
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/"/g, '\\"')     // Escape double quotes
    .replace(/\*/g, '\\*')    // Escape asterisks
    .replace(/\(/g, '\\(')    // Escape opening parenthesis
    .replace(/\)/g, '\\)')    // Escape closing parenthesis
    .replace(/,/g, '\\,')     // Escape commas
    .replace(/\./g, '\\.');   // Escape dots
}

/**
 * Builds a safe search filter for multiple columns using ILIKE
 * @param {object} query - Supabase query builder instance
 * @param {string[]} columns - Array of column names to search
 * @param {string} searchTerm - The search term (will be escaped)
 * @returns {object} - Modified query builder
 */
export function addSearchFilter(query, columns, searchTerm) {
  if (!searchTerm || !columns || columns.length === 0) {
    return query;
  }

  // Escape the search term
  const escapedSearch = escapePostgRESTValue(searchTerm.trim());
  
  if (!escapedSearch) {
    return query;
  }

  // Build OR conditions for each column
  const conditions = columns.map(col => {
    // Validate column name to prevent injection
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) {
      throw new Error(`Invalid column name: ${col}`);
    }
    return `${col}.ilike.*${escapedSearch}*`;
  }).join(',');

  return query.or(conditions);
}

/**
 * Validates and sanitizes a search term
 * @param {string} search - Raw search input
 * @param {number} maxLength - Maximum allowed length (default: 100)
 * @returns {string|null} - Sanitized search term or null if invalid
 */
export function sanitizeSearchTerm(search, maxLength = 100) {
  if (!search || typeof search !== 'string') {
    return null;
  }

  const trimmed = search.trim();
  
  // Limit length to prevent DoS
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    return null;
  }

  return trimmed;
}
