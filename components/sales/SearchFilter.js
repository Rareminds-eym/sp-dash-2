'use client';

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export function SearchFilter({ value, onChange }) {
  const [localValue, setLocalValue] = useState(value || '');

  // Sync when parent's value changes externally (e.g., reset)
  useEffect(() => {
    if (value !== localValue) {
      setLocalValue(value || '');
    }
  }, [value]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onChange(localValue);
    }
  };

  const handleBlur = () => {
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
      <Input
        id="search-filter"
        type="text"
        placeholder="Search by name or email... (Press Enter)"
        className="pl-9 h-10"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        aria-label="Search clients by name or email"
      />
    </div>
  );
}

SearchFilter.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};

SearchFilter.defaultProps = {
  value: '',
};
