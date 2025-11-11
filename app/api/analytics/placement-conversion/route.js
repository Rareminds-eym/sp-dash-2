import { addCacheHeaders } from '@/lib/services/cacheService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request) {
  try {
    // Fetch all placement data from the placements table
    const { data: placements, error } = await supabase
      .from('placements')
      .select('*');
    
    if (error) {
      console.error('Error fetching placements:', error);
      throw error;
    }

    // Count placements by status
    // Process: applied -> shortlisted -> offered -> hired
    // Rejected/withdrawn only applies between applied to offered
    const appliedCount = placements.filter(p => 
      ['applied', 'shortlisted', 'offered', 'hired'].includes(p.placementStatus)
    ).length;
    
    const shortlistedCount = placements.filter(p => 
      ['shortlisted', 'offered', 'hired'].includes(p.placementStatus)
    ).length;
    
    const offeredCount = placements.filter(p => 
      ['offered', 'hired'].includes(p.placementStatus)
    ).length;
    
    const hiredCount = placements.filter(p => 
      p.placementStatus === 'hired'
    ).length;

    const rejectedCount = placements.filter(p => 
      p.placementStatus === 'rejected'
    ).length;

    const withdrawnCount = placements.filter(p => 
      p.placementStatus === 'withdrawn'
    ).length;

    // Calculate total starting applications (applied + rejected + withdrawn)
    const totalApplications = appliedCount + rejectedCount + withdrawnCount;

    // Build conversion funnel with percentages based on previous stage
    const conversionFunnel = [
      { 
        stage: 'Applied', 
        count: totalApplications, 
        percentage: 100 
      },
      { 
        stage: 'Rejected', 
        count: rejectedCount, 
        percentage: totalApplications > 0 ? parseFloat(((rejectedCount / totalApplications) * 100).toFixed(1)) : 0 
      },
      { 
        stage: 'Withdrawn', 
        count: withdrawnCount, 
        percentage: totalApplications > 0 ? parseFloat(((withdrawnCount / totalApplications) * 100).toFixed(1)) : 0 
      },
      { 
        stage: 'Shortlisted', 
        count: shortlistedCount, 
        percentage: totalApplications > 0 ? parseFloat(((shortlistedCount / totalApplications) * 100).toFixed(1)) : 0 
      },
      { 
        stage: 'Offered', 
        count: offeredCount, 
        percentage: shortlistedCount > 0 ? parseFloat(((offeredCount / shortlistedCount) * 100).toFixed(1)) : 0 
      },
      { 
        stage: 'Hired', 
        count: hiredCount, 
        percentage: offeredCount > 0 ? parseFloat(((hiredCount / offeredCount) * 100).toFixed(1)) : 0 
      }
    ];

    // Group by month for monthly conversions
    const monthlyData = {};
    const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    placements.forEach(placement => {
      // Use createdAt or hiredDate or any date field available
      const dateField = placement.createdAt || placement.hiredDate || placement.appliedDate;
      if (dateField) {
        const date = new Date(dateField);
        const month = date.toLocaleString('default', { month: 'short' });
        
        if (!monthlyData[month]) {
          monthlyData[month] = { applied: 0, hired: 0, retained: 0 };
        }
        
        // Count applied (all statuses count as applied initially)
        monthlyData[month].applied += 1;
        
        // Count hired
        if (placement.placementStatus === 'hired') {
          monthlyData[month].hired += 1;
          
          // Check retention if retentionDate exists
          if (placement.retentionDate) {
            monthlyData[month].retained += 1;
          }
        }
      }
    });

    // Convert to array and sort by month
    const monthlyConversions = monthOrder
      .filter(month => monthlyData[month])
      .map(month => ({
        month,
        applied: monthlyData[month].applied,
        hired: monthlyData[month].hired,
        retained: monthlyData[month].retained
      }));

    const placementConversionData = {
      conversionFunnel,
      monthlyConversions,
      summary: {
        totalApplications,
        shortlistedCount,
        offeredCount,
        hiredCount,
        rejectedCount,
        withdrawnCount
      }
    };
    
    const response = NextResponse.json(placementConversionData);
    return addCacheHeaders(response, 'dynamic');
  } catch (error) {
    console.error('Error in placement-conversion endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch placement conversion data', details: error.message },
      { status: 500 }
    );
  }
}
