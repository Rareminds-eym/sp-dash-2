'use client';

import PropTypes from 'prop-types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function PlanTypeFilter({ value, onChange, options }) {
  const items = (options ?? [])
    .map(t => typeof t === 'string' ? { value: t, label: t } : t);

  return (
    <Select value={value || 'all'} onValueChange={(val) => onChange(val === 'all' ? '' : val)}>
      <SelectTrigger 
        className="w-full h-10"
        aria-label="Filter by plan type"
      >
        <SelectValue placeholder="Plan Type" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Plans</SelectItem>
        {items.map((plan) => (
          <SelectItem key={plan.value} value={plan.value}>
            {plan.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

PlanTypeFilter.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.array,
};

PlanTypeFilter.defaultProps = {
  value: '',
  options: null,
};
