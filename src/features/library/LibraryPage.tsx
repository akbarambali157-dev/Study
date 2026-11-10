import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Layers,
  Search,
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

export function LibraryPage() {
  const library = useLibrary()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
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

  return (
    <div>
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
          body="Upload a lecture PDF and everything else is generated from it."
          action={<Button onClick={() => navigate('/upload')}>Upload a PDF</Button>}
        />
      ) : (
        <>
          <div className="relative mb-4">
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
              {filtered.map(({ doc, deck, cardCount, dueCount, lastAttempt }) => (
                <li key={doc.id}>
                  <Card className="p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-forest-400">
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
        </>
      )}
    </div>
  )
}
