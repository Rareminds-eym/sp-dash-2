const { createClient } = require('@supabase/supabase-js')
const { v4: uuidv4 } = require('uuid')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function setupDatabase() {
  console.log('🚀 Starting database setup...')
  console.log('Note: Tables need to be created in Supabase SQL Editor manually')
  console.log('Proceeding with seed data insertion...\n')

  try {
    // Create organizations
    console.log('📝 Creating organizations...')
    const orgs = [
      { id: uuidv4(), name: 'Delhi University', type: 'university', state: 'Delhi', district: 'Central Delhi' },
      { id: uuidv4(), name: 'Mumbai College of Engineering', type: 'college', state: 'Maharashtra', district: 'Mumbai' },
      { id: uuidv4(), name: 'Bangalore Institute of Technology', type: 'institute', state: 'Karnataka', district: 'Bangalore' },
      { id: uuidv4(), name: 'TechCorp Recruiters', type: 'recruiter', state: 'Karnataka', district: 'Bangalore' },
      { id: uuidv4(), name: 'IIT Delhi', type: 'university', state: 'Delhi', district: 'South Delhi' },
    ]

    const { error: orgError } = await supabase.from('organizations').insert(orgs)
    if (orgError) {
      console.error('Organization insert error:', orgError.message)
      console.log('Tables may not exist yet. Please create them first.')
      return
    }
    console.log('✅ Organizations created')

    // Create users
    console.log('📝 Creating users...')
    const users = [
      { id: uuidv4(), email: 'superadmin@rareminds.com', role: 'super_admin', organizationId: null, isActive: true },
      { id: uuidv4(), email: 'admin@rareminds.com', role: 'admin', organizationId: orgs[0].id, isActive: true },
      { id: uuidv4(), email: 'manager@rareminds.com', role: 'manager', organizationId: orgs[1].id, isActive: true },
      { id: uuidv4(), email: 'john.doe@student.com', role: 'manager', organizationId: orgs[0].id, isActive: true },
      { id: uuidv4(), email: 'jane.smith@student.com', role: 'manager', organizationId: orgs[1].id, isActive: true },
    ]

    const { error: userError } = await supabase.from('users').insert(users)
    if (userError) {
      console.error('User insert error:', userError.message)
      return
    }
    console.log('✅ Users created')

    // Create students
    console.log('📝 Creating students...')
    const students = [
      { id: uuidv4(), userId: users[3].id, universityId: orgs[0].id, profile: { name: 'John Doe', course: 'Computer Science', year: 3 } },
      { id: uuidv4(), userId: users[4].id, universityId: orgs[1].id, profile: { name: 'Jane Smith', course: 'Electronics', year: 2 } },
    ]

    const { error: studentError } = await supabase.from('students').insert(students)
    if (studentError) {
      console.error('Student insert error:', studentError.message)
      return
    }
    console.log('✅ Students created')

    // Create skill passports
    console.log('📝 Creating skill passports...')
    const passports = [
      { id: uuidv4(), studentId: students[0].id, status: 'verified', aiVerification: true, nsqfLevel: 5, skills: ['JavaScript', 'React', 'Node.js'] },
      { id: uuidv4(), studentId: students[1].id, status: 'pending', aiVerification: false, nsqfLevel: 4, skills: ['Python', 'Data Analysis'] },
    ]

    const { error: passportError } = await supabase.from('skill_passports').insert(passports)
    if (passportError) {
      console.error('Passport insert error:', passportError.message)
      return
    }
    console.log('✅ Skill passports created')

    // Create metrics snapshot
    console.log('📝 Creating metrics snapshot...')
    const metrics = {
      id: uuidv4(),
      snapshotDate: new Date().toISOString().split('T')[0],
      activeUniversities: 5,
      registeredStudents: 1247,
      verifiedPassports: 856,
      aiVerifiedPercent: 78.5,
      employabilityIndex: 82.3,
      activeRecruiters: 24
    }

    const { error: metricsError } = await supabase.from('metrics_snapshots').insert(metrics)
    if (metricsError) {
      console.error('Metrics insert error:', metricsError.message)
      return
    }
    console.log('✅ Metrics snapshot created')

    // Create some verifications
    console.log('📝 Creating verifications...')
    const verifications = [
      { id: uuidv4(), targetTable: 'skill_passports', targetId: passports[0].id, action: 'verify', performedBy: users[0].id, note: 'AI verification completed' },
      { id: uuidv4(), targetTable: 'users', targetId: users[3].id, action: 'approve', performedBy: users[1].id, note: 'User approved' },
    ]

    const { error: verifyError } = await supabase.from('verifications').insert(verifications)
    if (verifyError) {
      console.error('Verification insert error:', verifyError.message)
      return
    }
    console.log('✅ Verifications created')

    console.log('\n🎉 Database setup complete!')
    console.log('\n📧 Test Credentials (for reference):')
    console.log('Super Admin: superadmin@rareminds.com')
    console.log('Admin: admin@rareminds.com')
    console.log('Manager: manager@rareminds.com')

  } catch (error) {
    console.error('❌ Setup failed:', error)
    process.exit(1)
  }
}

setupDatabase()
