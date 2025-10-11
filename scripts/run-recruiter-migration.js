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
    console.log('📝 Checking if fields already exist...')
    
    // Try to fetch organizations to check if fields exist
    const { data: testOrg, error: testError } = await supabase
      .from('organizations')
      .select('verificationStatus, isActive')
      .limit(1)
      .maybeSingle()

    if (!testError) {
      console.log('✅ Migration fields already exist!')
      console.log('   - verificationStatus')
      console.log('   - isActive')
      
      // Update existing recruiters to approved status
      console.log('\n📝 Updating existing recruiters to approved status...')
      const { error: updateError } = await supabase
        .from('organizations')
        .update({ 
          verificationStatus: 'approved',
          isActive: true 
        })
        .eq('type', 'recruiter')
      
      if (updateError) {
        console.error('⚠️  Update warning:', updateError.message)
      } else {
        console.log('✅ All recruiters set to approved status')
      }
      
      return
    }

    console.log('⚠️  Migration fields do not exist yet.')
    console.log('\n📋 Please run the following SQL in Supabase SQL Editor:\n')
    
    const sqlPath = path.join(__dirname, 'add-recruiter-verification-fields.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')
    console.log(sql)
    
    console.log('\n💡 After running the SQL, the recruiter verification feature will work correctly.')

  } catch (error) {
    console.error('❌ Error during migration:', error.message)
    console.log('\n⚠️  Please run the SQL migration manually in Supabase SQL Editor.')
    console.log('File location: /app/scripts/add-recruiter-verification-fields.sql')
  }
}

runMigration()
