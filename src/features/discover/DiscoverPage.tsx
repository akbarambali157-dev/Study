import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, Bookmark, ClipboardCheck, Download, Eye, EyeOff, Search, Sparkles, Trash2, Zap } from 'lucide-react'
import { PageHeading } from '@/components/PageShell'
import { Button } from '@/components/ui/Button'
import { Card, Chip, EmptyState, GridSkeleton } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { getPublicMaterialDownloadUrl, importPublicMaterial, launchPublicMaterialRush, publicMaterialCards } from '@/lib/publicMaterials'
import { getAuthenticatedUser, supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'

type Material = {
  id: string; owner_id: string; author_name: string; title: string; discipline: string
  page_count: number; tags: string[]; summary: string; content: Record<string, unknown>
  is_public: boolean; share_original: boolean; source_document_id: string | null; created_at: string; saves_count: number; rush_count: number
}
type MaterialContent = {
  takeaways?: string[]
  keyPoints?: { heading: string; body: string }[]
  flashcards?: { front: string; back: string }[]
  questions?: { stem: string; options: string[]; answerIndex: number; explanation: string; page?: number }[]
}
type ProgressRow = { material_id: string; rush_count: number; best_score: number; best_accuracy: number }

export function DiscoverPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Material[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [progress, setProgress] = useState<Record<string, ProgressRow>>({})
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    const [user, materials] = await Promise.all([
      getAuthenticatedUser().catch(() => null),
      supabase.from('public_materials').select('*').order('created_at', { ascending: false }).limit(100),
    ])
    const { data, error } = materials
    if (error) { toast(error.message, 'error'); setLoading(false); return }
    const uid = user?.id ?? null
    setUserId(uid)
    setRows((data ?? []) as Material[])
    if (uid) {
      const [saved, stats] = await Promise.all([
        supabase.from('saved_public_materials').select('material_id').eq('user_id', uid),
        supabase.from('public_material_progress').select('material_id,rush_count,best_score,best_accuracy').eq('user_id', uid),
      ])
      if (saved.error) toast(saved.error.message, 'error')
      if (stats.error) toast(stats.error.message, 'error')
      setSavedIds((saved.data ?? []).map((item) => item.material_id))
      setProgress(Object.fromEntries(((stats.data ?? []) as ProgressRow[]).map((item) => [item.material_id, item])))
    } else {
      setSavedIds([])
      setProgress({})
    }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((row) => !q || [row.title, row.author_name, row.discipline, ...(row.tags ?? [])].join(' ').toLowerCase().includes(q))
  }, [rows, query])

  const visibility = async (row: Material) => {
    if (!supabase || !userId) return
    const next = !row.is_public
    const { error } = await supabase.from('public_materials').update({ is_public: next, updated_at: new Date().toISOString() }).eq('id', row.id).eq('owner_id', userId)
    if (error) { toast(error.message, 'error'); return }
    setRows((old) => old.map((item) => item.id === row.id ? { ...item, is_public: next } : item))
    toast(next ? 'Material published.' : 'Material made private.', 'success')
  }

  const remove = async (row: Material) => {
    if (!supabase || !window.confirm('Delete this published study material? This cannot be undone.')) return
    const { error } = await supabase.from('public_materials').delete().eq('id', row.id).eq('owner_id', userId)
    if (error) { toast(error.message, 'error'); return }
    setRows((old) => old.filter((item) => item.id !== row.id))
    toast('Material deleted.', 'success')
  }

  const toggleSaved = async (row: Material) => {
    if (!supabase || !userId) { toast('Sign in to save materials to your library.', 'info'); return }
    setBusy(row.id)
    const isSaved = savedIds.includes(row.id)
    const previous = savedIds
    // Update the save control immediately; restore the previous list on failure.
    setSavedIds((old) => isSaved ? old.filter((id) => id !== row.id) : [...old, row.id])
    const result = isSaved
      ? await supabase.from('saved_public_materials').delete().eq('user_id', userId).eq('material_id', row.id)
      : await supabase.from('saved_public_materials').insert({ user_id: userId, material_id: row.id })
    if (result.error) {
      setSavedIds(previous)
      toast(result.error.message || 'Save could not be synced. Your previous state has been restored.', 'error')
    } else toast(isSaved ? 'Removed from your library.' : 'Saved to your library.', 'success')
    setBusy(null)
  }

  const addToLibrary = async (row: Material) => {
    setBusy(row.id)
    try {
      const documentId = await importPublicMaterial(row)
      toast('Study set added to your Library. Its available notes, flashcards and quiz questions are ready to use offline.', 'success')
      navigate(`/doc/${documentId}`)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'This study set could not be added to your Library.', 'error')
    } finally { setBusy(null) }
  }

  const downloadOriginal = async (row: Material) => {
    setBusy(row.id)
    try {
      const url = await getPublicMaterialDownloadUrl(row.id)
      window.location.assign(url)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'The original PDF could not be downloaded.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const takeQuiz = async (row: Material) => {
    const content = row.content as MaterialContent
    if (!(content.questions ?? []).length) { toast('This contribution has no shared quiz questions yet.', 'info'); return }
    setBusy(row.id)
    try {
      await importPublicMaterial(row)
      navigate(`/deck/community-deck-${row.id}/test`)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'The quiz could not be opened.', 'error')
    } finally { setBusy(null) }
  }

  const playRush = async (row: Material) => {
    setBusy(row.id)
    try {
      await launchPublicMaterialRush(row, navigate)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Rush could not start.', 'info')
    } finally { setBusy(null) }
  }

  if (!supabase) return <div className="hub-discover-page mx-auto max-w-4xl"><PageHeading title="Discover" subtitle="Explore shared study materials from the OOU community." /><Card className="p-5">The shared library is not connected on this device.</Card></div>

  return (
    <div className="hub-discover-page mx-auto max-w-5xl">
      <PageHeading title="Discover" subtitle="A growing library of student-shared notes, original PDFs, flashcards and quizzes." />
      {!userId ? <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-forest-400/20 bg-forest-400/5 p-3"><div><p className="text-sm font-semibold">You can browse without an account</p><p className="text-xs text-muted">Sign in only when you want to save materials, publish your own work or connect with students.</p></div><Button size="sm" variant="secondary" onClick={() => navigate('/auth')}>Sign in</Button></div> : null}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3">
        <div><p className="text-sm font-semibold">Find your academic community</p><p className="text-xs text-muted">Meet students with shared research interests and collaboration goals.</p></div>
        <Button size="sm" variant="secondary" onClick={() => navigate('/students')}>Discover students</Button>
      </div>
      <section className="hub-discover-hero mb-5 overflow-hidden rounded-3xl p-5 text-white shadow-lg sm:p-7">
        <div className="flex items-start gap-3"><span className="grid size-11 place-items-center rounded-2xl border border-white/20 bg-white/10"><Sparkles className="size-5" /></span><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-100">The OOU knowledge commons</p><h2 className="mt-1 text-2xl font-semibold">Learn from the work around you.</h2><p className="mt-1 max-w-2xl text-sm text-white/75">Explore materials students have chosen to share. Some contributions include the original PDF for download; private uploads and page indexes stay protected.</p></div></div>
        <div className="mt-5 grid grid-cols-3 gap-2"><div className="rounded-2xl bg-white/10 p-3"><p className="text-2xl font-semibold">{rows.filter((row) => row.is_public).length}</p><p className="text-[11px] text-white/70">Public sets</p></div><div className="rounded-2xl bg-white/10 p-3"><p className="text-2xl font-semibold">{rows.filter((row) => row.owner_id === userId).length}</p><p className="text-[11px] text-white/70">Your sets</p></div><div className="rounded-2xl bg-white/10 p-3"><p className="text-2xl font-semibold">{rows.filter((row) => row.is_public).reduce((n, row) => n + Number((row.content as MaterialContent).flashcards?.length ?? 0), 0)}</p><p className="text-[11px] text-white/70">Shared cards</p></div></div>
      </section>
      <div className="hub-discover-search relative mb-4"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search subjects, titles, tags or students…" className="h-12 w-full rounded-2xl border border-line bg-surface pl-10 pr-4 text-sm outline-none focus:border-forest-400" /></div>
      {loading ? <GridSkeleton count={4} /> : filtered.length === 0 ? <EmptyState icon={<BookOpen className="size-6" />} title="No materials found" body="Try another search, or publish a study set from Add material." /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((row) => {
            const content = row.content as MaterialContent
            const mine = row.owner_id === userId
            const open = expanded === row.id
            const saved = savedIds.includes(row.id)
            const cards = publicMaterialCards(row)
            const stats = progress[row.id]
            return <Card key={row.id} className="hub-discover-card overflow-hidden p-0">
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Chip tone="green">{row.discipline || 'General'}</Chip><Chip>{row.page_count} pages</Chip>{mine ? <Chip tone={row.is_public ? 'green' : 'clay'}>{row.is_public ? 'Public' : 'Private'}</Chip> : null}</div><h3 className="mt-3 font-display text-lg font-semibold">{row.title}</h3><p className="mt-1 text-xs text-muted">Shared by {row.author_name} · {new Date(row.created_at).toLocaleDateString()}</p></div><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-forest-400/10 text-forest-400"><BookOpen className="size-5" /></span></div>
                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted">{row.summary || 'A student-created study set.'}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">{(row.tags ?? []).slice(0, 5).map((tag) => <Chip key={tag}>{tag}</Chip>)}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted"><span>{row.saves_count ?? 0} saves</span><span>{row.rush_count ?? 0} community Rush plays</span>{stats ? <><span>Your rounds: {stats.rush_count}</span><span>Your best: {stats.best_score} pts</span><span>Your accuracy: {Math.round(Number(stats.best_accuracy))}%</span></> : null}</div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => void addToLibrary(row)} disabled={busy === row.id}><BookOpen className="size-3.5" />{busy === row.id ? 'Adding…' : 'Add to Library'}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setExpanded(open ? null : row.id)}>{open ? 'Close preview' : 'Preview'}</Button>
                  <Button size="sm" variant="secondary" disabled={cards.length < 4 || busy === row.id} onClick={() => void playRush(row)}><Zap className="size-3.5" />Play Rush</Button>
                  {(content.questions ?? []).length > 0 ? <Button size="sm" variant="secondary" disabled={busy === row.id} onClick={() => void takeQuiz(row)}><ClipboardCheck className="size-3.5" />Take quiz</Button> : null}
                  {row.share_original ? <Button size="sm" variant="secondary" disabled={busy === row.id} onClick={() => void downloadOriginal(row)}><Download className="size-3.5" />Download original PDF</Button> : null}
                  <Button size="sm" variant="secondary" disabled={busy === row.id} onClick={() => void toggleSaved(row)}><Bookmark className="size-3.5" />{saved ? 'Saved for later' : 'Save for later'}</Button>
                  {mine ? <><Button size="sm" variant="secondary" onClick={() => void visibility(row)}>{row.is_public ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}{row.is_public ? 'Make private' : 'Publish'}</Button><Button size="sm" variant="ghost" onClick={() => void remove(row)}><Trash2 className="size-3.5" /></Button></> : null}
                </div>
                {cards.length < 4 ? <p className="mt-2 text-[11px] text-muted">Rush unlocks when this set has at least four usable flashcards.</p> : null}
              </div>
              {open ? <div className="space-y-3 border-t border-line bg-surface-2/50 p-4">
                {(content.takeaways ?? []).length > 0 ? <div><h4 className="text-xs font-bold uppercase tracking-wide text-muted">Key takeaways</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{content.takeaways?.slice(0, 8).map((value, index) => <li key={index}>{value}</li>)}</ul></div> : null}
                {(content.keyPoints ?? []).slice(0, 8).map((point, index) => <div key={index} className="rounded-xl border border-line bg-surface p-3"><p className="text-sm font-semibold">{point.heading}</p><p className="mt-1 text-sm leading-relaxed text-muted">{point.body}</p></div>)}
                {(content.flashcards ?? []).slice(0, 5).map((card, index) => <div key={index} className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface p-3 text-sm"><div><p className="text-[10px] font-bold uppercase text-muted">Front</p><p className="mt-1">{card.front}</p></div><div><p className="text-[10px] font-bold uppercase text-muted">Back</p><p className="mt-1 text-muted">{card.back}</p></div></div>)}
                <p className="text-[11px] text-muted">Only the learning content selected by the contributor is shared. {row.share_original ? 'The contributor has also approved a time-limited original PDF download.' : 'The original PDF remains private.'}</p>
              </div> : null}
            </Card>
          })}
        </div>
      )}
    </div>
  )
}
