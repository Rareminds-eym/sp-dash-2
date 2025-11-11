import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { filterAndRankResults } from '@/lib/search-utils';
import { handleError } from '@/lib/middleware/errorHandler';

export const runtime = 'edge';

/**
 * GET /api/audit-logs/export - Export audit logs to CSV
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Filter parameters (same as list endpoint)
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');
    
    // Build query (no pagination for export)
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(5000); // Max 5000 records for export
    
    // Apply same filters as list endpoint
    if (action) query = query.eq('action', action);
    if (userId) query = query.eq('actorId', userId);
    if (dateFrom) query = query.gte('createdAt', dateFrom);
    if (dateTo) query = query.lte('createdAt', dateTo);
    if (search) query = query.or(`target.ilike.%${search}%,action.ilike.%${search}%,ip.ilike.%${search}%`);
    
    const { data: logs, error } = await query;

    if (error) {
      console.error('Error fetching audit logs for export:', error);
      return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
    }
    
    // Fetch user emails
    let enrichedLogs = logs || [];
    if (enrichedLogs.length > 0) {
      const userIds = [...new Set(enrichedLogs.map(l => l.actorId).filter(Boolean))];
      
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, email, metadata')
          .in('id', userIds);
        
        const userMap = {};
        users?.forEach(user => { 
          userMap[user.id] = {
            email: user.email,
            name: user.metadata?.name || user.email
          };
        });
        
        enrichedLogs.forEach(log => {
          if (log.actorId && userMap[log.actorId]) {
            log.users = userMap[log.actorId];
          }
        });
      }
    }
    
    // Apply industrial-grade fuzzy search and relevance ranking for export
    if (search) {
      const searchFields = ['target', 'action', 'ip', 'users.email', 'users.name'];
      enrichedLogs = filterAndRankResults(enrichedLogs, searchFields, search, 0.7);
    }
    
    // Generate CSV
    const csvHeaders = ['Timestamp', 'User', 'Email', 'Action', 'Target', 'IP Address', 'Details'];
    const csvRows = enrichedLogs.map(log => [
      new Date(log.createdAt).toLocaleString(),
      log.users?.name || 'System',
      log.users?.email || 'N/A',
      log.action.replace(/_/g, ' ').toUpperCase(),
      log.target || 'N/A',
      log.ip || 'N/A',
      JSON.stringify(log.payload || {}).substring(0, 100)
    ]);
    
    const csv = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const today = new Date().toISOString().split('T')[0];
    
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="audit-logs-${today}.csv"`
      }
    });
  } catch (error) {
    return handleError(error, 'Audit Logs Export');
  }
}
