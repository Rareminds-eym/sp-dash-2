'use client'

import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { AlertCircle, AlertTriangle, Building2, Plus, Search, Sparkles, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

const ADMIN_ROLES = ['super_admin', 'platform_admin', 'rm_admin']
const ORG_TYPES = [
    { value: 'school', label: 'School' },
    { value: 'college', label: 'College' },
    { value: 'university', label: 'University' },
]
const BILLING_CYCLES = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'annual', label: 'Annual' },
    { value: 'lifetime', label: 'Lifetime' },
]

const STATUS_BADGE = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    paused: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    grace_period: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
}

const TERMS_INITIAL = {
    planAmount: '',
    seatCount: '',
    billingCycle: 'annual',
    features: '',
    notes: '',
}

const NEW_ORG_INITIAL = {
    orgName: '',
    orgType: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
    ...TERMS_INITIAL,
}

function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '—'
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

function formatDate(dateStr) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function HybridPlanActivationPage({ currentUser }) {
    const { toast } = useToast()

    // Sourced from the verified SSO JWT (see lib/supabase-rls.js getSession()),
    // not skillpassport's users.role/admin_users — those can be null even for
    // accounts with real SSO admin roles. This is a UI-only convenience gate;
    // the actual enforcement is server-side in the API routes.
    const userRoles = currentUser?.roles || []
    const isAuthorized = userRoles.some((role) => ADMIN_ROLES.includes(role))

    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(true)
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })

    const [filters, setFilters] = useState({ search: '', planCode: 'all', status: 'all' })

    // Upgrade-existing-org dialog
    const [upgradeDialog, setUpgradeDialog] = useState({ open: false, org: null })
    const [upgradeForm, setUpgradeForm] = useState(TERMS_INITIAL)
    const [upgradeSubmitting, setUpgradeSubmitting] = useState(false)

    // New-organization dialog
    const [newOrgDialog, setNewOrgDialog] = useState(false)
    const [newOrgForm, setNewOrgForm] = useState(NEW_ORG_INITIAL)
    const [newOrgSubmitting, setNewOrgSubmitting] = useState(false)

    // Delete-organization dialog
    const [deleteDialog, setDeleteDialog] = useState({ open: false, org: null })
    const [deletePreview, setDeletePreview] = useState(null)
    const [deletePreviewLoading, setDeletePreviewLoading] = useState(false)
    const [deleteMode, setDeleteMode] = useState('soft')
    const [deleteConfirmText, setDeleteConfirmText] = useState('')
    const [deleteSubmitting, setDeleteSubmitting] = useState(false)

    const fetchOrganizations = useCallback(async (page = 1) => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ page: String(page), limit: String(pagination.limit) })
            if (filters.search) params.set('search', filters.search)
            if (filters.planCode !== 'all') params.set('planCode', filters.planCode)
            if (filters.status !== 'all') params.set('status', filters.status)

            const response = await fetch(`/api/organizations/subscriptions?${params.toString()}`)
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Failed to load organizations')

            setRows(data.data || [])
            setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
        } catch (err) {
            toast({ title: 'Failed to load organizations', description: err.message, variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }, [filters, pagination.limit, toast])

    useEffect(() => {
        if (!isAuthorized) return
        const timer = setTimeout(() => fetchOrganizations(1), 300) // debounce search
        return () => clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.search, filters.planCode, filters.status, isAuthorized])

    const planOptions = useMemo(() => {
        const codes = new Set(rows.map((r) => r.plan_code).filter(Boolean))
        return Array.from(codes)
    }, [rows])

    function openUpgradeDialog(org) {
        setUpgradeForm(TERMS_INITIAL)
        setUpgradeDialog({ open: true, org })
    }

    async function handleUpgradeSubmit(e) {
        e.preventDefault()
        const amount = Number(upgradeForm.planAmount)
        const seats = Number(upgradeForm.seatCount)
        if (!Number.isFinite(amount) || amount < 0) {
            toast({ title: 'Check the form', description: 'Enter a valid negotiated price', variant: 'destructive' })
            return
        }
        if (!Number.isInteger(seats) || seats < 1) {
            toast({ title: 'Check the form', description: 'Enter a valid seat count', variant: 'destructive' })
            return
        }

        setUpgradeSubmitting(true)
        try {
            const features = upgradeForm.features.split(',').map((f) => f.trim()).filter(Boolean)
            const response = await fetch(`/api/organizations/${upgradeDialog.org.organization_id}/subscriptions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan_amount: amount,
                    seat_count: seats,
                    billing_cycle: upgradeForm.billingCycle,
                    features,
                    notes: upgradeForm.notes || undefined,
                }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Failed to activate Hybrid subscription')

            toast({ title: 'Hybrid activated', description: `${upgradeDialog.org.organization_name} is now on the Hybrid plan.` })
            setUpgradeDialog({ open: false, org: null })
            fetchOrganizations(pagination.page)
        } catch (err) {
            toast({ title: 'Activation failed', description: err.message, variant: 'destructive' })
        } finally {
            setUpgradeSubmitting(false)
        }
    }

    async function handleNewOrgSubmit(e) {
        e.preventDefault()
        const amount = Number(newOrgForm.planAmount)
        const seats = Number(newOrgForm.seatCount)

        if (!newOrgForm.orgName.trim()) {
            toast({ title: 'Check the form', description: 'Organization name is required', variant: 'destructive' })
            return
        }
        if (!newOrgForm.orgType) {
            toast({ title: 'Check the form', description: 'Select an organization type', variant: 'destructive' })
            return
        }
        if (!newOrgForm.ownerEmail.trim()) {
            toast({ title: 'Check the form', description: 'Owner email is required', variant: 'destructive' })
            return
        }
        if (!newOrgForm.ownerPassword || newOrgForm.ownerPassword.length < 8) {
            toast({ title: 'Check the form', description: 'Owner password must be at least 8 characters', variant: 'destructive' })
            return
        }
        if (!Number.isFinite(amount) || amount < 0) {
            toast({ title: 'Check the form', description: 'Enter a valid negotiated price', variant: 'destructive' })
            return
        }
        if (!Number.isInteger(seats) || seats < 1) {
            toast({ title: 'Check the form', description: 'Enter a valid seat count', variant: 'destructive' })
            return
        }

        setNewOrgSubmitting(true)
        try {
            const features = newOrgForm.features.split(',').map((f) => f.trim()).filter(Boolean)
            const response = await fetch('/api/organizations/subscriptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    org_name: newOrgForm.orgName.trim(),
                    org_type: newOrgForm.orgType,
                    owner_name: newOrgForm.ownerName || undefined,
                    owner_email: newOrgForm.ownerEmail.trim(),
                    owner_password: newOrgForm.ownerPassword,
                    plan_amount: amount,
                    seat_count: seats,
                    billing_cycle: newOrgForm.billingCycle,
                    features,
                    notes: newOrgForm.notes || undefined,
                }),
            })
            const data = await response.json()

            if (!response.ok) {
                if (data.partialSuccess) {
                    // Org + owner were created; only the Hybrid activation step
                    // failed. Don't let the admin think nothing happened —
                    // recreating the org would fail with "already exists".
                    toast({
                        title: 'Organization created, but activation failed',
                        description: `${data.error} Use "Switch to Hybrid" on this organization's row to retry — do not create it again.`,
                        variant: 'destructive',
                    })
                    setNewOrgDialog(false)
                    setNewOrgForm(NEW_ORG_INITIAL)
                    fetchOrganizations(1)
                    return
                }
                throw new Error(data.error || 'Failed to create organization')
            }

            toast({ title: 'Organization created', description: `${newOrgForm.orgName} is now on the Hybrid plan.` })
            setNewOrgDialog(false)
            setNewOrgForm(NEW_ORG_INITIAL)
            fetchOrganizations(1)
        } catch (err) {
            toast({ title: 'Creation failed', description: err.message, variant: 'destructive' })
        } finally {
            setNewOrgSubmitting(false)
        }
    }

    async function openDeleteDialog(org) {
        setDeleteMode('soft')
        setDeleteConfirmText('')
        setDeletePreview(null)
        setDeleteDialog({ open: true, org })
        setDeletePreviewLoading(true)
        try {
            const response = await fetch(`/api/organizations/${org.organization_id}`)
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Failed to load organization details')
            setDeletePreview(data.data)
        } catch (err) {
            toast({ title: 'Failed to load organization details', description: err.message, variant: 'destructive' })
        } finally {
            setDeletePreviewLoading(false)
        }
    }

    function closeDeleteDialog(open) {
        if (!open) setDeleteDialog({ open: false, org: null })
    }

    async function handleDeleteConfirm() {
        if (!deleteDialog.org) return
        const expectedText = deleteDialog.org.organization_name
        if (deleteConfirmText.trim() !== expectedText) {
            toast({
                title: 'Confirmation text does not match',
                description: `Type "${expectedText}" exactly to confirm.`,
                variant: 'destructive',
            })
            return
        }

        const hasActiveSubscription = deletePreview?.has_active_subscription
        setDeleteSubmitting(true)
        try {
            const response = await fetch(`/api/organizations/${deleteDialog.org.organization_id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: deleteMode, force: hasActiveSubscription }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || `Failed to ${deleteMode}-delete organization`)

            toast({
                title: deleteMode === 'hard' ? 'Organization permanently deleted' : 'Organization soft-deleted',
                description: `${expectedText} has been removed.`,
            })
            setDeleteDialog({ open: false, org: null })
            fetchOrganizations(pagination.page)
        } catch (err) {
            toast({ title: 'Deletion failed', description: err.message, variant: 'destructive' })
        } finally {
            setDeleteSubmitting(false)
        }
    }

    if (!isAuthorized) {
        return (
            <div className="p-6">
                <Card>
                    <CardContent className="flex items-center gap-3 py-6 text-destructive">
                        <AlertCircle className="h-5 w-5" />
                        <p>You don&apos;t have permission to manage Hybrid subscriptions.</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-semibold">Organizations &amp; Plans</h1>
                    <p className="text-muted-foreground mt-1">
                        View every organization&apos;s subscription, and activate Hybrid — a
                        contact-sales plan — for new or existing customers once terms are negotiated.
                    </p>
                </div>
                <Button onClick={() => setNewOrgDialog(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Hybrid Organization
                </Button>
            </div>

            <Card>
                <CardContent className="pt-6 space-y-4">
                    <div className="flex flex-wrap gap-3">
                        <div className="relative flex-1 min-w-[220px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search organizations..."
                                className="pl-9"
                                value={filters.search}
                                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                            />
                        </div>
                        <Select value={filters.planCode} onValueChange={(v) => setFilters((f) => ({ ...f, planCode: v }))}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Plan" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All plans</SelectItem>
                                <SelectItem value="none">No subscription</SelectItem>
                                {planOptions.map((code) => (
                                    <SelectItem key={code} value={code}>{code}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All statuses</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="paused">Paused</SelectItem>
                                <SelectItem value="grace_period">Grace period</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                                <SelectItem value="expired">Expired</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {loading ? (
                        <TableLoader />
                    ) : rows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                            <Building2 className="h-8 w-8" />
                            <p>No organizations match these filters.</p>
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Organization</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Plan</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Seats</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Start date</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.map((org) => {
                                        const isHybrid = org.plan_code === 'hybrid'
                                        const hasActiveSub = org.status === 'active' || org.status === 'pending'
                                        return (
                                            <TableRow key={org.organization_id}>
                                                <TableCell className="font-medium">{org.organization_name}</TableCell>
                                                <TableCell className="capitalize">{org.organization_type || '—'}</TableCell>
                                                <TableCell>
                                                    {org.plan_type ? (
                                                        <span className={isHybrid ? 'font-medium text-primary flex items-center gap-1' : ''}>
                                                            {isHybrid && <Sparkles className="h-3.5 w-3.5" />}
                                                            {org.plan_type}
                                                        </span>
                                                    ) : '—'}
                                                </TableCell>
                                                <TableCell>
                                                    {org.status ? (
                                                        <Badge className={STATUS_BADGE[org.status] || ''} variant="outline">
                                                            {org.status.replace('_', ' ')}
                                                        </Badge>
                                                    ) : '—'}
                                                </TableCell>
                                                <TableCell>{org.seat_count ?? '—'}</TableCell>
                                                <TableCell>{formatCurrency(org.plan_amount)}</TableCell>
                                                <TableCell>{formatDate(org.subscription_start_date)}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {isHybrid && hasActiveSub ? (
                                                            <span className="text-xs text-muted-foreground self-center">On Hybrid</span>
                                                        ) : (
                                                            <Button size="sm" variant="outline" onClick={() => openUpgradeDialog(org)}>
                                                                {org.plan_code ? 'Switch to Hybrid' : 'Activate Hybrid'}
                                                            </Button>
                                                        )}
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                            onClick={() => openDeleteDialog(org)}
                                                            title="Remove organization"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>

                            {pagination.totalPages > 1 && (
                                <div className="flex items-center justify-between pt-2">
                                    <p className="text-sm text-muted-foreground">
                                        Page {pagination.page} of {pagination.totalPages} ({pagination.total} organizations)
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={pagination.page <= 1}
                                            onClick={() => fetchOrganizations(pagination.page - 1)}
                                        >
                                            Previous
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={pagination.page >= pagination.totalPages}
                                            onClick={() => fetchOrganizations(pagination.page + 1)}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Upgrade existing org to Hybrid */}
            <Dialog open={upgradeDialog.open} onOpenChange={(open) => setUpgradeDialog({ open, org: open ? upgradeDialog.org : null })}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Activate Hybrid for {upgradeDialog.org?.organization_name}</DialogTitle>
                        <DialogDescription>
                            Only use this after the sales team has negotiated the seat count, price, and features.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUpgradeSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="up-price">Negotiated price (INR) *</Label>
                                <Input
                                    id="up-price"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={upgradeForm.planAmount}
                                    onChange={(e) => setUpgradeForm((f) => ({ ...f, planAmount: e.target.value }))}
                                    placeholder="e.g. 150000"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="up-seats">Seat count *</Label>
                                <Input
                                    id="up-seats"
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={upgradeForm.seatCount}
                                    onChange={(e) => setUpgradeForm((f) => ({ ...f, seatCount: e.target.value }))}
                                    placeholder="e.g. 500"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="up-cycle">Billing cycle</Label>
                            <Select value={upgradeForm.billingCycle} onValueChange={(v) => setUpgradeForm((f) => ({ ...f, billingCycle: v }))}>
                                <SelectTrigger id="up-cycle"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {BILLING_CYCLES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="up-features">Negotiated features (comma-separated)</Label>
                            <Input
                                id="up-features"
                                value={upgradeForm.features}
                                onChange={(e) => setUpgradeForm((f) => ({ ...f, features: e.target.value }))}
                                placeholder="e.g. custom_branding, dedicated_support, sso"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="up-notes">Sales notes (optional)</Label>
                            <Textarea
                                id="up-notes"
                                value={upgradeForm.notes}
                                onChange={(e) => setUpgradeForm((f) => ({ ...f, notes: e.target.value }))}
                                rows={3}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={upgradeSubmitting}>
                                {upgradeSubmitting ? 'Activating...' : 'Activate Hybrid subscription'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* New Hybrid organization */}
            <Dialog open={newOrgDialog} onOpenChange={setNewOrgDialog}>
                <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>New Hybrid Organization</DialogTitle>
                        <DialogDescription>
                            Creates a new organization, an owner account for it, and activates
                            Hybrid in one step. Use this for sales-negotiated new customers.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleNewOrgSubmit} className="space-y-4">
                        <div className="space-y-3 rounded-lg border p-3">
                            <p className="text-sm font-medium">Organization</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="new-org-name">Name *</Label>
                                    <Input
                                        id="new-org-name"
                                        value={newOrgForm.orgName}
                                        onChange={(e) => setNewOrgForm((f) => ({ ...f, orgName: e.target.value }))}
                                        placeholder="e.g. Springfield High School"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="new-org-type">Type *</Label>
                                    <Select value={newOrgForm.orgType} onValueChange={(v) => setNewOrgForm((f) => ({ ...f, orgType: v }))}>
                                        <SelectTrigger id="new-org-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                                        <SelectContent>
                                            {ORG_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 rounded-lg border p-3">
                            <p className="text-sm font-medium">Owner account</p>
                            <div className="space-y-2">
                                <Label htmlFor="new-owner-name">Owner name</Label>
                                <Input
                                    id="new-owner-name"
                                    value={newOrgForm.ownerName}
                                    onChange={(e) => setNewOrgForm((f) => ({ ...f, ownerName: e.target.value }))}
                                    placeholder="e.g. Jane Doe"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="new-owner-email">Owner email *</Label>
                                    <Input
                                        id="new-owner-email"
                                        type="email"
                                        value={newOrgForm.ownerEmail}
                                        onChange={(e) => setNewOrgForm((f) => ({ ...f, ownerEmail: e.target.value }))}
                                        placeholder="admin@school.edu"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="new-owner-password">Temporary password *</Label>
                                    <Input
                                        id="new-owner-password"
                                        type="password"
                                        value={newOrgForm.ownerPassword}
                                        onChange={(e) => setNewOrgForm((f) => ({ ...f, ownerPassword: e.target.value }))}
                                        placeholder="At least 8 characters"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 rounded-lg border p-3">
                            <p className="text-sm font-medium">Hybrid subscription terms</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="new-price">Negotiated price (INR) *</Label>
                                    <Input
                                        id="new-price"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={newOrgForm.planAmount}
                                        onChange={(e) => setNewOrgForm((f) => ({ ...f, planAmount: e.target.value }))}
                                        placeholder="e.g. 150000"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="new-seats">Seat count *</Label>
                                    <Input
                                        id="new-seats"
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={newOrgForm.seatCount}
                                        onChange={(e) => setNewOrgForm((f) => ({ ...f, seatCount: e.target.value }))}
                                        placeholder="e.g. 500"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-cycle">Billing cycle</Label>
                                <Select value={newOrgForm.billingCycle} onValueChange={(v) => setNewOrgForm((f) => ({ ...f, billingCycle: v }))}>
                                    <SelectTrigger id="new-cycle"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {BILLING_CYCLES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-features">Negotiated features (comma-separated)</Label>
                                <Input
                                    id="new-features"
                                    value={newOrgForm.features}
                                    onChange={(e) => setNewOrgForm((f) => ({ ...f, features: e.target.value }))}
                                    placeholder="e.g. custom_branding, dedicated_support, sso"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-notes">Sales notes (optional)</Label>
                                <Textarea
                                    id="new-notes"
                                    value={newOrgForm.notes}
                                    onChange={(e) => setNewOrgForm((f) => ({ ...f, notes: e.target.value }))}
                                    rows={2}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="submit" disabled={newOrgSubmitting}>
                                {newOrgSubmitting ? 'Creating...' : 'Create organization & activate Hybrid'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Remove organization */}
            <AlertDialog open={deleteDialog.open} onOpenChange={closeDeleteDialog}>
                <AlertDialogContent className="max-w-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Remove {deleteDialog.org?.organization_name}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This action affects the organization&apos;s members and subscriptions.
                            Choose carefully — hard delete cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {deletePreviewLoading ? (
                        <div className="py-4 text-sm text-muted-foreground">Loading organization details...</div>
                    ) : (
                        <div className="space-y-4">
                            {deletePreview && (
                                <div className="rounded-lg border p-3 space-y-1 text-sm">
                                    <p><span className="text-muted-foreground">Members:</span> {deletePreview.membership_count}</p>
                                    <p><span className="text-muted-foreground">Subscriptions on record:</span> {deletePreview.subscription_count}</p>
                                    {deletePreview.has_active_subscription && (
                                        <p className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                                            <AlertTriangle className="h-3.5 w-3.5" />
                                            This organization has an active or pending subscription.
                                        </p>
                                    )}
                                </div>
                            )}

                            <RadioGroup value={deleteMode} onValueChange={setDeleteMode} className="gap-3">
                                <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                                    <RadioGroupItem value="soft" id="delete-soft" className="mt-1" />
                                    <div>
                                        <p className="font-medium">Soft delete</p>
                                        <p className="text-sm text-muted-foreground">
                                            Marks the organization removed and deactivates its members.
                                            Reversible — no data is destroyed.
                                        </p>
                                    </div>
                                </label>
                                <label className="flex items-start gap-3 rounded-lg border border-destructive/40 p-3 cursor-pointer hover:bg-destructive/5">
                                    <RadioGroupItem value="hard" id="delete-hard" className="mt-1" />
                                    <div>
                                        <p className="font-medium text-destructive">Hard delete</p>
                                        <p className="text-sm text-muted-foreground">
                                            Permanently deletes the organization, its subscriptions, and any
                                            member who belongs only to this organization. Cannot be undone.
                                        </p>
                                    </div>
                                </label>
                            </RadioGroup>

                            <div className="space-y-2">
                                <Label htmlFor="delete-confirm">
                                    Type <span className="font-semibold">{deleteDialog.org?.organization_name}</span> to confirm
                                </Label>
                                <Input
                                    id="delete-confirm"
                                    value={deleteConfirmText}
                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                    placeholder={deleteDialog.org?.organization_name}
                                    autoComplete="off"
                                />
                            </div>
                        </div>
                    )}

                    <AlertDialogFooter>
                        <Button variant="outline" onClick={() => closeDeleteDialog(false)} disabled={deleteSubmitting}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteConfirm}
                            disabled={deleteSubmitting || deletePreviewLoading || deleteConfirmText.trim() !== deleteDialog.org?.organization_name}
                        >
                            {deleteSubmitting ? 'Removing...' : deleteMode === 'hard' ? 'Permanently delete' : 'Soft delete'}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
