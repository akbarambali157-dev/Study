import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  BookMarked,
  ExternalLink,
  Layers,
  Loader2,
  MessageCircleQuestion,
  Share2,
  Target,
  Zap,
} from 'lucide-react'
import { PageHeading, SectionTitle } from '@/components/PageShell'
import { Markdown } from '@/components/Markdown'
import { Button } from '@/components/ui/Button'
import { CitationChip } from '@/components/ui/CitationChip'
import { Card, Chip, EmptyState, Skeleton } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { db } from '@/lib/db'
import { useDocument, useDocumentContent, useSettings } from '@/lib/hooks'
import { record } from '@/lib/inquiries'
import { downloadFile, encodeShare, safeFilename, shareUrl, toAnkiTsv, toCsv } from '@/lib/export'
import { AiError, redactSecrets } from '@/lib/llm/ai'
import { askAboutKeyPoint } from '@/lib/llm/pipeline'
import { ORG_KIND_LABEL, type OrgKind } from '@/lib/types'
import { cn, formatRelative } from '@/lib/utils'

const ORG_TONE: Record<OrgKind, 'green' | 'gold' | 'clay' | 'neutral'> = {
  authority: 'green',
  professional: 'gold',
  local: 'clay',
  reading: 'neutral',
}

export function DocPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const settings = useSettings()
  const doc = useDocument(id)
  const { note, keyPoints, orgsByKeyPoint } = useDocumentContent(id)

  const deck = useLiveQuery(
    async () => (id ? db.decks.where('documentId').equals(id).first() : undefined),
    [id],
    undefined,
  )

  const [focused, setFocused] = useState(0)
  const [askingFor, setAskingFor] = useState<string | null>(null)
  const pointRefs = useRef<Map<string, HTMLLIElement>>(new Map())

  // One reopen event per document open, not per render. Gated on the document
  // itself so the trail gets one labelled event instead of an unlabelled one
  // when the row finishes loading.
  useEffect(() => {
    if (!id || !doc) return
    void record({ kind: 'doc_reopen', documentId: id, topic: doc.title })
  }, [id, doc])

  const jump = useCallback(
    (delta: number) => {
      if (keyPoints.length === 0) return
      const next = Math.min(keyPoints.length - 1, Math.max(0, focused + delta))
      setFocused(next)
      pointRefs.current.get(keyPoints[next].id)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    },
    [focused, keyPoints],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.key === 'j') {
        event.preventDefault()
        jump(1)
      } else if (event.key === 'k') {
        event.preventDefault()
        jump(-1)
      } else if (event.key === 'a' && keyPoints[focused]) {
        event.preventDefault()
        setAskingFor(keyPoints[focused].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focused, jump, keyPoints])

  const orgsFlat = useMemo(
    () => Array.from(orgsByKeyPoint.values()).flat(),
    [orgsByKeyPoint],
  )

  const doShare = async () => {
    if (!deck) return
    const cards = await db.cards.where('deckId').equals(deck.id).toArray()
    const encoded = encodeShare(deck, cards)
    if (!encoded) {
      toast('This deck is too large to fit in a share link. Export it instead.', 'error')
      return
    }
    const url = shareUrl(encoded)
    try {
      await navigator.clipboard.writeText(url)
      toast('Share link copied. It works with no server — the cards live in the link.', 'success')
    } catch {
      window.prompt('Copy this share link:', url)
    }
  }

  const exportDeck = async (format: 'anki' | 'csv') => {
    if (!deck) return
    const cards = await db.cards.where('deckId').equals(deck.id).toArray()
    if (format === 'anki') {
      downloadFile(safeFilename(deck.title, 'txt'), toAnkiTsv(cards), 'text/plain')
    } else {
      downloadFile(safeFilename(deck.title, 'csv'), toCsv(deck, cards), 'text/csv')
    }
    toast(`Exported ${cards.length} cards.`, 'success')
  }

  if (!doc) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const hasContent = keyPoints.length > 0

  return (
    <div>
      <PageHeading
        back={{ to: '/library', label: 'Library' }}
        title={doc.title}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="tnum">{doc.pageCount} pages</span>
            <span aria-hidden>·</span>
            <span>{keyPoints.length} key points</span>
            {deck ? (
              <>
                <span aria-hidden>·</span>
                <Link to={`/deck/${deck.id}/study`} className="underline">
                  {deck.title}
                </Link>
              </>
            ) : null}
            <span aria-hidden>·</span>
            <span>{formatRelative(doc.createdAt)}</span>
          </span>
        }
        actions={
          deck ? (
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
              <Button
                size="sm"
                variant="ghost"
                onClick={doShare}
                icon={<Share2 className="size-3.5" />}
              >
                Share
              </Button>
              <Button size="sm" variant="ghost" onClick={() => exportDeck('anki')}>
                Anki
              </Button>
              <Button size="sm" variant="ghost" onClick={() => exportDeck('csv')}>
                CSV
              </Button>
            </>
          ) : undefined
        }
      />

      {!hasContent ? (
        <EmptyState
          icon={<BookMarked className="size-6" />}
          title="No notes for this document yet"
          body="Generation either did not run or stopped before it finished. Running it again replaces anything partial."
          action={<Button onClick={() => navigate('/upload')}>Run generation</Button>}
        />
      ) : null}

      {note ? (
        <Card className="mb-5">
          <Chip tone="gold" className="mb-3">
            <BookMarked className="size-3" /> Short notes
          </Chip>
          <Markdown text={note.summary} />
          {note.takeaways.length > 0 ? (
            <div className="mt-4 rounded-xl border border-forest-400/25 bg-forest-400/5 p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-forest-400">
                If you remember four things
              </h3>
              <ul className="mt-2 space-y-1.5 text-[14px] leading-relaxed">
                {note.takeaways.map((item, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="tnum mt-0.5 shrink-0 font-semibold text-forest-400">
                      {index + 1}.
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      ) : null}

      {keyPoints.length > 0 ? (
        <>
          <SectionTitle hint="j / k to move · a to ask about one · o is on each citation">
            Key points
          </SectionTitle>
          <ol className="space-y-3">
            {keyPoints.map((point, index) => {
              const orgs = orgsByKeyPoint.get(point.id) ?? []
              return (
                <li
                  key={point.id}
                  ref={(element) => {
                    if (element) pointRefs.current.set(point.id, element)
                    else pointRefs.current.delete(point.id)
                  }}
                  onMouseEnter={() => setFocused(index)}
                >
                  <Card
                    className={cn(
                      'transition',
                      focused === index ? 'border-forest-400/40 shadow-sm' : undefined,
                    )}
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <h3 className="font-display text-[17px] font-semibold leading-snug">
                        <span className="tnum mr-2 text-muted">{index + 1}</span>
                        {point.heading}
                      </h3>
                      <CitationChip
                        documentId={doc.id}
                        page={point.page}
                        snippet={point.snippet}
                        confidence={point.confidence}
                      />
                    </div>

                    <Markdown text={point.body} />

                    {point.example ? (
                      // The label is a block of its own: Markdown renders a
                      // <div>, and a <div> inside a <span> is invalid HTML that
                      // browsers silently re-parent.
                      <div className="mt-3 rounded-xl bg-gold-soft/50 px-3.5 py-2.5 text-[14px] leading-relaxed dark:bg-gold/10">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8a5a00] dark:text-gold">
                          Example
                        </span>
                        <Markdown text={point.example} className="mt-0.5" />
                      </div>
                    ) : null}

                    {orgs.length > 0 ? (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {orgs.map((org) => {
                          const tone = ORG_TONE[org.kind]
                          const label = (
                            <>
                              {org.name}
                              {org.verified ? null : (
                                <span className="opacity-60"> · unverified</span>
                              )}
                            </>
                          )
                          const title = `${ORG_KIND_LABEL[org.kind]} — ${org.why}`
                          return org.url ? (
                            <a
                              key={`${org.name}-${org.kind}`}
                              href={org.url}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                              title={title}
                              onClick={() =>
                                void record({
                                  kind: 'org_click',
                                  documentId: doc.id,
                                  keyPointId: point.id,
                                  topic: org.name,
                                  query: org.name,
                                })
                              }
                              className="inline-flex"
                            >
                              <Chip tone={tone}>
                                {label}
                                <ExternalLink className="size-2.5" />
                              </Chip>
                            </a>
                          ) : (
                            <span key={`${org.name}-${org.kind}`} title={title}>
                              <Chip tone={tone}>{label}</Chip>
                            </span>
                          )
                        })}
                      </div>
                    ) : null}

                    <AskPanel
                      open={askingFor === point.id}
                      onToggle={() => {
                        const opening = askingFor !== point.id
                        setAskingFor(opening ? point.id : null)
                        if (opening) {
                          void record({
                            kind: 'explain_open',
                            documentId: doc.id,
                            keyPointId: point.id,
                            topic: point.heading,
                          })
                        }
                      }}
                      onAsk={(question) =>
                        askAboutKeyPoint({
                          keyPoint: point,
                          noteSummary: note?.summary ?? '',
                          question,
                          pageCount: doc.pageCount,
                          model: settings.model,
                          baseUrl: settings.baseUrl || undefined,
                        })
                      }
                      onAsked={(question) =>
                        void record({
                          kind: 'ask',
                          documentId: doc.id,
                          keyPointId: point.id,
                          topic: point.heading,
                          query: question,
                        })
                      }
                      documentId={doc.id}
                    />
                  </Card>
                </li>
              )
            })}
          </ol>

          {orgsFlat.length > 0 ? (
            <p className="mt-4 text-xs text-muted">
              {orgsFlat.filter((o) => o.verified).length} bodies from the curated list,{' '}
              {orgsFlat.filter((o) => !o.verified).length} suggested by the model and marked
              unverified. Check those at source before quoting them.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

/* ── inline follow-up question ─────────────────────────────────────────── */

function AskPanel({
  open,
  onToggle,
  onAsk,
  onAsked,
  documentId,
}: {
  open: boolean
  onToggle: () => void
  onAsk: (question: string) => Promise<{ answer: string; page: number; followUps: string[] }>
  onAsked: (question: string) => void
  documentId: string
}) {
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{
    answer: string
    page: number
    followUps: string[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async (asked: string) => {
    const trimmed = asked.trim()
    if (trimmed.length < 3) return
    setBusy(true)
    setError(null)
    onAsked(trimmed)
    try {
      setResult(await onAsk(trimmed))
    } catch (err) {
      setError(
        redactSecrets(
          err instanceof AiError || err instanceof Error ? err.message : 'Could not answer that.',
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-forest-400 transition hover:underline dark:text-gold"
      >
        <MessageCircleQuestion className="size-3.5" />
        Ask more about this
      </button>
    )
  }

  return (
    <div className="mt-3 rounded-xl border border-line bg-surface-2/50 p-3">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit(question)
        }}
        className="flex gap-2"
      >
        <input
          autoFocus
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Why does this happen? Give an example…"
          className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-app px-3 text-sm outline-none focus:border-forest-400"
        />
        <Button size="sm" type="submit" disabled={busy || question.trim().length < 3}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : 'Ask'}
        </Button>
      </form>

      {error ? <p className="mt-2 text-[13px] text-clay">{error}</p> : null}

      {result ? (
        <div className="mt-3 border-t border-line pt-3">
          <Markdown text={result.answer} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <CitationChip documentId={documentId} page={result.page} snippet="From the notes" />
          </div>
          {result.followUps.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {result.followUps.map((followUp) => (
                <button
                  key={followUp}
                  type="button"
                  onClick={() => {
                    setQuestion(followUp)
                    void submit(followUp)
                  }}
                  className="rounded-full border border-line bg-app px-2.5 py-1 text-[12px] text-muted transition hover:border-forest-400 hover:text-body"
                >
                  {followUp}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onToggle}
        className="mt-2 text-[12px] text-muted hover:underline"
      >
        Close
      </button>
    </div>
  )
}
