#!/usr/bin/env node
/**
 * LTE Database Connection Verification Script
 * 
 * Checks that both databases are properly configured and connected.
 * Run this before testing the LTE Course Upload feature.
 * 
 * Usage: node scripts/verify-lte-database.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✓ ${message}`, 'green');
}

function error(message) {
  log(`✗ ${message}`, 'red');
}

function warning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function info(message) {
  log(`ℹ ${message}`, 'cyan');
}

function section(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'blue');
  console.log('='.repeat(60));
}

async function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  
  if (!fs.existsSync(envPath)) {
    error('.env.local file not found');
    warning('Please create .env.local based on .env.local.example');
    return {};
  }
  
  success('.env.local file found');
  
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#][^=]*)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      env[key] = value;
    }
  });
  
  return env;
}

async function checkSkillPassportDatabase(env) {
  section('1. SkillPassport Database (Main Database)');
  
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    error('Missing SkillPassport database credentials');
    error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    return false;
  }
  
  info(`URL: ${url}`);
  success('Credentials found');
  
  try {
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // Test connection
    info('Testing connection...');
    const { data, error: connError } = await supabase
      .from('users')
      .select('count')
      .limit(1)
      .single();
    
    if (connError && connError.code !== 'PGRST116') {
      throw connError;
    }
    
    success('Connection successful');
    
    // Check lte_catalog_uploads table
    info('Checking lte_catalog_uploads table...');
    const { error: tableError } = await supabase
      .from('lte_catalog_uploads')
      .select('id')
      .limit(1);
    
    if (tableError) {
      if (tableError.code === '42P01') {
        error('lte_catalog_uploads table does NOT exist');
        warning('Run migrations: cd sso-worker && supabase migration up');
        return false;
      }
      throw tableError;
    }
    
    success('lte_catalog_uploads table exists');
    
    // Check for existing uploads
    const { data: uploads, count } = await supabase
      .from('lte_catalog_uploads')
      .select('*', { count: 'exact', head: true });
    
    info(`Found ${count || 0} existing upload(s)`);
    
    return true;
    
  } catch (err) {
    error(`Connection failed: ${err.message}`);
    return false;
  }
}

async function checkLTEDatabase(env) {
  section('2. LTE Database (Course Catalog)');
  
  const url = env.LTE_SUPABASE_URL || env.SUPABASE_DB_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.LTE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    error('Missing LTE database credentials');
    warning('Set LTE_SUPABASE_URL and LTE_SERVICE_ROLE_KEY (or use fallback)');
    return false;
  }
  
  info(`URL: ${url}`);
  
  if (url === env.NEXT_PUBLIC_SUPABASE_URL) {
    warning('Using same database as SkillPassport (fallback mode)');
    warning('Consider setting up a separate LTE database for production');
  } else {
    success('Using separate LTE database');
  }
  
  try {
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    info('Testing connection...');
    const { error: connError } = await supabase
      .from('roles')
      .select('id')
      .limit(1);
    
    if (connError && connError.code === '42P01') {
      error('LTE tables do NOT exist');
      warning('You need to create the 15 LTE tables:');
      warning('  - roles, capabilities, level_scale, role_capability_sequence');
      warning('  - skills, levels, level_skills, courses, modules');
      warning('  - modules_content, e_content, module_artifacts');
      warning('  - artifact_questions, artifact_templates, artifact_template_questions');
      return false;
    }
    
    if (connError) {
      throw connError;
    }
    
    success('Connection successful');
    
    // Check for the 15 required tables
    const requiredTables = [
      'roles', 'capabilities', 'level_scale', 'role_capability_sequence',
      'skills', 'levels', 'level_skills', 'courses', 'modules',
      'modules_content', 'e_content', 'module_artifacts',
      'artifact_questions', 'artifact_templates', 'artifact_template_questions'
    ];
    
    info('Checking for 15 required LTE tables...');
    let foundCount = 0;
    const missingTables = [];
    
    for (const table of requiredTables) {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (!error || error.code !== '42P01') {
        foundCount++;
      } else {
        missingTables.push(table);
      }
    }
    
    if (foundCount === requiredTables.length) {
      success(`All ${requiredTables.length} LTE tables exist`);
      return true;
    } else {
      warning(`Found ${foundCount}/${requiredTables.length} tables`);
      error(`Missing tables: ${missingTables.join(', ')}`);
      return false;
    }
    
  } catch (err) {
    error(`Connection failed: ${err.message}`);
    return false;
  }
}

async function checkPublishRPC(env) {
  section('3. Publish RPC Function');
  
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    error('Cannot check RPC without SkillPassport credentials');
    return false;
  }
  
  try {
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    info('Checking publish_lte_catalog_snapshot RPC function...');
    
    // Try calling with invalid parameters to see if function exists
    const { error } = await supabase.rpc('publish_lte_catalog_snapshot', {
      p_upload_id: '00000000-0000-0000-0000-000000000000',
      p_published_by: '00000000-0000-0000-0000-000000000000',
      p_expected_snapshot_hash: 'test'
    });
    
    if (error && error.message.includes('could not find')) {
      error('publish_lte_catalog_snapshot RPC does NOT exist');
      warning('Run migration: cd sso-worker && supabase migration up');
      return false;
    }
    
    // Function exists (it will error with upload not found, which is expected)
    success('publish_lte_catalog_snapshot RPC exists');
    return true;
    
  } catch (err) {
    error(`RPC check failed: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('\n');
  log('LTE Database Connection Verification', 'blue');
  log('====================================', 'blue');
  
  const env = await loadEnvFile();
  
  if (Object.keys(env).length === 0) {
    error('\nVerification failed: No environment variables loaded');
    process.exit(1);
  }
  
  const checks = [
    await checkSkillPassportDatabase(env),
    await checkLTEDatabase(env),
    await checkPublishRPC(env)
  ];
  
  section('Summary');
  
  const passed = checks.filter(Boolean).length;
  const total = checks.length;
  
  if (passed === total) {
    success(`All checks passed (${passed}/${total})`);
    success('\n✓ Your LTE database setup is ready!');
    info('\nNext steps:');
    info('  1. Run: npm run dev');
    info('  2. Navigate to: http://localhost:3000/lte-course-upload');
    info('  3. Upload a test XLSX file');
  } else {
    warning(`\nChecks passed: ${passed}/${total}`);
    error('Some checks failed. Please fix the issues above.');
    info('\nSee LTE_DATABASE_SETUP_GUIDE.md for detailed setup instructions.');
  }
  
  console.log('\n');
}

main().catch(err => {
  error(`\nFatal error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
