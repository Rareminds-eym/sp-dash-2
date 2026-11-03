'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Download, Upload } from 'lucide-react'
import Papa from 'papaparse'
import { useRef, useState } from 'react'

const STATUSES = ['present', 'absent', 'late', 'excused']
function validateRow(row) {
  if (!row.status) return ''
  if (['course','date','start_time','end_time','educator_name','organization'].some(field => !row[field])) return 'Course, date, times, educator and organization are required.'
  if (!STATUSES.includes(row.status)) return 'Status must be present, absent, late or excused.'
  return ''
}

export default function EducatorAttendanceImportModal({ open, onClose, onImported }) {
  const { toast } = useToast()
  const fileRef = useRef(null)
  const [step, setStep] = useState('upload')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])
  const [importing, setImporting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [result, setResult] = useState(null)

  const reset = () => {
    setStep('upload')
    setFileName('')
    setRows([])
    setResult(null)
  }

  const handleOpenChange = (next) => {
    if (!next) {
      reset()
      onClose()
    }
  }

  const downloadTemplate = async () => {
    setDownloading(true)
    try {
      const response = await fetch('/api/educators/attendance/bulk', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load sessions')
      if (!data.data.rows.length) {
        toast({ title: 'No unmarked attendance', description: 'All eligible educator classes already have attendance.' })
        return
      }
      const csv = Papa.unparse(data.data.rows, { escapeFormulae: true })
      const blob = new Blob([csv], { type: 'text/csv' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'educator-attendance-template.csv'
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (error) {
      toast({ title: 'Download failed', description: error.message, variant: 'destructive' })
    } finally { setDownloading(false) }
  }

  const handleFile = (file) => {
    if (!file) return
    setFileName(file.name)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (parsed) => {
        if (parsed.errors?.length) {
          toast({ title: 'Invalid CSV', description: parsed.errors[0].message, variant: 'destructive' })
          return
        }
        const list = (parsed.data || [])
          .map(r => ({
            educator_name: String(r.educator_name || '').trim(),
            course: String(r.course || '').trim(),
            start_time: String(r.start_time || '').trim(),
            end_time: String(r.end_time || '').trim(),
            organization: String(r.organization || '').trim(),
            date: String(r.date || '').trim(),
            status: String(r.status || '').trim().toLowerCase(),
            remarks: String(r.remarks || r.reason || '').trim(),
          }))
          .filter(r => r.educator_name || r.date || r.status || r.remarks)
          .map(r => ({ ...r, error: validateRow(r) }))
        if (list.length === 0) {
          toast({ title: 'Empty file', description: 'No data rows found.', variant: 'destructive' })
          return
        }

        setRows(list)
        setStep('preview')
      },
      error: () => toast({ title: 'Read failed', description: 'Could not parse the CSV file.', variant: 'destructive' }),
    })
  }

  const handleImport = async () => {
    const valid = rows.filter(r => !r.error)
    if (valid.length === 0) return
    setImporting(true)
    try {
      const combined = { total: 0, succeeded: 0, failed: 0, skipped: 0, results: [] }
      for (let offset=0; offset<valid.length; offset+=500) {
        const response = await fetch('/api/educators/attendance/bulk', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: valid.slice(offset,offset+500) }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Import failed')
        for (const key of ['total','succeeded','failed','skipped']) combined[key] += data.data[key] || 0
        combined.results.push(...data.data.results)
      }
      setResult(combined)
      setStep('done')
      onImported?.()
    } catch (e) {
      toast({ title: 'Import failed', description: e.message, variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }

  const invalidCount = rows.filter(r => r.error).length

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[720px] max-h-[90dvh] min-w-0 overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Import educator attendance</DialogTitle>
          <DialogDescription>
            Download the template, fill Present, Absent, Late or Excused for each unmarked educator class, upload the CSV.
          </DialogDescription>
        </DialogHeader>

        {(step === 'upload' || step === 'preview') && (
          <section aria-label="Attendance import rules" className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-900 dark:bg-blue-950/30">
            <h3 className="font-semibold">Attendance rules</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Status accepts <strong>Present</strong>, <strong>Absent</strong>, <strong>Late</strong> or <strong>Excused</strong> (case-insensitive).</li>
              <li>Leave status blank to keep that class unmarked.</li>
              <li>Remarks are optional for every status, including Excused.</li>
              <li>Keep the downloaded class details unchanged so attendance matches the correct educator and class.</li>
              <li>Already-marked attendance is skipped and never overwritten.</li>
            </ul>
          </section>
        )}

        {step === 'upload' && (
          <div className="space-y-4 py-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" disabled={downloading} onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                {downloading ? 'Fetching sessions...' : 'Download template'}
              </Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                {fileName || 'Choose CSV file'}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The template lists course, date, class times, educator and organization.
              Fill the status column using the attendance rules above.
            </p>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 py-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
              <span className="min-w-0 break-all font-medium">{fileName}</span>
              <Badge variant="outline">{rows.length} rows</Badge>
              {invalidCount > 0 && (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  {invalidCount} invalid
                </Badge>
              )}
            </div>
            <div className="max-h-64 w-full min-w-0 overflow-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Educator / Class</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Remarks (optional)</th>
                    <th className="px-3 py-2 font-medium">Check</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2 font-medium">{r.educator_name}<div className="text-muted-foreground">{r.organization} ? {r.course} {r.start_time}?{r.end_time}</div></td>
                      <td className="px-3 py-2">{r.date}</td>
                      <td className="px-3 py-2 capitalize">{r.status}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate" title={r.remarks}>{r.remarks}</td>
                      <td className="px-3 py-2">
                        {r.error ? (
                          <span className="text-red-600 dark:text-red-400" title={r.error}>Invalid</span>
                        ) : (
                          <span className="text-green-600 dark:text-green-400">{r.status ? 'Ready' : 'Leave unmarked'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {invalidCount > 0 && (
              <p className="text-xs text-muted-foreground">
                Invalid rows are skipped on import — fix the file and re-upload, or continue with the {rows.length - invalidCount} valid rows.
              </p>
            )}
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-4 py-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                {result.succeeded} marked
              </Badge>
              {result.skipped > 0 && <Badge variant="outline">{result.skipped} skipped</Badge>}
              {result.failed > 0 && (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  {result.failed} failed
                </Badge>
              )}
            </div>
            {(result.failed > 0 || result.skipped > 0) && (
              <div className="max-h-64 w-full min-w-0 overflow-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Educator / Class</th>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.filter(r => !r.ok).map((r, i) => (
                      <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="px-3 py-2 font-medium">{r.row?.educator_name}</td>
                        <td className="px-3 py-2">{r.row?.date}</td>
                        <td className="px-3 py-2 text-red-600 dark:text-red-400">{r.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 'upload' && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => { setStep('upload'); setRows([]); }}>
                Back
              </Button>
              <Button
                disabled={importing || rows.length - invalidCount === 0}
                onClick={handleImport}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
              >
                {importing ? 'Importing…' : `Import ${rows.length - invalidCount} rows`}
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
