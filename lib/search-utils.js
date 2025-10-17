/**
 * Industrial-Grade Search Utilities
 * Implements fuzzy matching, similarity scoring, and relevance ranking
 */

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} - Edit distance
 */
function levenshteinDistance(a, b) {
  if (!a || !b) return Math.max(a?.length || 0, b?.length || 0);
  
  const matrix = [];
  
  // Initialize first column
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  // Initialize first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score between two strings (0-1, higher is better)
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} - Similarity score (0-1)
 */
function calculateSimilarity(a, b) {
  if (!a || !b) return 0;
  
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  
  // Exact match gets highest score
  if (aLower === bLower) return 1.0;
  
  // Contains match gets high score
  if (aLower.includes(bLower) || bLower.includes(aLower)) {
    const longer = Math.max(aLower.length, bLower.length);
    const shorter = Math.min(aLower.length, bLower.length);
    return 0.9 * (shorter / longer);
  }
  
  // Calculate Levenshtein-based similarity
  const maxLength = Math.max(aLower.length, bLower.length);
  const distance = levenshteinDistance(aLower, bLower);
  const similarity = 1 - (distance / maxLength);
  
  return similarity;
}

/**
 * Check if a string fuzzy matches a search term
 * @param {string} text - Text to search in
 * @param {string} searchTerm - Search term
 * @param {number} threshold - Similarity threshold (0-1), default 0.7 for flexible matching
 * @returns {boolean} - Whether there's a match
 */
export function fuzzyMatch(text, searchTerm, threshold = 0.7) {
  if (!text || !searchTerm) return false;
  
  const textLower = text.toLowerCase();
  const searchLower = searchTerm.toLowerCase();
  
  // Exact match
  if (textLower === searchLower) return true;
  
  // Contains match
  if (textLower.includes(searchLower)) return true;
  
  // Word-by-word matching for multi-word searches
  const searchWords = searchLower.split(/\s+/);
  const textWords = textLower.split(/\s+/);
  
  // Check if all search words match at least one text word
  const allWordsMatch = searchWords.every(searchWord => {
    return textWords.some(textWord => {
      // Direct contains
      if (textWord.includes(searchWord) || searchWord.includes(textWord)) {
        return true;
      }
      // Fuzzy match
      const similarity = calculateSimilarity(textWord, searchWord);
      return similarity >= threshold;
    });
  });
  
  if (allWordsMatch) return true;
  
  // Overall string similarity
  const overallSimilarity = calculateSimilarity(textLower, searchLower);
  return overallSimilarity >= threshold;
}

/**
 * Calculate relevance score for search results
 * @param {string} text - Text to score
 * @param {string} searchTerm - Search term
 * @returns {number} - Relevance score (higher is better)
 */
export function calculateRelevanceScore(text, searchTerm) {
  if (!text || !searchTerm) return 0;
  
  const textLower = text.toLowerCase();
  const searchLower = searchTerm.toLowerCase();
  
  let score = 0;
  
  // Exact match: highest score
  if (textLower === searchLower) {
    score += 100;
  }
  // Starts with: very high score
  else if (textLower.startsWith(searchLower)) {
    score += 80;
  }
  // Contains at start of word: high score
  else if (textLower.includes(' ' + searchLower)) {
    score += 70;
  }
  // Contains anywhere: good score
  else if (textLower.includes(searchLower)) {
    score += 60;
  }
  
  // Add similarity-based score
  const similarity = calculateSimilarity(textLower, searchLower);
  score += similarity * 50;
  
  // Bonus for shorter text (more precise match)
  const lengthRatio = searchLower.length / textLower.length;
  score += lengthRatio * 20;
  
  // Word-by-word matching bonus
  const searchWords = searchLower.split(/\s+/);
  const textWords = textLower.split(/\s+/);
  
  searchWords.forEach(searchWord => {
    textWords.forEach(textWord => {
      if (textWord === searchWord) {
        score += 15;
      } else if (textWord.includes(searchWord) || searchWord.includes(textWord)) {
        score += 10;
      } else {
        const wordSimilarity = calculateSimilarity(textWord, searchWord);
        if (wordSimilarity >= 0.7) {
          score += wordSimilarity * 8;
        }
      }
    });
  });
  
  return score;
}

/**
 * Search through multiple fields and return best match with relevance score
 * @param {object} item - Item to search in
 * @param {string[]} fields - Fields to search in
 * @param {string} searchTerm - Search term
 * @param {number} threshold - Similarity threshold (0-1)
 * @returns {object} - {matches: boolean, score: number, matchedFields: string[]}
 */
export function multiFieldSearch(item, fields, searchTerm, threshold = 0.7) {
  if (!searchTerm) {
    return { matches: true, score: 0, matchedFields: [] };
  }
  
  let maxScore = 0;
  let matchedFields = [];
  
  fields.forEach(field => {
    // Get nested field value (e.g., 'user.email')
    const fieldValue = field.split('.').reduce((obj, key) => obj?.[key], item);
    
    if (fieldValue) {
      const fieldText = String(fieldValue);
      
      if (fuzzyMatch(fieldText, searchTerm, threshold)) {
        const score = calculateRelevanceScore(fieldText, searchTerm);
        
        if (score > maxScore) {
          maxScore = score;
        }
        
        matchedFields.push(field);
      }
    }
  });
  
  return {
    matches: matchedFields.length > 0,
    score: maxScore,
    matchedFields
  };
}

/**
 * Filter and rank search results
 * @param {Array} items - Items to search through
 * @param {string[]} searchFields - Fields to search in
 * @param {string} searchTerm - Search term
 * @param {number} threshold - Similarity threshold (0-1)
 * @returns {Array} - Filtered and ranked items
 */
export function filterAndRankResults(items, searchFields, searchTerm, threshold = 0.7) {
  if (!searchTerm || !items || items.length === 0) {
    return items;
  }
  
  // Filter and score items
  const scoredItems = items
    .map(item => {
      const searchResult = multiFieldSearch(item, searchFields, searchTerm, threshold);
      return {
        ...item,
        _searchScore: searchResult.score,
        _matchedFields: searchResult.matchedFields,
        _matches: searchResult.matches
      };
    })
    .filter(item => item._matches);
  
  // Sort by relevance score (highest first)
  scoredItems.sort((a, b) => b._searchScore - a._searchScore);
  
  // Remove internal search fields before returning
  return scoredItems.map(item => {
    const { _searchScore, _matchedFields, _matches, ...cleanItem } = item;
    return cleanItem;
  });
}

/**
 * Build PostgreSQL full-text search query for Supabase
 * @param {string} searchTerm - Search term
 * @returns {string} - Formatted search query for tsquery
 */
export function buildFullTextSearchQuery(searchTerm) {
  if (!searchTerm) return '';
  
  // Clean and prepare search term
  const cleaned = searchTerm
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove special characters
    .replace(/\s+/g, ' '); // Normalize whitespace
  
  // Split into words and add prefix matching
  const words = cleaned.split(' ').filter(Boolean);
  
  // Create OR query with prefix matching for partial word matches
  // Example: "john tech" becomes "john:* | tech:*"
  return words.map(word => `${word}:*`).join(' | ');
}

/**
 * Create ILIKE pattern for PostgreSQL partial matching
 * @param {string} searchTerm - Search term
 * @returns {string} - ILIKE pattern
 */
export function createILikePattern(searchTerm) {
  if (!searchTerm) return '';
  return `%${searchTerm}%`;
}

/**
 * Generate multiple search patterns for comprehensive matching
 * @param {string} searchTerm - Search term
 * @returns {object} - Object with different search patterns
 */
export function generateSearchPatterns(searchTerm) {
  if (!searchTerm) return null;
  
  const cleaned = searchTerm.trim();
  const lower = cleaned.toLowerCase();
  
  return {
    exact: cleaned,
    lower: lower,
    ilike: `%${cleaned}%`,
    startsWith: `${cleaned}%`,
    words: cleaned.split(/\s+/).filter(Boolean),
    fullTextQuery: buildFullTextSearchQuery(cleaned)
  };
}
