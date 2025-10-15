const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dpooleduinyyzxgrcwko.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwb29sZWR1aW55eXp4Z3Jjd2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk5NDY5OCwiZXhwIjoyMDc1NTcwNjk4fQ.WIrwkA_-2oCjwmD6WpCf9N38hYXEwrIIXXHB4x5km10'
);

async function investigate() {
  // Get all universities
  const { data: universities } = await supabase
    .from('universities')
    .select('*');
  
  // Get unique universityIds from students
  const { data: students } = await supabase
    .from('students')
    .select('universityId');
  
  const uniqueUnivIds = [...new Set(students.map(s => s.universityId))];
  
  console.log('=== CURRENT STATE ===');
  console.log(`Universities in universities table: ${universities.length}`);
  console.log(`Unique universityIds in students table: ${uniqueUnivIds.length}`);
  console.log(`Total students: ${students.length}`);
  
  console.log('\n=== UNIVERSITIES TABLE ===');
  universities.forEach(u => {
    console.log(`- ${u.name} (id: ${u.id})`);
  });
  
  console.log('\n=== STUDENT UNIVERSITY IDs (unique) ===');
  uniqueUnivIds.forEach(id => {
    const count = students.filter(s => s.universityId === id).length;
    console.log(`- ${id} (${count} students)`);
  });
  
  // Check if any match
  const univIds = new Set(universities.map(u => u.id));
  const matches = uniqueUnivIds.filter(id => univIds.has(id));
  console.log(`\n=== MATCHES: ${matches.length} ===`);
  
  if (matches.length === 0) {
    console.log('\n❌ NO MATCHES FOUND - Students reference different IDs than universities table');
    console.log('\nPossible solutions:');
    console.log('1. Add organizationid column to universities table with old IDs');
    console.log('2. Update all students universityId to match new university IDs');
    console.log('3. Create a mapping table');
  }
}

investigate();
