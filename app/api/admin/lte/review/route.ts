import { NextRequest, NextResponse } from 'next/server';
import Logger, { getErrorMessage } from '@/lib/logger';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseLTE } from '@/lib/supabase-lte';
import { LTEIngestionSnapshot } from '@/types/lte-ingestion';

const logger = new Logger('LTEReviewAPI');

export const runtime = 'nodejs';

interface ReviewResponse {
  success: boolean;
  uploadId?: string;
  sourceName?: string;
  status?: string;
  validationReport?: any;
  courseSpecification?: any;
  modules?: any[];
  levelCourses?: any[];
  createdAt?: string;
  error?: string;
}

/**
 * GET /api/admin/lte/review
 * Retrieve validated upload snapshot by upload ID for review
 */
export async function GET(request: NextRequest): Promise<NextResponse<ReviewResponse>> {
  logger.info('Processing LTE review request');

  try {
    // Authenticate admin user
    const { user, error: authError } = await authenticateSSORequest(
      request,
      ['admin', 'super_admin', 'platform_admin']
    );

    if (authError || !user) {
      logger.warn('Unauthorized review attempt');
      return authError || NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.info('User authenticated for review', { userId: user.userId, role: user.role });

    // Get uploadId from query parameters
    const { searchParams } = new URL(request.url);
    const uploadId = searchParams.get('uploadId');

    if (!uploadId) {
      logger.warn('Missing uploadId parameter');
      return NextResponse.json(
        { success: false, error: 'Missing uploadId query parameter' },
        { status: 400 }
      );
    }

    logger.info('Fetching upload record', { uploadId });

    // Query lte_catalog_uploads table
    const { data: uploadRecord, error: fetchError } = await supabaseLTE
      .from('lte_catalog_uploads')
      .select('*')
      .eq('id', uploadId)
      .single();

    if (fetchError) {
      logger.error('Failed to fetch upload record', { error: fetchError });
      return NextResponse.json(
        { success: false, error: 'Upload not found' },
        { status: 404 }
      );
    }

    if (!uploadRecord) {
      logger.warn('Upload record not found', { uploadId });
      return NextResponse.json(
        { success: false, error: 'Upload not found' },
        { status: 404 }
      );
    }

    // Verify upload belongs to current user or user has admin role
    const hasAccess = 
      uploadRecord.created_by === user.userId ||
      ['admin', 'super_admin', 'platform_admin'].includes(user.role);

    if (!hasAccess) {
      logger.warn('Unauthorized access to upload', { 
        uploadId, 
        userId: user.userId, 
        ownerId: uploadRecord.created_by 
      });
      return NextResponse.json(
        { success: false, error: 'Unauthorized to access this upload' },
        { status: 403 }
      );
    }

    logger.info('Upload record retrieved', { 
      uploadId, 
      status: uploadRecord.status,
      sourceName: uploadRecord.source_name 
    });

    // Extract snapshot from reviewed_snapshot or fallback normalized_snapshot JSONB column
    const rawSnapshot = uploadRecord.reviewed_snapshot || uploadRecord.normalized_snapshot;
    const reviewedHash = uploadRecord.reviewed_snapshot_hash || uploadRecord.snapshot_hash;
    
    const snapshot: LTEIngestionSnapshot = {
      ...(rawSnapshot as LTEIngestionSnapshot),
      uploadId: uploadRecord.id,
      reviewedSnapshotHash: reviewedHash,
      snapshotHash: reviewedHash,
      status: uploadRecord.status,
    };

    // Extract course specification from the snapshot
    const courseSpecification = extractCourseSpecification(snapshot);

    // Extract modules with 6 Es stages from the snapshot
    const modules = extractModulesWithStages(snapshot);

    logger.info('Review data prepared', { 
      uploadId, 
      courseTitle: courseSpecification?.courseTitle,
      modulesCount: modules.length,
      reviewedHash,
    });

    return NextResponse.json({
      success: true,
      uploadId: uploadRecord.id,
      sourceName: uploadRecord.source_name,
      status: uploadRecord.status,
      reviewedSnapshotHash: reviewedHash,
      snapshot,
      validationReport: uploadRecord.validation_result,
      courseSpecification,
      modules,
      levelCourses: snapshot.levelCourses || [],
      createdAt: uploadRecord.created_at,
    });

  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error('Failed to process LTE review request', { error: errorMessage });

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * Extract course specification from normalized snapshot
 */
function extractCourseSpecification(snapshot: LTEIngestionSnapshot): any {
  if (!snapshot || !snapshot.courseMetadata) {
    return {
      courseTitle: 'Unknown Course',
      courseCode: 'UNKNOWN',
      domain: 'General',
      capabilityCode: 'UNKNOWN',
      capabilityLevel: 'Level 1',
      instructorLead: 'Unknown Instructor',
      courseSummary: '',
      problemStatement: '',
      capstoneArtifactTitle: '',
    };
  }

  return {
    courseTitle: snapshot.courseMetadata.courseTitle || 'Untitled Course',
    courseCode: snapshot.courseMetadata.courseCode || 'UNKNOWN',
    domain: snapshot.courseMetadata.domain || 'General',
    capabilityCode: snapshot.courseMetadata.capabilityCode || 'UNKNOWN',
    capabilityLevel: snapshot.courseMetadata.capabilityLevel || 'Level 1',
    instructorLead: snapshot.courseMetadata.instructorLead || 'Unknown Instructor',
    courseSummary: snapshot.courseMetadata.courseSummary || '',
    problemStatement: snapshot.courseMetadata.problemStatement || '',
    capstoneArtifactTitle: snapshot.courseMetadata.capstoneTitle || '',
  };
}

/**
 * Extract modules with 6 Es stages from normalized snapshot
 */
function extractModulesWithStages(snapshot: LTEIngestionSnapshot): any[] {
  if (!snapshot || !snapshot.modules) {
    return [];
  }

  // Return modules from snapshot
  // The modules should already include stages and artifact practices
  return snapshot.modules.map((module, index) => ({
    index: module.index ?? index,
    title: module.title || `Module ${index}`,
    subtitle: module.subtitle || '',
    completionPercentage: module.completionPercentage ?? 0,
    status: module.status || 'not_started',
    contextDescription: module.contextDescription || '',
    stages: module.stages || [],
    artifactPractices: module.artifactPractices || [],
  }));
}
