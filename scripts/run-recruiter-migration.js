const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

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

async function runMigration() {
  console.log('🚀 Running recruiter verification migration...\n')

  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'add-recruiter-verification-fields.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')

    console.log('📝 Executing SQL migration...')
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).single()

    if (error) {
      console.error('❌ Migration failed:', error.message)
      console.log('\n⚠️  Manual migration required. Please run the following SQL in Supabase SQL Editor:')
      console.log('\n' + sql)
      console.log('\nOr you can manually add these fields to organizations table:')
      console.log('- verificationStatus TEXT DEFAULT \'pending\'')
      console.log('- isActive BOOLEAN DEFAULT true')
      console.log('- verifiedAt TIMESTAMP WITH TIME ZONE')
      console.log('- verifiedBy TEXT REFERENCES users(id)')
      return
    }

    console.log('✅ Migration completed successfully!')
    console.log('\nAdded fields to organizations table:')
    console.log('  - verificationStatus (pending/approved/rejected)')
    console.log('  - isActive (boolean)')
    console.log('  - verifiedAt (timestamp)')
    console.log('  - verifiedBy (user reference)')
    console.log('\n✅ All existing recruiter organizations have been set to approved status')

  } catch (error) {
    console.error('❌ Error running migration:', error.message)
    console.log('\n⚠️  Please run the SQL migration manually in Supabase SQL Editor.')
    console.log('File location: /app/scripts/add-recruiter-verification-fields.sql')
  }
}

runMigration()
