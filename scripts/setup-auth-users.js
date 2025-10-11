const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load .env file
const envPath = path.join(__dirname, '..', '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim()
      process.env[key] = value
    }
  })
}

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

async function setupAuthUsers() {
  console.log('🚀 Setting up Supabase Auth users...')

  const testUsers = [
    {
      email: 'superadmin@rareminds.in',
      password: 'password123',
      role: 'super_admin',
      name: 'Super Admin'
    },
    {
      email: 'admin@rareminds.in',
      password: 'password123',
      role: 'admin',
      name: 'Admin User'
    },
    {
      email: 'manager@rareminds.in',
      password: 'password123',
      role: 'manager',
      name: 'Manager User'
    }
  ]

  for (const user of testUsers) {
    try {
      console.log(`\n📧 Creating auth user: ${user.email}`)

      // Check if user already exists in auth
      const { data: existingUsers } = await supabase.auth.admin.listUsers()
      const existingUser = existingUsers?.users?.find(u => u.email === user.email)

      if (existingUser) {
        console.log(`  ℹ️  User already exists in Supabase Auth`)
        
        // Update user metadata
        const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
          existingUser.id,
          {
            user_metadata: {
              role: user.role,
              name: user.name
            }
          }
        )

        if (updateError) {
          console.error(`  ❌ Error updating user metadata:`, updateError.message)
        } else {
          console.log(`  ✅ User metadata updated`)
        }

        // Also update or create in users table
        const { data: dbUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', existingUser.id)
          .single()

        if (!dbUser) {
          // Create in users table
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: existingUser.id,
              email: user.email,
              role: user.role,
              isActive: true,
              metadata: { name: user.name }
            })

          if (insertError) {
            console.error(`  ❌ Error creating user in database:`, insertError.message)
          } else {
            console.log(`  ✅ User created in database table`)
          }
        } else {
          // Update in users table
          const { error: updateDbError } = await supabase
            .from('users')
            .update({
              role: user.role,
              metadata: { name: user.name }
            })
            .eq('id', existingUser.id)

          if (updateDbError) {
            console.error(`  ❌ Error updating user in database:`, updateDbError.message)
          } else {
            console.log(`  ✅ User updated in database table`)
          }
        }
      } else {
        // Create new auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: {
            role: user.role,
            name: user.name
          }
        })

        if (authError) {
          console.error(`  ❌ Error creating auth user:`, authError.message)
          continue
        }

        console.log(`  ✅ Auth user created with ID: ${authData.user.id}`)

        // Create corresponding entry in users table
        const { error: dbError } = await supabase
          .from('users')
          .upsert({
            id: authData.user.id,
            email: user.email,
            role: user.role,
            isActive: true,
            metadata: { name: user.name }
          })

        if (dbError) {
          console.error(`  ❌ Error creating user in database:`, dbError.message)
        } else {
          console.log(`  ✅ User created in database table`)
        }
      }
    } catch (error) {
      console.error(`  ❌ Error setting up user ${user.email}:`, error.message)
    }
  }

  console.log('\n✨ Auth users setup complete!')
  console.log('\n📝 Test Credentials:')
  console.log('   Email: superadmin@rareminds.in | Password: password123')
  console.log('   Email: admin@rareminds.in | Password: password123')
  console.log('   Email: manager@rareminds.in | Password: password123')
}

// Run the setup
setupAuthUsers()
  .then(() => {
    console.log('\n✅ Setup completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Setup failed:', error)
    process.exit(1)
  })
