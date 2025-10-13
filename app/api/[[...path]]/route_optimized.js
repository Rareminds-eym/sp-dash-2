// Optimized API endpoints - will be merged into main route.js

// GET /api/users - List all users (OPTIMIZED)
if (path === '/users') {
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .order('createdAt', { ascending: false })

  if (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
  
  // Fetch all organizations in bulk
  if (users && users.length > 0) {
    const orgIds = users.map(u => u.organizationId).filter(Boolean)
    
    if (orgIds.length > 0) {
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name')
        .in('id', orgIds)
      
      const orgMap = {}
      orgs?.forEach(org => { orgMap[org.id] = org })
      
      users.forEach(user => {
        if (user.organizationId && orgMap[user.organizationId]) {
          user.organizations = orgMap[user.organizationId]
        }
      })
    }
  }
  
  return NextResponse.json(users || [])
}

// GET /api/recruiters - List all recruiter organizations (OPTIMIZED)
if (path === '/recruiters') {
  const { data: recruiters, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('type', 'recruiter')
    .order('createdAt', { ascending: false })

  if (error) {
    console.error('Error fetching recruiters:', error)
    return NextResponse.json({ error: 'Failed to fetch recruiters' }, { status: 500 })
  }

  // Fetch all users in bulk and count by organization
  if (recruiters && recruiters.length > 0) {
    const recruiterIds = recruiters.map(r => r.id)
    
    const { data: users } = await supabase
      .from('users')
      .select('id, organizationId')
      .in('organizationId', recruiterIds)
    
    // Count users by organization
    const userCountMap = {}
    users?.forEach(user => {
      userCountMap[user.organizationId] = (userCountMap[user.organizationId] || 0) + 1
    })
    
    recruiters.forEach(recruiter => {
      recruiter.userCount = userCountMap[recruiter.id] || 0
      
      // Add default values if verification fields don't exist
      if (!recruiter.hasOwnProperty('verificationStatus')) {
        recruiter.verificationStatus = 'approved'
      }
      if (!recruiter.hasOwnProperty('isActive')) {
        recruiter.isActive = true
      }
    })
  }

  return NextResponse.json(recruiters || [])
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
    
    const [usersResult, orgsResult] = await Promise.all([
      userIds.length > 0 ? supabase.from('users').select('id, email').in('id', userIds) : { data: [] },
      universityIds.length > 0 ? supabase.from('organizations').select('id, name').in('id', universityIds) : { data: [] }
    ])
    
    // Create lookup maps
    const userMap = {}
    usersResult.data?.forEach(user => { userMap[user.id] = user })
    
    const orgMap = {}
    orgsResult.data?.forEach(org => { orgMap[org.id] = org })
    
    // Map data to students
    students.forEach(student => {
      if (student.userId && userMap[student.userId]) {
        student.users = userMap[student.userId]
      }
      if (student.universityId && orgMap[student.universityId]) {
        student.organizations = orgMap[student.universityId]
      }
    })
  }
  
  return NextResponse.json(students || [])
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