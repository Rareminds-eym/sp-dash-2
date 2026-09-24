import { describe, expect, it } from 'vitest';
import { LTEIngestionService } from '@/lib/services/lte-ingestion-service';
import { NormalizedSnapshot } from '@/lib/services/lte-ingestion/snapshot-serializer';

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
            ['content-engage', 'module-1', 'engage', 'Engage description', {
              prerequisites: 'Case pack',
              technical_concepts: 'Evidence IDs',
              video_ctv_context: 'Confirm Source Assets',
              when_to_use: 'During engage',
              module_continuity: 'Express preserves continuity',
            }],
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
    expect(course.modules[0].stages[0].videoCtvContext).toBe('Confirm Source Assets');
    expect(course.modules[0].stages[0].whenToUse).toBe('During engage');
    expect(course.modules[0].stages[0].moduleContinuity).toBe('Express preserves continuity');
    expect(course.modules[0].stages[5].subtitle).toBe('Evolve workbook title');
  });

  it('links modules by level code and preserves all stage asset metadata', () => {
    const snapshot: NormalizedSnapshot = {
      tables: {
        levels: { columns: ['id', 'level_code', 'course_code'], rows: [['level-1', 'L1', 'COURSE_L1']] },
        modules: { columns: ['id', 'level_code', 'module_no', 'title'], rows: [['module-1', 'L1', 1, 'Introduction']] },
        modules_content: { columns: ['id', 'module_id', 'stage_name'], rows: [['mc-1', 'module-1', 'engage']] },
        e_content: { columns: ['id', 'modules_content_id', 'file_url', 'filename', 'mime_type'], rows: [
          ['asset-1', 'mc-1', 'https://example.test/intro.mp4', 'intro.mp4', 'video/mp4'],
          ['asset-2', 'mc-1', 'https://example.test/deck.pdf', 'deck.pdf', 'application/pdf'],
        ] },
      },
      metadata: { sourceType: 'xlsx', sourceName: 'assets.xlsx', tableCount: 4, totalRows: 5, parsedAt: '2026-09-10T00:00:00.000Z' },
    };
    const [course] = LTEIngestionService.extractLevelCourses(snapshot);
    expect(course.modules).toHaveLength(1);
    expect(course.modules[0].stages[0].assets).toEqual([
      expect.objectContaining({ url: 'https://example.test/intro.mp4', fileName: 'intro.mp4', contentType: 'video/mp4' }),
      expect.objectContaining({ url: 'https://example.test/deck.pdf', fileName: 'deck.pdf', contentType: 'application/pdf' }),
    ]);
  });

  it('uses level_code instead of UUID level_id for learner preview level labels', () => {
    const snapshot: NormalizedSnapshot = {
      tables: {
        capabilities: {
          columns: ['id', 'code', 'name'],
          rows: [['66fb6d7e-8ea6-54a4-b3ac-fd9d8ab468aa', 'MEG_IND-CAP-19', 'Video/CTV Campaign Activation and QA Readiness']],
        },
        levels: {
          columns: ['id', 'capability_id', 'level_id', 'level_code', 'title'],
          rows: [[
            '9e2a0c4a-1111-4111-8111-111111111111',
            '66fb6d7e-8ea6-54a4-b3ac-fd9d8ab468aa',
            'aa306704-c6b5-4ddc-8cf5-3fc20f293a03',
            'MEG_CAP19_L1',
            'Activation Readiness, Source and Criteria Recognition',
          ]],
        },
      },
      metadata: { sourceType: 'xlsx', sourceName: 'cap19.xlsx', tableCount: 2, totalRows: 2, parsedAt: '2026-09-21T00:00:00.000Z' },
    };

    const [course] = LTEIngestionService.extractLevelCourses(snapshot);

    expect(course.levelNo).toBe(1);
    expect(course.courseMetadata.capabilityLevel).toBe('Level 1');
  });

  it('maps module worksheet fields for learner preview side drawers', () => {
    const snapshot: NormalizedSnapshot = {
      tables: {
        levels: {
          columns: ['id', 'level_code', 'title'],
          rows: [['level-1', 'MEG_CAP19_L1', 'Activation readiness']],
        },
        modules: {
          columns: ['id', 'level_id', 'module_no', 'title', 'description', 'pressure_points', 'user_confusion', 'industry_challenge', 'prerequisites', 'what_youll_learn', 'when_to_apply', 'module_problem_statement'],
          rows: [[
            'module-1',
            'level-1',
            0,
            'Confirm Source Assets',
            'Module description',
            ['Launch pressure', 'Incomplete evidence'],
            ['May infer approval truth'],
            'Video/CTV activation must stay evidence-led.',
            ['Campaign brief'],
            ['Trace evidence', 'Stay inside authority'],
            'Use during activation readiness.',
            'Confirm source/version/owner before action.',
          ]],
        },
      },
      metadata: { sourceType: 'xlsx', sourceName: 'cap19.xlsx', tableCount: 2, totalRows: 2, parsedAt: '2026-09-21T00:00:00.000Z' },
    };

    const [course] = LTEIngestionService.extractLevelCourses(snapshot);
    const [module] = course.modules;

    expect(module.contextDescription).toBe('Module description');
    expect(module.pressurePoints).toEqual(['Launch pressure', 'Incomplete evidence']);
    expect(module.userConfusion).toEqual(['May infer approval truth']);
    expect(module.industryChallenge).toBe('Video/CTV activation must stay evidence-led.');
    expect(module.prerequisites).toEqual(['Campaign brief']);
    expect(module.whatYoullLearn).toEqual(['Trace evidence', 'Stay inside authority']);
    expect(module.whenToApply).toBe('Use during activation readiness.');
    expect(module.moduleProblemStatement).toBe('Confirm source/version/owner before action.');
  });
});
