/**
 * Validation Report Generator
 * 
 * Aggregates validation errors and warnings from parsing, FK resolution,
 * duplicate detection, and existing record detection to generate a
 * comprehensive validation report with publishReady determination.
 */

import { EXPECTED_6E_STAGES, REQUIRED_LTE_TABLES } from './constants';
import { DuplicateDetectionResult } from './duplicate-detector';
import { ExistingRecordResult, countExistingRecords } from './existing-record-detector';

export type ValidationSeverity = 'INFO' | 'WARNING' | 'ERROR';
export type ValidationStatus = 'validated' | 'validation_failed';
export type ValidationCategory = 'SCHEMA_VERIFICATION' | 'CURRICULUM_6ES' | 'ARTIFACTS';

export interface ValidationError {
  severity: ValidationSeverity;
  code: string;
  message: string;
  table?: string;
  row?: number;
  column?: string;
  details?: any;
}

export interface ValidationWarning {
  severity: 'WARNING' | 'INFO';
  code: string;
  message: string;
  table?: string;
  row?: number;
}

export interface TableSummary {
  rowCount: number;
  insertCount: number;
  skipCount: number;
  errorCount: number;
}

export interface ValidationCard {
  id: string;
  category: ValidationCategory;
  title: string;
  message: string;
  severity: ValidationSeverity;
  icon: 'checkmark' | 'warning' | 'error';
}

export interface ValidationResult {
  status: ValidationStatus;
  publishReady: boolean;
  tableSummary: Record<string, TableSummary>;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  validationCards: ValidationCard[];
}

/**
 * Generate validation report from workbook data and detection results
 */
export function generateValidationReport(
  workbookData: Map<string, any[]>,
  duplicateResults: Map<string, DuplicateDetectionResult>,
  existingResult: ExistingRecordResult,
  parsingErrors: ValidationError[] = []
): ValidationResult {
  const errors: ValidationError[] = [...parsingErrors];
  const warnings: ValidationWarning[] = [];
  
  // Generate table summaries
  const tableSummary = generateTableSummaries(
    workbookData,
    duplicateResults,
    existingResult
  );
  
  // Add duplicate errors
  for (const [table, result] of duplicateResults.entries()) {
    for (const error of result.errors) {
      errors.push({
        severity: 'ERROR',
        code: 'DUPLICATE_CONFLICT',
        message: error.message,
        table,
        row: error.row,
      });
    }
  }

  errors.push(...validateCurriculumStructure(workbookData));
  
  // Add warnings for existing records
  const existingCounts = countExistingRecords(workbookData, existingResult);
  for (const [table, counts] of Object.entries(existingCounts)) {
    if (counts.existing > 0) {
      warnings.push({
        severity: 'INFO',
        code: 'EXISTING_RECORD_SKIP',
        message: `${counts.existing} record(s) already exist and will be skipped`,
        table,
      });
    }
  }
  
  // Determine publish readiness
  const publishReady = determinePublishReady(errors);
  
  // Generate validation cards
  const validationCards = generateValidationCards(
    workbookData,
    errors,
    warnings
  );
  
  return {
    status: publishReady ? 'validated' : 'validation_failed',
    publishReady,
    tableSummary,
    errors,
    warnings,
    validationCards,
  };
}

function validateCurriculumStructure(workbookData: Map<string, any[]>): ValidationError[] {
  const errors: ValidationError[] = [];
  const modules = workbookData.get('modules') || [];
  const modulesContent = workbookData.get('modules_content') || [];
  const eContent = workbookData.get('e_content') || [];
  const artifacts = workbookData.get('module_artifacts') || [];
  const questions = workbookData.get('artifact_questions') || [];
  const templates = workbookData.get('artifact_templates') || [];

  const contentByModule = new Map<string, any[]>();
  for (const row of modulesContent) {
    const moduleId = textKey(row.module_id);
    if (!moduleId) continue;
    const existing = contentByModule.get(moduleId) || [];
    existing.push(row);
    contentByModule.set(moduleId, existing);
  }

  const eContentByModuleContent = new Map<string, any[]>();
  for (const row of eContent) {
    const moduleContentId = textKey(row.modules_content_id);
    if (!moduleContentId) continue;
    const existing = eContentByModuleContent.get(moduleContentId) || [];
    existing.push(row);
    eContentByModuleContent.set(moduleContentId, existing);
  }

  const artifactsByContent = new Map<string, any[]>();
  for (const row of artifacts) {
    const moduleContentId = textKey(row.modules_content_id);
    if (!moduleContentId) continue;
    const existing = artifactsByContent.get(moduleContentId) || [];
    existing.push(row);
    artifactsByContent.set(moduleContentId, existing);
  }

  const questionsByArtifact = new Map<string, any[]>();
  for (const row of questions) {
    const artifactId = textKey(row.artifact_id);
    if (!artifactId) continue;
    const existing = questionsByArtifact.get(artifactId) || [];
    existing.push(row);
    questionsByArtifact.set(artifactId, existing);
  }

  const templatesByArtifact = new Map<string, any[]>();
  for (const row of templates) {
    const artifactId = textKey(row.artifact_id);
    if (!artifactId) continue;
    const existing = templatesByArtifact.get(artifactId) || [];
    existing.push(row);
    templatesByArtifact.set(artifactId, existing);
  }

  modules.forEach((moduleRow, index) => {
    const moduleId = textKey(moduleRow.id);
    if (!moduleId) {
      errors.push({
        severity: 'ERROR',
        code: 'MODULE_ID_REQUIRED',
        message: `modules row ${index + 2}: id is required for 6E mapping`,
        table: 'modules',
        row: index + 2,
        column: 'id',
      });
      return;
    }

    const contentRows = contentByModule.get(moduleId) || [];
    const stages = new Map<string, any[]>();
    for (const contentRow of contentRows) {
      const stage = textKey(contentRow.stage_name || contentRow.lte_6e_stage);
      if (!stage) continue;
      const existing = stages.get(stage) || [];
      existing.push(contentRow);
      stages.set(stage, existing);
    }

    const missingStages = EXPECTED_6E_STAGES.filter(stage => !stages.has(stage));
    if (missingStages.length > 0) {
      errors.push({
        severity: 'ERROR',
        code: 'MISSING_6E_STAGE',
        message: `modules ${moduleId}: missing modules_content stage(s): ${missingStages.join(', ')}`,
        table: 'modules_content',
        row: index + 2,
        column: 'stage_name',
      });
    }

    for (const stage of EXPECTED_6E_STAGES) {
      const stageRows = stages.get(stage) || [];
      if (stageRows.length > 1) {
        errors.push({
          severity: 'ERROR',
          code: 'DUPLICATE_6E_STAGE',
          message: `modules ${moduleId}: duplicate modules_content rows for stage ${stage}`,
          table: 'modules_content',
          column: 'stage_name',
        });
      }

      for (const stageRow of stageRows) {
        const contentId = textKey(stageRow.id);
        if (contentId && (eContentByModuleContent.get(contentId) || []).length === 0) {
          errors.push({
            severity: 'ERROR',
            code: 'MISSING_STAGE_CONTENT',
            message: `modules_content ${contentId}: no e_content row is linked to stage ${stage}`,
            table: 'e_content',
            column: 'modules_content_id',
          });
        }
      }
    }

    const moduleArtifacts = contentRows.flatMap(row => artifactsByContent.get(textKey(row.id)) || []);
    if (moduleArtifacts.length < 2) {
      errors.push({
        severity: 'ERROR',
        code: 'MISSING_ARTIFACT_PRACTICE',
        message: `modules ${moduleId}: expected at least 2 linked artifact practices, found ${moduleArtifacts.length}`,
        table: 'module_artifacts',
        column: 'modules_content_id',
      });
    }

    for (const artifact of moduleArtifacts) {
      const artifactId = textKey(artifact.id);
      if (!artifactId) continue;
      if ((questionsByArtifact.get(artifactId) || []).length === 0) {
        errors.push({
          severity: 'ERROR',
          code: 'MISSING_ARTIFACT_QUESTION',
          message: `module_artifacts ${artifactId}: no artifact_questions row is linked`,
          table: 'artifact_questions',
          column: 'artifact_id',
        });
      }
      if ((templatesByArtifact.get(artifactId) || []).length === 0) {
        errors.push({
          severity: 'ERROR',
          code: 'MISSING_ARTIFACT_TEMPLATE',
          message: `module_artifacts ${artifactId}: no artifact_templates row is linked`,
          table: 'artifact_templates',
          column: 'artifact_id',
        });
      }
    }
  });

  return errors;
}

function textKey(value: any): string {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * Generate table summaries with row counts
 */
export function generateTableSummaries(
  workbookData: Map<string, any[]>,
  duplicateResults: Map<string, DuplicateDetectionResult>,
  existingResult: ExistingRecordResult
): Record<string, TableSummary> {
  const summaries: Record<string, TableSummary> = {};
  const existingCounts = countExistingRecords(workbookData, existingResult);
  
  for (const [table, rows] of workbookData.entries()) {
    const duplicateResult = duplicateResults.get(table);
    const errorCount = duplicateResult?.errors.length || 0;
    
    // Count duplicates marked as SKIP
    let duplicateSkipCount = 0;
    if (duplicateResult) {
      for (const info of duplicateResult.duplicates.values()) {
        if (info.action === 'SKIP') {
          duplicateSkipCount++;
        }
      }
    }
    
    const existingCount = existingCounts[table]?.existing || 0;
    const totalSkipCount = existingCount + duplicateSkipCount;
    const insertCount = rows.length - totalSkipCount - errorCount;
    
    summaries[table] = {
      rowCount: rows.length,
      insertCount: Math.max(0, insertCount),
      skipCount: totalSkipCount,
      errorCount,
    };
  }
  
  return summaries;
}

/**
 * Determine if upload is ready to publish
 */
export function determinePublishReady(errors: ValidationError[]): boolean {
  // Any ERROR severity prevents publish
  return !errors.some(error => error.severity === 'ERROR');
}

/**
 * Generate validation cards for UI display
 */
export function generateValidationCards(
  workbookData: Map<string, any[]>,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): ValidationCard[] {
  const cards: ValidationCard[] = [];
  
  // Schema Verification Card
  const schemaCard = generateSchemaVerificationCard(workbookData, errors);
  cards.push(schemaCard);
  
  // Curriculum 6Es Card
  const curriculumCard = generateCurriculumCard(workbookData, errors);
  cards.push(curriculumCard);
  
  // Artifacts Card
  const artifactsCard = generateArtifactsCard(workbookData, errors);
  cards.push(artifactsCard);
  
  return cards;
}

/**
 * Generate Schema Verification validation card
 */
function generateSchemaVerificationCard(
  workbookData: Map<string, any[]>,
  errors: ValidationError[]
): ValidationCard {
  // Check if all required tables are present
  const missingTables = REQUIRED_LTE_TABLES.filter(
    table => !workbookData.has(table) || workbookData.get(table)!.length === 0
  );
  
  // Check for schema-related errors
  const schemaErrors = errors.filter(
    e => e.code === 'MISSING_WORKSHEET' || 
         e.code === 'INVALID_HEADER' ||
         e.code === 'DUPLICATE_CONFLICT'
  );
  
  if (missingTables.length > 0 || schemaErrors.length > 0) {
    return {
      id: 'schema-verification',
      category: 'SCHEMA_VERIFICATION',
      title: '13-Table Database Schema',
      message: `Schema validation failed: ${missingTables.length > 0 ? `Missing tables: ${missingTables.join(', ')}` : `${schemaErrors.length} error(s) found`}`,
      severity: 'ERROR',
      icon: 'error',
    };
  }
  
  return {
    id: 'schema-verification',
    category: 'SCHEMA_VERIFICATION',
    title: '13-Table Database Schema',
    message: `All ${workbookData.size} LTE tables validated successfully`,
    severity: 'INFO',
    icon: 'checkmark',
  };
}

/**
 * Generate Curriculum 6Es validation card
 */
function generateCurriculumCard(
  workbookData: Map<string, any[]>,
  errors: ValidationError[]
): ValidationCard {
  // Check if modules_content table exists (contains 6Es stages)
  const modulesContent = workbookData.get('modules_content');
  const modules = workbookData.get('modules');
  
  if (!modulesContent || modulesContent.length === 0) {
    return {
      id: 'curriculum-6es',
      category: 'CURRICULUM_6ES',
      title: '6 Es Framework',
      message: 'No module content found',
      severity: 'WARNING',
      icon: 'warning',
    };
  }
  
  // Check for curriculum-related errors
  const curriculumErrors = errors.filter(
    e => e.table === 'modules_content' || e.table === 'modules'
  );
  
  if (curriculumErrors.length > 0) {
    return {
      id: 'curriculum-6es',
      category: 'CURRICULUM_6ES',
      title: '6 Es Framework',
      message: `${curriculumErrors.length} error(s) in module curriculum`,
      severity: 'ERROR',
      icon: 'error',
    };
  }
  
  const moduleCount = modules?.length || 0;
  
  return {
    id: 'curriculum-6es',
    category: 'CURRICULUM_6ES',
    title: '6 Es Framework',
    message: `${moduleCount} module(s) mapped to 6 Es stages successfully`,
    severity: 'INFO',
    icon: 'checkmark',
  };
}

/**
 * Generate Artifacts validation card
 */
function generateArtifactsCard(
  workbookData: Map<string, any[]>,
  errors: ValidationError[]
): ValidationCard {
  const artifacts = workbookData.get('module_artifacts');
  const questions = workbookData.get('artifact_questions');
  const templates = workbookData.get('artifact_templates');
  
  if (!artifacts || artifacts.length === 0) {
    return {
      id: 'artifacts',
      category: 'ARTIFACTS',
      title: 'Artifact Practices',
      message: 'No artifact practices found',
      severity: 'WARNING',
      icon: 'warning',
    };
  }
  
  // Check for artifact-related errors
  const artifactErrors = errors.filter(
    e => e.table === 'module_artifacts' || 
         e.table === 'artifact_questions' ||
         e.table === 'artifact_templates'
  );
  
  if (artifactErrors.length > 0) {
    return {
      id: 'artifacts',
      category: 'ARTIFACTS',
      title: 'Artifact Practices',
      message: `${artifactErrors.length} error(s) in artifact structure`,
      severity: 'ERROR',
      icon: 'error',
    };
  }
  
  const questionCount = questions?.length || 0;
  const templateCount = templates?.length || 0;
  
  return {
    id: 'artifacts',
    category: 'ARTIFACTS',
    title: 'Artifact Practices',
    message: `${artifacts.length} artifact(s), ${questionCount} question(s), ${templateCount} template(s) validated`,
    severity: 'INFO',
    icon: 'checkmark',
  };
}

/**
 * Aggregate validation errors from multiple sources
 */
export function aggregateValidationErrors(
  parsingErrors: ValidationError[],
  fkErrors: ValidationError[],
  duplicateResults: Map<string, DuplicateDetectionResult>
): ValidationError[] {
  const errors: ValidationError[] = [
    ...parsingErrors,
    ...fkErrors,
  ];
  
  // Add duplicate errors
  for (const [table, result] of duplicateResults.entries()) {
    for (const error of result.errors) {
      errors.push({
        severity: 'ERROR',
        code: 'DUPLICATE_CONFLICT',
        message: error.message,
        table,
        row: error.row,
      });
    }
  }
  
  return errors;
}
