import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { LTEModule } from '@/types/lte-ingestion';

/**
 * Property 11: Module Sequence Order
 * For any set of modules in a course, when displayed in the UI,
 * modules should be ordered by module_no (index) in ascending order.
 * **Validates: Requirements 5.1**
 */

// Helper function that simulates the sorting logic used in the UI component
function sortModulesByIndex(modules: LTEModule[]): LTEModule[] {
  return [...modules].sort((a, b) => a.index - b.index);
}

// Arbitrary generator for LTE modules
const moduleArbitrary = (): fc.Arbitrary<LTEModule> =>
  fc.record({
    index: fc.integer({ min: 0, max: 20 }),
    title: fc.string({ minLength: 5, maxLength: 100 }),
    subtitle: fc.string({ minLength: 5, maxLength: 150 }),
    completionPercentage: fc.integer({ min: 0, max: 100 }),
    status: fc.constantFrom('locked', 'in_progress', 'completed') as fc.Arbitrary<'locked' | 'in_progress' | 'completed'>,
    stages: fc.constant([]), // Simplified for this test
    artifactPractices: fc.constant([]), // Simplified for this test
    contextDescription: fc.string({ minLength: 10, maxLength: 200 }),
  });

describe('Property 11: Module Sequence Order', () => {
  it('should maintain ascending order by module index after sorting', () => {
    fc.assert(
      fc.property(
        fc.array(moduleArbitrary(), { minLength: 1, maxLength: 15 }),
        (modules) => {
          const sorted = sortModulesByIndex(modules);

          // Property: For any consecutive pair, the first index should be <= the second index
          for (let i = 0; i < sorted.length - 1; i++) {
            expect(sorted[i].index).toBeLessThanOrEqual(sorted[i + 1].index);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve all modules during sorting', () => {
    fc.assert(
      fc.property(
        fc.array(moduleArbitrary(), { minLength: 1, maxLength: 15 }),
        (modules) => {
          const sorted = sortModulesByIndex(modules);

          // Property: Sorting should not lose or add modules
          expect(sorted.length).toBe(modules.length);

          // Property: All original modules should be present in sorted array
          for (const originalModule of modules) {
            const found = sorted.find((m) => 
              m.index === originalModule.index && 
              m.title === originalModule.title
            );
            expect(found).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle modules with duplicate indices correctly', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            index: fc.integer({ min: 0, max: 5 }), // Smaller range to force duplicates
            title: fc.string({ minLength: 5, maxLength: 50 }),
            subtitle: fc.string({ minLength: 5, maxLength: 100 }),
            completionPercentage: fc.integer({ min: 0, max: 100 }),
            status: fc.constantFrom('locked', 'in_progress', 'completed') as fc.Arbitrary<'locked' | 'in_progress' | 'completed'>,
            stages: fc.constant([]),
            artifactPractices: fc.constant([]),
            contextDescription: fc.string({ minLength: 10, maxLength: 100 }),
          }),
          { minLength: 2, maxLength: 10 }
        ),
        (modules) => {
          const sorted = sortModulesByIndex(modules);

          // Property: Even with duplicate indices, result should be stable and ordered
          for (let i = 0; i < sorted.length - 1; i++) {
            expect(sorted[i].index).toBeLessThanOrEqual(sorted[i + 1].index);
          }

          // Property: All modules should still be present
          expect(sorted.length).toBe(modules.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty module arrays', () => {
    const sorted = sortModulesByIndex([]);
    expect(sorted).toEqual([]);
  });

  it('should handle single-module arrays', () => {
    fc.assert(
      fc.property(moduleArbitrary(), (module) => {
        const sorted = sortModulesByIndex([module]);
        expect(sorted).toHaveLength(1);
        expect(sorted[0]).toEqual(module);
      }),
      { numRuns: 100 }
    );
  });

  it('should produce idempotent results (sorting twice yields same result)', () => {
    fc.assert(
      fc.property(
        fc.array(moduleArbitrary(), { minLength: 1, maxLength: 15 }),
        (modules) => {
          const sortedOnce = sortModulesByIndex(modules);
          const sortedTwice = sortModulesByIndex(sortedOnce);

          // Property: Sorting an already-sorted array should not change it
          expect(sortedTwice).toEqual(sortedOnce);
        }
      ),
      { numRuns: 100 }
    );
  });
});
