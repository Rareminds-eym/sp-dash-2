'use client';

import { useState } from 'react';
import PropTypes from 'prop-types';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { format, isValid } from 'date-fns';

/**
 * Safely formats a date, returning fallback if invalid
 */
function safeFormatDate(date, formatStr, fallback = 'Invalid Date') {
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    if (!isValid(dateObj)) return fallback;
    return format(dateObj, formatStr);
  } catch {
    return fallback;
  }
}

export function CertificateDateRangeFilter({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Safely convert array format to object format for Calendar component
  const dateArray = Array.isArray(value) && value.length >= 2 ? value : [null, null];
  const [startDate, endDate] = dateArray;
  const dateRange = startDate && endDate ? { from: startDate, to: endDate } : startDate ? { from: startDate } : undefined;

  const handleSelect = (range) => {
    if (range?.from && range?.to) {
      onChange([range.from, range.to]);
    } else if (range?.from) {
      onChange([range.from, null]);
    } else {
      onChange([]);
    }
  };

  const displayText = startDate && endDate
    ? `${safeFormatDate(startDate, 'MMM d')} - ${safeFormatDate(endDate, 'MMM d')}`
    : startDate
    ? safeFormatDate(startDate, 'MMM d, yyyy')
    : 'Issue Date Range';

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start text-left font-normal h-10"
          aria-label="Filter by certificate issue date range"
          aria-expanded={isOpen}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span className="truncate">{displayText}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={dateRange}
          onSelect={handleSelect}
          numberOfMonths={2}
          aria-label="Select certificate issue date range"
        />
      </PopoverContent>
    </Popover>
  );
}

CertificateDateRangeFilter.propTypes = {
  value: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.instanceOf(Date),
      PropTypes.string,
      PropTypes.oneOf([null])
    ])
  ),
  onChange: PropTypes.func.isRequired,
};

CertificateDateRangeFilter.defaultProps = {
  value: [],
};