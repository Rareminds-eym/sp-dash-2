'use client';

import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

export function DateRangeFilter({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Convert array format to object format for Calendar component
  const [startDate, endDate] = value || [];
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
    ? `${format(new Date(startDate), 'MMM d')} - ${format(new Date(endDate), 'MMM d')}`
    : startDate
    ? format(new Date(startDate), 'MMM d, yyyy')
    : 'Date Range';

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start text-left font-normal h-10"
          aria-label="Filter by date range"
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
          aria-label="Select date range"
        />
      </PopoverContent>
    </Popover>
  );
}