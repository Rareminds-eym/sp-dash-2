import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/middleware/auth';
import { handleError } from '@/lib/middleware/errorHandler';

export const runtime = 'edge';

/**
 * GET /api/verifications - List recent verifications
 */
export async function GET(request) {
  try {
    const { rlsClient, error } = await authenticateRequest(request, ['/verifications']);
    if (error) return error;
    
    const { data: verifications, error: queryError } = await rlsClient
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
        const { data: users } = await rlsClient
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
