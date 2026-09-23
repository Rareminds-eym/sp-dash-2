import { NextRequest, NextResponse } from 'next/server';
import * as ExcelJS from 'exceljs';
import Logger, { getErrorMessage } from '@/lib/logger';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseLTE } from '@/lib/supabase-lte';
import { REQUIRED_LTE_TABLES } from '@/lib/services/lte-ingestion/constants';

const logger = new Logger('LTETemplateAPI');

export const runtime = 'nodejs';

type TemplateColumn = { header: string; source?: string | null; pipe?: boolean };

const RAW_EXPORT_COLUMNS: Record<string, Array<string | TemplateColumn>> = {
  roles: ['id', 'role_name', 'role_family_name', 'domain_name'],
  capabilities: ['id', 'code', 'name', 'description', 'slug', 'master_sequence', 'thumbnail_url'],
  level_scale: ['id', 'level_no', { header: 'level_code', source: null }, 'level_label', 'generic_definition'],
  role_capability_sequence: ['id', 'role_id', 'capability_id', 'sequence_step', 'capability_priority', 'required_level', 'duration_weeks', 'work_style_demands'],
  skills: ['id', 'code', 'name', 'description', { header: 'tags (|)', source: 'tags', pipe: true }],
  levels: ['id', 'level_code', 'capability_id', 'level_id', 'title', 'description', { header: 'observable_behavior (|)', source: 'observable_behavior', pipe: true }, { header: 'example_outputs (|)', source: 'example_outputs', pipe: true }, { header: 'problem_statement (|)', source: 'problem_statement', pipe: true }, 'duration_minutes', 'difficulty_level', 'total_xp'],
  level_skills: ['id', 'level_id', 'skill_id'],
  modules: [{ header: ' Id ', source: 'id' }, 'level_id', 'module_no', 'title', 'description', { header: 'pressure_points (|)', source: 'pressure_points', pipe: true }, { header: 'user_confusion (|)', source: 'user_confusion', pipe: true }, { header: 'Industry_challenge', source: 'industry_challenge' }, { header: 'Prerequisites (|)', source: 'prerequisites', pipe: true }, { header: 'WhatYoullLearn (|)', source: 'what_youll_learn', pipe: true }, { header: 'whenToApply', source: 'when_to_apply' }, { header: 'learning_content (|)', source: 'learning_content', pipe: true }, { header: 'support (|)', source: 'support', pipe: true }, { header: 'knowledge (|)', source: 'knowledge', pipe: true }, { header: 'module_problem_statement', source: 'module_problem_statement' }, { header: 'tools (|)', source: 'tools', pipe: true }],
  modules_content: ['id', 'module_id', 'stage_name', 'stage_order', 'stage_description', { header: 'module_context ', source: 'module_context' }, { header: 'curriculum_reference (|)', source: 'curriculum_reference', pipe: true }],
  e_content: ['id', 'modules_content_id', 'content_type', 'title', 'description', 'url', 'sort_order', 'duration_seconds', 'xp_reward', 'mime_type', 'file_size_bytes'],
  module_artifacts: ['id', 'modules_content_id', 'artifact_type', 'total_score', 'passing_score'],
  artifact_questions: ['id', 'artifact_id', 'question_order', 'title', 'description', { header: 'instructions (|)', source: 'instructions', pipe: true }, 'response_type', { header: 'allowed_file_types (|)', source: 'allowed_file_types', pipe: true }, 'max_file_size_mb'],
  artifact_templates: ['id', 'artifact_id', 'question_id', 'file_name', 'file_url', 'file_type'],
};

const EXPORT_COLUMN_DEFS: Record<string, TemplateColumn[]> = Object.fromEntries(
  Object.entries(RAW_EXPORT_COLUMNS).map(([table, columns]) => [
    table,
    columns.map((column) => typeof column === 'string' ? { header: column, source: column } : column),
  ])
);

type ExportRows = Record<string, any[]>;

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { user, error: authError } = await authenticateSSORequest(request, ['admin', 'super_admin', 'platform_admin']);
    if (authError || !user) return authError || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const sampleLevelCode = searchParams.get('levelCode') || undefined;
    const capabilityCode = searchParams.get('capabilityCode') || searchParams.get('capability') || undefined;
    const levelNoParam = searchParams.get('levelNo') || searchParams.get('level') || undefined;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SkillPassport LTE';
    workbook.created = new Date();
    workbook.modified = new Date();

    const exportRows = await buildTemplateRows(sampleLevelCode, capabilityCode, levelNoParam);

    addInstructionSheets(workbook);

    for (const tableName of REQUIRED_LTE_TABLES) {
      const columns = EXPORT_COLUMN_DEFS[tableName];
      const data = exportRows[tableName] || [];

      const sheet = workbook.addWorksheet(tableName);
      sheet.addRow(columns.map((column) => column.header));

      for (const row of data || []) {
        sheet.addRow(columns.map((column) => {
          const value = column.source === null ? null : row[column.source || column.header];
          return serializeCell(value, column);
        }));
      }

      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.getRow(1).font = { bold: true };
      sheet.columns = columns.map((column) => ({
        key: column.header,
        width: Math.min(Math.max(column.header.length + 4, 14), 42),
      }));
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const safeCapability = (capabilityCode || '').trim().toUpperCase().replace(/[^A-Z0-9-]+/g, '') || 'CATALOG';
    const safeLevel = (levelNoParam || '').trim().replace(/[^0-9]/g, '');
    const fileName = safeLevel
      ? `LTE_${safeCapability}_L${safeLevel}_Template.xlsx`
      : `LTE_LEARNING_CATALOG_TEMPLATE_${new Date().toISOString().slice(0, 10)}.xlsx`;

    logger.info('LTE template exported', {
      userId: user.userId,
      fileName,
      sampleLevelCode: exportRows.levels?.[0]?.level_code,
      capabilityCode,
      levelNo: levelNoParam,
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error('Failed to export LTE template', { error: errorMessage });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

async function buildTemplateRows(sampleLevelCode?: string, capabilityCode?: string, levelNoParam?: string): Promise<ExportRows> {
  const [roles, capabilities, levelScale, roleCapabilitySequence] = await Promise.all([
    fetchRows('roles', 'role_name'),
    fetchRows('capabilities', 'master_sequence'),
    fetchRows('level_scale', 'level_no'),
    fetchRows('role_capability_sequence', 'sequence_step'),
  ]);

  const normalizedCapability = (capabilityCode || '').trim().toUpperCase();
  const requestedLevelNo = levelNoParam ? Number(levelNoParam) : NaN;
  const capability = normalizedCapability
    ? capabilities.find((row) => String(row.code || '').toUpperCase() === normalizedCapability)
    : undefined;
  const resolvedLevelCode = sampleLevelCode
    || (capability && Number.isFinite(requestedLevelNo)
      ? `${capability.code}_L${requestedLevelNo}`
      : undefined);

  let sampleLevel = await fetchSampleLevel(resolvedLevelCode, capability?.id);
  if (!sampleLevel && capability && Number.isFinite(requestedLevelNo)) {
    // Pre-fill a stub row for the requested next level (e.g. L2/L3) so L&D can
    // fill a fresh level without cloning L1 ids. Publish treats it as insert
    // because the level_code is new; re-uploaded codes update instead.
    const levelScaleRow = levelScale.find((row) => Number(row.level_no) === requestedLevelNo);
    sampleLevel = {
      id: `${capability.code}_L${requestedLevelNo}`,
      level_code: `${capability.code}_L${requestedLevelNo}`,
      capability_id: capability.id,
      level_id: levelScaleRow?.id || null,
      title: '',
      description: '',
      observable_behavior: null,
      example_outputs: null,
      problem_statement: null,
      duration_minutes: null,
      difficulty_level: null,
      total_xp: null,
    };
  }
  if (!sampleLevel) {
    return {
      roles,
      capabilities,
      level_scale: levelScale,
      role_capability_sequence: roleCapabilitySequence,
      skills: [],
      levels: [],
      level_skills: [],
      modules: [],
      modules_content: [],
      e_content: [],
      module_artifacts: [],
      artifact_questions: [],
      artifact_templates: [],
    };
  }

  const modules = await fetchRowsByValues('modules', 'level_id', [sampleLevel.id], 'module_no');
  const moduleIds = modules.map((row) => row.id);
  const modulesContent = await fetchRowsByValues('modules_content', 'module_id', moduleIds, 'stage_order');
  const moduleContentIds = modulesContent.map((row) => row.id);
  const eContent = await fetchRowsByValues('e_content', 'modules_content_id', moduleContentIds, 'sort_order');
  const moduleArtifacts = await fetchRowsByValues('module_artifacts', 'modules_content_id', moduleContentIds, 'artifact_type');
  const artifactIds = moduleArtifacts.map((row) => row.id);
  const artifactQuestions = await fetchRowsByValues('artifact_questions', 'artifact_id', artifactIds, 'question_order');
  const artifactTemplates = await fetchRowsByValues('artifact_templates', 'artifact_id', artifactIds, 'file_name');
  const levelSkills = await fetchRowsByValues('level_skills', 'level_id', [sampleLevel.id], 'created_at');
  const skillIds = levelSkills.map((row) => row.skill_id);
  const skills = await fetchRowsByValues('skills', 'id', skillIds, 'code');

  return {
    roles,
    capabilities,
    level_scale: levelScale,
    role_capability_sequence: roleCapabilitySequence,
    skills,
    levels: [sampleLevel],
    level_skills: levelSkills,
    modules,
    modules_content: modulesContent,
    e_content: eContent,
    module_artifacts: moduleArtifacts,
    artifact_questions: artifactQuestions,
    artifact_templates: artifactTemplates,
  };
}

async function fetchRows(tableName: string, orderColumn: string): Promise<any[]> {
  const columns = getSelectColumns(tableName);
  const { data, error } = await supabaseLTE
    .from(tableName)
    .select(columns.join(','))
    .order(orderColumn, { ascending: true });

  if (error) throw new Error(`Failed to export ${tableName}: ${error.message}`);
  return data || [];
}

async function fetchRowsByValues(
  tableName: string,
  filterColumn: string,
  values: string[],
  orderColumn: string
): Promise<any[]> {
  if (values.length === 0) return [];

  const columns = getSelectColumns(tableName);
  const { data, error } = await supabaseLTE
    .from(tableName)
    .select(columns.join(','))
    .in(filterColumn, values)
    .order(orderColumn, { ascending: true });

  if (error) throw new Error(`Failed to export ${tableName}: ${error.message}`);
  return data || [];
}

async function fetchSampleLevel(levelCode?: string, capabilityId?: string): Promise<any | null> {
  const columns = getSelectColumns('levels');
  let query = supabaseLTE
    .from('levels')
    .select(columns.join(','))
    .eq('is_active', true);

  if (levelCode) {
    query = query.eq('level_code', levelCode);
  } else if (capabilityId) {
    query = query.eq('capability_id', capabilityId);
  }

  const { data, error } = await query
    .order('level_code', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to export sample level: ${error.message}`);
  return data;
}

function addInstructionSheets(workbook: ExcelJS.Workbook): void {
  const enumSheet = workbook.addWorksheet('ENUMS_AND_RULES');
  enumSheet.addRow(['field', 'allowed_values_or_rule']);
  [
    ['Workbook scope', 'Template contains all roles, all capabilities, all level_scale rows, all role_capability_sequence rows, and one sample course/level with associated records.'],
    ['IDs and foreign keys', 'Use UUID values from this template. Do not replace UUID id/fk columns with readable business codes.'],
    ['Pipe columns marked (|)', 'Enter multiple values as value 1 | value 2 | value 3. Do not wrap these fields in JSON unless the source DB value is already JSON.'],
    ['skills.tags (|)', 'Example: planning | schedule-control | evidence-review'],
    ['levels.observable_behavior (|)', 'Example: identifies evidence | validates gaps | prepares handoff'],
        ['levels.example_outputs (|)', 'Example: completed checklist | evidence pack | reviewer handoff. Use the actual | symbol between outputs.'],
['levels.problem_statement (|)', 'Example: title: ... | description: ...'],
    ['modules.pressure_points (|)', 'Use pipe-separated values for multiple items.'],
    ['modules.user_confusion (|)', 'Use pipe-separated values for multiple items.'],
    ['modules.Prerequisites (|)', 'Use pipe-separated values for multiple items.'],
    ['modules.WhatYoullLearn (|)', 'Use pipe-separated values for multiple items.'],
    ['modules.learning_content (|)', 'Use key: value | key: value sections when structured.'],
    ['modules.support (|)', 'Use key: value | key: value sections when structured.'],
    ['modules.knowledge (|)', 'Use key: value | key: value sections when structured.'],
    ['modules.tools (|)', 'Use pipe-separated values for multiple tools.'],
    ['modules_content.curriculum_reference (|)', 'Example: key: value | key: value'],
    ['artifact_questions.instructions (|)', 'Use required: ... | pass_criteria: ... | critical_fail: ... . Keep the actual | symbol between sections.'],
    ['artifact_questions.allowed_file_types (|)', 'Example: pdf | doc | xlsx'],
    ['artifact_templates.file_url', 'Enter the source Google Drive URL. Do not enter a Cloudflare R2 URL manually; upload processing downloads the Drive file and stores it in the R2 bucket.'],
    ['e_content.url', 'For uploaded learning files, use the source Google Drive URL so upload processing can copy the asset into Cloudflare R2. External web links can remain as normal URLs.'],
    ['difficulty_level', 'beginner | foundation | intermediate | advanced | expert'],
    ['status', 'draft | published | archived'],
    ['content_type', 'pdf | doc | video | image | slide | link | audio | text'],
    ['stage_name', 'engage | explore | explain | express | empower | evolve'],
    ['artifact_type', 'practice | final'],
    ['file_type', 'doc | ppt | excel | pdf | mp4 | mp3 | jpeg | png | sheet | xls | docs | text | zip'],
  ].forEach((row) => enumSheet.addRow(row));
  enumSheet.views = [{ state: 'frozen', ySplit: 1 }];
  enumSheet.getRow(1).font = { bold: true };
  enumSheet.columns = [{ width: 36 }, { width: 110 }];

  const examplesSheet = workbook.addWorksheet('WRITING_EXAMPLES');
  examplesSheet.addRow(['area', 'good_example', 'notes']);
  [
    ['Pipe list', 'Evidence IDs: E-M1-01 | Key data: planned 70 percent | Risk: missing owner', 'Use | between items.'],
    ['Problem statement', 'title: Case review | description: Learner validates evidence before handoff', 'Use key: value pairs separated by |.'],
    ['Artifact question instructions', 'required: Complete the exact Express final workbook CIE-CAP-003_M0_Course_Readiness_Sheet_Evolve_Stage_Artifact.xlsx without replacing its required structure. Apply the module method independently and submit the final artifact. | pass_criteria: Complete the supplied Evolve workbook accurately, keep evidence traceable, preserve unresolved items, demonstrate independent transfer, and stay within the stated level authority boundary. | critical_fail: approval of baseline change, EOT/claim, client-ready release, invented owner, ignored negative float, or AI-generated artifact submission.', 'Use this format in artifact_questions.instructions.'],
    ['Asset source URL', 'https://drive.google.com/file/d/<file-id>/view?usp=sharing', 'Use Google Drive source URLs in file_url/url fields; the upload pipeline stores downloaded assets in Cloudflare R2.'],
    ['JSON metadata', '{"level_focus":"Assisted recognition"}', 'Only metadata fields should remain JSON.'],
  ].forEach((row) => examplesSheet.addRow(row));
  examplesSheet.views = [{ state: 'frozen', ySplit: 1 }];
  examplesSheet.getRow(1).font = { bold: true };
  examplesSheet.columns = [{ width: 28 }, { width: 80 }, { width: 56 }];
}

function getSelectColumns(tableName: string): string[] {
  return Array.from(new Set(
    EXPORT_COLUMN_DEFS[tableName]
      .map((column) => column.source === null ? null : (column.source || column.header))
      .filter((source): source is string => Boolean(source))
  ));
}

function serializeCell(value: unknown, column?: TemplateColumn): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (column?.pipe) return serializePipeCell(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function serializePipeCell(value: unknown): unknown {
  if (Array.isArray(value)) return value.join(' | ');
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.join(' | ');
      if (parsed && typeof parsed === 'object') {
        return Object.entries(parsed).map(([key, entry]) => `${key}: ${entry}`).join(' | ');
      }
    } catch {
      return value;
    }
    return value;
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => `${key}: ${entry}`)
      .join(' | ');
  }
  return value;
}
