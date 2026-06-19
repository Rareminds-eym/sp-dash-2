'use client';

import PropTypes from 'prop-types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DOWNLOAD_RANGES = [
  { value: '0', label: 'No Downloads' },
  { value: '1-5', label: '1-5 Downloads' },
  { value: '6-15', label: '6-15 Downloads' },
  { value: '16-50', label: '16-50 Downloads' },
  { value: '50+', label: '50+ Downloads' },
];

export function DownloadRangeFilter({ value, onChange }) {
  return (
    <Select value={value || 'all'} onValueChange={(val) => onChange(val === 'all' ? '' : val)}>
      <SelectTrigger 
        id="download-range-filter"
        className="w-full h-10"
        aria-label="Filter by download count"
      >
        <SelectValue placeholder="Downloads" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Downloads</SelectItem>
        {DOWNLOAD_RANGES.map((range) => (
          <SelectItem key={range.value} value={range.value}>
            {range.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

DownloadRangeFilter.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};

DownloadRangeFilter.defaultProps = {
  value: '',
};