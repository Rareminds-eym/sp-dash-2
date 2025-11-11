import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request) {
  try {
    // Fetch all data in parallel from new tables
    const [universitiesResult, recruitersResult, studentsResult, passportsResult] = await Promise.all([
      supabase.from('universities').select('id, state'),
      supabase.from('recruiters').select('id, state'),
      supabase.from('students').select('id, universityId'),
      supabase.from('skill_passports').select('studentId, status')
    ]);

    if (universitiesResult.error) throw universitiesResult.error;

    // Combine and map organizations using id field
    const orgs = [
      ...(universitiesResult.data || []).map(u => ({
        id: u.id,
        state: u.state,
        type: 'university'
      })),
      ...(recruitersResult.data || []).map(r => ({
        id: r.id,
        state: r.state,
        type: 'recruiter'
      }))
    ];
    const students = studentsResult.data || [];
    const passports = passportsResult.data || [];

    // Create lookup maps for O(1) access
    const orgMap = {};
    orgs.forEach(org => { orgMap[org.id] = org; });

    const passportsByStudent = {};
    passports.forEach(passport => {
      if (!passportsByStudent[passport.studentId]) {
        passportsByStudent[passport.studentId] = [];
      }
      passportsByStudent[passport.studentId].push(passport.status);
    });

    // Calculate engagement metrics by state
    const stateMetrics = {};
    
    orgs.forEach(org => {
      if (org.state) {
        if (!stateMetrics[org.state]) {
          stateMetrics[org.state] = {
            state: org.state,
            universities: 0,
            students: 0,
            verifiedPassports: 0,
            engagementScore: 0,
            employabilityIndex: 0
          };
        }
        
        if (org.type === 'university') {
          stateMetrics[org.state].universities++;
        }
      }
    });

    // Add student and passport data using lookup map
    students.forEach(student => {
      const university = orgMap[student.universityId];
      if (university?.state && stateMetrics[university.state]) {
        stateMetrics[university.state].students++;
        
        const studentPassports = passportsByStudent[student.id] || [];
        const verifiedCount = studentPassports.filter(status => status === 'verified').length;
        stateMetrics[university.state].verifiedPassports += verifiedCount;
      }
    });

    // Calculate scores
    Object.values(stateMetrics).forEach(state => {
      state.engagementScore = Math.min(95, Math.floor((state.students / Math.max(state.universities, 1)) * 2 + Math.random() * 20));
      state.employabilityIndex = Math.min(98, Math.floor((state.verifiedPassports / Math.max(state.students, 1)) * 100 + Math.random() * 15));
    });

    return NextResponse.json(Object.values(stateMetrics));
  } catch (error) {
    console.error('Error in state-heatmap endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch state heatmap data', details: error.message },
      { status: 500 }
    );
  }
}
