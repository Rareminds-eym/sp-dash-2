'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  AlertTriangle,
  Book,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Eye,
  Globe,
  Mail,
  MapPin,
  Phone,
  School,
  User,
  XCircle
} from 'lucide-react'

export default function EntityCard({ entity, entityType, onViewDetails, onApprove, onReject }) {
  const isUniversity = entityType === 'university'
  const isRecruiter = entityType === 'recruiter'
  const isCollege = entityType === 'college'
  const isStudent = entityType === 'student'
  
  const entityName = isStudent 
    ? (entity.profile?.name || entity.users?.metadata?.name || 'Unknown Student') 
    : entity.name
  
  const entityEmail = isStudent ? entity.users?.email : entity.email
  
  return (
    <Card className="hover:shadow-lg transition-all duration-300 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {isUniversity ? (
                <Building2 className="h-5 w-5 text-blue-500" />
              ) : isRecruiter ? (
                <Briefcase className="h-5 w-5 text-purple-500" />
              ) : isCollege ? (
                <School className="h-5 w-5 text-green-500" />
              ) : (
                <User className="h-5 w-5 text-orange-500" />
              )}
              <h3 className="text-lg font-bold truncate">{entityName}</h3>
            </div>
            <Badge variant="secondary" className="mb-2">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Pending Approval
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onViewDetails(entity, entityType)}
            className="shrink-0"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {entityEmail && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span className="truncate">{entityEmail}</span>
            </div>
          )}
          {entity.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span className="truncate">{entity.phone}</span>
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
          {isStudent && entity.university?.name && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span className="truncate">{entity.university.name}</span>
            </div>
          )}
          {isStudent && entity.college_school_name && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <School className="h-4 w-4" />
              <span className="truncate">{entity.college_school_name}</span>
            </div>
          )}
          {isStudent && entity.branch_field && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Book className="h-4 w-4" />
              <span className="truncate">{entity.branch_field}</span>
            </div>
          )}
          {isStudent && entity.roll_number && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="font-medium">Roll #:</span>
              <span className="truncate">{entity.roll_number}</span>
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
            onClick={() => onApprove(entity, entityType)}
            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg shadow-green-500/25"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Approve
          </Button>
          <Button
            onClick={() => onReject(entity, entityType)}
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
