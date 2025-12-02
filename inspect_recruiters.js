const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectRecruiters() {
    console.log('Fetching one recruiter to inspect schema...');
    const { data, error } = await supabase
        .from('recruiters')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Recruiter Schema Keys:', Object.keys(data[0]));
        console.log('Sample Data:', data[0]);
    } else {
        console.log('No recruiters found. Cannot inspect schema from data.');
        // If no data, I might need to check if I can insert a dummy one or just guess/ask.
        // Or I can try to infer from code if there's any existing usage.
    }
}

inspectRecruiters();
