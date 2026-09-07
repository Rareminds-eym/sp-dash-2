import { describe, expect, it } from 'vitest';
import { ASSET_EXTRACTION_CONFIG, extractAssets } from './asset-extractor';

describe('extractAssets', () => {
  it('exports an explicit table/column configuration', () => {
    expect(ASSET_EXTRACTION_CONFIG.e_content).toContain('learning_content.context_link');
  });

  it('extracts configured URLs and tracks exact row field paths', () => {
    const assets = extractAssets({
      tables: {
        module_artifacts: {
          columns: ['id', 'template_url'],
          rows: [['1', 'https://cdn.example.com/template.pdf']],
        },
      },
    });

    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({
      originalUrl: 'https://cdn.example.com/template.pdf',
      tableName: 'module_artifacts',
      rowIndex: 0,
      fieldPath: 'tables.module_artifacts.rows.0.template_url',
    });
  });

  it('supports configured nested JSON paths', () => {
    const assets = extractAssets({
      tables: {
        e_content: {
          columns: ['learning_content'],
          rows: [[{ context_link: 'https://learn.example.com/context.html' }]],
        },
      },
    });

    expect(assets[0].fieldPath).toBe('tables.e_content.rows.0.learning_content.context_link');
  });

  it('deduplicates URLs while preserving every occurrence', () => {
    const assets = extractAssets({
      tables: {
        artifact_questions: {
          columns: ['reference_url', 'solution_url'],
          rows: [
            ['https://cdn.example.com/shared.pdf', 'https://cdn.example.com/shared.pdf'],
            ['https://cdn.example.com/shared.pdf', null],
          ],
        },
      },
    });

    expect(assets).toHaveLength(1);
    expect(assets[0].occurrences).toHaveLength(3);
  });

  it('ignores URLs in unconfigured columns and tables', () => {
    expect(extractAssets({
      tables: { random_table: { columns: ['url'], rows: [['https://example.com/secret']] } },
    })).toEqual([]);
  });
});
