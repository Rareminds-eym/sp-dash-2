import { supabase } from '@/lib/supabase';
import { filterAndRankResults, fuzzyMatch } from '@/lib/search-utils';
import { createCSVResponse } from '@/lib/services/exportService';
import { handleError } from '@/lib/middleware/errorHandler';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * GET /api/passports/export - Export passports to CSV
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    
    // Apply same filters as main list
    const statusFilter = url.searchParams.get('status');
    const nsqfLevelFilter = url.searchParams.get('nsqfLevel');
    const searchTerm = url.searchParams.get('search');
    const universityFilter = url.searchParams.get('university');
    
    // STEP 1: If we have university filter, first get all student IDs from that university
    let studentIdsFromUniversity = null;
    if (universityFilter && universityFilter !== 'all') {
      const { data: studentsFromUniv } = await supabase
        .from('students')
        .select('id')
        .or(`universityId.eq.${universityFilter},organizationId.eq.${universityFilter}`);
      
      studentIdsFromUniversity = studentsFromUniv?.map(s => s.id) || [];
      
      // If university filter is applied but no students found, return empty CSV
      if (studentIdsFromUniversity.length === 0) {
        const csvContent = 'Student Name,Email,University,Status,NSQF Level,Skills,Created Date,Updated Date';
        return createCSVResponse(csvContent, `passports-${new Date().toISOString().split('T')[0]}.csv`);
      }
    }
    
    // STEP 2: Build passport query with filters
    let query = supabase.from('skill_passports').select('*');
    
    // Apply university filter by studentId if available
    if (studentIdsFromUniversity) {
      query = query.in('studentId', studentIdsFromUniversity);
    }
    
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    if (nsqfLevelFilter && nsqfLevelFilter !== 'all') {
      query = query.eq('nsqfLevel', parseInt(nsqfLevelFilter));
    }
    
    query = query.order('createdAt', { ascending: false });
    
    const { data: passports, error: passportsError } = await query;
    
    if (passportsError) {
      console.error('Error fetching passports for export:', passportsError);
      return NextResponse.json({ error: 'Failed to export passports' }, { status: 500 });
    }
    
    // Fetch all related data in bulk
    let enrichedPassports = passports || [];
    
    if (enrichedPassports.length > 0) {
      const studentIds = enrichedPassports.map(p => p.studentId).filter(Boolean);
      
      if (studentIds.length > 0) {
        // Supabase has a limit on .in() queries, so batch them
        const batchSize = 100;
        let allStudents = [];
        let allUsers = [];
        
        for (let i = 0; i < studentIds.length; i += batchSize) {
          const batch = studentIds.slice(i, i + batchSize);
          
          try {
            const [studentsResult, usersResult] = await Promise.all([
              supabase.from('students').select('*').in('id', batch),
              supabase.from('students').select('userId, organizationId').in('id', batch).then(async (result) => {
                if (result.data && result.data.length > 0) {
                  const userIds = result.data.map(s => s.userId).filter(Boolean);
                  if (userIds.length > 0) {
                    return await supabase.from('users').select('id, email, metadata').in('id', userIds);
                  }
                }
                return { data: [] };
              })
            ]);
            
            if (studentsResult.error) {
              console.error('Export error fetching students:', studentsResult.error);
            } else {
              allStudents.push(...(studentsResult.data || []));
            }
            
            if (usersResult.error) {
              console.error('Export error fetching users:', usersResult.error);
            } else {
              allUsers.push(...(usersResult.data || []));
            }
          } catch (error) {
            console.error('Export batch error:', error);
          }
        }
        
        const students = allStudents;
        const users = allUsers;
        
        // Fetch universities
        const orgIds = students.map(s => s.universityId || s.organizationId).filter(Boolean);
        let universities = [];
        if (orgIds.length > 0) {
          const { data: univData } = await supabase.from('universities').select('id, name').in('id', orgIds);
          universities = univData || [];
        }
        
        // Create lookup maps
        const studentMap = {};
        students.forEach(student => {
          // Parse profile if it's a string
          if (student.profile && typeof student.profile === 'string') {
            try {
              const cleanedProfile = student.profile.replace(/:\s*NaN/g, ': null');
              student.profile = JSON.parse(cleanedProfile);
            } catch (parseError) {
              student.profile = {};
            }
          }
          studentMap[student.id] = student;
        });
        
        const userMap = {};
        users.forEach(user => {
          userMap[user.id] = user;
        });
        
        const universityMap = {};
        universities.forEach(univ => {
          universityMap[univ.id] = univ;
        });
        
        // Map data to passports
        enrichedPassports.forEach(passport => {
          if (passport.studentId && studentMap[passport.studentId]) {
            const student = studentMap[passport.studentId];
            if (student.userId && userMap[student.userId]) {
              student.users = userMap[student.userId];
            }
            const univId = student.universityId || student.organizationId;
            if (univId && universityMap[univId]) {
              student.university = universityMap[univId];
            }
            passport.students = student;
          }
        });
      }
    }
    
    // Apply industrial-grade fuzzy search (client-side since it requires student data)
    if (searchTerm) {
      enrichedPassports = enrichedPassports.filter(passport => {
        const studentName = passport.students?.profile?.name || '';
        const studentEmail = passport.students?.email || passport.students?.users?.email || '';
        const passportId = passport.id || '';
        const universityName = passport.students?.university?.name || '';
        const skills = Array.isArray(passport.skills) ? passport.skills.join(' ') : (passport.skills || '');
        
        return fuzzyMatch(studentName, searchTerm, 0.7) ||
               fuzzyMatch(studentEmail, searchTerm, 0.7) ||
               fuzzyMatch(passportId, searchTerm, 0.7) ||
               fuzzyMatch(universityName, searchTerm, 0.7) ||
               fuzzyMatch(skills, searchTerm, 0.7);
      });
      
      // Apply relevance ranking
      const searchFields = ['students.profile.name', 'students.email', 'students.users.email', 'id', 'students.university.name', 'skills'];
      enrichedPassports = filterAndRankResults(enrichedPassports, searchFields, searchTerm, 0.7);
    }
    
    // Create CSV content
    const headers = ['Student Name', 'Email', 'University', 'Status', 'NSQF Level', 'Skills', 'Created Date', 'Updated Date'];
    const csvRows = [headers.join(',')];
    
    enrichedPassports.forEach(p => {
      let studentName = '';
      let studentEmail = '';
      let universityName = '';
      
      if (p.students) {
        studentName = p.students.profile?.name || 
                     p.students.users?.metadata?.name || 
                     p.students.metadata?.name || 
                     p.students.name || 
                     '';
        
        studentEmail = p.students.email || 
                      p.students.users?.email || 
                      '';
        
        universityName = p.students.university?.name || 
                        p.students.organization?.name || 
                        '';
      }
      
      const skills = Array.isArray(p.skills) ? p.skills.join('; ') : '';
      
      const row = [
        `"${studentName}"`,
        `"${studentEmail}"`,
        `"${universityName}"`,
        `"${p.status || ''}"`,
        p.nsqfLevel || '',
        `"${skills}"`,
        p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '',
        p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : ''
      ];
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    const filename = `ai-insights-${new Date().toISOString().split('T')[0]}.csv`;
    
    return createCSVResponse(csvContent, filename);
  } catch (error) {
    return handleError(error, 'Passports Export');
  }
}
