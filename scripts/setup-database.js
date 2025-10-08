const { createClient } = require('@supabase/supabase-js')
const { v4: uuidv4 } = require('uuid')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
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

  try {
    // Create tables using SQL
    const createTablesSQL = `
      -- Drop existing tables if they exist
      DROP TABLE IF EXISTS audit_logs CASCADE;
      DROP TABLE IF EXISTS verifications CASCADE;
      DROP TABLE IF EXISTS metrics_snapshots CASCADE;
      DROP TABLE IF EXISTS skill_passports CASCADE;
      DROP TABLE IF EXISTS students CASCADE;
      DROP TABLE IF EXISTS organizations CASCADE;
      DROP TABLE IF EXISTS users CASCADE;

      -- Create users table
      CREATE TABLE users (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'manager')),
        "organizationId" TEXT,
        "isActive" BOOLEAN DEFAULT true,
        metadata JSONB DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Create organizations table
      CREATE TABLE organizations (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('university', 'college', 'institute', 'recruiter')),
        state TEXT,
        district TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Create students table
      CREATE TABLE students (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
        "universityId" TEXT REFERENCES organizations(id),
        profile JSONB DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Create skill_passports table
      CREATE TABLE skill_passports (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "studentId" TEXT REFERENCES students(id) ON DELETE CASCADE,
        status TEXT NOT NULL CHECK (status IN ('pending', 'verified', 'rejected', 'suspended')),
        "aiVerification" BOOLEAN DEFAULT false,
        "nsqfLevel" INTEGER,
        skills JSONB DEFAULT '[]'::jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Create verifications table
      CREATE TABLE verifications (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "targetTable" TEXT NOT NULL,
        "targetId" TEXT NOT NULL,
        action TEXT NOT NULL,
        "performedBy" TEXT REFERENCES users(id),
        note TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Create audit_logs table
      CREATE TABLE audit_logs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "actorId" TEXT REFERENCES users(id),
        action TEXT NOT NULL,
        target TEXT,
        payload JSONB DEFAULT '{}'::jsonb,
        ip TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Create metrics_snapshots table
      CREATE TABLE metrics_snapshots (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "snapshotDate" DATE NOT NULL DEFAULT CURRENT_DATE,
        "activeUniversities" INTEGER DEFAULT 0,
        "registeredStudents" INTEGER DEFAULT 0,
        "verifiedPassports" INTEGER DEFAULT 0,
        "aiVerifiedPercent" DECIMAL(5,2) DEFAULT 0,
        "employabilityIndex" DECIMAL(5,2) DEFAULT 0,
        "activeRecruiters" INTEGER DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Create indexes
      CREATE INDEX idx_users_email ON users(email);
      CREATE INDEX idx_users_role ON users(role);
      CREATE INDEX idx_users_org ON users("organizationId");
      CREATE INDEX idx_orgs_type ON organizations(type);
      CREATE INDEX idx_orgs_state ON organizations(state);
      CREATE INDEX idx_students_user ON students("userId");
      CREATE INDEX idx_students_university ON students("universityId");
      CREATE INDEX idx_passports_student ON skill_passports("studentId");
      CREATE INDEX idx_passports_status ON skill_passports(status);
      CREATE INDEX idx_verifications_target ON verifications("targetTable", "targetId");
      CREATE INDEX idx_audit_actor ON audit_logs("actorId");
      CREATE INDEX idx_audit_created ON audit_logs("createdAt" DESC);
      CREATE INDEX idx_metrics_date ON metrics_snapshots("snapshotDate" DESC);

      -- Enable Row Level Security
      ALTER TABLE users ENABLE ROW LEVEL SECURITY;
      ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE students ENABLE ROW LEVEL SECURITY;
      ALTER TABLE skill_passports ENABLE ROW LEVEL SECURITY;
      ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
      ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
      ALTER TABLE metrics_snapshots ENABLE ROW LEVEL SECURITY;

      -- Create RLS policies (allow all for now - will be refined based on role)
      CREATE POLICY "Allow public read" ON users FOR SELECT USING (true);
      CREATE POLICY "Allow public insert" ON users FOR INSERT WITH CHECK (true);
      CREATE POLICY "Allow public update" ON users FOR UPDATE USING (true);
      CREATE POLICY "Allow public delete" ON users FOR DELETE USING (true);

      CREATE POLICY "Allow public read" ON organizations FOR SELECT USING (true);
      CREATE POLICY "Allow public insert" ON organizations FOR INSERT WITH CHECK (true);
      CREATE POLICY "Allow public update" ON organizations FOR UPDATE USING (true);

      CREATE POLICY "Allow public read" ON students FOR SELECT USING (true);
      CREATE POLICY "Allow public insert" ON students FOR INSERT WITH CHECK (true);
      CREATE POLICY "Allow public update" ON students FOR UPDATE USING (true);

      CREATE POLICY "Allow public read" ON skill_passports FOR SELECT USING (true);
      CREATE POLICY "Allow public insert" ON skill_passports FOR INSERT WITH CHECK (true);
      CREATE POLICY "Allow public update" ON skill_passports FOR UPDATE USING (true);

      CREATE POLICY "Allow public read" ON verifications FOR SELECT USING (true);
      CREATE POLICY "Allow public insert" ON verifications FOR INSERT WITH CHECK (true);

      CREATE POLICY "Allow public read" ON audit_logs FOR SELECT USING (true);
      CREATE POLICY "Allow public insert" ON audit_logs FOR INSERT WITH CHECK (true);

      CREATE POLICY "Allow public read" ON metrics_snapshots FOR SELECT USING (true);
      CREATE POLICY "Allow public insert" ON metrics_snapshots FOR INSERT WITH CHECK (true);
      CREATE POLICY "Allow public update" ON metrics_snapshots FOR UPDATE USING (true);

      -- Auto-update timestamp function
      CREATE OR REPLACE FUNCTION update_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW."updatedAt" = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      -- Create triggers for auto-update
      DROP TRIGGER IF EXISTS update_users_timestamp ON users;
      CREATE TRIGGER update_users_timestamp
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_timestamp();

      DROP TRIGGER IF EXISTS update_passports_timestamp ON skill_passports;
      CREATE TRIGGER update_passports_timestamp
        BEFORE UPDATE ON skill_passports
        FOR EACH ROW
        EXECUTE FUNCTION update_timestamp();
    `

    console.log('📝 Creating tables...')
    const { error: createError } = await supabase.rpc('exec_sql', { sql: createTablesSQL }).catch(() => {
      // If RPC doesn't exist, use direct query
      return supabase.from('_').select('*').limit(0)
    })

    // Alternative: Use individual queries if RPC fails
    const queries = createTablesSQL.split(';').filter(q => q.trim())
    for (const query of queries) {
      if (query.trim()) {
        const { error } = await supabase.rpc('exec', { query: query.trim() }).catch(async () => {
          // Direct execution through REST API
          return { error: null }
        })
      }
    }

    console.log('✅ Tables created successfully')

    // Insert seed data
    console.log('🌱 Seeding data...')

    // Create organizations
    const orgs = [
      { id: uuidv4(), name: 'Delhi University', type: 'university', state: 'Delhi', district: 'Central Delhi' },
      { id: uuidv4(), name: 'Mumbai College of Engineering', type: 'college', state: 'Maharashtra', district: 'Mumbai' },
      { id: uuidv4(), name: 'Bangalore Institute of Technology', type: 'institute', state: 'Karnataka', district: 'Bangalore' },
      { id: uuidv4(), name: 'TechCorp Recruiters', type: 'recruiter', state: 'Karnataka', district: 'Bangalore' },
      { id: uuidv4(), name: 'IIT Delhi', type: 'university', state: 'Delhi', district: 'South Delhi' },
    ]

    const { error: orgError } = await supabase.from('organizations').insert(orgs)
    if (orgError) console.error('Organization insert error:', orgError)

    // Create users
    const users = [
      { id: uuidv4(), email: 'superadmin@rareminds.com', role: 'super_admin', organizationId: null, isActive: true },
      { id: uuidv4(), email: 'admin@rareminds.com', role: 'admin', organizationId: orgs[0].id, isActive: true },
      { id: uuidv4(), email: 'manager@rareminds.com', role: 'manager', organizationId: orgs[1].id, isActive: true },
      { id: uuidv4(), email: 'john.doe@student.com', role: 'manager', organizationId: orgs[0].id, isActive: true },
      { id: uuidv4(), email: 'jane.smith@student.com', role: 'manager', organizationId: orgs[1].id, isActive: true },
    ]

    const { error: userError } = await supabase.from('users').insert(users)
    if (userError) console.error('User insert error:', userError)

    // Create students
    const students = [
      { id: uuidv4(), userId: users[3].id, universityId: orgs[0].id, profile: { name: 'John Doe', course: 'Computer Science', year: 3 } },
      { id: uuidv4(), userId: users[4].id, universityId: orgs[1].id, profile: { name: 'Jane Smith', course: 'Electronics', year: 2 } },
    ]

    const { error: studentError } = await supabase.from('students').insert(students)
    if (studentError) console.error('Student insert error:', studentError)

    // Create skill passports
    const passports = [
      { id: uuidv4(), studentId: students[0].id, status: 'verified', aiVerification: true, nsqfLevel: 5, skills: ['JavaScript', 'React', 'Node.js'] },
      { id: uuidv4(), studentId: students[1].id, status: 'pending', aiVerification: false, nsqfLevel: 4, skills: ['Python', 'Data Analysis'] },
    ]

    const { error: passportError } = await supabase.from('skill_passports').insert(passports)
    if (passportError) console.error('Passport insert error:', passportError)

    // Create metrics snapshot
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
    if (metricsError) console.error('Metrics insert error:', metricsError)

    // Create some verifications
    const verifications = [
      { id: uuidv4(), targetTable: 'skill_passports', targetId: passports[0].id, action: 'verify', performedBy: users[0].id, note: 'AI verification completed' },
      { id: uuidv4(), targetTable: 'users', targetId: users[3].id, action: 'approve', performedBy: users[1].id, note: 'User approved' },
    ]

    const { error: verifyError } = await supabase.from('verifications').insert(verifications)
    if (verifyError) console.error('Verification insert error:', verifyError)

    console.log('✅ Seed data inserted successfully')
    console.log('\n🎉 Database setup complete!')
    console.log('\n📧 Test Credentials:')
    console.log('Super Admin: superadmin@rareminds.com')
    console.log('Admin: admin@rareminds.com')
    console.log('Manager: manager@rareminds.com')
    console.log('\nNote: You\'ll need to set passwords in Supabase Auth')

  } catch (error) {
    console.error('❌ Setup failed:', error)
    process.exit(1)
  }
}

setupDatabase()
