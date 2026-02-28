import { supabaseAdmin } from '../supabase-admin';

/**
 * Fetch dashboard metrics from snapshot or calculate dynamically
 * @param {Object} rlsClient - Supabase RLS client
 * @returns {Object} Metrics data
 */
export async function getDashboardMetrics(rlsClient) {
  try {
    // First, try to fetch the latest snapshot from metrics_snapshots table
    const { data: latestSnapshot, error: snapshotError } = await supabaseAdmin
      .from('metrics_snapshots')
      .select('*')
      .order('snapshotDate', { ascending: false })
      .limit(1)
      .maybeSingle();

    // If we have a snapshot, return it
    if (latestSnapshot && !snapshotError) {
      // Fix: Ensure we're using the correct field names and handling data types properly
      return {
        activeUniversities: parseInt(latestSnapshot.activeUniversities) || 0,
        registeredStudents: parseInt(latestSnapshot.registeredStudents) || 0,
        verifiedPassports: parseInt(latestSnapshot.verifiedPassports) || 0,
        employabilityIndex: parseFloat(latestSnapshot.employabilityIndex || 0),
        activeRecruiters: parseInt(latestSnapshot.activeRecruiters) || 0,
        jobSecured: parseInt(latestSnapshot.jobsecured) || 0,
        snapshotDate: latestSnapshot.snapshotDate,
        source: 'snapshot'
      };
    }

    // Fallback: Calculate metrics dynamically from database tables if no snapshot exists
    console.log('No snapshot found, calculating metrics dynamically');

    // Count active universities from universities table (only where isactive=true)
    const { count: activeUniversities, error: universitiesError } = await supabaseAdmin
      .from('universities')
      .select('*', { count: 'exact', head: true })
      .eq('isactive', true);

    if (universitiesError) {
      console.error('Error fetching universities:', universitiesError);
    }

    // Count active recruiters from recruiters table (only where isactive=true)
    const { count: activeRecruiters } = await rlsClient
      .from('recruiters')
      .select('*', { count: 'exact', head: true })
      .eq('isactive', true);

    // Count students
    const { count: registeredStudents } = await rlsClient
      .from('students')
      .select('*', { count: 'exact', head: true });

    // Get passport counts using database aggregation (more efficient than fetching all rows)
    const [totalPassportsResult, verifiedPassportsResult] = await Promise.all([
      rlsClient.from('skill_passports').select('*', { count: 'exact', head: true }),
      rlsClient.from('skill_passports').select('*', { count: 'exact', head: true }).eq('status', 'verified')
    ]);

    const totalPassports = totalPassportsResult.count || 0;
    const verifiedPassports = verifiedPassportsResult.count || 0;

    // Calculate employability index
    const employabilityIndex = registeredStudents > 0
      ? ((verifiedPassports / registeredStudents) * 100).toFixed(1)
      : 0;

    // Count job secured (hired placements)
    const { count: jobSecured } = await rlsClient
      .from('placements')
      .select('*', { count: 'exact', head: true })
      .eq('placementStatus', 'hired');

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
