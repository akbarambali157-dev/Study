import { useMemo, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, Check, Circle, Clock3, Plus, Target, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeading } from '@/components/PageShell'
import { Button } from '@/components/ui/Button'
import { Card, Chip, EmptyState } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { db } from '@/lib/db'
import type { StudyGoal, StudyTask } from '@/lib/types'
import { uid } from '@/lib/utils'

const today = () => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
const labels: Record<StudyTask['kind'], string> = { study: 'Study session', revision: 'Revision', quiz: 'Practice test', assignment: 'Assignment' }

export function PlannerPage() {
  const tasks = useLiveQuery(() => db.studyTasks.orderBy('dueAt').toArray(), [], [])
  const goals = useLiveQuery(() => db.studyGoals.orderBy('createdAt').reverse().toArray(), [], [])
  const attempts = useLiveQuery(() => db.attempts.orderBy('createdAt').reverse().limit(8).toArray(), [], [])
  const questionIds = useMemo(() => [...new Set(attempts.flatMap((attempt) => attempt.answers.map((answer) => answer.questionId)))], [attempts])
  const questionKey = questionIds.join('|')
  const questions = useLiveQuery(() => db.questions.bulkGet(questionIds), [questionKey], [])
  const keyPointIds = useMemo(() => [...new Set(questions.flatMap((question) => question?.keyPointId ? [question.keyPointId] : []))], [questions])
  const keyPointKey = keyPointIds.join('|')
  const keyPoints = useLiveQuery(() => db.keyPoints.bulkGet(keyPointIds), [keyPointKey], [])
  const documentIds = useMemo(() => [...new Set(attempts.map((attempt) => attempt.documentId))], [attempts])
  const documentKey = documentIds.join('|')
  const documents = useLiveQuery(() => db.documents.bulkGet(documentIds), [documentKey], [])
  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState(today())
  const [kind, setKind] = useState<StudyTask['kind']>('study')
  const [goalTitle, setGoalTitle] = useState('')
  const [goalTarget, setGoalTarget] = useState('5')
  const [busy, setBusy] = useState(false)
  const sorted = useMemo(() => [...tasks].sort((a,b) => a.completed !== b.completed ? Number(a.completed)-Number(b.completed) : a.dueAt.localeCompare(b.dueAt)), [tasks])
  const topicStats = useMemo(() => {
    const questionById = new Map(questions.map(question => [question.id, question]))
    const pointById = new Map(keyPoints.map(point => [point.id, point]))
    const totals = new Map<string, { id: string; title: string; correct: number; total: number }>()
    for (const attempt of attempts) {
      for (const answer of attempt.answers) {
        const question = questionById.get(answer.questionId)
        if (!question?.keyPointId) continue
        const point = pointById.get(question.keyPointId)
        if (!point) continue
        const current = totals.get(point.id) ?? { id: point.id, title: point.heading, correct: 0, total: 0 }
        current.total += 1
        if (answer.correct) current.correct += 1
        totals.set(point.id, current)
      }
    }
    return [...totals.values()].sort((a,b) => b.total-a.total).slice(0,6)
  }, [attempts, keyPoints, questions])
  const pending = tasks.filter(t => !t.completed)
  const overdue = pending.filter(t => t.dueAt < today())
  const dueToday = pending.filter(t => t.dueAt === today())

  const addTask = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const clean = title.trim()
    if (clean.length < 3) { toast('Give the task a clearer title.', 'error'); return }
    setBusy(true)
    try {
      await db.studyTasks.add({ id: uid('task'), title: clean.slice(0,120), dueAt, kind, completed: false, createdAt: new Date().toISOString() })
      setTitle('')
      toast('Study task added.', 'success')
    } catch (err) { toast(err instanceof Error ? err.message : 'Task could not be saved.', 'error') }
    finally { setBusy(false) }
  }
  const addGoal = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const clean = goalTitle.trim(), target = Number(goalTarget)
    if (clean.length < 3 || !Number.isInteger(target) || target < 1 || target > 100) { toast('Enter a goal and a target between 1 and 100 sessions.', 'error'); return }
    const now = new Date().toISOString()
    const goal: StudyGoal = { id: uid('goal'), title: clean.slice(0,100), targetSessions: target, completedSessions: 0, createdAt: now, updatedAt: now }
    await db.studyGoals.add(goal)
    setGoalTitle('')
    toast('Learning goal created.', 'success')
  }
  const toggleTask = async (task: StudyTask) => { await db.studyTasks.update(task.id, { completed: !task.completed }) }
  const recordSession = async (goal: StudyGoal) => { await db.studyGoals.update(goal.id, { completedSessions: Math.min(goal.targetSessions, goal.completedSessions+1), updatedAt: new Date().toISOString() }) }

  return <div className="mx-auto max-w-5xl">
    <PageHeading title="Study planner" subtitle="Plan manageable sessions, keep track of deadlines and work towards your learning goals." />
    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      <Card className="p-4"><p className="text-xs text-muted">Due today</p><p className="mt-1 font-display text-3xl font-semibold tnum">{dueToday.length}</p><p className="text-xs text-muted">Tasks to focus on</p></Card>
      <Card className="p-4"><p className="text-xs text-muted">Overdue</p><p className="mt-1 font-display text-3xl font-semibold tnum">{overdue.length}</p><p className="text-xs text-muted">Reschedule realistically</p></Card>
      <Card className="p-4"><p className="text-xs text-muted">Completed</p><p className="mt-1 font-display text-3xl font-semibold tnum">{tasks.filter(t=>t.completed).length}</p><p className="text-xs text-muted">Tasks completed so far</p></Card>
    </div>
    <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
      <section className="space-y-4">
        <Card className="p-4 sm:p-5"><div className="mb-3 flex items-center gap-2"><CalendarDays className="size-5 text-forest-400"/><h2 className="font-semibold">Add to your plan</h2></div>
          <form onSubmit={addTask} className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-muted sm:col-span-2">Task<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} required placeholder="e.g. Revise ECO 101 demand and supply" className="mt-1.5 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm text-body"/></label>
            <label className="text-xs font-medium text-muted">Date<input type="date" value={dueAt} onChange={e=>setDueAt(e.target.value)} required className="mt-1.5 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm text-body"/></label>
            <label className="text-xs font-medium text-muted">Activity<select value={kind} onChange={e=>setKind(e.target.value as StudyTask['kind'])} className="mt-1.5 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm text-body">{Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
            <div className="sm:col-span-2"><Button type="submit" disabled={busy} icon={<Plus className="size-4"/>}>{busy?'Adding…':'Add task'}</Button></div>
          </form>
        </Card>
        <Card className="p-4 sm:p-5"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Your schedule</h2><Chip>{pending.length} open</Chip></div>
          {sorted.length===0?<EmptyState icon={<CalendarDays className="size-6"/>} title="Your planner is clear" body="Add a study session, revision task or assignment deadline to get started."/>:<ul className="space-y-2">{sorted.map(task=><li key={task.id} className="flex items-start gap-3 rounded-xl border border-line p-3"><button type="button" onClick={()=>void toggleTask(task)} aria-label={task.completed?'Mark task incomplete':'Mark task complete'} className="mt-0.5 text-forest-400">{task.completed?<Check className="size-5"/>:<Circle className="size-5"/>}</button><div className="min-w-0 flex-1"><p className={task.completed?'text-sm text-muted line-through':'text-sm font-medium'}>{task.title}</p><div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted"><Chip>{labels[task.kind]}</Chip><span className="flex items-center gap-1"><Clock3 className="size-3"/>{task.dueAt}</span>{!task.completed&&task.dueAt<today()?<Chip tone="clay">Overdue</Chip>:null}</div></div><button type="button" onClick={()=>void db.studyTasks.delete(task.id)} aria-label="Delete task" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-clay"><Trash2 className="size-4"/></button></li>)}</ul>}
        </Card>
      </section>
      <section className="space-y-4">
        <Card className="p-4 sm:p-5"><div className="mb-3 flex items-center gap-2"><Target className="size-5 text-gold"/><h2 className="font-semibold">Learning goals</h2></div>
          <form onSubmit={addGoal} className="space-y-3"><label className="block text-xs font-medium text-muted">Goal<input value={goalTitle} onChange={e=>setGoalTitle(e.target.value)} maxLength={100} required placeholder="e.g. Complete five revision sessions" className="mt-1.5 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm text-body"/></label><label className="block text-xs font-medium text-muted">Target sessions<input type="number" min="1" max="100" value={goalTarget} onChange={e=>setGoalTarget(e.target.value)} required className="mt-1.5 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm text-body"/></label><Button type="submit" variant="secondary" block>Set goal</Button></form>
          <div className="mt-4 space-y-3">{goals.length===0?<p className="text-xs text-muted">Your goals will appear here. Keep them realistic and flexible.</p>:goals.map(goal=>{const pct=Math.min(100,Math.round(goal.completedSessions/goal.targetSessions*100));return <div key={goal.id} className="rounded-xl border border-line p-3"><div className="flex items-start justify-between gap-2"><p className="text-sm font-medium">{goal.title}</p><button type="button" onClick={()=>void db.studyGoals.delete(goal.id)} aria-label="Delete goal" className="text-muted hover:text-clay"><Trash2 className="size-4"/></button></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-forest-400" style={{width:pct+'%'}}/></div><div className="mt-2 flex items-center justify-between text-[11px] text-muted"><span>{goal.completedSessions}/{goal.targetSessions} sessions</span><span>{pct}%</span></div><Button size="sm" variant="secondary" className="mt-2" disabled={goal.completedSessions>=goal.targetSessions} onClick={()=>void recordSession(goal)}>Record a session</Button></div>})}</div>
        </Card>
        <Card className="p-4 sm:p-5"><h2 className="mb-3 font-semibold">Topic mastery</h2>{topicStats.length===0?<p className="text-xs text-muted">Complete tests linked to key topics to build your mastery overview.</p>:<ul className="space-y-3">{topicStats.map(topic=>{const pct=Math.round(topic.correct/topic.total*100);return <li key={topic.id}><div className="flex items-center justify-between gap-3"><p className="min-w-0 truncate text-sm font-medium">{topic.title}</p><span className="shrink-0 text-xs text-muted">{pct}% · {topic.total} answers</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-forest-400" style={{width:pct+'%'}}/></div></li>})}</ul>}<p className="mt-3 text-[11px] text-muted">Based on recorded answers, not a guarantee of complete subject mastery.</p></Card>
        <Card className="p-4 sm:p-5"><h2 className="mb-3 font-semibold">Recent test results</h2>{attempts.length===0?<p className="text-xs text-muted">Complete a practice test to see your history here.</p>:<ul className="space-y-3">{attempts.map(attempt=>{const doc=documents.find(d=>d.id===attempt.documentId);const pct=attempt.total?Math.round(attempt.score/attempt.total*100):0;return <li key={attempt.id} className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-0"><div className="min-w-0"><p className="truncate text-sm font-medium">{doc?.title??'Study material'}</p><p className="text-[11px] text-muted">{new Date(attempt.createdAt).toLocaleDateString()} · {attempt.mode} mode</p></div><Chip tone={pct>=70?'green':'neutral'}>{pct}%</Chip></li>})}</ul>}<Link to="/library" className="mt-3 inline-flex text-xs font-semibold text-forest-400 hover:underline">Open your library</Link></Card>
      </section>
    </div>
    <p className="mt-5 text-center text-[11px] text-muted">Your planner and goals are stored on this device and work offline. Export your data from Settings to keep a backup.</p>
  </div>
}
