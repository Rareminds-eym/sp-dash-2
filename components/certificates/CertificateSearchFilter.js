'use client';

import PropTypes from 'prop-types';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export function CertificateSearchFilter({ value, onChange }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
      <Input
        id="certificate-search-filter"
        type="text"
        placeholder="Search by student name, email, or course..."
        className="pl-9 h-10"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search certificates by student name, email, or course"
      />
    </div>
  );
}

CertificateSearchFilter.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};

CertificateSearchFilter.defaultProps = {
  value: '',
};