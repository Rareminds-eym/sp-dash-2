import { forwardSubscriptionRequest } from '@/lib/subscriptions/skillpassport-client';

export const POST = (request: Request) => forwardSubscriptionRequest(request, 'credits');
