'use client';

import { useEffect, useRef, useState, type FormEvent, type ComponentType, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { Download, Plus, RefreshCw, Search, Ticket } from 'lucide-react';
import type { Redemption } from '@/lib/promos/redemptions';
import { Button as SharedButton } from '@/components/ui/button';
import { Dialog, DialogContent as SharedDialogContent, DialogDescription as SharedDialogDescription, DialogHeader as SharedDialogHeader, DialogTitle as SharedDialogTitle } from '@/components/ui/dialog';
import { createPromoSchema, editPromoSchema, money, promoStatus, roles, rupeesToMinor, type PromoPlan, type PromoRole } from '@/lib/promos/model';

// The existing JS primitives infer RefAttributes only; retain native props for this TS consumer.
const Button = SharedButton as ComponentType<ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }>;
const DialogContent = SharedDialogContent as ComponentType<{ children: ReactNode; className?: string }>;
const DialogTitle = SharedDialogTitle as ComponentType<HTMLAttributes<HTMLHeadingElement>>;
const DialogDescription = SharedDialogDescription as ComponentType<HTMLAttributes<HTMLParagraphElement>>;
const DialogHeader = SharedDialogHeader as ComponentType<HTMLAttributes<HTMLDivElement>>;

type Campaign = { id: string; code: string; campaign_name: string; active: boolean; starts_at: string; expires_at: string;
  overall_max_uses: number; role_quotas: Partial<Record<PromoRole, number>>; price_adjustment: number; target_plan_code: string | null;
  fixed_price_minor: number | null; updated_at: string; used: number };
const field = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';
const date = (value: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value));
const localIST = (value: Date) => new Date(value.getTime() + 330 * 60000).toISOString().slice(0, 16);
const initialForm = () => ({ code: '', campaign_name: '', role: 'learner' as PromoRole, target_plan_code: '', mode: 'fixed' as 'fixed' | 'addition', amount: '', overall_max_uses: '100',
  starts_at: localIST(new Date()), expires_at: localIST(new Date(Date.now() + 30 * 86400000)) });
async function api(path = '', body?: unknown, method = 'POST', signal?: AbortSignal) {
  const response = await fetch(`/api/admin/promo-codes${path}`, { method: body === undefined ? 'GET' : method, cache: 'no-store', signal,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed. Please retry.');
  return result;
}
function Pager({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm text-muted-foreground">
    <span>{total} {total === 1 ? 'record' : 'records'} · Page {page} of {Math.max(1, Math.ceil(total / 20))}</span>
    <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 1} onClick={() => onChange(page - 1)}>Previous</Button>
      <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => onChange(page + 1)}>Next</Button></div>
  </div>;
}
export default function PromoManagement() {
  const [items, setItems] = useState<Campaign[]>([]), [total, setTotal] = useState(0), [page, setPage] = useState(1);
  const [query, setQuery] = useState(''), [search, setSearch] = useState(''), [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [plans, setPlans] = useState<PromoPlan[]>([]), [planError, setPlanError] = useState(''), [plansLoading, setPlansLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false), [form, setForm] = useState(initialForm), [formError, setFormError] = useState('');
  const [editing, setEditing] = useState<Campaign | null>(null), [deleting, setDeleting] = useState<Campaign | null>(null);
  const [editQuotas, setEditQuotas] = useState<Record<PromoRole, string>>({ learner: '0', school_admin: '0', college_admin: '0' });
  const [deleteError, setDeleteError] = useState('');
  const [busy, setBusy] = useState(false), busyRef = useRef(false), errorRef = useRef<HTMLParagraphElement>(null);
  const [toggle, setToggle] = useState<Campaign | null>(null), [detail, setDetail] = useState<Campaign | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]), [redemptionPage, setRedemptionPage] = useState(1), [redemptionTotal, setRedemptionTotal] = useState(0);
  const [detailError, setDetailError] = useState(''), [detailLoading, setDetailLoading] = useState(false);
  const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState('');
  const exportRef = useRef(false);
  useEffect(() => { setExportError(''); }, [detail?.id]);
  const [usedByRole, setUsedByRole] = useState<Partial<Record<PromoRole, number>>>({});
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    api(`?page=${page}&q=${encodeURIComponent(search)}`, undefined, undefined, controller.signal).then(value => { setItems(value.items); setTotal(value.total); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, search, refresh]);
  useEffect(() => {
    const controller = new AbortController(); setPlansLoading(true); setPlanError('');
    api('?kind=plans', undefined, undefined, controller.signal).then(value => setPlans(value.plans))
      .catch(error => { if (!controller.signal.aborted) setPlanError(error.message); }).finally(() => { if (!controller.signal.aborted) setPlansLoading(false); });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    if (!detail) return;
    const controller = new AbortController(); setDetailLoading(true); setDetailError(''); setRedemptions([]); setUsedByRole({});
    api(`/redemptions?id=${detail.id}&page=${redemptionPage}`, undefined, undefined, controller.signal)
      .then(value => { setRedemptions(value.items); setRedemptionTotal(value.total); setUsedByRole(value.usedByRole); })
      .catch(error => { if (!controller.signal.aborted) setDetailError(error.message); }).finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [detail, redemptionPage, refresh]);
  useEffect(() => { if (formError) errorRef.current?.focus(); }, [formError]);
  const selected = plans.find(plan => plan.code === form.target_plan_code && plan.role === form.role);
  let preview: number | null = null;
  try { if (selected && form.amount) preview = rupeesToMinor(form.amount) + (form.mode === 'addition' ? selected.baseMinor : 0); } catch { /* shown on submit */ }
  const change = (key: keyof ReturnType<typeof initialForm>, value: string) => setForm(current => ({ ...current, [key]: value }));
  async function create(event: FormEvent) {
    event.preventDefault(); if (busyRef.current) return; setFormError('');
    let input;
    try {
      const terms = { campaign_name: form.campaign_name, mode: form.mode, amount: form.amount, overall_max_uses: Number(form.overall_max_uses),
        starts_at: editing && form.starts_at === localIST(new Date(editing.starts_at)) ? editing.starts_at : new Date(`${form.starts_at}:00+05:30`).toISOString(),
        expires_at: editing && form.expires_at === localIST(new Date(editing.expires_at)) ? editing.expires_at : new Date(`${form.expires_at}:00+05:30`).toISOString() };
      input = editing ? editPromoSchema.parse({ ...terms, id: editing.id, updated_at: editing.updated_at, role_quotas: Object.fromEntries(Object.entries(editQuotas).map(([role, count]) => [role, Number(count)])) }) : createPromoSchema.parse({ ...terms, code: form.code, role: form.role, target_plan_code: form.target_plan_code });
    }
    catch (error: any) { setFormError(error.issues?.[0]?.message || 'Check the campaign dates and required fields.'); return; }
    busyRef.current = true; setBusy(true);
    try { await api('', input, editing ? 'PATCH' : 'POST'); setCreateOpen(false); setNotice(`Promo code ${form.code} ${editing ? 'updated' : 'created'}.`); if (!editing) { setPage(1); setSearch(''); setQuery(''); } setRefresh(value => value + 1); }
    catch (error: any) { setFormError(error.message); }
    finally { busyRef.current = false; setBusy(false); }
  }
  function openEdit(row: Campaign) {
    const role = (Object.keys(roles) as PromoRole[]).find(role => Number(row.role_quotas[role]) > 0) || 'learner';
    setEditing(row); setFormError('');
    setForm({ code: row.code, campaign_name: row.campaign_name, role, target_plan_code: row.target_plan_code || '', mode: row.fixed_price_minor !== null ? 'fixed' : 'addition',
      amount: row.fixed_price_minor !== null ? (Number(row.fixed_price_minor) / 100).toFixed(2) : String(row.price_adjustment), overall_max_uses: String(row.overall_max_uses), starts_at: localIST(new Date(row.starts_at)), expires_at: localIST(new Date(row.expires_at)) });
    setEditQuotas(Object.fromEntries((Object.keys(roles) as PromoRole[]).map(role => [role, String(row.role_quotas[role] || 0)])) as Record<PromoRole, string>);
    setCreateOpen(true);
  }
  async function deleteCampaign() {
    if (!deleting || deleting.used > 0 || busyRef.current || exportRef.current) return;
    busyRef.current = true; setBusy(true); setDeleteError('');
    try {
      await api('', { id: deleting.id, updated_at: deleting.updated_at }, 'DELETE');
      setNotice(`Promo code ${deleting.code} deleted.`); setDeleting(null);
      if (items.length === 1 && page > 1) setPage(page - 1);
      setRefresh(value => value + 1);
    } catch (error: any) { setDeleteError(error.message); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function updateStatus() {
    if (!toggle || busyRef.current) return; busyRef.current = true; setBusy(true); setError('');
    try { await api('', { id: toggle.id, active: !toggle.active, updated_at: toggle.updated_at }, 'PATCH'); setNotice(`${toggle.code} ${toggle.active ? 'paused' : 'enabled'}.`); setToggle(null); setRefresh(value => value + 1); }
    catch (error: any) { setToggle(null); setError(error.message); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function downloadRedemptions(campaign: Campaign) {
    if (exportRef.current || busyRef.current) return;
    exportRef.current = true; setExporting(true); setExportError('');
    try {
      const response = await fetch(`/api/admin/promo-codes/redemptions/export?id=${campaign.id}`, { cache: 'no-store' });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || 'Excel export failed. Please retry.'); }
      if (!response.headers.get('content-type')?.startsWith('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) throw new Error('Invalid export response. Please retry.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = `promo-redemptions-${campaign.code}.xlsx`;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error: any) { setExportError(error.message || 'Excel export failed. Please retry.'); }
    finally { exportRef.current = false; setExporting(false); }
  }
  return <div className="mx-auto min-w-0 max-w-7xl space-y-6 md:p-2">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><Ticket className="h-4 w-4" /> Subscription management</div>
      <h1 className="text-2xl font-semibold tracking-tight">Promo codes</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Set a promotional price for a published plan and manage access for learners, schools and colleges.</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => setRefresh(value => value + 1)} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
        <Button onClick={() => { setEditing(null); setForm(initialForm()); setFormError(''); setCreateOpen(true); }}><Plus className="mr-2 h-4 w-4" />Create code</Button></div></header>
    <p className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">A use is counted when a user locks their price before payment. It does not confirm payment. Pausing a code preserves all previously locked prices.</p>
    {notice && <p role="status" className="text-sm text-green-700 dark:text-green-400">{notice}</p>}
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 p-4 text-sm text-destructive">{error}<Button variant="outline" onClick={() => setRefresh(value => value + 1)}>Try again</Button></div>}
    <section className="overflow-hidden rounded-lg border bg-card" aria-label="Campaigns">
      <form className="flex flex-wrap items-center gap-3 border-b p-4" onSubmit={event => { event.preventDefault(); setPage(1); setSearch(query.trim()); }}>
        <label htmlFor="promo-search" className="sr-only">Search by promo code</label><div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input id="promo-search" className={`${field} pl-9`} placeholder="Search by promo code" maxLength={40} value={query} onChange={event => setQuery(event.target.value)} /></div>
        <Button variant="outline" type="submit">Search</Button>{search && <Button variant="ghost" type="button" onClick={() => { setQuery(''); setSearch(''); setPage(1); }}>Clear</Button>}
      </form>
      {loading ? <p role="status" className="p-10 text-center text-sm text-muted-foreground">Loading promo codes…</p> : error ? null : items.length === 0 ? <div className="space-y-2 p-12 text-center"><h2 className="font-medium">{search ? 'No matching codes' : 'No promo codes yet'}</h2><p className="text-sm text-muted-foreground">{search ? 'Try a different code.' : 'Create a code to offer a plan at a promotional price.'}</p></div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Promo campaigns and locked-price usage</caption><thead className="bg-muted/40 text-xs text-muted-foreground"><tr>{['Code / campaign', 'Audience / plan', 'Promotional price', 'Uses', 'Status / expiry (IST)', 'Actions'].map(label => <th scope="col" key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
        <tbody className="divide-y">{items.map(row => { const status = promoStatus(row); const plan = plans.find(plan => plan.code === row.target_plan_code); return <tr key={row.id} className="align-top hover:bg-muted/20">
          <td className="px-4 py-4"><span className="font-mono font-semibold">{row.code}</span><p className="mt-1 max-w-48 break-words text-xs text-muted-foreground">{row.campaign_name}</p></td>
          <td className="px-4 py-4"><p>{Object.entries(row.role_quotas).filter(([, count]) => Number(count) > 0).map(([role]) => roles[role as PromoRole] || role).join(', ') || 'No eligible audience'}</p><p className="mt-1 max-w-48 break-all text-xs text-muted-foreground">{plan?.name || (row.target_plan_code ? 'Published plan reference' : 'Default starter plan per audience')}</p>{row.target_plan_code && !plan && <code className="text-xs">{row.target_plan_code.slice(0, 16)}…</code>}</td>
          <td className="whitespace-nowrap px-4 py-4 font-medium">{row.fixed_price_minor !== null ? money(Number(row.fixed_price_minor)) : `Base + ${money(Number(row.price_adjustment) * 100)}`}<p className="mt-1 text-xs font-normal text-muted-foreground">{row.fixed_price_minor !== null ? 'Fixed plan price' : 'Additional charge'}{plan ? ` / ${plan.intervalCount} ${plan.intervalUnit}` : ''}</p></td>
          <td className="px-4 py-4"><span className="whitespace-nowrap font-medium">{row.used} / {row.overall_max_uses}</span><p className="mt-1 text-xs text-muted-foreground">Prices locked</p></td>
          <td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-xs font-medium ${status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200' : 'bg-muted text-muted-foreground'}`}>{status}</span><p className="mt-2 whitespace-nowrap text-xs text-muted-foreground">{date(row.expires_at)}</p></td>
          <td className="relative px-4 py-3"><div className="flex flex-wrap gap-1"><Button variant="ghost" size="sm" onClick={() => { setDetail(row); setRedemptionPage(1); }}>Details<span className="sr-only"> for {row.code}</span></Button><Button variant="outline" size="sm" onClick={() => openEdit(row)}>Edit<span className="sr-only"> {row.code}</span></Button><Button variant="outline" size="sm" onClick={() => setToggle(row)}>{row.active ? 'Pause' : 'Enable'}<span className="sr-only"> {row.code}</span></Button><Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setDeleting(row); setDeleteError(''); }}>Delete<span className="sr-only"> {row.code}</span></Button></div></td>
        </tr>; })}</tbody></table></div>}
      {!loading && !error && <Pager page={page} total={total} onChange={setPage} />}
    </section>
    <Dialog open={createOpen} onOpenChange={open => { if (!busy) setCreateOpen(open); }}><DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-2xl grid-cols-[minmax(0,1fr)] overflow-y-auto p-4 sm:p-6"><DialogHeader><DialogTitle>{editing ? 'Edit promo code' : 'Create promo code'}</DialogTitle><DialogDescription>{editing ? 'Changes apply to new redemptions. Previously locked prices stay unchanged. The code and target plan stay fixed.' : 'Choose one audience and plan, then set the promotional price and usage limits.'}</DialogDescription></DialogHeader>
      <form onSubmit={create} className="space-y-5" aria-busy={busy}>
        {formError && <p ref={errorRef} tabIndex={-1} role="alert" className="rounded border border-destructive/40 p-3 text-sm text-destructive">{formError}</p>}
        <fieldset disabled={busy} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2"><legend className="sr-only">Campaign details</legend>
          <label className="space-y-2 text-sm font-medium">Promo code<input className={field} readOnly={!!editing} required={!editing} minLength={editing ? undefined : 3} maxLength={editing ? undefined : 40} pattern={editing ? undefined : '[A-Za-z0-9][A-Za-z0-9_-]{2,39}'} value={form.code} onChange={event => change('code', event.target.value.toUpperCase())} placeholder="e.g. LEARNER1000" autoComplete="off" /><span className="block text-xs font-normal text-muted-foreground">{editing ? 'The code stays fixed so existing links continue to work.' : '3–40 letters, numbers, hyphens or underscores.'}</span></label>
          <label className="space-y-2 text-sm font-medium">Campaign name<input className={field} required maxLength={120} value={form.campaign_name} onChange={event => change('campaign_name', event.target.value)} placeholder="e.g. School admissions 2026" /></label>
          {editing ? <label className="space-y-2 text-sm font-medium sm:col-span-2">Target plan<input className={field} readOnly value={plans.find(plan => plan.code === editing.target_plan_code || plan.name.toLowerCase() === editing.target_plan_code)?.name || editing.target_plan_code || 'Default starter plan per audience'} /></label> : <>
          <label className="space-y-2 text-sm font-medium">Audience<select className={field} value={form.role} onChange={event => setForm(current => ({ ...current, role: event.target.value as PromoRole, target_plan_code: '' }))}>{Object.entries(roles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="space-y-2 text-sm font-medium">Published plan<select className={field} required disabled={plansLoading || !!planError} value={form.target_plan_code} onChange={event => change('target_plan_code', event.target.value)}><option value="">{plansLoading ? 'Loading plans…' : 'Choose a plan'}</option>{plans.filter(plan => plan.role === form.role).map(plan => <option key={plan.code} value={plan.code}>{plan.name} — {money(plan.baseMinor)} / {plan.intervalCount} {plan.intervalUnit}</option>)}</select></label></>}
          {planError && <p role="alert" className="text-sm text-destructive sm:col-span-2">{planError} <button type="button" className="underline" onClick={() => setRefresh(value => value + 1)}>Retry</button></p>}
          {!plansLoading && !planError && !plans.some(plan => plan.role === form.role) && <p className="text-sm text-muted-foreground sm:col-span-2">No compatible published INR plans are available for this audience.</p>}
          <label className="space-y-2 text-sm font-medium">Pricing method<select className={field} value={form.mode} onChange={event => change('mode', event.target.value)}><option value="fixed">Fixed promotional price</option><option value="addition">Add to published price</option></select></label>
          <label className="space-y-2 text-sm font-medium">{form.mode === 'fixed' ? 'Plan price (₹)' : 'Additional amount (₹)'}<input className={field} required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" value={form.amount} onChange={event => change('amount', event.target.value)} placeholder="1000.00" /><span className="block text-xs font-normal text-muted-foreground">Enter rupees, for example 1000 for ₹1,000.</span></label>
          <label className="space-y-2 text-sm font-medium">Starts at (IST)<input className={field} type="datetime-local" required value={form.starts_at} onChange={event => change('starts_at', event.target.value)} /></label>
          <label className="space-y-2 text-sm font-medium">Expires at (IST)<input className={field} type="datetime-local" required value={form.expires_at} onChange={event => change('expires_at', event.target.value)} /></label>
          <label className="space-y-2 text-sm font-medium">Maximum uses<input className={field} type="number" required min={1} max={2147483647} step={1} value={form.overall_max_uses} onChange={event => change('overall_max_uses', event.target.value)} /><span className="block text-xs font-normal text-muted-foreground">One use per account when a price is locked.</span></label>
          {editing && <fieldset className="grid min-w-0 grid-cols-1 gap-3 rounded-lg border p-3 sm:col-span-2 sm:grid-cols-3"><legend className="px-1 text-sm font-medium">Audience limits</legend>{(Object.keys(roles) as PromoRole[]).map(role => <label key={role} className="space-y-2 text-sm">{roles[role]}<input className={field} type="number" required min={0} max={2147483647} step={1} value={editQuotas[role]} onChange={event => setEditQuotas(current => ({ ...current, [role]: event.target.value }))} /></label>)}<p className="text-xs text-muted-foreground sm:col-span-3">Zero stops new redemptions for that audience. Reducing limits never removes existing history.</p></fieldset>}
        </fieldset>
        {selected && <div className="rounded-lg border bg-muted/30 p-4 text-sm"><p className="font-medium">{selected.name} · {roles[form.role]}</p><p className="mt-1 text-muted-foreground">Published price: {money(selected.baseMinor)} / {selected.intervalCount} {selected.intervalUnit}</p>{preview !== null && <p className="mt-2 font-semibold">Promotional price: {money(preview)} / {selected.intervalCount} {selected.intervalUnit}</p>}<p className="mt-2 text-xs text-muted-foreground">Existing checkout tax rules apply. This campaign does not change tax configuration.</p></div>}
        <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={busy} onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit" disabled={busy || plansLoading || !!planError || (!editing && !selected)}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create code'}</Button></div>
      </form></DialogContent></Dialog>
    <Dialog open={!!deleting} onOpenChange={open => { if (!open && !busy && !exporting) setDeleting(null); }}><DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] grid-cols-[minmax(0,1fr)] overflow-y-auto"><DialogHeader><DialogTitle className="break-all">Delete {deleting?.code}?</DialogTitle><DialogDescription>{deleting && deleting.used > 0 ? `This code has ${deleting.used} redemption(s) and cannot be deleted. Pause it to stop new redemptions while keeping saved prices and history.` : 'This permanently deletes the unused promo code. Existing signup links containing this code will no longer be valid.'}</DialogDescription></DialogHeader>
      {deleteError && <p role="alert" className="text-sm text-destructive">{deleteError}</p>}<div className="flex flex-wrap justify-end gap-2 border-t pt-4"><Button variant="outline" disabled={busy || exporting} onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" disabled={busy || exporting || !deleting || deleting.used > 0} onClick={deleteCampaign}>{busy ? 'Deleting…' : 'Delete code'}</Button></div></DialogContent></Dialog>
    <Dialog open={!!toggle} onOpenChange={open => { if (!open && !busy) setToggle(null); }}><DialogContent><DialogHeader><DialogTitle>{toggle?.active ? 'Pause' : 'Enable'} {toggle?.code}?</DialogTitle><DialogDescription>{toggle?.active ? 'New users will no longer be able to lock this promotional price. Previously locked prices remain valid.' : 'New users can redeem this code if its dates and usage limits allow it. Previously locked prices remain unchanged.'}</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setToggle(null)}>Cancel</Button><Button disabled={busy} onClick={updateStatus}>{busy ? 'Saving…' : toggle?.active ? 'Pause code' : 'Enable code'}</Button></div></DialogContent></Dialog>
    <Dialog open={!!detail} onOpenChange={open => { if (!open) setDetail(null); }}><DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-6xl grid-cols-[minmax(0,1fr)] overflow-y-auto p-4 sm:p-6"><DialogHeader><DialogTitle>{detail?.code}</DialogTitle><DialogDescription>{detail?.campaign_name} · Campaign terms and locked prices</DialogDescription></DialogHeader>
      {detail && <><dl className="grid gap-4 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-3"><div><dt className="text-muted-foreground">Starts (IST)</dt><dd className="mt-1">{date(detail.starts_at)}</dd></div><div><dt className="text-muted-foreground">Expires (IST)</dt><dd className="mt-1">{date(detail.expires_at)}</dd></div><div><dt className="text-muted-foreground">Usage by audience</dt><dd>{Object.entries(detail.role_quotas).map(([role, limit]) => <p key={role} className="mt-1">{roles[role as PromoRole]}: {usedByRole[role as PromoRole] ?? '—'} / {limit}</p>)}</dd></div><div className="sm:col-span-3"><dt className="text-muted-foreground">Target plan</dt><dd className="mt-1 break-all font-mono text-xs">{detail.target_plan_code || 'Default starter plan per audience'}</dd></div></dl>
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row"><div className="min-w-0 flex-1"><h3 className="font-medium">Redemption history</h3><p className="mt-1 text-sm text-muted-foreground">Saved prices, including users who have not completed payment. Profile details reflect the current account.</p></div>
          <Button variant="outline" disabled={exporting || detailLoading || !!detailError} onClick={() => detail && downloadRedemptions(detail)}><Download className="mr-2 h-4 w-4" />{exporting ? 'Exporting…' : 'Export Excel'}</Button></div>
        {exportError && <p role="alert" className="text-sm text-destructive">{exportError}</p>}
        {!exporting && !exportError && <p className="text-xs text-muted-foreground">Excel includes all campaign redemptions, up to 10,000 records.</p>}
        {detailError ? <p role="alert" className="text-sm text-destructive">{detailError} <button className="underline" onClick={() => setRefresh(value => value + 1)}>Retry</button></p> : detailLoading ? <p role="status">Loading redemptions…</p> : <div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-sm"><thead className="bg-muted/30"><tr>{['User', 'Contact', 'Organization', 'Audience', 'Locked price', 'Locked at (IST)'].map(title => <th scope="col" key={title} className="px-3 py-3 font-medium">{title}</th>)}</tr></thead><tbody className="divide-y">{redemptions.map(row => <tr key={row.id} className="align-top">
          <td className="min-w-44 px-3 py-3"><p className="font-medium">{row.user?.name || 'User details unavailable'}</p><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{row.user_id}</p></td>
          <td className="min-w-48 px-3 py-3"><p className="break-all">{row.user?.email || 'Email unavailable'}</p><p className="mt-1 text-xs text-muted-foreground">{row.user?.phone || 'Phone unavailable'}</p></td>
          <td className="min-w-36 px-3 py-3">{row.user?.organizationName || (row.user?.organizationId ? 'Organization name unavailable' : '—')}</td>
          <td className="px-3 py-3">{roles[row.role as PromoRole] || row.role}</td><td className="whitespace-nowrap px-3 py-3">{row.accepted_amount_minor !== null && row.accepted_minor_unit !== null && row.accepted_currency ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: row.accepted_currency }).format(Number(row.accepted_amount_minor) / 10 ** row.accepted_minor_unit) : 'Legacy record — no saved price'}{row.accepted_interval_unit && <p className="mt-1 text-xs text-muted-foreground">/ {row.accepted_interval_count} {row.accepted_interval_unit} · Revision {row.accepted_revision_number}</p>}</td><td className="whitespace-nowrap px-3 py-3 text-xs">{date(row.accepted_at || row.redeemed_at)}</td></tr>)}</tbody></table>{redemptions.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No redemptions yet.</p>}<Pager page={redemptionPage} total={redemptionTotal} onChange={setRedemptionPage} /></div>}</>}
    </DialogContent></Dialog>
  </div>;
}

