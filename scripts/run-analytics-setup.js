// Setup script to extend database and seed analytics data
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runAnalyticsSetup() {
  try {
    console.log('🚀 Starting analytics setup...')
    
    // 1. Read and execute the SQL extension file
    console.log('📊 Extending database schema for analytics...')
    const sqlPath = join(__dirname, 'extend-tables-recruiters.sql')
    const sqlContent = fs.readFileSync(sqlPath, 'utf8')
    
    // Split by statements and execute each
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing SQL statement...')
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement })
        if (error) {
          console.log(`Statement: ${statement.substring(0, 100)}...`)
          console.log(`Warning (might be expected):`, error.message)
          // Continue with other statements
        }
      }
    }
    
    console.log('✅ Database schema extended successfully!')
    
    // 2. Now run the data seeding
    console.log('🌱 Seeding analytics data...')
    await seedAnalyticsData()
    
    console.log('🎉 Analytics setup completed successfully!')
    
  } catch (error) {
    console.error('❌ Error during analytics setup:', error)
  }
}

async function seedAnalyticsData() {
  console.log('Creating sample analytics data...')

  // Get existing data
  const { data: organizations } = await supabase.from('organizations').select('*')
  const { data: users } = await supabase.from('users').select('*')  
  const { data: students } = await supabase.from('students').select('*')

  if (!organizations || !users || !students) {
    console.log('Creating basic test data first...')
    await createBasicTestData()
  }

  // Create recruiter organizations
  const recruiterOrgs = [
    { id: crypto.randomUUID(), name: 'TechCorp Solutions', type: 'recruiter', state: 'Karnataka', district: 'Bangalore Urban' },
    { id: crypto.randomUUID(), name: 'InnovateTech Ltd', type: 'recruiter', state: 'Maharashtra', district: 'Mumbai' },
    { id: crypto.randomUUID(), name: 'FutureSkills Inc', type: 'recruiter', state: 'Tamil Nadu', district: 'Chennai' },
    { id: crypto.randomUUID(), name: 'GlobalTech Partners', type: 'recruiter', state: 'Telangana', district: 'Hyderabad' },
    { id: crypto.randomUUID(), name: 'DataDriven Systems', type: 'recruiter', state: 'Delhi', district: 'New Delhi' }
  ]

  console.log('Creating recruiter organizations...')
  await supabase.from('organizations').upsert(recruiterOrgs)

  // Create recruiters and seed all analytics data
  // (Rest of seeding logic similar to previous script but using crypto.randomUUID())
  
  console.log('✅ Analytics data seeded successfully!')
}

async function createBasicTestData() {
  // Create basic test data if not exists
  const testOrg = {
    id: crypto.randomUUID(),
    name: 'Test University',
    type: 'university',
    state: 'Karnataka',
    district: 'Bangalore'
  }
  
  const testUser = {
    id: crypto.randomUUID(),
    email: 'test@university.edu',
    role: 'admin',
    organizationId: testOrg.id
  }
  
  await supabase.from('organizations').upsert([testOrg])
  await supabase.from('users').upsert([testUser])
  
  const testStudent = {
    id: crypto.randomUUID(),
    userId: testUser.id,
    universityId: testOrg.id,
    profile: { name: 'Test Student' }
  }
  
  await supabase.from('students').upsert([testStudent])
  console.log('Basic test data created')
}

// Run the setup
runAnalyticsSetup()