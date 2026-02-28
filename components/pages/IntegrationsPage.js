'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, RefreshCw } from 'lucide-react'

export default function IntegrationsPage() {
  const integrations = [
    {
      name: 'Supabase',
      description: 'PostgreSQL database and authentication',
      status: 'connected',
      lastSync: new Date().toISOString()
    },
    {
      name: 'Zoho',
      description: 'CRM and recruitment management',
      status: 'pending',
      lastSync: null
    }
  ]

  return (
    <div className="space-y-6">

      <div className="grid gap-6">
        {integrations.map((integration) => (
          <Card key={integration.name} className="neu-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{integration.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{integration.description}</p>
                </div>
                <Badge variant={integration.status === 'connected' ? 'default' : 'secondary'}>
                  {integration.status === 'connected' ? (
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-1" />
                  )}
                  {integration.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {integration.lastSync ? (
                    <p>Last synced: {new Date(integration.lastSync).toLocaleString()}</p>
                  ) : (
                    <p>Never synced</p>
                  )}
                </div>
                <Button variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Now
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
