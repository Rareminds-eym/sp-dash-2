import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../../../../../lib/supabase';
import { createRLSClient, getUserContext } from '../../../../../../lib/supabase-rls';
import { logAudit } from '../../../../../../lib/services/auditService';
import { addCacheHeaders } from '../../../../../../lib/services/cacheService';

export const runtime = 'edge';

// GET colleges for a specific university
export async function GET(request, { params }) {
  try {
    const universityId = params.id;

    const { data: colleges, error } = await supabase
      .from('university_colleges')
      .select('*')
      .eq('university_id', universityId)
      .order('name');

    if (error) {
      console.error('Error fetching university colleges:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const response = NextResponse.json(colleges || []);
    return addCacheHeaders(response, 'static');
  } catch (error) {
    console.error('Error in universities/[id]/colleges GET:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create a college within a university (already exists from Phase 2, but adding GET support here)
