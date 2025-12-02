'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, CheckCircle2, Eye, XCircle } from 'lucide-react'

export default function TableView({ entities, entityType, onViewDetails, onApprove, onReject }) {
  const isStudent = entityType === 'student'
  
  const getEntityName = (entity) => {
    if (isStudent) {
      return entity.name || entity.profile?.name || entity.users?.metadata?.name || 'Unknown Student'
    }
    return entity.name
  }
  
  const getEntityEmail = (entity) => {
    if (isStudent) {
      return entity.users?.email || entity.email
    }
    return entity.email || entity.deanEmail
  }
  
  const getColumns = () => {
    switch(entityType) {
      case 'university':
        return ['Name', 'Email', 'State', 'District', 'Submitted', 'Status', 'Actions']
      case 'recruiter':
        return ['Name', 'Email', 'Phone', 'State', 'Submitted', 'Status', 'Actions']
      case 'college':
        return ['Name', 'Email', 'State', 'City', 'Submitted', 'Status', 'Actions']
      case 'student':
        return ['Name', 'Email', 'University', 'College', 'Branch', 'Submitted', 'Status', 'Actions']
      default:
        return ['Name', 'Email', 'State', 'Submitted', 'Status', 'Actions']
    }
  }
  
  return (
    <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 dark:bg-slate-900/50">
                {getColumns().map((col) => (
                  <TableHead key={col} className="font-semibold">{col}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {entities.map((entity) => (
                <TableRow key={entity.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                  <TableCell className="font-medium">
                    {getEntityName(entity)}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {getEntityEmail(entity) || 'N/A'}
                  </TableCell>
                  
                  {entityType === 'university' && (
                    <>
                      <TableCell>{entity.state || 'N/A'}</TableCell>
                      <TableCell>{entity.district || 'N/A'}</TableCell>
                    </>
                  )}
                  
                  {entityType === 'recruiter' && (
                    <>
                      <TableCell>{entity.phone || 'N/A'}</TableCell>
                      <TableCell>{entity.state || 'N/A'}</TableCell>
                    </>
                  )}
                  
                  {entityType === 'college' && (
                    <>
                      <TableCell>{entity.state || 'N/A'}</TableCell>
                      <TableCell>{entity.city || 'N/A'}</TableCell>
                    </>
                  )}
                  
                  {entityType === 'student' && (
                    <>
                      <TableCell className="max-w-[150px] truncate">
                        {entity.university?.name || entity.university || 'N/A'}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">
                        {entity.college_school_name || 'N/A'}
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate">
                        {entity.branch_field || 'N/A'}
                      </TableCell>
                    </>
                  )}
                  
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {entity.created_at ? new Date(entity.created_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Pending
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onViewDetails(entity, entityType)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        className="h-8 w-8 bg-green-500 hover:bg-green-600"
                        onClick={() => onApprove(entity, entityType)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-8 w-8"
                        onClick={() => onReject(entity, entityType)}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
