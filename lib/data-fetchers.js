// Server-side data fetching utilities for Phase 3 streaming architecture

// Simulate API calls with proper error handling
export async function fetchMetrics() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/metrics`, {
      cache: 'no-store', // Always get fresh data
      next: { revalidate: 60 } // Revalidate every 60 seconds
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch metrics');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return null;
  }
}

export async function fetchTrends() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/analytics/trends`, {
      cache: 'no-store',
      next: { revalidate: 300 } // Cache for 5 minutes
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch trends');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching trends:', error);
    return [];
  }
}

export async function fetchStateData() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/analytics/state-wise`, {
      cache: 'no-store',
      next: { revalidate: 300 } // Cache for 5 minutes
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch state data');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching state data:', error);
    return [];
  }
}

export async function fetchVerifications() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/verifications`, {
      cache: 'no-store',
      next: { revalidate: 30 } // Cache for 30 seconds
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch verifications');
    }
    
    const data = await response.json();
    return data.slice(0, 10);
  } catch (error) {
    console.error('Error fetching verifications:', error);
    return [];
  }
}

// Client-side data fetching (for backward compatibility)
export async function fetchMetricsClient() {
  const response = await fetch('/api/metrics');
  return await response.json();
}

export async function fetchTrendsClient() {
  const response = await fetch('/api/analytics/trends');
  return await response.json();
}

export async function fetchStateDataClient() {
  const response = await fetch('/api/analytics/state-wise');
  return await response.json();
}

export async function fetchVerificationsClient() {
  const response = await fetch('/api/verifications');
  const data = await response.json();
  return data.slice(0, 10);
}
