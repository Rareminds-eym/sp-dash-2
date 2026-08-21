export type StageType6E = 'Engage' | 'Explore' | 'Explain' | 'Express' | 'Empower' | 'Evolve';

export interface LTEStage6E {
  id: string;
  stageIndex: number;
  name: StageType6E;
  label: string;
  subtitle: string;
  description: string;
  mediaType: 'video' | 'article' | 'quiz' | 'interactive';
  estimatedDuration: string;
  contentItemsCount: number;
  xpReward: number;
  prerequisites: string[];
  technicalConcepts: string[];
  engineeringContext: string;
  isCompleted?: boolean;
}

export interface LTEArtifactPractice {
  id: string;
  moduleIndex: number;
  practiceIndex: 1 | 2;
  title: string;
}

export interface LTEModule {
  index: number;
  title: string;
  subtitle: string;
  completionPercentage: number;
  status: 'locked' | 'in_progress' | 'completed';
  stages: LTEStage6E[];
  artifactPractices: LTEArtifactPractice[];
  contextDescription: string;
}

export interface LTECourseMetadata {
  courseTitle: string;
  courseCode: string;
  domain: string;
  capabilityCode: string;
  capabilityLevel: string;
  instructorLead: string;
  courseSummary: string;
  problemStatement: string;
  capstoneTitle: string;
}

export interface LTETableSummary {
  tableName: string;
  rowCount: number;
  status: 'ready' | 'skipped' | 'warning' | 'error';
  details: string;
}

export interface LTESchemaValidationItem {
  id: string;
  code: string;
  title: string;
  message: string;
  category: 'SCHEMA_VERIFICATION' | 'CURRICULUM_6ES' | 'ARTIFACTS' | 'GENERAL';
  level: 'info' | 'warning' | 'error';
  verified: boolean;
}

export interface LTERelationalValidationReport {
  verified: boolean;
  tableSummaries: LTETableSummary[];
  validationItems: LTESchemaValidationItem[];
  totalRowsParsed: number;
  errors: string[];
  warnings: string[];
}

export interface LTELevelCourse {
  levelCode: string;
  levelNo: number;
  levelName: string;
  courseMetadata: LTECourseMetadata;
  modules: LTEModule[];
}

export interface LTEIngestionSnapshot {
  uploadId: string;
  sourceType: 'google_sheets' | 'xlsx';
  sourceName: string;
  snapshotHash: string;
  tables?: Record<string, {
    columns: string[];
    rows: any[][];
  }>;
  metadata?: {
    sourceType: 'xlsx' | 'google_sheets';
    sourceName: string;
    tableCount: number;
    totalRows: number;
    parsedAt: string;
  };
  courseMetadata: LTECourseMetadata;
  modules: LTEModule[];
  levelCourses?: LTELevelCourse[];
  validationReport: LTERelationalValidationReport;
  createdAt: string;
  status: 'uploaded' | 'validating' | 'validated' | 'published' | 'validation_failed';
}

export interface LTEUploadResponse {
  success: boolean;
  uploadId?: string;
  snapshot?: LTEIngestionSnapshot;
  error?: string;
}

export interface LTEPublishResult {
  success: boolean;
  status: string;
  inserted: number;
  skipped: number;
  completedAt: string;
  error?: string;
}

export interface LearnerStageInfo {
  stage: LTEStage6E;
  module: LTEModule;
  currentStageIndex: number;
  totalStages: number;
}
