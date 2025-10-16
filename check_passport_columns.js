import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkColumns() {
  // Fetch one passport
  const { data: passports, error } = await supabase
    .from('skill_passports')
    .select('*')
    .limit(2)
  
  if (error) {
    console.error('Error fetching passports:', error)
    return
  }
  
  if (passports && passports.length > 0) {
    console.log('\n=== Passport Columns ===')
    console.log('Columns:', Object.keys(passports[0]))
    console.log('\n=== First Passport Data ===')
    console.log(JSON.stringify(passports[0], null, 2))
    
    // Try both studentId and studentid
    const studentId = passports[0].studentId || passports[0].studentid
    console.log('\n=== Student ID ===')
    console.log('studentId field:', passports[0].studentId)
    console.log('studentid field:', passports[0].studentid)
    
    if (studentId) {
      // Fetch the student
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single()
      
      if (studentError) {
        console.error('\nError fetching student:', studentError)
      } else {
        console.log('\n=== Student Data ===')
        console.log(JSON.stringify(student, null, 2))
        
        if (student.userId) {
          const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, email, metadata')
            .eq('id', student.userId)
            .single()
          
          if (userError) {
            console.error('\nError fetching user:', userError)
          } else {
            console.log('\n=== User Data ===')
            console.log(JSON.stringify(user, null, 2))
          }
        }
        
        if (student.organizationId) {
          const { data: university, error: univError } = await supabase
            .from('universities')
            .select('id, name')
            .eq('id', student.organizationId)
            .single()
          
          if (univError) {
            console.error('\nError fetching university:', univError)
          } else {
            console.log('\n=== University Data ===')
            console.log(JSON.stringify(university, null, 2))
          }
        }
      }
    }
  } else {
    console.log('No passports found')
  }
}

checkColumns()
