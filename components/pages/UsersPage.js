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
    RefreshCw,
    Search,
    Shield,
    UserCheck,
    UserX
} from 'lucide-react'
import { useEffect, useState } from 'react'

export default function UsersPage({ currentUser }) {
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionDialog, setActionDialog] = useState({ open: false, user: null, action: null })
  const { toast } = useToast()

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    const filtered = users.filter(user => 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredUsers(filtered)
  }, [searchTerm, users])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      const data = await response.json()
      setUsers(data)
      setFilteredUsers(data)
    } catch (error) {
      console.error('Error fetching users:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch users',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (user, action) => {
    setActionDialog({ open: true, user, action })
  }

  const confirmAction = async () => {
    const { user, action } = actionDialog
    try {
      let endpoint = ''
      let body = {}

      if (action === 'suspend') {
        endpoint = '/api/suspend-user'
        body = { targetUserId: user.id, actorId: currentUser.id, reason: 'Admin action' }
      } else if (action === 'activate') {
        endpoint = '/api/activate-user'
        body = { targetUserId: user.id, actorId: currentUser.id, note: 'User activated' }
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
        fetchUsers()
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
      setActionDialog({ open: false, user: null, action: null })
    }
  }

  const getRoleBadge = (role) => {
    const colors = {
      super_admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      manager: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    }
    return colors[role] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  }

  const getRoleLabel = (role) => {
    return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
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
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-muted-foreground">Manage users and their permissions</p>
        </div>
        <Button onClick={fetchUsers} variant="outline">
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
                placeholder="Search users by email or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors dark:bg-gray-800/50 dark:hover:bg-gray-800">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                      <Shield className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-medium dark:text-white">{user.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={getRoleBadge(user.role)}>
                          {getRoleLabel(user.role)}
                        </Badge>
                        <Badge variant={user.isActive ? 'default' : 'secondary'}>
                          {user.isActive ? 'Active' : 'Suspended'}
                        </Badge>
                        {user.organizations?.name && (
                          <span className="text-xs text-muted-foreground">
                            {user.organizations.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {currentUser.role === 'super_admin' && user.id !== currentUser.id && (
                      user.isActive ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAction(user, 'suspend')}
                        >
                          <UserX className="h-4 w-4 mr-2" />
                          Suspend
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAction(user, 'activate')}
                        >
                          <UserCheck className="h-4 w-4 mr-2" />
                          Activate
                        </Button>
                      )
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No users found</p>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ ...actionDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.action === 'suspend' ? 'Suspend User' : 'Activate User'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {actionDialog.action} {actionDialog.user?.email}?
              {actionDialog.action === 'suspend' && ' This will prevent the user from accessing the system.'}
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
