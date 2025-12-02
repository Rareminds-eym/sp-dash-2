const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRecruiter() {
    console.log('Checking for Test Recruiter...');
    const { data, error } = await supabase
        .from('recruiters')
        .select('*')
        .eq('email', 'test@example.com');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Recruiters found:', data);
}

checkRecruiter();
