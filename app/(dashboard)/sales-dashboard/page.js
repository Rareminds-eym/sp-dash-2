'use client';

import { useState, useEffect } from 'react';
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
    if (searchParams) {
      const clientType = searchParams.get('clientType');
      const planType = searchParams.get('planType');
      const status = searchParams.get('status');
      const search = searchParams.get('search');

      if (clientType) {
        setFilters((prev) => ({ ...prev, clientType: clientType.split(',') }));
      }
      if (planType) {
        setFilters((prev) => ({ ...prev, planType }));
      }
      if (status) {
        setFilters((prev) => ({ ...prev, status }));
      }
      if (search) {
        setFilters((prev) => ({ ...prev, search }));
      }
    }
  }, [searchParams]);

  // Fetch data when filters change
  useEffect(() => {
    fetchData();
  }, [filters, pagination.page]);

  const fetchData = async () => {
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
      if (filters.dateRange && filters.dateRange.length > 0) {
        const [startDate, endDate] = filters.dateRange;
        if (startDate) {
          params.set('startDate', startDate.toISOString());
        }
        if (endDate) {
          params.set('endDate', endDate.toISOString());
        }
      }

      const response = await fetch(`/api/sales/clients?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch clients');
      }

      setData(result.data);
      setPagination(result.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleResetFilters = () => {
    setFilters({
      clientType: [],
      planType: '',
      status: '',
      dateRange: [],
      search: '',
    });
  };

  const handleExport = async (format) => {
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
    if (filters.dateRange && filters.dateRange.length > 0) {
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
          className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md" 
          role="alert"
          aria-live="assertive"
        >
          <p className="font-medium">Error loading clients</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Compact filter bar */}
      <div className="bg-white border rounded-lg p-4">
        <FilterPanel
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
        />
      </div>

      {/* Export and count */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500" role="status" aria-live="polite">
          Showing {data.length} of {pagination.total} clients
        </div>
        <ExportControls onExport={handleExport} isLoading={isLoading} />
      </div>

      {/* Data table */}
      <div className="bg-white border rounded-lg">
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