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
import { Checkbox } from '@/components/ui/checkbox'
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
import { Progress } from '@/components/ui/progress'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    Building2,
    Calendar,
    Check,
    CheckCheck,
    CheckCircle2,
    ChevronRight,
    Copy,
    CreditCard,
    Eye,
    EyeOff,
    FileText,
    GraduationCap,
    HelpCircle,
    Layers,
    Lock,
    Mail,
    Phone,
    Plus,
    RefreshCw,
    School,
    Search,
    ShieldCheck,
    SlidersHorizontal,
    Sparkles,
    Trash2,
    TrendingUp,
    User,
    Users,
    X,
    Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

const ADMIN_ROLES = ['super_admin', 'platform_admin', 'rm_admin']

const ORG_TYPES = [
    {
        value: 'school',
        label: 'School',
        role: 'school_admin',
        description: 'K-12, secondary & primary academies',
        icon: School,
        accent: 'from-blue-500/10 via-sky-500/5 to-transparent border-blue-500/20 text-blue-600 dark:text-blue-400',
        badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    },
    {
        value: 'college',
        label: 'College',
        role: 'college_admin',
        description: 'Undergraduate, polytechnic & vocational institutes',
        icon: GraduationCap,
        accent: 'from-indigo-500/10 via-violet-500/5 to-transparent border-indigo-500/20 text-indigo-600 dark:text-indigo-400',
        badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    },
    {
        value: 'university',
        label: 'University',
        role: 'university_admin',
        description: 'Multi-campus higher research & doctoral universities',
        icon: Building2,
        accent: 'from-purple-500/10 via-fuchsia-500/5 to-transparent border-purple-500/20 text-purple-600 dark:text-purple-400',
        badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    },
]

const ORG_TYPE_TO_ADMIN_ROLE = {
    school: 'school_admin',
    college: 'college_admin',
    university: 'university_admin',
}

const BILLING_CYCLES = [
    { value: 'yearly', label: 'Yearly billing', badge: 'Standard Enterprise', popular: true, desc: 'Billed once per year' },
    { value: 'monthly', label: 'Monthly billing', badge: 'Flexible', popular: false, desc: 'Billed every month' },
    { value: 'lifetime', label: 'Lifetime license', badge: 'Full Upfront', popular: false, desc: 'One-off perpetuity contract' },
]

const SEAT_PRESETS = [100, 250, 500, 1000, 2500, 5000]

const STATUS_BADGE = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    paused: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300 border-slate-200 dark:border-slate-800',
    cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    expired: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-800',
    grace_period: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200 dark:border-orange-800',
}

const TERMS_INITIAL = {
    planAmount: '',
    seatCount: '',
    billingCycle: 'yearly',
    features: [],
    notes: '',
}

const NEW_ORG_INITIAL = {
    orgName: '',
    orgType: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    ownerPassword: '',
    ...TERMS_INITIAL,
}

const PASSWORD_MIN = 10
const PASSWORD_MAX = 72

function formatCurrency(amount) {
    if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '—'
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(Number(amount))
}

function formatDate(dateStr) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    })
}

function getAvatarColor(name = '') {
    const colors = [
        'bg-blue-600 text-white',
        'bg-indigo-600 text-white',
        'bg-purple-600 text-white',
        'bg-emerald-600 text-white',
        'bg-amber-600 text-white',
        'bg-rose-600 text-white',
        'bg-cyan-600 text-white',
    ]
    let hash = 0
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
}

function validatePassword(password) {
    if (!password || password.length < PASSWORD_MIN) {
        return `Password must be at least ${PASSWORD_MIN} characters`
    }
    if (password.length > PASSWORD_MAX) {
        return `Password must be at most ${PASSWORD_MAX} characters`
    }
    const typesCount = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) => r.test(password)).length
    if (typesCount < 3) {
        return 'Password must contain at least 3 of: uppercase letters, lowercase letters, numbers, special characters'
    }
    return null
}

function calculatePasswordScore(password) {
    if (!password) return 0
    let score = 0
    if (password.length >= 10) score += 20
    if (password.length >= 14) score += 20
    if (/[A-Z]/.test(password)) score += 15
    if (/[a-z]/.test(password)) score += 15
    if (/[0-9]/.test(password)) score += 15
    if (/[^a-zA-Z0-9]/.test(password)) score += 15
    return Math.min(score, 100)
}

function generateSecurePassword() {
    const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    const lowers = 'abcdefghijkmnpqrstuvwxyz'
    const numbers = '23456789'
    const symbols = '!@#$%^&*()_+-='
    const randomPick = (charset, n) =>
        Array.from({ length: n }, () => charset[Math.floor(Math.random() * charset.length)])

    const parts = [
        ...randomPick(uppers, 3),
        ...randomPick(lowers, 5),
        ...randomPick(numbers, 3),
        ...randomPick(symbols, 2),
    ]
    return parts.sort(() => Math.random() - 0.5).join('')
}

/**
 * Modern Unit Economics & Commercial Calculator
 */
function UnitEconomicsCard({ planAmount, seatCount, billingCycle }) {
    const amount = Number(planAmount) || 0
    const seats = Number(seatCount) || 0

    const perSeatPerYear = seats > 0 ? (billingCycle === 'monthly' ? (amount * 12) / seats : amount / seats) : 0
    const perSeatPerMonth = perSeatPerYear > 0 ? perSeatPerYear / 12 : 0

    return (
        <div className="rounded-xl border bg-gradient-to-br from-card via-muted/30 to-muted/60 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Contract Economics &amp; Unit Value
                    </span>
                </div>
                <Badge variant="outline" className="text-[11px] font-mono capitalize">
                    {billingCycle}
                </Badge>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-background/80 p-2.5 border">
                    <p className="text-[11px] text-muted-foreground">Total Deal Value</p>
                    <p className="text-base font-bold text-foreground mt-0.5">
                        {amount > 0 ? formatCurrency(amount) : '₹0'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                        {billingCycle === 'yearly' ? 'Per annum' : billingCycle === 'monthly' ? 'Per month' : 'Perpetual'}
                    </p>
                </div>

                <div className="rounded-lg bg-background/80 p-2.5 border">
                    <p className="text-[11px] text-muted-foreground">Effective / Seat / Yr</p>
                    <p className="text-base font-bold text-primary mt-0.5">
                        {perSeatPerYear > 0 ? formatCurrency(Math.round(perSeatPerYear)) : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                        {seats > 0 ? `Across ${seats.toLocaleString()} seats` : 'No seats set'}
                    </p>
                </div>

                <div className="rounded-lg bg-background/80 p-2.5 border">
                    <p className="text-[11px] text-muted-foreground">Effective / Seat / Mo</p>
                    <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {perSeatPerMonth > 0 ? formatCurrency(Math.round(perSeatPerMonth)) : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Estimated learner rate</p>
                </div>
            </div>
        </div>
    )
}

/**
 * World-Class Feature Entitlement Matrix & Selector
 */
function EnhancedFeatureSelector({ role, featureKeys = [], loading, selected = [], onChange }) {
    const [searchTerm, setSearchTerm] = useState('')

    if (!role) {
        return (
            <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed text-center bg-muted/20">
                <Layers className="h-8 w-8 text-muted-foreground/60 mb-2" />
                <p className="text-sm font-medium">Select an Organization Type First</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    Entitlements and permission features are scoped dynamically based on the administrative role.
                </p>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="space-y-3 p-4 rounded-xl border bg-muted/10">
                <div className="flex items-center justify-between">
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-10 bg-muted/60 animate-pulse rounded-lg" />
                    ))}
                </div>
            </div>
        )
    }

    if (!featureKeys || featureKeys.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-6 rounded-xl border bg-muted/10 text-center">
                <AlertCircle className="h-6 w-6 text-muted-foreground mb-1" />
                <p className="text-sm font-medium">No Grantable Features Found</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                    No active feature keys exist in the system catalog for role: <code className="font-mono">{role}</code>.
                </p>
            </div>
        )
    }

    const filteredFeatures = featureKeys.filter((f) => {
        const query = searchTerm.toLowerCase()
        return (
            f.nav_label?.toLowerCase().includes(query) ||
            f.key?.toLowerCase().includes(query) ||
            f.nav_group?.toLowerCase().includes(query)
        )
    })

    const grouped = filteredFeatures.reduce((acc, f) => {
        const group = f.nav_group || 'Core Modules & Permissions'
        acc[group] = acc[group] || []
        acc[group].push(f)
        return acc
    }, {})

    function handleToggle(key) {
        if (selected.includes(key)) {
            onChange(selected.filter((k) => k !== key))
        } else {
            onChange([...selected, key])
        }
    }

    function handleSelectAll() {
        const allKeys = Array.from(new Set([...selected, ...featureKeys.map((f) => f.key)]))
        onChange(allKeys)
    }

    function handleDeselectAll() {
        onChange([])
    }

    function handleToggleGroup(groupFeatures) {
        const groupKeys = groupFeatures.map((f) => f.key)
        const allIncluded = groupKeys.every((k) => selected.includes(k))
        if (allIncluded) {
            onChange(selected.filter((k) => !groupKeys.includes(k)))
        } else {
            onChange(Array.from(new Set([...selected, ...groupKeys])))
        }
    }

    const totalCount = featureKeys.length
    const selectedCount = selected.length

    return (
        <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
            {/* Header controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Grantable Capability Matrix
                        </h4>
                        <p className="text-[11px] text-muted-foreground">
                            {selectedCount} of {totalCount} entitlements granted
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={handleSelectAll}
                    >
                        <CheckCheck className="h-3.5 w-3.5 text-primary" />
                        Select All
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        onClick={handleDeselectAll}
                    >
                        Clear
                    </Button>
                </div>
            </div>

            {/* Feature search */}
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                    placeholder="Search capabilities (e.g. assessments, certificates, analytics)..."
                    className="pl-8 h-8 text-xs bg-muted/30"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                    <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-3 w-3" />
                    </button>
                )}
            </div>

            {/* Grouped feature items */}
            <div className="max-h-72 overflow-y-auto space-y-4 pr-1">
                {Object.keys(grouped).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                        No features match &quot;{searchTerm}&quot;
                    </p>
                ) : (
                    Object.entries(grouped).map(([group, items]) => {
                        const groupKeys = items.map((f) => f.key)
                        const groupSelectedCount = groupKeys.filter((k) => selected.includes(k)).length
                        const isAllGroupSelected = groupSelectedCount === groupKeys.length

                        return (
                            <div key={group} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-semibold text-foreground/90">{group}</span>
                                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.2 rounded-full">
                                            {groupSelectedCount}/{items.length}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleToggleGroup(items)}
                                        className="text-[11px] text-primary hover:underline font-medium"
                                    >
                                        {isAllGroupSelected ? 'Deselect group' : 'Select group'}
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {items.map((f) => {
                                        const isChecked = selected.includes(f.key)
                                        return (
                                            <div
                                                key={f.key}
                                                onClick={() => handleToggle(f.key)}
                                                className={`flex items-start gap-2.5 p-2 rounded-lg border text-left cursor-pointer transition-all ${
                                                    isChecked
                                                        ? 'bg-primary/5 border-primary/40 shadow-xs'
                                                        : 'bg-background hover:bg-muted/40 border-border/70'
                                                }`}
                                            >
                                                <Checkbox
                                                    checked={isChecked}
                                                    onCheckedChange={() => handleToggle(f.key)}
                                                    className="mt-0.5"
                                                    id={`feat-${f.key}`}
                                                />
                                                <div className="space-y-0.5 flex-1 min-w-0">
                                                    <p className="text-xs font-medium text-foreground leading-tight truncate">
                                                        {f.nav_label}
                                                    </p>
                                                    <p className="text-[10px] font-mono text-muted-foreground truncate">
                                                        {f.key}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}

/**
 * Enterprise Password Generator & Validator
 */
function PasswordGeneratorField({ password, onChange }) {
    const [visible, setVisible] = useState(false)
    const { toast } = useToast()

    const score = calculatePasswordScore(password)

    const criteria = [
        { label: '10–72 characters', met: password?.length >= 10 && password?.length <= 72 },
        { label: 'Uppercase (A-Z)', met: /[A-Z]/.test(password || '') },
        { label: 'Lowercase (a-z)', met: /[a-z]/.test(password || '') },
        { label: 'Numbers & Symbols', met: /[0-9]/.test(password || '') && /[^a-zA-Z0-9]/.test(password || '') },
    ]

    function handleGenerate() {
        const pwd = generateSecurePassword()
        onChange(pwd)
        navigator.clipboard.writeText(pwd)
        toast({
            title: 'Strong Password Generated',
            description: 'Temporary password generated and copied to clipboard.',
        })
    }

    function handleCopy() {
        if (!password) return
        navigator.clipboard.writeText(password)
        toast({
            title: 'Copied to Clipboard',
            description: 'Temporary password copied.',
        })
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label htmlFor="owner-password" className="text-xs font-medium">
                    Temporary Initial Password *
                </Label>
                <div className="flex items-center gap-1.5">
                    {password && (
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                        >
                            <Copy className="h-3 w-3" />
                            Copy
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleGenerate}
                        className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1"
                    >
                        <Sparkles className="h-3 w-3" />
                        Auto-generate strong
                    </button>
                </div>
            </div>

            <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    id="owner-password"
                    type={visible ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Enter or generate temporary password"
                    className="pl-9 pr-10 font-mono text-xs"
                    autoComplete="new-password"
                />
                <button
                    type="button"
                    onClick={() => setVisible(!visible)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title={visible ? 'Hide password' : 'Show password'}
                >
                    {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
            </div>

            {/* Strength bar */}
            {password && (
                <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">Compliance strength</span>
                        <span
                            className={`font-semibold ${
                                score < 50 ? 'text-destructive' : score < 80 ? 'text-amber-500' : 'text-emerald-500'
                            }`}
                        >
                            {score < 50 ? 'Weak' : score < 80 ? 'Good' : 'Enterprise Strong'}
                        </span>
                    </div>
                    <Progress
                        value={score}
                        className={`h-1.5 ${
                            score < 50
                                ? '[&>div]:bg-destructive'
                                : score < 80
                                ? '[&>div]:bg-amber-500'
                                : '[&>div]:bg-emerald-500'
                        }`}
                    />
                </div>
            )}

            {/* Criteria checklist */}
            <div className="grid grid-cols-2 gap-1.5 pt-1">
                {criteria.map((c) => (
                    <div
                        key={c.label}
                        className={`flex items-center gap-1.5 text-[11px] ${
                            c.met ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-muted-foreground'
                        }`}
                    >
                        {c.met ? (
                            <CheckCircle2 className="h-3 w-3 shrink-0" />
                        ) : (
                            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 ml-0.5 mr-1" />
                        )}
                        <span>{c.label}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default function HybridPlanActivationPage({ currentUser }) {
    const { toast } = useToast()

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
    const [upgradeTab, setUpgradeTab] = useState('commercials')

    // New-organization dialog
    const [newOrgDialog, setNewOrgDialog] = useState(false)
    const [newOrgForm, setNewOrgForm] = useState(NEW_ORG_INITIAL)
    const [newOrgSubmitting, setNewOrgSubmitting] = useState(false)
    const [wizardStep, setWizardStep] = useState(1)

    // Feature key catalog for whichever org type is selected
    const [featureKeysByRole, setFeatureKeysByRole] = useState({})
    const [featureKeysLoading, setFeatureKeysLoading] = useState(false)

    const fetchFeatureKeys = useCallback(
        async (role) => {
            if (!role || featureKeysByRole[role]) return
            setFeatureKeysLoading(true)
            try {
                const response = await fetch(`/api/organizations/feature-keys?role=${encodeURIComponent(role)}`)
                const data = await response.json()
                if (!response.ok) throw new Error(data.error || 'Failed to load feature keys')
                setFeatureKeysByRole((prev) => ({ ...prev, [role]: data.featureKeys || [] }))
            } catch (err) {
                toast({ title: 'Failed to load feature list', description: err.message, variant: 'destructive' })
            } finally {
                setFeatureKeysLoading(false)
            }
        },
        [featureKeysByRole, toast]
    )

    // Delete-organization dialog
    const [deleteDialog, setDeleteDialog] = useState({ open: false, org: null })
    const [deletePreview, setDeletePreview] = useState(null)
    const [deletePreviewLoading, setDeletePreviewLoading] = useState(false)
    const [deleteMode, setDeleteMode] = useState('soft')
    const [deleteConfirmText, setDeleteConfirmText] = useState('')
    const [deleteSubmitting, setDeleteSubmitting] = useState(false)

    const fetchOrganizations = useCallback(
        async (page = 1) => {
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
        },
        [filters, pagination.limit, toast]
    )

    useEffect(() => {
        if (!isAuthorized) return
        const timer = setTimeout(() => fetchOrganizations(1), 300)
        return () => clearTimeout(timer)
    }, [filters.search, filters.planCode, filters.status, isAuthorized, fetchOrganizations])

    useEffect(() => {
        const role = ORG_TYPE_TO_ADMIN_ROLE[newOrgForm.orgType]
        if (role) fetchFeatureKeys(role)
    }, [newOrgForm.orgType, fetchFeatureKeys])

    const planOptions = useMemo(() => {
        const codes = new Set(rows.map((r) => r.plan_code).filter(Boolean))
        return Array.from(codes)
    }, [rows])

    // Executive Metrics
    const metrics = useMemo(() => {
        const total = pagination.total || rows.length
        const hybridCount = rows.filter(
            (r) => r.plan_code === 'hybrid' && (r.status === 'active' || r.status === 'pending')
        ).length
        const totalSeats = rows.reduce((acc, r) => acc + (Number(r.seat_count) || 0), 0)
        const totalDealValue = rows.reduce((acc, r) => acc + (Number(r.plan_amount) || 0), 0)

        return {
            total,
            hybridCount,
            totalSeats,
            totalDealValue,
        }
    }, [rows, pagination.total])

    function openUpgradeDialog(org) {
        setUpgradeForm(TERMS_INITIAL)
        setUpgradeTab('commercials')
        setUpgradeDialog({ open: true, org })
        const role = ORG_TYPE_TO_ADMIN_ROLE[org?.organization_type]
        if (role) fetchFeatureKeys(role)
    }

    function openNewOrgWizard() {
        setNewOrgForm(NEW_ORG_INITIAL)
        setWizardStep(1)
        setNewOrgDialog(true)
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

        // If the org already has an active/pending Hybrid subscription, PATCH
        // (update terms in place) instead of POST (create a new row — which
        // would be rejected by the "already has an active" guard).
        const isExistingHybrid =
            upgradeDialog.org?.plan_code === 'hybrid' &&
            (upgradeDialog.org?.status === 'active' || upgradeDialog.org?.status === 'pending')
        const httpMethod = isExistingHybrid ? 'PATCH' : 'POST'

        setUpgradeSubmitting(true)
        try {
            const response = await fetch(`/api/organizations/${upgradeDialog.org.organization_id}/subscriptions`, {
                method: httpMethod,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan_amount: amount,
                    seat_count: seats,
                    billing_cycle: upgradeForm.billingCycle,
                    features: upgradeForm.features,
                    notes: upgradeForm.notes || undefined,
                }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Failed to save Hybrid subscription')

            toast({
                title: isExistingHybrid ? 'Hybrid Terms Updated' : 'Hybrid Plan Activated',
                description: isExistingHybrid
                    ? `Commercial terms for ${upgradeDialog.org.organization_name} have been updated.`
                    : `${upgradeDialog.org.organization_name} is now upgraded to Hybrid terms.`,
            })
            setUpgradeDialog({ open: false, org: null })
            fetchOrganizations(pagination.page)
        } catch (err) {
            toast({ title: 'Save failed', description: err.message, variant: 'destructive' })
        } finally {
            setUpgradeSubmitting(false)
        }
    }

    async function handleNewOrgSubmit(e) {
        if (e && e.preventDefault) e.preventDefault()
        const amount = Number(newOrgForm.planAmount)
        const seats = Number(newOrgForm.seatCount)

        if (!newOrgForm.orgName.trim()) {
            toast({ title: 'Organization Name Required', description: 'Please specify the legal institution name.', variant: 'destructive' })
            setWizardStep(1)
            return
        }
        if (!newOrgForm.orgType) {
            toast({ title: 'Organization Type Required', description: 'Please select School, College, or University.', variant: 'destructive' })
            setWizardStep(1)
            return
        }
        if (!newOrgForm.ownerEmail.trim()) {
            toast({ title: 'Administrator Email Required', description: 'Owner email address cannot be empty.', variant: 'destructive' })
            setWizardStep(1)
            return
        }
        const passwordError = validatePassword(newOrgForm.ownerPassword)
        if (passwordError) {
            toast({ title: 'Invalid Password', description: passwordError, variant: 'destructive' })
            setWizardStep(1)
            return
        }
        if (!Number.isFinite(amount) || amount < 0) {
            toast({ title: 'Invalid Deal Value', description: 'Enter a valid negotiated contract price.', variant: 'destructive' })
            setWizardStep(2)
            return
        }
        if (!Number.isInteger(seats) || seats < 1) {
            toast({ title: 'Invalid Seat Count', description: 'Enter an integer seat allocation of 1 or more.', variant: 'destructive' })
            setWizardStep(2)
            return
        }

        setNewOrgSubmitting(true)
        try {
            const features = newOrgForm.features
            const response = await fetch('/api/organizations/subscriptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    org_name: newOrgForm.orgName.trim(),
                    org_type: newOrgForm.orgType,
                    owner_name: newOrgForm.ownerName || undefined,
                    owner_email: newOrgForm.ownerEmail.trim(),
                    owner_phone: newOrgForm.ownerPhone.trim() || undefined,
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

            toast({
                title: 'Hybrid Organization Activated',
                description: `${newOrgForm.orgName} has been provisioned and enrolled on the Hybrid plan.`,
            })
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
                title: deleteMode === 'hard' ? 'Organization Permanently Deleted' : 'Organization Soft-Deleted',
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
            <div className="p-8 max-w-4xl mx-auto">
                <Card className="border-destructive/30 bg-destructive/5">
                    <CardContent className="flex items-center gap-4 py-8 text-destructive">
                        <AlertCircle className="h-8 w-8 shrink-0" />
                        <div>
                            <h3 className="font-semibold text-lg">Restricted Administrative Access</h3>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                You do not have permissions to view or manage commercial Hybrid subscriptions. Contact a Super Administrator if you need access.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                                Organizations &amp; Commercial Plans
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Provision, manage negotiated enterprise terms, and allocate custom capability entitlements.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchOrganizations(pagination.page)}
                        disabled={loading}
                        className="gap-1.5 text-xs h-9"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button
                        onClick={openNewOrgWizard}
                        className="gap-2 h-9 px-4 font-semibold shadow-md shadow-primary/20 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-700"
                    >
                        <Plus className="h-4 w-4" />
                        New Hybrid Organization
                    </Button>
                </div>
            </div>

            {/* Executive Metric Ribbon */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-card to-muted/20 border-border/60 shadow-xs">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Total Institutions</p>
                            <p className="text-2xl font-bold tracking-tight">{metrics.total.toLocaleString()}</p>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Building2 className="h-3 w-3" /> All active accounts
                            </p>
                        </div>
                        <div className="h-11 w-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
                            <School className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-card to-muted/20 border-border/60 shadow-xs">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Active Hybrid Plans</p>
                            <p className="text-2xl font-bold tracking-tight text-primary">
                                {metrics.hybridCount.toLocaleString()}
                            </p>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Sparkles className="h-3 w-3 text-primary" /> Sales-negotiated
                            </p>
                        </div>
                        <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                            <Zap className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-card to-muted/20 border-border/60 shadow-xs">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Contracted Seats</p>
                            <p className="text-2xl font-bold tracking-tight">
                                {metrics.totalSeats.toLocaleString()}
                            </p>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Users className="h-3 w-3" /> Provisioned capacity
                            </p>
                        </div>
                        <div className="h-11 w-11 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                            <Users className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-card to-muted/20 border-border/60 shadow-xs">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Contract Pipeline Value</p>
                            <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(metrics.totalDealValue)}
                            </p>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <TrendingUp className="h-3 w-3 text-emerald-500" /> Billed &amp; contracted
                            </p>
                        </div>
                        <div className="h-11 w-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                            <CreditCard className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filter and Table Card */}
            <Card className="shadow-sm border-border/70">
                <CardContent className="p-6 space-y-5">
                    {/* Controls Bar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 flex-wrap">
                        <div className="relative flex-1 min-w-[260px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by organization name or ID..."
                                className="pl-9 h-10 bg-muted/20"
                                value={filters.search}
                                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                            />
                            {filters.search && (
                                <button
                                    type="button"
                                    onClick={() => setFilters((f) => ({ ...f, search: '' }))}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2.5 flex-wrap">
                            <Select
                                value={filters.planCode}
                                onValueChange={(v) => setFilters((f) => ({ ...f, planCode: v }))}
                            >
                                <SelectTrigger className="w-[170px] h-10 bg-muted/20">
                                    <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                                    <SelectValue placeholder="Filter Plan" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Plans</SelectItem>
                                    <SelectItem value="none">No Subscription</SelectItem>
                                    {planOptions.map((code) => (
                                        <SelectItem key={code} value={code} className="capitalize">
                                            {code === 'hybrid' ? '✨ Hybrid Plan' : code}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select
                                value={filters.status}
                                onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}
                            >
                                <SelectTrigger className="w-[160px] h-10 bg-muted/20">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="paused">Paused</SelectItem>
                                    <SelectItem value="grace_period">Grace Period</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                    <SelectItem value="expired">Expired</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Table or Empty State */}
                    {loading ? (
                        <TableLoader />
                    ) : rows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed bg-muted/10 space-y-3">
                            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                                <Building2 className="h-6 w-6" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-semibold text-foreground">No organizations found</h3>
                                <p className="text-sm text-muted-foreground max-w-sm">
                                    Try adjusting your search criteria, or onboard a new enterprise organization to activate a Hybrid plan.
                                </p>
                            </div>
                            <Button onClick={openNewOrgWizard} size="sm" className="mt-2 gap-1.5">
                                <Plus className="h-4 w-4" />
                                New Hybrid Organization
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="rounded-lg border overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/40">
                                        <TableRow>
                                            <TableHead className="font-semibold">Organization</TableHead>
                                            <TableHead className="font-semibold">Type</TableHead>
                                            <TableHead className="font-semibold">Active Plan</TableHead>
                                            <TableHead className="font-semibold">Status</TableHead>
                                            <TableHead className="font-semibold">Seats</TableHead>
                                            <TableHead className="font-semibold">Contract Value</TableHead>
                                            <TableHead className="font-semibold">Start Date</TableHead>
                                            <TableHead className="font-semibold text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rows.map((org) => {
                                            const isHybrid = org.plan_code === 'hybrid'
                                            const hasActiveSub = org.status === 'active' || org.status === 'pending'
                                            const orgTypeObj = ORG_TYPES.find((t) => t.value === org.organization_type)
                                            const TypeIcon = orgTypeObj?.icon || Building2

                                            return (
                                                <TableRow key={org.organization_id} className="hover:bg-muted/30 transition-colors">
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className={`h-9 w-9 rounded-lg font-semibold flex items-center justify-center text-xs shrink-0 shadow-xs ${getAvatarColor(
                                                                    org.organization_name
                                                                )}`}
                                                            >
                                                                {org.organization_name
                                                                    ? org.organization_name.slice(0, 2).toUpperCase()
                                                                    : 'OR'}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="font-semibold text-foreground text-sm truncate">
                                                                    {org.organization_name}
                                                                </p>
                                                                <p className="text-[11px] font-mono text-muted-foreground truncate">
                                                                    ID: {org.organization_id?.slice(0, 13)}...
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </TableCell>

                                                    <TableCell>
                                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium bg-background capitalize">
                                                            <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                                            {org.organization_type || '—'}
                                                        </div>
                                                    </TableCell>

                                                    <TableCell>
                                                        {isHybrid ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-primary/15 via-indigo-500/15 to-purple-500/15 text-primary border border-primary/30 shadow-xs">
                                                                <Sparkles className="h-3 w-3" />
                                                                Hybrid Enterprise
                                                            </span>
                                                        ) : org.plan_type ? (
                                                            <span className="text-sm font-medium text-foreground capitalize">
                                                                {org.plan_type}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">Unsubscribed</span>
                                                        )}
                                                    </TableCell>

                                                    <TableCell>
                                                        {org.status ? (
                                                            <Badge
                                                                className={`capitalize text-[11px] font-medium ${
                                                                    STATUS_BADGE[org.status] || ''
                                                                }`}
                                                                variant="outline"
                                                            >
                                                                <span
                                                                    className={`h-1.5 w-1.5 rounded-full mr-1.5 ${
                                                                        org.status === 'active'
                                                                            ? 'bg-emerald-500'
                                                                            : org.status === 'pending'
                                                                            ? 'bg-amber-500'
                                                                            : 'bg-muted-foreground'
                                                                    }`}
                                                                />
                                                                {org.status.replace('_', ' ')}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        )}
                                                    </TableCell>

                                                    <TableCell>
                                                        <div className="flex items-center gap-1.5 text-sm font-medium">
                                                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                                            {org.seat_count != null ? org.seat_count.toLocaleString() : '—'}
                                                        </div>
                                                    </TableCell>

                                                    <TableCell>
                                                        <span className="text-sm font-semibold text-foreground">
                                                            {formatCurrency(org.plan_amount)}
                                                        </span>
                                                    </TableCell>

                                                    <TableCell>
                                                        <span className="text-xs text-muted-foreground">
                                                            {formatDate(org.subscription_start_date)}
                                                        </span>
                                                    </TableCell>

                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {isHybrid && hasActiveSub ? (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-8 text-xs gap-1 border-primary/30 hover:bg-primary/5 text-primary"
                                                                    onClick={() => openUpgradeDialog(org)}
                                                                >
                                                                    <SlidersHorizontal className="h-3 w-3" />
                                                                    Edit Terms
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    size="sm"
                                                                    variant="default"
                                                                    className="h-8 text-xs gap-1 bg-primary hover:bg-primary/90"
                                                                    onClick={() => openUpgradeDialog(org)}
                                                                >
                                                                    <Sparkles className="h-3 w-3" />
                                                                    {org.plan_code ? 'Switch to Hybrid' : 'Activate Hybrid'}
                                                                </Button>
                                                            )}

                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                                onClick={() => openDeleteDialog(org)}
                                                                title="Delete organization"
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
                            </div>

                            {/* Pagination */}
                            {pagination.totalPages > 1 && (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                                    <p className="text-xs text-muted-foreground">
                                        Showing page <span className="font-semibold text-foreground">{pagination.page}</span> of{' '}
                                        <span className="font-semibold text-foreground">{pagination.totalPages}</span> ({pagination.total}{' '}
                                        total records)
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={pagination.page <= 1}
                                            onClick={() => fetchOrganizations(pagination.page - 1)}
                                            className="h-8 text-xs"
                                        >
                                            Previous
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={pagination.page >= pagination.totalPages}
                                            onClick={() => fetchOrganizations(pagination.page + 1)}
                                            className="h-8 text-xs"
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ======================================================== */}
            {/* NEW HYBRID ORGANIZATION MODAL - WORLD-CLASS STEP WIZARD  */}
            {/* ======================================================== */}
            <Dialog open={newOrgDialog} onOpenChange={setNewOrgDialog}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-border/80 shadow-2xl rounded-2xl">
                    {/* Modal Banner Header */}
                    <div className="p-6 bg-gradient-to-r from-card via-muted/40 to-card border-b">
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                                        Sales-Assisted Enterprise Onboarding
                                    </span>
                                </div>
                                <DialogTitle className="text-xl md:text-2xl font-bold tracking-tight">
                                    New Hybrid Organization Setup
                                </DialogTitle>
                                <DialogDescription className="text-xs md:text-sm text-muted-foreground">
                                    Provision institutional tenant, bootstrap administrator identity, and commit custom commercials in one atomic flow.
                                </DialogDescription>
                            </div>
                        </div>

                        {/* Step Navigation Progress */}
                        <div className="grid grid-cols-4 gap-2 mt-6">
                            {[
                                { step: 1, label: 'Identity & Admin', icon: User },
                                { step: 2, label: 'Commercial Terms', icon: CreditCard },
                                { step: 3, label: 'Entitlements', icon: ShieldCheck },
                                { step: 4, label: 'Review & Launch', icon: CheckCircle2 },
                            ].map((s) => {
                                const Icon = s.icon
                                const isActive = wizardStep === s.step
                                const isDone = wizardStep > s.step

                                return (
                                    <button
                                        key={s.step}
                                        type="button"
                                        onClick={() => setWizardStep(s.step)}
                                        className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                                            isActive
                                                ? 'bg-primary text-primary-foreground border-primary shadow-sm font-semibold'
                                                : isDone
                                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                                                : 'bg-background text-muted-foreground border-border hover:bg-muted/50'
                                        }`}
                                    >
                                        <div
                                            className={`h-6 w-6 rounded-md flex items-center justify-center text-xs shrink-0 ${
                                                isActive
                                                    ? 'bg-primary-foreground text-primary font-bold'
                                                    : isDone
                                                    ? 'bg-emerald-500 text-white'
                                                    : 'bg-muted text-muted-foreground'
                                            }`}
                                        >
                                            {isDone ? <Check className="h-3.5 w-3.5" /> : s.step}
                                        </div>
                                        <span className="text-xs truncate hidden sm:inline">{s.label}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Step Body Content */}
                    <div className="p-6 space-y-6">
                        {/* STEP 1: IDENTITY & ADMIN ACCOUNT */}
                        {wizardStep === 1 && (
                            <div className="space-y-6 animate-in fade-in-50 duration-200">
                                {/* Organization Details */}
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                                            1. Institution Profile
                                        </h3>
                                        <p className="text-xs text-muted-foreground">
                                            Select the legal entity category to configure permissions and tenancy boundaries.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="new-org-name" className="text-xs font-semibold">
                                            Institution Legal Name *
                                        </Label>
                                        <div className="relative">
                                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="new-org-name"
                                                value={newOrgForm.orgName}
                                                onChange={(e) => setNewOrgForm((f) => ({ ...f, orgName: e.target.value }))}
                                                placeholder="e.g. Apex Institute of Engineering & Technology"
                                                className="pl-9 h-10 text-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* Org Type Cards */}
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold">
                                            Organization Category *
                                        </Label>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            {ORG_TYPES.map((t) => {
                                                const Icon = t.icon
                                                const isSelected = newOrgForm.orgType === t.value
                                                return (
                                                    <div
                                                        key={t.value}
                                                        onClick={() => setNewOrgForm((f) => ({ ...f, orgType: t.value }))}
                                                        className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all relative ${
                                                            isSelected
                                                                ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-xs'
                                                                : 'hover:border-border/80 hover:bg-muted/30 bg-card'
                                                        }`}
                                                    >
                                                        {isSelected && (
                                                            <div className="absolute top-2.5 right-2.5 h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                                                                <Check className="h-3 w-3" />
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-2.5 mb-1.5">
                                                            <div className={`p-2 rounded-lg border ${t.accent}`}>
                                                                <Icon className="h-4 w-4" />
                                                            </div>
                                                            <span className="font-semibold text-sm">{t.label}</span>
                                                        </div>
                                                        <p className="text-[11px] text-muted-foreground leading-tight">
                                                            {t.description}
                                                        </p>
                                                        <span className="inline-block mt-2 font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                                            Role: {t.role}
                                                        </span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t pt-5 space-y-4">
                                    <div>
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                                            2. Primary Administrator Identity
                                        </h3>
                                        <p className="text-xs text-muted-foreground">
                                            This user will hold institutional ownership and receive the bootstrap invitation.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="new-owner-name" className="text-xs">
                                                Administrator Full Name
                                            </Label>
                                            <div className="relative">
                                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="new-owner-name"
                                                    value={newOrgForm.ownerName}
                                                    onChange={(e) => setNewOrgForm((f) => ({ ...f, ownerName: e.target.value }))}
                                                    placeholder="e.g. Dr. Rajesh Sharma"
                                                    className="pl-9 h-9 text-xs"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="new-owner-phone" className="text-xs">
                                                Phone Number (Optional)
                                            </Label>
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="new-owner-phone"
                                                    type="tel"
                                                    value={newOrgForm.ownerPhone}
                                                    onChange={(e) => setNewOrgForm((f) => ({ ...f, ownerPhone: e.target.value }))}
                                                    placeholder="+91 98765 43210"
                                                    className="pl-9 h-9 text-xs"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="new-owner-email" className="text-xs">
                                                Business Email Address *
                                            </Label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="new-owner-email"
                                                    type="email"
                                                    value={newOrgForm.ownerEmail}
                                                    onChange={(e) => setNewOrgForm((f) => ({ ...f, ownerEmail: e.target.value }))}
                                                    placeholder="dean@university.edu"
                                                    className="pl-9 h-9 text-xs"
                                                />
                                            </div>
                                        </div>

                                        <PasswordGeneratorField
                                            password={newOrgForm.ownerPassword}
                                            onChange={(pwd) => setNewOrgForm((f) => ({ ...f, ownerPassword: pwd }))}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: COMMERCIAL TERMS & SEATS */}
                        {wizardStep === 2 && (
                            <div className="space-y-6 animate-in fade-in-50 duration-200">
                                <div>
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                                        Sales Contract Terms &amp; Capacity
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Configure negotiated commercials, seat volume, and billing cycle agreed with sales.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {/* Inputs Column */}
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="new-price" className="text-xs font-semibold">
                                                Negotiated Contract Value (INR ₹) *
                                            </Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                                                    ₹
                                                </span>
                                                <Input
                                                    id="new-price"
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={newOrgForm.planAmount}
                                                    onChange={(e) => setNewOrgForm((f) => ({ ...f, planAmount: e.target.value }))}
                                                    placeholder="e.g. 250000"
                                                    className="pl-8 h-10 text-sm font-mono"
                                                />
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">
                                                Total price for the chosen billing period.
                                            </p>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="new-seats" className="text-xs font-semibold">
                                                Committed Seat Allocation *
                                            </Label>
                                            <div className="relative">
                                                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="new-seats"
                                                    type="number"
                                                    min="1"
                                                    step="1"
                                                    value={newOrgForm.seatCount}
                                                    onChange={(e) => setNewOrgForm((f) => ({ ...f, seatCount: e.target.value }))}
                                                    placeholder="e.g. 500"
                                                    className="pl-9 h-10 text-sm font-mono"
                                                />
                                            </div>

                                            {/* Seat Presets */}
                                            <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                                <span className="text-[10px] text-muted-foreground">Quick presets:</span>
                                                {SEAT_PRESETS.map((cnt) => (
                                                    <button
                                                        key={cnt}
                                                        type="button"
                                                        onClick={() => setNewOrgForm((f) => ({ ...f, seatCount: String(cnt) }))}
                                                        className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all ${
                                                            newOrgForm.seatCount === String(cnt)
                                                                ? 'bg-primary text-primary-foreground border-primary font-bold'
                                                                : 'bg-muted/50 hover:bg-muted text-muted-foreground border-border'
                                                        }`}
                                                    >
                                                        {cnt.toLocaleString()}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Billing Cycle Cards */}
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold">
                                                Billing Cycle *
                                            </Label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {BILLING_CYCLES.map((cycle) => {
                                                    const isSelected = newOrgForm.billingCycle === cycle.value
                                                    return (
                                                        <div
                                                            key={cycle.value}
                                                            onClick={() => setNewOrgForm((f) => ({ ...f, billingCycle: cycle.value }))}
                                                            className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                                                                isSelected
                                                                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5 font-semibold'
                                                                    : 'hover:bg-muted/40 bg-card border-border'
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-xs capitalize">{cycle.value}</span>
                                                                {cycle.popular && (
                                                                    <span className="text-[9px] bg-primary/10 text-primary font-semibold px-1 py-0.2 rounded">
                                                                        Popular
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground">{cycle.desc}</p>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Live Unit Economics Card */}
                                    <div className="space-y-4">
                                        <UnitEconomicsCard
                                            planAmount={newOrgForm.planAmount}
                                            seatCount={newOrgForm.seatCount}
                                            billingCycle={newOrgForm.billingCycle}
                                        />

                                        <div className="space-y-1.5">
                                            <Label htmlFor="new-notes" className="text-xs font-semibold">
                                                Sales Deal Notes &amp; Special Clauses (Optional)
                                            </Label>
                                            <Textarea
                                                id="new-notes"
                                                value={newOrgForm.notes}
                                                onChange={(e) => setNewOrgForm((f) => ({ ...f, notes: e.target.value }))}
                                                placeholder="e.g. Approved by Regional Sales VP. Special payment term 45 days net. Includes custom certificate integration."
                                                rows={4}
                                                className="text-xs bg-muted/20"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: FEATURE ENTITLEMENTS */}
                        {wizardStep === 3 && (
                            <div className="space-y-4 animate-in fade-in-50 duration-200">
                                <div>
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                                        Dynamic Feature Grants
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Select capabilities enabled for this organization. These map directly to database feature flags.
                                    </p>
                                </div>

                                <EnhancedFeatureSelector
                                    role={ORG_TYPE_TO_ADMIN_ROLE[newOrgForm.orgType]}
                                    featureKeys={featureKeysByRole[ORG_TYPE_TO_ADMIN_ROLE[newOrgForm.orgType]]}
                                    loading={featureKeysLoading}
                                    selected={newOrgForm.features}
                                    onChange={(features) => setNewOrgForm((f) => ({ ...f, features }))}
                                />
                            </div>
                        )}

                        {/* STEP 4: REVIEW & PROVISION */}
                        {wizardStep === 4 && (
                            <div className="space-y-5 animate-in fade-in-50 duration-200">
                                <div>
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                                        Review Contract &amp; Activation Summary
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Verify all commercial data before atomic creation of the organization and hybrid subscription.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="p-4 rounded-xl border bg-card space-y-2">
                                        <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wide">
                                            <Building2 className="h-4 w-4" />
                                            Organization
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-foreground">{newOrgForm.orgName || '—'}</p>
                                            <Badge variant="outline" className="text-[11px] capitalize mt-1">
                                                {newOrgForm.orgType || '—'}
                                            </Badge>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setWizardStep(1)}
                                            className="text-[11px] text-primary hover:underline font-medium block pt-1"
                                        >
                                            Edit profile
                                        </button>
                                    </div>

                                    <div className="p-4 rounded-xl border bg-card space-y-2">
                                        <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wide">
                                            <User className="h-4 w-4" />
                                            Primary Admin
                                        </div>
                                        <div className="space-y-0.5 text-xs">
                                            <p className="font-semibold text-foreground">{newOrgForm.ownerName || 'Admin'}</p>
                                            <p className="text-muted-foreground truncate">{newOrgForm.ownerEmail || '—'}</p>
                                            {newOrgForm.ownerPhone && (
                                                <p className="text-muted-foreground">{newOrgForm.ownerPhone}</p>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setWizardStep(1)}
                                            className="text-[11px] text-primary hover:underline font-medium block pt-1"
                                        >
                                            Edit identity
                                        </button>
                                    </div>

                                    <div className="p-4 rounded-xl border bg-card space-y-2">
                                        <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wide">
                                            <CreditCard className="h-4 w-4" />
                                            Commercials
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-base font-bold text-foreground">
                                                {formatCurrency(newOrgForm.planAmount)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {newOrgForm.seatCount ? `${Number(newOrgForm.seatCount).toLocaleString()} seats` : '0 seats'} •{' '}
                                                <span className="capitalize">{newOrgForm.billingCycle}</span>
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setWizardStep(2)}
                                            className="text-[11px] text-primary hover:underline font-medium block pt-1"
                                        >
                                            Edit commercials
                                        </button>
                                    </div>
                                </div>

                                {/* Features pill list */}
                                <div className="p-4 rounded-xl border bg-card space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wide">
                                            <ShieldCheck className="h-4 w-4" />
                                            Granted Entitlements ({newOrgForm.features?.length || 0})
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setWizardStep(3)}
                                            className="text-[11px] text-primary hover:underline font-medium"
                                        >
                                            Edit features
                                        </button>
                                    </div>

                                    {newOrgForm.features?.length > 0 ? (
                                        <div className="flex items-center gap-1.5 flex-wrap max-h-24 overflow-y-auto">
                                            {newOrgForm.features.map((featKey) => (
                                                <Badge
                                                    key={featKey}
                                                    variant="secondary"
                                                    className="font-mono text-[10px] bg-muted/80 text-foreground"
                                                >
                                                    {featKey}
                                                </Badge>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic">
                                            No special features granted; default role capabilities will apply.
                                        </p>
                                    )}
                                </div>

                                {newOrgForm.notes && (
                                    <div className="p-3 rounded-lg border bg-muted/30 text-xs space-y-1">
                                        <p className="font-semibold text-muted-foreground uppercase text-[10px]">Internal Sales Notes</p>
                                        <p className="text-foreground">{newOrgForm.notes}</p>
                                    </div>
                                )}

                                <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 flex items-center gap-3">
                                    <Sparkles className="h-5 w-5 text-primary shrink-0" />
                                    <div className="text-xs">
                                        <p className="font-semibold text-foreground">Ready for Instant Provisioning</p>
                                        <p className="text-muted-foreground">
                                            Upon confirmation, the organization database entry, owner credentials, and active Hybrid contract will be activated immediately.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Modal Footer Controls */}
                    <div className="p-4 bg-muted/30 border-t flex items-center justify-between">
                        <div>
                            {wizardStep > 1 && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setWizardStep((s) => s - 1)}
                                    className="gap-1.5 text-xs h-9"
                                >
                                    <ArrowLeft className="h-3.5 w-3.5" />
                                    Back
                                </Button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setNewOrgDialog(false)}
                                className="text-xs h-9"
                                disabled={newOrgSubmitting}
                            >
                                Cancel
                            </Button>

                            {wizardStep < 4 ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => {
                                        if (wizardStep === 1) {
                                            if (!newOrgForm.orgName.trim() || !newOrgForm.orgType || !newOrgForm.ownerEmail.trim()) {
                                                toast({
                                                    title: 'Required Fields Missing',
                                                    description: 'Please complete the Organization Name, Type, and Owner Email before continuing.',
                                                    variant: 'destructive',
                                                })
                                                return
                                            }
                                        }
                                        setWizardStep((s) => s + 1)
                                    }}
                                    className="gap-1.5 text-xs h-9 bg-primary hover:bg-primary/90 font-semibold"
                                >
                                    Next Step
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleNewOrgSubmit}
                                    disabled={newOrgSubmitting}
                                    className="gap-1.5 text-xs h-9 font-semibold bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-700 shadow-md shadow-primary/20"
                                >
                                    {newOrgSubmitting ? (
                                        <>
                                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                            Provisioning Organization...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="h-3.5 w-3.5" />
                                            Confirm &amp; Provision Hybrid Plan
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ======================================================== */}
            {/* UPGRADE EXISTING ORG TO HYBRID - WORLD-CLASS MODAL       */}
            {/* ======================================================== */}
            <Dialog
                open={upgradeDialog.open}
                onOpenChange={(open) => setUpgradeDialog({ open, org: open ? upgradeDialog.org : null })}
            >
                <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto p-0 border-border/80 shadow-2xl rounded-2xl">
                    <div className="p-6 bg-gradient-to-r from-card via-muted/30 to-card border-b">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                                {upgradeDialog.org?.plan_code === 'hybrid' && (upgradeDialog.org?.status === 'active' || upgradeDialog.org?.status === 'pending')
                                    ? 'Edit Commercial Terms'
                                    : 'Subscription Upgrade'}
                            </span>
                        </div>
                        <DialogTitle className="text-xl font-bold tracking-tight">
                            {upgradeDialog.org?.plan_code === 'hybrid' && (upgradeDialog.org?.status === 'active' || upgradeDialog.org?.status === 'pending')
                                ? `Edit Hybrid Terms for ${upgradeDialog.org?.organization_name}`
                                : `Activate Hybrid Terms for ${upgradeDialog.org?.organization_name}`}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                            {upgradeDialog.org?.plan_code === 'hybrid' && (upgradeDialog.org?.status === 'active' || upgradeDialog.org?.status === 'pending')
                                ? 'Update negotiated pricing, seat allocation, and feature entitlements for this active Hybrid subscription.'
                                : 'Apply sales-negotiated pricing, seat allocation, and custom feature entitlements to this existing organization.'}
                        </DialogDescription>
                    </div>

                    <form onSubmit={handleUpgradeSubmit}>
                        <div className="p-6 space-y-5">
                            {/* Organization Context Card */}
                            <div className="p-3.5 rounded-xl border bg-muted/30 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`h-9 w-9 rounded-lg font-semibold flex items-center justify-center text-xs shrink-0 ${getAvatarColor(
                                            upgradeDialog.org?.organization_name
                                        )}`}
                                    >
                                        {upgradeDialog.org?.organization_name
                                            ? upgradeDialog.org.organization_name.slice(0, 2).toUpperCase()
                                            : 'OR'}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm text-foreground">
                                            {upgradeDialog.org?.organization_name}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground capitalize">
                                            Type: {upgradeDialog.org?.organization_type || 'Institution'} • Current Plan:{' '}
                                            <span className="font-semibold text-foreground">
                                                {upgradeDialog.org?.plan_type || 'None'}
                                            </span>
                                        </p>
                                    </div>
                                </div>

                                <Badge variant="outline" className="capitalize text-xs font-medium">
                                    {upgradeDialog.org?.organization_type}
                                </Badge>
                            </div>

                            <Tabs value={upgradeTab} onValueChange={setUpgradeTab} className="space-y-4">
                                <TabsList className="grid grid-cols-2 h-9 p-1 bg-muted/60">
                                    <TabsTrigger value="commercials" className="text-xs font-semibold gap-1.5">
                                        <CreditCard className="h-3.5 w-3.5" />
                                        Commercials &amp; Seats
                                    </TabsTrigger>
                                    <TabsTrigger value="features" className="text-xs font-semibold gap-1.5">
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                        Feature Grants ({upgradeForm.features?.length || 0})
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="commercials" className="space-y-4 pt-2">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="up-price" className="text-xs font-semibold">
                                                Negotiated Contract Price (INR ₹) *
                                            </Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                                                    ₹
                                                </span>
                                                <Input
                                                    id="up-price"
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={upgradeForm.planAmount}
                                                    onChange={(e) => setUpgradeForm((f) => ({ ...f, planAmount: e.target.value }))}
                                                    placeholder="e.g. 150000"
                                                    className="pl-8 h-9 text-xs font-mono"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="up-seats" className="text-xs font-semibold">
                                                Seat Count *
                                            </Label>
                                            <div className="relative">
                                                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="up-seats"
                                                    type="number"
                                                    min="1"
                                                    step="1"
                                                    value={upgradeForm.seatCount}
                                                    onChange={(e) => setUpgradeForm((f) => ({ ...f, seatCount: e.target.value }))}
                                                    placeholder="e.g. 500"
                                                    className="pl-9 h-9 text-xs font-mono"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Seat Quick Presets */}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[10px] text-muted-foreground">Quick presets:</span>
                                        {SEAT_PRESETS.map((cnt) => (
                                            <button
                                                key={cnt}
                                                type="button"
                                                onClick={() => setUpgradeForm((f) => ({ ...f, seatCount: String(cnt) }))}
                                                className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all ${
                                                    upgradeForm.seatCount === String(cnt)
                                                        ? 'bg-primary text-primary-foreground border-primary font-bold'
                                                        : 'bg-muted/50 hover:bg-muted text-muted-foreground border-border'
                                                }`}
                                            >
                                                {cnt.toLocaleString()}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="up-cycle" className="text-xs font-semibold">
                                            Billing Cadence
                                        </Label>
                                        <Select
                                            value={upgradeForm.billingCycle}
                                            onValueChange={(v) => setUpgradeForm((f) => ({ ...f, billingCycle: v }))}
                                        >
                                            <SelectTrigger id="up-cycle" className="h-9 text-xs bg-muted/20">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {BILLING_CYCLES.map((c) => (
                                                    <SelectItem key={c.value} value={c.value}>
                                                        {c.label} ({c.badge})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <UnitEconomicsCard
                                        planAmount={upgradeForm.planAmount}
                                        seatCount={upgradeForm.seatCount}
                                        billingCycle={upgradeForm.billingCycle}
                                    />

                                    <div className="space-y-1.5">
                                        <Label htmlFor="up-notes" className="text-xs font-semibold">
                                            Sales Deal Notes (Optional)
                                        </Label>
                                        <Textarea
                                            id="up-notes"
                                            value={upgradeForm.notes}
                                            onChange={(e) => setUpgradeForm((f) => ({ ...f, notes: e.target.value }))}
                                            rows={2}
                                            placeholder="Special terms, SLA, or agreement number..."
                                            className="text-xs bg-muted/20"
                                        />
                                    </div>
                                </TabsContent>

                                <TabsContent value="features" className="space-y-4 pt-2">
                                    <EnhancedFeatureSelector
                                        role={ORG_TYPE_TO_ADMIN_ROLE[upgradeDialog.org?.organization_type]}
                                        featureKeys={featureKeysByRole[ORG_TYPE_TO_ADMIN_ROLE[upgradeDialog.org?.organization_type]]}
                                        loading={featureKeysLoading}
                                        selected={upgradeForm.features}
                                        onChange={(features) => setUpgradeForm((f) => ({ ...f, features }))}
                                    />
                                </TabsContent>
                            </Tabs>
                        </div>

                        <div className="p-4 bg-muted/30 border-t flex items-center justify-end gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setUpgradeDialog({ open: false, org: null })}
                                disabled={upgradeSubmitting}
                                className="text-xs h-9"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                size="sm"
                                disabled={upgradeSubmitting}
                                className="gap-1.5 text-xs h-9 font-semibold bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-700 shadow-md shadow-primary/20"
                            >
                                {upgradeSubmitting ? (
                                    <>
                                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                        {upgradeDialog.org?.plan_code === 'hybrid' && (upgradeDialog.org?.status === 'active' || upgradeDialog.org?.status === 'pending')
                                            ? 'Saving Changes...'
                                            : 'Activating Subscription...'}
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-3.5 w-3.5" />
                                        {upgradeDialog.org?.plan_code === 'hybrid' && (upgradeDialog.org?.status === 'active' || upgradeDialog.org?.status === 'pending')
                                            ? 'Save Updated Terms'
                                            : 'Activate Hybrid Plan'}
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ======================================================== */}
            {/* SAFETY-FIRST ORGANIZATION DELETION MODAL                 */}
            {/* ======================================================== */}
            <AlertDialog open={deleteDialog.open} onOpenChange={closeDeleteDialog}>
                <AlertDialogContent className="max-w-lg rounded-2xl shadow-2xl border-destructive/30">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive font-bold">
                            <AlertTriangle className="h-5 w-5" />
                            Remove &quot;{deleteDialog.org?.organization_name}&quot;
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-xs text-muted-foreground">
                            This high-impact action impacts all active subscriptions and student enrollments.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {deletePreviewLoading ? (
                        <div className="py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                            Auditing dependencies and member counts...
                        </div>
                    ) : (
                        <div className="space-y-4 py-2">
                            {deletePreview && (
                                <div className="rounded-xl border p-3.5 bg-muted/30 space-y-1.5 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Enrolled Members:</span>
                                        <span className="font-semibold text-foreground">
                                            {deletePreview.membership_count}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Subscriptions on Record:</span>
                                        <span className="font-semibold text-foreground">
                                            {deletePreview.subscription_count}
                                        </span>
                                    </div>
                                    {deletePreview.has_active_subscription && (
                                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-amber-700 dark:text-amber-300 font-medium text-[11px] mt-2">
                                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                                            <span>Active subscription present. Deletion will immediately revoke access.</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <RadioGroup value={deleteMode} onValueChange={setDeleteMode} className="gap-2.5">
                                <label
                                    className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                                        deleteMode === 'soft'
                                            ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                                            : 'hover:bg-muted/40 bg-card border-border'
                                    }`}
                                >
                                    <RadioGroupItem value="soft" id="delete-soft" className="mt-0.5" />
                                    <div className="space-y-0.5">
                                        <p className="font-semibold text-xs text-foreground">Soft Delete (Recommended)</p>
                                        <p className="text-[11px] text-muted-foreground leading-tight">
                                            Flags institution as inactive and deactivates memberships. Reversible — zero data purged.
                                        </p>
                                    </div>
                                </label>

                                <label
                                    className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                                        deleteMode === 'hard'
                                            ? 'border-destructive ring-2 ring-destructive/20 bg-destructive/5'
                                            : 'hover:bg-destructive/5 bg-card border-destructive/30'
                                    }`}
                                >
                                    <RadioGroupItem value="hard" id="delete-hard" className="mt-0.5" />
                                    <div className="space-y-0.5">
                                        <p className="font-semibold text-xs text-destructive">Permanent Hard Delete</p>
                                        <p className="text-[11px] text-muted-foreground leading-tight">
                                            Irrevocably purges the tenant, subscriptions, and orphaned users. Cannot be undone.
                                        </p>
                                    </div>
                                </label>
                            </RadioGroup>

                            <div className="space-y-1.5 pt-1">
                                <Label htmlFor="delete-confirm" className="text-xs">
                                    Type <span className="font-bold font-mono text-foreground">{deleteDialog.org?.organization_name}</span> to confirm
                                </Label>
                                <Input
                                    id="delete-confirm"
                                    value={deleteConfirmText}
                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                    placeholder={deleteDialog.org?.organization_name}
                                    className="h-9 text-xs font-mono"
                                    autoComplete="off"
                                />
                            </div>
                        </div>
                    )}

                    <AlertDialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => closeDeleteDialog(false)}
                            disabled={deleteSubmitting}
                            className="text-xs h-9"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleDeleteConfirm}
                            disabled={
                                deleteSubmitting ||
                                deletePreviewLoading ||
                                deleteConfirmText.trim() !== deleteDialog.org?.organization_name
                            }
                            className="text-xs h-9 font-semibold gap-1.5"
                        >
                            {deleteSubmitting ? (
                                <>
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                    Removing...
                                </>
                            ) : deleteMode === 'hard' ? (
                                'Permanently Delete'
                            ) : (
                                'Soft Delete'
                            )}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
