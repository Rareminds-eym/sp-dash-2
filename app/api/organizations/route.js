import { handleError } from '@/lib/middleware/errorHandler';
import { addCacheHeaders } from '@/lib/services/cacheService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * GET /api/organizations - List all organizations (combined from universities and recruiters)
 */
export async function GET(request) {
  try {
    // Fetch from universities, recruiters, and organizations tables
    const [universitiesResult, recruitersResult, organizationsResult] = await Promise.all([
      supabaseAdmin.from('universities').select('*').order('createdat', { ascending: false }),
      supabaseAdmin.from('recruiters').select('*').order('createdat', { ascending: false }),
      supabaseAdmin.from('organizations').select('*').order('created_at', { ascending: false })
    ]);

    if (universitiesResult.error) throw universitiesResult.error;
    if (recruitersResult.error) throw recruitersResult.error;
    if (organizationsResult.error) throw organizationsResult.error;

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

    const organizations = (organizationsResult.data || []).map(o => ({
      id: o.id,
      name: o.name,
      type: 'organization',
      description: o.description,
      createdAt: o.created_at,
      updatedAt: o.updated_at
    }));

    const allOrgs = [...universities, ...recruiters, ...organizations].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    const response = NextResponse.json(allOrgs);
    return addCacheHeaders(response, 'static');
  } catch (error) {
    return handleError(error, 'Organizations');
  }
}
