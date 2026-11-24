import { forwardSubscriptionRequest } from '@/lib/subscriptions/skillpassport-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  return forwardSubscriptionRequest(request, 'context');
}
