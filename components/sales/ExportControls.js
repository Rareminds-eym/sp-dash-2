'use client';

import PropTypes from 'prop-types';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

/**
 * ExportControls component for exporting client data
 * @param {Object} props
 * @param {function(string): void} props.onExport - Callback function that receives format ('csv')
 * @param {boolean} [props.isLoading=false] - Loading state to disable the button
 */
export function ExportControls({ onExport, isLoading }) {
  return (
    <Button
      variant="outline"
      disabled={isLoading}
      onClick={() => onExport('csv')}
      aria-label="Export client data as CSV"
    >
      <Download className="w-4 h-4 mr-2" aria-hidden="true" />
      Export CSV
    </Button>
  );
}

ExportControls.propTypes = {
  onExport: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};

ExportControls.defaultProps = {
  isLoading: false,
};
