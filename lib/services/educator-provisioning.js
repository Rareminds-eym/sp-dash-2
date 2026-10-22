import { PLATFORM_ORG_ID } from '../educator-admin';
import { educatorInvitation, generateEducatorPassword } from '../educator-onboarding';

export class EducatorProvisioningError extends Error {
  constructor(message, status = 503, recoveryUserId = null) {
    super(message);
    this.status = status;
    this.recoveryUserId = recoveryUserId;
  }
}

/** SSO and application DB cannot share a transaction; retries reconcile the same SSO identity. */
export async function provisionEducator({ input, actor, database, sso, queue, loginUrl }) {
  const email = input.email.toLowerCase().trim();
  const metadata = input.user_metadata;
  const provenance = { source: 'sp_dashboard_onboarding', portal_mode: 'assigned_trainer',
    onboarding_actor: actor.id, onboarding_request_id: input.requestId, role: 'educator' };
  let ssoUserId;
  let password = null;
  let recovered = false;
  const existing = await sso.getUserByEmail(email);
  if (existing) {
    const identity = await sso.getUserById(existing.id);
    const membership = await sso.getUserMemberships(existing.id);
    const origin = identity?.user_metadata;
    const sameCreation = origin?.source === provenance.source && origin?.portal_mode === provenance.portal_mode &&
      origin?.onboarding_actor === actor.id && origin?.onboarding_request_id === input.requestId;
    const authorizedMembership = membership?.memberships?.some(row => row.org_id === PLATFORM_ORG_ID &&
      row.status === 'active' && (row.roles || []).includes('educator'));
    if (!sameCreation || !authorizedMembership || identity?.is_blocked) {
      throw new EducatorProvisioningError('This email already has an account. Use its existing account-management flow.', 409);
    }
    ssoUserId = existing.id;
    recovered = true;
  } else {
    password = generateEducatorPassword();
    const result = await sso.createMember({ email, password, role: 'educator', org_id: PLATFORM_ORG_ID,
      user_metadata: { ...provenance, must_change_password: true } });
    if (!result?.user_id || result.error) throw new EducatorProvisioningError('SSO could not create the educator account');
    ssoUserId = result.user_id;
  }

  let staff;
  try {
    const userResult = await database.from('users').select('id, metadata').eq('id', ssoUserId).maybeSingle();
    if (userResult.error) throw userResult.error;
    const staffResult = await database.from('organization_staff').select('id, metadata, account_status')
      .eq('user_id', ssoUserId).eq('organization_id', PLATFORM_ORG_ID).maybeSingle();
    if (staffResult.error) throw staffResult.error;
    if (staffResult.data && (staffResult.data.metadata?.onboarding_request_id !== input.requestId ||
        staffResult.data.account_status !== 'active')) {
      throw new EducatorProvisioningError('An existing or inactive staff profile requires explicit administrator review.', 409);
    }
    const userWrite = await database.from('users').upsert({
      id: ssoUserId, email, firstName: metadata.firstName, lastName: metadata.lastName,
      role: 'educator', organizationId: PLATFORM_ORG_ID, isActive: true,
      metadata: { ...userResult.data?.metadata, ...provenance, fullName: `${metadata.firstName} ${metadata.lastName}` },
    }, { onConflict: 'id' });
    if (userWrite.error) throw userWrite.error;
    if (staffResult.data) {
      staff = staffResult.data;
    } else {
      const result = await database.from('organization_staff').insert({
        user_id: ssoUserId, organization_id: PLATFORM_ORG_ID, organization_type: 'rareminds',
        employee_id: metadata.employeeId || null, first_name: metadata.firstName, last_name: metadata.lastName,
        email, phone: metadata.phone || null, address: metadata.address || {},
        role: 'educator', qualification: metadata.qualification || null,
        experience_years: metadata.experienceYears || 0, date_of_joining: metadata.dateOfJoining || null,
        subject_expertise: metadata.subjects || [], account_status: 'active', onboarding_status: 'active',
        verification_status: 'approved', degree_certificate_url: metadata.degreeCertificateUrl || null,
        id_proof_url: metadata.idProofUrl || null, resume_url: metadata.resumeUrl || null,
        photo_url: metadata.photoUrl || null,
        experience_letters_url: metadata.experienceLettersUrl ? [metadata.experienceLettersUrl] : [],
        metadata: { ...metadata, ...provenance,
          facultyRole: metadata.facultyRole || metadata.designation || metadata.platformRole || null,
          department: metadata.department || metadata.customDepartment || null,
          specialization: metadata.specialization || null, invitation_status: 'pending',
          teaching_access_enabled: true, teaching_access_granted_by: actor.id },
        created_by: actor.id,
      }).select('id, metadata').single();
      if (result.error || !result.data) throw result.error || new Error('Staff profile missing');
      staff = result.data;
    }
  } catch (error) {
    if (error instanceof EducatorProvisioningError) throw error;
    throw new EducatorProvisioningError('Identity exists but its staff profile is incomplete. Retry this creation to reconcile it.', 503, ssoUserId);
  }

  let emailStatus = staff.metadata?.invitation_status || 'pending';
  if (password) {
    emailStatus = 'unavailable';
    if (queue) {
      try {
        await queue.send(educatorInvitation(`${metadata.firstName} ${metadata.lastName}`, email, password, loginUrl));
        emailStatus = 'queued';
      } catch { emailStatus = 'failed'; }
    }
  } else if (!['queued', 'reset_requested'].includes(emailStatus)) {
    // A retry cannot recover a plaintext temporary password. Request a fresh reset instead.
    try {
      const reset = await sso.forgotPassword({ email, correlationId: crypto.randomUUID(),
        redirectUrl: new URL('/reset-password', loginUrl).toString() });
      emailStatus = reset?.kind === 'succeeded' && reset.data?.accepted === true
        ? 'reset_requested' : 'reset_required';
    } catch { emailStatus = 'reset_required'; }
  }
  // Invitation result is metadata, not a credential. Failure is returned truthfully even if metadata persistence fails.
  let invitationStatusTracked = false;
  try {
    const tracked = await database.from('organization_staff').update({
      metadata: { ...staff.metadata, invitation_status: emailStatus },
    }).eq('id', staff.id);
    invitationStatusTracked = !tracked.error;
  } catch { /* Delivery result still returned truthfully; never repeat account creation for metadata failure. */ }
  return { staffId: staff.id, authUserId: ssoUserId, email, name: `${metadata.firstName} ${metadata.lastName}`,
    role: 'educator', loginUrl, temporaryPassword: password, emailStatus, recovered,
    provisioningStatus: 'profile_ready', invitationStatusTracked,
    teachingAccessStatus: staff.metadata?.teaching_access_enabled===true?'granted':'pending', message: emailStatus === 'queued'
      ? 'Educator profile created. Credentials email queued.'
      : 'Educator profile created. Check the invitation status before sharing access.' };
}
