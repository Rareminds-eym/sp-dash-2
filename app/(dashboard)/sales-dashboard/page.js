'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { FilterPanel } from '@/components/sales/FilterPanel';
import { ExportControls } from '@/components/sales/ExportControls';
import { ClientTable } from '@/components/sales/ClientTable';

export default function SalesDashboardPage() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState({
    clientType: [],
    planType: '',
    status: '',
    dateRange: [],
    search: '',
  });
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize filters from URL params
  useEffect(() => {
    const parseDate = (value) => {
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };

    const clientType = searchParams.get('clientType');
    const planType = searchParams.get('planType');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const startDate = parseDate(searchParams.get('startDate'));
    const endDate = parseDate(searchParams.get('endDate'));

    setFilters({
      clientType: clientType ? clientType.split(',').filter(Boolean) : [],
      planType: planType ?? '',
      status: status ?? '',
      dateRange: [startDate || null, endDate || null], // Preserve tuple positions
      search: search ?? '',
    });
  }, [searchParams]);

  // Fetch data when filters change - memoized to avoid recreating on every render
  const fetchData = useCallback(async (signal) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', pagination.page);
      params.set('limit', pagination.limit);

      if (filters.clientType.length > 0) {
        params.set('clientType', filters.clientType.join(','));
      }
      if (filters.planType) {
        params.set('planType', filters.planType);
      }
      if (filters.status) {
        params.set('status', filters.status);
      }
      if (filters.search) {
        params.set('search', filters.search);
      }
      // Add date range filters
      if (filters.dateRange && filters.dateRange.length >= 2) {
        const [startDate, endDate] = filters.dateRange;
        if (startDate) {
          params.set('startDate', startDate.toISOString());
        }
        if (endDate) {
          params.set('endDate', endDate.toISOString());
        }
      }

      const response = await fetch(`/api/sales/clients?${params.toString()}`, { signal });
      
      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: 'Failed to fetch clients' }));
        throw new Error(result.error || 'Failed to fetch clients');
      }

      const result = await response.json();

      setData(result.data);
      setPagination(result.pagination);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const handleFilterChange = (newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleResetFilters = () => {
    setFilters({
      clientType: [],
      planType: '',
      status: '',
      dateRange: [],
      search: '',
    });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleExport = (format) => {
    const params = new URLSearchParams();

    if (filters.clientType.length > 0) {
      params.set('clientType', filters.clientType.join(','));
    }
    if (filters.planType) {
      params.set('planType', filters.planType);
    }
    if (filters.status) {
      params.set('status', filters.status);
    }
    if (filters.search) {
      params.set('search', filters.search);
    }
    // Add date range filters
    if (filters.dateRange && filters.dateRange.length >= 2) {
      const [startDate, endDate] = filters.dateRange;
      if (startDate) {
        params.set('startDate', startDate.toISOString());
      }
      if (endDate) {
        params.set('endDate', endDate.toISOString());
      }
    }

    params.set('format', format);

    window.location.href = `/api/sales/export?${params.toString()}`;
  };

  const handlePageChange = (page) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  return (
    <div className="space-y-4">
      {/* Removed duplicate title and Add Client button - title is shown in layout */}

      {error && (
        <div 
          className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-md" 
          role="alert"
          aria-live="assertive"
        >
          <p className="font-medium">Error loading clients</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Compact filter bar */}
      <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
        <FilterPanel
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
        />
      </div>

      {/* Export and count */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500 dark:text-gray-400" role="status" aria-live="polite">
          Showing {data.length} of {pagination.total} clients
        </div>
        <ExportControls onExport={handleExport} isLoading={isLoading} />
      </div>

      {/* Data table */}
      <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg">
        <ClientTable
          data={data}
          pagination={pagination}
          isLoading={isLoading}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}