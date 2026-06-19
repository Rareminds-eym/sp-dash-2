'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, User, CreditCard, Calendar } from 'lucide-react';
import { useState } from 'react';

// Safe date formatter with error handling
const formatDate = (dateString) => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Invalid date format:', dateString);
      }
      return '-';
    }
    return date.toLocaleDateString();
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Date formatting error:', dateString, error);
    }
    return '-';
  }
};

const COLUMNS = [
  { key: 'fullName', label: 'Client Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'role', label: 'Type' },
  { key: 'planType', label: 'Plan' },
  { key: 'planAmount', label: 'Amount' },
  { key: 'billingCycle', label: 'Billing Cycle' },
  { key: 'subscriptionStatus', label: 'Status' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'endDate', label: 'End Date' },
];

const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
    case 'pending':
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
    case 'cancelled':
      return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
    case 'expired':
      return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    case 'paused':
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
  }
};

// Truncate email with tooltip
const truncateEmail = (email, maxLength = 25) => {
  if (!email) return 'No email';
  if (email.length <= maxLength) return email;
  return email.substring(0, maxLength - 3) + '...';
};

// Email cell component with tooltip
function EmailCell({ email }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const truncated = truncateEmail(email);
  const needsTruncation = email && email.length > 25;

  return (
    <div
      className="relative inline-block cursor-help"
      onMouseEnter={() => needsTruncation && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="text-gray-700 dark:text-gray-300 text-sm">
        {truncated}
      </span>
      {showTooltip && needsTruncation && (
        <div className="absolute bottom-full left-0 mb-2 px-3 py-2 text-xs text-white bg-gray-800 dark:bg-gray-900 rounded shadow-lg whitespace-nowrap z-10">
          {email}
          <div className="absolute top-full left-2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-800 dark:border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
}

function ClientCard({ client }) {
  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{client.fullName}</CardTitle>
          {client.subscriptionStatus && (
            <Badge className={getStatusColor(client.subscriptionStatus)}>
              {client.subscriptionStatus}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Mail className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <EmailCell email={client.email} />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-gray-700 dark:text-gray-300">{client.role}</span>
        </div>
        {client.phone && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">📞</span>
            <span className="text-gray-700 dark:text-gray-300">{client.phone}</span>
          </div>
        )}
        {client.planType && (
          <div className="flex items-center gap-2 text-sm">
            <CreditCard className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">{client.planType} - ₹{client.planAmount || 0} / {client.billingCycle || 'N/A'}</span>
          </div>
        )}
        {(client.startDate || client.endDate) && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">
              {formatDate(client.startDate)} to {formatDate(client.endDate)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ClientTable({ data, pagination, isLoading, onPageChange }) {
  const currentPage = pagination?.page || 1;

  const handlePageChange = (page) => {
    // Guard pagination boundaries
    if (!pagination) return;
    if (page < 1) return;
    if (page > pagination.totalPages) return;
    
    onPageChange(page);
  };

  const handleKeyboardNavigation = (e, page) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handlePageChange(page);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2" role="status" aria-live="polite" aria-label="Loading clients">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12" role="status">
        <p className="text-gray-500 dark:text-gray-400">No clients found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mobile Card View - visible on screens < 640px */}
      <div className="block sm:hidden" role="list" aria-label="Client list">
        {data.map((client) => (
          <ClientCard key={client.id} client={client} />
        ))}
      </div>

      {/* Desktop/Tablet Table View - visible on screens >= 640px */}
      <div className="hidden sm:block border dark:border-gray-700 rounded-lg overflow-x-auto">
        <Table role="table" aria-label="Clients table">
          <TableHeader>
            <TableRow>
              {COLUMNS.map((column) => (
                <TableHead key={column.key}>{column.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((client) => (
              <TableRow key={client.id}>
                <TableCell>{client.fullName}</TableCell>
                <TableCell>
                  <EmailCell email={client.email} />
                </TableCell>
                <TableCell>{client.phone || '-'}</TableCell>
                <TableCell>{client.role}</TableCell>
                <TableCell>{client.planType || '-'}</TableCell>
                <TableCell>₹{client.planAmount || 0}</TableCell>
                <TableCell>{client.billingCycle || '-'}</TableCell>
                <TableCell>
                  <Badge className={getStatusColor(client.subscriptionStatus)}>
                    {client.subscriptionStatus || '-'}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(client.startDate)}</TableCell>
                <TableCell>{formatDate(client.endDate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <Pagination role="navigation" aria-label="Pagination navigation">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => handlePageChange(currentPage - 1)}
              onKeyDown={(e) => handleKeyboardNavigation(e, currentPage - 1)}
              disabled={!pagination || currentPage <= 1}
              aria-label="Go to previous page"
              tabIndex={!pagination || currentPage <= 1 ? -1 : 0}
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink 
              isActive
              aria-label={`Current page, page ${currentPage}`}
              aria-current="page"
            >
              {currentPage}
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              onClick={() => handlePageChange(currentPage + 1)}
              onKeyDown={(e) => handleKeyboardNavigation(e, currentPage + 1)}
              disabled={!pagination || currentPage >= pagination.totalPages}
              aria-label="Go to next page"
              tabIndex={!pagination || currentPage >= pagination.totalPages ? -1 : 0}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}