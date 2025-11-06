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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Building2,
  Briefcase,
  Mail,
  Phone,
  Globe,
  MapPin,
  Calendar,
  Eye,
  AlertTriangle,
  Filter
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function ApprovalsPage({ currentUser }) {
  const [universities, setUniversities] = useState([])
  const [recruiters, setRecruiters] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('universities')
  const [search, setSearch] = useState('')
  const [actionDialog, setActionDialog] = useState({ 
    open: false, 
    entity: null, 
    entityType: null, 
    action: null,
    reason: ''
  })
  const [detailsDialog, setDetailsDialog] = useState({ 
    open: false, 
    entity: null, 
    entityType: null,
    loading: false 
  })
  const { toast } = useToast()

  useEffect(() => {
    fetchPendingEntities()
    
    // Listen for refresh events
    const handleRefresh = () => {
      fetchPendingEntities()
    }
    window.addEventListener('refreshPage', handleRefresh)
    
    return () => {
      window.removeEventListener('refreshPage', handleRefresh)
    }
  }, [])

  const fetchPendingEntities = async () => {
    setLoading(true)
    try {
      // Fetch pending universities
      const univResponse = await fetch('/api/universities?approval_status=pending')
      const univData = await univResponse.json()
      setUniversities(univData.data || [])

      // Fetch pending recruiters
      const recResponse = await fetch('/api/recruiters?approval_status=pending&page=1&limit=1000')
      const recData = await recResponse.json()
      setRecruiters(recData.data || [])
    } catch (error) {
      console.error('Failed to fetch pending entities:', error)
      toast({
        title: 'Error',
        description: 'Failed to load pending approvals',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (entityType, entityId) => {
    try {
      const endpoint = `/api/approve-${entityType}`
      const bodyKey = `${entityType}Id`
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          [bodyKey]: entityId,
          userId: currentUser?.id,
          notes: `Approved by ${currentUser?.email}`
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast({
          title: 'Approved',
          description: `${entityType === 'university' ? 'University' : 'Recruiter'} has been approved successfully`,
        })
        fetchPendingEntities()
      } else {
        throw new Error(data.error || 'Approval failed')
      }
    } catch (error) {
      console.error('Approval error:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve',
        variant: 'destructive'
      })
    }
    setActionDialog({ open: false, entity: null, entityType: null, action: null, reason: '' })
  }

  const handleReject = async (entityType, entityId, reason) => {
    if (!reason || reason.trim() === '') {
      toast({
        title: 'Error',
        description: 'Please provide a reason for rejection',
        variant: 'destructive'
      })
      return
    }

    try {
      const endpoint = `/api/reject-${entityType}`
      const bodyKey = `${entityType}Id`
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          [bodyKey]: entityId,
          userId: currentUser?.id,
          reason: reason
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast({
          title: 'Rejected',
          description: `${entityType === 'university' ? 'University' : 'Recruiter'} has been rejected`,
        })
        fetchPendingEntities()
      } else {
        throw new Error(data.error || 'Rejection failed')
      }
    } catch (error) {
      console.error('Rejection error:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject',
        variant: 'destructive'
      })
    }
    setActionDialog({ open: false, entity: null, entityType: null, action: null, reason: '' })
  }

  const openActionDialog = (entity, entityType, action) => {
    setActionDialog({
      open: true,
      entity,
      entityType,
      action,
      reason: ''
    })
  }

  const openDetailsDialog = (entity, entityType) => {
    setDetailsDialog({
      open: true,
      entity,
      entityType,
      loading: false
    })
  }

  const filteredUniversities = universities.filter(univ => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      univ.name?.toLowerCase().includes(searchLower) ||
      univ.email?.toLowerCase().includes(searchLower) ||
      univ.state?.toLowerCase().includes(searchLower)
    )
  })

  const filteredRecruiters = recruiters.filter(rec => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      rec.name?.toLowerCase().includes(searchLower) ||
      rec.email?.toLowerCase().includes(searchLower) ||
      rec.state?.toLowerCase().includes(searchLower)
    )
  })

  const totalPending = universities.length + recruiters.length

  const renderEntityCard = (entity, entityType) => {
    const isUniversity = entityType === 'university'
    return (
      <Card key={entity.id} className="hover:shadow-lg transition-all duration-300 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {isUniversity ? (
                  <Building2 className="h-5 w-5 text-blue-500" />
                ) : (
                  <Briefcase className="h-5 w-5 text-purple-500" />
                )}
                <h3 className="text-lg font-bold truncate">{entity.name}</h3>
              </div>
              <Badge variant="secondary" className="mb-2">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Pending Approval
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openDetailsDialog(entity, entityType)}
              className="shrink-0"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {entity.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span className="truncate">{entity.email}</span>
              </div>
            )}
            {entity.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{entity.phone}</span>
              </div>
            )}
            {entity.state && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{entity.state}{entity.district && `, ${entity.district}`}</span>
              </div>
            )}
            {entity.website && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Globe className="h-4 w-4" />
                <a href={entity.website} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                  {entity.website}
                </a>
              </div>
            )}
          </div>
          
          {entity.created_at && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground border-t border-white/20 dark:border-slate-700/50 pt-3">
              <Calendar className="h-3 w-3" />
              <span>Submitted: {new Date(entity.created_at).toLocaleDateString()}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => openActionDialog(entity, entityType, 'approve')}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg shadow-green-500/25"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approve
            </Button>
            <Button
              onClick={() => openActionDialog(entity, entityType, 'reject')}
              variant="destructive"
              className="flex-1 shadow-lg shadow-red-500/25"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
            Approval Center
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and approve pending registrations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge 
            variant="secondary" 
            className="px-4 py-2 text-base bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/20 dark:border-orange-500/30"
          >
            {totalPending} Pending
          </Badge>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name, email, or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-white dark:bg-slate-900"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-white/20 dark:border-slate-700/50">
          <TabsTrigger value="universities" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
            <Building2 className="h-4 w-4 mr-2" />
            Universities ({universities.length})
          </TabsTrigger>
          <TabsTrigger value="recruiters" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
            <Briefcase className="h-4 w-4 mr-2" />
            Recruiters ({recruiters.length})
          </TabsTrigger>
        </TabsList>

        {/* Universities Tab */}
        <TabsContent value="universities" className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : filteredUniversities.length === 0 ? (
            <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50">
              <CardContent className="text-center py-12">
                <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">All Clear!</h3>
                <p className="text-muted-foreground">
                  {search ? 'No universities match your search' : 'No pending university approvals at the moment'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredUniversities.map(univ => renderEntityCard(univ, 'university'))}
            </div>
          )}
        </TabsContent>

        {/* Recruiters Tab */}
        <TabsContent value="recruiters" className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          ) : filteredRecruiters.length === 0 ? (
            <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50">
              <CardContent className="text-center py-12">
                <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">All Clear!</h3>
                <p className="text-muted-foreground">
                  {search ? 'No recruiters match your search' : 'No pending recruiter approvals at the moment'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredRecruiters.map(rec => renderEntityCard(rec, 'recruiter'))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Action Confirmation Dialog */}
      <AlertDialog open={actionDialog.open} onOpenChange={(open) => !open && setActionDialog({ open: false, entity: null, entityType: null, action: null, reason: '' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.action === 'approve' ? 'Approve' : 'Reject'} {actionDialog.entityType === 'university' ? 'University' : 'Recruiter'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialog.action === 'approve' ? (
                <>
                  Are you sure you want to approve <strong>{actionDialog.entity?.name}</strong>?
                  <br />
                  This will activate their account and grant them access to the platform.
                </>
              ) : (
                <div className="space-y-3">
                  <p>
                    Are you sure you want to reject <strong>{actionDialog.entity?.name}</strong>?
                  </p>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Rejection Reason *</label>
                    <Textarea
                      placeholder="Please provide a reason for rejection..."
                      value={actionDialog.reason}
                      onChange={(e) => setActionDialog({ ...actionDialog, reason: e.target.value })}
                      className="min-h-[100px]"
                    />
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (actionDialog.action === 'approve') {
                  handleApprove(actionDialog.entityType, actionDialog.entity?.id)
                } else {
                  handleReject(actionDialog.entityType, actionDialog.entity?.id, actionDialog.reason)
                }
              }}
              className={actionDialog.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {actionDialog.action === 'approve' ? 'Approve' : 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialog.open} onOpenChange={(open) => !open && setDetailsDialog({ open: false, entity: null, entityType: null, loading: false })}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailsDialog.entityType === 'university' ? (
                <Building2 className="h-5 w-5 text-blue-500" />
              ) : (
                <Briefcase className="h-5 w-5 text-purple-500" />
              )}
              {detailsDialog.entity?.name}
            </DialogTitle>
            <DialogDescription>
              Detailed information about this {detailsDialog.entityType}
            </DialogDescription>
          </DialogHeader>
          
          {detailsDialog.entity && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-sm">{detailsDialog.entity.email || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Phone</label>
                  <p className="text-sm">{detailsDialog.entity.phone || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">State</label>
                  <p className="text-sm">{detailsDialog.entity.state || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">District</label>
                  <p className="text-sm">{detailsDialog.entity.district || 'N/A'}</p>
                </div>
                {detailsDialog.entity.website && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">Website</label>
                    <p className="text-sm">
                      <a href={detailsDialog.entity.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                        {detailsDialog.entity.website}
                      </a>
                    </p>
                  </div>
                )}
                {detailsDialog.entity.address && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">Address</label>
                    <p className="text-sm">{detailsDialog.entity.address}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Submitted Date</label>
                  <p className="text-sm">{new Date(detailsDialog.entity.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <Badge variant="secondary">
                    {detailsDialog.entity.approval_status || 'pending'}
                  </Badge>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={() => {
                    setDetailsDialog({ open: false, entity: null, entityType: null, loading: false })
                    openActionDialog(detailsDialog.entity, detailsDialog.entityType, 'approve')
                  }}
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  onClick={() => {
                    setDetailsDialog({ open: false, entity: null, entityType: null, loading: false })
                    openActionDialog(detailsDialog.entity, detailsDialog.entityType, 'reject')
                  }}
                  variant="destructive"
                  className="flex-1"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
