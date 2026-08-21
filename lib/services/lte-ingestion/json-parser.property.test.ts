/**
 * Property-Based Tests for JSON Field Round-Trip
 * 
 * Tag: Feature: lte-course-upload-functional, Property 3: JSON Field Round-Trip
 * 
 * **Validates: Requirements 1.6, FR-1**
 * 
 * Property 3: JSON Field Round-Trip
 * For any valid JSON field value, parsing then serializing should produce 
 * an equivalent structure (either the same JSON object/array, or the same 
 * semantic content for pipe-delimited key:value pairs).
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { normalizeJsonValue } from './json-parser';

describe('Property 3: JSON Field Round-Trip', () => {
  
  describe('JSON value round-trip properties', () => {
    
    it('should preserve JSON objects through parse-serialize cycle', () => {
      const jsonObject = fc.dictionary(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
        fc.oneof(
          fc.string(),
          fc.integer(),
          fc.double(),
          fc.boolean(),
          fc.constant(null)
        ),
        { minKeys: 1, maxKeys: 10 }
      );
      
      fc.assert(
        fc.property(jsonObject, (obj) => {
          const jsonString = JSON.stringify(obj);
          const parsed = normalizeJsonValue('table', 'column', jsonString);
          const reserialized = JSON.stringify(parsed);
          const reparsed = JSON.parse(reserialized);
          
          expect(reparsed).toEqual(obj);
        }),
        { numRuns: 100 }
      );
    });
    
    it('should preserve JSON arrays through parse-serialize cycle', () => {
      const jsonArray = fc.array(
        fc.oneof(
          fc.string(),
          fc.integer(),
          fc.double(),
          fc.boolean(),
          fc.constant(null)
        ),
        { minLength: 1, maxLength: 10 }
      );
      
      fc.assert(
        fc.property(jsonArray, (arr) => {
          const jsonString = JSON.stringify(arr);
          const parsed = normalizeJsonValue('table', 'column', jsonString);
          const reserialized = JSON.stringify(parsed);
          const reparsed = JSON.parse(reserialized);
          
          expect(reparsed).toEqual(arr);
        }),
        { numRuns: 100 }
      );
    });
    
    it('should preserve nested JSON structures', () => {
      const nestedJson = fc.oneof(
        // Nested objects
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
          fc.record({
            value: fc.string(),
            count: fc.integer(),
          }),
          { minKeys: 1, maxKeys: 5 }
        ),
        // Nested arrays
        fc.array(
          fc.record({
            id: fc.integer(),
            name: fc.string(),
          }),
          { minLength: 1, maxLength: 5 }
        )
      );
      
      fc.assert(
        fc.property(nestedJson, (data) => {
          const jsonString = JSON.stringify(data);
          const parsed = normalizeJsonValue('table', 'column', jsonString);
          const reserialized = JSON.stringify(parsed);
          const reparsed = JSON.parse(reserialized);
          
          expect(reparsed).toEqual(data);
        }),
        { numRuns: 50 }
      );
    });
  });
  
  describe('Pipe-delimited array round-trip properties', () => {
    
    it('should preserve pipe-delimited arrays for PIPE_JSON_COLUMNS', () => {
      const pipeArray = fc.array(
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => {
          const trimmed = s.trim();
          return trimmed.length > 0 && !s.includes('|') && !/(?:^|\s)PIPE(?:\s|$)/i.test(s);
        }),
        { minLength: 1, maxLength: 10 }
      );
      
      // Test with tables/columns that use pipe arrays
      const tables = [
        ['levels', 'observable_behavior'],
        ['levels', 'example_outputs'],
        ['skills', 'tags'],
      ];
      
      fc.assert(
        fc.property(pipeArray, fc.constantFrom(...tables), (items, [table, column]) => {
          const pipeText = items.join(' | ');
          const parsed = normalizeJsonValue(table, column, pipeText);
          
          // Should parse to array
          expect(Array.isArray(parsed)).toBe(true);
          expect(parsed).toEqual(items.map(s => s.trim()));
          
          // Reconstruct and parse again
          const reconstructed = parsed.join(' | ');
          const reparsed = normalizeJsonValue(table, column, reconstructed);
          
          expect(reparsed).toEqual(parsed);
        }),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Pipe-delimited key:value round-trip properties', () => {
    
    it('should preserve key:value pairs through parse-reconstruct-parse cycle', () => {
      const keyValuePair = fc.record({
        key: fc.string({ minLength: 1, maxLength: 20 })
          .filter(s => /^[A-Za-z][A-Za-z0-9_ ]*$/.test(s)),
        value: fc.string({ minLength: 1, maxLength: 50 })
          .filter(s => s.trim().length > 0 && !s.includes('|')),
      });
      
      const keyValuePairs = fc.array(keyValuePair, { minLength: 1, maxLength: 5 })
        .filter(pairs => {
          const normalizedKeys = pairs.map(p => 
            p.key.trim().toLowerCase().replace(/\s+/g, '_')
          );
          return new Set(normalizedKeys).size === normalizedKeys.length;
        });
      
      fc.assert(
        fc.property(keyValuePairs, (pairs) => {
          const originalText = pairs.map(({ key, value }) => `${key}: ${value}`).join(' | ');
          
          // Parse to object
          const parsed = normalizeJsonValue('modules_content', 'curriculum_reference', originalText);
          expect(typeof parsed).toBe('object');
          expect(parsed).not.toBeNull();
          
          // Reconstruct and parse again
          const reconstructed = Object.entries(parsed as Record<string, string>)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ');
          const reparsed = normalizeJsonValue('modules_content', 'curriculum_reference', reconstructed);
          
          expect(reparsed).toEqual(parsed);
        }),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Idempotency properties', () => {
    
    it('should be idempotent - parsing already-parsed value returns same value', () => {
      const jsonValue = fc.oneof(
        fc.string(),
        fc.integer(),
        fc.double(),
        fc.boolean(),
        fc.constant(null),
        fc.array(fc.string(), { minLength: 0, maxLength: 5 }),
        fc.dictionary(fc.string(), fc.string(), { minKeys: 0, maxKeys: 5 })
      );
      
      fc.assert(
        fc.property(jsonValue, (value) => {
          const result1 = normalizeJsonValue('table', 'column', value);
          const result2 = normalizeJsonValue('table', 'column', result1);
          
          expect(result2).toEqual(result1);
        }),
        { numRuns: 100 }
      );
    });
    
    it('should produce consistent results - repeated parsing returns same output', () => {
      const mixedValue = fc.oneof(
        fc.string(),
        fc.jsonValue(),
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 })
          .map(items => items.join(' | '))
      );
      
      fc.assert(
        fc.property(mixedValue, (value) => {
          const result1 = normalizeJsonValue('table', 'column', value);
          const result2 = normalizeJsonValue('table', 'column', value);
          
          expect(result2).toEqual(result1);
        }),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Special case properties', () => {
    
    it('should handle null/undefined/empty consistently', () => {
      const emptyValues = fc.constantFrom(null, undefined, '', '   ');
      
      fc.assert(
        fc.property(emptyValues, (value) => {
          const result = normalizeJsonValue('table', 'column', value);
          
          // Should return the value as-is (or trimmed for strings)
          if (value === null) {
            expect(result).toBeNull();
          } else if (value === undefined) {
            expect(result).toBeUndefined();
          } else {
            expect(typeof result).toBe('string');
          }
        }),
        { numRuns: 50 }
      );
    });
    
    it('should preserve special characters in values', () => {
      const specialCharStrings = fc.string({ minLength: 1, maxLength: 50 }).filter(s => {
        const trimmed = s.trim();
        return trimmed.length > 0 && !s.includes('|');
      });
      
      fc.assert(
        fc.property(specialCharStrings, (str) => {
          // For non-pipe text, it should return as-is
          const result = normalizeJsonValue('table', 'column', str);
          
          // If it's not parseable as JSON or pipe text, should return original
          if (typeof result === 'string') {
            expect(result).toBe(str);
          }
        }),
        { numRuns: 100 }
      );
    });
    
    it('should handle multiline text correctly', () => {
      const multilineText = fc.array(
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        { minLength: 2, maxLength: 5 }
      ).map(lines => lines.join('\n'));
      
      fc.assert(
        fc.property(multilineText, (text) => {
          const result = normalizeJsonValue('table', 'column', text);
          
          // If returned as-is (not parsed), should preserve newlines
          if (typeof result === 'string') {
            expect(result).toBe(text);
          }
        }),
        { numRuns: 50 }
      );
    });
  });
  
  describe('Type preservation properties', () => {
    
    it('should preserve types through round-trip - objects stay objects, arrays stay arrays', () => {
      const typedValue = fc.oneof(
        fc.record({ type: fc.constant('object'), value: fc.dictionary(fc.string(), fc.string()) }),
        fc.record({ type: fc.constant('array'), value: fc.array(fc.string()) }),
        fc.record({ type: fc.constant('string'), value: fc.string() }),
        fc.record({ type: fc.constant('number'), value: fc.integer() }),
        fc.record({ type: fc.constant('boolean'), value: fc.boolean() })
      );
      
      fc.assert(
        fc.property(typedValue, ({ type, value }) => {
          const jsonString = JSON.stringify(value);
          const parsed = normalizeJsonValue('table', 'column', jsonString);
          
          // Type should be preserved
          if (type === 'object' && value !== null) {
            expect(typeof parsed).toBe('object');
            expect(Array.isArray(parsed)).toBe(false);
          } else if (type === 'array') {
            expect(Array.isArray(parsed)).toBe(true);
          } else if (type === 'string') {
            expect(typeof parsed).toBe('string');
          } else if (type === 'number') {
            expect(typeof parsed).toBe('number');
          } else if (type === 'boolean') {
            expect(typeof parsed).toBe('boolean');
          }
        }),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Table-specific round-trip properties', () => {
    
    it('should preserve levels.problem_statement structure', () => {
      const problemStatement = fc.record({
        title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0 && !s.includes('|')),
        description: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0 && !s.includes('|')),
      });
      
      fc.assert(
        fc.property(problemStatement, ({ title, description }) => {
          const pipeText = `title: ${title} | description: ${description}`;
          const parsed = normalizeJsonValue('levels', 'problem_statement', pipeText);
          
          expect(parsed).toEqual({
            title: title.trim(),
            description: description.trim(),
          });
          
          // Round-trip through JSON
          const jsonString = JSON.stringify(parsed);
          const reparsed = JSON.parse(jsonString);
          
          expect(reparsed).toEqual(parsed);
        }),
        { numRuns: 100 }
      );
    });
    
    it('should preserve modules.tools wrapped structure', () => {
      const tools = fc.array(
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => {
          const trimmed = s.trim();
          return trimmed.length > 0 && !s.includes('|');
        }),
        { minLength: 1, maxLength: 5 }
      );
      
      fc.assert(
        fc.property(tools, (items) => {
          const pipeText = items.join(' | ');
          const parsed = normalizeJsonValue('modules', 'tools', pipeText);
          
          expect(parsed).toEqual({
            items: items.map(s => s.trim()),
          });
          
          // Round-trip through JSON
          const jsonString = JSON.stringify(parsed);
          const reparsed = JSON.parse(jsonString);
          
          expect(reparsed).toEqual(parsed);
        }),
        { numRuns: 100 }
      );
    });
  });
});
