import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Activity, Cpu, Gauge, RefreshCw, ShieldAlert, Users, Save, PauseCircle, PlayCircle, Plus, Send, FileText, Trash2, Pencil } from 'lucide-react'
import { PageHeading } from '@/components/PageShell'
import { Button } from '@/components/ui/Button'
import { Card, Chip } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { supabase } from '@/lib/supabase'

type UsageSummary = { user_id: string; request_count: number; input_tokens: number; output_tokens: number; total_tokens: number; failed_requests: number; last_activity: string }
type UsageRow = { id: string; user_id: string; model: string; input_tokens: number; output_tokens: number; status_code: number; duration_ms: number; created_at: string }
type UserLimit = { user_id: string; daily_request_limit: number; suspended: boolean; reason: string }
type AdminUser = { user_id: string; email: string | null; display_name: string; institution: string; faculty: string; department: string; level: string; account_created_at: string; last_sign_in_at: string | null; last_activity_at: string | null; ai_requests: number; total_tokens: number; published_materials: number; is_anonymous: boolean; has_academic_profile: boolean }
type AppUpdate = { id: string; title: string; category: string; summary: string; body: string; version_label: string; docs_path: string; status: 'draft' | 'published'; publish_mode: 'manual' | 'automatic'; published_at: string | null; created_at: string; updated_at: string }
type UpdateDraft = { title: string; category: string; version_label: string; summary: string; body: string; docs_path: string; automatic: boolean }
const EMPTY_DRAFT: UpdateDraft = { title: '', category: 'feature', version_label: '', summary: '', body: '', docs_path: '', automatic: false }
const CATEGORIES = ['feature', 'improvement', 'fix', 'documentation', 'security', 'announcement']

function dateLabel(value?: string | null) {
  if (!value) return 'Never'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

function TabButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${active ? 'bg-forest text-white' : 'bg-surface-2 text-muted hover:text-body'}`}>{children}</button>
}

export function AdminPage() {
  const [summary, setSummary] = useState<UsageSummary[]>([])
  const [recent, setRecent] = useState<UsageRow[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [updates, setUpdates] = useState<AppUpdate[]>([])
  const [limits, setLimits] = useState<Record<string, UserLimit>>({})
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [error, setError] = useState('')
  const [globalLimit, setGlobalLimit] = useState(6000)
  const [globalDraft, setGlobalDraft] = useState('6000')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [tab, setTab] = useState<'overview' | 'users' | 'updates' | 'ai'>('overview')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [updateDraft, setUpdateDraft] = useState<UpdateDraft>(EMPTY_DRAFT)
  const [editingId, setEditingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) { setAllowed(false); setLoading(false); return }
    setLoading(true)
    setError('')
    const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession()
    const user = sessionData.session?.user
    if (sessionError || !user) {
      setAllowed(false)
      setError(sessionError?.message || 'Your session could not be refreshed. Sign in again, then reopen Admin.')
      setLoading(false)
      return
    }
    const admin = user.app_metadata?.role === 'admin'
    setAllowed(admin)
    if (!admin) { setLoading(false); return }

    const [summaryResult, recentResult, limitsResult, globalResult, usersResult, updatesResult] = await Promise.all([
      supabase.rpc('admin_usage_summary'),
      supabase.from('ai_usage').select('id,user_id,model,input_tokens,output_tokens,status_code,duration_ms,created_at').order('created_at', { ascending: false }).limit(1000),
      supabase.from('ai_user_limits').select('user_id,daily_request_limit,suspended,reason'),
      supabase.from('ai_system_limits').select('global_daily_limit').eq('id', true).maybeSingle(),
      supabase.rpc('admin_user_directory'),
      supabase.from('app_updates').select('id,title,category,summary,body,version_label,docs_path,status,publish_mode,published_at,created_at,updated_at').order('updated_at', { ascending: false }).limit(200),
    ])
    const firstError = summaryResult.error || recentResult.error || limitsResult.error || globalResult.error || usersResult.error || updatesResult.error
    if (firstError) {
      setError(firstError.message || 'Some administration data could not be loaded.')
      setLoading(false)
      return
    }
    if (!globalResult.data) {
      setError('The global AI limits row is not visible. Check the admin role in Supabase App Metadata.')
      setLoading(false)
      return
    }
    setSummary((summaryResult.data ?? []) as UsageSummary[])
    setRecent((recentResult.data ?? []) as UsageRow[])
    setUsers((usersResult.data ?? []) as AdminUser[])
    setUpdates((updatesResult.data ?? []) as AppUpdate[])
    const byUser: Record<string, UserLimit> = {}
    for (const item of (limitsResult.data ?? []) as UserLimit[]) byUser[item.user_id] = item
    setLimits(byUser)
    setGlobalLimit(globalResult.data.global_daily_limit)
    setGlobalDraft(String(globalResult.data.global_daily_limit))
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const stats = useMemo(() => {
    const total = summary.reduce((n, r) => n + Number(r.total_tokens), 0)
    const input = summary.reduce((n, r) => n + Number(r.input_tokens), 0)
    const output = summary.reduce((n, r) => n + Number(r.output_tokens), 0)
    const requests = summary.reduce((n, r) => n + Number(r.request_count), 0)
    const failed = summary.reduce((n, r) => n + Number(r.failed_requests), 0)
    const models = new Map<string, number>()
    for (const row of recent) models.set(row.model, (models.get(row.model) ?? 0) + Number(row.input_tokens) + Number(row.output_tokens))
    return { total, input, output, requests, failed, aiUsers: summary.length, models: [...models.entries()].sort((a, b) => b[1] - a[1]) }
  }, [summary, recent])

  const saveGlobal = async () => {
    if (!supabase) return
    const value = Number(globalDraft)
    if (!Number.isInteger(value) || value < 100 || value > 100000) { toast('Global cap must be between 100 and 100,000 requests per rolling day.', 'error'); return }
    setBusy('global')
    const { error: saveError } = await supabase.from('ai_system_limits').update({ global_daily_limit: value, updated_at: new Date().toISOString() }).eq('id', true)
    if (saveError) toast(saveError.message, 'error')
    else { setGlobalLimit(value); toast('Global AI request cap updated.', 'success') }
    setBusy(null)
  }

  const saveUser = async (id: string, suspended?: boolean) => {
    if (!supabase) return
    const current = limits[id]
    const value = Number(drafts[id] ?? current?.daily_request_limit ?? 120)
    if (!Number.isInteger(value) || value < 0 || value > 1200) { toast('Per-user cap must be between 0 and 1,200 requests per rolling day.', 'error'); return }
    setBusy(id)
    const next = { user_id: id, daily_request_limit: value, suspended: suspended ?? current?.suspended ?? false, reason: current?.reason ?? '', updated_at: new Date().toISOString() }
    const { error: saveError } = await supabase.from('ai_user_limits').upsert(next, { onConflict: 'user_id' })
    if (saveError) toast(saveError.message, 'error')
    else {
      setLimits(old => ({ ...old, [id]: next }))
      setDrafts(old => ({ ...old, [id]: String(value) }))
      toast(next.suspended ? 'Hosted AI access paused for this account.' : 'Account AI allowance saved.', 'success')
    }
    setBusy(null)
  }

  const resetUpdateForm = () => { setUpdateDraft(EMPTY_DRAFT); setEditingId(null) }
  const editUpdate = (item: AppUpdate) => {
    setEditingId(item.id)
    setUpdateDraft({ title: item.title, category: item.category, version_label: item.version_label, summary: item.summary, body: item.body, docs_path: item.docs_path, automatic: item.publish_mode === 'automatic' })
    setTab('updates')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const saveUpdate = async () => {
    if (!supabase) return
    if (updateDraft.title.trim().length < 3) { toast('Give this update a clear name of at least 3 characters.', 'error'); return }
    if (updateDraft.summary.length > 280 || updateDraft.body.length > 12000) { toast('The summary or update details are too long.', 'error'); return }
    setBusy('update')
    const payload = {
      title: updateDraft.title.trim(),
      category: updateDraft.category,
      version_label: updateDraft.version_label.trim(),
      summary: updateDraft.summary.trim(),
      body: updateDraft.body.trim(),
      docs_path: updateDraft.docs_path.trim(),
      publish_mode: updateDraft.automatic ? 'automatic' : 'manual',
      status: updateDraft.automatic ? 'published' : 'draft',
      updated_at: new Date().toISOString(),
    }
    const result = editingId
      ? await supabase.from('app_updates').update(payload).eq('id', editingId)
      : await supabase.from('app_updates').insert({ ...payload, created_by: (await supabase.auth.getUser()).data.user?.id })
    if (result.error) toast(result.error.message, 'error')
    else { toast(updateDraft.automatic ? 'Update published and sent to the app.' : 'Update saved as a draft for approval.', 'success'); resetUpdateForm(); await load() }
    setBusy(null)
  }
  const setUpdateStatus = async (item: AppUpdate, publish: boolean) => {
    if (!supabase) return
    setBusy(item.id)
    const { error: updateError } = await supabase.from('app_updates').update({ status: publish ? 'published' : 'draft', publish_mode: 'manual', published_at: publish ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', item.id)
    if (updateError) toast(updateError.message, 'error')
    else { toast(publish ? 'Update published to the app.' : 'Update moved back to drafts.', 'success'); await load() }
    setBusy(null)
  }
  const deleteUpdate = async (item: AppUpdate) => {
    if (!supabase || !window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return
    setBusy(item.id)
    const { error: deleteError } = await supabase.from('app_updates').delete().eq('id', item.id)
    if (deleteError) toast(deleteError.message, 'error')
    else { toast('Update deleted.', 'success'); await load() }
    setBusy(null)
  }

  const visibleUpdates = updates.filter(item => categoryFilter === 'all' || item.category === categoryFilter)

  if (allowed === false) return <div className="mx-auto max-w-3xl"><PageHeading title="Administration" subtitle="Restricted operations dashboard." /><Card className="p-6"><ShieldAlert className="size-6 text-clay" /><h2 className="mt-3 font-semibold">Administrator access required</h2><p className="mt-1 text-sm text-muted">Only accounts with the server-managed app_metadata role set to admin can access this area.</p></Card></div>

  return <div className="mx-auto max-w-6xl space-y-4">
    <PageHeading title="Study Hub control room" subtitle="Accounts, releases, AI operations and platform announcements." actions={<Button size="sm" variant="secondary" onClick={() => void load()} icon={<RefreshCw className="size-4" />}>Refresh</Button>} />
    {error ? <Card className="border-clay/40 p-4 text-sm text-clay">{error}</Card> : null}
    <nav className="flex flex-wrap gap-2" aria-label="Admin sections">
      <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>Overview</TabButton>
      <TabButton active={tab === 'users'} onClick={() => setTab('users')}>Users · {users.length}</TabButton>
      <TabButton active={tab === 'updates'} onClick={() => setTab('updates')}>Updates · {updates.length}</TabButton>
      <TabButton active={tab === 'ai'} onClick={() => setTab('ai')}>AI operations</TabButton>
    </nav>

    {tab === 'overview' ? <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Registered accounts', value: users.length, sub: 'All non-deleted Supabase accounts', icon: Users },
          { label: 'Accounts using AI', value: stats.aiUsers, sub: 'Accounts with AI ledger entries', icon: Cpu },
          { label: 'AI requests', value: stats.requests, sub: 'Successful, failed and reserved calls', icon: Activity },
          { label: 'Tokens recorded', value: stats.total, sub: 'Provider-reported input + output', icon: Gauge },
        ].map(item => <Card key={item.label} className="p-4"><div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-muted">{item.label}</span><item.icon className="size-4 text-forest-400" /></div><p className="mt-3 text-3xl font-semibold tabular-nums">{loading ? '—' : Number(item.value).toLocaleString()}</p><p className="mt-1 text-xs text-muted">{item.sub}</p></Card>)}
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4"><h2 className="font-semibold">Account activity</h2><p className="mt-1 text-xs text-muted">The account directory includes sign-ins, profiles and community activity — not only AI usage.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">{[{label:'Academic profiles',value:users.filter(u => u.has_academic_profile).length},{label:'Published study sets',value:users.reduce((n,u) => n + Number(u.published_materials),0)},{label:'Accounts with sign-in',value:users.filter(u => u.last_sign_in_at).length},{label:'Documentation updates',value:updates.filter(u => u.category === 'documentation').length}].map(x=><div key={x.label} className="rounded-xl bg-surface-2 p-3"><p className="text-xs text-muted">{x.label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{loading?'—':x.value}</p></div>)}</div>
          <Button className="mt-4" size="sm" variant="secondary" onClick={() => setTab('users')}>Open user directory</Button>
        </Card>
        <Card className="p-4"><h2 className="font-semibold">Latest app updates</h2><p className="mt-1 text-xs text-muted">Published items appear as in-app update notifications.</p>
          {updates.slice(0,4).map(item=><div key={item.id} className="mt-3 border-t border-line pt-3"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{item.title}</strong><Chip tone={item.status === 'published' ? 'green' : 'gold'}>{item.status}</Chip><Chip>{item.category}</Chip></div><p className="mt-1 text-xs text-muted">{item.summary}</p></div>)}
          {updates.length === 0 ? <p className="mt-4 text-sm text-muted">No release notes yet. Create the first update in the Updates section.</p> : null}
          <Button className="mt-4" size="sm" variant="secondary" onClick={() => setTab('updates')}>Manage updates</Button>
        </Card>
      </div>
    </> : null}

    {tab === 'users' ? <Card className="overflow-hidden p-0">
      <div className="border-b border-line p-4"><h2 className="font-semibold">Registered user directory</h2><p className="mt-1 text-xs text-muted">Pulled from Supabase Auth and joined with academic profiles, AI activity and published Discover materials. This list includes users who have never used AI.</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-left text-sm"><thead className="bg-surface-2 text-xs text-muted"><tr><th className="p-3">Account</th><th className="p-3">Academic profile</th><th className="p-3">Signed in</th><th className="p-3">AI activity</th><th className="p-3">Daily cap</th><th className="p-3">AI access</th><th className="p-3">Save</th></tr></thead><tbody>
        {users.map(user => { const limit = limits[user.user_id]; const suspended = limit?.suspended ?? false; return <tr key={user.user_id} className="border-t border-line align-top"><td className="p-3"><strong>{user.display_name || 'Student'}</strong><p className="mt-1 text-xs text-muted">{user.email || 'No email'}</p><p className="mt-1 font-mono text-[10px] text-muted">{user.user_id.slice(0,14)}…</p><p className="mt-1 text-[11px] text-muted">Joined {dateLabel(user.account_created_at)}</p></td><td className="p-3"><p>{user.department || 'Profile not completed'}</p><p className="text-xs text-muted">{[user.institution,user.faculty,user.level].filter(Boolean).join(' · ')}</p><p className="mt-1 text-xs text-muted">{Number(user.published_materials)} public study sets</p></td><td className="p-3"><p>{dateLabel(user.last_sign_in_at)}</p><p className="mt-1 text-[11px] text-muted">Activity: {dateLabel(user.last_activity_at)}</p></td><td className="p-3 tabular-nums"><strong>{Number(user.ai_requests).toLocaleString()}</strong><p className="text-xs text-muted">{Number(user.total_tokens).toLocaleString()} tokens</p></td><td className="p-3"><input type="number" min="0" max="1200" value={drafts[user.user_id] ?? String(limit?.daily_request_limit ?? 120)} onChange={e => setDrafts(old => ({...old,[user.user_id]:e.target.value}))} className="h-9 w-24 rounded-lg border border-line bg-app px-2 tabular-nums" /></td><td className="p-3"><Button size="sm" variant="secondary" disabled={busy === user.user_id} onClick={() => void saveUser(user.user_id,!suspended)} icon={suspended ? <PlayCircle className="size-3.5" /> : <PauseCircle className="size-3.5" />}>{suspended ? 'Resume' : 'Pause'}</Button><div className="mt-1"><Chip tone={suspended ? 'clay' : 'green'}>{suspended ? 'Paused' : 'Active'}</Chip></div></td><td className="p-3"><Button size="sm" disabled={busy === user.user_id} onClick={() => void saveUser(user.user_id)} icon={<Save className="size-3.5" />}>Save</Button></td></tr>})}
      </tbody></table>{users.length === 0 && !loading ? <p className="p-5 text-sm text-muted">No registered accounts found.</p> : null}</div>
    </Card> : null}

    {tab === 'updates' ? <>
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">{editingId ? 'Edit app update' : 'Create an app update'}</h2><p className="mt-1 text-xs text-muted">Name each release clearly. Documentation updates can be filtered and linked to their source page.</p></div>{editingId ? <Button size="sm" variant="ghost" onClick={resetUpdateForm}>Cancel edit</Button> : null}</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-muted sm:col-span-2">Update name<input value={updateDraft.title} onChange={e => setUpdateDraft(v => ({...v,title:e.target.value}))} maxLength={140} placeholder="e.g. Long-document processing improvements" className="mt-1 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm text-body" /></label>
          <label className="text-xs font-semibold text-muted">Category<select value={updateDraft.category} onChange={e => setUpdateDraft(v => ({...v,category:e.target.value}))} className="mt-1 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm text-body">{CATEGORIES.map(c=><option key={c} value={c}>{c[0].toUpperCase()+c.slice(1)}</option>)}</select></label>
          <label className="text-xs font-semibold text-muted">Version / release label<input value={updateDraft.version_label} onChange={e => setUpdateDraft(v => ({...v,version_label:e.target.value}))} maxLength={60} placeholder="e.g. 1.4.2" className="mt-1 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm text-body" /></label>
          <label className="text-xs font-semibold text-muted sm:col-span-2">Short notification summary<textarea value={updateDraft.summary} onChange={e => setUpdateDraft(v => ({...v,summary:e.target.value}))} maxLength={280} rows={2} placeholder="A concise description shown in the notification banner." className="mt-1 w-full rounded-xl border border-line bg-app p-3 text-sm text-body" /></label>
          <label className="text-xs font-semibold text-muted sm:col-span-2">Full update details<textarea value={updateDraft.body} onChange={e => setUpdateDraft(v => ({...v,body:e.target.value}))} maxLength={12000} rows={5} placeholder="What changed, who it affects, and anything users need to do." className="mt-1 w-full rounded-xl border border-line bg-app p-3 text-sm text-body" /></label>
          <label className="text-xs font-semibold text-muted sm:col-span-2">Documentation link / route<input value={updateDraft.docs_path} onChange={e => setUpdateDraft(v => ({...v,docs_path:e.target.value}))} maxLength={500} placeholder="https://… or /help/…" className="mt-1 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm text-body" /></label>
        </div>
        <label className="mt-4 flex items-start gap-3 rounded-xl border border-line p-3"><input type="checkbox" checked={updateDraft.automatic} onChange={e => setUpdateDraft(v => ({...v,automatic:e.target.checked}))} className="mt-1 size-4" /><span><strong className="text-sm">Publish automatically</strong><span className="mt-1 block text-xs text-muted">When enabled, saving sends this update to the app immediately. Leave off to save a draft for manual approval.</span></span></label>
        <div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => void saveUpdate()} disabled={busy === 'update'} icon={editingId ? <Save className="size-4" /> : <Plus className="size-4" />}>{busy === 'update' ? 'Saving…' : editingId ? 'Save changes' : 'Save update'}</Button><Button size="sm" variant="secondary" onClick={resetUpdateForm}>Clear</Button></div>
      </Card>
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4"><div><h2 className="font-semibold">Release queue</h2><p className="mt-1 text-xs text-muted">Publish manually, or allow automatic publishing for trusted update entries.</p></div><label className="text-xs text-muted">Filter<select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="ml-2 h-9 rounded-lg border border-line bg-app px-2 text-sm text-body"><option value="all">All categories</option>{CATEGORIES.map(c=><option key={c} value={c}>{c[0].toUpperCase()+c.slice(1)}</option>)}</select></label></div>
        <div className="divide-y divide-line">{visibleUpdates.map(item=><div key={item.id} className="p-4"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.title}</h3><Chip tone={item.status === 'published' ? 'green' : 'gold'}>{item.status}</Chip><Chip>{item.category}</Chip>{item.version_label ? <Chip>{item.version_label}</Chip> : null}<span className="text-[11px] text-muted">{item.publish_mode === 'automatic' ? 'Automatic' : 'Manual approval'}</span></div><p className="mt-2 text-sm text-muted">{item.summary}</p>{item.body ? <p className="mt-2 whitespace-pre-wrap text-sm">{item.body}</p> : null}{item.docs_path ? <a className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-forest-400 underline" href={item.docs_path} target="_blank" rel="noreferrer"><FileText className="size-3.5" />Open documentation</a> : null}<p className="mt-2 text-[11px] text-muted">Updated {dateLabel(item.updated_at)}{item.published_at ? ` · Published ${dateLabel(item.published_at)}` : ''}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => editUpdate(item)} icon={<Pencil className="size-3.5" />}>Edit</Button>{item.status === 'published' ? <Button size="sm" variant="secondary" disabled={busy === item.id} onClick={() => void setUpdateStatus(item,false)}>Move to draft</Button> : <Button size="sm" disabled={busy === item.id} onClick={() => void setUpdateStatus(item,true)} icon={<Send className="size-3.5" />}>Publish</Button>}<Button size="sm" variant="ghost" disabled={busy === item.id} onClick={() => void deleteUpdate(item)} icon={<Trash2 className="size-3.5" />}>Delete</Button></div></div>)}
          {visibleUpdates.length === 0 ? <p className="p-5 text-sm text-muted">No updates match this filter.</p> : null}
        </div>
      </Card>
    </> : null}

    {tab === 'ai' ? <>
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2 p-4"><h2 className="font-semibold">Pool protection</h2><p className="mt-1 text-xs text-muted">Requests accepted during any rolling 24-hour window.</p><label className="mt-4 block text-xs font-semibold text-muted">Global daily request cap</label><div className="mt-1 flex gap-2"><input type="number" min="100" max="100000" value={globalDraft} onChange={e => setGlobalDraft(e.target.value)} className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-app px-3 text-sm" /><Button size="sm" onClick={() => void saveGlobal()} disabled={busy === 'global'} icon={<Save className="size-3.5" />}>Save</Button></div><p className="mt-2 text-xs text-muted">Current cap: {globalLimit.toLocaleString()} requests / rolling 24 hours.</p><div className="mt-5 border-t border-line pt-4"><h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Token mix</h3>{[{label:'Input',value:stats.input},{label:'Output',value:stats.output}].map(x=><div key={x.label} className="mt-3"><div className="flex justify-between text-sm"><span>{x.label}</span><strong>{x.value.toLocaleString()}</strong></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-forest-400" style={{width:(stats.total?x.value/stats.total*100:0)+'%'}} /></div></div>)}</div><div className="mt-5 border-t border-line pt-4"><h3 className="text-xs font-semibold uppercase tracking-wide text-muted">By model · latest 1,000 calls</h3>{stats.models.map(([model,tokens])=><div key={model} className="mt-2 flex justify-between gap-3 text-sm"><span>{model}</span><strong>{tokens.toLocaleString()}</strong></div>)}</div></Card>
        <Card className="lg:col-span-3 overflow-hidden p-0"><div className="border-b border-line p-4"><h2 className="font-semibold">AI usage ledger</h2><p className="mt-1 text-xs text-muted">AI usage is separate from registered-user counts.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-surface-2 text-xs text-muted"><tr><th className="p-3">User ID</th><th className="p-3">Requests</th><th className="p-3">Tokens</th><th className="p-3">Failures</th><th className="p-3">Last activity</th></tr></thead><tbody>{summary.map(row=><tr key={row.user_id} className="border-t border-line"><td className="p-3 font-mono text-[11px]">{row.user_id}</td><td className="p-3 tabular-nums">{Number(row.request_count).toLocaleString()}</td><td className="p-3 tabular-nums">{Number(row.total_tokens).toLocaleString()}</td><td className="p-3 tabular-nums">{Number(row.failed_requests).toLocaleString()}</td><td className="p-3 text-xs">{dateLabel(row.last_activity)}</td></tr>)}</tbody></table>{summary.length===0?<p className="p-5 text-sm text-muted">No AI usage yet.</p>:null}</div></Card>
      </div>
      <p className="text-xs text-muted">Per-account default: 120 requests per rolling 24 hours. Token totals are provider-reported; this dashboard does not invent a monetary cost.</p>
    </> : null}
  </div>
}
