'use client'

import { useCallback, useEffect, useState } from 'react'
import { endOfDay, format, isValid, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { EducatorEventBadge } from '@/components/sections/EducatorEventBadge'
import { EducatorSubscriptionFilters } from '@/components/sections/EducatorSubscriptionFilters'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getEventLabel } from '@/lib/educator-events'

// Plan filter options. The API groups every educator's current plan into one of these.
const plans = [
  { value: 'freemium', label: 'Freemium' },
  { value: 'premium', label: 'Premium' },
  { value: 'other', label: 'Other Plans' },
]
// Every status a subscription can have (subscriptions_status_check in the SSO database).
const statusOptions = ['active', 'pending', 'paused', 'grace_period', 'cancelled', 'expired']
  .map((value) => ({ value, label: formatStatus(value) }))
const pageSize = 20
const emptyFilters = { search: '', planType: '', status: '', dateRange: [], event: '' }

// Same status colours as the Sales Dashboard table.
const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
    case 'pending':
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
    case 'cancelled':
      return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
    case 'paused':
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
  }
}

// 'grace_period' -> 'Grace period'
function formatStatus(status) {
  const text = String(status || '').replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const formatDate = (value, pattern) => (value ? format(parseISO(value), pattern) : '-')

// Show where the plan comes from: the school/college's plan or the educator's own.
const formatPlan = (educator) =>
  educator.source === 'organization'
    ? `${educator.planName} (Organisation)`
    : `${educator.planName} (Personal)`

// Same filter -> query-string mapping the Sales Dashboard uses.
function buildFilterParams(filters) {
  const params = new URLSearchParams()
  if (filters.planType) params.set('planType', filters.planType)
  if (filters.status) params.set('status', filters.status)
  if (filters.search) params.set('search', filters.search)
  if (filters.event) params.set('event', filters.event)
  if (Array.isArray(filters.dateRange) && filters.dateRange.length >= 2) {
    const [startDate, endDate] = filters.dateRange
    if (startDate instanceof Date && isValid(startDate)) params.set('startDate', startDate.toISOString())
    // "To" is a date-only selection: send the inclusive end of that day.
    if (endDate instanceof Date && isValid(endDate)) params.set('endDate', endOfDay(endDate).toISOString())
  }
  return params
}

// Educator names/emails are user-entered: neutralise spreadsheet formulas in the CSV.
const csvCell = (value) => {
  const text = String(value ?? '')
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}

export function EducatorSubscriptionOverview() {
  const [educators, setEducators] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: pageSize, total: 0, totalPages: 0 })
  const [filters, setFilters] = useState(emptyFilters)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState(null)

  // One request per page/filter change; the backend returns only that page.
  const fetchEducators = useCallback(async (signal) => {
    setIsLoading(true)
    setError(null)
    try {
      const params = buildFilterParams(filters)
      params.set('page', String(page))
      params.set('limit', String(pageSize))

      const response = await fetch(`/api/educator-subscriptions?${params.toString()}`, { signal })
      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: 'Failed to fetch educator subscriptions' }))
        throw new Error(result.error || 'Failed to fetch educator subscriptions')
      }
      const result = await response.json()
      if (signal?.aborted) return
      setEducators(Array.isArray(result.data) ? result.data : [])
      setPagination(result.pagination || { page, limit: pageSize, total: 0, totalPages: 0 })
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message)
    } finally {
      if (!signal?.aborted) setIsLoading(false)
    }
  }, [filters, page])

  useEffect(() => {
    const controller = new AbortController()
    fetchEducators(controller.signal)
    return () => controller.abort()
  }, [fetchEducators])

  const totalPages = Math.max(1, pagination.totalPages)

  // Asks the backend for EVERY row matching the current filters (not just this page).
  const exportCsv = async () => {
    setIsExporting(true)
    try {
      const params = buildFilterParams(filters)
      params.set('export', 'true')

      const response = await fetch(`/api/educator-subscriptions?${params.toString()}`)
      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: 'Export failed' }))
        throw new Error(result.error || 'Export failed')
      }
      const { data = [] } = await response.json()

      const rows = [
        ['Educator Name', 'Email', 'Plan', 'Status', 'Subscription Date', 'Event'],
        ...data.map((educator) => [
          educator.name,
          educator.email,
          formatPlan(educator),
          formatStatus(educator.status),
          educator.subscriptionDate ? formatDate(educator.subscriptionDate, 'yyyy-MM-dd') : '',
          getEventLabel(educator.events) ?? '',
        ]),
      ]
      const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'educator-subscriptions.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      console.error('Export error:', err)
      alert(`Export failed: ${err.message}`)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-md"
          role="alert"
          aria-live="assertive"
        >
          <div>
            <p className="font-medium">Error loading educator subscriptions</p>
            <p className="text-sm">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchEducators()}>Retry</Button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
        <EducatorSubscriptionFilters
          filters={filters}
          filterMeta={{ planTypes: plans, statuses: statusOptions }}
          onFilterChange={(changes) => {
            setFilters((previous) => ({ ...previous, ...changes }))
            setPage(1)
          }}
          onReset={() => { setFilters(emptyFilters); setPage(1) }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-gray-500 dark:text-gray-400" role="status" aria-live="polite">
          Showing {educators.length} of {pagination.total} educators
        </div>
        <Button variant="outline" disabled={isLoading || isExporting || pagination.total === 0} onClick={exportCsv} aria-label="Export filtered educator subscriptions as CSV">
          <Download className="w-4 h-4 mr-2" aria-hidden="true" /> {isExporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4" role="status" aria-live="polite" aria-label="Loading educator subscriptions">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : (
        <>
        <ul className="sm:hidden divide-y dark:divide-gray-700" aria-label="Educator subscriptions">
          {educators.map((educator) => (
            <li key={educator.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{educator.name}</p>
                  <EducatorEventBadge events={educator.events} />
                </div>
                <Badge className={getStatusColor(educator.status)}>{formatStatus(educator.status)}</Badge>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 break-all">{educator.email}</p>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-gray-500 dark:text-gray-400">Plan</dt><dd>{formatPlan(educator)}</dd></div>
                <div><dt className="text-gray-500 dark:text-gray-400">Subscription Date</dt><dd>{formatDate(educator.subscriptionDate, 'MMM d, yyyy')}</dd></div>
              </dl>
            </li>
          ))}
          {educators.length === 0 && <li className="text-center py-12 text-sm text-gray-500 dark:text-gray-400">No educators found</li>}
        </ul>
        <div className="hidden sm:block">
        <Table aria-label="Educator subscriptions">
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">Educator Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-4 whitespace-nowrap">Subscription Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {educators.map((educator) => (
              <TableRow key={educator.id}>
                <TableCell className="px-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span>{educator.name}</span>
                    <EducatorEventBadge events={educator.events} />
                  </div>
                </TableCell>
                <TableCell className="text-gray-700 dark:text-gray-300">{educator.email}</TableCell>
                <TableCell className="whitespace-nowrap">{formatPlan(educator)}</TableCell>
                <TableCell>
                  <Badge className={getStatusColor(educator.status)}>{formatStatus(educator.status)}</Badge>
                </TableCell>
                <TableCell className="pr-4 whitespace-nowrap">{formatDate(educator.subscriptionDate, 'MMM d, yyyy')}</TableCell>
              </TableRow>
            ))}
            {educators.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-gray-500 dark:text-gray-400">No educators found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        </div>
        </>
        )}
        <nav className="flex items-center justify-center gap-3 p-3 border-t dark:border-gray-700" aria-label="Subscription pagination">
          <Button variant="outline" size="icon" title="Previous page" aria-label="Previous page" disabled={isLoading || page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="icon" title="Next page" aria-label="Next page" disabled={isLoading || page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </nav>
      </div>
    </div>
  )
}
