import type { NextRequest } from 'next/server';
import { proxyLTE } from '@/lib/lte-api';
export const runtime = 'nodejs';
export async function GET(request: NextRequest, {params}: {params:Promise<{jobId:string}>}) {
 const {jobId} = await params;
 return proxyLTE(request, `publish/${encodeURIComponent(jobId)}/status`);
}
