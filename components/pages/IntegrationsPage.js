'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LockKeyhole, Plug } from 'lucide-react'

export default function IntegrationsPage() {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/integrations/zoho-recruit', { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Status unavailable')
        setSummary(result)
      }).catch(error => { if (error.name !== 'AbortError') setError(error.message) })
    return () => controller.abort()
  }, [])
  const count = summary?.connections?.length || 0
  const connected = summary?.connections?.filter(item => item.status === 'connected').length || 0
  return (
    <div className="space-y-6">
      <Card className="neu-card">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><CardTitle>Zoho Recruit</CardTitle><p className="mt-2 text-sm text-muted-foreground">Review candidates and job openings before creating anything.</p></div>
            <Badge variant="secondary"><LockKeyhole className="mr-2 h-3 w-3" /> Email prohibited</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">{error || (!summary ? 'Loading persisted connection status…' : count ? `${connected} connected · ${count} registered source(s)` : 'No source registered. Begin with connection setup.')}</p>
          <Button asChild variant="outline"><Link href="/integrations/zoho-recruit"><Plug className="mr-2 h-4 w-4" /> Open review console</Link></Button>
        </CardContent>
      </Card>
      <Card className="neu-card"><CardHeader><CardTitle>Platform database</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Database configuration is managed by platform operations. This page does not infer connectivity or manufacture a last-sync timestamp.</p></CardContent></Card>
    </div>
  )
}
