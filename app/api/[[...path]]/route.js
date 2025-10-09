import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '../../../lib/supabase'

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
      const { data: metrics, error } = await supabase
        .from('metrics_snapshots')
        .select('*')
        .order('snapshotDate', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error

      return NextResponse.json(metrics || {
        activeUniversities: 0,
        registeredStudents: 0,
        verifiedPassports: 0,
        aiVerifiedPercent: 0,
        employabilityIndex: 0,
        activeRecruiters: 0
      })
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
            const { data: student } = await supabase
              .from('students')
              .select('*')
              .eq('id', passport.studentId)
              .maybeSingle()
            if (student) {
              // Get user email for student
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

    // GET /api/analytics/trends - Employability and AI verification trends
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

    // GET /api/analytics/university-reports - University-wise analytics
    if (path === '/analytics/university-reports') {
      const { data: orgs, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('type', 'university')

      if (orgError) throw orgError

      const universityReports = []
      
      for (const org of orgs) {
        // Get students enrolled in this university
        const { data: students, error: studentsError } = await supabase
          .from('students')
          .select('id, createdAt')
          .eq('universityId', org.id)

        const enrollmentCount = students ? students.length : 0

        // Get verified passports for students from this university
        const studentIds = students ? students.map(s => s.id) : []
        let verifiedCount = 0
        let totalPassports = 0

        if (studentIds.length > 0) {
          const { data: passports } = await supabase
            .from('skill_passports')
            .select('status')
            .in('studentId', studentIds)

          totalPassports = passports ? passports.length : 0
          verifiedCount = passports ? passports.filter(p => p.status === 'verified').length : 0
        }

        const completionRate = totalPassports > 0 ? ((verifiedCount / totalPassports) * 100).toFixed(1) : 0
        const verificationRate = enrollmentCount > 0 ? ((totalPassports / enrollmentCount) * 100).toFixed(1) : 0

        universityReports.push({
          universityId: org.id,
          universityName: org.name,
          state: org.state,
          enrollmentCount,
          totalPassports,
          verifiedPassports: verifiedCount,
          completionRate: parseFloat(completionRate),
          verificationRate: parseFloat(verificationRate)
        })
      }

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

    // GET /api/analytics/state-heatmap - Enhanced state-wise heat map data
    if (path === '/analytics/state-heatmap') {
      const { data: orgs, error } = await supabase
        .from('organizations')
        .select('state, type')

      if (error) throw error

      const { data: students } = await supabase
        .from('students')
        .select('id, universityId')

      const { data: passports } = await supabase
        .from('skill_passports')
        .select('studentId, status')

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

      // Add student and passport data
      if (students && passports) {
        students.forEach(student => {
          const university = orgs.find(org => org.id === student.universityId)
          if (university && university.state) {
            stateMetrics[university.state].students++
            
            const studentPassports = passports.filter(p => p.studentId === student.id)
            const verifiedPassports = studentPassports.filter(p => p.status === 'verified')
            stateMetrics[university.state].verifiedPassports += verifiedPassports.length
          }
        })
      }

      // Calculate scores
      Object.values(stateMetrics).forEach(state => {
        state.engagementScore = Math.min(95, Math.floor((state.students / state.universities) * 2 + Math.random() * 20))
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
    const body = await request.json()

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
