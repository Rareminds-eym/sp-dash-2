import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request) {
  try {
    // Initialize Supabase with service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('Starting schema migration...');

    // Test connection
    const { data: testData, error: testError } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);

    if (testError) {
      throw new Error(`Database connection failed: ${testError.message}`);
    }

    // Since we can't execute raw SQL via the client, we'll use a workaround:
    // Try to insert a test record with the new columns to see if they exist
    const testOrgId = 'test-schema-check-' + Date.now();
    
    const { error: insertError } = await supabase
      .from('organizations')
      .insert({
        id: testOrgId,
        name: 'Schema Test Org',
        type: 'recruiter',
        phone: 'test',
        website: 'test',
        address: 'test',
        city: 'test',
        email: 'test@test.com',
        companyType: 'test'
      });

    // Clean up test record
    if (!insertError) {
      await supabase
        .from('organizations')
        .delete()
        .eq('id', testOrgId);
    }

    if (insertError) {
      // Check if error is about missing columns
      if (insertError.message.includes('column') && insertError.message.includes('does not exist')) {
        return NextResponse.json({
          success: false,
          needsMigration: true,
          message: 'Database schema needs to be updated. Please run the SQL migration in Supabase SQL Editor.',
          sqlFile: '/scripts/schema_migration.sql',
          error: insertError.message
        }, { status: 400 });
      }
      
      throw insertError;
    }

    // If we get here, all columns exist
    return NextResponse.json({
      success: true,
      message: 'Schema is up to date. All required columns exist.',
      columns: ['phone', 'website', 'address', 'city', 'email', 'companyType']
    });

  } catch (error) {
    console.error('Schema check error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET(request) {
  return NextResponse.json({
    message: 'Schema migration endpoint',
    instructions: 'POST to this endpoint to check if schema migration is needed',
    sqlFile: 'See /scripts/schema_migration.sql for the SQL commands'
  });
}
