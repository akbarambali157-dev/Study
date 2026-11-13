import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Compass,
  EyeOff,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { PageHeading, SectionTitle } from '@/components/PageShell'
import { Button } from '@/components/ui/Button'
import { Card, EmptyState, Progress } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { db } from '@/lib/db'
import { useInquiries, useLearningProfile, useSettings } from '@/lib/hooks'
import { computeInterests, groupByDay, maybeRefreshProfile } from '@/lib/inquiries'
import { downloadFile } from '@/lib/export'
import { INQUIRY_LABEL } from '@/lib/types'
import { formatRelative } from '@/lib/utils'

export function TrailPage() {
  const navigate = useNavigate()
  const settings = useSettings()
  const inquiries = useInquiries(400)
  const profile = useLearningProfile()
  const [busy, setBusy] = useState(false)

  const documents = useLiveQuery(async () => {
    const rows = await db.documents.toArray()
    return new Map(rows.map((d) => [d.id, d.title]))
  }, [])

  const interests = useMemo(() => computeInterests(inquiries, 8), [inquiries])
  const days = useMemo(() => groupByDay(inquiries).slice(0, 7), [inquiries])

  const refresh = useCallback(
    async (force: boolean) => {
      setBusy(true)
      try {
        const result = await maybeRefreshProfile({
          model: settings.model,
          baseUrl: settings.baseUrl || undefined,
          force,
        })
        toast(
          result
            ? 'Insight updated.'
            : 'Not enough activity yet — a few more questions will give it something to work with.',
          result ? 'success' : 'info',
        )
      } catch {
        toast('Could not update the insight right now.', 'error')
      } finally {
        setBusy(false)
      }
    },
    [settings.baseUrl, settings.model, settings.useProxy],
  )

  const exportTrail = () => {
    downloadFile(
      'learning-trail.json',
      JSON.stringify({ events: inquiries, profile }, null, 2),
      'application/json',
    )
    toast('Trail exported.', 'success')
  }

  if (!settings.trailEnabled) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeading title="Learning trail" subtitle="Paused" />
        <EmptyState
          icon={<EyeOff className="size-6" />}
          title="The trail is switched off"
          body="Nothing is being recorded. Turn it back on in Settings when you want the app to learn what you keep going back to."
          action={<Button onClick={() => navigate('/settings')}>Open Settings</Button>}
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeading
        title="Learning trail"
        subtitle="What you actually went looking for, not what you were told to read."
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => refresh(true)}
              disabled={busy}
              icon={
                busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )
              }
            >
              Update insight
            </Button>
            <Button size="sm" variant="ghost" onClick={exportTrail}>
              Export
            </Button>
          </>
        }
      />

      {inquiries.length === 0 ? (
        <EmptyState
          icon={<Compass className="size-6" />}
          title="Nothing recorded yet"
          body="Open a document, search your library, ask a follow-up, miss a test question — the trail starts the moment you study."
          action={<Button onClick={() => navigate('/library')}>Go to Library</Button>}
        />
      ) : (
        <>
          {profile ? (
            <Card className="mb-5 border-forest-400/30 bg-gradient-to-br from-forest to-forest-600 text-white">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gold">
                <Sparkles className="size-3.5" /> What this suggests
              </div>
              <p className="text-[15px] leading-relaxed text-mint/90">{profile.narrative}</p>

              {profile.suggestedNext.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {profile.suggestedNext.map((suggestion) => {
                    const deck = suggestion.deckId
                    return (
                      <div
                        key={suggestion.title}
                        className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold">{suggestion.title}</span>
                          {deck ? (
                            <Link
                              to={`/deck/${deck}/study`}
                              className="rounded-lg bg-gold px-2.5 py-1 text-[12px] font-semibold text-ink"
                            >
                              Study
                            </Link>
                          ) : suggestion.documentId ? (
                            <Link
                              to={`/doc/${suggestion.documentId}`}
                              className="rounded-lg bg-gold px-2.5 py-1 text-[12px] font-semibold text-ink"
                            >
                              Open
                            </Link>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[13px] leading-relaxed text-mint/75">
                          {suggestion.reason}
                        </p>
                      </div>
                    )
                  })}
                </div>
              ) : null}

              {profile.gaps.length > 0 ? (
                <div className="mt-4">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gold">
                    Thin spots
                  </h3>
                  <ul className="mt-1.5 space-y-1 text-[13px] text-mint/80">
                    {profile.gaps.map((gap) => (
                      <li key={gap}>· {gap}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p className="mt-4 border-t border-white/10 pt-3 text-[11px] text-mint/60">
                Built from {profile.sourceEventCount} events, {formatRelative(profile.computedAt)}.
                One batched call, never one per question.
              </p>
            </Card>
          ) : (
            <Card className="mb-5">
              <div className="flex items-start gap-3">
                <Lightbulb className="mt-0.5 size-5 shrink-0 text-gold" />
                <div>
                  <h2 className="text-sm font-semibold">Nothing distilled yet</h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">
                    The topics below are computed on this device for free. Once there are
                    around 25 events, one small call turns them into a written insight.
                    {inquiries.length > 0 ? ` ${inquiries.length} so far.` : ''}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-3"
                    onClick={() => refresh(true)}
                    disabled={busy}
                  >
                    Ask for it now
                  </Button>
                </div>
              </div>
            </Card>
          )}

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <div>
              <SectionTitle hint="Weighted by kind and recency, on this device">
                You keep coming back to
              </SectionTitle>
              <div className="space-y-2">
                {interests.slice(0, 6).map((interest) => (
                  <div key={interest.topic}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-medium">{interest.topic}</span>
                      <span className="tnum shrink-0 text-[11px] text-muted">
                        {Math.round(interest.weight * 100)}
                      </span>
                    </div>
                    <Progress value={interest.weight * 100} />
                    {interest.evidence.length > 0 ? (
                      <p className="mt-1 truncate text-[11px] text-muted">
                        {interest.evidence.join(' · ')}
                      </p>
                    ) : null}
                  </div>
                ))}
                {interests.length === 0 ? (
                  <p className="text-[13px] text-muted">
                    No topic labels yet — these come from what you search for and ask about.
                  </p>
                ) : null}
              </div>
            </div>

            <div>
              <SectionTitle hint="Newest first">Recent activity</SectionTitle>
              <div className="space-y-3">
                {days.map((day) => (
                  <div key={day.day}>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {new Date(day.day).toLocaleDateString(undefined, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                    <ul className="space-y-1">
                      {day.items.slice(0, 6).map((item) => (
                        <li key={item.id} className="flex items-baseline gap-1.5 text-[13px]">
                          <span className="shrink-0 text-[11px] text-muted">
                            {INQUIRY_LABEL[item.kind]}
                          </span>
                          {item.documentId ? (
                            <Link
                              to={`/doc/${item.documentId}`}
                              className="min-w-0 truncate hover:underline"
                            >
                              {item.query || item.topic || documents?.get(item.documentId)}
                            </Link>
                          ) : (
                            <span className="min-w-0 truncate">
                              {item.query || item.topic || '—'}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Card className="bg-surface-2/40">
            <div className="flex items-start gap-3">
              <TrendingUp className="mt-0.5 size-4 shrink-0 text-muted" />
              <div className="text-[12px] leading-relaxed text-muted">
                <strong className="text-body">Why you are seeing this:</strong> every
                deliberate act — a search, a follow-up question, a missed test item, an
                organization you opened, a card you graded “again” — is logged locally with
                the topic it belongs to. Weights decay over a fortnight, so recent curiosity
                counts more. {inquiries.length} events on this device.{' '}
                <Link to="/settings" className="underline">
                  Pause or erase it in Settings
                </Link>
                .
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
