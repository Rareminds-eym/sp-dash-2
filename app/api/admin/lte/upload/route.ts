import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import Logger, { getErrorMessage } from '@/lib/logger';
import { LTEIngestionService } from '@/lib/services/lte-ingestion-service';
import { LTEIngestionSnapshot, LTEUploadResponse } from '@/types/lte-ingestion';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { supabaseLTE } from '@/lib/supabase-lte';

const logger = new Logger('LTEUploadAPI');

export const runtime = 'nodejs';

// File upload limits
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_TOTAL_ROWS = 10000;

/**
 * Calculate SHA-256 hash of file buffer
 */
function calculateFileHash(buffer: ArrayBuffer): string {
  const hash = createHash('sha256');
  hash.update(Buffer.from(buffer));
  return hash.digest('hex');
}

export async function POST(request: NextRequest): Promise<NextResponse<LTEUploadResponse>> {
  logger.info('Processing LTE course upload request');

  try {
    // Authenticate admin user
    const { user, error: authError } = await authenticateSSORequest(
      request,
      ['admin', 'super_admin', 'platform_admin']
    );

    if (authError || !user) {
      logger.warn('Unauthorized upload attempt');
      return authError || NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.info('User authenticated for upload', { userId: user.userId, role: user.role });

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = (await request.json()) as { googleSheetsUrl?: string };
      const url = body.googleSheetsUrl?.trim();

      if (!url) {
        logger.warn('Google Sheets URL was empty');
        return NextResponse.json(
          { success: false, error: 'Please enter a valid Google Sheets URL.' },
          { status: 400 }
        );
      }

      logger.info('Ingesting from Google Sheets URL', { url });
      const snapshot = await LTEIngestionService.processIngestionSource('google_sheets', url);

      return NextResponse.json({
        success: true,
        uploadId: snapshot.uploadId,
        snapshot,
      });
    }

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!file || !(file instanceof File)) {
        logger.warn('No XLSX file uploaded');
        return NextResponse.json(
          { success: false, error: 'Please select a valid .xlsx workbook file.' },
          { status: 400 }
        );
      }

      // Validate file type
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        logger.warn('Invalid file type', { fileName: file.name });
        return NextResponse.json(
          { success: false, error: 'File must be a .xlsx Excel workbook.' },
          { status: 400 }
        );
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        logger.warn('File too large', { fileSize: file.size, maxSize: MAX_FILE_SIZE });
        return NextResponse.json(
          { success: false, error: `File size exceeds maximum allowed limit of ${MAX_FILE_SIZE / 1024 / 1024} MB.` },
          { status: 400 }
        );
      }

      logger.info('Ingesting from XLSX file', { fileName: file.name, fileSize: file.size });
      
      // Read file into buffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Calculate source file hash
      const sourceFileHash = calculateFileHash(arrayBuffer);
      logger.info('Calculated source file hash', { sourceFileHash });

      // Process ingestion
      const snapshot = await LTEIngestionService.processIngestionSource(
        'xlsx',
        file.name,
        arrayBuffer,
        user.userId
      );

      // Validate total row count
      if (snapshot.validationReport.totalRowsParsed > MAX_TOTAL_ROWS) {
        logger.warn('Too many rows', { 
          totalRows: snapshot.validationReport.totalRowsParsed, 
          maxRows: MAX_TOTAL_ROWS 
        });
        return NextResponse.json(
          { 
            success: false, 
            error: `Total row count (${snapshot.validationReport.totalRowsParsed}) exceeds maximum allowed limit of ${MAX_TOTAL_ROWS} rows.` 
          },
          { status: 400 }
        );
      }

      const { data: latestVersion, error: versionError } = await supabaseLTE
        .from('catalog_versions')
        .select('version_no')
        .eq('entity_type', 'catalog')
        .order('version_no', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (versionError) {
        logger.error('Failed to read latest catalog version', { error: versionError });
        throw new Error(`Database version lookup failed: ${versionError.message}`);
      }

      const nextVersionNo = (latestVersion?.version_no || 0) + 1;
      const versionStatus = snapshot.status === 'validated' ? 'VALIDATED' : 'DRAFT';

      // Store the parsed upload as the next catalog version snapshot.
      const { data: uploadRecord, error: insertError } = await supabaseLTE
        .from('catalog_versions')
        .insert({
          entity_type: 'catalog',
          entity_id: null,
          version_no: nextVersionNo,
          status: versionStatus,
          snapshot_hash: snapshot.snapshotHash,
          snapshot_data: {
            ...snapshot,
            sourceFileHash,
          },
          change_reason: `UPLOAD:${file.name}`,
          created_by: user.userId,
        })
        .select('id, status')
        .single();

      if (insertError) {
        logger.error('Failed to insert upload record', { error: insertError });
        throw new Error(`Database insert failed: ${insertError.message}`);
      }

      logger.info('Catalog version snapshot created', { uploadId: uploadRecord.id, versionNo: nextVersionNo });

      // Update snapshot with the database-generated ID and reviewedSnapshotHash
      const finalSnapshot: LTEIngestionSnapshot = {
        ...snapshot,
        uploadId: uploadRecord.id,
        reviewedSnapshotHash: snapshot.snapshotHash,
        status: uploadRecord.status === 'VALIDATED' ? 'validated' : 'validation_failed',
      };

      return NextResponse.json({
        success: true,
        uploadId: uploadRecord.id,
        snapshot: finalSnapshot,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unsupported Content-Type header.' },
      { status: 400 }
    );
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error('Failed to process LTE upload', { error: errorMessage });

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
