import { supabase } from '../supabase';

/**
 * Fetch dashboard metrics from snapshot or calculate dynamically
 * @param {Object} rlsClient - Supabase RLS client
 * @returns {Object} Metrics data
 */
export async function getDashboardMetrics(rlsClient) {
  try {
    // First, try to fetch the latest snapshot from metrics_snapshots table
    const { data: latestSnapshot, error: snapshotError } = await supabase
      .from('metrics_snapshots')
      .select('*')
      .order('snapshotDate', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    // If we have a snapshot, return it
    if (latestSnapshot && !snapshotError) {
      return {
        activeUniversities: latestSnapshot.activeUniversities || 0,
        registeredStudents: latestSnapshot.registeredStudents || 0,
        verifiedPassports: latestSnapshot.verifiedPassports || 0,
        employabilityIndex: parseFloat(latestSnapshot.employabilityIndex || 0),
        activeRecruiters: latestSnapshot.activeRecruiters || 0,
        jobSecured: latestSnapshot.jobsecured || 0,
        snapshotDate: latestSnapshot.snapshotDate,
        source: 'snapshot'
      };
    }
    
    // Fallback: Calculate metrics dynamically from database tables if no snapshot exists
    console.log('No snapshot found, calculating metrics dynamically');
    
    // Count universities from universities table
    const { data: universities } = await supabase
      .from('universities')
      .select('id');
    
    const activeUniversities = universities?.length || 0;

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
      ? ((verifiedPassports / registeredStudents) * 100).toFixed(1) 
      : 0;

    // Count job secured (hired placements)
    const { data: hiredPlacements } = await rlsClient
      .from('placements')
      .select('id')
      .eq('placementStatus', 'hired');
    
    const jobSecured = hiredPlacements?.length || 0;

    return {
      activeUniversities,
      registeredStudents,
      verifiedPassports,
      employabilityIndex: parseFloat(employabilityIndex),
      activeRecruiters,
      jobSecured,
      source: 'dynamic'
    };
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return {
      activeUniversities: 0,
      registeredStudents: 0,
      verifiedPassports: 0,
      employabilityIndex: 0,
      activeRecruiters: 0,
      jobSecured: 0,
      source: 'error'
    };
  }
}
