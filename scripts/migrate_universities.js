const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const supabaseUrl = 'https://dpooleduinyyzxgrcwko.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwb29sZWR1aW55eXp4Z3Jjd2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk5NDY5OCwiZXhwIjoyMDc1NTcwNjk4fQ.WIrwkA_-2oCjwmD6WpCf9N38hYXEwrIIXXHB4x5km10';

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateUniversities() {
  console.log('Starting university data migration from organizations to universities table...\n');

  try {
    // Step 1: Get all universities from organizations table
    const { data: universities, error: fetchError } = await supabase
      .from('organizations')
      .select('*')
      .eq('type', 'university')
      .order('createdAt', { ascending: true });

    if (fetchError) {
      console.error('Error fetching universities from organizations:', fetchError);
      return;
    }

    console.log(`Found ${universities.length} universities in organizations table\n`);

    // Step 2: Check which universities already exist in universities table
    const { data: existingUniversities, error: existingError } = await supabase
      .from('universities')
      .select('organizationid');

    if (existingError) {
      console.error('Error fetching existing universities:', existingError);
      return;
    }

    const existingOrgIds = new Set(existingUniversities.map(u => u.organizationid));
    console.log(`Found ${existingOrgIds.size} universities already in universities table\n`);

    // Step 3: Prepare data for insertion (only new universities)
    const universitiesToInsert = [];
    const skippedUniversities = [];

    for (const org of universities) {
      if (existingOrgIds.has(org.id)) {
        skippedUniversities.push(org.name);
        continue;
      }

      universitiesToInsert.push({
        id: uuidv4(),
        organizationid: org.id,
        name: org.name,
        email: org.email || null,
        phone: org.phone || null,
        state: org.state || null,
        district: org.district || null,
        website: org.website || null,
        verificationstatus: org.verificationStatus || 'pending',
        isactive: org.isActive !== undefined ? org.isActive : true,
        createdat: org.createdAt || new Date().toISOString(),
        updatedat: org.updatedAt || new Date().toISOString()
      });
    }

    console.log(`Universities to migrate: ${universitiesToInsert.length}`);
    console.log(`Universities already migrated (skipped): ${skippedUniversities.length}`);
    
    if (skippedUniversities.length > 0) {
      console.log('\nSkipped universities (already exist):');
      skippedUniversities.forEach(name => console.log(`  - ${name}`));
    }

    // Step 4: Insert new universities into universities table
    if (universitiesToInsert.length > 0) {
      console.log('\nInserting new universities...');
      
      const { data: insertedData, error: insertError } = await supabase
        .from('universities')
        .insert(universitiesToInsert)
        .select();

      if (insertError) {
        console.error('Error inserting universities:', insertError);
        return;
      }

      console.log(`\n✅ Successfully inserted ${insertedData.length} universities into universities table\n`);
      
      console.log('Migrated universities:');
      insertedData.forEach((univ, index) => {
        console.log(`  ${index + 1}. ${univ.name} (${univ.state || 'No state'})`);
      });
    } else {
      console.log('\n✅ No new universities to migrate. All universities already exist in the universities table.\n');
    }

    // Step 5: Verify final counts
    const { data: finalUniversities, error: finalError } = await supabase
      .from('universities')
      .select('id');

    if (finalError) {
      console.error('Error verifying final count:', finalError);
      return;
    }

    console.log(`\n📊 Final Count:`);
    console.log(`   - Universities in organizations table: ${universities.length}`);
    console.log(`   - Universities in universities table: ${finalUniversities.length}`);
    console.log(`   - Migration complete: ${finalUniversities.length === universities.length ? '✅ YES' : '❌ NO (counts don\'t match)'}`);

  } catch (error) {
    console.error('Migration error:', error);
  }
}

// Run the migration
migrateUniversities().then(() => {
  console.log('\nMigration process completed.');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
