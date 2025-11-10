import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { filterAndRankResults, fuzzyMatch } from '../../../lib/search-utils';
import { supabase } from '../../../lib/supabase';
import { createRLSClient, getUserContext } from '../../../lib/supabase-rls';

export const runtime = 'edge';


// Helper to add cache headers to response
function addCacheHeaders(response, cacheType = 'private') {
  const cacheHeaders = {
    // Static data (universities, recruiters list) - 5 minutes
    'static': 'public, max-age=300, stale-while-revalidate=600',
    // Dynamic data with short TTL (metrics, dashboard) - 1 minute
    'dynamic': 'public, max-age=60, stale-while-revalidate=120',
    // User-specific data - 30 seconds
    'private': 'private, max-age=30',
    // No cache for mutations
    'no-cache': 'no-store, must-revalidate'
  };
  
  response.headers.set('Cache-Control', cacheHeaders[cacheType] || cacheHeaders['private']);
  response.headers.set('X-Cache-Type', cacheType);
  return response;
}

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
    // Create RLS-aware Supabase client with user context
    const { supabase: rlsClient, user, error: authError } = await createRLSClient(request)
    
    // For protected endpoints, ensure user is authenticated
    const protectedEndpoints = ['/users', '/recruiters', '/students', '/passports', '/audit-logs', '/verifications']
    const isProtectedEndpoint = protectedEndpoints.some(endpoint => path.startsWith(endpoint))
    
    if (isProtectedEndpoint && (!user || authError)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get user context for authorization checks
    let userContext = null
    if (user) {
      userContext = await getUserContext(rlsClient, user)
    }

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
          const response = NextResponse.json({
            activeUniversities: latestSnapshot.activeUniversities || 0,
            registeredStudents: latestSnapshot.registeredStudents || 0,
            verifiedPassports: latestSnapshot.verifiedPassports || 0,
            employabilityIndex: parseFloat(latestSnapshot.employabilityIndex || 0),
            activeRecruiters: latestSnapshot.activeRecruiters || 0,
            jobSecured: latestSnapshot.jobsecured || 0,
            snapshotDate: latestSnapshot.snapshotDate,
            source: 'snapshot'
          });
          return addCacheHeaders(response, 'dynamic');
        }
        
        // Fallback: Calculate metrics dynamically from database tables if no snapshot exists
        console.log('No snapshot found, calculating metrics dynamically')
        
        // Count universities from universities table
        const { data: universities } = await supabase
          .from('universities')
          .select('id')
        
        const activeUniversities = universities?.length || 0

        // Count active recruiters from recruiters table (only where isactive=true)
        const { data: recruiters } = await rlsClient
          .from('recruiters')
          .select('id')
          .eq('isactive', true)
        
        const activeRecruiters = recruiters?.length || 0

        // Count students
        const { data: students } = await rlsClient
          .from('students')
          .select('id')
        
        const registeredStudents = students?.length || 0

        // Get passports for verification metrics
        const { data: passports } = await rlsClient
          .from('skill_passports')
          .select('status')
        
        const totalPassports = passports?.length || 0
        const verifiedPassports = passports?.filter(p => p.status === 'verified').length || 0
        
        // Calculate employability index
        const employabilityIndex = registeredStudents > 0 
          ? ((verifiedPassports / registeredStudents) * 100).toFixed(1) 
          : 0

        // Count job secured (hired placements)
        const { data: hiredPlacements, error: placementError } = await rlsClient
          .from('placements')
          .select('id')
          .eq('placementStatus', 'hired')
        
        const jobSecured = hiredPlacements?.length || 0

        return NextResponse.json({
          activeUniversities,
          registeredStudents,
          verifiedPassports,
          employabilityIndex: parseFloat(employabilityIndex),
          activeRecruiters,
          jobSecured,
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
          jobSecured: 0,
          source: 'error'
        })
      }
    }

    // GET /api/users - List admin users from admin_users table with pagination, search, and filters
    if (path === '/users') {
      // Get parameters from query string
      const url = new URL(request.url)
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = parseInt(url.searchParams.get('limit') || '20')
      const offset = (page - 1) * limit
      const search = url.searchParams.get('search') || ''
      const roleFilter = url.searchParams.get('role') || ''
      const activeFilter = url.searchParams.get('active') || ''
      const sortBy = url.searchParams.get('sortBy') || 'granted_at'
      const sortOrder = url.searchParams.get('sortOrder') || 'desc'
      
      // Build the query for admin users using RLS client
      let adminUsersQuery = rlsClient
        .from('admin_users')
        .select('*', { count: 'exact' })
      
      // Apply role filter
      if (roleFilter && roleFilter !== 'all') {
        adminUsersQuery = adminUsersQuery.eq('admin_role', roleFilter)
      }
      
      // Apply sorting
      const ascending = sortOrder === 'asc'
      if (sortBy === 'granted_at') {
        adminUsersQuery = adminUsersQuery.order('granted_at', { ascending })
      } else if (sortBy === 'admin_role') {
        adminUsersQuery = adminUsersQuery.order('admin_role', { ascending })
      }
      
      // Execute query with pagination
      const { data: adminUsers, error, count } = await adminUsersQuery.range(offset, offset + limit - 1)

      if (error) {
        console.error('Error fetching admin users:', error)
        return NextResponse.json({ error: 'Failed to fetch admin users', details: error }, { status: 500 })
      }
      
      // Fetch user details for all admin users using RLS client
      const userIds = (adminUsers || []).map(a => a.user_id)
      const grantedByIds = (adminUsers || []).map(a => a.granted_by).filter(Boolean)
      
      let usersMap = {}
      let grantedByMap = {}
      
      if (userIds.length > 0) {
        const { data: usersData } = await rlsClient
          .from('users')
          .select('id, email, isActive, createdAt, metadata')
          .in('id', userIds)
        
        usersData?.forEach(u => {
          usersMap[u.id] = u
        })
      }
      
      if (grantedByIds.length > 0) {
        const { data: grantedByData } = await rlsClient
          .from('users')
          .select('id, email, metadata')
          .in('id', grantedByIds)
        
        grantedByData?.forEach(u => {
          grantedByMap[u.id] = u
        })
      }
      
      // Transform the data to match the frontend expectations
      let transformedUsers = (adminUsers || []).map(admin => {
        const user = usersMap[admin.user_id] || {}
        const grantedByUser = admin.granted_by ? grantedByMap[admin.granted_by] : null
        
        return {
          id: admin.user_id,
          email: user.email,
          isActive: user.isActive,
          role: admin.admin_role,
          createdAt: user.createdAt,
          metadata: user.metadata || {},
          grantedBy: admin.granted_by,
          grantedByEmail: grantedByUser?.email || null,
          grantedByName: grantedByUser?.metadata?.name || null,
          grantedAt: admin.granted_at
        }
      })
      
      // Apply active filter
      if (activeFilter && activeFilter !== 'all') {
        transformedUsers = transformedUsers.filter(u => 
          u.isActive === (activeFilter === 'true')
        )
      }
      
      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase()
        transformedUsers = transformedUsers.filter(user => {
          const email = user.email?.toLowerCase() || ''
          const role = user.role?.toLowerCase() || ''
          const name = user.metadata?.name?.toLowerCase() || ''
          const grantedByEmail = user.grantedByEmail?.toLowerCase() || ''
          
          return email.includes(searchLower) || 
                 role.includes(searchLower) || 
                 name.includes(searchLower) ||
                 grantedByEmail.includes(searchLower)
        })
      }
      
      // Apply email sorting if needed (after filtering)
      if (sortBy === 'email') {
        transformedUsers.sort((a, b) => {
          const emailA = a.email?.toLowerCase() || ''
          const emailB = b.email?.toLowerCase() || ''
          return ascending ? emailA.localeCompare(emailB) : emailB.localeCompare(emailA)
        })
      }
      
      // Return paginated response
      return NextResponse.json({
        data: transformedUsers,
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

      const response = NextResponse.json(allOrgs);
      return addCacheHeaders(response, 'static');
    }

    // GET /api/recruiters - List all recruiters with pagination, search, and filters
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
        // PostgreSQL ILIKE for partial matching at database level
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,state.ilike.%${searchTerm}%,website.ilike.%${searchTerm}%`)
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
      
      // Map recruiters to expected format and normalize field names
      let mappedRecruiters = (recruiters || []).map(recruiter => ({
        id: recruiter.id,
        name: recruiter.name,
        type: 'recruiter',
        state: recruiter.state,
        email: recruiter.email,
        phone: recruiter.phone,
        website: recruiter.website,
        address: recruiter.address,
        district: recruiter.district,
        verificationStatus: recruiter.verificationstatus || 'approved',
        isActive: recruiter.isactive !== undefined ? recruiter.isactive : true,
        createdAt: recruiter.createdat,
        created_at: recruiter.createdat, // Add created_at for frontend compatibility
        updatedAt: recruiter.updatedat,
        userCount: userCountMap[recruiter.id] || 0
      }))
      
      // Apply industrial-grade fuzzy search and relevance ranking (client-side for accuracy)
      if (searchTerm) {
        const searchFields = ['name', 'email', 'phone', 'district', 'website', 'state'];
        mappedRecruiters = filterAndRankResults(mappedRecruiters, searchFields, searchTerm, 0.7);
      }
      
      // Sort by user count if requested (can't do this in SQL easily with join)
      if (sortBy === 'userCount') {
        mappedRecruiters.sort((a, b) => {
          return sortOrder === 'asc' ? a.userCount - b.userCount : b.userCount - a.userCount
        })
      }
      
      const response = NextResponse.json({
        data: mappedRecruiters,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      });
      return addCacheHeaders(response, 'static');
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
      
      // Apply status filter (check for 'all' as well)
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('verificationstatus', statusFilter)
      }
      
      // Apply active/suspended filter (check for 'all' as well)
      if (activeFilter && activeFilter !== 'all' && activeFilter !== '') {
        query = query.eq('isactive', activeFilter === 'true')
      }
      
      // Apply state filter (check for 'all' as well)
      if (stateFilter && stateFilter !== 'all') {
        query = query.eq('state', stateFilter)
      }
      
      // Apply search filter
      if (searchTerm) {
        // PostgreSQL ILIKE for partial matching at database level
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,state.ilike.%${searchTerm}%,website.ilike.%${searchTerm}%`)
      }
      
      query = query.order('createdat', { ascending: false })
      
      const { data: recruiters, error } = await query
      
      if (error) {
        return NextResponse.json({ error: 'Failed to export recruiters' }, { status: 500 })
      }
      
      // Apply industrial-grade fuzzy search and relevance ranking for more accurate results
      let filteredRecruiters = recruiters || [];
      if (searchTerm) {
        // Map to include all fields for search
        const mappedRecruiters = filteredRecruiters.map(r => ({
          ...r,
          name: r.name,
          email: r.email,
          phone: r.phone,
          district: r.district,
          website: r.website,
          state: r.state
        }));
        
        const searchFields = ['name', 'email', 'phone', 'district', 'website', 'state'];
        filteredRecruiters = filterAndRankResults(mappedRecruiters, searchFields, searchTerm, 0.7);
      }
      
      // Create CSV content
      const headers = ['Name', 'Email', 'Phone', 'State', 'District', 'Website', 'Status', 'Active', 'Created Date']
      const csvRows = [headers.join(',')]
      
      filteredRecruiters?.forEach(r => {
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

    // GET /api/universities - List all universities with pagination, search, and filters (ENHANCED)
    if (path === '/universities') {
      const url = new URL(request.url)
      
      // Pagination parameters
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = parseInt(url.searchParams.get('limit') || '20')
      const offset = (page - 1) * limit
      
      // Filter parameters
      const approvalStatus = url.searchParams.get('approval_status') // pending, approved, rejected
      const accountStatus = url.searchParams.get('account_status') // active, inactive
      const searchTerm = url.searchParams.get('search')
      
      // Build query
      let query = supabase.from('universities').select('*', { count: 'exact' })
      
      // Apply filters
      if (approvalStatus) {
        query = query.eq('approval_status', approvalStatus)
      }
      if (accountStatus) {
        query = query.eq('account_status', accountStatus)
      }
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,state.ilike.%${searchTerm}%`)
      }
      
      // Apply sorting (newest first by default)
      query = query.order('createdat', { ascending: false })
      
      // Apply pagination
      query = query.range(offset, offset + limit - 1)
      
      const { data: universities, error, count } = await query

      if (error) {
        console.error('Error fetching universities:', error)
        return NextResponse.json({ error: 'Failed to fetch universities' }, { status: 500 })
      }

      // Normalize field names to match frontend expectations
      const normalizedUniversities = (universities || []).map(university => ({
        ...university,
        created_at: university.createdat, // Map createdat to created_at for frontend compatibility
        // Add any other field mappings if needed
      }))

      const response = NextResponse.json({
        data: normalizedUniversities || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      })
      
      return addCacheHeaders(response, 'static')
    }

    // GET /api/colleges - List all colleges with pagination, search, and filters (NEW)
    if (path === '/colleges') {
      const url = new URL(request.url)
      
      // Pagination parameters
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = parseInt(url.searchParams.get('limit') || '20')
      const offset = (page - 1) * limit
      
      // Filter parameters
      const approvalStatus = url.searchParams.get('approval_status') // pending, approved, rejected
      const accountStatus = url.searchParams.get('account_status') // active, inactive
      const collegeType = url.searchParams.get('college_type') // standalone, affiliated
      const searchTerm = url.searchParams.get('search')
      
      // Build query
      let query = supabase.from('colleges').select('*', { count: 'exact' })
      
      // Apply filters
      if (approvalStatus) {
        query = query.eq('approvalStatus', approvalStatus)
      }
      if (accountStatus) {
        query = query.eq('accountStatus', accountStatus)
      }
      if (collegeType) {
        query = query.eq('collegeType', collegeType)
      }
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%,state.ilike.%${searchTerm}%`)
      }
      
      // Apply sorting (newest first by default)
      query = query.order('createdAt', { ascending: false })
      
      // Apply pagination
      query = query.range(offset, offset + limit - 1)
      
      const { data: colleges, error, count } = await query

      if (error) {
        console.error('Error fetching colleges:', error)
        return NextResponse.json({ error: 'Failed to fetch colleges' }, { status: 500 })
      }

      // Normalize field names to match frontend expectations
      const normalizedColleges = (colleges || []).map(college => ({
        ...college,
        created_at: college.createdAt, // Map createdAt to created_at for frontend compatibility
        // Add any other field mappings if needed
      }))

      const response = NextResponse.json({
        data: normalizedColleges,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      })
      
      return addCacheHeaders(response, 'static')
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
      
      // STEP 1: If we have university filter, first get all student IDs from that university
      let studentIdsFromUniversity = null
      if (universityFilter && universityFilter !== 'all') {
        const { data: studentsFromUniv } = await supabase
          .from('students')
          .select('id')
          .or(`universityId.eq.${universityFilter},organizationId.eq.${universityFilter}`)
        
        studentIdsFromUniversity = studentsFromUniv?.map(s => s.id) || []
        
        // If university filter is applied but no students found, return empty CSV
        if (studentIdsFromUniversity.length === 0) {
          const csvContent = 'Student Name,Email,University,Status,NSQF Level,Skills,Created Date,Updated Date'
          return new Response(csvContent, {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': `attachment; filename="passports-${new Date().toISOString().split('T')[0]}.csv"`
            }
          })
        }
      }
      
      // STEP 2: Build passport query with filters
      let query = supabase.from('skill_passports').select('*')
      
      // Apply university filter by studentId if available
      if (studentIdsFromUniversity) {
        query = query.in('studentId', studentIdsFromUniversity)
      }
      
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
        
        if (studentIds.length > 0) {
          // Supabase has a limit on .in() queries, so batch them
          const batchSize = 100
          let allStudents = []
          let allUsers = []
          
          for (let i = 0; i < studentIds.length; i += batchSize) {
            const batch = studentIds.slice(i, i + batchSize)
            
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
                console.error('Export error fetching students:', studentsResult.error)
              } else {
                allStudents.push(...(studentsResult.data || []))
              }
              
              if (usersResult.error) {
                console.error('Export error fetching users:', usersResult.error)
              } else {
                allUsers.push(...(usersResult.data || []))
              }
            } catch (error) {
              console.error('Export batch error:', error)
            }
          }
          
          // Create result objects for compatibility with existing code
          const studentsResult = { data: allStudents, error: null }
          const usersResult = { data: allUsers, error: null }
          
          const students = studentsResult.data || []
          const users = usersResult.data || []
          
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
            }
          })
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

    // GET /api/students - List all students (OPTIMIZED WITH PAGINATION)
    if (path === '/students') {
      const url = new URL(request.url)
      
      // Pagination parameters
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = parseInt(url.searchParams.get('limit') || '20')
      const offset = (page - 1) * limit
      
      // Filter parameters
      const approvalStatus = url.searchParams.get('approval_status') // pending, approved, rejected
      const searchTerm = url.searchParams.get('search')
      
      // Build query with count using RLS client
      let query = rlsClient.from('students').select('*', { count: 'exact' })
      
      // Apply filters
      if (approvalStatus) {
        query = query.eq('approval_status', approvalStatus)
      }
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
      }
      
      // Apply sorting and pagination
      const { data: students, error, count } = await query
        .order('createdAt', { ascending: false })
        .range(offset, offset + limit - 1)

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
          userIds.length > 0 ? rlsClient.from('users').select('id, email').in('id', userIds) : { data: [] },
          mappedUniversityIds.length > 0 ? rlsClient.from('universities').select('id, name').in('id', mappedUniversityIds) : { data: [] }
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
      
      // Normalize field names to match frontend expectations
      const normalizedStudents = (students || []).map(student => ({
        ...student,
        created_at: student.createdAt || student.created_at, // Ensure created_at exists
        // Add any other field mappings if needed
      }))
      
      // Return consistent format with other endpoints
      const response = NextResponse.json({
        data: normalizedStudents || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      })
      
      return addCacheHeaders(response, 'static')
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
      
      // Build the query for passports using RLS client
      let passportsQuery = rlsClient.from('skill_passports').select('*', { count: 'exact' })
      
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
          // Fetch all students and their users in parallel using RLS client
          const [studentsResult, usersResult] = await Promise.all([
            rlsClient.from('students').select('*').in('id', studentIds),
            rlsClient.from('students').select('userId, organizationId').in('id', studentIds).then(async (result) => {
              if (result.data && result.data.length > 0) {
                const userIds = result.data.map(s => s.userId).filter(Boolean)
                if (userIds.length > 0) {
                  return await rlsClient.from('users').select('id, email, metadata').in('id', userIds)
                }
              }
              return { data: [] }
            })
          ])
          
          const students = studentsResult.data || []
          const users = usersResult.data || []
          
          // Fetch universities if needed for filtering using RLS client
          const orgIds = students.map(s => s.universityId || s.organizationId).filter(Boolean)
          let universities = []
          if (orgIds.length > 0) {
            const { data: univData } = await rlsClient.from('universities').select('id, name').in('id', orgIds)
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
      
      // Apply industrial-grade fuzzy search and relevance ranking with university filter
      if (search || universityFilter) {
        filteredPassports = filteredPassports.filter(passport => {
          let matchesSearch = true;
          let matchesUniversity = true;
          
          if (search) {
            // Use fuzzy matching with flexible threshold for typo tolerance
            const studentName = passport.students?.profile?.name || '';
            const studentEmail = passport.students?.email || passport.students?.users?.email || '';
            const passportId = passport.id || '';
            const universityName = passport.students?.university?.name || '';
            const skills = Array.isArray(passport.skills) ? passport.skills.join(' ') : (passport.skills || '');
            
            matchesSearch = fuzzyMatch(studentName, search, 0.7) ||
                           fuzzyMatch(studentEmail, search, 0.7) ||
                           fuzzyMatch(passportId, search, 0.7) ||
                           fuzzyMatch(universityName, search, 0.7) ||
                           fuzzyMatch(skills, search, 0.7);
          }
          
          if (universityFilter && universityFilter !== 'all') {
            const univId = passport.students?.universityId || passport.students?.organizationId;
            matchesUniversity = univId === universityFilter;
          }
          
          return matchesSearch && matchesUniversity;
        });
        
        // Apply relevance ranking if search term exists
        if (search) {
          const searchFields = ['students.profile.name', 'students.email', 'students.users.email', 'id', 'students.university.name', 'skills'];
          filteredPassports = filterAndRankResults(filteredPassports, searchFields, search, 0.7);
        }
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
      const { data: verifications, error } = await rlsClient
        .from('verifications')
        .select('*')
        .order('createdAt', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Error fetching verifications:', error)
        return NextResponse.json({ error: 'Failed to fetch verifications' }, { status: 500 })
      }
      
      // Fetch all user emails in bulk using RLS client
      if (verifications && verifications.length > 0) {
        const userIds = verifications.map(v => v.performedBy).filter(Boolean)
        
        if (userIds.length > 0) {
          const { data: users } = await rlsClient
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

    // GET /api/audit-logs - List audit logs with pagination, filtering, and search (ENHANCED)
    if (path === '/audit-logs') {
      const { searchParams } = new URL(request.url)
      
      // Pagination parameters
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '20')
      const offset = (page - 1) * limit
      
      // Filter parameters
      const action = searchParams.get('action') // Filter by action type
      const userId = searchParams.get('userId') // Filter by user
      const dateFrom = searchParams.get('dateFrom') // Filter by start date
      const dateTo = searchParams.get('dateTo') // Filter by end date
      const search = searchParams.get('search') // Search in target, action, IP
      
      // Sorting parameters
      const sortBy = searchParams.get('sortBy') || 'createdAt'
      const sortOrder = searchParams.get('sortOrder') || 'desc'
      
      // Build query using RLS client
      let query = rlsClient
        .from('audit_logs')
        .select('*', { count: 'exact' })
      
      // Apply filters
      if (action) {
        query = query.eq('action', action)
      }
      
      if (userId) {
        query = query.eq('actorId', userId)
      }
      
      if (dateFrom) {
        query = query.gte('createdAt', dateFrom)
      }
      
      if (dateTo) {
        query = query.lte('createdAt', dateTo)
      }
      
      if (search) {
        // PostgreSQL ILIKE with extended fields for comprehensive search
        query = query.or(`target.ilike.%${search}%,action.ilike.%${search}%,ip.ilike.%${search}%`)
      }
      
      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' })
      
      // Apply pagination
      query = query.range(offset, offset + limit - 1)
      
      const { data: logs, error, count } = await query

      if (error) {
        console.error('Error fetching audit logs:', error)
        return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 })
      }
      
      // Fetch all user emails in bulk using RLS client
      let enrichedLogs = logs || [];
      if (enrichedLogs.length > 0) {
        const userIds = enrichedLogs.map(l => l.actorId).filter(Boolean)
        
        if (userIds.length > 0) {
          const { data: users } = await rlsClient
            .from('users')
            .select('id, email, metadata')
            .in('id', userIds)
          
          const userMap = {}
          users?.forEach(user => { 
            userMap[user.id] = {
              id: user.id,
              email: user.email,
              name: user.metadata?.name || user.email
            }
          })
          
          enrichedLogs.forEach(log => {
            if (log.actorId && userMap[log.actorId]) {
              log.users = userMap[log.actorId]
            }
          })
        }
      }
      
      // Apply industrial-grade fuzzy search and relevance ranking (client-side for accuracy)
      if (search) {
        const searchFields = ['target', 'action', 'ip', 'users.email', 'users.name'];
        enrichedLogs = filterAndRankResults(enrichedLogs, searchFields, search, 0.7);
      }
      
      return NextResponse.json({
        logs: enrichedLogs,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      })
    }

    // GET /api/audit-logs/export - Export audit logs to CSV
    if (path === '/audit-logs/export') {
      const { searchParams } = new URL(request.url)
      
      // Filter parameters (same as list endpoint)
      const action = searchParams.get('action')
      const userId = searchParams.get('userId')
      const dateFrom = searchParams.get('dateFrom')
      const dateTo = searchParams.get('dateTo')
      const search = searchParams.get('search')
      
      // Build query (no pagination for export)
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('createdAt', { ascending: false })
        .limit(5000) // Max 5000 records for export
      
      // Apply same filters as list endpoint
      if (action) query = query.eq('action', action)
      if (userId) query = query.eq('actorId', userId)
      if (dateFrom) query = query.gte('createdAt', dateFrom)
      if (dateTo) query = query.lte('createdAt', dateTo)
      if (search) query = query.or(`target.ilike.%${search}%,action.ilike.%${search}%,ip.ilike.%${search}%`)
      
      const { data: logs, error } = await query

      if (error) {
        console.error('Error fetching audit logs for export:', error)
        return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 })
      }
      
      // Fetch user emails
      let enrichedLogs = logs || [];
      if (enrichedLogs.length > 0) {
        const userIds = [...new Set(enrichedLogs.map(l => l.actorId).filter(Boolean))]
        
        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from('users')
            .select('id, email, metadata')
            .in('id', userIds)
          
          const userMap = {}
          users?.forEach(user => { 
            userMap[user.id] = {
              email: user.email,
              name: user.metadata?.name || user.email
            }
          })
          
          enrichedLogs.forEach(log => {
            if (log.actorId && userMap[log.actorId]) {
              log.users = userMap[log.actorId]
            }
          })
        }
      }
      
      // Apply industrial-grade fuzzy search and relevance ranking for export
      if (search) {
        const searchFields = ['target', 'action', 'ip', 'users.email', 'users.name'];
        enrichedLogs = filterAndRankResults(enrichedLogs, searchFields, search, 0.7);
      }
      
      // Generate CSV
      const csvHeaders = ['Timestamp', 'User', 'Email', 'Action', 'Target', 'IP Address', 'Details']
      const csvRows = enrichedLogs.map(log => [
        new Date(log.createdAt).toLocaleString(),
        log.users?.name || 'System',
        log.users?.email || 'N/A',
        log.action.replace(/_/g, ' ').toUpperCase(),
        log.target || 'N/A',
        log.ip || 'N/A',
        JSON.stringify(log.payload || {}).substring(0, 100)
      ])
      
      const csv = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n')
      
      const today = new Date().toISOString().split('T')[0]
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-logs-${today}.csv"`
        }
      })
    }

    // GET /api/audit-logs/actions - Get unique action types
    if (path === '/audit-logs/actions') {
      const { data: logs, error } = await supabase
        .from('audit_logs')
        .select('action')
        .limit(1000)

      if (error) {
        console.error('Error fetching action types:', error)
        return NextResponse.json({ error: 'Failed to fetch action types' }, { status: 500 })
      }

      const uniqueActions = [...new Set(logs.map(l => l.action))].filter(Boolean).sort()
      return NextResponse.json(uniqueActions)
    }

    // GET /api/audit-logs/users - Get users who have performed actions
    if (path === '/audit-logs/users') {
      const { data: logs, error } = await supabase
        .from('audit_logs')
        .select('actorId')
        .not('actorId', 'is', null)
        .limit(1000)

      if (error) {
        console.error('Error fetching actor users:', error)
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
      }

      const uniqueUserIds = [...new Set(logs.map(l => l.actorId))]
      
      if (uniqueUserIds.length > 0) {
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, email, metadata')
          .in('id', uniqueUserIds)
        
        if (usersError) {
          console.error('Error fetching users:', usersError)
          return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
        }
        
        const usersWithNames = users.map(u => ({
          id: u.id,
          email: u.email,
          name: u.metadata?.name || u.email
        }))
        
        return NextResponse.json(usersWithNames)
      }
      
      return NextResponse.json([])
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

      const response = NextResponse.json(chartData);
      return addCacheHeaders(response, 'dynamic');
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
      try {
        // Use RLS client - platform admins will see all data via RLS policies
        const { data: universities, error: univError } = await rlsClient
          .from('universities')
          .select('id, name, state')
        
        if (univError) {
          console.error('Error fetching universities:', univError)
          throw univError
        }

        if (!universities || universities.length === 0) {
          return NextResponse.json([])
        }

        // Fetch all students with their university IDs
        const { data: students, error: studentError } = await rlsClient
          .from('students')
          .select('id, universityId')
        
        if (studentError) {
          console.error('Error fetching students:', studentError)
        }

        // Fetch all skill passports
        const { data: passports, error: passportError } = await rlsClient
          .from('skill_passports')
          .select('studentId, status')
        
        if (passportError) {
          console.error('Error fetching passports:', passportError)
        }

        // Create lookup maps for efficient data processing
        const studentsByUniversity = {}
        const passportsByStudent = {}

        // Group students by university
        if (students && students.length > 0) {
          students.forEach(student => {
            const univId = student.universityId
            if (univId) {
              if (!studentsByUniversity[univId]) {
                studentsByUniversity[univId] = []
              }
              studentsByUniversity[univId].push(student.id)
            }
          })
        }

        // Group passports by student
        if (passports && passports.length > 0) {
          passports.forEach(passport => {
            if (passport.studentId) {
              if (!passportsByStudent[passport.studentId]) {
                passportsByStudent[passport.studentId] = []
              }
              passportsByStudent[passport.studentId].push(passport.status)
            }
          })
        }

        // Calculate metrics for each university
        const universityReports = universities.map(university => {
          const studentIds = studentsByUniversity[university.id] || []
          const enrollmentCount = studentIds.length

          let totalPassports = 0
          let verifiedCount = 0

          studentIds.forEach(studentId => {
            const studentPassports = passportsByStudent[studentId] || []
            totalPassports += studentPassports.length
            verifiedCount += studentPassports.filter(status => status === 'verified').length
          })

          const completionRate = totalPassports > 0 ? parseFloat(((verifiedCount / totalPassports) * 100).toFixed(1)) : 0
          const verificationRate = enrollmentCount > 0 ? parseFloat(((totalPassports / enrollmentCount) * 100).toFixed(1)) : 0

          return {
            universityId: university.id,
            universityName: university.name,
            state: university.state || 'Unknown',
            enrollmentCount,
            totalPassports,
            verifiedPassports: verifiedCount,
            completionRate,
            verificationRate
          }
        })

        // Filter out universities with no data if needed, or keep all for visibility
        const response = NextResponse.json(universityReports)
        return addCacheHeaders(response, 'dynamic')
      } catch (error) {
        console.error('Error in university-reports endpoint:', error)
        return NextResponse.json(
          { error: 'Failed to fetch university reports', details: error.message },
          { status: 500 }
        )
      }
    }

    // GET /api/analytics/recruiter-metrics - Recruiter engagement analytics
    if (path === '/analytics/recruiter-metrics') {
      // Fetch real recruiter metrics data
      const { data: recruiters, error: recruiterError } = await supabase
        .from('recruiters')
        .select('id')
      
      if (recruiterError) throw recruiterError
      
      const { data: placements, error: placementError } = await supabase
        .from('placements')
        .select('recruiterId, placementStatus')
      
      if (placementError) throw placementError
      
      // Calculate real metrics
      const totalRecruiters = recruiters.length
      const totalSearches = totalRecruiters * 50 // Placeholder calculation
      const profileViews = totalRecruiters * 120 // Placeholder calculation
      const contactAttempts = totalRecruiters * 30 // Placeholder calculation
      
      // Calculate hires from placements
      const hiredCount = placements.filter(p => p.placementStatus === 'hired').length
      
      // Search trends (would need actual search tracking)
      const searchTrends = [
        { month: 'Jan', searches: Math.floor(totalSearches * 0.15), views: Math.floor(profileViews * 0.15), contacts: Math.floor(contactAttempts * 0.15) },
        { month: 'Feb', searches: Math.floor(totalSearches * 0.17), views: Math.floor(profileViews * 0.17), contacts: Math.floor(contactAttempts * 0.17) },
        { month: 'Mar', searches: Math.floor(totalSearches * 0.18), views: Math.floor(profileViews * 0.18), contacts: Math.floor(contactAttempts * 0.18) },
        { month: 'Apr', searches: Math.floor(totalSearches * 0.16), views: Math.floor(profileViews * 0.16), contacts: Math.floor(contactAttempts * 0.16) },
        { month: 'May', searches: Math.floor(totalSearches * 0.17), views: Math.floor(profileViews * 0.17), contacts: Math.floor(contactAttempts * 0.17) },
        { month: 'Jun', searches: Math.floor(totalSearches * 0.17), views: Math.floor(profileViews * 0.17), contacts: Math.floor(contactAttempts * 0.17) }
      ]
      
      // Top skills (would need actual skill tracking)
      const topSkillsSearched = [
        { skill: 'JavaScript', searches: 245 },
        { skill: 'Python', searches: 198 },
        { skill: 'React', searches: 167 },
        { skill: 'Node.js', searches: 134 },
        { skill: 'AI/ML', searches: 123 }
      ]
      
      const realRecruiterMetrics = {
        totalSearches,
        profileViews,
        contactAttempts,
        shortlisted: Math.floor(hiredCount * 4.5), // Estimate
        hireIntents: Math.floor(hiredCount * 1.3), // Estimate
        searchTrends,
        topSkillsSearched
      }
      
      const response = NextResponse.json(realRecruiterMetrics);
      return addCacheHeaders(response, 'dynamic');
    }

    // GET /api/analytics/placement-conversion - Placement pipeline analytics
    if (path === '/analytics/placement-conversion') {
      try {
        // Fetch all placement data from the placements table
        const { data: placements, error } = await supabase
          .from('placements')
          .select('*')
        
        if (error) {
          console.error('Error fetching placements:', error)
          throw error
        }

        // Count placements by status
        // Process: applied -> shortlisted -> offered -> hired
        // Rejected/withdrawn only applies between applied to offered
        const appliedCount = placements.filter(p => 
          ['applied', 'shortlisted', 'offered', 'hired'].includes(p.placementStatus)
        ).length
        
        const shortlistedCount = placements.filter(p => 
          ['shortlisted', 'offered', 'hired'].includes(p.placementStatus)
        ).length
        
        const offeredCount = placements.filter(p => 
          ['offered', 'hired'].includes(p.placementStatus)
        ).length
        
        const hiredCount = placements.filter(p => 
          p.placementStatus === 'hired'
        ).length

        const rejectedCount = placements.filter(p => 
          p.placementStatus === 'rejected'
        ).length

        const withdrawnCount = placements.filter(p => 
          p.placementStatus === 'withdrawn'
        ).length

        // Calculate total starting applications (applied + rejected + withdrawn)
        const totalApplications = appliedCount + rejectedCount + withdrawnCount

        // Build conversion funnel with percentages based on previous stage
        const conversionFunnel = [
          { 
            stage: 'Applied', 
            count: totalApplications, 
            percentage: 100 
          },
          { 
            stage: 'Shortlisted', 
            count: shortlistedCount, 
            percentage: totalApplications > 0 ? parseFloat(((shortlistedCount / totalApplications) * 100).toFixed(1)) : 0 
          },
          { 
            stage: 'Offered', 
            count: offeredCount, 
            percentage: shortlistedCount > 0 ? parseFloat(((offeredCount / shortlistedCount) * 100).toFixed(1)) : 0 
          },
          { 
            stage: 'Hired', 
            count: hiredCount, 
            percentage: offeredCount > 0 ? parseFloat(((hiredCount / offeredCount) * 100).toFixed(1)) : 0 
          }
        ]

        // Group by month for monthly conversions
        const monthlyData = {}
        const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        
        placements.forEach(placement => {
          // Use createdAt or hiredDate or any date field available
          const dateField = placement.createdAt || placement.hiredDate || placement.appliedDate
          if (dateField) {
            const date = new Date(dateField)
            const month = date.toLocaleString('default', { month: 'short' })
            
            if (!monthlyData[month]) {
              monthlyData[month] = { applied: 0, hired: 0, retained: 0 }
            }
            
            // Count applied (all statuses count as applied initially)
            monthlyData[month].applied += 1
            
            // Count hired
            if (placement.placementStatus === 'hired') {
              monthlyData[month].hired += 1
              
              // Check retention if retentionDate exists
              if (placement.retentionDate) {
                monthlyData[month].retained += 1
              }
            }
          }
        })

        // Convert to array and sort by month
        const monthlyConversions = monthOrder
          .filter(month => monthlyData[month])
          .map(month => ({
            month,
            applied: monthlyData[month].applied,
            hired: monthlyData[month].hired,
            retained: monthlyData[month].retained
          }))

        const placementConversionData = {
          conversionFunnel,
          monthlyConversions,
          summary: {
            totalApplications,
            shortlistedCount,
            offeredCount,
            hiredCount,
            rejectedCount,
            withdrawnCount
          }
        }
        
        const response = NextResponse.json(placementConversionData)
        return addCacheHeaders(response, 'dynamic')
      } catch (error) {
        console.error('Error in placement-conversion endpoint:', error)
        return NextResponse.json(
          { error: 'Failed to fetch placement conversion data', details: error.message },
          { status: 500 }
        )
      }
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
      // In a real implementation, this would fetch data from a database or external API
      // For now, we'll return an empty object instead of mock data
      return NextResponse.json({
        emergingSkills: [],
        soughtSkillTags: [],
        topUniversities: []
      })
    }

    // GET /api/analytics/university-reports/export - Export university reports to CSV
    if (path === '/analytics/university-reports/export') {
      const url = new URL(request.url)
      const stateFilter = url.searchParams.get('state')

      let universityQuery = rlsClient.from('universities').select('id, name, state')
      if (stateFilter && stateFilter !== 'all') {
        universityQuery = universityQuery.eq('state', stateFilter)
      }
      
      const [universitiesResult, studentsResult, passportsResult] = await Promise.all([
        universityQuery,
        rlsClient.from('students').select('id, universityId'),
        rlsClient.from('skill_passports').select('studentId, status')
      ])

      if (universitiesResult.error) {
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
      }

      const universities = universitiesResult.data || []
      const students = studentsResult.data || []
      const passports = passportsResult.data || []

      // Create lookup maps
      const studentsByUniversity = {}
      const passportsByStudent = {}

      students.forEach(student => {
        const univId = student.universityId
        if (univId) {
          if (!studentsByUniversity[univId]) {
            studentsByUniversity[univId] = []
          }
          studentsByUniversity[univId].push(student.id)
        }
      })

      passports.forEach(passport => {
        if (passport.studentId) {
          if (!passportsByStudent[passport.studentId]) {
            passportsByStudent[passport.studentId] = []
          }
          passportsByStudent[passport.studentId].push(passport.status)
        }
      })

      const universityReports = universities.map(university => {
        const studentIds = studentsByUniversity[university.id] || []
        const enrollmentCount = studentIds.length

        let totalPassports = 0
        let verifiedCount = 0

        studentIds.forEach(studentId => {
          const studentPassports = passportsByStudent[studentId] || []
          totalPassports += studentPassports.length
          verifiedCount += studentPassports.filter(status => status === 'verified').length
        })

        const completionRate = totalPassports > 0 ? parseFloat(((verifiedCount / totalPassports) * 100).toFixed(1)) : 0
        const verificationRate = enrollmentCount > 0 ? parseFloat(((totalPassports / enrollmentCount) * 100).toFixed(1)) : 0

        return {
          universityName: university.name,
          state: university.state || 'Unknown',
          enrollmentCount,
          totalPassports,
          verifiedPassports: verifiedCount,
          completionRate,
          verificationRate
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
      // Fetch real recruiter metrics data
      const { data: recruiters, error: recruiterError } = await supabase
        .from('recruiters')
        .select('id')
      
      if (recruiterError) throw recruiterError
      
      const { data: placements, error: placementError } = await supabase
        .from('placements')
        .select('recruiterId, placementStatus')
      
      if (placementError) throw placementError
      
      // Calculate real metrics
      const totalRecruiters = recruiters.length
      const totalSearches = totalRecruiters * 50 // Placeholder calculation
      const profileViews = totalRecruiters * 120 // Placeholder calculation
      const contactAttempts = totalRecruiters * 30 // Placeholder calculation
      
      // Calculate hires from placements
      const hiredCount = placements.filter(p => p.placementStatus === 'hired').length
      
      // Search trends (would need actual search tracking)
      const searchTrends = [
        { month: 'Jan', searches: Math.floor(totalSearches * 0.15), views: Math.floor(profileViews * 0.15), contacts: Math.floor(contactAttempts * 0.15) },
        { month: 'Feb', searches: Math.floor(totalSearches * 0.17), views: Math.floor(profileViews * 0.17), contacts: Math.floor(contactAttempts * 0.17) },
        { month: 'Mar', searches: Math.floor(totalSearches * 0.18), views: Math.floor(profileViews * 0.18), contacts: Math.floor(contactAttempts * 0.18) },
        { month: 'Apr', searches: Math.floor(totalSearches * 0.16), views: Math.floor(profileViews * 0.16), contacts: Math.floor(contactAttempts * 0.16) },
        { month: 'May', searches: Math.floor(totalSearches * 0.17), views: Math.floor(profileViews * 0.17), contacts: Math.floor(contactAttempts * 0.17) },
        { month: 'Jun', searches: Math.floor(totalSearches * 0.17), views: Math.floor(profileViews * 0.17), contacts: Math.floor(contactAttempts * 0.17) }
      ]
      
      // Top skills (would need actual skill tracking)
      const topSkillsSearched = [
        { skill: 'JavaScript', searches: 245 },
        { skill: 'Python', searches: 198 },
        { skill: 'React', searches: 167 },
        { skill: 'Node.js', searches: 134 },
        { skill: 'AI/ML', searches: 123 }
      ]
      
      const realRecruiterMetrics = {
        totalSearches,
        profileViews,
        contactAttempts,
        shortlisted: Math.floor(hiredCount * 4.5), // Estimate
        hireIntents: Math.floor(hiredCount * 1.3), // Estimate
        searchTrends,
        topSkillsSearched
      }

      // Create CSV for search trends
      const headers1 = ['Month', 'Searches', 'Profile Views', 'Contact Attempts']
      const csvRows1 = [headers1.join(',')]
      
      realRecruiterMetrics.searchTrends.forEach(trend => {
        const row = [trend.month, trend.searches, trend.views, trend.contacts]
        csvRows1.push(row.join(','))
      })

      csvRows1.push('') // Empty line
      csvRows1.push('Top Skills Searched')
      
      const headers2 = ['Skill', 'Total Searches']
      csvRows1.push(headers2.join(','))
      
      realRecruiterMetrics.topSkillsSearched.forEach(skill => {
        const row = [`"${skill.skill}"`, skill.searches]
        csvRows1.push(row.join(','))
      })

      csvRows1.push('') // Empty line
      csvRows1.push('Summary Metrics')
      csvRows1.push(`Total Searches,${realRecruiterMetrics.totalSearches}`)
      csvRows1.push(`Total Profile Views,${realRecruiterMetrics.profileViews}`)
      csvRows1.push(`Contact Attempts,${realRecruiterMetrics.contactAttempts}`)
      csvRows1.push(`Shortlisted,${realRecruiterMetrics.shortlisted}`)
      csvRows1.push(`Hire Intents,${realRecruiterMetrics.hireIntents}`)

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
      try {
        // Fetch all placement data from the placements table
        const { data: placements, error } = await supabase
          .from('placements')
          .select('*')
        
        if (error) throw error

        // Count placements by status (matching the main endpoint logic)
        const appliedCount = placements.filter(p => 
          ['applied', 'shortlisted', 'offered', 'hired'].includes(p.placementStatus)
        ).length
        
        const shortlistedCount = placements.filter(p => 
          ['shortlisted', 'offered', 'hired'].includes(p.placementStatus)
        ).length
        
        const offeredCount = placements.filter(p => 
          ['offered', 'hired'].includes(p.placementStatus)
        ).length
        
        const hiredCount = placements.filter(p => 
          p.placementStatus === 'hired'
        ).length

        const rejectedCount = placements.filter(p => 
          p.placementStatus === 'rejected'
        ).length

        const withdrawnCount = placements.filter(p => 
          p.placementStatus === 'withdrawn'
        ).length

        const totalApplications = appliedCount + rejectedCount + withdrawnCount

        // Build conversion funnel
        const conversionFunnel = [
          { 
            stage: 'Applied', 
            count: totalApplications, 
            percentage: 100 
          },
          { 
            stage: 'Shortlisted', 
            count: shortlistedCount, 
            percentage: totalApplications > 0 ? parseFloat(((shortlistedCount / totalApplications) * 100).toFixed(1)) : 0 
          },
          { 
            stage: 'Offered', 
            count: offeredCount, 
            percentage: shortlistedCount > 0 ? parseFloat(((offeredCount / shortlistedCount) * 100).toFixed(1)) : 0 
          },
          { 
            stage: 'Hired', 
            count: hiredCount, 
            percentage: offeredCount > 0 ? parseFloat(((hiredCount / offeredCount) * 100).toFixed(1)) : 0 
          }
        ]

        // Group by month for monthly conversions
        const monthlyData = {}
        const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        
        placements.forEach(placement => {
          const dateField = placement.createdAt || placement.hiredDate || placement.appliedDate
          if (dateField) {
            const date = new Date(dateField)
            const month = date.toLocaleString('default', { month: 'short' })
            
            if (!monthlyData[month]) {
              monthlyData[month] = { applied: 0, hired: 0, retained: 0 }
            }
            
            monthlyData[month].applied += 1
            
            if (placement.placementStatus === 'hired') {
              monthlyData[month].hired += 1
              if (placement.retentionDate) {
                monthlyData[month].retained += 1
              }
            }
          }
        })

        const monthlyConversions = monthOrder
          .filter(month => monthlyData[month])
          .map(month => ({
            month,
            applied: monthlyData[month].applied,
            hired: monthlyData[month].hired,
            retained: monthlyData[month].retained
          }))

        // Create CSV for conversion funnel
        const headers1 = ['Stage', 'Count', 'Percentage']
        const csvRows = [headers1.join(',')]
        
        conversionFunnel.forEach(stage => {
          const row = [`"${stage.stage}"`, stage.count, stage.percentage]
          csvRows.push(row.join(','))
        })

        csvRows.push('') // Empty line
        csvRows.push('Summary Statistics')
        csvRows.push(`Total Applications,${totalApplications}`)
        csvRows.push(`Shortlisted,${shortlistedCount}`)
        csvRows.push(`Offered,${offeredCount}`)
        csvRows.push(`Hired,${hiredCount}`)
        csvRows.push(`Rejected,${rejectedCount}`)
        csvRows.push(`Withdrawn,${withdrawnCount}`)

        csvRows.push('') // Empty line
        csvRows.push('Monthly Conversions')
        
        const headers2 = ['Month', 'Applied', 'Hired', 'Retained']
        csvRows.push(headers2.join(','))
        
        monthlyConversions.forEach(month => {
          const row = [month.month, month.applied, month.hired, month.retained]
          csvRows.push(row.join(','))
        })

        const csvContent = csvRows.join('\n')

        return new Response(csvContent, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="placement-conversion-${new Date().toISOString().split('T')[0]}.csv"`
          }
        })
      } catch (error) {
        console.error('Error in placement-conversion export:', error)
        return NextResponse.json(
          { error: 'Failed to export placement conversion data' },
          { status: 500 }
        )
      }
    }

    // GET /api/analytics/state-heatmap/export - Export state heatmap data to CSV
    if (path === '/analytics/state-heatmap/export') {
      const url = new URL(request.url)
      const stateFilter = url.searchParams.get('state')
      
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

      let universityQuery = supabase.from('universities').select('id, state')
      let recruiterQuery = supabase.from('recruiters').select('id, state')
      
      if (stateFilter) {
        universityQuery = universityQuery.eq('state', stateFilter)
        recruiterQuery = recruiterQuery.eq('state', stateFilter)
      }
      
      const [universitiesResult, recruitersResult, studentsResult, passportsResult] = await Promise.all([
        universityQuery,
        recruiterQuery,
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
      // In a real implementation, this would fetch data from a database or external API
      // For now, we'll return an empty CSV instead of mock data
      const csvRows = []
      
      csvRows.push('Emerging Skills')
      csvRows.push(['Skill', 'Growth', 'Category', 'Trend'].join(','))

      csvRows.push('') // Empty line
      csvRows.push('Sought Skill Tags')
      csvRows.push(['Tag', 'Mentions', 'Avg Salary (₹)'].join(','))

      csvRows.push('') // Empty line
      csvRows.push('Top Universities')
      csvRows.push(['University Name', 'Performance Score', 'Placement Rate (%)', 'Avg Package (₹)', 'Trend'].join(','))

      const csvContent = csvRows.join('\n')

      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="ai-insights-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    // GET /api/universities/:id/colleges - Get colleges for a specific university
    if (path.match(/^\/universities\/[^/]+\/colleges$/)) {
      const pathParts = path.split('/')
      const universityId = pathParts[2]

      const { data: colleges, error } = await supabase
        .from('university_colleges')
        .select('*')
        .eq('university_id', universityId)
        .order('name')

      if (error) {
        console.error('Error fetching university colleges:', error)
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        )
      }

      const response = NextResponse.json(colleges || [])
      return addCacheHeaders(response, 'static')
    }

    // GET /api/universities/:id - Get university details with colleges
    if (path.match(/^\/universities\/[^/]+$/) && path !== '/universities') {
      const pathParts = path.split('/')
      const universityId = pathParts[2]

      // Fetch university details
      const { data: university, error: univError } = await supabase
        .from('universities')
        .select('*')
        .eq('id', universityId)
        .single()

      if (univError || !university) {
        return NextResponse.json(
          { error: 'University not found' },
          { status: 404 }
        )
      }

      // Fetch colleges
      const { data: colleges } = await supabase
        .from('university_colleges')
        .select('*')
        .eq('university_id', universityId)
        .order('name')

      // Count students
      const { data: students } = await supabase
        .from('students')
        .select('id')
        .eq('universityid', universityId)

      const response = NextResponse.json({
        ...university,
        colleges: colleges || [],
        studentCount: students?.length || 0
      })
      return addCacheHeaders(response, 'static')
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
        '/api/universities/:id',
        '/api/universities/:id/colleges',
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
    // Create RLS-aware Supabase client with user context
    const { supabase: rlsClient, user, error: authError } = await createRLSClient(request)
    
    // For protected endpoints, ensure user is authenticated
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get user context for authorization checks
    const userContext = await getUserContext(rlsClient, user)
    
    if (!userContext) {
      return NextResponse.json({ error: 'User context not found' }, { status: 403 })
    }
    
    // Only parse JSON body for endpoints that need it (not update-metrics)
    let body = {}
    if (path !== '/update-metrics') {
      body = await request.json()
    }

    // POST /api/verify - Verify a passport
    if (path === '/verify') {
      const { passportId, userId, note } = body

      // Update passport status using RLS client
      const { error: updateError } = await rlsClient
        .from('skill_passports')
        .update({ status: 'verified' })
        .eq('id', passportId)

      if (updateError) throw updateError

      // Log verification using RLS client
      const { error: verifyError } = await rlsClient
        .from('verifications')
        .insert({
          id: uuidv4(),
          targetTable: 'skill_passports',
          targetId: passportId,
          action: 'verify',
          performedBy: userId || userContext.id,
          note: note || 'Passport verified'
        })

      if (verifyError) throw verifyError

      // Log audit
      await logAudit(userContext.id, 'verify_passport', passportId, { note })

      return NextResponse.json({ success: true, message: 'Passport verified successfully' })
    }

    // POST /api/suspend-user - Suspend a user
    if (path === '/suspend-user') {
      const { targetUserId, actorId, reason } = body

      // Update user status using RLS client
      const { error: updateError } = await rlsClient
        .from('users')
        .update({ isActive: false })
        .eq('id', targetUserId)

      if (updateError) throw updateError

      // Log verification using RLS client
      const { error: verifyError } = await rlsClient
        .from('verifications')
        .insert({
          id: uuidv4(),
          targetTable: 'users',
          targetId: targetUserId,
          action: 'suspend',
          performedBy: actorId || userContext.id,
          note: reason || 'User suspended'
        })

      if (verifyError) throw verifyError

      // Log audit
      await logAudit(userContext.id, 'suspend_user', targetUserId, { reason })

      return NextResponse.json({ success: true, message: 'User suspended successfully' })
    }

    // POST /api/activate-user - Activate a user
    if (path === '/activate-user') {
      const { targetUserId, actorId, note } = body

      // Update user status using RLS client
      const { error: updateError } = await rlsClient
        .from('users')
        .update({ isActive: true })
        .eq('id', targetUserId)

      if (updateError) throw updateError

      // Log verification using RLS client
      const { error: verifyError } = await rlsClient
        .from('verifications')
        .insert({
          id: uuidv4(),
          targetTable: 'users',
          targetId: targetUserId,
          action: 'activate',
          performedBy: actorId || userContext.id,
          note: note || 'User activated'
        })

      if (verifyError) throw verifyError

      // Log audit
      await logAudit(userContext.id, 'activate_user', targetUserId, { note })

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
        const { data: universities } = await supabaseAdmin
          .from('universities')
          .select('id')
        
        const activeUniversities = universities?.length || 0

        // Count active recruiters from recruiters table (only where isactive=true)
        const { data: recruiters } = await supabaseAdmin
          .from('recruiters')
          .select('id')
          .eq('isactive', true)
        
        const activeRecruiters = recruiters?.length || 0

        // Count students
        const { data: students } = await supabaseAdmin
          .from('students')
          .select('id')
        
        const registeredStudents = students?.length || 0

        // Get passports for verification metrics
        const { data: passports } = await supabaseAdmin
          .from('skill_passports')
          .select('status')
        
        const totalPassports = passports?.length || 0
        const verifiedPassports = passports?.filter(p => p.status === 'verified').length || 0
        
        // Calculate employability index
        const employabilityIndex = registeredStudents > 0 
          ? parseFloat(((verifiedPassports / registeredStudents) * 100).toFixed(1))
          : 0

        // Count job secured (hired placements)
        const { data: hiredPlacements, error: placementError } = await supabaseAdmin
          .from('placements')
          .select('id')
          .eq('placementStatus', 'hired')
        
        if (placementError) throw placementError
        
        const jobSecured = hiredPlacements?.length || 0

        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0]

        // Check if a snapshot for today already exists
        const { data: existingSnapshot } = await supabaseAdmin
          .from('metrics_snapshots')
          .select('id')
          .eq('snapshotDate', today)
          .maybeSingle()

        let result
        if (existingSnapshot) {
          // Update existing snapshot
          const { error: updateError } = await supabaseAdmin
            .from('metrics_snapshots')
            .update({
              activeUniversities,
              registeredStudents,
              verifiedPassports,
              employabilityIndex,
              activeRecruiters,
              jobsecured: jobSecured
            })
            .eq('id', existingSnapshot.id)

          if (updateError) throw updateError
          result = { action: 'updated', snapshotDate: today }
        } else {
          // Insert new snapshot
          const { error: insertError } = await supabaseAdmin
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
            activeRecruiters,
            jobSecured
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

    // POST /api/universities/:id/colleges - Create a college within a university
    if (path.match(/^\/universities\/[^/]+\/colleges$/)) {
      const pathParts = path.split('/')
      const universityId = pathParts[2]

      const { name, code, deanName, deanEmail, deanPhone, establishedYear, description } = body

      if (!name || !code) {
        return NextResponse.json(
          { error: 'Name and code are required' },
          { status: 400 }
        )
      }

      // Check if university exists
      const { data: university } = await supabase
        .from('universities')
        .select('id')
        .eq('id', universityId)
        .single()

      if (!university) {
        return NextResponse.json(
          { error: 'University not found' },
          { status: 404 }
        )
      }

      // Create college
      const { data, error: insertError } = await supabase
        .from('university_colleges')
        .insert({
          id: uuidv4(),
          university_id: universityId,
          name,
          code,
          dean_name: deanName,
          dean_email: deanEmail,
          dean_phone: deanPhone,
          established_year: establishedYear,
          description,
          account_status: 'active'
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating college:', insertError)
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        )
      }

      // Log audit
      if (body.userId) {
        await logAudit(body.userId, 'create_college', data.id, { name, universityId })
      }

      return NextResponse.json({ success: true, data })
    }

    // POST /api/approve-university - Approve a university
    if (path === '/approve-university') {
      const { universityId, notes, userId } = body

      if (!universityId || !userId) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        )
      }

      // Update university status
      const { data, error: updateError } = await supabase
        .from('universities')
        .update({
          approval_status: 'approved',
          account_status: 'active',
          approved_by: userId,
          approved_at: new Date().toISOString()
        })
        .eq('id', universityId)
        .select()
        .single()

      if (updateError) {
        console.error('Error approving university:', updateError)
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        )
      }

      // Log audit
      await logAudit(userId, 'approve_university', universityId, { notes })

      return NextResponse.json({ success: true, data })
    }

    // POST /api/reject-university - Reject a university
    if (path === '/reject-university') {
      const { universityId, reason, userId } = body

      if (!universityId || !userId) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        )
      }

      // Update university status
      const { data, error: updateError } = await supabase
        .from('universities')
        .update({
          approval_status: 'rejected',
          account_status: 'inactive',
          rejection_reason: reason
        })
        .eq('id', universityId)
        .select()
        .single()

      if (updateError) {
        console.error('Error rejecting university:', updateError)
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        )
      }

      // Log audit
      await logAudit(userId, 'reject_university', universityId, { reason })

      return NextResponse.json({ success: true, data })
    }

    // POST /api/approve-recruiter - Approve a recruiter
    if (path === '/approve-recruiter') {
      const { recruiterId, notes, userId } = body

      if (!recruiterId || !userId) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        )
      }

      // Update recruiter status
      const { data, error: updateError } = await supabase
        .from('recruiters')
        .update({
          approval_status: 'approved',
          account_status: 'active',
          approved_by: userId,
          approved_at: new Date().toISOString()
        })
        .eq('id', recruiterId)
        .select()
        .single()

      if (updateError) {
        console.error('Error approving recruiter:', updateError)
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        )
      }

      // Log audit
      await logAudit(userId, 'approve_recruiter', recruiterId, { notes })

      return NextResponse.json({ success: true, data })
    }

    // POST /api/reject-recruiter - Reject a recruiter
    if (path === '/reject-recruiter') {
      const { recruiterId, reason, userId } = body

      if (!recruiterId || !userId) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        )
      }

      // Update recruiter status
      const { data, error: updateError } = await supabase
        .from('recruiters')
        .update({
          approval_status: 'rejected',
          account_status: 'inactive',
          rejection_reason: reason
        })
        .eq('id', recruiterId)
        .select()
        .single()

      if (updateError) {
        console.error('Error rejecting recruiter:', updateError)
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        )
      }

      // Log audit
      await logAudit(userId, 'reject_recruiter', recruiterId, { reason })

      return NextResponse.json({ success: true, data })
    }

    // POST /api/approve-college - Approve a college
    if (path === '/approve-college') {
      const { collegeId, notes, userId } = body

      if (!collegeId || !userId) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        )
      }

      // Update college status
      const { data, error: updateError } = await supabase
        .from('colleges')
        .update({
          approvalStatus: 'approved',
          accountStatus: 'active',
          approvedBy: userId,
          approvedAt: new Date().toISOString()
        })
        .eq('id', collegeId)
        .select()
        .single()

      if (updateError) {
        console.error('Error approving college:', updateError)
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        )
      }

      // Log audit
      await logAudit(userId, 'approve_college', collegeId, { notes })

      return NextResponse.json({ success: true, data })
    }

    // POST /api/reject-college - Reject a college
    if (path === '/reject-college') {
      const { collegeId, reason, userId } = body

      if (!collegeId || !userId) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        )
      }

      // Update college status
      const { data, error: updateError } = await supabase
        .from('colleges')
        .update({
          approvalStatus: 'rejected',
          accountStatus: 'inactive',
          rejectionReason: reason
        })
        .eq('id', collegeId)
        .select()
        .single()

      if (updateError) {
        console.error('Error rejecting college:', updateError)
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        )
      }

      // Log audit
      await logAudit(userId, 'reject_college', collegeId, { reason })

      return NextResponse.json({ success: true, data })
    }

    // POST /api/approve-student - Approve a student
    if (path === '/approve-student') {
      const { studentId, notes, userId } = body

      if (!studentId || !userId) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        )
      }

      // Update student status
      const { data, error: updateError } = await supabase
        .from('students')
        .update({
          approval_status: 'approved'
        })
        .eq('id', studentId)
        .select()
        .single()

      if (updateError) {
        console.error('Error approving student:', updateError)
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        )
      }

      // Log audit
      await logAudit(userId, 'approve_student', studentId, { notes })

      return NextResponse.json({ success: true, data })
    }

    // POST /api/reject-student - Reject a student
    if (path === '/reject-student') {
      const { studentId, reason, userId } = body

      if (!studentId || !userId) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        )
      }

      // Update student status
      const { data, error: updateError } = await supabase
        .from('students')
        .update({
          approval_status: 'rejected',
          rejection_reason: reason
        })
        .eq('id', studentId)
        .select()
        .single()

      if (updateError) {
        console.error('Error rejecting student:', updateError)
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        )
      }

      // Log audit
      await logAudit(userId, 'reject_student', studentId, { reason })

      return NextResponse.json({ success: true, data })
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
    // Create RLS-aware Supabase client with user context
    const { supabase: rlsClient, user, error: authError } = await createRLSClient(request)
    
    // Ensure user is authenticated
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get user context for authorization checks
    const userContext = await getUserContext(rlsClient, user)
    
    if (!userContext) {
      return NextResponse.json({ error: 'User context not found' }, { status: 403 })
    }
    
    const body = await request.json()

    // DELETE /api/user - Delete a user (soft delete by deactivating)
    if (path === '/user') {
      const { userId, actorId, reason } = body

      // Soft delete by deactivating using RLS client
      const { error: updateError } = await rlsClient
        .from('users')
        .update({ isActive: false })
        .eq('id', userId)

      if (updateError) throw updateError

      // Log verification using RLS client
      const { error: verifyError } = await rlsClient
        .from('verifications')
        .insert({
          id: uuidv4(),
          targetTable: 'users',
          targetId: userId,
          action: 'delete',
          performedBy: actorId || userContext.id,
          note: reason || 'User deleted'
        })

      if (verifyError) throw verifyError

      // Log audit
      await logAudit(userContext.id, 'delete_user', userId, { reason })

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
    // Create RLS-aware Supabase client with user context
    const { supabase: rlsClient, user, error: authError } = await createRLSClient(request)
    
    // Ensure user is authenticated
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get user context for authorization checks
    const userContext = await getUserContext(rlsClient, user)
    
    if (!userContext) {
      return NextResponse.json({ error: 'User context not found' }, { status: 403 })
    }
    
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

      // First, find the user by email using RLS client
      const { data: userData, error: userError } = await rlsClient
        .from('users')
        .select('id, organizationId, metadata')
        .eq('email', email)
        .single()

      if (userError || !userData) {
        console.error('User lookup error:', userError)
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }

      console.log('User found:', { id: userData.id, organizationId: userData.organizationId, metadata: userData.metadata })

      // Update user metadata with name
      const updatedMetadata = {
        ...(userData.metadata || {}),
        name: name || userData.metadata?.name
      }

      const { error: updateUserError } = await rlsClient
        .from('users')
        .update({ 
          metadata: updatedMetadata
        })
        .eq('id', userData.id)

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

