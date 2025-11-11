import { supabaseAdmin } from '@/lib/supabase-admin';
import { filterAndRankResults } from '@/lib/search-utils';
import { createCSVResponse } from '@/lib/services/exportService';
import { handleError } from '@/lib/middleware/errorHandler';

export const runtime = 'edge';

/**
 * GET /api/recruiters/export - Export recruiters to CSV
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    
    // Apply same filters as main list
    const statusFilter = url.searchParams.get('status');
    const activeFilter = url.searchParams.get('active');
    const stateFilter = url.searchParams.get('state');
    const searchTerm = url.searchParams.get('search');
    
    let query = supabaseAdmin.from('recruiters').select('*');
    
    // Apply status filter
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('verificationstatus', statusFilter);
    }
    
    // Apply active/suspended filter
    if (activeFilter && activeFilter !== 'all' && activeFilter !== '') {
      query = query.eq('isactive', activeFilter === 'true');
    }
    
    // Apply state filter
    if (stateFilter && stateFilter !== 'all') {
      query = query.eq('state', stateFilter);
    }
    
    // Apply search filter
    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,state.ilike.%${searchTerm}%,website.ilike.%${searchTerm}%`);
    }
    
    query = query.order('createdat', { ascending: false });
    
    const { data: recruiters, error } = await query;
    
    if (error) {
      return NextResponse.json({ error: 'Failed to export recruiters' }, { status: 500 });
    }
    
    // Apply industrial-grade fuzzy search and relevance ranking
    let filteredRecruiters = recruiters || [];
    if (searchTerm) {
      const mappedRecruiters = filteredRecruiters.map(r => ({
        ...r,
        name: r.name,
        email: r.email,
        phone: r.phone,
        district: r.district,
        website: r.website,
        state: r.state
      }));
      
      const searchFields = ['name', 'email', 'phone', 'district', 'website', 'state'];
      filteredRecruiters = filterAndRankResults(mappedRecruiters, searchFields, searchTerm, 0.7);
    }
    
    // Create CSV content
    const headers = ['Name', 'Email', 'Phone', 'State', 'District', 'Website', 'Status', 'Active', 'Created Date'];
    const csvRows = [headers.join(',')];
    
    filteredRecruiters?.forEach(r => {
      const row = [
        `"${r.name || ''}"`,
        `"${r.email || ''}"`,
        `"${r.phone || ''}"`,
        `"${r.state || ''}"`,
        `"${r.district || ''}"`,
        `"${r.website || ''}"`,
        `"${r.verificationstatus || 'approved'}"`,
        r.isactive ? 'Yes' : 'No',
        r.createdat ? new Date(r.createdat).toLocaleDateString() : ''
      ];
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    const filename = `recruiters-${new Date().toISOString().split('T')[0]}.csv`;
    
    return createCSVResponse(csvContent, filename);
  } catch (error) {
    return handleError(error, 'Recruiters Export');
  }
}
