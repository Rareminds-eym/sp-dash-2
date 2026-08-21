/**
 * Verify LTE Data in Local Database
 * 
 * This script checks what data exists in your local LTE database tables
 * and provides a summary of record counts.
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const LTE_URL = process.env.LTE_SUPABASE_URL;
const LTE_KEY = process.env.LTE_SERVICE_ROLE_KEY;

if (!LTE_URL || !LTE_KEY) {
  console.error('❌ Missing LTE database credentials in .env.local');
  console.error('   LTE_SUPABASE_URL:', LTE_URL ? '✓' : '✗');
  console.error('   LTE_SERVICE_ROLE_KEY:', LTE_KEY ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(LTE_URL, LTE_KEY);

const LTE_TABLES = [
  'roles',
  'capabilities',
  'level_scale',
  'role_capability_sequence',
  'skills',
  'levels',
  'level_skills',
  'courses',
  'modules',
  'modules_content',
  'e_content',
  'module_artifacts',
  'artifact_questions',
  'artifact_templates',
  'artifact_template_questions',
];

async function verifyLTEData() {
  console.log('\n🔍 Verifying LTE Database Data\n');
  console.log('Connected to:', LTE_URL);
  console.log('─'.repeat(70));

  let totalRecords = 0;
  const results = [];

  for (const table of LTE_TABLES) {
    try {
      // Get count
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        results.push({
          table,
          count: 'ERROR',
          status: '❌',
          message: error.message,
        });
      } else {
        const recordCount = count || 0;
        totalRecords += recordCount;
        results.push({
          table,
          count: recordCount,
          status: recordCount > 0 ? '✓' : '○',
          message: recordCount > 0 ? 'Has data' : 'Empty',
        });
      }
    } catch (err) {
      results.push({
        table,
        count: 'ERROR',
        status: '❌',
        message: err.message,
      });
    }
  }

  // Print results
  console.log('\n📊 Table Summary:\n');
  results.forEach(({ table, count, status, message }) => {
    const countStr = typeof count === 'number' ? count.toString().padStart(6) : count.padStart(6);
    console.log(`${status} ${table.padEnd(30)} ${countStr} rows  ${message}`);
  });

  console.log('\n' + '─'.repeat(70));
  console.log(`Total records across all tables: ${totalRecords.toLocaleString()}`);
  console.log('─'.repeat(70));

  // Get sample courses
  console.log('\n📚 Sample Courses (first 5):\n');
  const { data: courses, error: coursesError } = await supabase
    .from('courses')
    .select('id, code, title, level_no')
    .limit(5);

  if (coursesError) {
    console.error('❌ Error fetching courses:', coursesError.message);
  } else if (!courses || courses.length === 0) {
    console.log('○ No courses found');
  } else {
    courses.forEach((course, i) => {
      console.log(`${i + 1}. [${course.code}]`);
      console.log(`   Title: ${course.title}`);
      console.log(`   Level: ${course.level_no}`);
      console.log(`   ID: ${course.id}`);
      console.log('');
    });
  }

  // Get sample modules
  console.log('\n📦 Sample Modules (first 5):\n');
  const { data: modules, error: modulesError } = await supabase
    .from('modules')
    .select('id, name, sequence_no, course_id')
    .limit(5);

  if (modulesError) {
    console.error('❌ Error fetching modules:', modulesError.message);
  } else if (!modules || modules.length === 0) {
    console.log('○ No modules found');
  } else {
    modules.forEach((module, i) => {
      console.log(`${i + 1}. ${module.name} (Sequence: ${module.sequence_no})`);
      console.log(`   Course ID: ${module.course_id}`);
      console.log(`   Module ID: ${module.id}`);
      console.log('');
    });
  }

  // Check upload records
  console.log('\n📋 Recent Uploads:\n');
  const { data: uploads, error: uploadsError } = await supabase
    .from('lte_catalog_uploads')
    .select('id, status, uploaded_at, published_at, publish_summary')
    .order('uploaded_at', { ascending: false })
    .limit(5);

  if (uploadsError) {
    console.error('❌ Error fetching uploads:', uploadsError.message);
  } else if (!uploads || uploads.length === 0) {
    console.log('○ No upload records found');
  } else {
    uploads.forEach((upload, i) => {
      console.log(`${i + 1}. Upload ID: ${upload.id.substring(0, 8)}...`);
      console.log(`   Status: ${upload.status}`);
      console.log(`   Uploaded: ${new Date(upload.uploaded_at).toLocaleString()}`);
      if (upload.published_at) {
        console.log(`   Published: ${new Date(upload.published_at).toLocaleString()}`);
      }
      if (upload.publish_summary) {
        console.log(`   Summary: ${upload.publish_summary.inserted || 0} inserted, ${upload.publish_summary.skipped || 0} skipped`);
      }
      console.log('');
    });
  }

  console.log('\n✅ Verification complete!\n');
}

verifyLTEData().catch((error) => {
  console.error('\n❌ Verification failed:', error);
  process.exit(1);
});
