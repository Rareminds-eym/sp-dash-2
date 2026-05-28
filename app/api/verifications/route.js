import { NextResponse } from 'next/server';
import { authenticateSSORequest } from '@/lib/middleware/sso-auth';
import { handleError } from '@/lib/middleware/errorHandler';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

/**
 * GET /api/verifications - List recent verifications
 */
export async function GET(request) {
  try {
    const { error, user } = await authenticateSSORequest(request, ['super_admin', 'admin']);
    if (error) return error;
    
    const { data: verifications, error: queryError } = await supabaseAdmin
      .from('verifications')
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(50);

    if (queryError) {
      console.error('Error fetching verifications:', queryError);
      return NextResponse.json({ error: 'Failed to fetch verifications' }, { status: 500 });
    }
    
    // Fetch all user emails in bulk using RLS client
    if (verifications && verifications.length > 0) {
      const userIds = verifications.map(v => v.performedBy).filter(Boolean);
      
      if (userIds.length > 0) {
        const { data: users } = await supabaseAdmin
          .from('users')
          .select('id, email')
          .in('id', userIds);
        
        const userMap = {};
        users?.forEach(user => { userMap[user.id] = user; });
        
        verifications.forEach(verification => {
          if (verification.performedBy && userMap[verification.performedBy]) {
            verification.users = userMap[verification.performedBy];
          }
        });
      }
    }
    
    return NextResponse.json(verifications || []);
  } catch (error) {
    return handleError(error, 'Verifications');
  }
}
