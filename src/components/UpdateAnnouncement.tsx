import { useEffect, useMemo, useState } from 'react'
import { BellRing, FileText, X } from 'lucide-react'

type PublishedUpdate = {
  id: string
  title: string
  category: string
  summary: string
  body: string
  version_label: string
  docs_path: string
  published_at: string | null
}

const STORAGE_KEY = 'studyhub:dismissed-app-updates:v1'

function readDismissed(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch { return [] }
}

export function UpdateAnnouncement({ online }: { online: boolean }) {
  const [updates, setUpdates] = useState<PublishedUpdate[]>([])
  const [dismissed, setDismissed] = useState<string[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!online) return
    let active = true
    setDismissed(readDismissed())
    void import('@/lib/supabase').then(({ supabase }) => {
      if (!supabase) return
      return supabase.from('app_updates')
        .select('id,title,category,summary,body,version_label,docs_path,published_at')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(20)
    }).then((result) => {
      if (!active || !result || result.error) return
      setUpdates((result.data ?? []) as PublishedUpdate[])
    }).catch(() => undefined)
    return () => { active = false }
  }, [online])

  const current = useMemo(() => updates.find(item => !dismissed.includes(item.id)), [updates, dismissed])
  if (!current) return null

  const dismiss = () => {
    const next = [...dismissed, current.id]
    setDismissed(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(-100))) } catch { /* private browsing storage may be unavailable */ }
    setExpanded(false)
  }
  const validLink = current.docs_path.startsWith('/') || /^https:\/\//i.test(current.docs_path)

  return <aside className="fixed left-1/2 top-[4.75rem] z-40 w-[calc(100%-1.25rem)] max-w-lg -translate-x-1/2" role="status" aria-live="polite">
    <div className="overflow-hidden rounded-[1.35rem] border border-line/80 bg-surface/95 shadow-2xl backdrop-blur-xl">
      <div className="flex items-start gap-3 p-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-forest text-white"><BellRing className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted"><span>Study Hub update</span><span>·</span><span>{current.category}</span>{current.version_label ? <><span>·</span><span>{current.version_label}</span></> : null}</div>
          <p className="mt-1 text-sm font-semibold text-body">{current.title}</p>
          {current.summary ? <p className="mt-1 text-xs leading-relaxed text-muted">{current.summary}</p> : null}
          {expanded && current.body ? <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-body">{current.body}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {current.body ? <button type="button" className="text-xs font-semibold text-forest-400" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show less' : 'Details'}</button> : null}
            {validLink && current.docs_path ? <a href={current.docs_path} target={current.docs_path.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-forest-400"><FileText className="size-3.5" />Documentation</a> : null}
          </div>
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss update" className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-body"><X className="size-4" /></button>
      </div>
    </div>
  </aside>
}
