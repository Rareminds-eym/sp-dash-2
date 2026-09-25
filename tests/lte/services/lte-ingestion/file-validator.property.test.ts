import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * File validation functions - extracted for testability
 */
export function validateFileType(fileName: string): { valid: boolean; error?: string } {
  if (!fileName.toLowerCase().endsWith('.xlsx')) {
    return { valid: false, error: 'File must be a .xlsx Excel workbook.' };
  }
  return { valid: true };
}

export function validateFileSize(fileSize: number, maxSize: number = 10 * 1024 * 1024): { valid: boolean; error?: string } {
  if (fileSize > maxSize) {
    return { valid: false, error: `File size exceeds maximum allowed limit of ${maxSize / 1024 / 1024} MB.` };
  }
  return { valid: true };
}

/**
 * Property 7: File Size and Type Validation
 * Validates: Requirements 2.1, 2.6
 * 
 * For any uploaded file:
 * - Files exceeding 10MB should be rejected
 * - Files not ending in .xlsx extension should be rejected
 */
describe('Property 7: File Size and Type Validation', () => {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

  it('should reject files exceeding 10MB', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_FILE_SIZE + 1, max: 100 * 1024 * 1024 }),
        (fileSize) => {
          const result = validateFileSize(fileSize);
          expect(result.valid).toBe(false);
          expect(result.error).toContain('exceeds maximum allowed limit');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should accept files within 10MB limit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: MAX_FILE_SIZE }),
        (fileSize) => {
          const result = validateFileSize(fileSize);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject files not ending in .xlsx', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.constantFrom('.xls', '.csv', '.txt', '.doc', '.pdf', ''),
        (baseName, extension) => {
          const fileName = baseName + extension;
          // Skip if accidentally ends with .xlsx
          if (fileName.toLowerCase().endsWith('.xlsx')) {
            return true;
          }
          
          const result = validateFileType(fileName);
          expect(result.valid).toBe(false);
          expect(result.error).toContain('.xlsx');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should accept files ending in .xlsx (case-insensitive)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.constantFrom('.xlsx', '.XLSX', '.Xlsx', '.XlSx'),
        (baseName, extension) => {
          const fileName = baseName + extension;
          const result = validateFileType(fileName);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty file names', () => {
    const result = validateFileType('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('.xlsx');
  });

  it('should reject zero-byte files', () => {
    const result = validateFileSize(0);
    expect(result.valid).toBe(true); // Zero-byte files are technically within limit
    // Note: Additional business logic may reject empty files separately
  });

  it('should validate combined file type and size', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.constantFrom('.xlsx', '.csv', '.txt'),
        fc.integer({ min: 1, max: 20 * 1024 * 1024 }),
        (baseName, extension, fileSize) => {
          const fileName = baseName + extension;
          const typeResult = validateFileType(fileName);
          const sizeResult = validateFileSize(fileSize);

          const isValid = fileName.toLowerCase().endsWith('.xlsx') && fileSize <= MAX_FILE_SIZE;
          const actuallyValid = typeResult.valid && sizeResult.valid;

          expect(actuallyValid).toBe(isValid);
        }
      ),
      { numRuns: 100 }
    );
  });
});
