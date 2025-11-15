'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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

export default function ListView({ entities, entityType, onViewDetails, onApprove, onReject }) {
  const isStudent = entityType === 'student'
  
  const getEntityIcon = () => {
    switch(entityType) {
      case 'university': return <Building2 className="h-5 w-5 text-blue-500" />
      case 'recruiter': return <Briefcase className="h-5 w-5 text-purple-500" />
      case 'college': return <School className="h-5 w-5 text-green-500" />
      case 'student': return <User className="h-5 w-5 text-orange-500" />
      default: return null
    }
  }
  
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
    return entity.email
  }
  
  return (
    <div className="space-y-3">
      {entities.map(entity => (
        <Card key={entity.id} className="hover:shadow-lg transition-all duration-200 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Left section - Icon and main info */}
              <div className="flex-1 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {getEntityIcon()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-bold truncate">{getEntityName(entity)}</h3>
                      <Badge variant="secondary" className="text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                      {getEntityEmail(entity) && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{getEntityEmail(entity)}</span>
                        </div>
                      )}
                      {entity.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          <span>{entity.phone}</span>
                        </div>
                      )}
                      {entity.state && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3" />
                          <span>{entity.state}{entity.district && `, ${entity.district}`}</span>
                        </div>
                      )}
                      {entity.website && (
                        <div className="flex items-center gap-2">
                          <Globe className="h-3 w-3" />
                          <a href={entity.website} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                            {entity.website}
                          </a>
                        </div>
                      )}
                      {isStudent && entity.university?.name && (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3 w-3" />
                          <span className="truncate">{entity.university.name}</span>
                        </div>
                      )}
                      {isStudent && entity.college_school_name && (
                        <div className="flex items-center gap-2">
                          <School className="h-3 w-3" />
                          <span className="truncate">{entity.college_school_name}</span>
                        </div>
                      )}
                      {isStudent && entity.branch_field && (
                        <div className="flex items-center gap-2">
                          <Book className="h-3 w-3" />
                          <span className="truncate">{entity.branch_field}</span>
                        </div>
                      )}
                      {entity.created_at && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(entity.created_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Right section - Actions */}
              <div className="flex md:flex-col gap-2 md:w-32">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewDetails(entity, entityType)}
                  className="flex-1 md:flex-none"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View
                </Button>
                <Button
                  size="sm"
                  onClick={() => onApprove(entity, entityType)}
                  className="flex-1 md:flex-none bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onReject(entity, entityType)}
                  className="flex-1 md:flex-none"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
