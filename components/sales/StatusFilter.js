'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SUBSCRIPTION_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' },
  { value: 'paused', label: 'Paused' },
];

export function StatusFilter({ value, onChange }) {
  return (
    <Select value={value || 'all'} onValueChange={(val) => onChange(val === 'all' ? '' : val)}>
      <SelectTrigger 
        id="status-filter"
        className="w-full h-10"
        aria-label="Filter by subscription status"
      >
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Statuses</SelectItem>
        {SUBSCRIPTION_STATUSES.map((status) => (
          <SelectItem key={status.value} value={status.value}>
            {status.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}