import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, Plus, Users } from 'lucide-react'
import { PageHeading } from '@/components/PageShell'
import { Button } from '@/components/ui/Button'
import { Card, Chip } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { supabase } from '@/lib/supabase'

type Group = {
  id: string; group_type: 'course' | 'research_circle'; title: string; description: string
  institution: string; faculty: string; department: string; course_code: string | null
  level: string | null; semester: string | null; academic_session: string | null
  visibility: 'public' | 'private'; created_by: string; updated_at: string
}
type Membership = { group_id: string; member_role: 'owner' | 'moderator' | 'member'; status: 'active' | 'pending' }
type GroupPost = { id: string; group_id: string; author_id: string; title: string; body: string; created_at: string }

const emptyForm = { group_type: 'research_circle' as 'course' | 'research_circle', title: '', description: '', institution: 'Olabisi Onabanjo University', faculty: '', department: '', course_code: '', level: '', semester: '', academic_session: '', visibility: 'public' as 'public' | 'private' }

export function GroupsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [groups, setGroups] = useState<Group[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [posts, setPosts] = useState<GroupPost[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [postTitle, setPostTitle] = useState('')
  const [postBody, setPostBody] = useState('')
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); setError('Group spaces need an account connection.'); return }
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (authError || !auth.user) { setUserId(null); setGroups([]); setLoading(false); return }
      setUserId(auth.user.id)
      const [{ data: groupRows, error: groupError }, { data: memberRows, error: memberError }] = await Promise.all([
        supabase.from('academic_groups').select('*').order('updated_at', { ascending: false }).limit(100),
        supabase.from('academic_group_members').select('group_id,member_role,status').eq('user_id', auth.user.id),
      ])
      if (groupError) throw groupError
      if (memberError) throw memberError
      setGroups((groupRows ?? []) as Group[])
      setMemberships((memberRows ?? []) as Membership[])
    } catch (err) { setError(err instanceof Error ? err.message : 'Group spaces could not be loaded.') }
    finally { setLoading(false) }
  }, [])

  const loadPosts = useCallback(async (groupId: string) => {
    if (!supabase) return
    const { data, error: postError } = await supabase.from('academic_group_posts')
      .select('id,group_id,author_id,title,body,created_at').eq('group_id', groupId)
      .order('created_at', { ascending: false }).limit(50)
    if (postError) toast(postError.message, 'error')
    else setPosts((data ?? []) as GroupPost[])
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => { if (id) void loadPosts(id); else setPosts([]) }, [id, loadPosts])

  const selected = groups.find((group) => group.id === id)
  const membership = memberships.find((item) => item.group_id === id)
  const isMember = membership?.status === 'active'
  const filtered = groups.filter((group) => [group.title, group.description, group.institution, group.department, group.course_code ?? '', group.group_type].join(' ').toLowerCase().includes(query.trim().toLowerCase()))

  const createGroup = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || !userId || busy) return
    if (form.group_type === 'course' && !form.course_code.trim()) { toast('Enter the course code for a course hub.', 'error'); return }
    setBusy(true)
    try {
      const { data, error: createError } = await supabase.from('academic_groups').insert({
        ...form, title: form.title.trim(), description: form.description.trim(),
        institution: form.institution.trim(), faculty: form.faculty.trim(), department: form.department.trim(),
        course_code: form.group_type === 'course' ? form.course_code.trim().toUpperCase() : null,
        level: form.level.trim() || null, semester: form.semester.trim() || null,
        academic_session: form.academic_session.trim() || null, created_by: userId,
      }).select('id').single()
      if (createError) throw createError
      toast('Your space has been created.', 'success')
      setForm(emptyForm); setCreateOpen(false)
      await load()
      if (data?.id) navigate(`/groups/${data.id}`)
    } catch (err) { toast(err instanceof Error ? err.message : 'The group could not be created.', 'error') }
    finally { setBusy(false) }
  }

  const join = async (group: Group) => {
    if (!supabase || !userId || busy) return
    setBusy(true)
    const { error: joinError } = await supabase.from('academic_group_members').insert({ group_id: group.id, user_id: userId, member_role: 'member', status: 'active' })
    if (joinError && joinError.code !== '23505') toast(joinError.message, 'error')
    else { toast('You joined the space.', 'success'); await load() }
    setBusy(false)
  }

  const leave = async () => {
    if (!supabase || !id || !userId || !window.confirm('Leave this space? You can rejoin public spaces later.')) return
    const { error: leaveError } = await supabase.from('academic_group_members').delete().eq('group_id', id).eq('user_id', userId)
    if (leaveError) toast(leaveError.message, 'error')
    else { toast('You left the space.', 'success'); await load(); navigate('/groups') }
  }

  const submitPost = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || !id || !userId || !isMember || busy) return
    setBusy(true)
    try {
      const { error: postError } = await supabase.from('academic_group_posts').insert({ group_id: id, author_id: userId, title: postTitle.trim(), body: postBody.trim() })
      if (postError) throw postError
      setPostTitle(''); setPostBody('')
      await loadPosts(id)
    } catch (err) { toast(err instanceof Error ? err.message : 'Your discussion could not be posted.', 'error') }
    finally { setBusy(false) }
  }

  if (!supabase) return <div className="mx-auto max-w-5xl"><PageHeading title="Course hubs & research circles" /><Card className="p-5">Group spaces need an account connection.</Card></div>
  if (!userId && !loading) return <div className="mx-auto max-w-5xl"><PageHeading title="Course hubs & research circles" /><Card className="p-5"><p className="text-sm text-muted">Sign in to discover or create academic spaces.</p><Button className="mt-3" onClick={() => navigate('/auth')}>Sign in</Button></Card></div>

  if (id) return <div className="mx-auto max-w-4xl"><Button size="sm" variant="secondary" onClick={() => navigate('/groups')} icon={<ArrowLeft className="size-4" />}>All spaces</Button>{!selected && loading ? <Card className="mt-4 p-5">Loading space…</Card> : !selected ? <Card className="mt-4 p-5 text-sm text-muted">This space is unavailable or private.</Card> : <><div className="mt-4 flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><Chip>{selected.group_type === 'course' ? 'Course hub' : 'Research circle'}</Chip><Chip tone={selected.visibility === 'public' ? 'green' : 'gold'}>{selected.visibility}</Chip></div><h1 className="mt-2 text-2xl font-semibold">{selected.title}</h1><p className="mt-1 text-sm text-muted">{[selected.course_code, selected.department, selected.level ? `Level ${selected.level}` : '', selected.academic_session].filter(Boolean).join(' · ')}</p><p className="mt-3 max-w-2xl text-sm leading-relaxed">{selected.description}</p></div>{isMember && membership?.member_role !== 'owner' ? <Button size="sm" variant="secondary" onClick={() => void leave()}>Leave space</Button> : null}</div><div className="mt-5 space-y-3">{isMember ? <Card><h2 className="font-semibold">Start a discussion</h2><form onSubmit={submitPost} className="mt-3 space-y-2"><input value={postTitle} onChange={(e) => setPostTitle(e.target.value)} required minLength={4} maxLength={140} placeholder="Discussion title" className="h-10 w-full rounded-xl border border-line bg-app px-3 text-sm" /><textarea value={postBody} onChange={(e) => setPostBody(e.target.value)} required minLength={10} maxLength={6000} rows={3} placeholder="Ask a question, share a resource or discuss a course topic…" className="w-full rounded-xl border border-line bg-app px-3 py-2 text-sm" /><div className="flex justify-end"><Button size="sm" disabled={busy}>Post discussion</Button></div></form></Card> : selected.visibility === 'public' ? <Card className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">Join this space</p><p className="text-xs text-muted">Members can publish discussions and collaborate.</p></div><Button size="sm" disabled={busy} onClick={() => void join(selected)}>Join space</Button></Card> : null}{posts.length ? posts.map((post) => <Card key={post.id}><p className="text-xs text-muted">{new Date(post.created_at).toLocaleString()}</p><h3 className="mt-1 font-semibold">{post.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{post.body}</p></Card>) : <Card className="p-6 text-center text-sm text-muted">No discussions yet.</Card>}</div></>}</div>

  return <div className="mx-auto max-w-5xl"><div className="flex flex-wrap items-end justify-between gap-3"><PageHeading title="Course hubs & research circles" subtitle="Join a course space or create a focused research circle with other students." /><Button onClick={() => setCreateOpen((open) => !open)} icon={<Plus className="size-4" />}>{createOpen ? 'Close' : 'Create a space'}</Button></div><div className="mb-4 flex items-center gap-2 rounded-xl border border-line bg-surface px-3"><BookOpen className="size-4 text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search courses, departments and research circles" className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" /></div>{createOpen ? <Card className="mb-4 p-4"><h2 className="font-semibold">Create a space</h2><form onSubmit={createGroup} className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-muted">Space type<select value={form.group_type} onChange={(e) => setForm((current) => ({ ...current, group_type: e.target.value as typeof current.group_type }))} className="mt-1.5 h-10 w-full rounded-xl border border-line bg-app px-3 text-sm"><option value="research_circle">Research circle</option><option value="course">Course hub</option></select></label><label className="text-xs font-semibold text-muted">Visibility<select value={form.visibility} onChange={(e) => setForm((current) => ({ ...current, visibility: e.target.value as typeof current.visibility }))} className="mt-1.5 h-10 w-full rounded-xl border border-line bg-app px-3 text-sm"><option value="public">Public</option><option value="private">Private</option></select></label><label className="text-xs font-semibold text-muted sm:col-span-2">Name<input value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} required minLength={4} maxLength={100} className="mt-1.5 h-10 w-full rounded-xl border border-line bg-app px-3 text-sm" placeholder="e.g. ECO 101 — Introductory Economics" /></label><label className="text-xs font-semibold text-muted sm:col-span-2">Description<textarea value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} maxLength={4000} rows={3} className="mt-1.5 w-full rounded-xl border border-line bg-app px-3 py-2 text-sm" placeholder="What will members learn or work on?" /></label><label className="text-xs font-semibold text-muted">Institution<input value={form.institution} onChange={(e) => setForm((current) => ({ ...current, institution: e.target.value }))} maxLength={160} className="mt-1.5 h-10 w-full rounded-xl border border-line bg-app px-3 text-sm" /></label><label className="text-xs font-semibold text-muted">Department<input value={form.department} onChange={(e) => setForm((current) => ({ ...current, department: e.target.value }))} maxLength={120} className="mt-1.5 h-10 w-full rounded-xl border border-line bg-app px-3 text-sm" /></label>{form.group_type === 'course' ? <><label className="text-xs font-semibold text-muted">Course code<input value={form.course_code} onChange={(e) => setForm((current) => ({ ...current, course_code: e.target.value }))} maxLength={30} required className="mt-1.5 h-10 w-full rounded-xl border border-line bg-app px-3 text-sm" /></label><label className="text-xs font-semibold text-muted">Level<input value={form.level} onChange={(e) => setForm((current) => ({ ...current, level: e.target.value }))} maxLength={20} className="mt-1.5 h-10 w-full rounded-xl border border-line bg-app px-3 text-sm" /></label><label className="text-xs font-semibold text-muted">Semester<input value={form.semester} onChange={(e) => setForm((current) => ({ ...current, semester: e.target.value }))} maxLength={30} className="mt-1.5 h-10 w-full rounded-xl border border-line bg-app px-3 text-sm" /></label><label className="text-xs font-semibold text-muted">Academic session<input value={form.academic_session} onChange={(e) => setForm((current) => ({ ...current, academic_session: e.target.value }))} maxLength={30} className="mt-1.5 h-10 w-full rounded-xl border border-line bg-app px-3 text-sm" /></label></> : null}<div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create space'}</Button></div></form></Card> : null}{error ? <Card className="mb-3 p-4 text-sm text-rose-600">{error}</Card> : null}{loading ? <Card className="p-5 text-sm text-muted">Loading spaces…</Card> : filtered.length ? <div className="grid gap-3 md:grid-cols-2">{filtered.map((group) => { const member = memberships.find((item) => item.group_id === group.id); return <Card key={group.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><Chip>{group.group_type === 'course' ? 'Course hub' : 'Research circle'}</Chip><h2 className="mt-2 font-semibold">{group.title}</h2><p className="mt-1 text-xs text-muted">{[group.course_code, group.department, group.institution].filter(Boolean).join(' · ')}</p></div><Chip tone={group.visibility === 'public' ? 'green' : 'gold'}>{group.visibility}</Chip></div><p className="mt-3 line-clamp-3 text-sm text-muted">{group.description}</p><div className="mt-4 flex items-center justify-between gap-2"><span className="text-[11px] text-muted">{member?.member_role === 'owner' ? 'Created by you' : member ? 'Member' : 'Open to join'}</span><Button size="sm" variant="secondary" onClick={() => navigate(`/groups/${group.id}`)}>Open space</Button></div></Card>})}</div> : <Card className="p-8 text-center"><Users className="mx-auto size-8 text-muted" /><h2 className="mt-3 font-semibold">No spaces found</h2><p className="mt-1 text-sm text-muted">Create the first course hub or research circle.</p></Card>}</div>
}
