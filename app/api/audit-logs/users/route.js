import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { handleError } from '@/lib/middleware/errorHandler';

export const runtime = 'edge';

/**
 * GET /api/audit-logs/users - Get users who have performed actions
 */
export async function GET(request) {
  try {
    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select('actorId')
      .not('actorId', 'is', null)
      .limit(1000);

    if (error) {
      console.error('Error fetching actor users:', error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    const uniqueUserIds = [...new Set(logs.map(l => l.actorId))];
    
    if (uniqueUserIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email, metadata')
        .in('id', uniqueUserIds);
      
      if (usersError) {
        console.error('Error fetching users:', usersError);
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
      }
      
      const usersWithNames = users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.metadata?.name || u.email
      }));
      
      return NextResponse.json(usersWithNames);
    }
    
    return NextResponse.json([]);
  } catch (error) {
    return handleError(error, 'Audit Log Users');
  }
}
