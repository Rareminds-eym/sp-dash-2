import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/middleware/auth';
import { addCacheHeaders } from '@/lib/services/cacheService';
import { handleError } from '@/lib/middleware/errorHandler';

export const runtime = 'edge';

/**
 * GET /api/analytics/university-reports - University-wise analytics
 */
export async function GET(request) {
  try {
    const { rlsClient, error } = await authenticateRequest(request);
    if (error) return error;
    
    // Use RLS client - platform admins will see all data via RLS policies
    const { data: universities, error: univError } = await rlsClient
      .from('universities')
      .select('id, name, state');
    
    if (univError) {
      console.error('Error fetching universities:', univError);
      throw univError;
    }

    if (!universities || universities.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch all students with their university IDs
    const { data: students, error: studentError } = await rlsClient
      .from('students')
      .select('id, universityId');
    
    if (studentError) {
      console.error('Error fetching students:', studentError);
    }

    // Fetch all skill passports
    const { data: passports, error: passportError } = await rlsClient
      .from('skill_passports')
      .select('studentId, status');
    
    if (passportError) {
      console.error('Error fetching passports:', passportError);
    }

    // Create lookup maps for efficient data processing
    const studentsByUniversity = {};
    const passportsByStudent = {};

    // Group students by university
    if (students && students.length > 0) {
      students.forEach(student => {
        const univId = student.universityId;
        if (univId) {
          if (!studentsByUniversity[univId]) {
            studentsByUniversity[univId] = [];
          }
          studentsByUniversity[univId].push(student.id);
        }
      });
    }

    // Group passports by student
    if (passports && passports.length > 0) {
      passports.forEach(passport => {
        if (passport.studentId) {
          if (!passportsByStudent[passport.studentId]) {
            passportsByStudent[passport.studentId] = [];
          }
          passportsByStudent[passport.studentId].push(passport.status);
        }
      });
    }

    // Calculate metrics for each university
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
        universityId: university.id,
        universityName: university.name,
        state: university.state || 'Unknown',
        enrollmentCount,
        totalPassports,
        verifiedPassports: verifiedCount,
        completionRate,
        verificationRate
      };
    });

    const response = NextResponse.json(universityReports);
    return addCacheHeaders(response, 'dynamic');
  } catch (error) {
    console.error('Error in university-reports endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch university reports', details: error.message },
      { status: 500 }
    );
  }
}
