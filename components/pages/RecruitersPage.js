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
import { useToast } from '@/hooks/use-toast'
import {
    Briefcase,
    CheckCircle2,
    RefreshCw,
    Search,
    UserCheck,
    UserX,
    XCircle,
    Building2
} from 'lucide-react'
import { useEffect, useState } from 'react'

export default function RecruitersPage({ currentUser }) {
  const [recruiters, setRecruiters] = useState([])
  const [filteredRecruiters, setFilteredRecruiters] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionDialog, setActionDialog] = useState({ open: false, recruiter: null, action: null })
  const { toast } = useToast()

  useEffect(() => {
    fetchRecruiters()
  }, [])

  useEffect(() => {
    const filtered = recruiters.filter(recruiter => 
      recruiter.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recruiter.state?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recruiter.verificationStatus?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredRecruiters(filtered)
  }, [searchTerm, recruiters])

  const fetchRecruiters = async () => {
    try {
      const response = await fetch('/api/recruiters')
      const data = await response.json()
      setRecruiters(data)
      setFilteredRecruiters(data)
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

  const handleAction = (recruiter, action) => {
    setActionDialog({ open: true, recruiter, action })
  }

  const confirmAction = async () => {
    const { recruiter, action } = actionDialog
    try {
      let endpoint = ''
      let body = {}

      if (action === 'approve') {
        endpoint = '/api/approve-recruiter'
        body = { recruiterId: recruiter.id, userId: currentUser?.id, note: 'Recruiter approved' }
      } else if (action === 'reject') {
        endpoint = '/api/reject-recruiter'
        body = { recruiterId: recruiter.id, userId: currentUser?.id, reason: 'Failed verification criteria' }
      } else if (action === 'suspend') {
        endpoint = '/api/suspend-recruiter'
        body = { recruiterId: recruiter.id, userId: currentUser?.id, reason: 'Suspended by admin' }
      } else if (action === 'activate') {
        endpoint = '/api/activate-recruiter'
        body = { recruiterId: recruiter.id, userId: currentUser?.id, note: 'Recruiter activated' }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Success',
          description: data.message
        })
        fetchRecruiters()
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Action failed',
        variant: 'destructive'
      })
    } finally {
      setActionDialog({ open: false, recruiter: null, action: null })
    }
  }

  const getVerificationBadge = (status) => {
    const colors = {
      approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    }
    return colors[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Recruiter Verification</h2>
          <p className="text-muted-foreground">Verify and manage recruiter organizations</p>
        </div>
        <Button onClick={fetchRecruiters} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="neu-card">
              <CardContent className="pt-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-gray-300 rounded w-2/3 dark:bg-gray-700"></div>
                  <div className="h-8 bg-gray-300 rounded w-1/3 dark:bg-gray-700"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="neu-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Recruiters</p>
                <p className="text-2xl font-bold">{recruiters.length}</p>
              </div>
              <Building2 className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="neu-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {recruiters.filter(r => r.verificationStatus === 'pending').length}
                </p>
              </div>
              <Briefcase className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="neu-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-600">
                  {recruiters.filter(r => r.verificationStatus === 'approved').length}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="neu-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-blue-600">
                  {recruiters.filter(r => r.isActive).length}
                </p>
              </div>
              <UserCheck className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      <Card className="neu-card">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, state, or status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                disabled={loading}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {/* Loading skeletons */}
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg animate-pulse dark:bg-gray-800/50">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 bg-gray-300 rounded-full dark:bg-gray-700"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-300 rounded w-1/4 dark:bg-gray-700"></div>
                      <div className="h-3 bg-gray-300 rounded w-1/3 dark:bg-gray-700"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRecruiters.length > 0 ? (
              filteredRecruiters.map((recruiter) => (
                <div key={recruiter.id} className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors dark:bg-gray-800/50 dark:hover:bg-gray-800">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                      <Briefcase className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-medium dark:text-white">{recruiter.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={getVerificationBadge(recruiter.verificationStatus)}>
                          {recruiter.verificationStatus?.charAt(0).toUpperCase() + recruiter.verificationStatus?.slice(1)}
                        </Badge>
                        <Badge variant={recruiter.isActive ? 'default' : 'secondary'}>
                          {recruiter.isActive ? 'Active' : 'Suspended'}
                        </Badge>
                        {recruiter.state && (
                          <span className="text-xs text-muted-foreground">
                            {recruiter.state}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>Registered: {formatDate(recruiter.createdAt)}</span>
                        {recruiter.userCount > 0 && (
                          <span>• {recruiter.userCount} user{recruiter.userCount !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(currentUser?.role === 'super_admin' || currentUser?.role === 'admin') && (
                      <>
                        {recruiter.verificationStatus === 'pending' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAction(recruiter, 'approve')}
                              className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAction(recruiter, 'reject')}
                              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </>
                        )}
                        {recruiter.verificationStatus === 'approved' && (
                          recruiter.isActive ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAction(recruiter, 'suspend')}
                            >
                              <UserX className="h-4 w-4 mr-2" />
                              Suspend
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAction(recruiter, 'activate')}
                            >
                              <UserCheck className="h-4 w-4 mr-2" />
                              Activate
                            </Button>
                          )
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No recruiters found</p>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ ...actionDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.action === 'approve' && 'Approve Recruiter'}
              {actionDialog.action === 'reject' && 'Reject Recruiter'}
              {actionDialog.action === 'suspend' && 'Suspend Recruiter'}
              {actionDialog.action === 'activate' && 'Activate Recruiter'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {actionDialog.action} <strong>{actionDialog.recruiter?.name}</strong>?
              {actionDialog.action === 'approve' && ' This will allow the recruiter to access the platform.'}
              {actionDialog.action === 'reject' && ' This will reject the recruiter registration.'}
              {actionDialog.action === 'suspend' && ' This will temporarily suspend the recruiter\'s access.'}
              {actionDialog.action === 'activate' && ' This will restore the recruiter\'s access.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
