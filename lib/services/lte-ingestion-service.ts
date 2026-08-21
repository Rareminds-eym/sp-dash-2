import Logger, { getErrorMessage } from '@/lib/logger';
import {
  LTEArtifactPractice,
  LTECourseMetadata,
  LTEIngestionSnapshot,
  LTELevelCourse,
  LTEModule,
  LTERelationalValidationReport,
  LTESchemaValidationItem,
  LTEStage6E,
  LTETableSummary,
  StageType6E,
} from '@/types/lte-ingestion';
import { parseXLSX, validateRequiredTables, WorksheetData } from './lte-ingestion/xlsx-parser';
import { normalizeHeaders } from './lte-ingestion/header-normalizer';
import { createSnapshot, calculateHash, NormalizedSnapshot } from './lte-ingestion/snapshot-serializer';
import { generateValidationReport, ValidationResult } from './lte-ingestion/validation-reporter';
import { detectDuplicates } from './lte-ingestion/duplicate-detector';
import {
  EMPTY_JSON_ARRAY_COLUMNS,
  EMPTY_JSON_OBJECT_COLUMNS,
  EXPECTED_6E_STAGE_LABELS,
  PIPE_JSON_COLUMNS,
  REQUIRED_LTE_TABLES,
} from './lte-ingestion/constants';
import { isJsonNullText, normalizeJsonValue } from './lte-ingestion/json-parser';

const logger = new Logger('LTEIngestionService');

export const REQUIRED_15_TABLES: readonly string[] = REQUIRED_LTE_TABLES;

/**
 * Convert validation result to LTE validation report format
 */
function convertValidationResult(
  validationResult: ValidationResult,
  totalRows: number
): LTERelationalValidationReport {
  // Convert table summaries
  const tableSummaries: LTETableSummary[] = Object.entries(validationResult.tableSummary).map(
    ([tableName, summary]) => ({
      tableName,
      rowCount: summary.rowCount,
      status: summary.errorCount > 0 ? 'error' : summary.skipCount > 0 ? 'skipped' : 'ready',
      details: `${summary.insertCount} to insert, ${summary.skipCount} to skip, ${summary.errorCount} errors`,
    })
  );

  // Convert validation cards to schema validation items
  const validationItems: LTESchemaValidationItem[] = validationResult.validationCards.map((card) => ({
    id: card.id,
    code: card.category,
    title: card.title,
    message: card.message,
    category: card.category,
    level: card.severity === 'ERROR' ? 'error' : card.severity === 'WARNING' ? 'warning' : 'info',
    verified: card.severity === 'INFO',
  }));

  return {
    verified: validationResult.publishReady,
    tableSummaries,
    validationItems,
    totalRowsParsed: totalRows,
    errors: validationResult.errors.map((e) => e.message),
    warnings: validationResult.warnings.map((w) => w.message),
  };
}

export class LTEIngestionService {
  /**
   * Parse and validate Google Sheets shareable URL or uploaded XLSX file
   */
  public static async processIngestionSource(
    sourceType: 'google_sheets' | 'xlsx',
    sourceIdentifier: string,
    rawBuffer?: ArrayBuffer,
    userId?: string
  ): Promise<LTEIngestionSnapshot> {
    // Temporary uploadId - will be replaced with database ID after insert
    const uploadId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    logger.info(`Starting LTE ingestion process for ${sourceType}`, {
      uploadId,
      sourceIdentifier,
      userId,
      bufferSizeBytes: rawBuffer ? rawBuffer.byteLength : 0,
    });

    try {
      // Validate file size for XLSX
      if (sourceType === 'xlsx' && rawBuffer) {
        if (rawBuffer.byteLength > 10 * 1024 * 1024) {
          throw new Error('File size exceeds maximum allowed limit of 10 MB.');
        }
      }

      // Parse the workbook
      let worksheets: WorksheetData[];
      let totalRows = 0;

      if (sourceType === 'xlsx' && rawBuffer) {
        const buffer = Buffer.from(rawBuffer);
        const parsed = await parseXLSX(buffer, sourceIdentifier);
        worksheets = parsed.worksheets;
        totalRows = parsed.metadata.totalRows;

        // Validate required tables
        const missingTables = validateRequiredTables(worksheets);
        if (missingTables.length > 0) {
          throw new Error(
            `Missing required worksheets: ${missingTables.join(', ')}. All 13 LTE catalog tables must be present.`
          );
        }

        logger.info('XLSX file parsed successfully', {
          uploadId,
          sheetsCount: worksheets.length,
          totalRows,
        });
      } else {
        // Google Sheets ingestion not yet implemented
        throw new Error('Google Sheets ingestion is not yet implemented.');
      }

      // Normalize headers for all worksheets
      const normalizedWorksheets = worksheets.map(ws => ({
        ...ws,
        columns: normalizeHeaders(ws.columns),
      }));

      // Create workbook data map
      const workbookData = new Map<string, any[]>();
      const parsingErrors: ValidationResult['errors'] = [];
      for (const worksheet of normalizedWorksheets) {
        const rows = worksheet.rows.map((rowData, rowIndex) => {
          const rowObject: any = {};
          worksheet.columns.forEach((colName, colIndex) => {
            const tableColumn = `${worksheet.tableName}|${colName}`;
            const rawValue = rowData[colIndex];

            try {
              if (isJsonNullText(rawValue)) {
                rowObject[colName] = null;
              } else if (
                (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') &&
                EMPTY_JSON_ARRAY_COLUMNS.has(tableColumn)
              ) {
                rowObject[colName] = [];
              } else if (
                (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') &&
                (EMPTY_JSON_OBJECT_COLUMNS.has(tableColumn) || colName === 'metadata')
              ) {
                rowObject[colName] = {};
              } else if (PIPE_JSON_COLUMNS.has(tableColumn) || colName === 'metadata') {
                rowObject[colName] = normalizeJsonValue(worksheet.tableName, colName, rawValue);
              } else {
                rowObject[colName] = rawValue;
              }
            } catch (err: unknown) {
              rowObject[colName] = rawValue;
              parsingErrors.push({
                severity: 'ERROR',
                code: 'INVALID_STRUCTURED_FIELD',
                message: `${worksheet.tableName}.${colName} row ${rowIndex + 2}: ${getErrorMessage(err)}`,
                table: worksheet.tableName,
                row: rowIndex + 2,
                column: colName,
              });
            }
          });
          return rowObject;
        });
        workbookData.set(worksheet.tableName, rows);
      }

      // Detect duplicates within the upload
      const duplicateResults = new Map();
      for (const [tableName, rows] of workbookData.entries()) {
        const result = detectDuplicates(tableName, rows);
        duplicateResults.set(tableName, result);
      }

      // Detect existing records in database
      // For now, use a stub implementation without DB queries
      // This will be enhanced when database integration is added
      const existingResult = {
        existingUUIDs: new Set<string>(),
        existingUniqueKeys: new Map<string, Set<string>>(),
        referenceTableRecords: new Map<string, any[]>(),
      };

      // Generate validation report
      const validationResult = generateValidationReport(
        workbookData,
        duplicateResults,
        existingResult,
        parsingErrors
      );

      // Create normalized snapshot
      const normalizedSnapshot = createSnapshot(workbookData, sourceType, sourceIdentifier);
      const snapshotHash = calculateHash(normalizedSnapshot);

      logger.info('Normalized snapshot created', {
        uploadId,
        snapshotHash,
        tableCount: normalizedSnapshot.metadata.tableCount,
        totalRows: normalizedSnapshot.metadata.totalRows,
      });

      // Convert validation result to LTE format
      const validationReport = convertValidationResult(validationResult, totalRows);

      logger.info('Validation report generated', {
        uploadId,
        verified: validationReport.verified,
        errorsCount: validationReport.errors.length,
        warningsCount: validationReport.warnings.length,
      });

      // Extract course metadata and modules for each uploaded level/course row.
      const levelCourses: LTELevelCourse[] = this.extractLevelCourses(normalizedSnapshot);
      const courseMetadata: LTECourseMetadata = levelCourses[0]?.courseMetadata || this.extractCourseMetadata(normalizedSnapshot);
      const modules: LTEModule[] = levelCourses[0]?.modules || this.extractModules(normalizedSnapshot);

      const snapshot: LTEIngestionSnapshot = {
        uploadId,
        sourceType,
        sourceName: sourceIdentifier,
        snapshotHash,
        tables: normalizedSnapshot.tables,
        metadata: normalizedSnapshot.metadata,
        courseMetadata,
        modules,
        levelCourses,
        validationReport,
        createdAt: new Date().toISOString(),
        status: validationReport.verified ? 'validated' : 'validation_failed',
      };

      logger.info('LTE ingestion process completed successfully', {
        uploadId,
        snapshotHash,
        status: snapshot.status,
        totalRows: validationReport.totalRowsParsed,
        levelCoursesCount: levelCourses.length,
      });

      return snapshot;
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err);
      logger.error('Error processing LTE ingestion source', { error: errMsg });
      throw new Error(errMsg);
    }
  }

  /**
   * Extract each uploaded level/course row into a reviewable course tab.
   */
  public static extractLevelCourses(snapshot: NormalizedSnapshot): LTELevelCourse[] {
    const capabilities = this.getTableRowsAsObjects(snapshot, 'capabilities');
    const roles = this.getTableRowsAsObjects(snapshot, 'roles');
    const levels = this.getTableRowsAsObjects(snapshot, 'levels');
    const modules = this.getTableRowsAsObjects(snapshot, 'modules');
    const modulesContent = this.getTableRowsAsObjects(snapshot, 'modules_content');
    const eContent = this.getTableRowsAsObjects(snapshot, 'e_content');
    const moduleArtifacts = this.getTableRowsAsObjects(snapshot, 'module_artifacts');

    const primaryRole = roles[0] || {};
    const rowsToDisplay = levels.length > 0 ? levels : capabilities;

    return rowsToDisplay.map((levelRow: any, idx: number) => {
      const capability = this.findCapabilityForLevel(levelRow, capabilities) || capabilities[idx] || capabilities[0] || {};
      const levelNo = this.toNumber(
        levelRow.level_no ?? levelRow.proficiency_level ?? levelRow.level_id ?? idx + 1,
        idx + 1
      );
      const levelCode = this.firstText(
        levelRow.level_code,
        levelRow.proficiency_level,
        rowsToDisplay === capabilities ? levelRow.code : undefined,
        `L${levelNo}`
      );
      const capabilityCode = this.firstText(
        levelRow.capability_code,
        capability.code,
        capability.capability_code,
        'UNKNOWN'
      );
      const capabilityName = this.firstText(
        capability.name,
        capability.capability_name,
        levelRow.capability_name,
        levelRow.title,
        'Course'
      );
      const domain = this.firstText(
        levelRow.domain,
        capability.domain,
        primaryRole.domain_name,
        'General'
      );
      const instructorLead = this.firstText(
        levelRow.instructor_lead,
        levelRow.instructor,
        capability.instructor_lead,
        primaryRole.instructor_lead,
        'Unknown Instructor'
      );
      const courseTitle = this.firstText(
        levelRow.course_title,
        levelRow.course_name,
        levelRow.title,
        levelRow.name,
        `${capabilityName} - ${levelCode}`
      );
      const courseCode = this.firstText(
        levelRow.course_code,
        levelRow.level_code,
        `${capabilityCode}_${levelCode}`
      );
      const courseSummary = this.firstText(
        levelRow.course_summary,
        levelRow.summary,
        levelRow.description,
        ''
      );
      const problemStatement = this.firstText(levelRow.problem_statement, '');
      const capstoneTitle = this.firstText(
        levelRow.final_capstone_artifact_title,
        levelRow.capstone_artifact_title,
        levelRow.capstone_title,
        ''
      );

      const courseMetadata: LTECourseMetadata = {
        courseTitle,
        courseCode,
        domain,
        capabilityCode,
        capabilityLevel: `Level ${levelNo}`,
        instructorLead,
        courseSummary,
        problemStatement,
        capstoneTitle,
      };

      // Filter modules belonging to this level
      const levelModulesRows = modules.filter((m: any) =>
        this.moduleBelongsToLevel(m, levelRow, levelNo, levelCode)
      );

      const formattedModules: LTEModule[] = levelModulesRows.map((modRow: any, modIdx: number) => {
        const modId = this.firstText(modRow.id, modRow.module_id, '');
        const modNo = Number(modRow.module_no ?? modRow.index ?? modIdx);
        const modTitle = this.firstText(
          modRow.title,
          modRow.module_title,
          modRow.name,
          `Module ${modNo}: Environment & Core Concepts`
        );
        const modSubtitle = this.firstText(
          modRow.subtitle,
          modRow.context_description,
          `${levelCode} Module ${modNo}`
        );

        const modContentRows = modulesContent.filter((mc: any) => this.valuesMatch(mc.module_id, modId));
        const contentIds = new Set(modContentRows.map((mc: any) => String(mc.id)).filter(Boolean));

        const matchedEContent = eContent.filter((ec: any) => contentIds.has(String(ec.modules_content_id)));

        const standard6Es: StageType6E[] = [...EXPECTED_6E_STAGE_LABELS];
        const stages: LTEStage6E[] = standard6Es.map((stageName, sIdx) => {
          const moduleContent = modContentRows.find((mc: any) =>
            String(mc.stage_name || mc.lte_6e_stage || '').toLowerCase() === stageName.toLowerCase()
          );
          const match = matchedEContent.find((ec: any) =>
            this.valuesMatch(ec.modules_content_id, moduleContent?.id)
          );

          return {
            id: match?.id || moduleContent?.id || `stage_${modId || modIdx}_${sIdx}`,
            stageIndex: sIdx + 1,
            name: stageName,
            label: this.firstText(match?.stage_label, match?.label, stageName),
            subtitle: this.firstText(match?.subtitle, match?.content_title, match?.title, moduleContent?.stage_description, `${stageName} phase`),
            description: this.firstText(match?.description, match?.content_description, moduleContent?.stage_description, moduleContent?.module_context, `${stageName} activities for ${modTitle}`),
            mediaType: (match?.content_type as any) || 'article',
            estimatedDuration: this.formatDuration(match?.duration_seconds || match?.duration || match?.estimated_duration),
            contentItemsCount: moduleContent ? Math.max(1, matchedEContent.filter((ec: any) => this.valuesMatch(ec.modules_content_id, moduleContent.id)).length) : 0,
            xpReward: Number(match?.xp || match?.xp_reward) || 50,
            prerequisites: this.metadataList(moduleContent?.curriculum_reference?.prerequisites),
            technicalConcepts: this.metadataList(moduleContent?.curriculum_reference?.technical_concepts),
            engineeringContext: this.firstText(moduleContent?.module_context, moduleContent?.curriculum_reference?.workplace_context, ''),
          };
        });

        const matchedArtifacts = moduleArtifacts.filter((ma: any) => contentIds.has(String(ma.modules_content_id)));
        const artifactPractices: LTEArtifactPractice[] = matchedArtifacts.length > 0
          ? matchedArtifacts.map((art: any, aIdx: number) => ({
              id: art.id || `art_${modId || modIdx}_${aIdx}`,
              moduleIndex: modNo,
              practiceIndex: (aIdx === 0 ? 1 : 2) as 1 | 2,
              title: this.firstText(art.title, art.name, art.artifact_title, `Artifact Practice ${aIdx + 1}`),
            }))
          : [
              {
                id: `art_${modIdx}_1`,
                moduleIndex: modNo,
                practiceIndex: 1,
                title: `${modTitle} - Practice 1`,
              },
              {
                id: `art_${modIdx}_2`,
                moduleIndex: modNo,
                practiceIndex: 2,
                title: `${modTitle} - Practice 2`,
              },
            ];

        return {
          index: modNo,
          title: modTitle,
          subtitle: modSubtitle,
          completionPercentage: 0,
          status: 'in_progress',
          stages,
          artifactPractices,
          contextDescription: modRow.context_description || '',
        };
      });

      return {
        levelCode,
        levelNo,
        levelName: this.firstText(levelRow.level_name, levelRow.proficiency_level, `Level ${levelNo}`),
        courseMetadata,
        modules: formattedModules,
      };
    });
  }

  private static findCapabilityForLevel(levelRow: any, capabilities: any[]): any | null {
    return capabilities.find((cap: any) =>
      this.valuesMatch(levelRow.capability_id, cap.id) ||
      this.valuesMatch(levelRow.capability_code, cap.code) ||
      this.valuesMatch(levelRow.capability_code, cap.capability_code)
    ) || null;
  }

  private static moduleBelongsToLevel(moduleRow: any, levelRow: any, levelNo: number, levelCode: string): boolean {
    return this.valuesMatch(moduleRow.level_id, levelRow.id) ||
      this.valuesMatch(moduleRow.level_code, levelCode) ||
      this.valuesMatch(moduleRow.level_no, levelNo);
  }

  private static valuesMatch(left: any, right: any): boolean {
    if (left === null || left === undefined || right === null || right === undefined) return false;
    return String(left).trim().toLowerCase() === String(right).trim().toLowerCase();
  }

  private static firstText(...values: any[]): string {
    for (const value of values) {
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return '';
  }

  private static toNumber(value: any, fallback: number): number {
    const match = String(value ?? '').match(/\d+/);
    return match ? Number(match[0]) : fallback;
  }

  private static formatDuration(value: any): string {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return `${Math.round(numeric / 60)} mins`;
    }
    return this.firstText(value, '15 mins');
  }

  private static metadataList(value: any): string[] {
    if (Array.isArray(value)) {
      return value.map(item => String(item)).filter(Boolean);
    }
    if (value === null || value === undefined || String(value).trim() === '') {
      return [];
    }
    return [String(value).trim()];
  }

  private static getTableRowsAsObjects(snapshot: NormalizedSnapshot, tableName: string): any[] {
    const table = snapshot.tables[tableName];
    if (!table || !table.rows || table.rows.length === 0) return [];
    const columns = table.columns;
    return table.rows.map((rowArray: any[]) => {
      const obj: any = {};
      columns.forEach((col, idx) => {
        obj[col] = rowArray[idx];
      });
      return obj;
    });
  }

  /**
   * Extract course metadata from normalized snapshot
   * (Fallback method for single metadata object)
   */
  private static extractCourseMetadata(snapshot: NormalizedSnapshot): LTECourseMetadata {
    const coursesData = snapshot.tables['courses'] || snapshot.tables['levels'];
    if (coursesData && coursesData.rows.length > 0) {
      const firstCourse = coursesData.rows[0];
      const columns = coursesData.columns;
      
      const courseObj: any = {};
      columns.forEach((col, idx) => {
        courseObj[col] = firstCourse[idx];
      });

      return {
        courseTitle: courseObj.course_title || courseObj.title || 'Untitled Course',
        courseCode: courseObj.course_code || courseObj.code || 'UNKNOWN',
        domain: courseObj.domain || 'General',
        capabilityCode: courseObj.capability_code || 'UNKNOWN',
        capabilityLevel: courseObj.capability_level || 'Level 1',
        instructorLead: courseObj.instructor_lead || courseObj.instructor || 'Unknown Instructor',
        courseSummary: courseObj.course_summary || courseObj.summary || '',
        problemStatement: courseObj.problem_statement || '',
        capstoneTitle: courseObj.capstone_title || courseObj.capstone_artifact_title || '',
      };
    }

    return {
      courseTitle: 'Course Title Not Found',
      courseCode: 'UNKNOWN',
      domain: 'General',
      capabilityCode: 'UNKNOWN',
      capabilityLevel: 'Level 1',
      instructorLead: 'Unknown Instructor',
      courseSummary: '',
      problemStatement: '',
      capstoneTitle: '',
    };
  }

  /**
   * Extract modules from normalized snapshot
   * (Fallback method for single module array)
   */
  private static extractModules(snapshot: NormalizedSnapshot): LTEModule[] {
    const modulesData = snapshot.tables['modules'];
    if (!modulesData || modulesData.rows.length === 0) {
      return [];
    }

    return [
      {
        index: 0,
        title: 'Module 0: Environment Setup',
        subtitle: 'Basic environment configuration',
        completionPercentage: 0,
        status: 'in_progress',
        contextDescription: 'Setting up development environment',
        stages: [],
        artifactPractices: [],
      },
    ];
  }
}
