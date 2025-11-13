const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/app/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testRecruiterAPI() {
  console.log('Testing Recruiter API...\n');
  
  // Get first recruiter
  const { data: recruiters, error } = await supabase
    .from('recruiters')
    .select('*')
    .limit(2);
  
  if (error) {
    console.error('Error fetching recruiter:', error);
    return;
  }
  
  if (!recruiters || recruiters.length === 0) {
    console.log('No recruiters found');
    return;
  }
  
  const recruiter = recruiters[0];
  console.log('Found recruiter:', recruiter.id, recruiter.name);
  console.log('Current status:', recruiter.approval_status);
  
  // Update to pending
  const { data: updated, error: updateError } = await supabase
    .from('recruiters')
    .update({ approval_status: 'pending' })
    .eq('id', recruiter.id)
    .select();
  
  if (updateError) {
    console.error('Error updating:', updateError);
    return;
  }
  
  console.log('\n✅ Updated recruiter to pending status');
  console.log('ID:', recruiter.id);
  
  console.log('\n🎯 Now check the approval center in the UI - the Recruiters tab should show 1 pending approval!');
  console.log('\n📌 To revert after testing, run this command:');
  console.log(`   cd /app && node -e "require('dotenv').config({path:'.env.local'});const{createClient}=require('@supabase/supabase-js');createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY).from('recruiters').update({approval_status:'approved'}).eq('id','${recruiter.id}').then(()=>console.log('✅ Reverted'))"`);
}

testRecruiterAPI();
