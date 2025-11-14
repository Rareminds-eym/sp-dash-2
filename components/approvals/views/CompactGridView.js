'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  AlertTriangle,
  Briefcase,
  Building2,
  CheckCircle2,
  Eye,
  Mail,
  School,
  User,
  XCircle
} from 'lucide-react'

export default function CompactGridView({ entities, entityType, onViewDetails, onApprove, onReject }) {
  const getEntityIcon = () => {
    switch(entityType) {
      case 'university': return <Building2 className="h-4 w-4 text-blue-500" />
      case 'recruiter': return <Briefcase className="h-4 w-4 text-purple-500" />
      case 'college': return <School className="h-4 w-4 text-green-500" />
      case 'student': return <User className="h-4 w-4 text-orange-500" />
      default: return null
    }
  }
  
  const getEntityName = (entity) => {
    if (entityType === 'student') {
      return entity.profile?.name || entity.users?.metadata?.name || 'Unknown Student'
    }
    return entity.name
  }
  
  const getEntityEmail = (entity) => {
    if (entityType === 'student') {
      return entity.users?.email
    }
    return entity.email
  }
  
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {entities.map(entity => (
        <Card key={entity.id} className="hover:shadow-md transition-all duration-200 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {getEntityIcon()}
                <h3 className="text-sm font-semibold truncate">{getEntityName(entity)}</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => onViewDetails(entity, entityType)}
              >
                <Eye className="h-3 w-3" />
              </Button>
            </div>
            
            <Badge variant="secondary" className="text-xs">
              <AlertTriangle className="h-2 w-2 mr-1" />
              Pending
            </Badge>
            
            {getEntityEmail(entity) && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" />
                <span className="truncate">{getEntityEmail(entity)}</span>
              </div>
            )}
            
            <div className="flex gap-1 pt-1">
              <Button
                size="sm"
                onClick={() => onApprove(entity, entityType)}
                className="flex-1 h-7 text-xs bg-green-500 hover:bg-green-600"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onReject(entity, entityType)}
                className="flex-1 h-7 text-xs"
              >
                <XCircle className="h-3 w-3 mr-1" />
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
