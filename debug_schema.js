const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkStateData() {
    console.log('Checking universities state data...');
    const { data, error } = await supabase
        .from('universities')
        .select('state, isactive')
        .limit(10);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Universities Data:', data);

    console.log('\nChecking recruiters state data...');
    const { data: recruiters, error: rError } = await supabase
        .from('recruiters')
        .select('state')
        .limit(10);

    if (rError) {
        console.error('Error:', rError);
        return;
    }
    console.log('Recruiters Data:', recruiters);
}

checkStateData();
