'use client';

import PropTypes from 'prop-types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';

/**
 * ExportControls component for exporting client data
 * @param {Object} props
 * @param {function(string): void} props.onExport - Callback function that receives format ('csv' or 'excel')
 * @param {boolean} [props.isLoading=false] - Loading state to disable the button
 */
export function ExportControls({ onExport, isLoading }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={isLoading}
          aria-label="Export client data"
        >
          <Download className="w-4 h-4 mr-2" aria-hidden="true" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onExport('csv')}>
          <FileText className="w-4 h-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport('excel')}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Export as Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

ExportControls.propTypes = {
  onExport: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};

ExportControls.defaultProps = {
  isLoading: false,
};