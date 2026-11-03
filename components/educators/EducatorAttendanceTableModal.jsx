'use client'
import {useEffect,useState} from 'react'
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog'
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'

const colors={present:'bg-green-50 text-green-700',absent:'bg-red-50 text-red-700',late:'bg-amber-50 text-amber-700',excused:'bg-blue-50 text-blue-700'}
export default function EducatorAttendanceTableModal({educator,onClose}){
 const [filters,setFilters]=useState({from:'',to:'',status:''}),[page,setPage]=useState(1),[refresh,setRefresh]=useState(0)
 const [result,setResult]=useState({rows:[],total:0,pageSize:25}),[loading,setLoading]=useState(true),[error,setError]=useState('')
 useEffect(()=>{
  const controller=new AbortController();let active=true
  setLoading(true);setError('')
  const params=new URLSearchParams({page:String(page),...filters});if(educator?.id)params.set('staffId',educator.id)
  fetch(`/api/educators/attendance?${params}`,{cache:'no-store',signal:controller.signal}).then(async response=>{
   const body=await response.json();if(!response.ok)throw new Error(body.error||'Attendance could not be loaded.')
   if(active)setResult(body.data)
  }).catch(e=>{if(active&&e.name!=='AbortError')setError(e.message)}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false;controller.abort()}
 },[educator?.id,filters,page,refresh])
 const filter=(field,value)=>{setFilters(previous=>({...previous,[field]:value}));setPage(1)}
 const totalPages=Math.max(1,Math.ceil(result.total/result.pageSize))
 return <Dialog open onOpenChange={open=>{if(!open)onClose()}}><DialogContent className="w-[calc(100vw-2rem)] max-w-6xl max-h-[90dvh] min-w-0 overflow-y-auto p-4 sm:p-6">
  <DialogHeader><DialogTitle>Educator Attendance</DialogTitle><DialogDescription>{educator ? `Recorded attendance for ${educator.firstName||educator.first_name||''} ${educator.lastName||educator.last_name||''}.` : 'Recorded attendance for all educators, including previous trainers on reassigned classes.'}</DialogDescription></DialogHeader>
  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
   <div><Label htmlFor="attendance-from">From date</Label><Input id="attendance-from" type="date" value={filters.from} onChange={e=>filter('from',e.target.value)}/></div>
   <div><Label htmlFor="attendance-to">To date</Label><Input id="attendance-to" type="date" value={filters.to} onChange={e=>filter('to',e.target.value)}/></div>
   <div><Label htmlFor="attendance-status">Status</Label><select id="attendance-status" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={filters.status} onChange={e=>filter('status',e.target.value)}><option value="">All statuses</option>{Object.keys(colors).map(status=><option key={status} value={status}>{status[0].toUpperCase()+status.slice(1)}</option>)}</select></div>
   <div className="flex items-end gap-2"><Button variant="outline" onClick={()=>{setFilters({from:'',to:'',status:''});setPage(1)}}>Clear</Button><Button variant="outline" disabled={loading} onClick={()=>setRefresh(value=>value+1)}>Refresh</Button></div>
  </div>
  {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
  {loading?<p role="status" className="py-8 text-center text-muted-foreground">Loading educator attendance...</p>:!error&&<>
   <p className="text-sm text-muted-foreground">{result.total} attendance record{result.total===1?'':'s'}</p>
   <div className="w-full min-w-0 overflow-x-auto"><AttendanceRecordsTable rows={result.rows}/></div>
   <div className="flex flex-col sm:flex-row justify-between gap-3 items-center"><span className="text-sm">Page {page} of {totalPages}</span><div className="flex gap-2"><Button variant="outline" disabled={page<=1} onClick={()=>setPage(value=>value-1)}>Previous</Button><Button variant="outline" disabled={page>=totalPages} onClick={()=>setPage(value=>value+1)}>Next</Button></div></div>
  </>}
 </DialogContent></Dialog>
}

export function AttendanceRecordsTable({rows}) {
 return (
   <Table><TableHeader><TableRow>{['Date','Educator','Organization','Course / Class','Time','Status','Remarks','Marked at'].map(title=><TableHead key={title}>{title}</TableHead>)}</TableRow></TableHeader><TableBody>
    {rows.length===0?<TableRow><TableCell colSpan={8} className="text-center py-8">No recorded attendance matches these filters.</TableCell></TableRow>:rows.map(row=><TableRow key={row.id}>
     <TableCell className="whitespace-nowrap">{row.date}</TableCell>
     <TableCell><div className="font-medium">{[row.staff?.first_name,row.staff?.last_name].filter(Boolean).join(' ')||'Educator'}</div><div className="text-xs text-muted-foreground">{row.staff?.employee_id}</div>{row.session&&row.session.organization_staff_id!==row.organization_staff_id&&<Badge variant="outline">Previous trainer</Badge>}</TableCell>
     <TableCell>{row.organization?.name||'-'}</TableCell><TableCell>{row.session?.subject_name||'Daily attendance'}</TableCell>
     <TableCell className="whitespace-nowrap">{row.session?`${row.session.start_time?.slice(0,5)} - ${row.session.end_time?.slice(0,5)}`:'-'}</TableCell>
     <TableCell><Badge variant="outline" className={`capitalize ${colors[row.status]||''}`}>{row.status}</Badge></TableCell>
     <TableCell className="max-w-xs whitespace-pre-wrap break-words">{row.remarks||'-'}</TableCell>
     <TableCell className="whitespace-nowrap">{row.marked_at?new Date(row.marked_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}):'-'}</TableCell>
    </TableRow>)}
   </TableBody></Table>
 )
}
