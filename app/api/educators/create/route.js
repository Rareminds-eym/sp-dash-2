import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { PLATFORM_ORG_ID, requireEducatorAdmin } from '@/lib/educator-admin';
import { educatorLoginUrl } from '@/lib/educator-onboarding';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { EducatorProvisioningError, provisionEducator } from '@/lib/services/educator-provisioning';

const optionalText = z.string().trim().max(255).nullable().optional();
const inputSchema = z.object({
  requestId: z.string().uuid(), email: z.string().trim().email().max(254),
  org_id: z.literal(PLATFORM_ORG_ID),
  user_metadata: z.object({
    firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100),
    employeeId: optionalText, phone: optionalText, platformRole: optionalText,
    facultyRole: optionalText, designation: optionalText, department: optionalText,
    customDepartment: optionalText, specialization: optionalText, qualification: optionalText,
    experienceYears: z.number().int().min(0).max(100).optional(),
    dateOfJoining: z.union([z.string().date(), z.literal('')]).optional(),
    subjects: z.array(z.object({ subjectName: z.string().trim().min(1).max(100),
      level: z.string().max(50), yearsOfExperience: z.coerce.number().min(0).max(100) })).max(100).optional(),
    degreeCertificateUrl: z.string().url().nullable().optional(), idProofUrl: z.string().url().nullable().optional(),
    experienceLettersUrl: z.string().url().nullable().optional(), resumeUrl: z.string().url().nullable().optional(),
    photoUrl: z.string().url().nullable().optional(),
    address: z.record(z.string().max(255)).optional(),
  }),
});

/** Platform trainers only. College faculty continue using college staff onboarding. */
export async function POST(request) {
  const auth = await requireEducatorAdmin(request);
  if (auth.error) return auth.error;
  let input;
  try { input = inputSchema.parse(await request.json()); }
  catch { return NextResponse.json({ error: 'Invalid educator details or creation reference' }, { status: 400 }); }
  try {
    const { env } = await getCloudflareContext({ async: true });
    if (!env.SSO) return NextResponse.json({ error: 'SSO service binding not configured' }, { status: 503 });
    const loginUrl = educatorLoginUrl(env.SKILLPASSPORT_LOGIN_URL || process.env.SKILLPASSPORT_LOGIN_URL);
    const data = await provisionEducator({ input, actor: auth.user, database: supabaseAdmin,
      sso: env.SSO, queue: env.EMAIL_QUEUE, loginUrl });
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof EducatorProvisioningError) {
      return NextResponse.json({ error: error.message, recoveryUserId: error.recoveryUserId,
        recoveryRequired: Boolean(error.recoveryUserId) }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
    }
    // Never log an RPC response/error that might contain generated credentials.
    return NextResponse.json({ error: 'Educator onboarding could not complete. Check service configuration and retry.' }, { status: 503 });
  }
}
