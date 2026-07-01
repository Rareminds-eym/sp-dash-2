'use client';

import PropTypes from 'prop-types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function StatusFilter({ value, onChange, options }) {
  const items = (options ?? [])
    .map(s => typeof s === 'string' ? { value: s, label: s.charAt(0).toUpperCase() + s.slice(1) } : s);

  return (
    <Select value={value || 'all'} onValueChange={(val) => onChange(val === 'all' ? '' : val)}>
      <SelectTrigger 
        className="w-full h-10"
        aria-label="Filter by subscription status"
      >
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Statuses</SelectItem>
        {items.map((status) => (
          <SelectItem key={status.value} value={status.value}>
            {status.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

StatusFilter.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.array,
};

StatusFilter.defaultProps = {
  value: '',
  options: null,
};
