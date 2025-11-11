import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../../../../../lib/supabase';
import { createRLSClient, getUserContext } from '../../../../../../lib/supabase-rls';
import { logAudit } from '../../../../../../lib/services/auditService';

export const runtime = 'edge';

export async function POST(request, { params }) {
  try {
    const { supabase: rlsClient, user, error: authError } = await createRLSClient(request);
    
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userContext = await getUserContext(rlsClient, user);
    
    if (!userContext) {
      return NextResponse.json({ error: 'User context not found' }, { status: 403 });
    }
    
    const body = await request.json();
    const universityId = params.id;
    const { name, code, deanName, deanEmail, deanPhone, establishedYear, description } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: 'Name and code are required' },
        { status: 400 }
      );
    }

    // Check if university exists
    const { data: university } = await supabase
      .from('universities')
      .select('id')
      .eq('id', universityId)
      .single();

    if (!university) {
      return NextResponse.json(
        { error: 'University not found' },
        { status: 404 }
      );
    }

    // Create college
    const { data, error: insertError } = await supabase
      .from('university_colleges')
      .insert({
        id: uuidv4(),
        university_id: universityId,
        name,
        code,
        dean_name: deanName,
        dean_email: deanEmail,
        dean_phone: deanPhone,
        established_year: establishedYear,
        description,
        account_status: 'active'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating college:', insertError);
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    // Log audit
    if (body.userId) {
      await logAudit(body.userId, 'create_college', data.id, { name, universityId });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
