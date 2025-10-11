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
            aiVerifiedPercent: parseFloat(latestSnapshot.aiVerifiedPercent || 0),
            employabilityIndex: parseFloat(latestSnapshot.employabilityIndex || 0),
            activeRecruiters: latestSnapshot.activeRecruiters || 0,
            snapshotDate: latestSnapshot.snapshotDate,
            source: 'snapshot'
          })
        }
        
        // Fallback: Calculate metrics dynamically from database tables if no snapshot exists
        console.log('No snapshot found, calculating metrics dynamically')
        
        // Count universities (organizations with type = 'university')
        const { data: universities } = await supabase
          .from('organizations')
          .select('id')
          .eq('type', 'university')
        
        const activeUniversities = universities?.length || 0

        // Count recruiters (organizations with type = 'recruiter')
        const { data: recruiters } = await supabase
          .from('organizations')
          .select('id')
          .eq('type', 'recruiter')
        
        const activeRecruiters = recruiters?.length || 0

        // Count total students
        const { data: students } = await supabase
          .from('students')
          .select('id')
        
        const registeredStudents = students?.length || 0

        // Get all passports to calculate verification metrics
        const { data: passports } = await supabase
          .from('skill_passports')
          .select('status, aiVerification')
        
        const totalPassports = passports?.length || 0
        const verifiedPassports = passports?.filter(p => p.status === 'verified').length || 0
        const aiVerifiedCount = passports?.filter(p => p.aiVerification === true).length || 0
        
        // Calculate percentages
        const aiVerifiedPercent = totalPassports > 0 
          ? ((aiVerifiedCount / totalPassports) * 100).toFixed(1) 
          : 0
        
        const employabilityIndex = registeredStudents > 0 
          ? ((verifiedPassports / registeredStudents) * 100).toFixed(1) 
          : 0

        return NextResponse.json({
          activeUniversities,
          registeredStudents,
          verifiedPassports,
          aiVerifiedPercent: parseFloat(aiVerifiedPercent),
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
          aiVerifiedPercent: 0,
          employabilityIndex: 0,
          activeRecruiters: 0,
          source: 'error'
        })
      }
    }

    // GET /api/users - List all users
    if (path === '/users') {
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .order('createdAt', { ascending: false })

      if (error) {
        console.error('Error fetching users:', error)
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
      }
      
      // Manually fetch organization names if needed
      if (users && users.length > 0) {
        for (let user of users) {
          if (user.organizationId) {
            const { data: org, error: orgError } = await supabase
              .from('organizations')
              .select('name')
              .eq('id', user.organizationId)
              .maybeSingle()
            if (!orgError && org) {
              user.organizations = org
            }
          }
        }
      }
      
      return NextResponse.json(users || [])
    }

    // GET /api/organizations - List all organizations
    if (path === '/organizations') {
      const { data: orgs, error } = await supabase
        .from('organizations')
        .select('*')
        .order('createdAt', { ascending: false })

      if (error) throw error
      return NextResponse.json(orgs || [])
    }

    // GET /api/students - List all students
    if (path === '/students') {
      const { data: students, error } = await supabase
        .from('students')
        .select('*')
        .order('createdAt', { ascending: false })

      if (error) {
        console.error('Error fetching students:', error)
        return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 })
      }
      
      // Manually fetch related data
      if (students && students.length > 0) {
        for (let student of students) {
          if (student.userId) {
            const { data: user } = await supabase
              .from('users')
              .select('email')
              .eq('id', student.userId)
              .maybeSingle()
            if (user) {
              student.users = user
            }
          }
          if (student.universityId) {
            const { data: org } = await supabase
              .from('organizations')
              .select('name')
              .eq('id', student.universityId)
              .maybeSingle()
            if (org) {
              student.organizations = org
            }
          }
        }
      }
      
      return NextResponse.json(students || [])
    }

    // GET /api/passports - List all skill passports
    if (path === '/passports') {
      const { data: passports, error } = await supabase
        .from('skill_passports')
        .select('*')
        .order('createdAt', { ascending: false })

      if (error) {
        console.error('Error fetching passports:', error)
        return NextResponse.json({ error: 'Failed to fetch passports' }, { status: 500 })
      }
      
      // Manually fetch related data
      if (passports && passports.length > 0) {
        for (let passport of passports) {
          if (passport.studentId) {
            const { data: student, error: studentError } = await supabase
              .from('students')
              .select('*')
              .eq('id', passport.studentId)
              .maybeSingle()
            
            if (studentError) {
              console.error('Error fetching student:', studentError)
            }
            if (student) {
              // Get user data for student (email and metadata with name)
              if (student.userId) {
                const { data: user, error: userError } = await supabase
                  .from('users')
                  .select('email, metadata')
                  .eq('id', student.userId)
                  .maybeSingle()
                
                if (userError) {
                  console.error('Error fetching user for student:', userError)
                }
                if (user) {
                  student.users = user
                }
              }
              passport.students = student
            }
          }
        }
      }
      
      return NextResponse.json(passports || [])
    }

    // GET /api/verifications - List recent verifications
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
      
      // Manually fetch user emails
      if (verifications && verifications.length > 0) {
        for (let verification of verifications) {
          if (verification.performedBy) {
            const { data: user } = await supabase
              .from('users')
              .select('email')
              .eq('id', verification.performedBy)
              .maybeSingle()
            if (user) {
              verification.users = user
            }
          }
        }
      }
      
      return NextResponse.json(verifications || [])
    }

    // GET /api/audit-logs - List audit logs
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
      
      // Manually fetch user emails
      if (logs && logs.length > 0) {
        for (let log of logs) {
          if (log.actorId) {
            const { data: user } = await supabase
              .from('users')
              .select('email')
              .eq('id', log.actorId)
              .maybeSingle()
            if (user) {
              log.users = user
            }
          }
        }
      }
      
      return NextResponse.json(logs || [])
    }

    // GET /api/analytics/state-wise - State-wise distribution
    if (path === '/analytics/state-wise') {
      const { data: orgs, error } = await supabase
        .from('organizations')
        .select('state, type')

      if (error) throw error

      const stateCounts = {}
      orgs.forEach(org => {
        if (org.state) {
          stateCounts[org.state] = (stateCounts[org.state] || 0) + 1
        }
      })

      const chartData = Object.entries(stateCounts).map(([state, count]) => ({
        state,
        count
      }))

      return NextResponse.json(chartData)
    }

    // GET /api/analytics/trends - Employability and Skill verification trends
    if (path === '/analytics/trends') {
      const { data: metrics, error } = await supabase
        .from('metrics_snapshots')
        .select('*')
        .order('snapshotDate', { ascending: true })
        .limit(30)

      if (error) throw error

      const chartData = metrics.map(m => ({
        date: m.snapshotDate,
        employability: parseFloat(m.employabilityIndex) || 0,
        aiVerification: parseFloat(m.aiVerifiedPercent) || 0
      }))

      return NextResponse.json(chartData)
    }

    // GET /api/analytics/university-reports - University-wise analytics (OPTIMIZED)
    if (path === '/analytics/university-reports') {
      // Fetch all data in parallel instead of sequential loops
      const [orgsResult, studentsResult, passportsResult] = await Promise.all([
        supabase.from('organizations').select('id, name, state').eq('type', 'university'),
        supabase.from('students').select('id, universityId'),
        supabase.from('skill_passports').select('studentId, status')
      ])

      if (orgsResult.error) throw orgsResult.error

      const orgs = orgsResult.data || []
      const students = studentsResult.data || []
      const passports = passportsResult.data || []

      // Create lookup maps for O(1) access
      const studentsByUniversity = {}
      const passportsByStudent = {}

      students.forEach(student => {
        if (!studentsByUniversity[student.universityId]) {
          studentsByUniversity[student.universityId] = []
        }
        studentsByUniversity[student.universityId].push(student.id)
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
      // Fetch all data in parallel
      const [orgsResult, studentsResult, passportsResult] = await Promise.all([
        supabase.from('organizations').select('id, state, type'),
        supabase.from('students').select('id, universityId'),
        supabase.from('skill_passports').select('studentId, status')
      ])

      if (orgsResult.error) throw orgsResult.error

      const orgs = orgsResult.data || []
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

      // Add student and passport data using lookup map
      students.forEach(student => {
        const university = orgMap[student.universityId]
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
        .update({ status: 'verified', aiVerification: true })
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

    // POST /api/update-metrics - Update metrics_snapshots table
    if (path === '/update-metrics') {
      try {
        // Calculate metrics from database tables
        
        // Count universities
        const { data: universities } = await supabase
          .from('organizations')
          .select('id')
          .eq('type', 'university')
        
        const activeUniversities = universities?.length || 0

        // Count recruiters
        const { data: recruiters } = await supabase
          .from('organizations')
          .select('id')
          .eq('type', 'recruiter')
        
        const activeRecruiters = recruiters?.length || 0

        // Count students
        const { data: students } = await supabase
          .from('students')
          .select('id')
        
        const registeredStudents = students?.length || 0

        // Get passports for verification metrics
        const { data: passports } = await supabase
          .from('skill_passports')
          .select('status, aiVerification')
        
        const totalPassports = passports?.length || 0
        const verifiedPassports = passports?.filter(p => p.status === 'verified').length || 0
        const aiVerifiedCount = passports?.filter(p => p.aiVerification === true).length || 0
        
        // Calculate percentages
        const aiVerifiedPercent = totalPassports > 0 
          ? parseFloat(((aiVerifiedCount / totalPassports) * 100).toFixed(1))
          : 0
        
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
              aiVerifiedPercent,
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
              aiVerifiedPercent,
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
            aiVerifiedPercent,
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
