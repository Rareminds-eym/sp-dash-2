'use client';

import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export function SearchFilter({ value, onChange }) {
  const [inputValue, setInputValue] = useState(value || '');
  const onChangeRef = useRef(onChange);

  // Update ref whenever onChange changes (without triggering debounce effect)
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Debounce search input - only call onChange after user stops typing
  // Dependencies: [inputValue, value] only - onChange ref is stable, won't trigger effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue !== value) {
        onChangeRef.current(inputValue);
      }
    }, 300); // Wait 300ms after user stops typing

    return () => clearTimeout(timer);
  }, [inputValue, value]);

  // Sync input when parent's value changes externally (e.g., when filters are reset)
  // Only sync when parent's value is different from our local state
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value || '');
    }
  }, [value]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
      <Input
        id="search-filter"
        type="text"
        placeholder="Search by name or email..."
        className="pl-9 h-10"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
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
