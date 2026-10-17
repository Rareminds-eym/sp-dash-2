import type { NextRequest } from 'next/server';
import { proxyLTE } from '@/lib/lte-api';

export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<Response> {
  return proxyLTE(request, 'review');
}

export async function PATCH(request: NextRequest): Promise<Response> {
  return proxyLTE(request, 'review');
}
