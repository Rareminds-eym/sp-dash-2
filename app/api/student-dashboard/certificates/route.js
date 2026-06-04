import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { handleError } from '@/lib/middleware/errorHandler';

export const runtime = 'nodejs';

/**
 * GET /api/student-dashboard/certificates - Get student certificates and download statistics
 */
export async function GET(request) {
    try {
        const { error: authError } = await authenticateSSORequest(request, ['super_admin', 'admin']);
        if (authError) return authError;

        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const offset = (page - 1) * limit;
        const search = url.searchParams.get('search') || '';
        const courseId = url.searchParams.get('course_id');
        const downloadRange = url.searchParams.get('download_range');
        const dateRangeStart = url.searchParams.get('date_range_start');
        const dateRangeEnd = url.searchParams.get('date_range_end');

        // Try different possible table names for certificates
        const possibleTableNames = [
            'certificates', 
            'learner_certificates', 
            'student_certificates',
            'credentials',
            'learner_credentials',
            'skill_certificates'
        ];

        let certificatesData = [];
        let totalCount = 0;
        let tableFound = false;

        // Try to find the correct table name
        for (const tableName of possibleTableNames) {
            try {
                // First, get total count with all filters applied
                let countQuery = supabaseAdmin
                    .from(tableName)
                    .select('*', { count: 'exact', head: true });

                // Apply search filter for count
                if (search) {
                    countQuery = countQuery.or(`
                        title.ilike.%${search}%,
                        credential_id.ilike.%${search}%,
                        issuer.ilike.%${search}%
                    `);
                }

                // Apply course filter for count (if course mapping exists)
                if (courseId && courseId !== 'all') {
                    countQuery = countQuery.eq('course_id', courseId);
                }

                // Apply date range filter for count
                if (dateRangeStart && dateRangeEnd) {
                    countQuery = countQuery.gte('created_at', dateRangeStart)
                                          .lte('created_at', dateRangeEnd);
                }

                const { count, error: countError } = await countQuery;

                if (countError) {
                    continue; // Try next table
                }

                // Now build the main query with same filters
                let query = supabaseAdmin
                    .from(tableName)
                    .select(`
                        *,
                        users:learner_id (
                            firstName,
                            lastName,
                            email
                        )
                    `);

                // Apply same filters to main query
                if (search) {
                    query = query.or(`
                        title.ilike.%${search}%,
                        credential_id.ilike.%${search}%,
                        issuer.ilike.%${search}%
                    `);
                }

                if (courseId && courseId !== 'all') {
                    query = query.eq('course_id', courseId);
                }

                if (dateRangeStart && dateRangeEnd) {
                    query = query.gte('created_at', dateRangeStart)
                                 .lte('created_at', dateRangeEnd);
                }

                // Apply pagination
                query = query.range(offset, offset + limit - 1);

                const { data, error } = await query;

                if (!error && data) {
                    certificatesData = data;
                    totalCount = count || 0;
                    tableFound = true;
                    console.log(`Found certificates in table: ${tableName}`);
                    break;
                }
            } catch (err) {
                // Continue to next table name
                continue;
            }
        }

        // If no table found, try a simpler query without joins
        if (!tableFound) {
            try {
                let query = supabaseAdmin
                    .from('certificates')
                    .select('*', { count: 'exact' });

                if (search) {
                    query = query.or(`
                        title.ilike.%${search}%,
                        credential_id.ilike.%${search}%,
                        issuer.ilike.%${search}%
                    `);
                }

                if (dateRangeStart && dateRangeEnd) {
                    query = query.gte('created_at', dateRangeStart)
                                 .lte('created_at', dateRangeEnd);
                }

                query = query.range(offset, offset + limit - 1);

                const { data, error, count } = await query;

                if (!error && data) {
                    certificatesData = data;
                    totalCount = count || 0;
                    tableFound = true;
                }
            } catch (err) {
                console.error('Error querying certificates table:', err);
            }
        }

        // If still no data found, return empty result
        if (!tableFound) {
            console.log('No certificates table found. Available tables might have different names.');
            return NextResponse.json({
                data: [],
                stats: {
                    totalCertificates: 0,
                    totalDownloads: 0,
                    avgDownloadsPerCert: 0
                },
                pagination: {
                    page,
                    limit,
                    total: 0,
                    totalPages: 0
                },
                message: 'Certificates table not found. Please check table name.'
            });
        }

        // Transform the data to match frontend expectations
        const transformedCertificates = certificatesData.map(cert => {
            // Handle user data from join or use learner_id
            const userData = cert.users || {};
            const studentName = userData.firstName && userData.lastName 
                ? `${userData.firstName} ${userData.lastName}`
                : cert.learner_name || `Learner ${cert.learner_id || 'Unknown'}`;
            const studentEmail = userData.email || cert.learner_email || null;

            return {
                id: cert.id || cert.credential_id,
                certificateId: cert.credential_id || cert.id,
                studentName,
                studentEmail,
                courseName: cert.title || cert.course_name || 'Unknown Course',
                courseId: cert.course_id || 'unknown',
                issuer: cert.issuer || 'Unknown Issuer',
                level: cert.level || 'Unknown Level',
                issueDate: cert.created_at || cert.issued_at || cert.issue_date,
                downloadCount: cert.download_count || 0, // Use actual download count or 0
                lastDownloaded: cert.last_downloaded || null, // Use actual last downloaded date or null
                link: cert.link || null
            };
        });

        // Apply download range filter (this needs to be done client-side as it's not a database field)
        let filteredCerts = transformedCertificates;
        let finalTotalCount = totalCount;

        if (downloadRange) {
            filteredCerts = transformedCertificates.filter(cert => {
                const count = cert.downloadCount;
                switch (downloadRange) {
                    case '0':
                        return count === 0;
                    case '1-5':
                        return count >= 1 && count <= 5;
                    case '6-15':
                        return count >= 6 && count <= 15;
                    case '16-50':
                        return count >= 16 && count <= 50;
                    case '50+':
                        return count > 50;
                    default:
                        return true;
                }
            });
            
            // If download range filter is applied, we need to recalculate total
            // This is not ideal for pagination, but necessary since download_count might not be in DB
            if (downloadRange) {
                // For now, use the filtered count as total (not ideal for large datasets)
                finalTotalCount = filteredCerts.length;
            }
        }

        // Calculate stats from filtered certificates
        const totalDownloads = filteredCerts.reduce((sum, cert) => sum + cert.downloadCount, 0);
        const stats = {
            totalCertificates: finalTotalCount,
            totalDownloads,
            avgDownloadsPerCert: filteredCerts.length > 0 ? totalDownloads / filteredCerts.length : 0
        };

        return NextResponse.json({
            data: filteredCerts,
            stats,
            pagination: {
                page,
                limit,
                total: finalTotalCount,
                totalPages: Math.ceil(finalTotalCount / limit)
            }
        });
    } catch (error) {
        console.error('Certificates API Error:', error);
        return handleError(error, 'Student Certificates');
    }
}
