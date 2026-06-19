'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Award, User, Calendar, FileText } from 'lucide-react';
import { useState } from 'react';

// Safe date formatter with error handling
const formatDate = (dateString) => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }
    return date.toLocaleDateString();
  } catch (error) {
    return '-';
  }
};

const COLUMNS = [
  { key: 'studentName', label: 'Student' },
  { key: 'courseName', label: 'Course' },
  { key: 'certificateId', label: 'Certificate ID' },
  { key: 'issueDate', label: 'Issue Date' },
  { key: 'downloadCount', label: 'Downloads' },
];

const getDownloadBadgeColor = (count) => {
  if (count === 0) return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
  if (count <= 5) return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
  if (count <= 15) return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
  return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300';
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

function CertificateCard({ certificate }) {
  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{certificate.studentName}</CardTitle>
          <Badge className={getDownloadBadgeColor(certificate.downloadCount || 0)}>
            {certificate.downloadCount || 0} downloads
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <EmailCell email={certificate.studentEmail} />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Award className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-gray-700 dark:text-gray-300">{certificate.courseName}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <code className="text-xs bg-muted px-2 py-1 rounded">
            {certificate.certificateId}
          </code>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-gray-700 dark:text-gray-300">
            Issued: {formatDate(certificate.issueDate)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function CertificateTable({ data, pagination, isLoading, onPageChange }) {
  const currentPage = pagination?.page || 1;

  const handlePageChange = (page) => {
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
      <div className="space-y-2" role="status" aria-live="polite" aria-label="Loading certificates">
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
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">No certificates found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mobile Card View - visible on screens < 640px */}
      <div className="block sm:hidden" role="list" aria-label="Certificate list">
        {data.map((certificate) => (
          <CertificateCard key={certificate.id} certificate={certificate} />
        ))}
      </div>

      {/* Desktop/Tablet Table View - visible on screens >= 640px */}
      <div className="hidden sm:block border dark:border-gray-700 rounded-lg overflow-x-auto">
        <Table role="table" aria-label="Certificates table">
          <TableHeader>
            <TableRow>
              {COLUMNS.map((column) => (
                <TableHead key={column.key}>{column.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((certificate) => (
              <TableRow key={certificate.id} className="hover:bg-muted/50">
                <TableCell>
                  <div>
                    <p className="font-medium">{certificate.studentName}</p>
                    {certificate.studentEmail && (
                      <p className="text-sm text-muted-foreground">
                        <EmailCell email={certificate.studentEmail} />
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>{certificate.courseName}</TableCell>
                <TableCell>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {certificate.certificateId}
                  </code>
                </TableCell>
                <TableCell>{formatDate(certificate.issueDate)}</TableCell>
                <TableCell>
                  <Badge className={getDownloadBadgeColor(certificate.downloadCount || 0)}>
                    {certificate.downloadCount || 0}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="space-y-2">
          {/* Pagination Info */}
          <div className="text-sm text-muted-foreground text-center">
            Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} certificates
          </div>
          
          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <Pagination role="navigation" aria-label="Pagination navigation">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => handlePageChange(currentPage - 1)}
                    onKeyDown={(e) => handleKeyboardNavigation(e, currentPage - 1)}
                    disabled={currentPage <= 1}
                    aria-label="Go to previous page"
                    tabIndex={currentPage <= 1 ? -1 : 0}
                  />
                </PaginationItem>
                
                {/* Show page numbers */}
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(
                    pagination.totalPages - 4,
                    currentPage - 2
                  )) + i;
                  
                  if (pageNum > pagination.totalPages) return null;
                  
                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        onClick={() => handlePageChange(pageNum)}
                        onKeyDown={(e) => handleKeyboardNavigation(e, pageNum)}
                        isActive={pageNum === currentPage}
                        aria-label={pageNum === currentPage ? `Current page, page ${pageNum}` : `Go to page ${pageNum}`}
                        aria-current={pageNum === currentPage ? "page" : undefined}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                
                <PaginationItem>
                  <PaginationNext
                    onClick={() => handlePageChange(currentPage + 1)}
                    onKeyDown={(e) => handleKeyboardNavigation(e, currentPage + 1)}
                    disabled={currentPage >= pagination.totalPages}
                    aria-label="Go to next page"
                    tabIndex={currentPage >= pagination.totalPages ? -1 : 0}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}
    </div>
  );
}