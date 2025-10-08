'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, FileSpreadsheet } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function ReportsPage() {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleExport = async (type) => {
    setLoading(true)
    toast({
      title: 'Export Started',
      description: `Preparing ${type} export...`
    })
    
    // Simulate export
    setTimeout(() => {
      setLoading(false)
      toast({
        title: 'Export Complete',
        description: `${type} file has been downloaded`
      })
    }, 2000)
  }

  const reports = [
    { name: 'Users Report', description: 'All users with roles and status', type: 'users' },
    { name: 'Passports Report', description: 'Skill passports and verification status', type: 'passports' },
    { name: 'Verifications Report', description: 'All verification activities', type: 'verifications' },
    { name: 'Audit Logs Report', description: 'Complete audit trail', type: 'audit' }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Reports & Exports</h2>
        <p className="text-muted-foreground">Download data reports in various formats</p>
      </div>

      <div className="grid gap-4">
        {reports.map((report) => (
          <Card key={report.type}>
            <CardHeader>
              <CardTitle className="text-lg">{report.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{report.description}</p>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleExport('CSV')}
                  disabled={loading}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleExport('Excel')}
                  disabled={loading}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
