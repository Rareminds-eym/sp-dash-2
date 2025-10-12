require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const statuses = ['verified', 'pending', 'rejected', 'pending'];
const nsqfLevels = [1, 2, 3, 4, 5, 6, 7];
const skillSets = [
  ['JavaScript', 'React', 'Node.js'],
  ['Python', 'Django', 'Machine Learning'],
  ['Java', 'Spring Boot', 'Microservices'],
  ['Data Analysis', 'SQL', 'Excel'],
  ['UI/UX Design', 'Figma', 'Adobe XD'],
  ['Digital Marketing', 'SEO', 'Content Writing'],
  ['Project Management', 'Agile', 'Scrum'],
  ['Cloud Computing', 'AWS', 'Docker'],
  ['Cybersecurity', 'Networking', 'Ethical Hacking'],
  ['Mobile Development', 'React Native', 'Flutter']
];

async function createPassportsForAllStudents() {
  try {
    console.log('🔍 Fetching all students...');
    
    // Get all students
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id');
    
    if (studentsError) {
      console.error('Error fetching students:', studentsError);
      return;
    }
    
    console.log(`✅ Found ${students.length} students`);
    
    // Get existing passports
    const { data: existingPassports, error: passportsError } = await supabase
      .from('skill_passports')
      .select('studentId');
    
    if (passportsError) {
      console.error('Error fetching passports:', passportsError);
      return;
    }
    
    console.log(`📋 Found ${existingPassports.length} existing passports`);
    
    // Find students without passports
    const existingStudentIds = new Set(existingPassports.map(p => p.studentId));
    const studentsWithoutPassports = students.filter(s => !existingStudentIds.has(s.id));
    
    console.log(`📝 Creating passports for ${studentsWithoutPassports.length} students...`);
    
    if (studentsWithoutPassports.length === 0) {
      console.log('✅ All students already have passports!');
      return;
    }
    
    // Create passports in batches
    const batchSize = 100;
    let created = 0;
    
    for (let i = 0; i < studentsWithoutPassports.length; i += batchSize) {
      const batch = studentsWithoutPassports.slice(i, i + batchSize);
      
      const newPassports = batch.map((student, index) => {
        const statusIndex = (i + index) % statuses.length;
        const status = statuses[statusIndex];
        const aiVerification = status === 'verified' ? (Math.random() > 0.3) : false;
        const nsqfLevel = nsqfLevels[(i + index) % nsqfLevels.length];
        const skills = skillSets[(i + index) % skillSets.length];
        
        return {
          id: uuidv4(),
          studentId: student.id,
          status: status,
          aiVerification: aiVerification,
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
