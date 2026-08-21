/**
 * Unit tests for pipe-delimited field parser
 * 
 * Tests the splitPipe and parseKeyValues functions for:
 * - Valid pipe-delimited text parsing
 * - Empty section detection
 * - Leading/trailing pipe rejection
 * - Word "PIPE" rejection
 * - Key:value pair parsing
 */

import { describe, it, expect } from 'vitest';
import { splitPipe, parseKeyValues } from './pipe-parser';

describe('splitPipe', () => {
  describe('valid inputs', () => {
    it('should split simple pipe-delimited text', () => {
      expect(splitPipe('item1 | item2 | item3')).toEqual(['item1', 'item2', 'item3']);
    });

    it('should trim whitespace from each segment', () => {
      expect(splitPipe('  item1  |  item2  |  item3  ')).toEqual(['item1', 'item2', 'item3']);
    });

    it('should handle single item', () => {
      expect(splitPipe('single item')).toEqual(['single item']);
    });

    it('should handle items with internal spaces', () => {
      expect(splitPipe('first item | second item | third item')).toEqual([
        'first item',
        'second item',
        'third item'
      ]);
    });

    it('should handle mixed spacing', () => {
      expect(splitPipe('item1|item2 |item3| item4')).toEqual(['item1', 'item2', 'item3', 'item4']);
    });
  });

  describe('invalid inputs - empty sections', () => {
    it('should reject text with consecutive pipes', () => {
      expect(() => splitPipe('item1 || item2')).toThrow('empty section');
    });

    it('should reject text with leading pipe', () => {
      expect(() => splitPipe('| item1 | item2')).toThrow('empty section');
    });

    it('should reject text with trailing pipe', () => {
      expect(() => splitPipe('item1 | item2 |')).toThrow('empty section');
    });

    it('should reject text with only whitespace between pipes', () => {
      expect(() => splitPipe('item1 |   | item2')).toThrow('empty section');
    });

    it('should reject text with multiple consecutive pipes', () => {
      expect(() => splitPipe('item1 ||| item2')).toThrow('empty section');
    });
  });

  describe('invalid inputs - word PIPE', () => {
    it('should reject text containing the word PIPE', () => {
      expect(() => splitPipe('item1 | PIPE | item2')).toThrow('Use the | symbol');
    });

    it('should reject text containing PIPE in different case', () => {
      expect(() => splitPipe('item1 | Pipe | item2')).toThrow('Use the | symbol');
      expect(() => splitPipe('item1 | pipe | item2')).toThrow('Use the | symbol');
    });

    it('should reject PIPE at start', () => {
      expect(() => splitPipe('PIPE | item1')).toThrow('Use the | symbol');
    });

    it('should reject PIPE at end', () => {
      expect(() => splitPipe('item1 | PIPE')).toThrow('Use the | symbol');
    });

    it('should allow words containing "pipe" as substring', () => {
      // "pipeline" contains "pipe" but is not the word "PIPE"
      expect(splitPipe('pipeline | bagpipe')).toEqual(['pipeline', 'bagpipe']);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(() => splitPipe('')).toThrow();
    });

    it('should handle whitespace-only string', () => {
      expect(() => splitPipe('   ')).toThrow();
    });

    it('should handle items with special characters', () => {
      expect(splitPipe('item-1 | item_2 | item.3')).toEqual(['item-1', 'item_2', 'item.3']);
    });

    it('should handle items with numbers', () => {
      expect(splitPipe('123 | 456 | 789')).toEqual(['123', '456', '789']);
    });
  });
});

describe('parseKeyValues', () => {
  describe('valid inputs', () => {
    it('should parse simple key:value pairs', () => {
      expect(parseKeyValues('name: John | age: 30')).toEqual({
        name: 'John',
        age: '30'
      });
    });

    it('should normalize key names (lowercase, underscores)', () => {
      expect(parseKeyValues('First Name: John | Last Name: Doe')).toEqual({
        first_name: 'John',
        last_name: 'Doe'
      });
    });

    it('should handle single key:value pair', () => {
      expect(parseKeyValues('title: Manager')).toEqual({
        title: 'Manager'
      });
    });

    it('should trim whitespace from keys and values', () => {
      expect(parseKeyValues('  key1  :  value1  |  key2  :  value2  ')).toEqual({
        key1: 'value1',
        key2: 'value2'
      });
    });

    it('should handle values with special characters', () => {
      expect(parseKeyValues('email: test@example.com | url: https://example.com')).toEqual({
        email: 'test@example.com',
        url: 'https://example.com'
      });
    });

    it('should handle values with internal colons', () => {
      expect(parseKeyValues('time: 10:30:00 | ratio: 3:2')).toEqual({
        time: '10:30:00',
        ratio: '3:2'
      });
    });

    it('should handle multiline values', () => {
      const input = 'description: Line 1\nLine 2\nLine 3';
      const result = parseKeyValues(input);
      expect(result.description).toBe('Line 1\nLine 2\nLine 3');
    });
  });

  describe('invalid inputs - missing keys', () => {
    it('should reject sections without keys', () => {
      expect(() => parseKeyValues('value without key | name: John')).toThrow('has no key');
    });

    it('should reject sections with only colon', () => {
      expect(() => parseKeyValues(': value | name: John')).toThrow('has no key');
    });

    it('should reject sections with numeric keys', () => {
      expect(() => parseKeyValues('123: value')).toThrow('has no key');
    });
  });

  describe('invalid inputs - blank values', () => {
    it('should reject keys with empty values', () => {
      expect(() => parseKeyValues('name: | age: 30')).toThrow('is blank');
    });

    it('should reject keys with whitespace-only values', () => {
      expect(() => parseKeyValues('name:   | age: 30')).toThrow('is blank');
    });

    it('should reject keys with no colon value', () => {
      expect(() => parseKeyValues('name:')).toThrow('is blank');
    });
  });

  describe('invalid inputs - duplicate keys', () => {
    it('should reject duplicate keys', () => {
      expect(() => parseKeyValues('name: John | name: Jane')).toThrow('appears more than once');
    });

    it('should reject duplicate keys with different casing', () => {
      expect(() => parseKeyValues('Name: John | name: Jane')).toThrow('appears more than once');
    });

    it('should reject duplicate keys with different spacing', () => {
      expect(() => parseKeyValues('first name: John | First Name: Jane')).toThrow('appears more than once');
    });
  });

  describe('edge cases', () => {
    it('should handle keys with underscores', () => {
      expect(parseKeyValues('first_name: John')).toEqual({
        first_name: 'John'
      });
    });

    it('should handle keys with numbers', () => {
      expect(parseKeyValues('item1: value1 | item2: value2')).toEqual({
        item1: 'value1',
        item2: 'value2'
      });
    });

    it('should handle long values', () => {
      const longValue = 'a'.repeat(500);
      const result = parseKeyValues(`description: ${longValue}`);
      expect(result.description).toBe(longValue);
    });

    it('should handle values with pipe characters (from parent split)', () => {
      // Individual sections shouldn't have pipes after splitPipe
      // This is just to ensure parseKeyValues doesn't choke on complex values
      expect(parseKeyValues('formula: a=b+c | expression: x*y')).toEqual({
        formula: 'a=b+c',
        expression: 'x*y'
      });
    });
  });
});
