import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import Logger, { getErrorMessage } from '@/lib/logger';
import { LTEIngestionService } from '@/lib/services/lte-ingestion-service';
import { LTEUploadResponse } from '@/types/lte-ingestion';
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

      // Insert into lte_catalog_uploads table
      const { data: uploadRecord, error: insertError } = await supabaseLTE
        .from('lte_catalog_uploads')
        .insert({
          source_type: snapshot.sourceType,
          source_name: snapshot.sourceName,
          source_file_hash: sourceFileHash,
          snapshot_hash: snapshot.snapshotHash,
          reviewed_snapshot_hash: snapshot.snapshotHash,
          normalized_snapshot: snapshot, // Legacy backfill field
          reviewed_snapshot: snapshot,   // Authoritative v2.1 reviewed snapshot
          validation_result: snapshot.validationReport,
          status: snapshot.status,
          asset_status: 'none',
          created_by: user.userId,
        })
        .select('id')
        .single();

      if (insertError) {
        logger.error('Failed to insert upload record', { error: insertError });
        throw new Error(`Database insert failed: ${insertError.message}`);
      }

      logger.info('Upload record created', { uploadId: uploadRecord.id });

      // Update snapshot with the database-generated ID and reviewedSnapshotHash
      const finalSnapshot = {
        ...snapshot,
        uploadId: uploadRecord.id,
        reviewedSnapshotHash: snapshot.snapshotHash,
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
