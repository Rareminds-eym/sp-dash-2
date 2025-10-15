const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dpooleduinyyzxgrcwko.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwb29sZWR1aW55eXp4Z3Jjd2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk5NDY5OCwiZXhwIjoyMDc1NTcwNjk4fQ.WIrwkA_-2oCjwmD6WpCf9N38hYXEwrIIXXHB4x5km10'
);

async function listAll() {
  // Get all universities
  const { data: univs, error: univError } = await supabase
    .from('universities')
    .select('id, name');
  
  // Get sample students with their university IDs
  const { data: students, error: studError } = await supabase
    .from('students')
    .select('id, universityId')
    .limit(5);
  
  console.log('Universities in universities table:');
  console.log(JSON.stringify(univs, null, 2));
  
  console.log('\n\nSample students with universityId:');
  console.log(JSON.stringify(students, null, 2));
  
  // Check if any student universityId matches any university id
  const univIds = new Set(univs.map(u => u.id));
  const studentUnivIds = new Set(students.map(s => s.universityId));
  const matches = [...studentUnivIds].filter(id => univIds.has(id));
  
  console.log('\n\nMatching IDs:', matches.length > 0 ? matches : 'NONE');
}

listAll();
