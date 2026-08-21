/**
 * Property-Based Tests for Header Normalization
 * 
 * Tag: Feature: lte-course-upload-functional, Property 1: Header Normalization Consistency
 * 
 * **Validates: Requirements 1.6, FR-1**
 * 
 * Property 1: Header Normalization Consistency
 * For any Excel worksheet with headers, applying the FRIENDLY_HEADER_ALIASES 
 * mapping and normalization rules should produce consistent column names that 
 * match the database schema.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { normalizeHeader, FRIENDLY_HEADER_ALIASES } from './header-normalizer';

describe('Header Normalization Property Tests', () => {
  
  it('Property 1: Header Normalization Consistency - same input always produces same output', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (header) => {
          // Apply normalization twice
          const result1 = normalizeHeader(header);
          const result2 = normalizeHeader(header);
          
          // Should always get the same result
          expect(result1).toBe(result2);
        }
      ),
      { numRuns: 100 }
    );
  });
  // Tag: Feature: lte-course-upload-functional, Property 1: Header Normalization Consistency

  it('Property 1: Header Normalization Consistency - FRIENDLY_HEADER_ALIASES mappings work correctly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.keys(FRIENDLY_HEADER_ALIASES)),
        (aliasKey) => {
          const normalized = normalizeHeader(aliasKey);
          const expected = FRIENDLY_HEADER_ALIASES[aliasKey];
          
          // Should map to the expected value
          expect(normalized).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });
  // Tag: Feature: lte-course-upload-functional, Property 1: Header Normalization Consistency

  it('Property 1: Header Normalization Consistency - pipe suffix removal works', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('(|)') && s.trim().length > 0),
        (baseHeader) => {
          // Add pipe suffix
          const headerWithPipe = `${baseHeader} (|)`;
          const headerWithSpacedPipe = `${baseHeader}(|)`;
          const headerWithExtraSpaces = `${baseHeader}  (|)  `;
          
          // All should normalize to the same result after removing the pipe suffix
          const normalized = normalizeHeader(baseHeader.trim());
          const normalizedWithPipe = normalizeHeader(headerWithPipe);
          const normalizedWithSpacedPipe = normalizeHeader(headerWithSpacedPipe);
          const normalizedWithExtraSpaces = normalizeHeader(headerWithExtraSpaces);
          
          // Check if the base is an alias - if so, expect the alias value
          const cleanedBase = baseHeader.trim().replace(/\s+/g, ' ');
          if (Object.prototype.hasOwnProperty.call(FRIENDLY_HEADER_ALIASES, cleanedBase)) {
            const expectedValue = FRIENDLY_HEADER_ALIASES[cleanedBase];
            expect(normalizedWithPipe).toBe(expectedValue);
            expect(normalizedWithSpacedPipe).toBe(expectedValue);
            expect(normalizedWithExtraSpaces).toBe(expectedValue);
          } else {
            // Otherwise, they should all normalize to the trimmed base
            expect(normalizedWithPipe).toBe(normalized);
            expect(normalizedWithSpacedPipe).toBe(normalized);
            expect(normalizedWithExtraSpaces).toBe(normalized);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  // Tag: Feature: lte-course-upload-functional, Property 1: Header Normalization Consistency

  it('Property 1: Header Normalization Consistency - whitespace normalization', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.array(fc.constantFrom(' ', '  ', '\t', '\n'), { minLength: 0, maxLength: 3 }),
        (baseHeader, spaces) => {
          // Skip if baseHeader is all whitespace
          if (baseHeader.trim().length === 0) return true;
          
          // Add various whitespace
          const headerWithLeadingSpaces = spaces.join('') + baseHeader;
          const headerWithTrailingSpaces = baseHeader + spaces.join('');
          const headerWithBothSpaces = spaces.join('') + baseHeader + spaces.join('');
          
          // All should normalize to the same result
          const normalized1 = normalizeHeader(headerWithLeadingSpaces);
          const normalized2 = normalizeHeader(headerWithTrailingSpaces);
          const normalized3 = normalizeHeader(headerWithBothSpaces);
          
          // All should produce the same result
          expect(normalized1).toBe(normalized2);
          expect(normalized2).toBe(normalized3);
        }
      ),
      { numRuns: 100 }
    );
  });
  // Tag: Feature: lte-course-upload-functional, Property 1: Header Normalization Consistency

  it('Property 1: Header Normalization Consistency - idempotence property', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (header) => {
          // Normalizing twice should be the same as normalizing once
          const normalized = normalizeHeader(header);
          const normalizedTwice = normalizeHeader(normalized);
          
          expect(normalized).toBe(normalizedTwice);
        }
      ),
      { numRuns: 100 }
    );
  });
  // Tag: Feature: lte-course-upload-functional, Property 1: Header Normalization Consistency

  it('Property 1: Header Normalization Consistency - multiple whitespace collapse', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 5 }),
        fc.integer({ min: 1, max: 5 }),
        (words, spacesCount) => {
          // Skip if any word is all whitespace
          if (words.some(w => w.trim().length === 0)) return true;
          
          // Create header with multiple spaces between words
          const headerWithMultipleSpaces = words.join(' '.repeat(spacesCount));
          const headerWithSingleSpaces = words.join(' ');
          
          // Both should normalize to the same result
          const normalized1 = normalizeHeader(headerWithMultipleSpaces);
          const normalized2 = normalizeHeader(headerWithSingleSpaces);
          
          expect(normalized1).toBe(normalized2);
        }
      ),
      { numRuns: 100 }
    );
  });
  // Tag: Feature: lte-course-upload-functional, Property 1: Header Normalization Consistency
});

describe('Header Normalization Unit Tests', () => {
  
  it('should normalize known aliases correctly', () => {
    expect(normalizeHeader('Id')).toBe('id');
    expect(normalizeHeader('Industry Challenge')).toBe('industry_challenge');
    expect(normalizeHeader('Industry_challenge')).toBe('industry_challenge');
    expect(normalizeHeader('Prerequisites')).toBe('prerequisites');
    expect(normalizeHeader('whatYoullLearn')).toBe('what_youll_learn');
    expect(normalizeHeader("What You'll Learn")).toBe('what_youll_learn');
  });

  it('should remove pipe suffix from headers', () => {
    expect(normalizeHeader('allowed_file_types (|)')).toBe('allowed_file_types');
    expect(normalizeHeader('course_problem_statement (|)')).toBe('problem_statement');
    expect(normalizeHeader('curriculum_reference (|)')).toBe('curriculum_reference');
    expect(normalizeHeader('some_field (|)')).toBe('some_field');
    expect(normalizeHeader('some_field(|)')).toBe('some_field');
  });

  it('should trim and normalize whitespace', () => {
    expect(normalizeHeader('  header  ')).toBe('header');
    expect(normalizeHeader('header   with   spaces')).toBe('header with spaces');
    expect(normalizeHeader('\theader\t')).toBe('header');
  });

  it('should handle combination of alias and pipe suffix', () => {
    expect(normalizeHeader('allowed_file_types (|)')).toBe('allowed_file_types');
  });

  it('should be idempotent', () => {
    const testHeaders = [
      'Id',
      'allowed_file_types (|)',
      '  header with spaces  ',
      'Industry Challenge',
    ];

    testHeaders.forEach(header => {
      const normalized = normalizeHeader(header);
      const normalizedTwice = normalizeHeader(normalized);
      expect(normalized).toBe(normalizedTwice);
    });
  });

  it('should handle edge cases', () => {
    expect(normalizeHeader('   ')).toBe('');
    expect(normalizeHeader('a')).toBe('a');
    expect(normalizeHeader('(|)')).toBe('');
  });
});
