const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dpooleduinyyzxgrcwko.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwb29sZWR1aW55eXp4Z3Jjd2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk5NDY5OCwiZXhwIjoyMDc1NTcwNjk4fQ.WIrwkA_-2oCjwmD6WpCf9N38hYXEwrIIXXHB4x5km10'
);

async function createMapping() {
  // Get all universities from universities table
  const { data: universities } = await supabase
    .from('universities')
    .select('id, name');
  
  // Get unique universityIds from students
  const { data: students } = await supabase
    .from('students')
    .select('universityId, profile');
  
  const uniqueIds = [...new Set(students.map(s => s.universityId))];
  
  console.log('=== CREATING MAPPING ===\n');
  
  const mapping = {};
  
  for (const oldId of uniqueIds) {
    // Get a sample student with this universityId
    const student = students.find(s => s.universityId === oldId);
    if (student && student.profile) {
      try {
        const profile = JSON.parse(student.profile.replace(/NaN/g, 'null'));
        const univName = profile.university;
        
        if (univName) {
          // Find matching university in universities table
          const match = universities.find(u => 
            u.name.toLowerCase().includes(univName.toLowerCase()) ||
            univName.toLowerCase().includes(u.name.toLowerCase())
          );
          
          if (match) {
            mapping[oldId] = {
              newId: match.id,
              name: match.name,
              profileName: univName
            };
            console.log(`✅ ${oldId} → ${match.id}`);
            console.log(`   "${univName}" matched to "${match.name}"`);
          } else {
            console.log(`❌ ${oldId} - No match for "${univName}"`);
          }
        }
      } catch (e) {
        console.log(`Error parsing profile for ${oldId}`);
      }
    }
  }
  
  console.log('\n=== MAPPING SUMMARY ===');
  console.log(`Total old IDs: ${uniqueIds.length}`);
  console.log(`Mapped: ${Object.keys(mapping).length}`);
  console.log(`Unmapped: ${uniqueIds.length - Object.keys(mapping).length}`);
  
  console.log('\n=== MAPPING JSON ===');
  console.log(JSON.stringify(mapping, null, 2));
  
  return mapping;
}

createMapping();
