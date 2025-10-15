const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dpooleduinyyzxgrcwko.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwb29sZWR1aW55eXp4Z3Jjd2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk5NDY5OCwiZXhwIjoyMDc1NTcwNjk4fQ.WIrwkA_-2oCjwmD6WpCf5N38hYXEwrIIXXHB4x5km10'
);

async function parseProfiles() {
  // Get students from each unique universityId
  const uniqueIds = [
    '1b0ab392-4fba-4037-ae99-6cdf1e0a232d',
    'f1ed42b6-ffe7-4108-90bb-6776b6504f7b',
    '609f59c9-6894-499b-8479-e826c219e0df'
  ];
  
  for (const univId of uniqueIds) {
    const { data: students } = await supabase
      .from('students')
      .select('profile')
      .eq('universityId', univId)
      .limit(1);
    
    if (students && students.length > 0) {
      try {
        const profile = JSON.parse(students[0].profile.replace(/NaN/g, 'null'));
        console.log(`\n=== University ID: ${univId} ===`);
        console.log('Profile keys:', Object.keys(profile));
        if (profile.university || profile.university_name || profile.institution) {
          console.log('University:', profile.university || profile.university_name || profile.institution);
        }
        console.log('Sample profile:', JSON.stringify(profile, null, 2).substring(0, 300));
      } catch (e) {
        console.log(`Error parsing profile for ${univId}:`, e.message);
      }
    }
  }
}

parseProfiles();
