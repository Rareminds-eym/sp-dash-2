import { NextResponse } from 'next/server';
import { uploadEducatorDocument } from '@/lib/services/r2-educator-storage';
import { requireEducatorAdmin } from '@/lib/educator-admin';

/**
 * POST /api/educators/upload-document
 * Upload educator documents to R2 bucket
 */
export async function POST(request) {
  const auth = await requireEducatorAdmin(request);
  if (auth.error) return auth.error;
  console.log('📤 [UPLOAD API] POST /api/educators/upload-document started')
  
  try {
    console.log('📤 [UPLOAD API] Parsing form data...')
    const formData = await request.formData();
    
    const file = formData.get('file');
    const educatorId = formData.get('educatorId');
    const documentType = formData.get('documentType');

    console.log('📤 [UPLOAD API] Received data:', {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      educatorId,
      documentType
    })

    // Validation
    if (!file) {
      console.error('❌ [UPLOAD API] No file provided')
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!educatorId) {
      console.error('❌ [UPLOAD API] No educator ID provided')
      return NextResponse.json({ error: 'No educator ID provided' }, { status: 400 });
    }

    if (!documentType) {
      console.error('❌ [UPLOAD API] No document type provided')
      return NextResponse.json({ error: 'No document type provided' }, { status: 400 });
    }

    // Validate document type
    const validTypes = ['degree-certificate', 'id-proof', 'experience-letters'];
    if (!validTypes.includes(documentType)) {
      console.error('❌ [UPLOAD API] Invalid document type:', documentType)
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }

    // Validate file type
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png'
    ];
    
    if (!allowedMimeTypes.includes(file.type)) {
      console.error('❌ [UPLOAD API] Invalid file type:', file.type)
      return NextResponse.json({ 
        error: 'Invalid file type. Only PDF, JPG, and PNG files are allowed.' 
      }, { status: 400 });
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      console.error('❌ [UPLOAD API] File too large:', file.size)
      return NextResponse.json({ 
        error: 'File too large. Maximum size is 5MB.' 
      }, { status: 400 });
    }

    console.log('✅ [UPLOAD API] Validation passed, calling R2 upload service...')
    
    // Upload to R2
    const result = await uploadEducatorDocument(file, educatorId, documentType, request.url);

    console.log('📤 [UPLOAD API] R2 upload result:', result)

    if (!result.success) {
      console.error('❌ [UPLOAD API] R2 upload failed:', result.error)
      return NextResponse.json({ 
        error: result.error || 'Failed to upload document' 
      }, { status: 500 });
    }

    console.log('✅ [UPLOAD API] Upload successful:', result.url)
    
    return NextResponse.json({
      success: true,
      url: result.url,
      key: result.key
    });

  } catch (error) {
    console.error('❌ [UPLOAD API] Unexpected error:', error);
    console.error('❌ [UPLOAD API] Error message:', error.message);
    console.error('❌ [UPLOAD API] Error stack:', error.stack);
    
    return NextResponse.json({ 
      error: 'Failed to upload document', 
      details: error.message 
    }, { status: 500 });
  }
}
