'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { endOfDay } from 'date-fns';
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterMeta, setFilterMeta] = useState(null);

  // Fetch filter metadata on mount
  useEffect(() => {
    let cancelled = false;
    fetch('/api/sales/filters-meta')
      .then(res => res.ok ? res.json() : (console.warn('[FilterMeta] Bad response:', res.status), null))
      .then(meta => { if (!cancelled && meta) setFilterMeta(meta); })
      .catch(err => console.warn('[FilterMeta] Fetch failed:', err));
    return () => { cancelled = true; };
  }, []);

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

  // Sync page from URL params (supports browser back/forward navigation)
  useEffect(() => {
    const urlPage = parseInt(searchParams.get('page') || '1', 10);
    if (urlPage !== pagination.page) {
      setPagination(prev => ({ ...prev, page: urlPage }));
    }
  }, [searchParams.get('page')]);

  // Sync ALL filter + page state to URL when it changes.
  // Skipped on initial render to avoid overwriting URL state before the
  // init effects above have read URL → state.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }

    const params = new URLSearchParams();
    if (filters.clientType.length > 0) params.set('clientType', filters.clientType.join(','));
    if (filters.planType) params.set('planType', filters.planType);
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    if (filters.dateRange?.[0]) params.set('startDate', filters.dateRange[0].toISOString());
    if (filters.dateRange?.[1]) {
      // "To" date is a date-only selection at local midnight; serialize the
      // inclusive end of that day so records on the selected day aren't
      // excluded when local midnight converts to the previous UTC day.
      params.set('endDate', endOfDay(filters.dateRange[1]).toISOString());
    }
    params.set('page', String(pagination.page));

    // Compare params as key-value sets (order-independent)
    const currentParams = new URLSearchParams(window.location.search);
    const keys = new Set([...params.keys(), ...currentParams.keys()]);
    let changed = false;
    for (const k of keys) {
      if (params.get(k) !== currentParams.get(k)) { changed = true; break; }
    }
    if (!changed) return;

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    // Preserve Next.js router state + bypass ACTION_RESTORE dispatch
    // to avoid cascading re-renders (next.js monkey-patches replaceState)
    const currentState = window.history.state || {};
    window.history.replaceState(
      {
        ...currentState,
        __NA: true,
        __PRIVATE_NEXTJS_INTERNALS_TREE: currentState.__PRIVATE_NEXTJS_INTERNALS_TREE,
      },
      '',
      newUrl,
    );
  }, [
    filters.clientType.join(','),
    filters.planType,
    filters.status,
    filters.search,
    filters.dateRange[0]?.getTime() ?? '',
    filters.dateRange[1]?.getTime() ?? '',
    pagination.page,
  ]);

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
          // "To" date is a date-only selection at local midnight; serialize the
          // inclusive end of that day so records on the selected day aren't
          // excluded when local midnight converts to the previous UTC day.
          params.set('endDate', endOfDay(endDate).toISOString());
        }
      }

      const response = await fetch(`/api/sales/clients?${params.toString()}`, { signal });
      
      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: 'Failed to fetch clients' }));
        throw new Error(result.error || 'Failed to fetch clients');
      }

      const result = await response.json();
      if (signal.aborted) return;

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

  const handleExport = async (format) => {
    try {
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
          // "To" date is a date-only selection at local midnight; serialize the
          // inclusive end of that day so records on the selected day aren't
          // excluded when local midnight converts to the previous UTC day.
          params.set('endDate', endOfDay(endDate).toISOString());
        }
      }

      params.set('format', format);

      // Fetch the file
      const response = await fetch(`/api/sales/export?${params.toString()}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Export failed');
      }

      // Get the filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `clients_export.${format}`;
      if (contentDisposition) {
        const matches = contentDisposition.match(/filename="?([^"]+)"?/);
        if (matches && matches[1]) {
          filename = matches[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert(`Export failed: ${error.message}`);
    }
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
          filterMeta={filterMeta}
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