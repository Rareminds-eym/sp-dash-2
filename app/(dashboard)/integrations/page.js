import React, { Suspense } from 'react'
import IntegrationsPage from '@/components/pages/IntegrationsPage'

export default function Integrations() {
  return (
    <Suspense fallback={<div className="p-6">Loading integrations...</div>}>
      <IntegrationsPage />
    </Suspense>
  )
}