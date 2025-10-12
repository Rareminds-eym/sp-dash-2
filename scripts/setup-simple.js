import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { v4 as uuidv4 } from 'uuid'

config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables')
  console.log('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function setupDatabase() {
  try {
    console.log('🚀 Setting up simple database...')

    // Create a simple university organization
    console.log('📝 Creating organization...')
    const org = {
      id: uuidv4(),
      name: 'Sample University',
      type: 'university',
      state: 'Delhi',
      district: 'Central Delhi'
    }

    const { error: orgError } = await supabase.from('organizations').insert(org)
    if (orgError) {
      console.error('Organization insert error:', orgError.message)
      return
    }
    console.log('✅ Organization created')

    // Create users
    console.log('📝 Creating users...')
    const users = [
      { id: uuidv4(), email: 'superadmin@rareminds.in', role: 'super_admin', organizationId: null, isActive: true },
      { id: uuidv4(), email: 'admin@rareminds.in', role: 'admin', organizationId: org.id, isActive: true },
      { id: uuidv4(), email: 'manager@rareminds.in', role: 'manager', organizationId: org.id, isActive: true },
      { id: uuidv4(), email: 'student@rareminds.in', role: 'manager', organizationId: org.id, isActive: true },
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
      { id: uuidv4(), userId: users[3].id, universityId: org.id, profile: { name: 'Sample Student', course: 'Computer Science', year: 3 } },
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
      { id: uuidv4(), studentId: students[0].id, status: 'verified', nsqfLevel: 5, skills: ['JavaScript', 'React', 'Node.js'] },
      { id: uuidv4(), studentId: students[0].id, status: 'pending', nsqfLevel: 4, skills: ['Python', 'Data Analysis'] },
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
      activeUniversities: 1,
      registeredStudents: 1,
      verifiedPassports: 1,
      employabilityIndex: 100.0,
      activeRecruiters: 0
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
      { id: uuidv4(), targetTable: 'skill_passports', targetId: passports[0].id, action: 'verify', performedBy: users[0].id, note: 'Verification completed' },
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
    console.log('Super Admin: superadmin@rareminds.in')
    console.log('Admin: admin@rareminds.in')
    console.log('Manager: manager@rareminds.in')

  } catch (error) {
    console.error('❌ Setup failed:', error)
    process.exit(1)
  }
}

setupDatabase()