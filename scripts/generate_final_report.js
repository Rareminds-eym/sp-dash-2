const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  line = line.trim();
  if (line && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  }
});

// Initialize Supabase client
const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function generateReport() {
  console.log('='.repeat(80));
  console.log('FINAL RECRUITER DATA REPORT');
  console.log('='.repeat(80));

  // Get all recruiter organizations
  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('type', 'recruiter');

  if (orgError) {
    console.error('Error:', orgError);
    return;
  }

  // Statistics
  const stats = {
    total: orgs.length,
    withEmail: orgs.filter(o => o.email && o.email !== 'null').length,
    withPhone: orgs.filter(o => o.phone).length,
    withWebsite: orgs.filter(o => o.website).length,
    withAddress: orgs.filter(o => o.address).length,
    byCity: {},
    byCompanyType: {}
  };

  orgs.forEach(org => {
    if (org.city) {
      stats.byCity[org.city] = (stats.byCity[org.city] || 0) + 1;
    }
    if (org.companyType) {
      stats.byCompanyType[org.companyType] = (stats.byCompanyType[org.companyType] || 0) + 1;
    }
  });

  console.log('\n📊 OVERALL STATISTICS');
  console.log('─'.repeat(80));
  console.log(`Total Recruiters: ${stats.total}`);
  console.log(`With Email: ${stats.withEmail} (${((stats.withEmail/stats.total)*100).toFixed(1)}%)`);
  console.log(`With Phone: ${stats.withPhone} (${((stats.withPhone/stats.total)*100).toFixed(1)}%)`);
  console.log(`With Website: ${stats.withWebsite} (${((stats.withWebsite/stats.total)*100).toFixed(1)}%)`);
  console.log(`With Address: ${stats.withAddress} (${((stats.withAddress/stats.total)*100).toFixed(1)}%)`);

  console.log('\n📍 TOP 10 LOCATIONS');
  console.log('─'.repeat(80));
  const topCities = Object.entries(stats.byCity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  topCities.forEach(([city, count], idx) => {
    console.log(`${(idx + 1).toString().padStart(2)}. ${city.padEnd(25)} : ${count} recruiters`);
  });

  console.log('\n🏢 TOP 10 INDUSTRIES');
  console.log('─'.repeat(80));
  const topTypes = Object.entries(stats.byCompanyType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  topTypes.forEach(([type, count], idx) => {
    console.log(`${(idx + 1).toString().padStart(2)}. ${type.padEnd(35)} : ${count} companies`);
  });

  console.log('\n✅ SAMPLE RECRUITERS (First 10 with complete data)');
  console.log('─'.repeat(80));
  
  const complete = orgs.filter(o => o.email && o.email !== 'null').slice(0, 10);
  complete.forEach((org, idx) => {
    console.log(`\n${idx + 1}. ${org.name}`);
    console.log(`   Email: ${org.email}`);
    console.log(`   Phone: ${org.phone || 'N/A'}`);
    console.log(`   City: ${org.city || 'N/A'}`);
    console.log(`   Industry: ${org.companyType || 'N/A'}`);
    console.log(`   Website: ${org.website || 'N/A'}`);
  });

  // Save report to file
  const report = {
    generatedAt: new Date().toISOString(),
    statistics: stats,
    topCities: topCities,
    topIndustries: topTypes,
    totalRecruiters: stats.total,
    dataCompleteness: {
      email: `${((stats.withEmail/stats.total)*100).toFixed(1)}%`,
      phone: `${((stats.withPhone/stats.total)*100).toFixed(1)}%`,
      website: `${((stats.withWebsite/stats.total)*100).toFixed(1)}%`,
      address: `${((stats.withAddress/stats.total)*100).toFixed(1)}%`
    }
  };

  fs.writeFileSync('recruiter_final_report.json', JSON.stringify(report, null, 2));

  console.log('\n' + '='.repeat(80));
  console.log('✓ Report saved to: recruiter_final_report.json');
  console.log('='.repeat(80));
}

generateReport()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
