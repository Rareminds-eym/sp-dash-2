import { describe, expect, it } from 'vitest';
import { LTEIngestionService } from './lte-ingestion-service';
import { NormalizedSnapshot } from './lte-ingestion/snapshot-serializer';

describe('LTEIngestionService.extractLevelCourses', () => {
  it('extracts one review course per uploaded level row', () => {
    const snapshot: NormalizedSnapshot = {
      tables: {
        roles: {
          columns: ['id', 'domain_name'],
          rows: [['role-1', 'Financial Services']],
        },
        capabilities: {
          columns: ['id', 'code', 'name'],
          rows: [['cap-1', 'CAP_CREDIT_001', 'Credit Risk Analysis']],
        },
        levels: {
          columns: ['id', 'capability_id', 'level_code', 'course_title', 'course_code', 'problem_statement'],
          rows: [
            ['level-1', 'cap-1', 'L1', 'Credit Risk Basics', 'CAP_CREDIT_001_L1', 'title: Risk | description: Identify basic risk signals'],
            ['level-2', 'cap-1', 'L2', 'Credit Risk Foundations', 'CAP_CREDIT_001_L2', 'title: Risk | description: Build a scorecard'],
          ],
        },
        modules: {
          columns: ['id', 'level_id', 'module_no', 'title'],
          rows: [
            ['module-1', 'level-1', 0, 'Environment Setup'],
            ['module-2', 'level-2', 0, 'Scorecard Setup'],
          ],
        },
        modules_content: {
          columns: ['id', 'module_id', 'stage_name'],
          rows: [
            ['content-1', 'module-1', 'engage'],
            ['content-2', 'module-2', 'engage'],
          ],
        },
        e_content: {
          columns: ['id', 'modules_content_id', 'title'],
          rows: [
            ['stage-1', 'content-1', 'Risk hook'],
            ['stage-2', 'content-2', 'Scorecard hook'],
          ],
        },
        module_artifacts: {
          columns: ['id', 'modules_content_id', 'title'],
          rows: [
            ['artifact-1', 'content-1', 'Risk checklist'],
            ['artifact-2', 'content-2', 'Scorecard checklist'],
          ],
        },
      },
      metadata: {
        sourceType: 'xlsx',
        sourceName: 'test.xlsx',
        tableCount: 7,
        totalRows: 12,
        parsedAt: '2026-08-18T00:00:00.000Z',
      },
    };

    const levelCourses = LTEIngestionService.extractLevelCourses(snapshot);

    expect(levelCourses).toHaveLength(2);
    expect(levelCourses[0].courseMetadata.courseTitle).toBe('Credit Risk Basics');
    expect(levelCourses[1].courseMetadata.courseTitle).toBe('Credit Risk Foundations');
    expect(levelCourses[0].modules).toHaveLength(1);
    expect(levelCourses[1].modules).toHaveLength(1);
    expect(levelCourses[0].modules[0].artifactPractices[0].title).toBe('Risk checklist');
    expect(levelCourses[1].modules[0].stages[0].label).toBe('Engage');
    expect(levelCourses[1].modules[0].stages[0].subtitle).toBe('Scorecard hook');
  });

  it('reads stage names from modules_content and content details from e_content', () => {
    const snapshot: NormalizedSnapshot = {
      tables: {
        capabilities: {
          columns: ['id', 'code', 'name'],
          rows: [['cap-1', 'CAP_CREDIT_001', 'Credit Risk Analysis']],
        },
        levels: {
          columns: ['id', 'capability_id', 'level_code', 'course_title'],
          rows: [['level-1', 'cap-1', 'L1', 'Credit Risk Basics']],
        },
        modules: {
          columns: ['id', 'level_id', 'module_no', 'title'],
          rows: [['module-1', 'level-1', 0, 'Evidence Intake']],
        },
        modules_content: {
          columns: ['id', 'module_id', 'stage_name', 'stage_description', 'curriculum_reference'],
          rows: [
            ['content-engage', 'module-1', 'engage', 'Engage description', { prerequisites: 'Case pack', technical_concepts: 'Evidence IDs' }],
            ['content-explore', 'module-1', 'explore', 'Explore description', {}],
            ['content-explain', 'module-1', 'explain', 'Explain description', {}],
            ['content-express', 'module-1', 'express', 'Express description', {}],
            ['content-empower', 'module-1', 'empower', 'Empower description', {}],
            ['content-evolve', 'module-1', 'evolve', 'Evolve description', {}],
          ],
        },
        e_content: {
          columns: ['id', 'modules_content_id', 'content_type', 'title', 'description', 'duration_seconds'],
          rows: [
            ['stage-engage', 'content-engage', 'slide', 'Engage workbook title', 'Engage file description', 300],
            ['stage-evolve', 'content-evolve', 'slide', 'Evolve workbook title', 'Evolve file description', 600],
          ],
        },
        module_artifacts: {
          columns: ['id', 'modules_content_id', 'title'],
          rows: [
            ['artifact-1', 'content-express', 'Practice artifact'],
            ['artifact-2', 'content-evolve', 'Final artifact'],
          ],
        },
      },
      metadata: {
        sourceType: 'xlsx',
        sourceName: 'test.xlsx',
        tableCount: 6,
        totalRows: 14,
        parsedAt: '2026-08-18T00:00:00.000Z',
      },
    };

    const [course] = LTEIngestionService.extractLevelCourses(snapshot);

    expect(course.modules[0].stages.map(stage => stage.name)).toEqual([
      'Engage',
      'Explore',
      'Explain',
      'Express',
      'Empower',
      'Evolve',
    ]);
    expect(course.modules[0].stages[0].subtitle).toBe('Engage workbook title');
    expect(course.modules[0].stages[0].description).toBe('Engage file description');
    expect(course.modules[0].stages[0].estimatedDuration).toBe('5 mins');
    expect(course.modules[0].stages[0].prerequisites).toEqual(['Case pack']);
    expect(course.modules[0].stages[5].subtitle).toBe('Evolve workbook title');
  });
});
