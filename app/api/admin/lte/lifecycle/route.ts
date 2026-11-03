import type { NextRequest } from 'next/server';
import { proxyLTE } from '@/lib/lte-api';

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<Response> {
  return proxyLTE(request, 'lifecycle');
}
