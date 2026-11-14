import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Bookmark,
  Layers,
  Search,
  RefreshCw,
  Target,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react'
import { useLibrary } from '@/lib/hooks'
import { deleteDocument } from '@/lib/store'
import { record } from '@/lib/inquiries'
import { PageHeading } from '@/components/PageShell'
import { Button } from '@/components/ui/Button'
import { Card, Chip, EmptyState } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { formatRelative } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { launchPublicMaterialRush } from '@/lib/publicMaterials'

export function LibraryPage() {
  const library = useLibrary()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(20)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ? true : false
      if (event.key === '/' && !typing) {
        event.preventDefault()
        searchRef.current?.focus()
      }
      if (event.key === 'n' && !typing) {
        event.preventDefault()
        navigate('/upload')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return library
    return library.filter(({ doc }) =>
      `${doc.title} ${doc.fileName}`.toLowerCase().includes(needle),
    )
  }, [library, query])
  const visible = filtered.slice(0, visibleCount)

  useEffect(() => { setVisibleCount(20) }, [query])

  useEffect(() => {
    const needle = query.trim()
    if (needle.length < 3) return
    const timer = setTimeout(() => {
      void record({ kind: 'search', query: needle, topic: needle })
    }, 1200)
    return () => clearTimeout(timer)
  }, [query])

  const remove = async (id: string, title: string) => {
    if (!window.confirm(`Delete “${title}”? Its notes, cards and test go too.`)) return
    await deleteDocument(id)
    toast('Deleted.', 'success')
  }

  const syncDocument = async (id: string) => {
    if (!navigator.onLine) { toast('Connect to the internet before syncing this private PDF.', 'info'); return }
    setSyncingId(id)
    try {
      const result = await import('@/lib/documentSync').then(({ syncPendingDocuments }) => syncPendingDocuments(id))
      if (result.reason === 'signed-out') toast('Sign in to sync this private PDF to your account.', 'info')
      else if (result.reason === 'configuration') toast('Cloud storage is not configured. Your local study copy is safe.', 'error')
      else if (result.reason === 'offline') toast('You are offline. Your local study copy is safe.', 'info')
      else if (result.synced) toast('Private PDF and page index synced to your account.', 'success')
      else if (result.failed) toast('Cloud sync failed. Your local copy is still available; try again later.', 'error')
      else toast('No local PDF copy was found to sync. Your extracted study text remains on this device.', 'info')
    } catch {
      toast('Cloud sync could not start. Your local study copy is safe.', 'error')
    } finally { setSyncingId(null) }
  }

  return (
    <div className="hub-library-page">
      <PageHeading
        title="Library"
        subtitle={
          library.length
            ? `${library.length} document${library.length === 1 ? '' : 's'} · ${library.reduce(
                (n, r) => n + r.cardCount,
                0,
              )} cards`
            : 'Your uploads and their study sets'
        }
        actions={
          <Button onClick={() => navigate('/upload')} icon={<Upload className="size-4" />}>
            Upload
          </Button>
        }
      />

      {library.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-6" />}
          title="Nothing here yet"
          body="Upload a lecture PDF or save a useful community study set from Discover."
          action={<Button onClick={() => navigate('/upload')}>Upload a PDF</Button>}
        />
      ) : (
        <>
          <div className="hub-library-search relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search material…  ( / )"
              aria-label="Search material"
              className="h-11 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm outline-none transition placeholder:text-muted focus:border-forest-400"
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="No match" body={`Nothing matches “${query}”.`} />
          ) : (
            <ul className="space-y-3">
              {visible.map(({ doc, deck, cardCount, dueCount, lastAttempt }) => (
                <li key={doc.id}>
                  <Card tone="elevated" className="hub-library-card p-4 key-point-card">
                    <div className="flex flex-wrap items-start gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-forest-400 border border-line">
                        <BookOpen className="size-5" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/doc/${doc.id}`}
                          className="block truncate font-display text-[15px] font-semibold hover:underline"
                        >
                          {doc.title}
                        </Link>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Chip>{doc.pageCount} pages</Chip>
                          {doc.status === 'queued' ? <Chip tone="gold">Saved offline · pending</Chip> : null}
                          {doc.syncStatus === 'failed' ? <Chip tone="clay">Cloud sync needs retry</Chip> : doc.syncStatus === 'local' ? <Chip tone="gold">Cloud copy pending</Chip> : null}
                          <Chip>{cardCount} cards</Chip>
                          {dueCount > 0 ? <Chip tone="gold">{dueCount} due</Chip> : null}
                          {lastAttempt ? (
                            <Chip tone={lastAttempt.score / lastAttempt.total >= 0.7 ? 'green' : 'clay'}>
                              Last test {lastAttempt.score}/{lastAttempt.total}
                            </Chip>
                          ) : null}
                          <span className="text-[11px] text-muted">{formatRelative(doc.createdAt)}</span>
                        </div>
                      </div>

                      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                        {doc.syncStatus === 'local' || doc.syncStatus === 'failed' ? (
                          <Button size="sm" variant="secondary" disabled={syncingId === doc.id} onClick={() => void syncDocument(doc.id)} icon={<RefreshCw className="size-3.5" />}>
                            {syncingId === doc.id ? 'Syncing…' : 'Sync PDF'}
                          </Button>
                        ) : null}
                        {deck ? (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => navigate(`/deck/${deck.id}/study`)}
                              icon={<Layers className="size-3.5" />}
                            >
                              Study
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => navigate(`/deck/${deck.id}/rush`)}
                              icon={<Zap className="size-3.5" />}
                            >
                              Rush
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => navigate(`/deck/${deck.id}/test`)}
                              icon={<Target className="size-3.5" />}
                            >
                              Test
                            </Button>
                          </>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => remove(doc.id, doc.title)}
                          aria-label={`Delete ${doc.title}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
          {visible.length < filtered.length ? (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" onClick={() => setVisibleCount((count) => Math.min(count + 20, filtered.length))}>
                Load 20 more ({filtered.length - visible.length} remaining)
              </Button>
            </div>
          ) : null}
        </>
      )}
      <SavedPublicMaterials />
    </div>
  )
}

type SavedMaterial = {
  id: string
  title: string
  discipline: string
  summary: string
  page_count: number
  author_name: string
  content: Record<string, unknown>
}
type SavedProgress = { material_id: string; rush_count: number; best_score: number; best_accuracy: number }

function SavedPublicMaterials() {
  const navigate = useNavigate()
  const [materials, setMaterials] = useState<SavedMaterial[]>([])
  const [progress, setProgress] = useState<Record<string, SavedProgress>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    if (!supabase) { setLoading(false); return }
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) { setMaterials([]); setLoading(false); return }
    const { data: saved, error } = await supabase.from('saved_public_materials').select('material_id,created_at').eq('user_id', auth.user.id).order('created_at', { ascending: false })
    if (error) { toast(error.message, 'error'); setLoading(false); return }
    const ids = (saved ?? []).map((item) => item.material_id)
    if (!ids.length) { setMaterials([]); setProgress({}); setLoading(false); return }
    const [{ data, error: materialsError }, { data: stats, error: statsError }] = await Promise.all([
      supabase.from('public_materials').select('id,title,discipline,summary,page_count,author_name,content').in('id', ids),
      supabase.from('public_material_progress').select('material_id,rush_count,best_score,best_accuracy').eq('user_id', auth.user.id),
    ])
    if (materialsError) toast(materialsError.message, 'error')
    if (statsError) toast(statsError.message, 'error')
    const order = new Map(ids.map((id, index) => [id, index]))
    setMaterials(((data ?? []) as SavedMaterial[]).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)))
    setProgress(Object.fromEntries(((stats ?? []) as SavedProgress[]).map((item) => [item.material_id, item])))
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const unsave = async (id: string) => {
    if (!supabase) return
    setBusy(id)
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) { toast('Sign in to manage saved materials.', 'info'); setBusy(null); return }
    const { error } = await supabase.from('saved_public_materials').delete().eq('user_id', auth.user.id).eq('material_id', id)
    if (error) toast(error.message, 'error')
    else { setMaterials((old) => old.filter((item) => item.id !== id)); toast('Removed from your library.', 'success') }
    setBusy(null)
  }

  return (
    <section className="hub-saved-materials mt-8">
      <div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="font-display text-lg font-semibold">Saved from Discover</h2><p className="text-xs text-muted">Community study sets you have kept for later.</p></div><span className="text-xs text-muted">{materials.length} saved</span></div>
      {loading ? <Card className="p-4 text-sm text-muted">Loading saved materials…</Card> : materials.length === 0 ? <Card className="p-4 text-sm text-muted">No community materials saved yet. Visit Discover to keep a study set here.</Card> : (
        <div className="grid gap-3 md:grid-cols-2">
          {materials.map((material) => {
            const stats = progress[material.id]
            return <Card key={material.id} className="p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><Chip>{material.discipline || 'General'}</Chip><h3 className="mt-2 font-semibold">{material.title}</h3><p className="mt-1 text-xs text-muted">By {material.author_name} · {material.page_count} pages</p></div><Bookmark className="size-5 shrink-0 text-forest-400" /></div>
              <p className="mt-2 line-clamp-2 text-sm text-muted">{material.summary}</p>
              {stats ? <p className="mt-3 text-[11px] text-muted">{stats.rush_count} Rush rounds · Best {stats.best_score} points · {Math.round(Number(stats.best_accuracy))}% best accuracy</p> : <p className="mt-3 text-[11px] text-muted">No Rush rounds yet</p>}
              <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" disabled={busy === material.id} onClick={() => void launchPublicMaterialRush(material, navigate).catch((error) => toast(error instanceof Error ? error.message : 'Rush could not start.', 'info'))}><Zap className="size-3.5" />Play Rush</Button><Button size="sm" variant="ghost" disabled={busy === material.id} onClick={() => void unsave(material.id)}>Remove</Button></div>
            </Card>
          })}
        </div>
      )}
    </section>
  )
}
