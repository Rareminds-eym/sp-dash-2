/**
 * R2 Educator Document Storage Service
 * Uploads educator documents (degree certificate, ID proof, experience letters) to Cloudflare R2
 */

import crypto from 'crypto';

/**
 * Upload a file to R2 bucket
 * @param {File|Buffer} file - File to upload
 * @param {string} educatorId - Unique educator ID
 * @param {string} documentType - Type: 'degree-certificate' | 'id-proof' | 'experience-letters'
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export async function uploadEducatorDocument(file, educatorId, documentType) {
  console.log('☁️ [R2 SERVICE] Upload started')
  console.log('☁️ [R2 SERVICE] Params:', { educatorId, documentType, fileName: file.name })
  
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

    console.log('☁️ [R2 SERVICE] Environment check:', {
      hasAccountId: !!accountId,
      hasAccessKeyId: !!accessKeyId,
      hasSecretKey: !!secretAccessKey,
      hasBucketName: !!bucketName,
      accountId: accountId?.substring(0, 8) + '...',
      bucketName
    })

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error('Missing R2 configuration');
    }

    console.log('☁️ [R2 SERVICE] Converting file to buffer...')
    // Get file buffer
    const buffer = Buffer.isBuffer(file) ? file : Buffer.from(await file.arrayBuffer());
    console.log('☁️ [R2 SERVICE] Buffer size:', buffer.length, 'bytes')
    
    // Generate payload hash (full SHA256 of file content)
    const payloadHash = crypto.createHash('sha256').update(buffer).digest('hex');
    console.log('☁️ [R2 SERVICE] Payload hash:', payloadHash)
    
    // Generate content hash for filename (shortened)
    const contentHash = payloadHash.substring(0, 16);
    console.log('☁️ [R2 SERVICE] Content hash (for filename):', contentHash)
    
    // Get file extension
    const fileName = file.name || 'document';
    const ext = fileName.substring(fileName.lastIndexOf('.')) || '.pdf';
    console.log('☁️ [R2 SERVICE] File extension:', ext)
    
    // Generate R2 key
    const key = `educator-documents/${educatorId}/${documentType}-${contentHash}${ext}`;
    console.log('☁️ [R2 SERVICE] R2 key:', key)
    
    // R2 API endpoint - use bucket subdomain format
    const r2Host = `${bucketName}.${accountId}.r2.cloudflarestorage.com`;
    const r2Endpoint = `https://${r2Host}/${key}`;
    console.log('☁️ [R2 SERVICE] R2 host:', r2Host)
    console.log('☁️ [R2 SERVICE] R2 endpoint:', r2Endpoint)
    
    // Generate AWS Signature V4
    console.log('☁️ [R2 SERVICE] Generating AWS Signature V4...')
    const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = timestamp.substring(0, 8);
    const region = 'auto';
    const service = 's3';
    
    // Create canonical request
    const method = 'PUT';
    const canonicalUri = `/${key}`;
    const canonicalQueryString = '';
    const canonicalHeaders = `host:${r2Host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${timestamp}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    
    const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    
    // Create string to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const canonicalRequestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
    const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${canonicalRequestHash}`;
    
    // Calculate signature
    const kDate = crypto.createHmac('sha256', `AWS4${secretAccessKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
    
    // Build authorization header
    const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    
    console.log('☁️ [R2 SERVICE] Signature generated, uploading to R2...')
    
    // Upload to R2
    const response = await fetch(r2Endpoint, {
      method: 'PUT',
      headers: {
        'Authorization': authorizationHeader,
        'x-amz-date': timestamp,
        'x-amz-content-sha256': payloadHash,
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: buffer
    });
    
    console.log('☁️ [R2 SERVICE] R2 response status:', response.status, response.statusText)
    
    if (!response.ok) {
      const error = await response.text();
      console.error('❌ [R2 SERVICE] R2 upload failed:', error)
      throw new Error(`R2 upload failed: ${response.status} ${error}`);
    }
    
    // Return public URL (you may need to configure R2 public access or use pre-signed URLs)
    const publicUrl = `https://pub-${accountId}.r2.dev/${key}`;
    
    console.log('✅ [R2 SERVICE] Upload successful')
    console.log('✅ [R2 SERVICE] Public URL:', publicUrl)
    
    return {
      success: true,
      url: publicUrl,
      key: key
    };
    
  } catch (error) {
    console.error('❌ [R2 SERVICE] Error:', error);
    console.error('❌ [R2 SERVICE] Error message:', error.message);
    console.error('❌ [R2 SERVICE] Error stack:', error.stack);
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate a temporary educator ID for file uploads
 * @returns {string} Temporary educator ID
 */
export function generateEducatorId() {
  return `EDU-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}
