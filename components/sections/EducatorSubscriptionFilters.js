'use client';

import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlanTypeFilter } from '@/components/sales/PlanTypeFilter';
import { StatusFilter } from '@/components/sales/StatusFilter';
import { DateRangeFilter } from '@/components/sales/DateRangeFilter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EDUCATOR_EVENT_100K } from '@/lib/educator-events';

// Copied from Sales SearchFilter, with educator-specific wording.
function EducatorSearchFilter({ value, onChange }) {
  const [localValue, setLocalValue] = useState(value || '');

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
      <Input
        id="educator-search-filter"
        type="text"
        placeholder="Search educator name or email..."
        className="pl-9 h-10"
        value={localValue}
        onChange={(event) => setLocalValue(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') onChange(localValue); }}
        onBlur={() => { if (localValue !== value) onChange(localValue); }}
        aria-label="Search educators by name or email"
      />
    </div>
  );
}

// Sales FilterPanel structure, omitting only the sales-specific Client Type filter.
export function EducatorSubscriptionFilters({ filters, onFilterChange, onReset, filterMeta }) {
  const activeFiltersCount = [
    filters.planType,
    filters.status,
    filters.dateRange?.length > 0,
    filters.search,
    filters.event,
  ].filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[200px] max-w-[400px]">
          <EducatorSearchFilter value={filters.search} onChange={(value) => onFilterChange({ search: value })} />
        </div>
        <div className="flex-shrink-0 w-[160px]">
          <PlanTypeFilter value={filters.planType} onChange={(value) => onFilterChange({ planType: value })} options={filterMeta?.planTypes} />
        </div>
        <div className="flex-shrink-0 w-[140px]">
          <StatusFilter value={filters.status} onChange={(value) => onFilterChange({ status: value })} options={filterMeta?.statuses} />
        </div>
        <div className="flex-shrink-0 w-[180px]">
          <DateRangeFilter value={filters.dateRange} onChange={(value) => onFilterChange({ dateRange: value })} />
        </div>
        <div className="flex-shrink-0 w-[180px]">
          <Select value={filters.event || 'all'} onValueChange={(value) => onFilterChange({ event: value === 'all' ? '' : value })}>
            <SelectTrigger className="w-full h-10" aria-label="Filter by educator event">
              <SelectValue placeholder="All Educators" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Educators</SelectItem>
              <SelectItem value={EDUCATOR_EVENT_100K}>100k Educators</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onReset} className="flex-shrink-0">
            <X className="w-4 h-4 mr-1" />
            Reset ({activeFiltersCount})
          </Button>
        )}
      </div>
    </div>
  );
}
