import {
  UploadMode,
  MappingResolutionStatus,
  ContentChangeStatus,
  MAPPING_RESOLUTION_STATUS,
  CONTENT_CHANGE_STATUS,
} from './constants';

export interface EntityDiffItem<T = Record<string, any>> {
  entityType: 'capability' | 'role' | 'course' | 'module' | '6e_content' | 'artifact' | 'skill' | 'source_asset';
  stableKey: string;
  mappingStatus: MappingResolutionStatus;
  contentStatus: ContentChangeStatus;
  canonicalId?: string;
  baseVersionId?: string;
  incomingData: T;
  existingData?: T;
  changedFields?: string[];
  isMaterialChange?: boolean;
}

export interface DiffEngineInput {
  uploadMode: UploadMode;
  replacementScope?: 'COURSE';
  replacementTargets?: string[];
  incomingCapabilities: Array<{ capability_code: string; capability_name: string; [key: string]: any }>;
  incomingCourses: Array<{ course_code: string; course_name: string; [key: string]: any }>;
  incoming6EContent: Array<{ content_code: string; module_code: string; stage: string; title: string; [key: string]: any }>;
  incomingAssets: Array<{ logical_asset_key: string; course_code: string; asset_type: string; source_url?: string; [key: string]: any }>;
  existingCapabilities: Map<string, { id: string; code: string; name: string }>;
  existingCourses: Map<string, { id: string; code: string; current_published_version_id?: string; content: any }>;
  existing6EContent: Map<string, { id: string; content_code: string; title: string; content?: string }>;
  existingAssets: Map<string, { id: string; logical_asset_key: string; content_hash?: string }>;
}

export interface DiffEngineResult {
  hasMaterialChanges: boolean;
  requiresNewVersions: Set<string>; // course_codes needing a new version
  diffs: EntityDiffItem[];
  summary: {
    matchedCount: number;
    createNewCount: number;
    modifiedCount: number;
    addedCount: number;
    unchangedCount: number;
    removedCount: number;
  };
}

export class IncrementalDiffEngine {
  public computeDiff(input: DiffEngineInput): DiffEngineResult {
    const diffs: EntityDiffItem[] = [];
    const requiresNewVersions = new Set<string>();

    let matchedCount = 0;
    let createNewCount = 0;
    let modifiedCount = 0;
    let addedCount = 0;
    let unchangedCount = 0;
    let removedCount = 0;

    // 1. Process Capabilities
    for (const cap of input.incomingCapabilities) {
      const code = cap.capability_code;
      const existing = input.existingCapabilities.get(code);

      if (existing) {
        matchedCount++;
        const isModified = cap.capability_name !== existing.name;
        if (isModified) modifiedCount++; else unchangedCount++;

        diffs.push({
          entityType: 'capability',
          stableKey: code,
          mappingStatus: MAPPING_RESOLUTION_STATUS.MATCHED,
          contentStatus: isModified ? CONTENT_CHANGE_STATUS.MODIFIED : CONTENT_CHANGE_STATUS.UNCHANGED,
          canonicalId: existing.id,
          incomingData: cap,
          existingData: existing,
          changedFields: isModified ? ['capability_name'] : [],
        });
      } else {
        createNewCount++;
        addedCount++;
        diffs.push({
          entityType: 'capability',
          stableKey: code,
          mappingStatus: MAPPING_RESOLUTION_STATUS.CREATE_NEW,
          contentStatus: CONTENT_CHANGE_STATUS.ADDED,
          incomingData: cap,
        });
      }
    }

    // 2. Process Courses
    for (const crs of input.incomingCourses) {
      const code = crs.course_code;
      const existing = input.existingCourses.get(code);

      if (existing) {
        matchedCount++;
        const changedFields: string[] = [];

        if (existing.content) {
          if (crs.course_name && crs.course_name !== existing.content.course_name) {
            changedFields.push('course_name');
          }
          if (crs.description && crs.description !== existing.content.description) {
            changedFields.push('description');
          }
        }

        const isModified = changedFields.length > 0;
        if (isModified) {
          modifiedCount++;
          requiresNewVersions.add(code);
        } else {
          unchangedCount++;
        }

        diffs.push({
          entityType: 'course',
          stableKey: code,
          mappingStatus: MAPPING_RESOLUTION_STATUS.MATCHED,
          contentStatus: isModified ? CONTENT_CHANGE_STATUS.MODIFIED : CONTENT_CHANGE_STATUS.UNCHANGED,
          canonicalId: existing.id,
          baseVersionId: existing.current_published_version_id,
          incomingData: crs,
          existingData: existing.content,
          changedFields,
          isMaterialChange: isModified,
        });
      } else {
        createNewCount++;
        addedCount++;
        requiresNewVersions.add(code);
        diffs.push({
          entityType: 'course',
          stableKey: code,
          mappingStatus: MAPPING_RESOLUTION_STATUS.CREATE_NEW,
          contentStatus: CONTENT_CHANGE_STATUS.NOT_APPLICABLE,
          incomingData: crs,
        });
      }
    }

    // 3. Process 6E Content using stable content_code
    for (const item of input.incoming6EContent) {
      const code = item.content_code;
      const existing = input.existing6EContent.get(code);

      if (existing) {
        matchedCount++;
        const changedFields: string[] = [];
        if (item.title !== existing.title) changedFields.push('title');
        if (item.content !== existing.content) changedFields.push('content');

        const isModified = changedFields.length > 0;
        if (isModified) modifiedCount++; else unchangedCount++;

        diffs.push({
          entityType: '6e_content',
          stableKey: code,
          mappingStatus: MAPPING_RESOLUTION_STATUS.MATCHED,
          contentStatus: isModified ? CONTENT_CHANGE_STATUS.MODIFIED : CONTENT_CHANGE_STATUS.UNCHANGED,
          canonicalId: existing.id,
          incomingData: item,
          existingData: existing,
          changedFields,
          isMaterialChange: isModified,
        });
      } else {
        createNewCount++;
        addedCount++;
        diffs.push({
          entityType: '6e_content',
          stableKey: code,
          mappingStatus: MAPPING_RESOLUTION_STATUS.CREATE_NEW,
          contentStatus: CONTENT_CHANGE_STATUS.ADDED,
          incomingData: item,
        });
      }
    }

    // 4. Process Source Assets using stable logical_asset_key
    for (const asset of input.incomingAssets) {
      const key = asset.logical_asset_key;
      const existing = input.existingAssets.get(key);

      if (existing) {
        matchedCount++;
        const isModified = asset.content_hash && asset.content_hash !== existing.content_hash;
        if (isModified) modifiedCount++; else unchangedCount++;

        diffs.push({
          entityType: 'source_asset',
          stableKey: key,
          mappingStatus: MAPPING_RESOLUTION_STATUS.MATCHED,
          contentStatus: isModified ? CONTENT_CHANGE_STATUS.MODIFIED : CONTENT_CHANGE_STATUS.UNCHANGED,
          canonicalId: existing.id,
          incomingData: asset,
          existingData: existing,
          changedFields: isModified ? ['content_hash'] : [],
        });
      } else {
        createNewCount++;
        addedCount++;
        diffs.push({
          entityType: 'source_asset',
          stableKey: key,
          mappingStatus: MAPPING_RESOLUTION_STATUS.CREATE_NEW,
          contentStatus: CONTENT_CHANGE_STATUS.ADDED,
          incomingData: asset,
        });
      }
    }

    return {
      hasMaterialChanges: requiresNewVersions.size > 0,
      requiresNewVersions,
      diffs,
      summary: {
        matchedCount,
        createNewCount,
        modifiedCount,
        addedCount,
        unchangedCount,
        removedCount,
      },
    };
  }
}
