'use client'

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TableLoader } from '@/components/ui/page-loader'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useToast } from '@/hooks/use-toast'
import {
    AlertCircle,
    Briefcase,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    Edit,
    Globe,
    LayoutGrid,
    List,
    Mail,
    MapPin,
    Phone,
    Plus,
    Search,
    Trash2,
    XCircle
} from 'lucide-react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { useEffect, useRef, useState } from 'react'

export default function RecruitersPageEnhanced({ currentUser }) {
    const [recruiters, setRecruiters] = useState([])
    const [loading, setLoading] = useState(true)
    const [viewMode, setViewMode] = useState('grid')
    const [actionDialog, setActionDialog] = useState({ open: false, recruiter: null, action: null })

    // Add/Edit Dialog State
    const [recruiterDialog, setRecruiterDialog] = useState({ open: false, mode: 'add', recruiter: null })
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        website: '',
        state: '',
        account_status: 'active'
    })
    const [formLoading, setFormLoading] = useState(false)

    const { toast } = useToast()

    // Overall stats
    const [overallStats, setOverallStats] = useState({
        total: 0,
        active: 0,
        pending: 0,
        suspended: 0
    })

    // Pagination state
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
    })

    // Filter state
    const [filters, setFilters] = useState({
        search: '',
        account_status: 'all',
        verification_status: 'all',
        sortBy: 'date-newest'
    })

    // Debounce timer for search
    const searchDebounceRef = useRef(null)

    useEffect(() => {
        fetchOverallStats()

        const handleRefresh = () => {
            fetchRecruiters()
            fetchOverallStats()
        }
        window.addEventListener('refreshPage', handleRefresh)

        return () => {
            window.removeEventListener('refreshPage', handleRefresh)
        }
    }, [])

    useEffect(() => {
        fetchRecruiters()
    }, [pagination.page, pagination.limit, filters])

    const fetchOverallStats = async () => {
        try {
            // Fetch all recruiters to calculate stats (or use a specific stats endpoint if available)
            // For now, fetching a large limit to approximate stats or we can implement a stats endpoint.
            // To be efficient, we might just use the counts from the filtered query if possible, 
            // but for "Overall" stats we need unfiltered. 
            // Let's just do a quick fetch of all or rely on the paginated response if we only want to show stats for current view?
            // No, usually stats are global.
            // Let's fetch with a high limit for now, or better, just use the counts we get if we can.
            // Actually, let's just fetch counts.

            const response = await fetch('/api/recruiters?limit=10000')
            const data = await response.json()
            const allRecruiters = data.data || []

            setOverallStats({
                total: data.pagination?.total || 0,
                active: allRecruiters.filter(r => r.account_status === 'active').length,
                pending: allRecruiters.filter(r => r.verificationstatus === 'pending').length,
                suspended: allRecruiters.filter(r => r.account_status === 'inactive' || r.account_status === 'suspended').length
            })
        } catch (error) {
            console.error('Error fetching stats:', error)
        }
    }

    const fetchRecruiters = async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: pagination.limit.toString(),
                sort: filters.sortBy
            })

            if (filters.search) params.append('search', filters.search)
            if (filters.account_status && filters.account_status !== 'all') params.append('account_status', filters.account_status)
            if (filters.verification_status && filters.verification_status !== 'all') params.append('verification_status', filters.verification_status)

            const response = await fetch(`/api/recruiters?${params}`)
            const data = await response.json()

            setRecruiters(data.data || [])
            setPagination(prev => ({
                ...prev,
                total: data.pagination?.total || 0,
                totalPages: data.pagination?.totalPages || 0
            }))
        } catch (error) {
            console.error('Error fetching recruiters:', error)
            toast({
                title: 'Error',
                description: 'Failed to fetch recruiters',
                variant: 'destructive'
            })
        } finally {
            setLoading(false)
        }
    }

    const handleSearchChange = (e) => {
        const value = e.target.value
        setFilters(prev => ({ ...prev, search: value }))

        if (searchDebounceRef.current) {
            clearTimeout(searchDebounceRef.current)
        }

        searchDebounceRef.current = setTimeout(() => {
            setPagination(prev => ({ ...prev, page: 1 }))
        }, 300)
    }

    const handleDelete = async () => {
        const { recruiter } = actionDialog
        try {
            const response = await fetch(`/api/recruiters/${recruiter.id}`, {
                method: 'DELETE'
            })
            const data = await response.json()

            if (data.success) {
                toast({
                    title: 'Success',
                    description: 'Recruiter deleted successfully'
                })
                fetchRecruiters()
                fetchOverallStats()
            } else {
                throw new Error(data.error)
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to delete recruiter',
                variant: 'destructive'
            })
        } finally {
            setActionDialog({ open: false, recruiter: null, action: null })
        }
    }

    const openAddDialog = () => {
        setFormData({
            name: '',
            email: '',
            phone: '',
            website: '',
            state: '',
            account_status: 'active'
        })
        setRecruiterDialog({ open: true, mode: 'add', recruiter: null })
    }

    const openEditDialog = (recruiter) => {
        setFormData({
            name: recruiter.name || '',
            email: recruiter.email || '',
            phone: recruiter.phone || '',
            website: recruiter.website || '',
            state: recruiter.state || '',
            account_status: recruiter.account_status || 'active'
        })
        setRecruiterDialog({ open: true, mode: 'edit', recruiter })
    }

    const handleFormSubmit = async () => {
        // Basic validation
        if (!formData.name || !formData.email) {
            toast({
                title: 'Validation Error',
                description: 'Name and Email are required',
                variant: 'destructive'
            })
            return
        }

        try {
            setFormLoading(true)
            const isEdit = recruiterDialog.mode === 'edit'
            const url = isEdit ? `/api/recruiters/${recruiterDialog.recruiter.id}` : '/api/recruiters'
            const method = isEdit ? 'PUT' : 'POST'

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })

            const data = await response.json()

            if (data.success) {
                toast({
                    title: 'Success',
                    description: `Recruiter ${isEdit ? 'updated' : 'created'} successfully`
                })
                setRecruiterDialog({ open: false, mode: 'add', recruiter: null })
                fetchRecruiters()
                fetchOverallStats()
            } else {
                throw new Error(data.error)
            }
        } catch (error) {
            console.error('Error saving recruiter:', error)
            toast({
                title: 'Error',
                description: 'Failed to save recruiter',
                variant: 'destructive'
            })
        } finally {
            setFormLoading(false)
        }
    }

    const getStatusBadge = (status) => {
        switch (status) {
            case 'active':
                return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200">Active</Badge>
            case 'inactive':
            case 'suspended':
                return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200">Suspended</Badge>
            default:
                return <Badge variant="outline">{status}</Badge>
        }
    }

    const getVerificationBadge = (status) => {
        switch (status) {
            case 'approved':
                return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200"><CheckCircle className="w-3 h-3 mr-1" /> Verified</Badge>
            case 'pending':
                return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200"><AlertCircle className="w-3 h-3 mr-1" /> Pending</Badge>
            case 'rejected':
                return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>
            default:
                return null
        }
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="neu-card bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Recruiters</p>
                                <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{overallStats.total}</p>
                            </div>
                            <div className="p-3 bg-blue-200 dark:bg-blue-900/40 rounded-xl">
                                <Briefcase className="h-7 w-7 text-blue-600 dark:text-blue-300" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="neu-card bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20 border-green-200 dark:border-green-800">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-green-600 dark:text-green-400">Active</p>
                                <p className="text-3xl font-bold text-green-900 dark:text-green-100">{overallStats.active}</p>
                            </div>
                            <div className="p-3 bg-green-200 dark:bg-green-900/40 rounded-xl">
                                <CheckCircle className="h-7 w-7 text-green-600 dark:text-green-300" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="neu-card bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-200 dark:border-amber-800">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Pending Verification</p>
                                <p className="text-3xl font-bold text-amber-900 dark:text-amber-100">{overallStats.pending}</p>
                            </div>
                            <div className="p-3 bg-amber-200 dark:bg-amber-900/40 rounded-xl">
                                <AlertCircle className="h-7 w-7 text-amber-600 dark:text-amber-300" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="neu-card bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/20 border-red-200 dark:border-red-800">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-red-600 dark:text-red-400">Suspended</p>
                                <p className="text-3xl font-bold text-red-900 dark:text-red-100">{overallStats.suspended}</p>
                            </div>
                            <div className="p-3 bg-red-200 dark:bg-red-900/40 rounded-xl">
                                <XCircle className="h-7 w-7 text-red-600 dark:text-red-300" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="neu-card">
                <CardHeader>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Recruiters Management</h2>
                                <p className="text-sm text-muted-foreground mt-1">Manage recruiter accounts and verifications</p>
                            </div>
                            <Button
                                onClick={openAddDialog}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Recruiter
                            </Button>
                        </div>

                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name, email, or website..."
                                    value={filters.search}
                                    onChange={handleSearchChange}
                                    className="pl-10"
                                />
                            </div>

                            <Select
                                value={filters.account_status}
                                onValueChange={(value) => {
                                    setFilters(prev => ({ ...prev, account_status: value }))
                                    setPagination(prev => ({ ...prev, page: 1 }))
                                }}
                            >
                                <SelectTrigger className="w-[160px]">
                                    <SelectValue placeholder="Account Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Suspended/Inactive</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select
                                value={filters.verification_status}
                                onValueChange={(value) => {
                                    setFilters(prev => ({ ...prev, verification_status: value }))
                                    setPagination(prev => ({ ...prev, page: 1 }))
                                }}
                            >
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Verification" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Verification</SelectItem>
                                    <SelectItem value="approved">Verified</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select
                                value={filters.sortBy}
                                onValueChange={(value) => {
                                    setFilters(prev => ({ ...prev, sortBy: value }))
                                }}
                            >
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Sort by" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="date-newest">Newest First</SelectItem>
                                    <SelectItem value="date-oldest">Oldest First</SelectItem>
                                    <SelectItem value="name-asc">Name A-Z</SelectItem>
                                    <SelectItem value="name-desc">Name Z-A</SelectItem>
                                </SelectContent>
                            </Select>

                            <div className="flex items-center border rounded-md bg-white dark:bg-gray-800">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={`rounded-none rounded-l-md ${viewMode === 'grid' ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
                                    onClick={() => setViewMode('grid')}
                                >
                                    <LayoutGrid className="h-4 w-4" />
                                </Button>
                                <div className="w-[1px] h-6 bg-gray-200 dark:bg-gray-700" />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={`rounded-none rounded-r-md ${viewMode === 'table' ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
                                    onClick={() => setViewMode('table')}
                                >
                                    <List className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="text-sm text-muted-foreground">
                            {!loading && `Showing ${recruiters.length} of ${pagination.total} recruiters`}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <TableLoader rows={5} />
                    ) : (
                        <div className="space-y-4">
                            {recruiters.length > 0 ? (
                                viewMode === 'grid' ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {recruiters.map((recruiter) => (
                                            <div key={recruiter.id} className="group p-5 bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 hover:to-gray-50 dark:from-gray-800/50 dark:to-gray-900/50 dark:hover:from-gray-800 dark:hover:to-gray-800/80 rounded-xl transition-all duration-200 border border-gray-200 dark:border-gray-700 hover:shadow-md flex flex-col h-full">
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-lg">
                                                        {recruiter.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => openEditDialog(recruiter)}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            onClick={() => setActionDialog({ open: true, recruiter, action: 'delete' })}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="flex-1">
                                                    <div className="mb-3">
                                                        <h3 className="font-semibold text-lg dark:text-white line-clamp-1" title={recruiter.name}>{recruiter.name}</h3>
                                                        <div className="flex flex-wrap gap-2 mt-2">
                                                            {getStatusBadge(recruiter.account_status)}
                                                            {getVerificationBadge(recruiter.verificationstatus)}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2 text-sm text-muted-foreground">
                                                        <div className="flex items-center gap-2">
                                                            <Mail className="h-4 w-4 flex-shrink-0" />
                                                            <span className="truncate" title={recruiter.email}>{recruiter.email}</span>
                                                        </div>
                                                        {recruiter.phone && (
                                                            <div className="flex items-center gap-2">
                                                                <Phone className="h-4 w-4 flex-shrink-0" />
                                                                <span>{recruiter.phone}</span>
                                                            </div>
                                                        )}
                                                        {recruiter.website && (
                                                            <div className="flex items-center gap-2">
                                                                <Globe className="h-4 w-4 flex-shrink-0" />
                                                                <a href={recruiter.website} target="_blank" rel="noreferrer" className="hover:underline text-blue-600 dark:text-blue-400 truncate">
                                                                    {recruiter.website}
                                                                </a>
                                                            </div>
                                                        )}
                                                        {recruiter.state && (
                                                            <div className="flex items-center gap-2">
                                                                <MapPin className="h-4 w-4 flex-shrink-0" />
                                                                <span>{recruiter.state}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Verification</TableHead>
                                                    <TableHead>Contact</TableHead>
                                                    <TableHead>Location</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {recruiters.map((recruiter) => (
                                                    <TableRow key={recruiter.id}>
                                                        <TableCell className="font-medium">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-xs">
                                                                    {recruiter.name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span>{recruiter.name}</span>
                                                                    {recruiter.website && (
                                                                        <a href={recruiter.website} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:underline">
                                                                            {recruiter.website}
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{getStatusBadge(recruiter.account_status)}</TableCell>
                                                        <TableCell>{getVerificationBadge(recruiter.verificationstatus)}</TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col text-sm">
                                                                <span>{recruiter.email}</span>
                                                                {recruiter.phone && <span className="text-muted-foreground text-xs">{recruiter.phone}</span>}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{recruiter.state || '-'}</TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8"
                                                                    onClick={() => openEditDialog(recruiter)}
                                                                >
                                                                    <Edit className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                    onClick={() => setActionDialog({ open: true, recruiter, action: 'delete' })}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )
                            ) : (
                                <div className="text-center py-16">
                                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                                        <Briefcase className="h-8 w-8 text-muted-foreground opacity-50" />
                                    </div>
                                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">No recruiters found</p>
                                    <p className="text-sm text-muted-foreground mt-2">
                                        Try adjusting your filters or add a new recruiter.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Pagination */}
                    {!loading && pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between mt-6 pt-4 border-t">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">
                                    Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                    disabled={pagination.page === 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                    disabled={pagination.page === pagination.totalPages}
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ ...actionDialog, open })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Recruiter</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete {actionDialog.recruiter?.name}? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Add/Edit Dialog */}
            <Dialog open={recruiterDialog.open} onOpenChange={(open) => setRecruiterDialog(prev => ({ ...prev, open }))}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{recruiterDialog.mode === 'add' ? 'Add New Recruiter' : 'Edit Recruiter'}</DialogTitle>
                        <DialogDescription>
                            {recruiterDialog.mode === 'add'
                                ? 'Enter the details of the new recruiter.'
                                : 'Update the recruiter details.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Company Name <span className="text-red-500">*</span></Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="e.g. Acme Corp"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                placeholder="contact@example.com"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input
                                    id="phone"
                                    value={formData.phone}
                                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                    placeholder="+1234567890"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="state">State</Label>
                                <Input
                                    id="state"
                                    value={formData.state}
                                    onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                                    placeholder="e.g. California"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="website">Website</Label>
                            <Input
                                id="website"
                                value={formData.website}
                                onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                                placeholder="https://example.com"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="status">Account Status</Label>
                            <Select
                                value={formData.account_status}
                                onValueChange={(value) => setFormData(prev => ({ ...prev, account_status: value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                    <SelectItem value="suspended">Suspended</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRecruiterDialog(prev => ({ ...prev, open: false }))}>
                            Cancel
                        </Button>
                        <Button onClick={handleFormSubmit} disabled={formLoading}>
                            {formLoading ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
