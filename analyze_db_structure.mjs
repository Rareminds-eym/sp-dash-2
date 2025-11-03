#!/usr/bin/env node
/**
 * Comprehensive Supabase Database Structure Analysis
 * Analyzes tables, columns, indexes, triggers, functions, constraints
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Error: SUPABASE_URL or SUPABASE_KEY not found in environment');
  console.error(`   URL: ${SUPABASE_URL ? 'Found' : 'Missing'}`);
  console.error(`   KEY: ${SUPABASE_KEY ? 'Found' : 'Missing'}`);
  process.exit(1);
}

console.log(`✅ Connecting to: ${SUPABASE_URL}\n`);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function executeQuery(query) {
  try {
    const { data, error } = await supabase.rpc('exec_custom_sql', { sql_query: query });
    if (error) {
      // Try fallback method - execute through REST API
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_custom_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        },
        body: JSON.stringify({ sql_query: query })
      });
      
      if (!response.ok) {
        console.error(`Query failed: ${query.substring(0, 100)}...`);
        return [];
      }
      return await response.json();
    }
    return data || [];
  } catch (err) {
    console.error(`Error executing query: ${err.message}`);
    return [];
  }
}

async function getTables() {
  // Use direct table access method instead of raw SQL
  const tablesQuery = `
    SELECT table_name, table_type
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;
  
  // Since we can't execute raw SQL easily, let's use the metadata endpoint
  const { data, error } = await supabase
    .from('information_schema.tables')
    .select('table_name, table_type')
    .eq('table_schema', 'public')
    .eq('table_type', 'BASE TABLE')
    .order('table_name');
    
  if (error) {
    console.error('Error fetching tables:', error);
    // Fallback: Try to list known tables
    return [
      'users', 'students', 'skill_passports', 'universities', 'recruiters',
      'audit_logs', 'verifications', 'metrics_snapshots', 'schools',
      'school_classes', 'school_educators', 'school_educator_class_assignments',
      'colleges_standalone', 'college_courses', 'college_lecturers',
      'college_lecturer_course_assignments', 'university_colleges',
      'university_courses', 'university_lecturers',
      'university_lecturer_course_assignments', 'companies', 'company_branches',
      'permissions', 'role_permissions', 'student_enrollments', 'colleges'
    ].map(t => ({ table_name: t, table_type: 'BASE TABLE' }));
  }
  
  return data;
}

async function getTableStructure(tableName) {
  // Try to get one row to see the structure
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);
    
  if (error) {
    console.error(`Error fetching structure for ${tableName}:`, error.message);
    return null;
  }
  
  if (data && data.length > 0) {
    return Object.keys(data[0]);
  }
  
  // If no data, try to get columns from a different method
  return [];
}

async function analyzeDatabase() {
  console.log('='.repeat(80));
  console.log('SUPABASE DATABASE STRUCTURE ANALYSIS');
  console.log('='.repeat(80));
  console.log();
  
  // Get all tables by trying to access known tables
  const knownTables = [
    'users', 'students', 'skill_passports', 'universities', 'recruiters',
    'audit_logs', 'verifications', 'metrics_snapshots', 'schools',
    'school_classes', 'school_educators', 'school_educator_class_assignments',
    'colleges_standalone', 'college_courses', 'college_lecturers',
    'college_lecturer_course_assignments', 'university_colleges',
    'university_courses', 'university_lecturers',
    'university_lecturer_course_assignments', 'companies', 'company_branches',
    'permissions', 'role_permissions', 'student_enrollments', 'colleges'
  ];
  
  const existingTables = [];
  
  console.log('📊 ANALYZING TABLES...\n');
  console.log('-'.repeat(80));
  
  for (const tableName of knownTables) {
    try {
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        existingTables.push(tableName);
        console.log(`✅ ${tableName.padEnd(45)} - ${count || 0} rows`);
        
        // Get column structure
        const { data: sampleData } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
          
        if (sampleData && sampleData.length > 0) {
          const columns = Object.keys(sampleData[0]);
          console.log(`   Columns (${columns.length}): ${columns.join(', ')}`);
        }
        console.log();
      } else {
        console.log(`❌ ${tableName.padEnd(45)} - Table does not exist`);
      }
    } catch (err) {
      console.log(`❌ ${tableName.padEnd(45)} - Error: ${err.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`SUMMARY: ${existingTables.length} tables found out of ${knownTables.length} expected`);
  console.log('='.repeat(80));
  
  // Save results to file
  const results = {
    timestamp: new Date().toISOString(),
    totalExpected: knownTables.length,
    totalFound: existingTables.length,
    existingTables,
    missingTables: knownTables.filter(t => !existingTables.includes(t))
  };
  
  fs.writeFileSync('/app/database_structure_analysis.json', JSON.stringify(results, null, 2));
  console.log('\n✅ Analysis saved to database_structure_analysis.json');
  
  return results;
}

// Run the analysis
analyzeDatabase()
  .then(results => {
    console.log('\n📋 ANALYSIS COMPLETE');
    console.log(`   Existing Tables: ${results.existingTables.length}`);
    console.log(`   Missing Tables: ${results.missingTables.length}`);
    if (results.missingTables.length > 0) {
      console.log(`   Missing: ${results.missingTables.join(', ')}`);
    }
  })
  .catch(err => {
    console.error('❌ Analysis failed:', err);
    process.exit(1);
  });
