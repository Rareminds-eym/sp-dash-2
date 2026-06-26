'use client';

import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { CertificateSearchFilter } from './CertificateSearchFilter';
import { CourseFilter } from './CourseFilter';
import { DownloadRangeFilter } from './DownloadRangeFilter';
import { CertificateDateRangeFilter } from './CertificateDateRangeFilter';

export function CertificateFilterPanel({ filters, onFilterChange, onReset, courses, isLoadingCourses }) {
  // Count active filters
  const activeFiltersCount = [
    filters.search,
    filters.courseId,
    filters.downloadRange,
    filters.dateRange?.length > 0,
  ].filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* Compact horizontal filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search - takes more space */}
        <div className="flex-1 min-w-[250px] max-w-[350px]">
          <CertificateSearchFilter
            value={filters.search}
            onChange={(value) => onFilterChange({ search: value })}
          />
        </div>

        {/* Inline filters */}
        <div className="flex-shrink-0 w-[200px]">
          <CourseFilter
            value={filters.courseId}
            onChange={(value) => onFilterChange({ courseId: value })}
            courses={courses}
            isLoading={isLoadingCourses}
          />
        </div>

        <div className="flex-shrink-0 w-[160px]">
          <DownloadRangeFilter
            value={filters.downloadRange}
            onChange={(value) => onFilterChange({ downloadRange: value })}
          />
        </div>

        <div className="flex-shrink-0 w-[180px]">
          <CertificateDateRangeFilter
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