import { logAudit } from '@/lib/services/auditService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createRLSClient, getUserContext } from '@/lib/supabase-rls';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function PUT(request) {
  try {
    const { supabase: rlsClient, user, error: authError } = await createRLSClient(request);
    
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userContext = await getUserContext(rlsClient, user);
    
    if (!userContext) {
      return NextResponse.json({ error: 'User context not found' }, { status: 403 });
    }
    
    const body = await request.json();
    const { email, firstName, lastName, organizationName } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // First, find the user by email using RLS client
    const { data: userData, error: userError } = await rlsClient
      .from('users')
      .select('id, organizationId, firstName, lastName')
      .eq('email', email)
      .single();

    if (userError || !userData) {
      console.error('User lookup error:', userError);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log('User found:', { id: userData.id, organizationId: userData.organizationId, firstName: userData.firstName, lastName: userData.lastName });

    // Update user firstName and lastName
    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;

    const { error: updateUserError } = await rlsClient
      .from('users')
      .update(updateData)
      .eq('id', userData.id);

    if (updateUserError) {
      console.error('Error updating user:', updateUserError);
      throw updateUserError;
    }

    console.log('User profile updated successfully');

    // If organizationName is provided and user has an organizationId, update the organization
    // Validate UUID format (UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (organizationName && userData.organizationId && uuidRegex.test(userData.organizationId)) {
      console.log('Attempting to update organization:', userData.organizationId, 'with name:', organizationName);
      
      const { data: orgData, error: updateOrgError } = await supabaseAdmin
        .from('organizations')
        .update({ name: organizationName })
        .eq('id', userData.organizationId)
        .select();

      if (updateOrgError) {
        console.error('Error updating organization:', updateOrgError);
        // Don't throw error here, just log it - user update already succeeded
      } else {
        console.log('Organization updated successfully:', orgData);
      }
    } else {
      console.log('Skipping organization update. organizationId:', userData.organizationId, 'isValidUUID:', userData.organizationId ? uuidRegex.test(userData.organizationId) : false);
    }

    // Log audit
    await logAudit(user.id, 'update_profile', user.id, { firstName, lastName, organizationName });

    return NextResponse.json({ 
      success: true, 
      message: 'Profile updated successfully',
      data: {
        firstName,
        lastName,
        organizationName
      }
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
