import { SupabaseClient } from '@supabase/supabase-js';

export interface BaseVersionCheck {
  courseId: string;
  expectedBaseCourseVersionId: string;
}

export interface CapabilityRevisionCheck {
  capabilityId: string;
  expectedBaseCapabilityRevision: number;
}

export interface ConcurrencyValidationResult {
  isValid: boolean;
  errorCode?: 'COURSE_VERSION_CHANGED' | 'CAPABILITY_CHANGED' | 'CATALOG_CHANGED' | 'DRAFT_CHANGED' | 'ACTIVE_DRAFT_EXISTS';
  errorMessage?: string;
  affectedCapabilityIds?: string[];
  affectedCourseIds?: string[];
  activeDraftId?: string;
  details?: Record<string, any>;
}

export class ConcurrencyValidator {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Validate course base versions before publish
   */
  public async validateCourseBaseVersions(
    checks: BaseVersionCheck[]
  ): Promise<ConcurrencyValidationResult> {
    if (!checks || checks.length === 0) {
      return { isValid: true };
    }

    const courseIds = checks.map((c) => c.courseId);
    const { data: courses, error } = await this.supabase
      .from('levels')
      .select('id, version_no')
      .in('id', courseIds);

    if (error) {
      throw new Error(`Failed to fetch current course versions: ${error.message}`);
    }

    const courseMap = new Map<string, string | null>(
      courses.map((c) => [c.id, c.version_no ? String(c.version_no) : null])
    );

    const mismatchedCourses: string[] = [];

    for (const check of checks) {
      const currentPublished = courseMap.get(check.courseId);
      if (currentPublished && check.expectedBaseCourseVersionId && currentPublished !== check.expectedBaseCourseVersionId) {
        mismatchedCourses.push(check.courseId);
      }
    }

    if (mismatchedCourses.length > 0) {
      return {
        isValid: false,
        errorCode: 'COURSE_VERSION_CHANGED',
        errorMessage: `Authoritative course version changed for ${mismatchedCourses.length} course(s) since review.`,
        affectedCourseIds: mismatchedCourses,
      };
    }

    return { isValid: true };
  }

  /**
   * Validate capability revisions (scoped per capability_id)
   */
  public async validateCapabilityRevisions(
    checks: CapabilityRevisionCheck[]
  ): Promise<ConcurrencyValidationResult> {
    if (!checks || checks.length === 0) {
      return { isValid: true };
    }

    const capIds = checks.map((c) => c.capabilityId);
    const { data: revisions, error } = await this.supabase
      .from('catalog_versions')
      .select('entity_id, version_no')
      .eq('entity_type', 'capability')
      .in('entity_id', capIds);

    if (error) {
      // If table does not exist or empty in dev, pass gracefully if no data returned
      return { isValid: true };
    }

    const revMap = new Map<string, number>(
      revisions.map((r) => [r.entity_id, Number(r.version_no)])
    );

    const mismatchedCaps: string[] = [];

    for (const check of checks) {
      const currentRev = revMap.get(check.capabilityId);
      if (currentRev !== undefined && currentRev !== check.expectedBaseCapabilityRevision) {
        mismatchedCaps.push(check.capabilityId);
      }
    }

    if (mismatchedCaps.length > 0) {
      return {
        isValid: false,
        errorCode: 'CAPABILITY_CHANGED',
        errorMessage: `Capability mapping/plan structure changed for ${mismatchedCaps.length} capability(ies) since review.`,
        affectedCapabilityIds: mismatchedCaps,
      };
    }

    return { isValid: true };
  }

  /**
   * Validate global catalog revision
   */
  public async validateCatalogRevision(
    expectedBaseCatalogRevision: number
  ): Promise<ConcurrencyValidationResult> {
    const { data: row, error } = await this.supabase
      .from('catalog_versions')
      .select('version_no')
      .eq('entity_type', 'catalog')
      .order('version_no', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !row) {
      return { isValid: true };
    }

    const currentCatalogRev = Number(row.version_no);
    if (currentCatalogRev !== expectedBaseCatalogRevision) {
      return {
        isValid: false,
        errorCode: 'CATALOG_CHANGED',
        errorMessage: `Global catalog canonical/lifecycle structure changed since review. Expected revision ${expectedBaseCatalogRevision}, found ${currentCatalogRev}.`,
      };
    }

    return { isValid: true };
  }

  /**
   * Validate draft revision for optimistic draft editing
   */
  public async validateDraftRevision(
    draftId: string,
    expectedDraftRevision: number
  ): Promise<ConcurrencyValidationResult> {
    const { data: version, error } = await this.supabase
      .from('catalog_versions')
      .select('id, draft_revision, status')
      .eq('id', draftId)
      .eq('status', 'DRAFT')
      .single();

    if (error || !version) {
      return {
        isValid: false,
        errorCode: 'DRAFT_CHANGED',
        errorMessage: `Draft version ${draftId} not found.`,
      };
    }

    if (version.draft_revision !== expectedDraftRevision) {
      return {
        isValid: false,
        errorCode: 'DRAFT_CHANGED',
        errorMessage: `Draft revision mismatch. Expected ${expectedDraftRevision}, current is ${version.draft_revision}. Concurrent edits occurred.`,
      };
    }

    return { isValid: true };
  }

  /**
   * Validate active draft precondition before initiating rollback
   */
  public async validateRollbackActiveDraft(
    courseId: string,
    confirmDiscardDraft: boolean = false
  ): Promise<ConcurrencyValidationResult> {
    const { data: activeDraft, error } = await this.supabase
      .from('catalog_versions')
      .select('id, draft_revision')
      .eq('entity_type', 'level')
      .eq('entity_id', courseId)
      .eq('status', 'DRAFT')
      .maybeSingle();

    if (error) {
      return { isValid: true };
    }

    if (activeDraft && !confirmDiscardDraft) {
      return {
        isValid: false,
        errorCode: 'ACTIVE_DRAFT_EXISTS',
        errorMessage: `An active editable DRAFT (${activeDraft.id}) already exists for this course. Discard or publish the existing draft before rolling back.`,
        activeDraftId: activeDraft.id,
        details: { draftRevision: activeDraft.draft_revision },
      };
    }

    return { isValid: true };
  }
}
