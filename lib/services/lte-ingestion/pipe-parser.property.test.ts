/**
 * Property-Based Tests for Pipe-Delimited Field Parser
 * 
 * Tag: Feature: lte-course-upload-functional, Property 2: Pipe-Delimited Parsing Correctness
 * 
 * **Validates: Requirements 1.6, FR-1**
 * 
 * Property 2: Pipe-Delimited Parsing Correctness
 * For any pipe-delimited text field (split by `|`), the parser should split 
 * into an array of trimmed non-empty strings, and reject invalid formats 
 * (empty sections, word "PIPE", leading/trailing pipes).
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { splitPipe, parseKeyValues } from './pipe-parser';

describe('Property 2: Pipe-Delimited Parsing Correctness', () => {
  
  describe('splitPipe() - Valid pipe-delimited text properties', () => {
    
    it('should split valid pipe-delimited text into non-empty trimmed strings', () => {
      // Generator for valid pipe-delimited text
      const validPipeText = fc.array(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => {
          const trimmed = s.trim();
          // Exclude: empty after trim, contains pipes, or is the word "PIPE"
          return trimmed.length > 0 
            && !s.includes('|') 
            && !/(?:^|\s)PIPE(?:\s|$)/i.test(s);
        }),
        { minLength: 1, maxLength: 10 }
      ).map(items => items.join(' | '));
      
      fc.assert(
        fc.property(validPipeText, (text) => {
          const result = splitPipe(text);
          
          // All results should be non-empty strings
          expect(result.length).toBeGreaterThan(0);
          expect(result.every(item => typeof item === 'string' && item.length > 0)).toBe(true);
          
          // All results should be trimmed (no leading/trailing whitespace)
          expect(result.every(item => item === item.trim())).toBe(true);
          
          // The number of items should match the number of pipe separators + 1
          const pipeCount = (text.match(/\|/g) || []).length;
          expect(result.length).toBe(pipeCount + 1);
        }),
        { numRuns: 100 }
      );
    });
    
    it('should produce idempotent results - repeated calls return same output', () => {
      const validPipeText = fc.array(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => {
          const trimmed = s.trim();
          return trimmed.length > 0 
            && !s.includes('|') 
            && !/(?:^|\s)PIPE(?:\s|$)/i.test(s);
        }),
        { minLength: 1, maxLength: 5 }
      ).map(items => items.join(' | '));
      
      fc.assert(
        fc.property(validPipeText, (text) => {
          const result1 = splitPipe(text);
          const result2 = splitPipe(text);
          
          expect(result1).toEqual(result2);
        }),
        { numRuns: 100 }
      );
    });
    
    it('should preserve item order from input text', () => {
      const orderedItems = fc.array(
        fc.integer({ min: 1, max: 1000 }).map(n => `item${n}`),
        { minLength: 2, maxLength: 10 }
      );
      
      fc.assert(
        fc.property(orderedItems, (items) => {
          const text = items.join(' | ');
          const result = splitPipe(text);
          
          expect(result).toEqual(items);
        }),
        { numRuns: 100 }
      );
    });
  });
  
  describe('splitPipe() - Invalid format rejection properties', () => {
    
    it('should reject text containing the word PIPE (case-insensitive)', () => {
      const textWithPipe = fc.record({
        prefix: fc.array(fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), { maxLength: 2 }),
        pipeWord: fc.constantFrom('PIPE', 'Pipe', 'pipe', 'PiPe'),
        suffix: fc.array(fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), { maxLength: 2 }),
      }).map(({ prefix, pipeWord, suffix }) => 
        [...prefix, pipeWord, ...suffix].join(' | ')
      );
      
      fc.assert(
        fc.property(textWithPipe, (text) => {
          expect(() => splitPipe(text)).toThrow('Use the | symbol');
        }),
        { numRuns: 50 }
      );
    });
    
    it('should reject text with empty sections (leading/trailing/consecutive pipes)', () => {
      const validItem = fc.string({ minLength: 1, maxLength: 20 }).filter(s => {
        const trimmed = s.trim();
        return trimmed.length > 0 && !s.includes('|');
      });
      
      const textWithEmptySection = fc.oneof(
        // Leading pipe
        validItem.map(item => `| ${item}`),
        // Trailing pipe
        validItem.map(item => `${item} |`),
        // Consecutive pipes
        fc.tuple(validItem, validItem).map(([a, b]) => `${a} || ${b}`),
        // Multiple consecutive pipes
        fc.tuple(validItem, validItem).map(([a, b]) => `${a} ||| ${b}`)
      );
      
      fc.assert(
        fc.property(textWithEmptySection, (text) => {
          expect(() => splitPipe(text)).toThrow('empty section');
        }),
        { numRuns: 50 }
      );
    });
    
    it('should reject text with whitespace-only sections', () => {
      const validItem = fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0 && !s.includes('|'));
      const whitespace = fc.constantFrom('   ', '\t', '  \t  ');
      
      const textWithWhitespaceSection = fc.tuple(validItem, whitespace, validItem)
        .map(([a, ws, b]) => `${a} | ${ws} | ${b}`);
      
      fc.assert(
        fc.property(textWithWhitespaceSection, (text) => {
          expect(() => splitPipe(text)).toThrow('empty section');
        }),
        { numRuns: 50 }
      );
    });
  });
  
  describe('parseKeyValues() - Key-value parsing properties', () => {
    
    it('should parse valid key:value pairs into object with normalized keys', () => {
      const keyValuePair = fc.record({
        key: fc.string({ minLength: 1, maxLength: 20 })
          .filter(s => /^[A-Za-z][A-Za-z0-9_ ]*$/.test(s)),
        value: fc.string({ minLength: 1, maxLength: 50 })
          .filter(s => s.trim().length > 0 && !s.includes('|')),
      });
      
      const keyValuePairs = fc.array(keyValuePair, { minLength: 1, maxLength: 5 })
        .filter(pairs => {
          // Ensure no duplicate keys after normalization
          const normalizedKeys = pairs.map(p => 
            p.key.trim().toLowerCase().replace(/\s+/g, '_')
          );
          return new Set(normalizedKeys).size === normalizedKeys.length;
        });
      
      fc.assert(
        fc.property(keyValuePairs, (pairs) => {
          const text = pairs.map(({ key, value }) => `${key}: ${value}`).join(' | ');
          const result = parseKeyValues(text);
          
          // Should return an object
          expect(typeof result).toBe('object');
          expect(result).not.toBeNull();
          
          // Should have correct number of keys
          expect(Object.keys(result).length).toBe(pairs.length);
          
          // All keys should be normalized (lowercase, underscores)
          Object.keys(result).forEach(key => {
            expect(key).toMatch(/^[a-z][a-z0-9_]*$/);
          });
          
          // All values should be non-empty strings
          Object.values(result).forEach(value => {
            expect(typeof value).toBe('string');
            expect((value as string).length).toBeGreaterThan(0);
          });
        }),
        { numRuns: 100 }
      );
    });
    
    it('should reject duplicate keys (case-insensitive)', () => {
      const key = fc.string({ minLength: 1, maxLength: 10 })
        .filter(s => /^[A-Za-z][A-Za-z0-9_]*$/.test(s));
      const value = fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0);
      
      const duplicateKeyPairs = fc.tuple(key, value, value, fc.constantFrom('same', 'Same', 'SAME'))
        .map(([k, v1, v2, casing]) => `${k}: ${v1} | ${casing === 'same' ? k : casing}: ${v2}`);
      
      fc.assert(
        fc.property(duplicateKeyPairs, (text) => {
          expect(() => parseKeyValues(text)).toThrow('appears more than once');
        }),
        { numRuns: 50 }
      );
    });
    
    it('should reject sections with blank values', () => {
      const key = fc.string({ minLength: 1, maxLength: 10 })
        .filter(s => /^[A-Za-z][A-Za-z0-9_]*$/.test(s));
      const blankValue = fc.constantFrom('', '   ', '\t', '  \t  ');
      
      const keyWithBlankValue = fc.tuple(key, blankValue)
        .map(([k, v]) => `${k}:${v}`);
      
      fc.assert(
        fc.property(keyWithBlankValue, (text) => {
          expect(() => parseKeyValues(text)).toThrow('is blank');
        }),
        { numRuns: 50 }
      );
    });
    
    it('should normalize keys consistently - same key always produces same normalized form', () => {
      const keyVariations = fc.record({
        base: fc.string({ minLength: 1, maxLength: 10 })
          .filter(s => /^[A-Za-z][A-Za-z0-9_]*$/.test(s)),
        value: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
      }).chain(({ base, value }) => {
        const variations = [
          base,
          base.toUpperCase(),
          base.toLowerCase(),
          base.charAt(0).toUpperCase() + base.slice(1).toLowerCase(),
        ];
        return fc.constantFrom(...variations).map(variant => ({
          key: variant,
          value,
        }));
      });
      
      fc.assert(
        fc.property(keyVariations, ({ key, value }) => {
          const text = `${key}: ${value}`;
          const result = parseKeyValues(text);
          const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, '_');
          
          expect(result).toHaveProperty(normalizedKey);
          expect(result[normalizedKey]).toBe(value.trim());
        }),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Round-trip properties', () => {
    
    it('should preserve information - joining split results should produce equivalent text', () => {
      const validPipeText = fc.array(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => {
          const trimmed = s.trim();
          return trimmed.length > 0 && !s.includes('|') && !/(?:^|\s)PIPE(?:\s|$)/i.test(s);
        }),
        { minLength: 1, maxLength: 5 }
      );
      
      fc.assert(
        fc.property(validPipeText, (items) => {
          const originalText = items.join(' | ');
          const parsed = splitPipe(originalText);
          const reconstructed = parsed.join(' | ');
          
          // Trimmed versions should be equivalent
          expect(splitPipe(reconstructed)).toEqual(items.map(s => s.trim()));
        }),
        { numRuns: 100 }
      );
    });
  });
});
