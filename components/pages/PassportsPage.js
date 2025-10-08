'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { Search, CheckCircle2, XCircle, Award, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function PassportsPage({ currentUser }) {
  const [passports, setPassports] = useState([])
  const [filteredPassports, setFilteredPassports] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionDialog, setActionDialog] = useState({ open: false, passport: null, action: null })
  const { toast } = useToast()

  useEffect(() => {
    fetchPassports()
  }, [])

  useEffect(() => {
    const filtered = passports.filter(passport => 
      passport.students?.users?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      passport.status.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredPassports(filtered)
  }, [searchTerm, passports])

  const fetchPassports = async () => {
    try {
      const response = await fetch('/api/passports')
      const data = await response.json()
      setPassports(data)
      setFilteredPassports(data)
    } catch (error) {
      console.error('Error fetching passports:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch passports',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAction = (passport, action) => {
    setActionDialog({ open: true, passport, action })
  }

  const confirmAction = async () => {
    const { passport, action } = actionDialog
    try {
      let endpoint = ''
      let body = {}

      if (action === 'verify') {
        endpoint = '/api/verify'
        body = { passportId: passport.id, userId: currentUser.id, note: 'Passport verified by admin' }
      } else if (action === 'reject') {
        endpoint = '/api/reject-passport'
        body = { passportId: passport.id, userId: currentUser.id, reason: 'Failed verification criteria' }
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
        fetchPassports()
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
      setActionDialog({ open: false, passport: null, action: null })
    }
  }

  const getStatusBadge = (status) => {
    const colors = {
      verified: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      rejected: 'bg-red-100 text-red-700',
      suspended: 'bg-gray-100 text-gray-700'
    }
    return colors[status] || 'bg-gray-100 text-gray-700'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Skill Passports</h2>
          <p className="text-muted-foreground">Verify and manage skill passports</p>
        </div>
        <Button onClick={fetchPassports} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by student email or status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredPassports.length > 0 ? (
              filteredPassports.map((passport) => (
                <div key={passport.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                      <Award className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {passport.students?.profile?.name || passport.students?.users?.email || 'Unknown Student'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={getStatusBadge(passport.status)}>
                          {passport.status.charAt(0).toUpperCase() + passport.status.slice(1)}
                        </Badge>
                        <Badge variant={passport.aiVerification ? 'default' : 'secondary'}>
                          {passport.aiVerification ? 'AI Verified' : 'Not AI Verified'}
                        </Badge>
                        {passport.nsqfLevel && (
                          <span className="text-xs text-muted-foreground">
                            NSQF Level {passport.nsqfLevel}
                          </span>
                        )}
                      </div>
                      {passport.skills && passport.skills.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {passport.skills.map((skill, idx) => (
                            <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(currentUser.role === 'super_admin' || currentUser.role === 'admin') && passport.status === 'pending' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAction(passport, 'verify')}
                          className="text-green-600 hover:text-green-700"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Verify
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAction(passport, 'reject')}
                          className="text-red-600 hover:text-red-700"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No passports found</p>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ ...actionDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.action === 'verify' ? 'Verify Passport' : 'Reject Passport'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {actionDialog.action} this skill passport?
              {actionDialog.action === 'reject' && ' This action will mark the passport as rejected.'}
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
