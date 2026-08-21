/**
 * Unit Tests for Pipe-Delimited Field Parser
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
import { 
  splitPipe, 
  parsePipeKeyValues, 
  parseArtifactInstructions,
  pipeTextHasKeyValues,
  normalizeJsonValue 
} from './json-parser';

describe('splitPipe() Unit Tests', () => {
  
  describe('Valid pipe-delimited text', () => {
    it('should split simple pipe-delimited text', () => {
      expect(splitPipe('item1 | item2 | item3')).toEqual(['item1', 'item2', 'item3']);
    });

    it('should trim whitespace from each segment', () => {
      expect(splitPipe('  item1  |  item2  |  item3  ')).toEqual(['item1', 'item2', 'item3']);
    });

    it('should handle single item without pipes', () => {
      expect(splitPipe('single item')).toEqual(['single item']);
    });

    it('should handle items with extra spaces', () => {
      expect(splitPipe('item one | item two | item three')).toEqual(['item one', 'item two', 'item three']);
    });

    it('should preserve internal spaces in items', () => {
      expect(splitPipe('first item | second item | third item')).toEqual(['first item', 'second item', 'third item']);
    });

    it('should handle text with special characters', () => {
      expect(splitPipe('item@1 | item#2 | item$3')).toEqual(['item@1', 'item#2', 'item$3']);
    });

    it('should handle text with numbers', () => {
      expect(splitPipe('123 | 456 | 789')).toEqual(['123', '456', '789']);
    });
  });

  describe('Invalid pipe-delimited text - empty sections', () => {
    it('should reject text starting with pipe', () => {
      expect(() => splitPipe('| item1 | item2')).toThrow('Pipe text contains an empty section');
    });

    it('should reject text ending with pipe', () => {
      expect(() => splitPipe('item1 | item2 |')).toThrow('Pipe text contains an empty section');
    });

    it('should reject text with double pipes', () => {
      expect(() => splitPipe('item1 || item2')).toThrow('Pipe text contains an empty section');
    });

    it('should reject text with only pipes', () => {
      expect(() => splitPipe('|')).toThrow('Pipe text contains an empty section');
    });

    it('should reject text with multiple consecutive pipes', () => {
      expect(() => splitPipe('item1 ||| item2')).toThrow('Pipe text contains an empty section');
    });

    it('should reject text with empty section after trimming', () => {
      expect(() => splitPipe('item1 |   | item2')).toThrow('Pipe text contains an empty section');
    });
  });

  describe('Invalid pipe-delimited text - word "PIPE"', () => {
    it('should reject text containing word "PIPE" in uppercase', () => {
      expect(() => splitPipe('item1 | PIPE | item2')).toThrow('Use the | symbol in Excel, not the word PIPE');
    });

    it('should reject text containing word "pipe" in lowercase', () => {
      expect(() => splitPipe('item1 | pipe | item2')).toThrow('Use the | symbol in Excel, not the word PIPE');
    });

    it('should reject text containing word "Pipe" in mixed case', () => {
      expect(() => splitPipe('item1 | Pipe | item2')).toThrow('Use the | symbol in Excel, not the word PIPE');
    });

    it('should reject text with PIPE at the start', () => {
      expect(() => splitPipe('PIPE item1 | item2')).toThrow('Use the | symbol in Excel, not the word PIPE');
    });

    it('should reject text with PIPE at the end', () => {
      expect(() => splitPipe('item1 | item2 PIPE')).toThrow('Use the | symbol in Excel, not the word PIPE');
    });

    it('should reject text with PIPE surrounded by spaces', () => {
      expect(() => splitPipe('item1 | PIPE | item2')).toThrow('Use the | symbol in Excel, not the word PIPE');
    });

    it('should allow text containing "pipe" as part of a word', () => {
      // "pipeline" or "bagpipe" should be allowed as they are different words
      expect(splitPipe('pipeline | bagpipe')).toEqual(['pipeline', 'bagpipe']);
    });
  });

  describe('Edge cases', () => {
    it('should handle very long items', () => {
      const longItem = 'a'.repeat(1000);
      expect(splitPipe(`${longItem} | item2`)).toEqual([longItem, 'item2']);
    });

    it('should handle items with newlines preserved in text', () => {
      expect(splitPipe('item1 | item2\nwith newline | item3')).toEqual(['item1', 'item2\nwith newline', 'item3']);
    });

    it('should trim leading and trailing whitespace from input', () => {
      expect(splitPipe('  item1 | item2 | item3  ')).toEqual(['item1', 'item2', 'item3']);
    });
  });
});

describe('parsePipeKeyValues() Unit Tests', () => {
  
  describe('Valid key:value pairs', () => {
    it('should parse simple key:value pairs', () => {
      expect(parsePipeKeyValues('key1: value1 | key2: value2')).toEqual({
        key1: 'value1',
        key2: 'value2'
      });
    });

    it('should normalize keys to lowercase with underscores', () => {
      expect(parsePipeKeyValues('First Key: value1 | Second Key: value2')).toEqual({
        first_key: 'value1',
        second_key: 'value2'
      });
    });

    it('should handle single key:value pair', () => {
      expect(parsePipeKeyValues('title: My Title')).toEqual({
        title: 'My Title'
      });
    });

    it('should handle values with colons', () => {
      expect(parsePipeKeyValues('url: https://example.com | time: 12:30')).toEqual({
        url: 'https://example.com',
        time: '12:30'
      });
    });

    it('should handle multi-line values', () => {
      expect(parsePipeKeyValues('description: Line 1\nLine 2 | title: My Title')).toEqual({
        description: 'Line 1\nLine 2',
        title: 'My Title'
      });
    });

    it('should trim whitespace from values', () => {
      expect(parsePipeKeyValues('key1:  value with spaces  | key2:  another value  ')).toEqual({
        key1: 'value with spaces',
        key2: 'another value'
      });
    });
  });

  describe('Invalid key:value pairs', () => {
    it('should reject section without key', () => {
      expect(() => parsePipeKeyValues('value without key | key2: value2')).toThrow('Pipe section has no key');
    });

    it('should reject section with blank value', () => {
      expect(() => parsePipeKeyValues('key1:  | key2: value2')).toThrow("Pipe section 'key1' is blank");
    });

    it('should reject duplicate keys', () => {
      expect(() => parsePipeKeyValues('title: First | title: Second')).toThrow("Pipe section 'title' appears more than once");
    });

    it('should reject section with only colon', () => {
      expect(() => parsePipeKeyValues(':')).toThrow('Pipe section has no key');
    });
  });
});

describe('parseArtifactInstructions() Unit Tests', () => {
  
  it('should parse standard artifact instructions format', () => {
    const input = 'Required: field1, field2 | Pass Criteria: criteria text | Critical Fail: fail text';
    const result = parseArtifactInstructions(input);
    
    expect(result.required_fields).toBe('field1, field2');
    expect(result.pass_criteria).toBe('criteria text');
    expect(result.critical_fail).toBe('fail text');
  });

  it('should handle "Required Fields:" variant', () => {
    const input = 'Required Fields: field1, field2 | Pass Criteria: criteria | Critical Fail: fail';
    const result = parseArtifactInstructions(input);
    
    expect(result.required_fields).toBe('field1, field2');
  });

  it('should handle "Required fields include" variant', () => {
    const input = 'Required fields include details | Pass Criteria: criteria | Critical Fail: fail';
    const result = parseArtifactInstructions(input);
    
    expect(result.required_fields).toBe('Required fields include details');
  });

  it('should handle underscore variants (pass_criteria, critical_fail)', () => {
    const input = 'Required: fields | pass_criteria: criteria | critical_fail: fail';
    const result = parseArtifactInstructions(input);
    
    expect(result.pass_criteria).toBe('criteria');
    expect(result.critical_fail).toBe('fail');
  });

  it('should use unmatched parts as required_fields if no required section found', () => {
    const input = 'Some unmatched text | Pass Criteria: criteria | Critical Fail: fail';
    const result = parseArtifactInstructions(input);
    
    expect(result.required_fields).toBe('Some unmatched text');
  });

  it('should handle missing sections gracefully', () => {
    const input = 'Required: fields only';
    const result = parseArtifactInstructions(input);
    
    expect(result.required_fields).toBe('fields only');
    expect(result.pass_criteria).toBe('');
    expect(result.critical_fail).toBe('');
  });
});

describe('pipeTextHasKeyValues() Unit Tests', () => {
  
  it('should return true for valid key:value format', () => {
    expect(pipeTextHasKeyValues('key1: value1 | key2: value2')).toBe(true);
  });

  it('should return false for plain pipe-delimited text', () => {
    expect(pipeTextHasKeyValues('item1 | item2 | item3')).toBe(false);
  });

  it('should return false for mixed format', () => {
    expect(pipeTextHasKeyValues('key1: value1 | plain item')).toBe(false);
  });

  it('should return false for invalid pipe format', () => {
    expect(pipeTextHasKeyValues('| key1: value1')).toBe(false);
  });
});

describe('normalizeJsonValue() Integration Tests', () => {
  
  it('should parse levels.problem_statement as key:value object', () => {
    const result = normalizeJsonValue('levels', 'problem_statement', 'title: Test | description: Test Desc');
    expect(result).toEqual({
      title: 'Test',
      description: 'Test Desc'
    });
  });

  it('should throw error if levels.problem_statement missing required keys', () => {
    expect(() => normalizeJsonValue('levels', 'problem_statement', 'title: Test')).toThrow('missing pipe section(s): description');
  });

  it('should parse levels.observable_behavior as array', () => {
    const result = normalizeJsonValue('levels', 'observable_behavior', 'behavior1 | behavior2 | behavior3');
    expect(result).toEqual(['behavior1', 'behavior2', 'behavior3']);
  });

  it('should parse levels.example_outputs as array', () => {
    const result = normalizeJsonValue('levels', 'example_outputs', 'output1 | output2 | output3');
    expect(result).toEqual(['output1', 'output2', 'output3']);
  });

  it('should parse skills.tags as array', () => {
    const result = normalizeJsonValue('skills', 'tags', 'tag1 | tag2 | tag3');
    expect(result).toEqual(['tag1', 'tag2', 'tag3']);
  });

  it('should parse modules.tools as wrapped object', () => {
    const result = normalizeJsonValue('modules', 'tools', 'tool1 | tool2 | tool3');
    expect(result).toEqual({
      items: ['tool1', 'tool2', 'tool3']
    });
  });

  it('should parse modules_content.curriculum_reference as key:value when applicable', () => {
    const result = normalizeJsonValue('modules_content', 'curriculum_reference', 'ref1: value1 | ref2: value2');
    expect(result).toEqual({
      ref1: 'value1',
      ref2: 'value2'
    });
  });

  it('should parse modules_content.curriculum_reference as array when no keys', () => {
    const result = normalizeJsonValue('modules_content', 'curriculum_reference', 'ref1 | ref2 | ref3');
    expect(result).toEqual(['ref1', 'ref2', 'ref3']);
  });

  it('should parse modules.support as key:value when applicable', () => {
    const result = normalizeJsonValue('modules', 'support', 'tip1: value1 | tip2: value2');
    expect(result).toEqual({
      tip1: 'value1',
      tip2: 'value2'
    });
  });

  it('should parse modules.support as fallback object when no keys', () => {
    const result = normalizeJsonValue('modules', 'support', 'plain support text');
    expect(result).toEqual({
      ai_support_tips: 'plain support text'
    });
  });

  it('should parse artifact_questions.instructions with special format', () => {
    const result = normalizeJsonValue(
      'artifact_questions', 
      'instructions', 
      'Required: field1 | Pass Criteria: criteria | Critical Fail: fail'
    );
    expect(result).toEqual({
      required_fields: 'field1',
      pass_criteria: 'criteria',
      critical_fail: 'fail'
    });
  });

  it('should parse JSON strings directly', () => {
    const result = normalizeJsonValue('table', 'column', '{"key": "value"}');
    expect(result).toEqual({ key: 'value' });
  });

  it('should return non-pipe text as-is', () => {
    const result = normalizeJsonValue('table', 'column', 'plain text');
    expect(result).toBe('plain text');
  });

  it('should handle null/undefined values', () => {
    expect(normalizeJsonValue('table', 'column', null)).toBeNull();
    expect(normalizeJsonValue('table', 'column', undefined)).toBeUndefined();
  });

  it('should handle empty strings', () => {
    expect(normalizeJsonValue('table', 'column', '')).toBe('');
    expect(normalizeJsonValue('table', 'column', '   ')).toBe('   ');
  });

  it('should handle already parsed objects', () => {
    const obj = { key: 'value' };
    expect(normalizeJsonValue('table', 'column', obj)).toEqual(obj);
  });
});
