import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  Clock,
  Flame,
  Layers,
  Play,
  Sparkles,
  Target,
  Upload,
  Zap,
} from 'lucide-react'
import { useLibrary, useProfile } from '@/lib/hooks'
import { seedDemo } from '@/lib/seed'
import { touchStreak } from '@/lib/store'
import { toast } from '@/components/ui/toast'
import { Button } from '@/components/ui/Button'
import { Card, Chip, EmptyState, StatTile } from '@/components/ui/misc'
import { formatRelative } from '@/lib/utils'

export function DashboardPage() {
  const library = useLibrary()
  const profile = useProfile()
  const navigate = useNavigate()
  const [seeding, setSeeding] = useState(false)

  const dueTotal = library.reduce((sum, row) => sum + row.dueCount, 0)
  const cardTotal = library.reduce((sum, row) => sum + row.cardCount, 0)
  const nextUp = [...library]
    .filter((row) => row.deck && row.dueCount > 0)
    .sort((a, b) => b.dueCount - a.dueCount)[0]

  const startDemo = async () => {
    setSeeding(true)
    try {
      const docId = await seedDemo()
      await touchStreak()
      toast('Demo study set added — explore it freely.', 'success')
      navigate(`/doc/${docId}`)
    } finally {
      setSeeding(false)
    }
  }

  if (library.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl border border-forest-400/25 bg-forest p-7 text-white shadow-xl sm:p-10">
          <Chip tone="gold" className="mb-5">
            <Sparkles className="size-3" /> Built for OOU
          </Chip>
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Turn your lecture PDFs into
            <span className="text-gold"> notes you actually revise</span>.
          </h1>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-mint/80">
            Upload a handout, slide deck or past question. You get short notes, the key
            points with worked examples, the organizations worth knowing, flashcards that
            flip, a test — and a record of everything you went looking for.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button variant="gold" size="lg" onClick={() => navigate('/upload')} icon={<Upload className="size-4" />}>
              Upload a PDF
            </Button>
            <Button
              size="lg"
              onClick={startDemo}
              disabled={seeding}
              variant="secondary"
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
              icon={<Play className="size-4" />}
            >
              {seeding ? 'Setting up…' : 'Try the demo deck'}
            </Button>
          </div>
          <p className="mt-4 text-xs text-mint/60">
            The demo needs no account and no API key. Uploading a real PDF needs your own
            Anthropic key, added in Settings — it never leaves this browser.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: BookOpen,
              title: 'Short notes first',
              body: 'A five-minute read of the whole handout, not another wall of text.',
            },
            {
              icon: Layers,
              title: 'Then recall',
              body: 'Key points become cards that flip, grade themselves into a schedule, and get tested.',
            },
            {
              icon: Target,
              title: 'Then a trail',
              body: 'Everything you ask is remembered, so the next recommendation is not a guess.',
            },
          ].map((item) => (
            <Card key={item.title} className="p-4">
              <item.icon className="mb-2.5 size-5 text-forest-400" />
              <h3 className="text-sm font-semibold">{item.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{item.body}</p>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-muted">
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {dueTotal > 0 ? `${dueTotal} card${dueTotal === 1 ? '' : 's'} to revise` : 'Nothing due'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {dueTotal > 0
            ? 'Short session now beats a long one the night before.'
            : 'You are up to date. Take a test, or read something new.'}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Due now" value={dueTotal} tone={dueTotal > 0 ? 'gold' : 'neutral'} />
        <StatTile label="Cards" value={cardTotal} />
        <StatTile label="XP" value={profile?.xp ?? 0} hint="from Card Rush" />
        <StatTile
          label="Streak"
          value={
            <span className="inline-flex items-center gap-1">
              {profile?.streakDays ?? 0}
              <Flame className={profile && profile.streakDays > 0 ? 'size-4 text-gold' : 'size-4 text-muted'} />
            </span>
          }
        />
      </div>

      {nextUp?.deck ? (
        <Card className="mb-6 border-forest-400/30 bg-gradient-to-br from-forest to-forest-600 p-5 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gold">
                <Clock className="size-3.5" /> Resume
              </div>
              <h2 className="truncate font-display text-lg font-semibold">{nextUp.deck.title}</h2>
              <p className="mt-1 text-sm text-mint/75">
                {nextUp.dueCount} of {nextUp.cardCount} cards are due
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="gold"
                onClick={() => navigate(`/deck/${nextUp.deck!.id}/study`)}
                icon={<Play className="size-4" />}
              >
                Study
              </Button>
              <Button
                variant="secondary"
                className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                onClick={() => navigate(`/deck/${nextUp.deck!.id}/rush`)}
                icon={<Zap className="size-4" />}
              >
                Card Rush
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold">Recent</h2>
        <Link to="/library" className="text-sm font-medium text-forest-400 hover:underline dark:text-gold">
          All material
        </Link>
      </div>

      <div className="space-y-2.5">
        {library.slice(0, 4).map(({ doc, deck, dueCount, cardCount }) => (
          <Link
            key={doc.id}
            to={deck ? `/doc/${doc.id}` : `/doc/${doc.id}`}
            className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 key-point-card"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-forest-400 border border-line">
              <BookOpen className="size-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{doc.title}</span>
              <span className="mt-0.5 block text-xs text-muted">
                {doc.pageCount} pages · {cardCount} cards · {formatRelative(doc.createdAt)}
              </span>
            </span>
            {dueCount > 0 ? <Chip tone="gold">{dueCount} due</Chip> : null}
            <ArrowRight className="size-4 shrink-0 text-muted" />
          </Link>
        ))}
      </div>

      {library.length === 1 && library[0].cardCount === 0 ? (
        <EmptyState
          className="mt-6"
          title="This document has no cards yet"
          body="Generation may have stopped halfway. Open it and run the pipeline again."
          action={<Button onClick={() => navigate(`/doc/${library[0].doc.id}`)}>Open document</Button>}
        />
      ) : null}
    </div>
  )
}
