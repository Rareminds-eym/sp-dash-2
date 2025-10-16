import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../../lib/supabase';

export const runtime = 'edge';

// Helper to log audit
async function logAudit(actorId, action, target, payload = {}, ip = '') {
  try {
    await supabase.from('audit_logs').insert({
      id: uuidv4(),
      actorId,
      action,
      target,
      payload,
      ip,
    })
  } catch (error) {
    console.error('Audit log error:', error)
  }
}

// GET /api - Hello World
export async function GET(request) {
  const { pathname } = new URL(request.url)
  const path = pathname.replace('/api', '') || '/'

  try {
    // GET /api/metrics - Dashboard metrics
    if (path === '/metrics') {
      try {
        // First, try to fetch the latest snapshot from metrics_snapshots table
        const { data: latestSnapshot, error: snapshotError } = await supabase
          .from('metrics_snapshots')
          .select('*')
          .order('snapshotDate', { ascending: false })
          .limit(1)
          .maybeSingle()
        
        // If we have a snapshot, return it
        if (latestSnapshot && !snapshotError) {
          return NextResponse.json({
            activeUniversities: latestSnapshot.activeUniversities || 0,
            registeredStudents: latestSnapshot.registeredStudents || 0,
            verifiedPassports: latestSnapshot.verifiedPassports || 0,
            employabilityIndex: parseFloat(latestSnapshot.employabilityIndex || 0),
            activeRecruiters: latestSnapshot.activeRecruiters || 0,
            snapshotDate: latestSnapshot.snapshotDate,
            source: 'snapshot'
          })
        }
        
        // Fallback: Calculate metrics dynamically from database tables if no snapshot exists
        console.log('No snapshot found, calculating metrics dynamically')
        
        // Count universities from universities table
        const { data: universities } = await supabase
          .from('universities')
          .select('id')
        
        const activeUniversities = universities?.length || 0

        // Count recruiters from recruiters table
        const { data: recruiters } = await supabase
          .from('recruiters')
          .select('id')
        
        const activeRecruiters = recruiters?.length || 0

        // Count total students
        const { data: students } = await supabase
          .from('students')
          .select('id')
        
        const registeredStudents = students?.length || 0

        // Get all passports to calculate verification metrics
        const { data: passports } = await supabase
          .from('skill_passports')
          .select('status')
        
        const totalPassports = passports?.length || 0
        const verifiedPassports = passports?.filter(p => p.status === 'verified').length || 0
        
        // Calculate employability index
        const employabilityIndex = registeredStudents > 0 
          ? ((verifiedPassports / registeredStudents) * 100).toFixed(1) 
          : 0

        return NextResponse.json({
          activeUniversities,
          registeredStudents,
          verifiedPassports,
          employabilityIndex: parseFloat(employabilityIndex),
          activeRecruiters,
          source: 'dynamic'
        })
      } catch (error) {
        console.error('Error fetching metrics:', error)
        return NextResponse.json({
          activeUniversities: 0,
          registeredStudents: 0,
          verifiedPassports: 0,
          employabilityIndex: 0,
          activeRecruiters: 0,
          source: 'error'
        })
      }
    }

    // GET /api/users - List all users with pagination, search, and filters (ENHANCED) - Excludes recruiters
    if (path === '/users') {
      // Get parameters from query string
      const url = new URL(request.url)
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = parseInt(url.searchParams.get('limit') || '20')
      const offset = (page - 1) * limit
      const search = url.searchParams.get('search') || ''
      const roleFilter = url.searchParams.get('role') || ''
      const activeFilter = url.searchParams.get('active') || ''
      const organizationFilter = url.searchParams.get('organization') || ''
      const sortBy = url.searchParams.get('sortBy') || 'createdAt'
      const sortOrder = url.searchParams.get('sortOrder') || 'desc'
      
      // Build the query for users
      let usersQuery = supabase.from('users').select('*', { count: 'exact' }).neq('role', 'recruiter')
      
      // Apply role filter
      if (roleFilter && roleFilter !== 'all') {
        usersQuery = usersQuery.eq('role', roleFilter)
      }
      
      // Apply active filter
      if (activeFilter && activeFilter !== 'all') {
        usersQuery = usersQuery.eq('isActive', activeFilter === 'true')
      }
      
      // Apply organization filter
      if (organizationFilter && organizationFilter !== 'all') {
        usersQuery = usersQuery.eq('organizationId', organizationFilter)
      }
      
      // Apply sorting
      const ascending = sortOrder === 'asc'
      if (sortBy === 'email') {
        usersQuery = usersQuery.order('email', { ascending })
      } else if (sortBy === 'role') {
        usersQuery = usersQuery.order('role', { ascending })
      } else if (sortBy === 'createdAt') {
        usersQuery = usersQuery.order('createdAt', { ascending })
      }
      
      // Execute query with pagination
      const { data: users, error, count } = await usersQuery.range(offset, offset + limit - 1)

      if (error) {
        console.error('Error fetching users:', error)
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
      }
      
      let filteredUsers = users || []
      
      // Fetch all organizations from universities and recruiters tables
      if (filteredUsers.length > 0) {
        const orgIds = filteredUsers.map(u => u.organizationId).filter(Boolean)
        
        if (orgIds.length > 0) {
          // Try to fetch from both universities and recruiters tables using id field
          const [universitiesResult, recruitersResult] = await Promise.all([
            supabase.from('universities').select('id, name').in('id', orgIds),
            supabase.from('recruiters').select('id, name').in('id', orgIds)
          ])
          
          const orgMap = {}
          // Map universities (using id)
          universitiesResult.data?.forEach(univ => { 
            orgMap[univ.id] = { id: univ.id, name: univ.name } 
          })
          // Map recruiters (using id)
          recruitersResult.data?.forEach(rec => { 
            orgMap[rec.id] = { id: rec.id, name: rec.name } 
          })
          
          filteredUsers.forEach(user => {
            if (user.organizationId && orgMap[user.organizationId]) {
              user.organizations = orgMap[user.organizationId]
            }
          })
        }
      }
      
      // Apply client-side search filter (for name in metadata)
      if (search) {
        const searchLower = search.toLowerCase()
        filteredUsers = filteredUsers.filter(user => {
          const email = user.email || ''
          const role = user.role || ''
          const name = user.metadata?.name || ''
          const orgName = user.organizations?.name || ''
          
          return email.toLowerCase().includes(searchLower) ||
                 role.toLowerCase().includes(searchLower) ||
                 name.toLowerCase().includes(searchLower) ||
                 orgName.toLowerCase().includes(searchLower)
        })
      }
      
      // Return paginated response
      return NextResponse.json({
        data: filteredUsers,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      })
    }

    // GET /api/organizations - List all organizations (combined from universities and recruiters)
    if (path === '/organizations') {
      // Fetch from both universities and recruiters tables
      const [universitiesResult, recruitersResult] = await Promise.all([
        supabase.from('universities').select('*').order('createdat', { ascending: false }),
        supabase.from('recruiters').select('*').order('createdat', { ascending: false })
      ])

      if (universitiesResult.error) throw universitiesResult.error
      if (recruitersResult.error) throw recruitersResult.error

      // Combine results with type field for compatibility
      const universities = (universitiesResult.data || []).map(u => ({
        id: u.id,
        name: u.name,
        type: 'university',
        state: u.state,
        district: u.district,
        email: u.email,
        phone: u.phone,
        website: u.website,
        verificationStatus: u.verificationstatus,
        isActive: u.isactive,
        createdAt: u.createdat,
        updatedAt: u.updatedat
      }))

      const recruiters = (recruitersResult.data || []).map(r => ({
        id: r.id,
        name: r.name,
        type: 'recruiter',
        state: r.state,
        email: r.email,
        phone: r.phone,
        website: r.website,
        verificationStatus: r.verificationstatus,
        isActive: r.isactive,
        createdAt: r.createdat,
        updatedAt: r.updatedat
      }))

      const allOrgs = [...universities, ...recruiters].sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      )

      return NextResponse.json(allOrgs)
    }

    // GET /api/recruiters - List all recruiter organizations with filtering, sorting, and pagination
    if (path === '/recruiters') {
      const url = new URL(request.url)
      
      // Pagination parameters
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = parseInt(url.searchParams.get('limit') || '20')
      const offset = (page - 1) * limit
      
      // Filter parameters
      const statusFilter = url.searchParams.get('status') // pending, approved, rejected
      const activeFilter = url.searchParams.get('active') // true, false
      const stateFilter = url.searchParams.get('state')
      const searchTerm = url.searchParams.get('search')
      
      // Sorting parameters
      const sortBy = url.searchParams.get('sortBy') || 'createdat'
      const sortOrder = url.searchParams.get('sortOrder') || 'desc'
      
      // Build query
      let query = supabase.from('recruiters').select('*', { count: 'exact' })
      
      // Apply filters
      if (statusFilter) {
        query = query.eq('verificationstatus', statusFilter)
      }
      if (activeFilter !== null && activeFilter !== '') {
        query = query.eq('isactive', activeFilter === 'true')
      }
      if (stateFilter) {
        query = query.eq('state', stateFilter)
      }
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
      }
      
      // Apply sorting
      const sortField = sortBy === 'name' ? 'name' : sortBy === 'userCount' ? 'createdat' : sortBy
      query = query.order(sortField, { ascending: sortOrder === 'asc' })
      
      // Apply pagination
      query = query.range(offset, offset + limit - 1)
      
      const { data: recruiters, error, count } = await query

      if (error) {
        console.error('Error fetching recruiters:', error)
        return NextResponse.json({ error: 'Failed to fetch recruiters' }, { status: 500 })
      }

      // Fetch all users in bulk and count by organization
      let userCountMap = {}
      if (recruiters && recruiters.length > 0) {
        const recruiterIds = recruiters.map(r => r.id)
        
        const { data: users } = await supabase
          .from('users')
          .select('id, organizationId')
          .in('organizationId', recruiterIds)
        
        // Count users by organization
        users?.forEach(user => {
          userCountMap[user.organizationId] = (userCountMap[user.organizationId] || 0) + 1
        })
      }
      
      // Map recruiters to expected format
      let mappedRecruiters = (recruiters || []).map(recruiter => ({
        id: recruiter.id,
        name: recruiter.name,
        type: 'recruiter',
        state: recruiter.state,
        email: recruiter.email,
        phone: recruiter.phone,
        website: recruiter.website,
        address: recruiter.address,
        verificationStatus: recruiter.verificationstatus || 'approved',
        isActive: recruiter.isactive !== undefined ? recruiter.isactive : true,
        createdAt: recruiter.createdat,
        updatedAt: recruiter.updatedat,
        userCount: userCountMap[recruiter.id] || 0
      }))
      
      // Sort by user count if requested (can't do this in SQL easily with join)
      if (sortBy === 'userCount') {
        mappedRecruiters.sort((a, b) => {
          return sortOrder === 'asc' ? a.userCount - b.userCount : b.userCount - a.userCount
        })
      }
      
      return NextResponse.json({
        data: mappedRecruiters,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      })
    }

    // GET /api/recruiter/:id - Get single recruiter details with audit history
    if (path.startsWith('/recruiter/') && path.split('/').length === 3) {
      const recruiterId = path.split('/')[2]
      
      // Fetch recruiter details
      const { data: recruiter, error } = await supabase
        .from('recruiters')
        .select('*')
        .eq('id', recruiterId)
        .single()
      
      if (error || !recruiter) {
        return NextResponse.json({ error: 'Recruiter not found' }, { status: 404 })
      }
      
      // Fetch user count
      const { data: users } = await supabase
        .from('users')
        .select('id')
        .eq('organizationId', recruiterId)
      
      // Fetch audit history for this recruiter
      const { data: auditLogs } = await supabase
        .from('audit_logs')
        .select('*, users!inner(email)')
        .eq('target', recruiterId)
        .order('timestamp', { ascending: false })
        .limit(20)
      
      // Fetch verification history
      const { data: verifications } = await supabase
        .from('verifications')
        .select('*, users!inner(email)')
        .eq('targetId', recruiterId)
        .order('timestamp', { ascending: false })
        .limit(20)
      
      return NextResponse.json({
        id: recruiter.id,
        name: recruiter.name,
        type: 'recruiter',
        state: recruiter.state,
        district: recruiter.district,
        email: recruiter.email,
        phone: recruiter.phone,
        website: recruiter.website,
        address: recruiter.address,
        verificationStatus: recruiter.verificationstatus || 'approved',
        isActive: recruiter.isactive !== undefined ? recruiter.isactive : true,
        createdAt: recruiter.createdat,
        updatedAt: recruiter.updatedat,
        userCount: users?.length || 0,
        auditHistory: auditLogs || [],
        verificationHistory: verifications || []
      })
    }

    // GET /api/recruiters/export - Export recruiters to CSV
    if (path === '/recruiters/export') {
      const url = new URL(request.url)
      
      // Apply same filters as main list
      const statusFilter = url.searchParams.get('status')
      const activeFilter = url.searchParams.get('active')
      const stateFilter = url.searchParams.get('state')
      const searchTerm = url.searchParams.get('search')
      
      let query = supabase.from('recruiters').select('*')
      
      if (statusFilter) {
        query = query.eq('verificationstatus', statusFilter)
      }
      if (activeFilter !== null && activeFilter !== '') {
        query = query.eq('isactive', activeFilter === 'true')
      }
      if (stateFilter) {
        query = query.eq('state', stateFilter)
      }
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
      }
      
      query = query.order('createdat', { ascending: false })
      
      const { data: recruiters, error } = await query
      
      if (error) {
        return NextResponse.json({ error: 'Failed to export recruiters' }, { status: 500 })
      }
      
      // Create CSV content
      const headers = ['Name', 'Email', 'Phone', 'State', 'District', 'Website', 'Status', 'Active', 'Created Date']
      const csvRows = [headers.join(',')]
      
      recruiters?.forEach(r => {
        const row = [
          `"${r.name || ''}"`,
          `"${r.email || ''}"`,
          `"${r.phone || ''}"`,
          `"${r.state || ''}"`,
          `"${r.district || ''}"`,
          `"${r.website || ''}"`,
          `"${r.verificationstatus || 'approved'}"`,
          r.isactive ? 'Yes' : 'No',
          r.createdat ? new Date(r.createdat).toLocaleDateString() : ''
        ]
        csvRows.push(row.join(','))
      })
      
      const csvContent = csvRows.join('\n')
      
      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="recruiters-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    // GET /api/recruiters/states - Get unique states for filter dropdown
    if (path === '/recruiters/states') {
      const { data: recruiters } = await supabase
        .from('recruiters')
        .select('state')
        .not('state', 'is', null)
      
      const uniqueStates = [...new Set(recruiters?.map(r => r.state).filter(Boolean))].sort()
      
      return NextResponse.json(uniqueStates)
    }

    // GET /api/passports/universities - Get unique universities for filter dropdown
    if (path === '/passports/universities') {
      const { data: universities } = await supabase
        .from('universities')
        .select('id, name')
        .order('name', { ascending: true })
      
      return NextResponse.json(universities || [])
    }

    // GET /api/passports/export - Export passports to CSV
    if (path === '/passports/export') {
      const url = new URL(request.url)
      
      // Apply same filters as main list
      const statusFilter = url.searchParams.get('status')
      const nsqfLevelFilter = url.searchParams.get('nsqfLevel')
      const searchTerm = url.searchParams.get('search')
      const universityFilter = url.searchParams.get('university')
      
      let query = supabase.from('skill_passports').select('*')
      
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }
      if (nsqfLevelFilter && nsqfLevelFilter !== 'all') {
        query = query.eq('nsqfLevel', parseInt(nsqfLevelFilter))
      }
      
      query = query.order('createdAt', { ascending: false })
      
      const { data: passports, error: passportsError } = await query
      
      if (passportsError) {
        console.error('Error fetching passports for export:', passportsError)
        return NextResponse.json({ error: 'Failed to export passports' }, { status: 500 })
      }
      
      // Fetch all related data in bulk
      let enrichedPassports = passports || []
      
      if (enrichedPassports.length > 0) {
        const studentIds = enrichedPassports.map(p => p.studentId).filter(Boolean)
        
        console.log(`Export: Found ${studentIds.length} student IDs from ${enrichedPassports.length} passports`)
        console.log(`Sample passport structure:`, {
          passport: enrichedPassports[0],
          hasStudentId: !!enrichedPassports[0]?.studentId,
          studentIdValue: enrichedPassports[0]?.studentId
        })
        
        if (studentIds.length > 0) {
          console.log(`Export: Attempting to fetch ${studentIds.length} students in batches`)
          
          // Supabase has a limit on .in() queries, so batch them
          const batchSize = 100
          let allStudents = []
          let allUsers = []
          
          for (let i = 0; i < studentIds.length; i += batchSize) {
            const batch = studentIds.slice(i, i + batchSize)
            const batchNum = Math.floor(i/batchSize) + 1
            const totalBatches = Math.ceil(studentIds.length/batchSize)
            console.log(`Export: Processing batch ${batchNum}/${totalBatches} (${batch.length} students)`)
            
            try {
              const [studentsResult, usersResult] = await Promise.all([
                supabase.from('students').select('*').in('id', batch),
                supabase.from('students').select('userId, organizationId').in('id', batch).then(async (result) => {
                  if (result.data && result.data.length > 0) {
                    const userIds = result.data.map(s => s.userId).filter(Boolean)
                    if (userIds.length > 0) {
                      return await supabase.from('users').select('id, email, metadata').in('id', userIds)
                    }
                  }
                  return { data: [] }
                })
              ])
              
              if (studentsResult.error) {
                console.log(`Export ERROR in batch ${batchNum}:`, studentsResult.error)
              } else {
                allStudents.push(...(studentsResult.data || []))
                console.log(`Export: Batch ${batchNum} fetched ${studentsResult.data?.length || 0} students`)
              }
              
              if (usersResult.error) {
                console.log(`Export ERROR in users batch ${batchNum}:`, usersResult.error)
              } else {
                allUsers.push(...(usersResult.data || []))
              }
            } catch (error) {
              console.log(`Export ERROR in batch ${batchNum}:`, error)
            }
          }
          
          console.log(`Export: Completed batching. Total students: ${allStudents.length}, Total users: ${allUsers.length}`)
          
          // Create result objects for compatibility with existing code
          const studentsResult = { data: allStudents, error: null }
          const usersResult = { data: allUsers, error: null }
          
          const students = studentsResult.data || []
          const users = usersResult.data || []
          
          console.log(`Export: Fetched ${students.length} students and ${users.length} users`)
          console.log(`Sample student:`, students[0] ? {
            id: students[0].id,
            email: students[0].email,
            hasProfile: !!students[0].profile,
            universityId: students[0].universityId
          } : 'No students')
          
          console.log(`Export DEBUG: Students query details:`, {
            studentsResultError: studentsResult.error,
            studentsResultDataLength: studentsResult.data?.length,
            usersResultError: usersResult.error,
            usersResultDataLength: usersResult.data?.length,
            sampleStudentId: studentIds[0],
            totalStudentIds: studentIds.length
          })
          
          // Write debug info to file for inspection
          try {
            const fs = require('fs')
            fs.writeFileSync('/tmp/export_debug.json', JSON.stringify({
              timestamp: new Date().toISOString(),
              studentIds: studentIds.slice(0, 5),
              studentsResult: {
                error: studentsResult.error,
                dataLength: studentsResult.data?.length,
                sampleData: studentsResult.data?.slice(0, 2)
              },
              usersResult: {
                error: usersResult.error,
                dataLength: usersResult.data?.length,
                sampleData: usersResult.data?.slice(0, 2)
              }
            }, null, 2))
          } catch (e) {
            console.log('Failed to write debug file:', e.message)
          }
          
          // Fetch universities
          const orgIds = students.map(s => s.universityId || s.organizationId).filter(Boolean)
          let universities = []
          if (orgIds.length > 0) {
            const { data: univData } = await supabase.from('universities').select('id, name').in('id', orgIds)
            universities = univData || []
          }
          
          // Create lookup maps
          const studentMap = {}
          students.forEach(student => {
            // Parse profile if it's a string
            if (student.profile && typeof student.profile === 'string') {
              try {
                const cleanedProfile = student.profile.replace(/:\s*NaN/g, ': null')
                student.profile = JSON.parse(cleanedProfile)
              } catch (parseError) {
                student.profile = {}
              }
            }
            studentMap[student.id] = student
          })
          
          const userMap = {}
          users.forEach(user => {
            userMap[user.id] = user
          })
          
          const universityMap = {}
          universities.forEach(univ => {
            universityMap[univ.id] = univ
          })
          
          // Map data to passports
          let enrichedCount = 0
          let missingStudentCount = 0
          enrichedPassports.forEach(passport => {
            if (passport.studentId && studentMap[passport.studentId]) {
              const student = studentMap[passport.studentId]
              if (student.userId && userMap[student.userId]) {
                student.users = userMap[student.userId]
              }
              const univId = student.universityId || student.organizationId
              if (univId && universityMap[univId]) {
                student.university = universityMap[univId]
              }
              passport.students = student
              enrichedCount++
            } else {
              missingStudentCount++
            }
          })
          
          console.log(`Export enrichment stats: ${enrichedCount} enriched, ${missingStudentCount} missing students out of ${enrichedPassports.length} total`)
          console.log(`Sample enriched passport:`, enrichedPassports[0]?.students ? {
            hasStudents: true,
            hasEmail: !!enrichedPassports[0].students.email,
            hasProfile: !!enrichedPassports[0].students.profile,
            hasProfileName: !!enrichedPassports[0].students.profile?.name
          } : 'No students object')
        }
      }
      
      // Apply client-side filters
      if (searchTerm || universityFilter) {
        enrichedPassports = enrichedPassports.filter(passport => {
          let matchesSearch = true
          let matchesUniversity = true
          
          if (searchTerm) {
            const searchLower = searchTerm.toLowerCase()
            const studentName = passport.students?.profile?.name || ''
            const studentEmail = passport.students?.email || passport.students?.users?.email || ''
            const passportId = passport.id || ''
            
            matchesSearch = studentName.toLowerCase().includes(searchLower) ||
                           studentEmail.toLowerCase().includes(searchLower) ||
                           passportId.toLowerCase().includes(searchLower)
          }
          
          if (universityFilter && universityFilter !== 'all') {
            const univId = passport.students?.universityId || passport.students?.organizationId
            matchesUniversity = univId === universityFilter
          }
          
          return matchesSearch && matchesUniversity
        })
      }
      
      // Create CSV content
      const headers = ['Student Name', 'Email', 'University', 'Status', 'NSQF Level', 'Skills', 'Created Date', 'Updated Date']
      const csvRows = [headers.join(',')]
      
      enrichedPassports.forEach(p => {
        // Extract student data with multiple fallbacks
        let studentName = ''
        let studentEmail = ''
        let universityName = ''
        
        if (p.students) {
          // Try to get name from profile or metadata
          studentName = p.students.profile?.name || 
                       p.students.users?.metadata?.name || 
                       p.students.metadata?.name || 
                       p.students.name || 
                       ''
          
          // Try to get email from direct field first, then users
          studentEmail = p.students.email || 
                        p.students.users?.email || 
                        ''
          
          // Try to get university name
          universityName = p.students.university?.name || 
                          p.students.organization?.name || 
                          ''
        }
        
        const skills = Array.isArray(p.skills) ? p.skills.join('; ') : ''
        
        const row = [
          `"${studentName}"`,
          `"${studentEmail}"`,
          `"${universityName}"`,
          `"${p.status || ''}"`,
          p.nsqfLevel || '',
          `"${skills}"`,
          p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '',
          p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : ''
        ]
        csvRows.push(row.join(','))
      })
      
      const csvContent = csvRows.join('\n')
      
      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="passports-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    // GET /api/users/organizations - Get unique organizations for filter dropdown
    if (path === '/users/organizations') {
      // Fetch from both universities and recruiters tables
      const [universitiesResult, recruitersResult] = await Promise.all([
        supabase.from('universities').select('id, name').order('name', { ascending: true }),
        supabase.from('recruiters').select('id, name').order('name', { ascending: true })
      ])
      
      const organizations = [
        ...(universitiesResult.data || []),
        ...(recruitersResult.data || [])
      ].sort((a, b) => a.name.localeCompare(b.name))
      
      return NextResponse.json(organizations)
    }

    // GET /api/students - List all students (OPTIMIZED)
    if (path === '/students') {
      const { data: students, error } = await supabase
        .from('students')
        .select('*')
        .order('createdAt', { ascending: false })

      if (error) {
        console.error('Error fetching students:', error)
        return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 })
      }
      
      // Fetch all related data in parallel
      if (students && students.length > 0) {
        const userIds = students.map(s => s.userId).filter(Boolean)
        const universityIds = students.map(s => s.universityId).filter(Boolean)
        
        // Mapping from old organization IDs to new university IDs (same as university-reports)
        const univIdMapping = {
          'f1ed42b6-ffe7-4108-90bb-6776b6504f7b': '5ca5589e-b49d-4027-baf7-7e2a88ae612a',
          '609f59c9-6894-499b-8479-e826c219e0df': '632a5084-eeae-4f2e-b4bc-32593f2dcc00',
          '1b0ab392-4fba-4037-ae99-6cdf1e0a232d': '85ed5785-dcb2-4d26-8100-a5fb492f0988',
          'bf405453-cd17-4b45-9bc6-c89407272d7f': '2e9cb79d-0fb7-4b52-9588-d2a7262c9f68',
          'aeaf831c-7e48-400a-90e3-8d879ef84257': '707b0f68-6855-428c-a630-65926f8c8116',
          'cec6f9e4-ab41-41a1-b889-699bec40ee69': '66baa6ed-50ce-433d-84f9-c296c6d5806d',
          'b5b42149-b444-47c3-939b-9ac7b1686414': '0dd1623e-a820-4da1-8c8b-a436db386a59',
          'e0decdad-0553-4b1a-ad15-a16709bf7671': 'fdba4612-5249-4257-87e1-dc4858151ee8',
          '54e9f738-fdeb-4116-8032-a27cac4a0112': 'b559f0da-c071-47ec-a866-b646751845bb',
          '2877f238-ec9f-49af-8bb5-6efd30bc3654': '299ac0e3-f50f-41bc-965c-7274cfa9af25'
        }
        
        // Map old university IDs to new IDs
        const mappedUniversityIds = universityIds.map(id => univIdMapping[id] || id).filter(Boolean)
        
        const [usersResult, universitiesResult] = await Promise.all([
          userIds.length > 0 ? supabase.from('users').select('id, email').in('id', userIds) : { data: [] },
          mappedUniversityIds.length > 0 ? supabase.from('universities').select('id, name').in('id', mappedUniversityIds) : { data: [] }
        ])
        
        // Create lookup maps
        const userMap = {}
        usersResult.data?.forEach(user => { userMap[user.id] = user })
        
        // Create reverse mapping for universities (new ID -> old ID)
        const reverseMapping = {}
        Object.keys(univIdMapping).forEach(oldId => {
          reverseMapping[univIdMapping[oldId]] = oldId
        })
        
        const univMap = {}
        universitiesResult.data?.forEach(univ => {
          // Map both old and new IDs to the same university data
          const oldId = reverseMapping[univ.id] || univ.id
          univMap[oldId] = { id: oldId, name: univ.name }
          univMap[univ.id] = { id: univ.id, name: univ.name }
        })
        
        // Map data to students
        students.forEach(student => {
          if (student.userId && userMap[student.userId]) {
            student.users = userMap[student.userId]
          }
          if (student.universityId && univMap[student.universityId]) {
            student.organizations = univMap[student.universityId]
          }
        })
      }
      
      return NextResponse.json(students || [])
    }

    // GET /api/passports - List all skill passports with pagination, search, and filters (ENHANCED)
    if (path === '/passports') {
      // Get parameters from query string
      const url = new URL(request.url)
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = parseInt(url.searchParams.get('limit') || '20')
      const offset = (page - 1) * limit
      const search = url.searchParams.get('search') || ''
      const statusFilter = url.searchParams.get('status') || ''
      const nsqfLevelFilter = url.searchParams.get('nsqfLevel') || ''
      const universityFilter = url.searchParams.get('university') || ''
      const sortBy = url.searchParams.get('sortBy') || 'createdAt'
      const sortOrder = url.searchParams.get('sortOrder') || 'desc'
      
      // Build the query for passports
      let passportsQuery = supabase.from('skill_passports').select('*', { count: 'exact' })
      
      // Apply status filter
      if (statusFilter && statusFilter !== 'all') {
        passportsQuery = passportsQuery.eq('status', statusFilter)
      }
      
      // Apply NSQF level filter
      if (nsqfLevelFilter && nsqfLevelFilter !== 'all') {
        passportsQuery = passportsQuery.eq('nsqfLevel', parseInt(nsqfLevelFilter))
      }
      
      // Apply sorting
      const ascending = sortOrder === 'asc'
      if (sortBy === 'nsqfLevel') {
        passportsQuery = passportsQuery.order('nsqfLevel', { ascending, nullsFirst: false })
      } else if (sortBy === 'createdAt') {
        passportsQuery = passportsQuery.order('createdAt', { ascending })
      }
      
      // Execute query with pagination
      const { data: passports, error: passportsError, count } = await passportsQuery.range(offset, offset + limit - 1)
      
      if (passportsError) {
        console.error('Error fetching passports:', passportsError)
        return NextResponse.json({ error: 'Failed to fetch passports' }, { status: 500 })
      }
      
      let filteredPassports = passports || []
      
      // If we have passports, fetch all related data in bulk
      if (filteredPassports.length > 0) {
        const studentIds = filteredPassports.map(p => p.studentId).filter(Boolean)
        
        if (studentIds.length > 0) {
          // Fetch all students and their users in parallel
          const [studentsResult, usersResult] = await Promise.all([
            supabase.from('students').select('*').in('id', studentIds),
            supabase.from('students').select('userId, organizationId').in('id', studentIds).then(async (result) => {
              if (result.data && result.data.length > 0) {
                const userIds = result.data.map(s => s.userId).filter(Boolean)
                if (userIds.length > 0) {
                  return await supabase.from('users').select('id, email, metadata').in('id', userIds)
                }
              }
              return { data: [] }
            })
          ])
          
          const students = studentsResult.data || []
          const users = usersResult.data || []
          
          // Fetch universities if needed for filtering
          const orgIds = students.map(s => s.universityId || s.organizationId).filter(Boolean)
          let universities = []
          if (orgIds.length > 0) {
            const { data: univData } = await supabase.from('universities').select('id, name').in('id', orgIds)
            universities = univData || []
          }
          
          // Create lookup maps for O(1) access
          const studentMap = {}
          students.forEach(student => {
            // Parse profile if it's a string
            if (student.profile && typeof student.profile === 'string') {
              try {
                const cleanedProfile = student.profile.replace(/:\s*NaN/g, ': null')
                student.profile = JSON.parse(cleanedProfile)
              } catch (parseError) {
                student.profile = {}
              }
            }
            studentMap[student.id] = student
          })
          
          const userMap = {}
          users.forEach(user => {
            userMap[user.id] = user
          })
          
          const universityMap = {}
          universities.forEach(univ => {
            universityMap[univ.id] = univ
          })
          
          // Map data to passports
          filteredPassports.forEach(passport => {
            if (passport.studentId && studentMap[passport.studentId]) {
              const student = studentMap[passport.studentId]
              if (student.userId && userMap[student.userId]) {
                student.users = userMap[student.userId]
              }
              const univId = student.universityId || student.organizationId
              if (univId && universityMap[univId]) {
                student.university = universityMap[univId]
              }
              passport.students = student
            }
          })
        }
      }
      
      // Apply client-side search filter (for student name/email) and university filter
      if (search || universityFilter) {
        filteredPassports = filteredPassports.filter(passport => {
          let matchesSearch = true
          let matchesUniversity = true
          
          if (search) {
            const searchLower = search.toLowerCase()
            const studentName = passport.students?.profile?.name || ''
            const studentEmail = passport.students?.email || passport.students?.users?.email || ''
            const passportId = passport.id || ''
            
            matchesSearch = studentName.toLowerCase().includes(searchLower) ||
                           studentEmail.toLowerCase().includes(searchLower) ||
                           passportId.toLowerCase().includes(searchLower)
          }
          
          if (universityFilter && universityFilter !== 'all') {
            const univId = passport.students?.universityId || passport.students?.organizationId
            matchesUniversity = univId === universityFilter
          }
          
          return matchesSearch && matchesUniversity
        })
      }
      
      // Apply client-side sorting for student name
      if (sortBy === 'studentName') {
        filteredPassports.sort((a, b) => {
          const nameA = a.students?.profile?.name || a.students?.users?.email || ''
          const nameB = b.students?.profile?.name || b.students?.users?.email || ''
          if (ascending) {
            return nameA.localeCompare(nameB)
          } else {
            return nameB.localeCompare(nameA)
          }
        })
      }
      
      // Return paginated response
      return NextResponse.json({
        data: filteredPassports,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      })
    }

    // GET /api/verifications - List recent verifications (OPTIMIZED)
    if (path === '/verifications') {
      const { data: verifications, error } = await supabase
        .from('verifications')
        .select('*')
        .order('createdAt', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Error fetching verifications:', error)
        return NextResponse.json({ error: 'Failed to fetch verifications' }, { status: 500 })
      }
      
      // Fetch all user emails in bulk
      if (verifications && verifications.length > 0) {
        const userIds = verifications.map(v => v.performedBy).filter(Boolean)
        
        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from('users')
            .select('id, email')
            .in('id', userIds)
          
          const userMap = {}
          users?.forEach(user => { userMap[user.id] = user })
          
          verifications.forEach(verification => {
            if (verification.performedBy && userMap[verification.performedBy]) {
              verification.users = userMap[verification.performedBy]
            }
          })
        }
      }
      
      return NextResponse.json(verifications || [])
    }

    // GET /api/audit-logs - List audit logs (OPTIMIZED)
    if (path === '/audit-logs') {
      const { data: logs, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('createdAt', { ascending: false })
        .limit(100)

      if (error) {
        console.error('Error fetching audit logs:', error)
        return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 })
      }
      
      // Fetch all user emails in bulk
      if (logs && logs.length > 0) {
        const userIds = logs.map(l => l.actorId).filter(Boolean)
        
        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from('users')
            .select('id, email')
            .in('id', userIds)
          
          const userMap = {}
          users?.forEach(user => { userMap[user.id] = user })
          
          logs.forEach(log => {
            if (log.actorId && userMap[log.actorId]) {
              log.users = userMap[log.actorId]
            }
          })
        }
      }
      
      return NextResponse.json(logs || [])
    }

    // GET /api/analytics/state-wise - State-wise distribution
    if (path === '/analytics/state-wise') {
      // Fetch from both universities and recruiters tables
      const [universitiesResult, recruitersResult] = await Promise.all([
        supabase.from('universities').select('state'),
        supabase.from('recruiters').select('state')
      ])

      if (universitiesResult.error) throw universitiesResult.error
      if (recruitersResult.error) throw recruitersResult.error

      const stateCounts = {}
      
      // Count universities by state
      universitiesResult.data?.forEach(univ => {
        if (univ.state) {
          stateCounts[univ.state] = (stateCounts[univ.state] || 0) + 1
        }
      })
      
      // Count recruiters by state
      recruitersResult.data?.forEach(rec => {
        if (rec.state) {
          stateCounts[rec.state] = (stateCounts[rec.state] || 0) + 1
        }
      })

      const chartData = Object.entries(stateCounts).map(([state, count]) => ({
        state,
        count
      }))

      return NextResponse.json(chartData)
    }

    // GET /api/analytics/trends - Employability trends
    if (path === '/analytics/trends') {
      const { data: metrics, error } = await supabase
        .from('metrics_snapshots')
        .select('*')
        .order('snapshotDate', { ascending: true })
        .limit(30)

      if (error) throw error

      const chartData = metrics.map(m => ({
        date: m.snapshotDate,
        employability: parseFloat(m.employabilityIndex) || 0
      }))

      return NextResponse.json(chartData)
    }

    // GET /api/analytics/university-reports - University-wise analytics (OPTIMIZED)
    if (path === '/analytics/university-reports') {
      // Mapping from old organization IDs (in students.universityId) to new university IDs
      const univIdMapping = {
        'f1ed42b6-ffe7-4108-90bb-6776b6504f7b': '5ca5589e-b49d-4027-baf7-7e2a88ae612a', // Periyar University
        '609f59c9-6894-499b-8479-e826c219e0df': '632a5084-eeae-4f2e-b4bc-32593f2dcc00', // Alagappa University
        '1b0ab392-4fba-4037-ae99-6cdf1e0a232d': '85ed5785-dcb2-4d26-8100-a5fb492f0988', // Annamalai University
        'bf405453-cd17-4b45-9bc6-c89407272d7f': '2e9cb79d-0fb7-4b52-9588-d2a7262c9f68', // University of Madras
        'aeaf831c-7e48-400a-90e3-8d879ef84257': '707b0f68-6855-428c-a630-65926f8c8116', // Manonmaniam Sundaranar University
        'cec6f9e4-ab41-41a1-b889-699bec40ee69': '66baa6ed-50ce-433d-84f9-c296c6d5806d', // Bharathiar University
        'b5b42149-b444-47c3-939b-9ac7b1686414': '0dd1623e-a820-4da1-8c8b-a436db386a59', // Mother Teresa University
        'e0decdad-0553-4b1a-ad15-a16709bf7671': 'fdba4612-5249-4257-87e1-dc4858151ee8', // Bharathidasan University
        '54e9f738-fdeb-4116-8032-a27cac4a0112': 'b559f0da-c071-47ec-a866-b646751845bb', // Madurai Kamaraj University
        '2877f238-ec9f-49af-8bb5-6efd30bc3654': '299ac0e3-f50f-41bc-965c-7274cfa9af25'  // Thiruvalluvar University
      }

      // Fetch all data in parallel from universities table
      const [universitiesResult, studentsResult, passportsResult] = await Promise.all([
        supabase.from('universities').select('id, name, state'),
        supabase.from('students').select('id, universityId'),
        supabase.from('skill_passports').select('studentId, status')
      ])

      if (universitiesResult.error) throw universitiesResult.error

      // Map universities to match expected format using id directly
      const orgs = (universitiesResult.data || []).map(u => ({
        id: u.id,
        name: u.name,
        state: u.state
      }))
      const students = studentsResult.data || []
      const passports = passportsResult.data || []

      // Create lookup maps for O(1) access
      // Use mapping to convert old universityIds to new university IDs
      const studentsByUniversity = {}
      const passportsByStudent = {}

      students.forEach(student => {
        // Map old university ID to new ID
        const newUnivId = univIdMapping[student.universityId] || student.universityId
        if (!studentsByUniversity[newUnivId]) {
          studentsByUniversity[newUnivId] = []
        }
        studentsByUniversity[newUnivId].push(student.id)
      })

      passports.forEach(passport => {
        if (!passportsByStudent[passport.studentId]) {
          passportsByStudent[passport.studentId] = []
        }
        passportsByStudent[passport.studentId].push(passport.status)
      })

      // Calculate metrics for each university
      const universityReports = orgs.map(org => {
        const studentIds = studentsByUniversity[org.id] || []
        const enrollmentCount = studentIds.length

        let totalPassports = 0
        let verifiedCount = 0

        studentIds.forEach(studentId => {
          const studentPassports = passportsByStudent[studentId] || []
          totalPassports += studentPassports.length
          verifiedCount += studentPassports.filter(status => status === 'verified').length
        })

        const completionRate = totalPassports > 0 ? ((verifiedCount / totalPassports) * 100).toFixed(1) : 0
        const verificationRate = enrollmentCount > 0 ? ((totalPassports / enrollmentCount) * 100).toFixed(1) : 0

        return {
          universityId: org.id,
          universityName: org.name,
          state: org.state,
          enrollmentCount,
          totalPassports,
          verifiedPassports: verifiedCount,
          completionRate: parseFloat(completionRate),
          verificationRate: parseFloat(verificationRate)
        }
      })

      return NextResponse.json(universityReports)
    }

    // GET /api/analytics/recruiter-metrics - Recruiter engagement analytics
    if (path === '/analytics/recruiter-metrics') {
      // For now, create mock data structure since we need to set up the tables first
      const mockRecruiterMetrics = {
        totalSearches: 1247,
        profileViews: 3456,
        contactAttempts: 892,
        shortlisted: 234,
        hireIntents: 78,
        searchTrends: [
          { month: 'Jan', searches: 120, views: 340, contacts: 80 },
          { month: 'Feb', searches: 150, views: 420, contacts: 95 },
          { month: 'Mar', searches: 180, views: 450, contacts: 110 },
          { month: 'Apr', searches: 200, views: 520, contacts: 125 },
          { month: 'May', searches: 220, views: 580, contacts: 140 },
          { month: 'Jun', searches: 240, views: 620, contacts: 155 }
        ],
        topSkillsSearched: [
          { skill: 'JavaScript', searches: 245 },
          { skill: 'Python', searches: 198 },
          { skill: 'React', searches: 167 },
          { skill: 'Node.js', searches: 134 },
          { skill: 'AI/ML', searches: 123 }
        ]
      }
      return NextResponse.json(mockRecruiterMetrics)
    }

    // GET /api/analytics/placement-conversion - Placement pipeline analytics
    if (path === '/analytics/placement-conversion') {
      const mockConversionData = {
        conversionFunnel: [
          { stage: 'Verified Profiles', count: 1500, percentage: 100 },
          { stage: 'Viewed by Recruiters', count: 890, percentage: 59.3 },
          { stage: 'Applied to Jobs', count: 650, percentage: 43.3 },
          { stage: 'Shortlisted', count: 320, percentage: 21.3 },
          { stage: 'Interviewed', count: 180, percentage: 12.0 },
          { stage: 'Job Offers', count: 95, percentage: 6.3 },
          { stage: 'Hired', count: 72, percentage: 4.8 },
          { stage: '6M Retention', count: 58, percentage: 3.9 },
          { stage: '1Y Retention', count: 45, percentage: 3.0 }
        ],
        monthlyConversions: [
          { month: 'Jan', applied: 85, hired: 12, retained: 8 },
          { month: 'Feb', applied: 92, hired: 15, retained: 11 },
          { month: 'Mar', applied: 108, hired: 18, retained: 14 },
          { month: 'Apr', applied: 125, hired: 22, retained: 17 },
          { month: 'May', applied: 140, hired: 25, retained: 20 },
          { month: 'Jun', applied: 156, hired: 28, retained: 23 }
        ]
      }
      return NextResponse.json(mockConversionData)
    }

    // GET /api/analytics/state-heatmap - Enhanced state-wise heat map data (OPTIMIZED)
    if (path === '/analytics/state-heatmap') {
      // Mapping from old organization IDs to new university IDs
      const univIdMapping = {
        'f1ed42b6-ffe7-4108-90bb-6776b6504f7b': '5ca5589e-b49d-4027-baf7-7e2a88ae612a',
        '609f59c9-6894-499b-8479-e826c219e0df': '632a5084-eeae-4f2e-b4bc-32593f2dcc00',
        '1b0ab392-4fba-4037-ae99-6cdf1e0a232d': '85ed5785-dcb2-4d26-8100-a5fb492f0988',
        'bf405453-cd17-4b45-9bc6-c89407272d7f': '2e9cb79d-0fb7-4b52-9588-d2a7262c9f68',
        'aeaf831c-7e48-400a-90e3-8d879ef84257': '707b0f68-6855-428c-a630-65926f8c8116',
        'cec6f9e4-ab41-41a1-b889-699bec40ee69': '66baa6ed-50ce-433d-84f9-c296c6d5806d',
        'b5b42149-b444-47c3-939b-9ac7b1686414': '0dd1623e-a820-4da1-8c8b-a436db386a59',
        'e0decdad-0553-4b1a-ad15-a16709bf7671': 'fdba4612-5249-4257-87e1-dc4858151ee8',
        '54e9f738-fdeb-4116-8032-a27cac4a0112': 'b559f0da-c071-47ec-a866-b646751845bb',
        '2877f238-ec9f-49af-8bb5-6efd30bc3654': '299ac0e3-f50f-41bc-965c-7274cfa9af25'
      }

      // Fetch all data in parallel from new tables
      const [universitiesResult, recruitersResult, studentsResult, passportsResult] = await Promise.all([
        supabase.from('universities').select('id, state'),
        supabase.from('recruiters').select('id, state'),
        supabase.from('students').select('id, universityId'),
        supabase.from('skill_passports').select('studentId, status')
      ])

      if (universitiesResult.error) throw universitiesResult.error

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
      ]
      const students = studentsResult.data || []
      const passports = passportsResult.data || []

      // Create lookup maps for O(1) access
      const orgMap = {}
      orgs.forEach(org => { orgMap[org.id] = org })

      const passportsByStudent = {}
      passports.forEach(passport => {
        if (!passportsByStudent[passport.studentId]) {
          passportsByStudent[passport.studentId] = []
        }
        passportsByStudent[passport.studentId].push(passport.status)
      })

      // Calculate engagement metrics by state
      const stateMetrics = {}
      
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
            }
          }
          
          if (org.type === 'university') {
            stateMetrics[org.state].universities++
          }
        }
      })

      // Add student and passport data using lookup map with ID mapping
      students.forEach(student => {
        // Map old university ID to new ID
        const newUnivId = univIdMapping[student.universityId] || student.universityId
        const university = orgMap[newUnivId]
        if (university?.state && stateMetrics[university.state]) {
          stateMetrics[university.state].students++
          
          const studentPassports = passportsByStudent[student.id] || []
          const verifiedCount = studentPassports.filter(status => status === 'verified').length
          stateMetrics[university.state].verifiedPassports += verifiedCount
        }
      })

      // Calculate scores
      Object.values(stateMetrics).forEach(state => {
        state.engagementScore = Math.min(95, Math.floor((state.students / Math.max(state.universities, 1)) * 2 + Math.random() * 20))
        state.employabilityIndex = Math.min(98, Math.floor((state.verifiedPassports / Math.max(state.students, 1)) * 100 + Math.random() * 15))
      })

      return NextResponse.json(Object.values(stateMetrics))
    }

    // GET /api/analytics/ai-insights - AI-powered insights
    if (path === '/analytics/ai-insights') {
      const mockAIInsights = {
        emergingSkills: [
          { skill: 'Generative AI', growth: '+156%', category: 'AI/ML', trend: 'rising' },
          { skill: 'Kubernetes', growth: '+89%', category: 'DevOps', trend: 'rising' },
          { skill: 'TypeScript', growth: '+67%', category: 'Programming', trend: 'rising' },
          { skill: 'GraphQL', growth: '+45%', category: 'API', trend: 'stable' },
          { skill: 'Blockchain', growth: '+34%', category: 'Emerging', trend: 'rising' }
        ],
        soughtSkillTags: [
          { tag: 'Full Stack', mentions: 456, avgSalary: 680000 },
          { tag: 'AI/ML Engineer', mentions: 234, avgSalary: 950000 },
          { tag: 'DevOps', mentions: 189, avgSalary: 750000 },
          { tag: 'Data Science', mentions: 167, avgSalary: 820000 },
          { tag: 'Cloud Architect', mentions: 145, avgSalary: 1200000 }
        ],
        topUniversities: [
          { 
            name: 'IIT Delhi', 
            performanceScore: 94.5, 
            placementRate: 89.2, 
            avgPackage: 1250000,
            trend: 'rising'
          },
          { 
            name: 'IIT Bombay', 
            performanceScore: 93.8, 
            placementRate: 91.5, 
            avgPackage: 1180000,
            trend: 'stable'
          },
          { 
            name: 'IIT Bangalore', 
            performanceScore: 92.6, 
            placementRate: 87.3, 
            avgPackage: 1090000,
            trend: 'rising'
          },
          { 
            name: 'NIT Trichy', 
            performanceScore: 88.4, 
            placementRate: 82.7, 
            avgPackage: 850000,
            trend: 'stable'
          },
          { 
            name: 'BITS Pilani', 
            performanceScore: 87.9, 
            placementRate: 85.1, 
            avgPackage: 920000,
            trend: 'rising'
          }
        ]
      }
      return NextResponse.json(mockAIInsights)
    }

    // GET /api/analytics/university-reports/export - Export university reports to CSV
    if (path === '/analytics/university-reports/export') {
      // Mapping from old organization IDs to new university IDs
      const univIdMapping = {
        'f1ed42b6-ffe7-4108-90bb-6776b6504f7b': '5ca5589e-b49d-4027-baf7-7e2a88ae612a',
        '609f59c9-6894-499b-8479-e826c219e0df': '632a5084-eeae-4f2e-b4bc-32593f2dcc00',
        '1b0ab392-4fba-4037-ae99-6cdf1e0a232d': '85ed5785-dcb2-4d26-8100-a5fb492f0988',
        'bf405453-cd17-4b45-9bc6-c89407272d7f': '2e9cb79d-0fb7-4b52-9588-d2a7262c9f68',
        'aeaf831c-7e48-400a-90e3-8d879ef84257': '707b0f68-6855-428c-a630-65926f8c8116',
        'cec6f9e4-ab41-41a1-b889-699bec40ee69': '66baa6ed-50ce-433d-84f9-c296c6d5806d',
        'b5b42149-b444-47c3-939b-9ac7b1686414': '0dd1623e-a820-4da1-8c8b-a436db386a59',
        'e0decdad-0553-4b1a-ad15-a16709bf7671': 'fdba4612-5249-4257-87e1-dc4858151ee8',
        '54e9f738-fdeb-4116-8032-a27cac4a0112': 'b559f0da-c071-47ec-a866-b646751845bb',
        '2877f238-ec9f-49af-8bb5-6efd30bc3654': '299ac0e3-f50f-41bc-965c-7274cfa9af25'
      }

      const [universitiesResult, studentsResult, passportsResult] = await Promise.all([
        supabase.from('universities').select('id, name, state'),
        supabase.from('students').select('id, universityId'),
        supabase.from('skill_passports').select('studentId, status')
      ])

      if (universitiesResult.error) {
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
      }

      const orgs = (universitiesResult.data || []).map(u => ({
        id: u.id,
        name: u.name,
        state: u.state
      }))
      const students = studentsResult.data || []
      const passports = passportsResult.data || []

      const studentsByUniversity = {}
      const passportsByStudent = {}

      students.forEach(student => {
        const newUnivId = univIdMapping[student.universityId] || student.universityId
        if (!studentsByUniversity[newUnivId]) {
          studentsByUniversity[newUnivId] = []
        }
        studentsByUniversity[newUnivId].push(student.id)
      })

      passports.forEach(passport => {
        if (!passportsByStudent[passport.studentId]) {
          passportsByStudent[passport.studentId] = []
        }
        passportsByStudent[passport.studentId].push(passport.status)
      })

      const universityReports = orgs.map(org => {
        const studentIds = studentsByUniversity[org.id] || []
        const enrollmentCount = studentIds.length

        let totalPassports = 0
        let verifiedCount = 0

        studentIds.forEach(studentId => {
          const studentPassports = passportsByStudent[studentId] || []
          totalPassports += studentPassports.length
          verifiedCount += studentPassports.filter(status => status === 'verified').length
        })

        const completionRate = totalPassports > 0 ? ((verifiedCount / totalPassports) * 100).toFixed(1) : 0
        const verificationRate = enrollmentCount > 0 ? ((totalPassports / enrollmentCount) * 100).toFixed(1) : 0

        return {
          universityName: org.name,
          state: org.state,
          enrollmentCount,
          totalPassports,
          verifiedPassports: verifiedCount,
          completionRate: parseFloat(completionRate),
          verificationRate: parseFloat(verificationRate)
        }
      })

      // Create CSV content
      const headers = ['University Name', 'State', 'Enrollment Count', 'Total Passports', 'Verified Passports', 'Completion Rate (%)', 'Verification Rate (%)']
      const csvRows = [headers.join(',')]

      universityReports.forEach(r => {
        const row = [
          `"${r.universityName || ''}"`,
          `"${r.state || ''}"`,
          r.enrollmentCount,
          r.totalPassports,
          r.verifiedPassports,
          r.completionRate,
          r.verificationRate
        ]
        csvRows.push(row.join(','))
      })

      const csvContent = csvRows.join('\n')

      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="university-reports-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    // GET /api/analytics/recruiter-metrics/export - Export recruiter metrics to CSV
    if (path === '/analytics/recruiter-metrics/export') {
      const mockRecruiterMetrics = {
        totalSearches: 1247,
        profileViews: 3456,
        contactAttempts: 892,
        shortlisted: 234,
        hireIntents: 78,
        searchTrends: [
          { month: 'Jan', searches: 120, views: 340, contacts: 80 },
          { month: 'Feb', searches: 150, views: 420, contacts: 95 },
          { month: 'Mar', searches: 180, views: 450, contacts: 110 },
          { month: 'Apr', searches: 200, views: 520, contacts: 125 },
          { month: 'May', searches: 220, views: 580, contacts: 140 },
          { month: 'Jun', searches: 240, views: 620, contacts: 155 }
        ],
        topSkillsSearched: [
          { skill: 'JavaScript', searches: 245 },
          { skill: 'Python', searches: 198 },
          { skill: 'React', searches: 167 },
          { skill: 'Node.js', searches: 134 },
          { skill: 'AI/ML', searches: 123 }
        ]
      }

      // Create CSV for search trends
      const headers1 = ['Month', 'Searches', 'Profile Views', 'Contact Attempts']
      const csvRows1 = [headers1.join(',')]
      
      mockRecruiterMetrics.searchTrends.forEach(trend => {
        const row = [trend.month, trend.searches, trend.views, trend.contacts]
        csvRows1.push(row.join(','))
      })

      csvRows1.push('') // Empty line
      csvRows1.push('Top Skills Searched')
      
      const headers2 = ['Skill', 'Total Searches']
      csvRows1.push(headers2.join(','))
      
      mockRecruiterMetrics.topSkillsSearched.forEach(skill => {
        const row = [`"${skill.skill}"`, skill.searches]
        csvRows1.push(row.join(','))
      })

      csvRows1.push('') // Empty line
      csvRows1.push('Summary Metrics')
      csvRows1.push(`Total Searches,${mockRecruiterMetrics.totalSearches}`)
      csvRows1.push(`Total Profile Views,${mockRecruiterMetrics.profileViews}`)
      csvRows1.push(`Contact Attempts,${mockRecruiterMetrics.contactAttempts}`)
      csvRows1.push(`Shortlisted,${mockRecruiterMetrics.shortlisted}`)
      csvRows1.push(`Hire Intents,${mockRecruiterMetrics.hireIntents}`)

      const csvContent = csvRows1.join('\n')

      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="recruiter-metrics-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    // GET /api/analytics/placement-conversion/export - Export placement conversion data to CSV
    if (path === '/analytics/placement-conversion/export') {
      const mockConversionData = {
        conversionFunnel: [
          { stage: 'Verified Profiles', count: 1500, percentage: 100 },
          { stage: 'Viewed by Recruiters', count: 890, percentage: 59.3 },
          { stage: 'Applied to Jobs', count: 650, percentage: 43.3 },
          { stage: 'Shortlisted', count: 320, percentage: 21.3 },
          { stage: 'Interviewed', count: 180, percentage: 12.0 },
          { stage: 'Job Offers', count: 95, percentage: 6.3 },
          { stage: 'Hired', count: 72, percentage: 4.8 },
          { stage: '6M Retention', count: 58, percentage: 3.9 },
          { stage: '1Y Retention', count: 45, percentage: 3.0 }
        ],
        monthlyConversions: [
          { month: 'Jan', applied: 85, hired: 12, retained: 8 },
          { month: 'Feb', applied: 92, hired: 15, retained: 11 },
          { month: 'Mar', applied: 108, hired: 18, retained: 14 },
          { month: 'Apr', applied: 125, hired: 22, retained: 17 },
          { month: 'May', applied: 140, hired: 25, retained: 20 },
          { month: 'Jun', applied: 156, hired: 28, retained: 23 }
        ]
      }

      // Create CSV for conversion funnel
      const headers1 = ['Stage', 'Count', 'Percentage']
      const csvRows1 = [headers1.join(',')]
      
      mockConversionData.conversionFunnel.forEach(stage => {
        const row = [`"${stage.stage}"`, stage.count, stage.percentage]
        csvRows1.push(row.join(','))
      })

      csvRows1.push('') // Empty line
      csvRows1.push('Monthly Conversions')
      
      const headers2 = ['Month', 'Applied', 'Hired', 'Retained']
      csvRows1.push(headers2.join(','))
      
      mockConversionData.monthlyConversions.forEach(month => {
        const row = [month.month, month.applied, month.hired, month.retained]
        csvRows1.push(row.join(','))
      })

      const csvContent = csvRows1.join('\n')

      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="placement-conversion-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    // GET /api/analytics/state-heatmap/export - Export state heatmap data to CSV
    if (path === '/analytics/state-heatmap/export') {
      const univIdMapping = {
        'f1ed42b6-ffe7-4108-90bb-6776b6504f7b': '5ca5589e-b49d-4027-baf7-7e2a88ae612a',
        '609f59c9-6894-499b-8479-e826c219e0df': '632a5084-eeae-4f2e-b4bc-32593f2dcc00',
        '1b0ab392-4fba-4037-ae99-6cdf1e0a232d': '85ed5785-dcb2-4d26-8100-a5fb492f0988',
        'bf405453-cd17-4b45-9bc6-c89407272d7f': '2e9cb79d-0fb7-4b52-9588-d2a7262c9f68',
        'aeaf831c-7e48-400a-90e3-8d879ef84257': '707b0f68-6855-428c-a630-65926f8c8116',
        'cec6f9e4-ab41-41a1-b889-699bec40ee69': '66baa6ed-50ce-433d-84f9-c296c6d5806d',
        'b5b42149-b444-47c3-939b-9ac7b1686414': '0dd1623e-a820-4da1-8c8b-a436db386a59',
        'e0decdad-0553-4b1a-ad15-a16709bf7671': 'fdba4612-5249-4257-87e1-dc4858151ee8',
        '54e9f738-fdeb-4116-8032-a27cac4a0112': 'b559f0da-c071-47ec-a866-b646751845bb',
        '2877f238-ec9f-49af-8bb5-6efd30bc3654': '299ac0e3-f50f-41bc-965c-7274cfa9af25'
      }

      const [universitiesResult, recruitersResult, studentsResult, passportsResult] = await Promise.all([
        supabase.from('universities').select('id, state'),
        supabase.from('recruiters').select('id, state'),
        supabase.from('students').select('id, universityId'),
        supabase.from('skill_passports').select('studentId, status')
      ])

      if (universitiesResult.error) {
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
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
      ]
      const students = studentsResult.data || []
      const passports = passportsResult.data || []

      const orgMap = {}
      orgs.forEach(org => { orgMap[org.id] = org })

      const passportsByStudent = {}
      passports.forEach(passport => {
        if (!passportsByStudent[passport.studentId]) {
          passportsByStudent[passport.studentId] = []
        }
        passportsByStudent[passport.studentId].push(passport.status)
      })

      const stateMetrics = {}
      
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
            }
          }
          
          if (org.type === 'university') {
            stateMetrics[org.state].universities++
          }
        }
      })

      students.forEach(student => {
        const newUnivId = univIdMapping[student.universityId] || student.universityId
        const university = orgMap[newUnivId]
        if (university?.state && stateMetrics[university.state]) {
          stateMetrics[university.state].students++
          
          const studentPassports = passportsByStudent[student.id] || []
          const verifiedCount = studentPassports.filter(status => status === 'verified').length
          stateMetrics[university.state].verifiedPassports += verifiedCount
        }
      })

      Object.values(stateMetrics).forEach(state => {
        state.engagementScore = Math.min(95, Math.floor((state.students / Math.max(state.universities, 1)) * 2 + Math.random() * 20))
        state.employabilityIndex = Math.min(98, Math.floor((state.verifiedPassports / Math.max(state.students, 1)) * 100 + Math.random() * 15))
      })

      const stateData = Object.values(stateMetrics)

      // Create CSV content
      const headers = ['State', 'Universities', 'Students', 'Verified Passports', 'Engagement Score', 'Employability Index']
      const csvRows = [headers.join(',')]

      stateData.forEach(s => {
        const row = [
          `"${s.state || ''}"`,
          s.universities,
          s.students,
          s.verifiedPassports,
          s.engagementScore,
          s.employabilityIndex
        ]
        csvRows.push(row.join(','))
      })

      const csvContent = csvRows.join('\n')

      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="state-heatmap-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    // GET /api/analytics/ai-insights/export - Export AI insights to CSV
    if (path === '/analytics/ai-insights/export') {
      const mockAIInsights = {
        emergingSkills: [
          { skill: 'Generative AI', growth: '+156%', category: 'AI/ML', trend: 'rising' },
          { skill: 'Kubernetes', growth: '+89%', category: 'DevOps', trend: 'rising' },
          { skill: 'TypeScript', growth: '+67%', category: 'Programming', trend: 'rising' },
          { skill: 'GraphQL', growth: '+45%', category: 'API', trend: 'stable' },
          { skill: 'Blockchain', growth: '+34%', category: 'Emerging', trend: 'rising' }
        ],
        soughtSkillTags: [
          { tag: 'Full Stack', mentions: 456, avgSalary: 680000 },
          { tag: 'AI/ML Engineer', mentions: 234, avgSalary: 950000 },
          { tag: 'DevOps', mentions: 189, avgSalary: 750000 },
          { tag: 'Data Science', mentions: 167, avgSalary: 820000 },
          { tag: 'Cloud Architect', mentions: 145, avgSalary: 1200000 }
        ],
        topUniversities: [
          { name: 'IIT Delhi', performanceScore: 94.5, placementRate: 89.2, avgPackage: 1250000, trend: 'rising' },
          { name: 'IIT Bombay', performanceScore: 93.8, placementRate: 91.5, avgPackage: 1180000, trend: 'stable' },
          { name: 'IIT Bangalore', performanceScore: 92.6, placementRate: 87.3, avgPackage: 1090000, trend: 'rising' },
          { name: 'NIT Trichy', performanceScore: 88.4, placementRate: 82.7, avgPackage: 850000, trend: 'stable' },
          { name: 'BITS Pilani', performanceScore: 87.9, placementRate: 85.1, avgPackage: 920000, trend: 'rising' }
        ]
      }

      // Create CSV with multiple sections
      const csvRows = []
      
      csvRows.push('Emerging Skills')
      csvRows.push(['Skill', 'Growth', 'Category', 'Trend'].join(','))
      mockAIInsights.emergingSkills.forEach(skill => {
        const row = [`"${skill.skill}"`, skill.growth, `"${skill.category}"`, skill.trend]
        csvRows.push(row.join(','))
      })

      csvRows.push('') // Empty line
      csvRows.push('Sought Skill Tags')
      csvRows.push(['Tag', 'Mentions', 'Avg Salary (₹)'].join(','))
      mockAIInsights.soughtSkillTags.forEach(tag => {
        const row = [`"${tag.tag}"`, tag.mentions, tag.avgSalary]
        csvRows.push(row.join(','))
      })

      csvRows.push('') // Empty line
      csvRows.push('Top Universities')
      csvRows.push(['University Name', 'Performance Score', 'Placement Rate (%)', 'Avg Package (₹)', 'Trend'].join(','))
      mockAIInsights.topUniversities.forEach(univ => {
        const row = [`"${univ.name}"`, univ.performanceScore, univ.placementRate, univ.avgPackage, univ.trend]
        csvRows.push(row.join(','))
      })

      const csvContent = csvRows.join('\n')

      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="ai-insights-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    // Default route
    return NextResponse.json({ 
      message: 'Rareminds Super Admin Dashboard API',
      version: '1.0.0',
      endpoints: [
        '/api/metrics',
        '/api/users',
        '/api/organizations',
        '/api/students',
        '/api/passports',
        '/api/verifications',
        '/api/audit-logs',
        '/api/analytics/state-wise',
        '/api/analytics/trends',
        '/api/analytics/university-reports',
        '/api/analytics/recruiter-metrics',
        '/api/analytics/placement-conversion',
        '/api/analytics/state-heatmap',
        '/api/analytics/ai-insights'
      ]
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// POST routes
export async function POST(request) {
  const { pathname } = new URL(request.url)
  const path = pathname.replace('/api', '')

  try {
    // Only parse JSON body for endpoints that need it (not update-metrics)
    let body = {}
    if (path !== '/update-metrics') {
      body = await request.json()
    }

    // POST /api/verify - Verify a passport
    if (path === '/verify') {
      const { passportId, userId, note } = body

      // Update passport status
      const { error: updateError } = await supabase
        .from('skill_passports')
        .update({ status: 'verified' })
        .eq('id', passportId)

      if (updateError) throw updateError

      // Log verification
      const { error: verifyError } = await supabase
        .from('verifications')
        .insert({
          id: uuidv4(),
          targetTable: 'skill_passports',
          targetId: passportId,
          action: 'verify',
          performedBy: userId,
          note: note || 'Passport verified'
        })

      if (verifyError) throw verifyError

      // Log audit
      await logAudit(userId, 'verify_passport', passportId, { note })

      return NextResponse.json({ success: true, message: 'Passport verified successfully' })
    }

    // POST /api/suspend-user - Suspend a user
    if (path === '/suspend-user') {
      const { targetUserId, actorId, reason } = body

      // Update user status
      const { error: updateError } = await supabase
        .from('users')
        .update({ isActive: false })
        .eq('id', targetUserId)

      if (updateError) throw updateError

      // Log verification
      const { error: verifyError } = await supabase
        .from('verifications')
        .insert({
          id: uuidv4(),
          targetTable: 'users',
          targetId: targetUserId,
          action: 'suspend',
          performedBy: actorId,
          note: reason || 'User suspended'
        })

      if (verifyError) throw verifyError

      // Log audit
      await logAudit(actorId, 'suspend_user', targetUserId, { reason })

      return NextResponse.json({ success: true, message: 'User suspended successfully' })
    }

    // POST /api/activate-user - Activate a user
    if (path === '/activate-user') {
      const { targetUserId, actorId, note } = body

      // Update user status
      const { error: updateError } = await supabase
        .from('users')
        .update({ isActive: true })
        .eq('id', targetUserId)

      if (updateError) throw updateError

      // Log verification
      const { error: verifyError } = await supabase
        .from('verifications')
        .insert({
          id: uuidv4(),
          targetTable: 'users',
          targetId: targetUserId,
          action: 'activate',
          performedBy: actorId,
          note: note || 'User activated'
        })

      if (verifyError) throw verifyError

      // Log audit
      await logAudit(actorId, 'activate_user', targetUserId, { note })

      return NextResponse.json({ success: true, message: 'User activated successfully' })
    }

    // POST /api/reject-passport - Reject a passport
    if (path === '/reject-passport') {
      const { passportId, userId, reason } = body

      // Update passport status
      const { error: updateError } = await supabase
        .from('skill_passports')
        .update({ status: 'rejected' })
        .eq('id', passportId)

      if (updateError) throw updateError

      // Log verification
      const { error: verifyError } = await supabase
        .from('verifications')
        .insert({
          id: uuidv4(),
          targetTable: 'skill_passports',
          targetId: passportId,
          action: 'reject',
          performedBy: userId,
          note: reason || 'Passport rejected'
        })

      if (verifyError) throw verifyError

      // Log audit
      await logAudit(userId, 'reject_passport', passportId, { reason })

      return NextResponse.json({ success: true, message: 'Passport rejected successfully' })
    }

    // POST /api/approve-recruiter - Approve a recruiter organization
    if (path === '/approve-recruiter') {
      const { recruiterId, userId, note } = body

      // Update recruiter status in recruiters table
      const { error: updateError } = await supabase
        .from('recruiters')
        .update({ 
          verificationstatus: 'approved'
        })
        .eq('id', recruiterId)

      if (updateError) throw updateError

      // Log verification
      const { error: verifyError } = await supabase
        .from('verifications')
        .insert({
          id: uuidv4(),
          targetTable: 'recruiters',
          targetId: recruiterId,
          action: 'approve',
          performedBy: userId,
          note: note || 'Recruiter approved'
        })

      if (verifyError) throw verifyError

      // Log audit
      await logAudit(userId, 'approve_recruiter', recruiterId, { note })

      return NextResponse.json({ success: true, message: 'Recruiter approved successfully' })
    }

    // POST /api/reject-recruiter - Reject a recruiter organization
    if (path === '/reject-recruiter') {
      const { recruiterId, userId, reason } = body

      // Update recruiter status in recruiters table
      const { error: updateError } = await supabase
        .from('recruiters')
        .update({ 
          verificationstatus: 'rejected',
          isactive: false
        })
        .eq('id', recruiterId)

      if (updateError) throw updateError

      // Log verification
      const { error: verifyError } = await supabase
        .from('verifications')
        .insert({
          id: uuidv4(),
          targetTable: 'recruiters',
          targetId: recruiterId,
          action: 'reject',
          performedBy: userId,
          note: reason || 'Recruiter rejected'
        })

      if (verifyError) throw verifyError

      // Log audit
      await logAudit(userId, 'reject_recruiter', recruiterId, { reason })

      return NextResponse.json({ success: true, message: 'Recruiter rejected successfully' })
    }

    // POST /api/suspend-recruiter - Suspend a recruiter organization
    if (path === '/suspend-recruiter') {
      const { recruiterId, userId, reason } = body

      // Update recruiter status in recruiters table
      const { error: updateError } = await supabase
        .from('recruiters')
        .update({ isactive: false })
        .eq('id', recruiterId)

      if (updateError) throw updateError

      // Log verification
      const { error: verifyError } = await supabase
        .from('verifications')
        .insert({
          id: uuidv4(),
          targetTable: 'recruiters',
          targetId: recruiterId,
          action: 'suspend',
          performedBy: userId,
          note: reason || 'Recruiter suspended'
        })

      if (verifyError) throw verifyError

      // Log audit
      await logAudit(userId, 'suspend_recruiter', recruiterId, { reason })

      return NextResponse.json({ success: true, message: 'Recruiter suspended successfully' })
    }

    // POST /api/activate-recruiter - Activate a recruiter organization
    if (path === '/activate-recruiter') {
      const { recruiterId, userId, note } = body

      // Update recruiter status in recruiters table
      const { error: updateError } = await supabase
        .from('recruiters')
        .update({ isactive: true })
        .eq('id', recruiterId)

      if (updateError) throw updateError

      // Log verification
      const { error: verifyError } = await supabase
        .from('verifications')
        .insert({
          id: uuidv4(),
          targetTable: 'recruiters',
          targetId: recruiterId,
          action: 'activate',
          performedBy: userId,
          note: note || 'Recruiter activated'
        })

      if (verifyError) throw verifyError

      // Log audit
      await logAudit(userId, 'activate_recruiter', recruiterId, { note })

      return NextResponse.json({ success: true, message: 'Recruiter activated successfully' })
    }

    // POST /api/recruiters/bulk-action - Bulk action on multiple recruiters
    if (path === '/recruiters/bulk-action') {
      const { recruiterIds, action, userId, note, reason } = body
      
      if (!recruiterIds || !Array.isArray(recruiterIds) || recruiterIds.length === 0) {
        return NextResponse.json({ error: 'recruiterIds array is required' }, { status: 400 })
      }
      
      if (!action || !['approve', 'reject', 'suspend', 'activate'].includes(action)) {
        return NextResponse.json({ error: 'Valid action is required (approve, reject, suspend, activate)' }, { status: 400 })
      }
      
      try {
        let updateData = {}
        let verificationAction = action
        let logMessage = ''
        
        if (action === 'approve') {
          updateData = { verificationstatus: 'approved' }
          logMessage = note || 'Recruiters approved in bulk'
        } else if (action === 'reject') {
          updateData = { verificationstatus: 'rejected', isactive: false }
          logMessage = reason || 'Recruiters rejected in bulk'
        } else if (action === 'suspend') {
          updateData = { isactive: false }
          logMessage = reason || 'Recruiters suspended in bulk'
        } else if (action === 'activate') {
          updateData = { isactive: true }
          logMessage = note || 'Recruiters activated in bulk'
        }
        
        // Update all recruiters
        const { error: updateError } = await supabase
          .from('recruiters')
          .update(updateData)
          .in('id', recruiterIds)
        
        if (updateError) throw updateError
        
        // Log verification and audit for each recruiter
        const verificationRecords = recruiterIds.map(id => ({
          id: uuidv4(),
          targetTable: 'recruiters',
          targetId: id,
          action: verificationAction,
          performedBy: userId,
          note: logMessage
        }))
        
        const auditRecords = recruiterIds.map(id => ({
          id: uuidv4(),
          actorId: userId,
          action: `${action}_recruiter`,
          target: id,
          payload: { note: logMessage, bulk: true }
        }))
        
        // Insert in bulk
        await supabase.from('verifications').insert(verificationRecords)
        await supabase.from('audit_logs').insert(auditRecords)
        
        return NextResponse.json({ 
          success: true, 
          message: `${recruiterIds.length} recruiter(s) ${action}d successfully` 
        })
      } catch (error) {
        console.error('Bulk action error:', error)
        return NextResponse.json({ error: 'Bulk action failed', details: error.message }, { status: 500 })
      }
    }

    // POST /api/update-metrics - Update metrics snapshot
    if (path === '/update-metrics') {
      try {
        // Count universities from universities table
        const { data: universities } = await supabase
          .from('universities')
          .select('id')
        
        const activeUniversities = universities?.length || 0

        // Count recruiters from recruiters table
        const { data: recruiters } = await supabase
          .from('recruiters')
          .select('id')
        
        const activeRecruiters = recruiters?.length || 0

        // Count students
        const { data: students } = await supabase
          .from('students')
          .select('id')
        
        const registeredStudents = students?.length || 0

        // Get passports for verification metrics
        const { data: passports } = await supabase
          .from('skill_passports')
          .select('status')
        
        const totalPassports = passports?.length || 0
        const verifiedPassports = passports?.filter(p => p.status === 'verified').length || 0
        
        // Calculate employability index
        const employabilityIndex = registeredStudents > 0 
          ? parseFloat(((verifiedPassports / registeredStudents) * 100).toFixed(1))
          : 0

        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0]

        // Check if a snapshot for today already exists
        const { data: existingSnapshot } = await supabase
          .from('metrics_snapshots')
          .select('id')
          .eq('snapshotDate', today)
          .maybeSingle()

        let result
        if (existingSnapshot) {
          // Update existing snapshot
          const { error: updateError } = await supabase
            .from('metrics_snapshots')
            .update({
              activeUniversities,
              registeredStudents,
              verifiedPassports,
              employabilityIndex,
              activeRecruiters
            })
            .eq('id', existingSnapshot.id)

          if (updateError) throw updateError
          result = { action: 'updated', snapshotDate: today }
        } else {
          // Insert new snapshot
          const { error: insertError } = await supabase
            .from('metrics_snapshots')
            .insert({
              id: uuidv4(),
              snapshotDate: today,
              activeUniversities,
              registeredStudents,
              verifiedPassports,
              employabilityIndex,
              activeRecruiters
            })

          if (insertError) throw insertError
          result = { action: 'created', snapshotDate: today }
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
            activeRecruiters
          }
        })
      } catch (error) {
        console.error('Error updating metrics snapshot:', error)
        return NextResponse.json(
          { error: 'Failed to update metrics snapshot', details: error.message },
          { status: 500 }
        )
      }
    }

    // POST /api/login - Simple login (checking if user exists)
    if (path === '/login') {
      const { email, password } = body

      // Simple check - in production, use Supabase Auth
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single()

      if (error || !user) {
        return NextResponse.json(
          { error: 'Invalid credentials' },
          { status: 401 }
        )
      }

      if (!user.isActive) {
        return NextResponse.json(
          { error: 'Account is suspended' },
          { status: 403 }
        )
      }

      // Log audit
      await logAudit(user.id, 'login', 'system', { email })

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
          isActive: user.isActive
        }
      })
    }

    return NextResponse.json(
      { error: 'Endpoint not found' },
      { status: 404 }
    )
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE routes
export async function DELETE(request) {
  const { pathname } = new URL(request.url)
  const path = pathname.replace('/api', '')

  try {
    const body = await request.json()

    // DELETE /api/user - Delete a user (soft delete by deactivating)
    if (path === '/user') {
      const { userId, actorId, reason } = body

      // Soft delete by deactivating
      const { error: updateError } = await supabase
        .from('users')
        .update({ isActive: false })
        .eq('id', userId)

      if (updateError) throw updateError

      // Log verification
      const { error: verifyError } = await supabase
        .from('verifications')
        .insert({
          id: uuidv4(),
          targetTable: 'users',
          targetId: userId,
          action: 'delete',
          performedBy: actorId,
          note: reason || 'User deleted'
        })

      if (verifyError) throw verifyError

      // Log audit
      await logAudit(actorId, 'delete_user', userId, { reason })

      return NextResponse.json({ success: true, message: 'User deleted successfully' })
    }

    return NextResponse.json(
      { error: 'Endpoint not found' },
      { status: 404 }
    )
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}


// PUT handler for updating resources
export async function PUT(request) {
  const { pathname } = new URL(request.url)
  const path = pathname.replace('/api', '')

  try {
    const body = await request.json()

    // PUT /api/profile - Update user profile
    if (path === '/profile') {
      const { email, name, organizationName } = body

      if (!email) {
        return NextResponse.json(
          { error: 'Email is required' },
          { status: 400 }
        )
      }

      // First, find the user by email
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, organizationId, metadata')
        .eq('email', email)
        .single()

      if (userError || !user) {
        console.error('User lookup error:', userError)
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }

      console.log('User found:', { id: user.id, organizationId: user.organizationId, metadata: user.metadata })

      // Update user metadata with name
      const updatedMetadata = {
        ...(user.metadata || {}),
        name: name || user.metadata?.name
      }

      const { error: updateUserError } = await supabase
        .from('users')
        .update({ 
          metadata: updatedMetadata
        })
        .eq('id', user.id)

      if (updateUserError) {
        console.error('Error updating user:', updateUserError)
        throw updateUserError
      }

      console.log('User metadata updated successfully')

      // If organizationName is provided and user has an organizationId, update the organization
      // Validate UUID format (UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      
      if (organizationName && user.organizationId && uuidRegex.test(user.organizationId)) {
        console.log('Attempting to update organization:', user.organizationId, 'with name:', organizationName)
        
        const { data: orgData, error: updateOrgError } = await supabase
          .from('organizations')
          .update({ name: organizationName })
          .eq('id', user.organizationId)
          .select()

        if (updateOrgError) {
          console.error('Error updating organization:', updateOrgError)
          // Don't throw error here, just log it - user update already succeeded
        } else {
          console.log('Organization updated successfully:', orgData)
        }
      } else {
        console.log('Skipping organization update. organizationId:', user.organizationId, 'isValidUUID:', user.organizationId ? uuidRegex.test(user.organizationId) : false)
      }

      // Log audit
      await logAudit(user.id, 'update_profile', user.id, { name, organizationName })

      return NextResponse.json({ 
        success: true, 
        message: 'Profile updated successfully',
        data: {
          name,
          organizationName
        }
      })
    }

    return NextResponse.json(
      { error: 'Endpoint not found' },
      { status: 404 }
    )
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

