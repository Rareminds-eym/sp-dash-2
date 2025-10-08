import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'
import { v4 as uuidv4 } from 'uuid'

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
        .single()

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
        .select('*, students(profile, users(email))')
        .order('createdAt', { ascending: false })

      if (error) throw error
      return NextResponse.json(passports || [])
    }

    // GET /api/verifications - List recent verifications
    if (path === '/verifications') {
      const { data: verifications, error } = await supabase
        .from('verifications')
        .select('*, users(email)')
        .order('createdAt', { ascending: false })
        .limit(50)

      if (error) throw error
      return NextResponse.json(verifications || [])
    }

    // GET /api/audit-logs - List audit logs
    if (path === '/audit-logs') {
      const { data: logs, error } = await supabase
        .from('audit_logs')
        .select('*, users(email)')
        .order('createdAt', { ascending: false })
        .limit(100)

      if (error) throw error
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
        '/api/analytics/trends'
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
