import { NextResponse } from 'next/server';
import { supabase } from '../../../../../../lib/supabase';

export const runtime = 'edge';

export async function GET(request) {
  try {
    // Fetch all placement data from the placements table
    const { data: placements, error } = await supabase
      .from('placements')
      .select('*');
    
    if (error) throw error;

    // Count placements by status (matching the main endpoint logic)
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
      const dateField = placement.createdAt || placement.hiredDate || placement.appliedDate;
      if (dateField) {
        const date = new Date(dateField);
        const month = date.toLocaleString('default', { month: 'short' });
        
        if (!monthlyData[month]) {
          monthlyData[month] = { applied: 0, hired: 0, retained: 0 };
        }
        
        monthlyData[month].applied += 1;
        
        if (placement.placementStatus === 'hired') {
          monthlyData[month].hired += 1;
          if (placement.retentionDate) {
            monthlyData[month].retained += 1;
          }
        }
      }
    });

    const monthlyConversions = monthOrder
      .filter(month => monthlyData[month])
      .map(month => ({
        month,
        applied: monthlyData[month].applied,
        hired: monthlyData[month].hired,
        retained: monthlyData[month].retained
      }));

    // Create CSV for conversion funnel
    const headers1 = ['Stage', 'Count', 'Percentage'];
    const csvRows = [headers1.join(',')];
    
    conversionFunnel.forEach(stage => {
      const row = [`"${stage.stage}"`, stage.count, stage.percentage];
      csvRows.push(row.join(','));
    });

    csvRows.push(''); // Empty line
    csvRows.push('Summary Statistics');
    csvRows.push(`Total Applications,${totalApplications}`);
    csvRows.push(`Shortlisted,${shortlistedCount}`);
    csvRows.push(`Offered,${offeredCount}`);
    csvRows.push(`Hired,${hiredCount}`);
    csvRows.push(`Rejected,${rejectedCount}`);
    csvRows.push(`Withdrawn,${withdrawnCount}`);

    csvRows.push(''); // Empty line
    csvRows.push('Monthly Conversions');
    
    const headers2 = ['Month', 'Applied', 'Hired', 'Retained'];
    csvRows.push(headers2.join(','));
    
    monthlyConversions.forEach(month => {
      const row = [month.month, month.applied, month.hired, month.retained];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="placement-conversion-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
  } catch (error) {
    console.error('Error in placement-conversion export:', error);
    return NextResponse.json(
      { error: 'Failed to export placement conversion data' },
      { status: 500 }
    );
  }
}
