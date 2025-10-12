import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { config } from 'dotenv'

config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function createPassportsForAllStudents() {
  try {
    console.log('🚀 Creating skill passports for all students...')
    
    // Get all students
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id')
    
    if (studentsError) {
      console.error('Error fetching students:', studentsError)
      return
    }
    
    console.log(`📊 Found ${students.length} students`)
    
    // Get existing passports
    const { data: existingPassports, error: passportsError } = await supabase
      .from('skill_passports')
      .select('studentId')
    
    if (passportsError) {
      console.error('Error fetching existing passports:', passportsError)
      return
    }
    
    // Create a set of student IDs that already have passports
    const studentsWithPassports = new Set(existingPassports.map(p => p.studentId))
    
    // Filter students who don't have passports yet
    const studentsWithoutPassports = students.filter(s => !studentsWithPassports.has(s.id))
    
    console.log(`📝 ${studentsWithoutPassports.length} students need passports`)
    
    if (studentsWithoutPassports.length === 0) {
      console.log('✅ All students already have passports')
      return
    }
    
    // Define possible values
    const statuses = ['pending', 'verified', 'rejected', 'suspended']
    const nsqfLevels = [1, 2, 3, 4, 5, 6, 7]
    const skillSets = [
      ['JavaScript', 'React', 'Node.js'],
      ['Python', 'Data Analysis', 'Machine Learning'],
      ['Java', 'Spring', 'Hibernate'],
      ['C++', 'Algorithms', 'System Design'],
      ['UI/UX', 'Figma', 'Prototyping'],
      ['Digital Marketing', 'SEO', 'Content Creation'],
      ['Cloud Computing', 'AWS', 'DevOps'],
      ['Cybersecurity', 'Ethical Hacking', 'Network Security']
    ]
    
    // Create passports in batches
    const batchSize = 100;
    let created = 0;
    
    for (let i = 0; i < studentsWithoutPassports.length; i += batchSize) {
      const batch = studentsWithoutPassports.slice(i, i + batchSize);
      
      const newPassports = batch.map((student, index) => {
        const statusIndex = (i + index) % statuses.length;
        const status = statuses[statusIndex];
        const nsqfLevel = nsqfLevels[(i + index) % nsqfLevels.length];
        const skills = skillSets[(i + index) % skillSets.length];
        
        return {
          id: uuidv4(),
          studentId: student.id,
          status: status,
          nsqfLevel: nsqfLevel,
          skills: skills,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      });
      
      const { error: insertError } = await supabase
        .from('skill_passports')
        .insert(newPassports);
      
      if (insertError) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, insertError);
      } else {
        created += newPassports.length;
        console.log(`✅ Created batch ${i / batchSize + 1}: ${newPassports.length} passports`);
      }
    }
    
    console.log(`\n🎉 Successfully created ${created} new passports!`);
    console.log(`📊 Total passports now: ${existingPassports.length + created}`);
    
    // Show status distribution
    const { data: allPassports } = await supabase
      .from('skill_passports')
      .select('status');
    
    const statusCounts = allPassports.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\n📊 Status Distribution:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createPassportsForAllStudents();