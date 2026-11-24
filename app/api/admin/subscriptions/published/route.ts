import { forwardSubscriptionRequest } from '@/lib/subscriptions/skillpassport-client';
export const dynamic = 'force-dynamic';
export const GET = (request: Request) => forwardSubscriptionRequest(request, 'published');
