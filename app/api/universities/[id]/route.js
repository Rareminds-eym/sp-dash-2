import { NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabase';
import { addCacheHeaders } from '../../../../../lib/services/cacheService';

export const runtime = 'edge';

export async function GET(request, { params }) {
  try {
    const universityId = params.id;

    // Fetch university details
    const { data: university, error: univError } = await supabase
      .from('universities')
      .select('*')
      .eq('id', universityId)
      .single();

    if (univError || !university) {
      return NextResponse.json(
        { error: 'University not found' },
        { status: 404 }
      );
    }

    // Fetch colleges
    const { data: colleges } = await supabase
      .from('university_colleges')
      .select('*')
      .eq('university_id', universityId)
      .order('name');

    // Count students
    const { data: students } = await supabase
      .from('students')
      .select('id')
      .eq('universityid', universityId);

    const response = NextResponse.json({
      ...university,
      colleges: colleges || [],
      studentCount: students?.length || 0
    });
    return addCacheHeaders(response, 'static');
  } catch (error) {
    console.error('Error fetching university:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
