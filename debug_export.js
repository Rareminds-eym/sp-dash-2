import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugExport() {
  console.log('\n=== DEBUGGING PASSPORT EXPORT ===\n')
  
  // Step 1: Fetch passports (like export does)
  const { data: passports, error: passportsError } = await supabase
    .from('skill_passports')
    .select('*')
    .limit(3)
  
  if (passportsError) {
    console.error('Error fetching passports:', passportsError)
    return
  }
  
  console.log(`\n1. Fetched ${passports.length} passports`)
  console.log('Sample passport:', JSON.stringify(passports[0], null, 2))
  
  // Step 2: Get student IDs
  const studentIds = passports.map(p => p.studentId).filter(Boolean)
  console.log(`\n2. Student IDs found: ${studentIds.length}`, studentIds)
  
  if (studentIds.length === 0) {
    console.log('NO STUDENT IDs FOUND - THIS IS THE PROBLEM!')
    return
  }
  
  // Step 3: Fetch students
  const { data: students, error: studentsError } = await supabase
    .from('students')
    .select('*')
    .in('id', studentIds)
  
  if (studentsError) {
    console.error('Error fetching students:', studentsError)
    return
  }
  
  console.log(`\n3. Fetched ${students?.length || 0} students`)
  if (students && students.length > 0) {
    console.log('Sample student:', JSON.stringify(students[0], null, 2))
    
    // Check university ID
    const univId = students[0].universityId || students[0].organizationId
    console.log('\n4. University ID:', univId)
    
    if (univId) {
      const { data: univ } = await supabase
        .from('universities')
        .select('id, name')
        .eq('id', univId)
        .single()
      
      console.log('University:', univ)
    }
  }
  
  // Step 4: Create map and enrich
  const studentMap = {}
  students?.forEach(student => {
    // Parse profile
    if (student.profile && typeof student.profile === 'string') {
      try {
        const cleanedProfile = student.profile.replace(/:\s*NaN/g, ': null')
        student.profile = JSON.parse(cleanedProfile)
      } catch (e) {
        student.profile = {}
      }
    }
    studentMap[student.id] = student
  })
  
  console.log('\n5. Student Map Keys:', Object.keys(studentMap))
  
  // Step 5: Enrich passports
  const enrichedPassports = passports.map(passport => {
    const enriched = { ...passport }
    if (passport.studentId && studentMap[passport.studentId]) {
      enriched.students = studentMap[passport.studentId]
    }
    return enriched
  })
  
  console.log('\n6. Enriched Passport Sample:')
  const sample = enrichedPassports[0]
  console.log('Has students?', !!sample.students)
  if (sample.students) {
    console.log('Student email:', sample.students.email)
    console.log('Student profile.name:', sample.students.profile?.name)
    console.log('Student universityId:', sample.students.universityId)
  }
  
  // Step 6: CSV Generation Logic
  console.log('\n7. CSV Data Extraction:')
  enrichedPassports.forEach((p, idx) => {
    let studentName = ''
    let studentEmail = ''
    let universityName = ''
    
    if (p.students) {
      studentName = p.students.profile?.name || 
                   p.students.users?.metadata?.name || 
                   p.students.metadata?.name || 
                   p.students.name || 
                   ''
      
      studentEmail = p.students.email || 
                    p.students.users?.email || 
                    ''
      
      universityName = p.students.university?.name || 
                      p.students.organization?.name || 
                      ''
    }
    
    console.log(`\nPassport ${idx + 1}:`)
    console.log('  Student Name:', studentName || '(empty)')
    console.log('  Student Email:', studentEmail || '(empty)')
    console.log('  University:', universityName || '(empty)')
  })
}

debugExport().catch(console.error)
