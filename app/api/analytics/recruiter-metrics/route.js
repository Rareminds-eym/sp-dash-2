import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { addCacheHeaders } from '@/lib/services/cacheService';
import { handleError } from '@/lib/middleware/errorHandler';

export const runtime = 'edge';

/**
 * GET /api/analytics/recruiter-metrics - Recruiter engagement analytics
 */
export async function GET(request) {
  try {
    // Fetch real recruiter metrics data
    const { data: recruiters, error: recruiterError } = await supabase
      .from('recruiters')
      .select('id');
    
    if (recruiterError) throw recruiterError;

    const totalRecruiters = recruiters?.length || 0;
    const activeRecruiters = recruiters?.filter(r => r.isactive === true).length || 0;

    // Fetch user count for recruiters
    const { data: users } = await supabase
      .from('users')
      .select('organizationId')
      .in('organizationId', recruiters?.map(r => r.id) || []);

    const totalUsers = users?.length || 0;

    // Mock engagement data (can be replaced with real data later)
    const engagementData = [
      { month: 'Jan', engagement: 45 },
      { month: 'Feb', engagement: 52 },
      { month: 'Mar', engagement: 61 },
      { month: 'Apr', engagement: 58 },
      { month: 'May', engagement: 67 },
      { month: 'Jun', engagement: 73 }
    ];

    const response = NextResponse.json({
      totalRecruiters,
      activeRecruiters,
      totalUsers,
      engagementData
    });
    
    return addCacheHeaders(response, 'dynamic');
  } catch (error) {
    return handleError(error, 'Recruiter Metrics');
  }
}
