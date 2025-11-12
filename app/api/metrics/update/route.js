import { createRLSClient, getUserContext } from '@/lib/supabase-rls';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'edge';

export async function POST(request) {
  try {
    const { supabase: rlsClient, user, error: authError } = await createRLSClient(request);
    
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userContext = await getUserContext(rlsClient, user);
    
    if (!userContext) {
      return NextResponse.json({ error: 'User context not found' }, { status: 403 });
    }

    // Count active universities from universities table (only where isactive=true)
    const { data: universities, error: universitiesError } = await rlsClient
      .from('universities')
      .select('id')
      .eq('isactive', true);
    
    const activeUniversities = universities?.length || 0;
    
    if (universitiesError) {
      console.error('Error fetching universities:', universitiesError);
    }

    // Count active recruiters from recruiters table (only where isactive=true)
    const { data: recruiters } = await rlsClient
      .from('recruiters')
      .select('id')
      .eq('isactive', true);
    
    const activeRecruiters = recruiters?.length || 0;

    // Count students
    const { data: students } = await rlsClient
      .from('students')
      .select('id');
    
    const registeredStudents = students?.length || 0;

    // Get passports for verification metrics
    const { data: passports } = await rlsClient
      .from('skill_passports')
      .select('status');
    
    const totalPassports = passports?.length || 0;
    const verifiedPassports = passports?.filter(p => p.status === 'verified').length || 0;
    
    // Calculate employability index
    const employabilityIndex = registeredStudents > 0 
      ? parseFloat(((verifiedPassports / registeredStudents) * 100).toFixed(1))
      : 0;

    // Count job secured (hired placements)
    const { data: hiredPlacements, error: placementError } = await rlsClient
      .from('placements')
      .select('id')
      .eq('placementStatus', 'hired');
    
    if (placementError) throw placementError;
    
    const jobSecured = hiredPlacements?.length || 0;

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Check if a snapshot for today already exists
    const { data: existingSnapshot } = await rlsClient
      .from('metrics_snapshots')
      .select('id')
      .eq('snapshotDate', today)
      .maybeSingle();

    let result;
    if (existingSnapshot) {
      // Update existing snapshot
      const { error: updateError } = await rlsClient
        .from('metrics_snapshots')
        .update({
          activeUniversities,
          registeredStudents,
          verifiedPassports,
          employabilityIndex,
          activeRecruiters,
          jobsecured: jobSecured
        })
        .eq('id', existingSnapshot.id);

      if (updateError) throw updateError;
      result = { action: 'updated', snapshotDate: today };
    } else {
      // Insert new snapshot
      const { error: insertError } = await rlsClient
        .from('metrics_snapshots')
        .insert({
          id: uuidv4(),
          snapshotDate: today,
          activeUniversities,
          registeredStudents,
          verifiedPassports,
          employabilityIndex,
          activeRecruiters,
          jobsecured: jobSecured
        });

      if (insertError) throw insertError;
      result = { action: 'created', snapshotDate: today };
    }

    return NextResponse.json({
      success: true,
      message: `Metrics snapshot ${result.action} successfully`,
      data: {
        snapshotDate: result.snapshotDate,
        activeUniversities,
        registeredStudents,
        verifiedPassports,
        employabilityIndex,
        activeRecruiters,
        jobSecured
      }
    });
  } catch (error) {
    console.error('Error updating metrics snapshot:', error);
    return NextResponse.json(
      { error: 'Failed to update metrics snapshot', details: error.message },
      { status: 500 }
    );
  }
}
