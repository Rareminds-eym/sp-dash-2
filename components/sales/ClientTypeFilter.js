'use client';

import PropTypes from 'prop-types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function ClientTypeFilter({ value, onChange, options }) {
  function formatLabel(str) {
    return str
      .split(/[_\s]+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  const items = (options ?? [])
    .map(t => typeof t === 'string' ? { value: t, label: formatLabel(t) } : t);

  return (
    <Select value={value || 'all'} onValueChange={(val) => onChange(val === 'all' ? '' : val)}>
      <SelectTrigger 
        className="w-full h-10"
        aria-label="Filter by client type"
      >
        <SelectValue placeholder="Client Type" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Client Types</SelectItem>
        {items.map((type) => (
          <SelectItem key={type.value} value={type.value}>
            {type.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

ClientTypeFilter.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.array,
};

ClientTypeFilter.defaultProps = {
  value: '',
  options: null,
};
