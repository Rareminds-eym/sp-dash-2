import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { handleError, notFoundError } from '@/lib/middleware/errorHandler';

export const runtime = 'edge';

/**
 * GET /api/recruiters/:id - Get single recruiter details with audit history
 */
export async function GET(request, { params }) {
  try {
    const recruiterId = params.id;
    
    // Fetch recruiter details
    const { data: recruiter, error } = await supabase
      .from('recruiters')
      .select('*')
      .eq('id', recruiterId)
      .single();
    
    if (error || !recruiter) {
      return notFoundError('Recruiter');
    }
    
    // Fetch user count
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('organizationId', recruiterId);
    
    // Fetch audit history for this recruiter
    const { data: auditLogs } = await supabase
      .from('audit_logs')
      .select('*, users!inner(email)')
      .eq('target', recruiterId)
      .order('timestamp', { ascending: false })
      .limit(20);
    
    // Fetch verification history
    const { data: verifications } = await supabase
      .from('verifications')
      .select('*, users!inner(email)')
      .eq('targetId', recruiterId)
      .order('timestamp', { ascending: false })
      .limit(20);
    
    return NextResponse.json({
      id: recruiter.id,
      name: recruiter.name,
      type: 'recruiter',
      state: recruiter.state,
      district: recruiter.district,
      email: recruiter.email,
      phone: recruiter.phone,
      website: recruiter.website,
      address: recruiter.address,
      verificationStatus: recruiter.verificationstatus || 'approved',
      isActive: recruiter.isactive !== undefined ? recruiter.isactive : true,
      createdAt: recruiter.createdat,
      updatedAt: recruiter.updatedat,
      userCount: users?.length || 0,
      auditHistory: auditLogs || [],
      verificationHistory: verifications || []
    });
  } catch (error) {
    return handleError(error, 'Recruiter Detail');
  }
}
