'use client';

import PropTypes from 'prop-types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PLAN_TYPES = [
  { value: 'pay_as_you_go', label: 'Pay As You Go' },
  { value: 'Basic', label: 'Basic' },
  { value: 'Professional', label: 'Professional' },
  { value: 'Enterprise', label: 'Enterprise' },
];

export function PlanTypeFilter({ value, onChange }) {
  return (
    <Select value={value || 'all'} onValueChange={(val) => onChange(val === 'all' ? '' : val)}>
      <SelectTrigger 
        id="plan-type-filter"
        className="w-full h-10"
        aria-label="Filter by plan type"
      >
        <SelectValue placeholder="Plan Type" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Plans</SelectItem>
        {PLAN_TYPES.map((plan) => (
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
};

PlanTypeFilter.defaultProps = {
  value: '',
};
