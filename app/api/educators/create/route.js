import { NextResponse } from 'next/server';

/**
 * Generate a secure random password
 */
function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Simple HTML escape for attributes
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Build faculty invitation email template (copied from SSO Worker)
 * Provides temporary password for immediate login
 */
function buildFacultyInvitationEmail(name, email, temp_password, loginUrl) {
  return {
    subject: 'Welcome to SkillPassport - Your Faculty Account is Ready!',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to SkillPassport</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto;">
      <h2>Welcome to SkillPassport!</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>Your faculty account has been created by your institution.</p>

      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Login Details:</h3>
        <p><strong>Portal:</strong> <a href="${escapeHtml(loginUrl)}">${loginUrl}</a></p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Temporary Password:</strong> <code style="background: #fff; padding: 4px 8px; border-radius: 3px; font-family: monospace; font-size: 14px;">${escapeHtml(temp_password)}</code></p>
      </div>

      <p style="font-size: 14px; color: #666;"><strong>Important:</strong> Please change your temporary password after first login.</p>

      <p>Best regards,<br>SkillPassport Team</p>
    </div>
        </body>
      </html>
  `,
    text: `Welcome to SkillPassport!

Hi ${name},

Your faculty account has been created by your institution.

Login Details:
Portal: ${loginUrl}
Email: ${email}
Temporary Password: ${temp_password}

Important: Please change your temporary password after first login.

Best regards,
SkillPassport Team`,
  };
}

/**
 * POST /api/educators/create
 * Create a new educator using SSO Worker + send credentials email (like SkillPassport)
 * NO verification needed - credentials sent directly!
 */
export async function POST(request) {
  console.log('🎓 [CREATE EDUCATOR API] POST /api/educators/create started')
  
  try {
    const body = await request.json();
    console.log('🎓 [CREATE EDUCATOR API] Request body:', {
      email: body.email,
      org_id: body.org_id,
      hasMetadata: !!body.user_metadata
    })

    // Validate required fields
    if (!body.email || !body.user_metadata) {
      console.error('❌ [CREATE EDUCATOR API] Missing required fields')
      return NextResponse.json({ 
        error: 'Missing required fields: email and user_metadata' 
      }, { status: 400 });
    }

    const metadata = body.user_metadata;
    
    // Validate metadata has required fields
    if (!metadata.firstName || !metadata.lastName) {
      console.error('❌ [CREATE EDUCATOR API] Missing name in metadata')
      return NextResponse.json({ 
        error: 'Missing required fields: firstName and lastName in user_metadata' 
      }, { status: 400 });
    }

    // Get Cloudflare context for service bindings
    console.log('🎓 [CREATE EDUCATOR API] Getting Cloudflare context...')
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = await getCloudflareContext({ async: true });
    
    if (!env.SSO) {
      console.error('❌ [CREATE EDUCATOR API] SSO service binding not available')
      return NextResponse.json({ 
        error: 'SSO service binding not configured' 
      }, { status: 500 });
    }

    console.log('🎓 [CREATE EDUCATOR API] Generating password and calling SSO.createMember()...')

    // Generate password (like SkillPassport does)
    const staffPassword = generatePassword();

    // Determine SSO role based on organization type
    // RareMinds trainers (external educators) → 'educator'
    // College faculty → 'college_educator' or 'college_admin'
    let ssoRole;
    if (body.org_id === '00000000-0000-0000-0000-000000000001') {
      // RareMinds Platform organization → ALL roles use 'educator' (except admin)
      // This includes: Trainer, Educator, Platform Staff, etc.
      ssoRole = 'educator'; // Default: all RareMinds staff are 'educator' role in SSO
    } else {
      // Other organizations → use college-specific roles
      ssoRole = metadata.facultyRole === 'college_admin' ? 'college_admin' : 'college_educator';
    }

    // Call sso-worker createMember via service binding (RPC)
    // NOTE: Using Platform org UUID so SSO Worker validation passes
    // The actual organization is stored in organization_staff.organization_id below
    console.log('🎓 [CREATE EDUCATOR API] Selected org_id from form:', body.org_id)
    console.log('🎓 [CREATE EDUCATOR API] Sending Platform org UUID to SSO Worker')
    
    const result = await env.SSO.createMember({
      email: body.email.toLowerCase(),
      password: staffPassword,
      role: ssoRole,
      org_id: '00000000-0000-0000-0000-000000000001' // Platform org UUID
    });

    console.log('🎓 [CREATE EDUCATOR API] SSO createMember result:', JSON.stringify(result, null, 2))

    // Check if SSO returned an error
    if (result.error) {
      console.error('❌ [CREATE EDUCATOR API] SSO createMember error:', result.error)
      return NextResponse.json({ 
        error: result.error,
        details: result.error
      }, { status: result.status || 500 });
    }

    // Validate user ID exists in response (createMember returns { user_id, org_id, membership_id })
    if (!result.user_id) {
      console.error('❌ [CREATE EDUCATOR API] SSO response missing user_id:', result)
      throw new Error('SSO createMember did not return user_id');
    }

    const ssoUserId = result.user_id;
    console.log('✅ [CREATE EDUCATOR API] User created with ID:', ssoUserId)
    
    // ============================================================================
    // Send CREDENTIALS EMAIL (like SkillPassport handleCreateCollegeStaff!)
    // ============================================================================
    console.log('📧 [CREATE EDUCATOR API] Preparing to send credentials email...')
    
    const loginUrl = process.env.NEXT_PUBLIC_BASE_URL 
      ? `${process.env.NEXT_PUBLIC_BASE_URL}/login` 
      : 'http://localhost:3000/login';
    
    const fullName = `${metadata.firstName} ${metadata.lastName}`;
    const emailTemplate = buildFacultyInvitationEmail(
      fullName,
      body.email.toLowerCase(),
      staffPassword, // 👈 PASSWORD INCLUDED!
      loginUrl
    );
    
    // Send email via EMAIL_QUEUE (if available)
    if (env.EMAIL_QUEUE) {
      console.log('📧 [CREATE EDUCATOR API] EMAIL_QUEUE available, queuing credentials email...')
      try {
        await env.EMAIL_QUEUE.send({
          type: 'send-email',
          to: body.email.toLowerCase(),
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          text: emailTemplate.text
        });
        console.log('✅ [CREATE EDUCATOR API] Credentials email queued successfully!')
      } catch (emailError) {
        console.error('❌ [CREATE EDUCATOR API] Failed to queue email:', emailError);
        // Don't block - admin still sees password on screen
      }
    } else {
      console.warn('⚠️ [CREATE EDUCATOR API] EMAIL_QUEUE not available')
    }

    // ============================================================================
    // Insert into organization_staff table
    // ============================================================================
    try {
      console.log('📊 [CREATE EDUCATOR API] Inserting into organization_staff table...')
      
      const { supabaseAdmin } = await import('@/lib/supabase-admin');
      
      // Determine organization type from org_id
      // sp-dash-2 is used ONLY by RareMinds admin to create RareMinds trainers
      let organizationType = 'rareminds'; // Default for sp-dash-2
      
      // If for some reason a different org_id is provided, look it up
      if (body.org_id && body.org_id !== '00000000-0000-0000-0000-000000000001') {
        const { data: org } = await supabaseAdmin
          .from('organizations')
          .select('type, organization_type')
          .eq('id', body.org_id)
          .single();
        
        // Use type or organization_type column (different schemas use different names)
        organizationType = org?.type || org?.organization_type || 'rareminds';
      }
      
      // ============================================================================
      // STEP 1: Create shadow users row (required for FK constraint!)
      // The SSO user exists in SSO Worker's DB, but organization_staff needs a 
      // users row in SP-Dashboard's DB (SkillPassport DB) as a FK target
      // ============================================================================
      console.log('👤 [CREATE EDUCATOR API] Creating shadow users row...')
      
      // Check if user already exists (in case of retry)
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id', ssoUserId)
        .maybeSingle();
      
      if (existingUser) {
        console.log('✅ [CREATE EDUCATOR API] Shadow users row already exists');
      } else {
        const { data: newUser, error: userInsertError } = await supabaseAdmin
          .from('users')
          .insert({
            id: ssoUserId, // Same ID as SSO user
            email: body.email.toLowerCase(),
            firstName: metadata.firstName,
            lastName: metadata.lastName,
            role: ssoRole, // college_admin or college_educator
            organizationId: body.org_id,
            isActive: true,
            metadata: {
              source: 'sp_dashboard_onboarding',
              addedBy: 'admin',
              facultyRole: metadata.facultyRole,
              entityType: 'college_staff',
              fullName: fullName
            }
          })
          .select()
          .single();
        
        if (userInsertError) {
          console.error('❌ [CREATE EDUCATOR API] Error creating shadow users row:', userInsertError);
          console.error('❌ [CREATE EDUCATOR API] Error code:', userInsertError.code);
          console.error('❌ [CREATE EDUCATOR API] Error details:', userInsertError.details);
          console.error('❌ [CREATE EDUCATOR API] Error message:', userInsertError.message);
          throw new Error(`Failed to create shadow users row: ${userInsertError.message}`);
        } else {
          console.log('✅ [CREATE EDUCATOR API] Shadow users row created:', newUser?.id);
          
          // Double-check it was actually inserted
          const { data: verifyUser } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('id', ssoUserId)
            .single();
          
          if (!verifyUser) {
            console.error('❌ [CREATE EDUCATOR API] Shadow users row verification FAILED - user not found after insert!');
            throw new Error('Shadow users row was not persisted in database');
          }
          console.log('✅ [CREATE EDUCATOR API] Shadow users row verified in database');
        }
      }
      
      // Prepare address JSONB
      const address = metadata.address || {};
      
      // ============================================================================
      // STEP 2: Insert into organization_staff (now FK constraint will pass!)
      // ============================================================================
      console.log('📊 [CREATE EDUCATOR API] Inserting into organization_staff...')
      const { data: staffRecord, error: staffError } = await supabaseAdmin
        .from('organization_staff')
        .insert({
          user_id: ssoUserId,
          organization_id: body.org_id,
          organization_type: organizationType,
          employee_id: metadata.employeeId,
          first_name: metadata.firstName,
          last_name: metadata.lastName,
          email: body.email.toLowerCase(),
          phone: metadata.phone,
          date_of_birth: metadata.dateOfBirth || null,
          gender: metadata.gender || null,
          address: address,
          designation: metadata.facultyRole || metadata.designation,
          department: metadata.department || metadata.customDepartment,
          role: ssoRole,
          specialization: metadata.specialization,
          qualification: metadata.qualification,
          experience_years: metadata.experienceYears || 0,
          date_of_joining: metadata.dateOfJoining,
          subject_expertise: metadata.subjects || [],
          account_status: 'active',
          onboarding_status: 'active', // ✅ Changed from 'completed' to 'active'
          verification_status: 'verified',
          degree_certificate_url: metadata.degreeCertificateUrl,
          id_proof_url: metadata.idProofUrl,
          resume_url: metadata.resumeUrl || null,
          photo_url: metadata.photoUrl || null,
          experience_letters_url: metadata.experienceLettersUrl ? [metadata.experienceLettersUrl] : [],
          metadata: metadata,
          created_by: ssoUserId
        })
        .select()
        .single();
      
      if (staffError) {
        console.error('❌ [CREATE EDUCATOR API] Error inserting into organization_staff:', staffError);
        // Don't fail - user already created
      } else {
        console.log('✅ [CREATE EDUCATOR API] Inserted into organization_staff:', staffRecord?.id);
      }
      
    } catch (staffInsertError) {
      console.error('❌ [CREATE EDUCATOR API] organization_staff insert failed:', staffInsertError);
      // Continue - user already created
    }

    console.log('✅ [CREATE EDUCATOR API] Educator creation completed successfully!')

    return NextResponse.json({
      success: true,
      data: {
        authUserId: ssoUserId,
        email: body.email.toLowerCase(),
        name: fullName,
        password: staffPassword, // Return password for UI display as backup
        role: ssoRole,
        message: 'Educator created successfully! Credentials email sent.'
      }
    });

  } catch (error) {
    console.error('❌ [CREATE EDUCATOR API] Error:', error);
    console.error('❌ [CREATE EDUCATOR API] Error message:', error.message);
    
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 });
  }
}
