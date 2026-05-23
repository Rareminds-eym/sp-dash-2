'use client';

import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { ClientTypeFilter } from './ClientTypeFilter';
import { PlanTypeFilter } from './PlanTypeFilter';
import { StatusFilter } from './StatusFilter';
import { DateRangeFilter } from './DateRangeFilter';
import { SearchFilter } from './SearchFilter';

export function FilterPanel({ filters, onFilterChange, onReset }) {
  // Count active filters
  const activeFiltersCount = [
    filters.clientType?.length > 0,
    filters.planType,
    filters.status,
    filters.dateRange?.length > 0,
    filters.search
  ].filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* Compact horizontal filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search - takes more space */}
        <div className="flex-1 min-w-[200px] max-w-[300px]">
          <SearchFilter
            value={filters.search}
            onChange={(value) => onFilterChange({ search: value })}
          />
        </div>

        {/* Inline filters */}
        <div className="flex-shrink-0 w-[180px]">
          <ClientTypeFilter
            value={filters.clientType || []}
            onChange={(value) => onFilterChange({ clientType: value })}
          />
        </div>

        <div className="flex-shrink-0 w-[160px]">
          <PlanTypeFilter
            value={filters.planType}
            onChange={(value) => onFilterChange({ planType: value })}
          />
        </div>

        <div className="flex-shrink-0 w-[140px]">
          <StatusFilter
            value={filters.status}
            onChange={(value) => onFilterChange({ status: value })}
          />
        </div>

        <div className="flex-shrink-0 w-[180px]">
          <DateRangeFilter
            value={filters.dateRange}
            onChange={(value) => onFilterChange({ dateRange: value })}
          />
        </div>

        {/* Reset button - only show if filters are active */}
        {activeFiltersCount > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onReset}
            className="flex-shrink-0"
          >
            <X className="w-4 h-4 mr-1" />
            Reset ({activeFiltersCount})
          </Button>
        )}
      </div>
    </div>
  );
}
