'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Trophy, Download, TrendingUp, Award } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useDebounce } from '@/hooks/use-debounce'

// Import new components
import { CertificateTable } from '@/components/certificates/CertificateTable'
import { CertificateFilterPanel } from '@/components/certificates/CertificateFilterPanel'

export default function StudentCertificatesPage() {
    const { toast } = useToast()
    
    // Data state
    const [certificates, setCertificates] = useState([])
    const [loading, setLoading] = useState(true)
    const [courses, setCourses] = useState([])
    const [loadingCourses, setLoadingCourses] = useState(true)
    const [stats, setStats] = useState({
        totalCertificates: 0,
        totalDownloads: 0,
        avgDownloadsPerCert: 0
    })
    
    // Filter state
    const [filters, setFilters] = useState({
        search: '',
        courseId: '',
        downloadRange: '',
        dateRange: []
    })
    
    // Pagination state
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
    })

    // Debounced search
    const debouncedSearch = useDebounce(filters.search, 500)

    // Fetch courses on mount
    useEffect(() => {
        fetchCourses()
    }, [])

    // Fetch certificates when filters or pagination change
    useEffect(() => {
        fetchCertificates()
    }, [debouncedSearch, filters.courseId, filters.downloadRange, filters.dateRange, pagination.page])

    // Reset to page 1 when filters change
    useEffect(() => {
        if (pagination.page !== 1) {
            setPagination(prev => ({ ...prev, page: 1 }))
        }
    }, [debouncedSearch, filters.courseId, filters.downloadRange, filters.dateRange])

    const fetchCourses = async () => {
        try {
            setLoadingCourses(true)
            const response = await fetch('/api/courses?limit=1000')
            const data = await response.json()
            if (response.ok && data.data) {
                setCourses(data.data)
            }
        } catch (error) {
            console.error('Error fetching courses:', error)
            toast({
                title: 'Error',
                description: 'Failed to load courses',
                variant: 'destructive'
            })
        } finally {
            setLoadingCourses(false)
        }
    }

    const fetchCertificates = async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: pagination.limit.toString()
            })
            
            if (debouncedSearch) params.append('search', debouncedSearch)
            if (filters.courseId) params.append('course_id', filters.courseId)
            if (filters.downloadRange) params.append('download_range', filters.downloadRange)
            if (filters.dateRange?.length === 2) {
                params.append('date_range_start', filters.dateRange[0].toISOString())
                params.append('date_range_end', filters.dateRange[1].toISOString())
            }

            const response = await fetch(`/api/student-dashboard/certificates?${params}`)
            const data = await response.json()

            if (response.ok && data.data) {
                setCertificates(data.data)
                setStats(data.stats || stats)
                setPagination(prev => ({
                    ...prev,
                    total: data.pagination?.total || 0,
                    totalPages: data.pagination?.totalPages || 0
                }))
                
                // Debug pagination data
                console.log('Pagination data received:', data.pagination)
                console.log('Certificates count:', data.data.length)
            } else {
                toast({
                    title: 'Error',
                    description: 'Failed to load certificates',
                    variant: 'destructive'
                })
            }
        } catch (error) {
            console.error('Error fetching certificates:', error)
            toast({
                title: 'Error',
                description: 'Failed to load certificates',
                variant: 'destructive'
            })
        } finally {
            setLoading(false)
        }
    }

    const handleFilterChange = (newFilters) => {
        setFilters(prev => ({ ...prev, ...newFilters }))
    }

    const handleResetFilters = () => {
        setFilters({
            search: '',
            courseId: '',
            downloadRange: '',
            dateRange: []
        })
    }

    const handlePageChange = (page) => {
        setPagination(prev => ({ ...prev, page }))
    }

    const handleExportCSV = () => {
        try {
            const headers = ['Student Name', 'Student Email', 'Course', 'Certificate ID', 'Issue Date', 'Downloads', 'Last Downloaded']
            
            const escapeCsv = (field) => {
                if (field === null || field === undefined) return ''
                const stringField = String(field)
                return `"${stringField.replace(/"/g, '""')}"`
            }

            const rows = certificates.map(cert => [
                cert.studentName,
                cert.studentEmail,
                cert.courseName,
                cert.certificateId,
                cert.issueDate ? new Date(cert.issueDate).toLocaleDateString() : '',
                cert.downloadCount || 0,
                cert.lastDownloaded ? new Date(cert.lastDownloaded).toLocaleDateString() : 'Never'
            ])

            const csvContent = [
                headers.map(h => `"${h}"`).join(','),
                ...rows.map(row => row.map(escapeCsv).join(','))
            ].join('\n')

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
            const link = document.createElement('a')
            link.href = URL.createObjectURL(blob)
            link.download = `certificates_export_${new Date().toISOString().split('T')[0]}.csv`
            link.click()

            toast({
                title: 'Success!',
                description: `Exported ${certificates.length} certificates to CSV`,
            })
        } catch (error) {
            console.error('Export error:', error)
            toast({
                title: 'Error',
                description: 'Failed to export certificates',
                variant: 'destructive'
            })
        }
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/20 dark:border-slate-700/50">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/25">
                        <Trophy className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Student Certificates
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            View certificates and download statistics ({stats.totalCertificates} total)
                        </p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    onClick={handleExportCSV}
                    disabled={certificates.length === 0}
                >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Certificates</CardTitle>
                        <Award className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalCertificates}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Downloads</CardTitle>
                        <Download className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalDownloads}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Downloads/Cert</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.avgDownloadsPerCert.toFixed(1)}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Filter Panel */}
            <CertificateFilterPanel
                filters={filters}
                onFilterChange={handleFilterChange}
                onReset={handleResetFilters}
                courses={courses}
                isLoadingCourses={loadingCourses}
            />

            {/* Certificates Table */}
            <CertificateTable
                data={certificates}
                pagination={pagination}
                isLoading={loading}
                onPageChange={handlePageChange}
            />
        </div>
    )
}
