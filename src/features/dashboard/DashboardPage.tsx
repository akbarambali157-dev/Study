import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  Clock3,
  Flame,
  Layers3,
  Play,
  Plus,
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
import { EmptyState, StatTile } from '@/components/ui/misc'
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Demo setup failed.'
      toast(message, 'error')
    } finally {
      setSeeding(false)
    }
  }

  if (library.length === 0) {
    return (
      <div className="dashboard-content mx-auto max-w-6xl">
        <section className="welcome-stage">
          <div className="welcome-copy">
            <p className="eyebrow"><Sparkles className="size-3.5" /> YOUR PERSONAL STUDY SPACE</p>
            <h1>Make every lecture count.</h1>
            <p className="welcome-description">
              Turn course materials into clear notes, active-recall flashcards and focused practice.
              Your next study session starts with one document.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button variant="gold" size="lg" onClick={() => navigate('/upload')} icon={<Upload className="size-4" />}>
                Add study material
              </Button>
              <Button
                size="lg"
                onClick={startDemo}
                disabled={seeding}
                variant="secondary"
                className="welcome-secondary"
                icon={<Play className="size-4" />}
              >
                {seeding ? 'Preparing demo…' : 'Explore a sample'}
              </Button>
            </div>
            <p className="welcome-footnote">No document yet? The sample lets you explore before uploading.</p>
          </div>
          <div className="welcome-visual" aria-label="Study workflow preview">
            <div className="visual-orbit visual-orbit-one" />
            <div className="visual-orbit visual-orbit-two" />
            <div className="visual-paper">
              <div className="visual-paper-top"><span /> <span /> <span /></div>
              <div className="visual-line visual-line-wide" />
              <div className="visual-line" />
              <div className="visual-line visual-line-short" />
              <div className="visual-highlight"><Sparkles className="size-4" /> Key idea extracted</div>
              <div className="visual-card">
                <span>QUICK RECALL</span>
                <strong>What is the central idea?</strong>
                <div className="visual-answer">Tap to reveal answer <ArrowRight className="size-3.5" /></div>
              </div>
            </div>
            <div className="visual-float visual-float-top"><BookOpen className="size-4" /> Notes</div>
            <div className="visual-float visual-float-bottom"><Target className="size-4" /> Recall</div>
          </div>
        </section>

        <section className="intro-grid" aria-label="How Study Hub helps">
          <article className="intro-feature">
            <span className="feature-icon"><BookOpen /></span>
            <div><h2>Understand</h2><p>Get structured notes from your lecture materials.</p></div>
          </article>
          <article className="intro-feature">
            <span className="feature-icon"><Layers3 /></span>
            <div><h2>Remember</h2><p>Turn important ideas into active-recall flashcards.</p></div>
          </article>
          <article className="intro-feature">
            <span className="feature-icon"><Target /></span>
            <div><h2>Practise</h2><p>Check your understanding with tests and Card Rush.</p></div>
          </article>
        </section>
      </div>
    )
  }

  return (
    <div className="dashboard-content mx-auto max-w-6xl">
      <section className="dashboard-heading">
        <div>
          <p className="eyebrow">YOUR LEARNING OVERVIEW</p>
          <h1>Good to see you back.</h1>
          <p className="text-muted mt-1 text-sm">
            {dueTotal > 0
              ? `You have ${dueTotal} card${dueTotal === 1 ? '' : 's'} ready for review. A little practice goes a long way.`
              : 'You are up to date. Keep your momentum with a quick practice session.'}
          </p>
        </div>
        <Button onClick={() => navigate('/upload')} icon={<Plus className="size-4" />}>Add material</Button>
      </section>

      <section className="dashboard-overview" aria-label="Study progress">
        <div className="overview-primary">
          <div className="overview-topline">
            <span className="eyebrow eyebrow-light">TODAY'S FOCUS</span>
            <span className="overview-date">{new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          </div>
          <div className="overview-main">
            <div>
              <p className="overview-number tnum">{dueTotal}</p>
              <h2>{dueTotal === 1 ? 'card to review' : 'cards to review'}</h2>
              <p>{dueTotal > 0 ? 'Keep your knowledge fresh with a short recall session.' : 'Your review queue is clear. Explore a topic or take a test.'}</p>
            </div>
            <div className="overview-emblem"><Target className="size-10" strokeWidth={1.35} /></div>
          </div>
          <div className="overview-actions">
            {nextUp?.deck ? (
              <Button variant="gold" onClick={() => navigate(`/deck/${nextUp.deck!.id}/study`)} icon={<Play className="size-4" />}>Start reviewing</Button>
            ) : (
              <Button variant="gold" onClick={() => navigate('/library')} icon={<BookOpen className="size-4" />}>Open my library</Button>
            )}
            <span>{nextUp?.deck ? `${nextUp.dueCount} of ${nextUp.cardCount} cards in ${nextUp.deck.title}` : 'Your study materials are ready when you are.'}</span>
          </div>
        </div>
        <div className="overview-stats">
          <div className="metric-panel">
            <span className="metric-icon"><Layers3 /></span>
            <span className="metric-label">Flashcards</span>
            <strong className="tnum">{cardTotal.toLocaleString()}</strong>
            <span className="metric-note">Across your library</span>
          </div>
          <div className="metric-panel">
            <span className="metric-icon metric-icon-gold"><Zap /></span>
            <span className="metric-label">Experience points</span>
            <strong className="tnum">{(profile?.xp ?? 0).toLocaleString()}</strong>
            <span className="metric-note">Earned through practice</span>
          </div>
          <div className="metric-panel">
            <span className="metric-icon metric-icon-clay"><Flame /></span>
            <span className="metric-label">Study streak</span>
            <strong className="tnum">{profile?.streakDays ?? 0}<small> days</small></strong>
            <span className="metric-note">Keep showing up</span>
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <div><p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p><h2>Continue learning</h2></div>
          <Link to="/library" className="section-link">View library <ArrowRight className="size-4" /></Link>
        </div>
        {nextUp?.deck ? (
          <article className="continue-card">
            <div className="continue-art"><BookOpen className="size-8" /><span>STUDY SET</span></div>
            <div className="continue-copy">
              <span className="continue-kicker"><Clock3 className="size-3.5" /> READY FOR REVIEW</span>
              <h3>{nextUp.deck.title}</h3>
              <p>{nextUp.dueCount} of {nextUp.cardCount} cards are due for practice.</p>
              <div className="continue-progress"><span style={{ width: `${Math.min(100, nextUp.cardCount ? ((nextUp.cardCount - nextUp.dueCount) / nextUp.cardCount) * 100 : 0)}%` }} /></div>
            </div>
            <div className="continue-actions">
              <Button onClick={() => navigate(`/deck/${nextUp.deck!.id}/study`)} icon={<Play className="size-4" />}>Study</Button>
              <Button variant="secondary" onClick={() => navigate(`/deck/${nextUp.deck!.id}/rush`)} icon={<Zap className="size-4" />}>Card Rush</Button>
            </div>
          </article>
        ) : (
          <div className="next-step-panel">
            <div className="next-step-icon"><Sparkles className="size-5" /></div>
            <div><h3>Build your next study set</h3><p>Upload a lecture PDF and turn it into notes and recall practice.</p></div>
            <Button variant="secondary" onClick={() => navigate('/upload')}>Upload material <ArrowRight className="size-4" /></Button>
          </div>
        )}
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <div><p className="eyebrow">YOUR MATERIALS</p><h2>Recently added</h2></div>
          <Link to="/library" className="section-link">All materials <ArrowRight className="size-4" /></Link>
        </div>
        {library.length ? (
          <div className="recent-grid">
            {library.slice(0, 4).map(({ doc, deck, dueCount, cardCount }) => (
              <Link key={doc.id} to={`/doc/${doc.id}`} className="recent-card">
                <span className="recent-icon"><BookOpen className="size-5" /></span>
                <span className="recent-content">
                  <strong>{doc.title}</strong>
                  <span>{doc.pageCount} pages <i /> {cardCount} cards</span>
                  <span className="recent-time">{formatRelative(doc.createdAt)}</span>
                </span>
                <ArrowRight className="recent-arrow size-4" />
                {dueCount > 0 ? <span className="recent-due">{dueCount} due</span> : null}
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="Your library is ready" body="Add your first lecture document to start building a study set." action={<Button onClick={() => navigate('/upload')}>Add material</Button>} />
        )}
      </section>
    </div>
  )
}
