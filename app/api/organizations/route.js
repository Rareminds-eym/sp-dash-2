import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { addCacheHeaders } from '@/lib/services/cacheService';
import { handleError } from '@/lib/middleware/errorHandler';

export const runtime = 'edge';

/**
 * GET /api/organizations - List all organizations (combined from universities and recruiters)
 */
export async function GET(request) {
  try {
    // Fetch from both universities and recruiters tables
    const [universitiesResult, recruitersResult] = await Promise.all([
      supabaseAdmin.from('universities').select('*').order('createdat', { ascending: false }),
      supabaseAdmin.from('recruiters').select('*').order('createdat', { ascending: false })
    ]);

    if (universitiesResult.error) throw universitiesResult.error;
    if (recruitersResult.error) throw recruitersResult.error;

    // Combine results with type field for compatibility
    const universities = (universitiesResult.data || []).map(u => ({
      id: u.id,
      name: u.name,
      type: 'university',
      state: u.state,
      district: u.district,
      email: u.email,
      phone: u.phone,
      website: u.website,
      verificationStatus: u.verificationstatus,
      isActive: u.isactive,
      createdAt: u.createdat,
      updatedAt: u.updatedat
    }));

    const recruiters = (recruitersResult.data || []).map(r => ({
      id: r.id,
      name: r.name,
      type: 'recruiter',
      state: r.state,
      email: r.email,
      phone: r.phone,
      website: r.website,
      verificationStatus: r.verificationstatus,
      isActive: r.isactive,
      createdAt: r.createdat,
      updatedAt: r.updatedat
    }));

    const allOrgs = [...universities, ...recruiters].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    const response = NextResponse.json(allOrgs);
    return addCacheHeaders(response, 'static');
  } catch (error) {
    return handleError(error, 'Organizations');
  }
}
