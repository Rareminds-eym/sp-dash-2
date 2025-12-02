import { NextResponse } from 'next/server';
import { addCacheHeaders } from '@/lib/services/cacheService';

export const runtime = 'edge';

/**
 * GET /api/analytics/recruiter-metrics
 * Returns metrics for recruiter engagement
 */
export async function GET() {
    // Mock data for recruiter metrics
    // In a real application, this would come from an analytics_events table
    const data = {
        totalSearches: 12458,
        profileViews: 8543,
        contactAttempts: 3240,
        shortlisted: 1850,
        hireIntents: 420,
        searchTrends: [
            { month: 'Jan', searches: 850, views: 620, contacts: 240 },
            { month: 'Feb', searches: 940, views: 750, contacts: 280 },
            { month: 'Mar', searches: 1100, views: 890, contacts: 350 },
            { month: 'Apr', searches: 1250, views: 980, contacts: 410 },
            { month: 'May', searches: 1400, views: 1150, contacts: 480 },
            { month: 'Jun', searches: 1650, views: 1320, contacts: 550 },
        ],
        topSkillsSearched: [
            { skill: 'Python', searches: 450 },
            { skill: 'React', searches: 380 },
            { skill: 'Data Science', searches: 320 },
            { skill: 'Java', searches: 290 },
            { skill: 'Digital Marketing', searches: 250 },
        ]
    };

    const response = NextResponse.json(data);
    return addCacheHeaders(response, 'short');
}
