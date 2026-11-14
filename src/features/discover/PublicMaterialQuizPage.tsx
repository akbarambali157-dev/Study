import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, RotateCcw, XCircle } from 'lucide-react'
import { PageHeading } from '@/components/PageShell'
import { Button } from '@/components/ui/Button'
import { Card, Progress } from '@/components/ui/misc'
import { supabase } from '@/lib/supabase'

type PublicQuestion = {
  stem: string
  options: string[]
  answerIndex: number
  explanation: string
  page?: number
}

type PublicMaterial = {
  id: string
  title: string
  content: { questions?: PublicQuestion[] }
}

export function PublicMaterialQuizPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [material, setMaterial] = useState<PublicMaterial | null>(null)
  const [loading, setLoading] = useState(true)
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [correct, setCorrect] = useState(0)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase || !id) { setLoading(false); return }
      const { data, error } = await supabase
        .from('public_materials')
        .select('id,title,content')
        .eq('id', id)
        .eq('is_public', true)
        .maybeSingle()
      if (!active) return
      if (error || !data) {
        setMaterial(null)
      } else {
        const content = (data.content ?? {}) as PublicMaterial['content']
        const questions = Array.isArray(content.questions) ? content.questions.filter((q) =>
          q && typeof q.stem === 'string' && Array.isArray(q.options) &&
          q.options.length === 4 && Number.isInteger(q.answerIndex) &&
          q.answerIndex >= 0 && q.answerIndex < 4 && typeof q.explanation === 'string',
        ) : []
        setMaterial({ id: data.id, title: data.title, content: { questions } })
      }
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [id])

  const questions = useMemo(() => material?.content.questions ?? [], [material])
  const question = questions[index]
  const accuracy = questions.length ? Math.round((correct / questions.length) * 100) : 0

  const choose = (choice: number) => {
    if (selected !== null || !question) return
    setSelected(choice)
    if (choice === question.answerIndex) setCorrect((value) => value + 1)
  }

  const next = () => {
    if (index + 1 >= questions.length) setFinished(true)
    else { setIndex((value) => value + 1); setSelected(null) }
  }

  const restart = () => { setIndex(0); setSelected(null); setCorrect(0); setFinished(false) }

  if (loading) return <div className="mx-auto max-w-2xl"><Card className="p-6 text-sm text-muted">Loading the community quiz…</Card></div>
  if (!material) return <div className="mx-auto max-w-2xl"><PageHeading title="Quiz unavailable" back={{ to: '/discover', label: 'Discover' }} /><Card className="p-5">This shared material is no longer available.</Card></div>
  if (!questions.length) return <div className="mx-auto max-w-2xl"><PageHeading title="No quiz available" subtitle={material.title} back={{ to: '/discover', label: 'Discover' }} /><Card className="p-5">The contributor did not include a usable quiz with this material.</Card></div>

  if (finished) return (
    <div className="mx-auto max-w-2xl">
      <PageHeading title="Quiz complete" subtitle={material.title} back={{ to: '/discover', label: 'Discover' }} />
      <Card className="p-6 text-center">
        <CheckCircle2 className="mx-auto size-9 text-forest-400" />
        <p className="mt-3 font-display text-4xl font-bold tnum">{correct}/{questions.length}</p>
        <p className="mt-1 text-sm text-muted">Correct answers · {accuracy}% accuracy</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={restart} icon={<RotateCcw className="size-4" />}>Try again</Button>
          <Button variant="secondary" onClick={() => navigate('/discover')}>Back to Discover</Button>
        </div>
      </Card>
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeading title="Community quiz" subtitle={material.title} back={{ to: '/discover', label: 'Discover' }} />
      <div className="mb-3 flex items-center justify-between text-xs text-muted">
        <span>Question {index + 1} of {questions.length}</span>
        <span className="tnum">{correct} correct so far</span>
      </div>
      <Progress value={index + 1} max={questions.length} className="mb-4" />
      <Card className="p-4 sm:p-6">
        <p className="mb-5 text-base font-semibold leading-relaxed sm:text-lg">{question.stem}</p>
        <div className="grid gap-2">
          {question.options.map((option, choice) => {
            const isAnswer = choice === question.answerIndex
            const isSelected = selected === choice
            const revealed = selected !== null
            return (
              <button
                key={choice}
                type="button"
                onClick={() => choose(choice)}
                disabled={revealed}
                className={`flex min-h-12 items-start gap-3 rounded-xl border px-3 py-3 text-left text-sm transition ${revealed && isAnswer ? 'border-forest-400 bg-forest-400/10 font-semibold' : revealed && isSelected ? 'border-clay bg-clay-soft/50' : 'border-line bg-surface hover:border-forest-400/50'}`}
              >
                <span className="tnum text-xs font-semibold text-muted">{String.fromCharCode(65 + choice)}.</span>
                <span className="flex-1">{option}</span>
                {revealed && isAnswer ? <CheckCircle2 className="size-4 shrink-0 text-forest-400" /> : null}
                {revealed && isSelected && !isAnswer ? <XCircle className="size-4 shrink-0 text-clay" /> : null}
              </button>
            )
          })}
        </div>
        {selected !== null ? (
          <div className="mt-4 rounded-xl border border-line bg-surface-2/60 p-3">
            <p className="text-sm font-semibold">{selected === question.answerIndex ? 'Correct' : 'Not quite'}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{question.explanation}</p>
            {question.page ? <p className="mt-2 text-xs text-muted">Source: page {question.page}</p> : null}
            <Button className="mt-4" onClick={next}>{index + 1 === questions.length ? 'See results' : 'Next question'}</Button>
          </div>
        ) : <p className="mt-4 text-xs text-muted">Choose an answer to reveal the explanation. This quiz uses questions already shared by the contributor; it does not generate new AI content.</p>}
      </Card>
      <Button className="mt-3" variant="ghost" onClick={() => navigate('/discover')} icon={<ArrowLeft className="size-4" />}>Leave quiz</Button>
    </div>
  )
}
