const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Debug: Log environment variables
console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '***' : 'undefined');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateMetricsSnapshot() {
  try {
    console.log('Updating metrics snapshot...');
    
    // Count active universities
    const { data: universities, error: universitiesError } = await supabase
      .from('universities')
      .select('id')
      .eq('isactive', true);
    
    if (universitiesError) throw universitiesError;
    const activeUniversities = universities?.length || 0;
    
    // Count active recruiters
    const { data: recruiters, error: recruitersError } = await supabase
      .from('recruiters')
      .select('id')
      .eq('isactive', true);
    
    if (recruitersError) throw recruitersError;
    const activeRecruiters = recruiters?.length || 0;
    
    // Count students
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id');
    
    if (studentsError) throw studentsError;
    const registeredStudents = students?.length || 0;
    
    // Get passports for verification metrics
    const { data: passports, error: passportsError } = await supabase
      .from('skill_passports')
      .select('status');
    
    if (passportsError) throw passportsError;
    const totalPassports = passports?.length || 0;
    const verifiedPassports = passports?.filter(p => p.status === 'verified').length || 0;
    
    // Calculate employability index
    const employabilityIndex = registeredStudents > 0 
      ? parseFloat(((verifiedPassports / registeredStudents) * 100).toFixed(1))
      : 0;
    
    // Count job secured (hired placements)
    const { data: hiredPlacements, error: placementError } = await supabase
      .from('placements')
      .select('id')
      .eq('placementStatus', 'hired');
    
    if (placementError) throw placementError;
    const jobSecured = hiredPlacements?.length || 0;
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // Check if a snapshot for today already exists
    const { data: existingSnapshot } = await supabase
      .from('metrics_snapshots')
      .select('id')
      .eq('snapshotDate', today)
      .maybeSingle();
    
    let result;
    if (existingSnapshot) {
      // Update existing snapshot
      const { error: updateError } = await supabase
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
      const { error: insertError } = await supabase
        .from('metrics_snapshots')
        .insert({
          id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
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
    
    console.log(`Metrics snapshot ${result.action} successfully for ${result.snapshotDate}`);
    console.log({
      activeUniversities,
      registeredStudents,
      verifiedPassports,
      employabilityIndex,
      activeRecruiters,
      jobSecured
    });
    
    return {
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
    };
  } catch (error) {
    console.error('Error updating metrics snapshot:', error);
    return {
      success: false,
      error: 'Failed to update metrics snapshot',
      details: error.message
    };
  }
}

// Run the function
updateMetricsSnapshot().then(result => {
  console.log('Result:', result);
  process.exit(0);
});