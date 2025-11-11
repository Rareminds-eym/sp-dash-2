import { NextResponse } from 'next/server';
import { createRLSClient } from '../../../../lib/supabase-rls';

export const runtime = 'edge';

export async function GET(request) {
  try {
    const { supabase: rlsClient } = await createRLSClient(request);
    
    const url = new URL(request.url);
    const stateFilter = url.searchParams.get('state');

    let universityQuery = rlsClient.from('universities').select('id, name, state');
    if (stateFilter && stateFilter !== 'all') {
      universityQuery = universityQuery.eq('state', stateFilter);
    }
    
    const [universitiesResult, studentsResult, passportsResult] = await Promise.all([
      universityQuery,
      rlsClient.from('students').select('id, universityId'),
      rlsClient.from('skill_passports').select('studentId, status')
    ]);

    if (universitiesResult.error) {
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }

    const universities = universitiesResult.data || [];
    const students = studentsResult.data || [];
    const passports = passportsResult.data || [];

    // Create lookup maps
    const studentsByUniversity = {};
    const passportsByStudent = {};

    students.forEach(student => {
      const univId = student.universityId;
      if (univId) {
        if (!studentsByUniversity[univId]) {
          studentsByUniversity[univId] = [];
        }
        studentsByUniversity[univId].push(student.id);
      }
    });

    passports.forEach(passport => {
      if (passport.studentId) {
        if (!passportsByStudent[passport.studentId]) {
          passportsByStudent[passport.studentId] = [];
        }
        passportsByStudent[passport.studentId].push(passport.status);
      }
    });

    const universityReports = universities.map(university => {
      const studentIds = studentsByUniversity[university.id] || [];
      const enrollmentCount = studentIds.length;

      let totalPassports = 0;
      let verifiedCount = 0;

      studentIds.forEach(studentId => {
        const studentPassports = passportsByStudent[studentId] || [];
        totalPassports += studentPassports.length;
        verifiedCount += studentPassports.filter(status => status === 'verified').length;
      });

      const completionRate = totalPassports > 0 ? parseFloat(((verifiedCount / totalPassports) * 100).toFixed(1)) : 0;
      const verificationRate = enrollmentCount > 0 ? parseFloat(((totalPassports / enrollmentCount) * 100).toFixed(1)) : 0;

      return {
        universityName: university.name,
        state: university.state || 'Unknown',
        enrollmentCount,
        totalPassports,
        verifiedPassports: verifiedCount,
        completionRate,
        verificationRate
      };
    });

    // Create CSV content
    const headers = ['University Name', 'State', 'Enrollment Count', 'Total Passports', 'Verified Passports', 'Completion Rate (%)', 'Verification Rate (%)'];
    const csvRows = [headers.join(',')];

    universityReports.forEach(r => {
      const row = [
        `"${r.universityName || ''}"`,
        `"${r.state || ''}"`,
        r.enrollmentCount,
        r.totalPassports,
        r.verifiedPassports,
        r.completionRate,
        r.verificationRate
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="university-reports-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
  } catch (error) {
    console.error('Error in university-reports export:', error);
    return NextResponse.json(
      { error: 'Failed to export university reports', details: error.message },
      { status: 500 }
    );
  }
}
