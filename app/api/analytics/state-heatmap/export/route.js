import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const stateFilter = url.searchParams.get('state');
    
    let universityQuery = supabaseAdmin.from('universities').select('id, state');
    let recruiterQuery = supabaseAdmin.from('recruiters').select('id, state');
    
    if (stateFilter) {
      universityQuery = universityQuery.eq('state', stateFilter);
      recruiterQuery = recruiterQuery.eq('state', stateFilter);
    }
    
    const [universitiesResult, recruitersResult, studentsResult, passportsResult] = await Promise.all([
      universityQuery,
      recruiterQuery,
      supabaseAdmin.from('students').select('id, universityId'),
      supabaseAdmin.from('skill_passports').select('studentId, status')
    ]);

    if (universitiesResult.error) {
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }

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

    const orgMap = {};
    orgs.forEach(org => { orgMap[org.id] = org; });

    const passportsByStudent = {};
    passports.forEach(passport => {
      if (!passportsByStudent[passport.studentId]) {
        passportsByStudent[passport.studentId] = [];
      }
      passportsByStudent[passport.studentId].push(passport.status);
    });

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

    students.forEach(student => {
      const university = orgMap[student.universityId];
      if (university?.state && stateMetrics[university.state]) {
        stateMetrics[university.state].students++;
        
        const studentPassports = passportsByStudent[student.id] || [];
        const verifiedCount = studentPassports.filter(status => status === 'verified').length;
        stateMetrics[university.state].verifiedPassports += verifiedCount;
      }
    });

    Object.values(stateMetrics).forEach(state => {
      state.engagementScore = Math.min(95, Math.floor((state.students / Math.max(state.universities, 1)) * 2 + Math.random() * 20));
      state.employabilityIndex = Math.min(98, Math.floor((state.verifiedPassports / Math.max(state.students, 1)) * 100 + Math.random() * 15));
    });

    const stateData = Object.values(stateMetrics);

    // Create CSV content
    const headers = ['State', 'Universities', 'Students', 'Verified Passports', 'Engagement Score', 'Employability Index'];
    const csvRows = [headers.join(',')];

    stateData.forEach(s => {
      const row = [
        `"${s.state || ''}"`,
        s.universities,
        s.students,
        s.verifiedPassports,
        s.engagementScore,
        s.employabilityIndex
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="state-heatmap-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
  } catch (error) {
    console.error('Error in state-heatmap export:', error);
    return NextResponse.json(
      { error: 'Failed to export state heatmap data', details: error.message },
      { status: 500 }
    );
  }
}
