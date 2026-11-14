import { useEffect, useMemo, useState } from 'react'
import { MessageCircle, Search, Sparkles, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeading } from '@/components/PageShell'
import { Button } from '@/components/ui/Button'
import { Card, Chip } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { startConversation } from '@/lib/messaging'
import { supabase } from '@/lib/supabase'

type Student = {
  user_id: string
  display_name: string
  institution: string
  faculty: string
  department: string
  level: string
  academic_session: string
  research_interests: string[]
  skills: string[]
  project_goals: string[]
  collaboration_available: boolean
  message_policy: 'everyone' | 'requests' | 'nobody'
}
type Match = { student: Student; score: number; reasons: string[] }

const norm = (value: string) => value.trim().toLocaleLowerCase()
const overlap = (a: string[], b: string[]) => a.filter((item) => b.some((other) => norm(item) === norm(other))).length

export function StudentsPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Student[]>([])
  const [mine, setMine] = useState<Student | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!supabase) { setLoading(false); setError('Student discovery needs an account connection.'); return }
      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (authError || !auth.user) { setLoading(false); setError('Sign in to discover students who have opted in.'); return }
      const uid = auth.user.id
      const [{ data: own, error: ownError }, { data: profiles, error: profilesError }, { data: blocks, error: blocksError }] = await Promise.all([
        supabase.from('student_profiles').select('*').eq('user_id', uid).maybeSingle(),
        supabase.from('student_profiles').select('user_id,display_name,institution,faculty,department,level,academic_session,research_interests,skills,project_goals,collaboration_available,message_policy').eq('discoverable', true).eq('profile_visibility', 'public').limit(100),
        supabase.from('user_blocks').select('blocked_id').eq('blocker_id', uid),
      ])
      if (ownError) throw ownError
      if (profilesError) throw profilesError
      if (blocksError) throw blocksError
      if (!active) return
      setUserId(uid)
      setMine(own as Student | null)
      setRows(((profiles ?? []) as Student[]).filter((student) => student.user_id !== uid))
      setBlocked((blocks ?? []).map((item) => item.blocked_id))
    }
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Student discovery could not load.'))
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const matches = useMemo<Match[]>(() => {
    if (!mine) return rows.filter((row) => !blocked.includes(row.user_id)).map((student) => ({ student, score: 0, reasons: [] }))
    return rows.filter((row) => !blocked.includes(row.user_id)).map((student) => {
      const reasons: string[] = []
      let score = 0
      const interests = overlap(mine.research_interests ?? [], student.research_interests ?? [])
      const interestTotal = Math.max(mine.research_interests?.length ?? 0, student.research_interests?.length ?? 0, 1)
      score += 35 * interests / interestTotal
      if (interests) reasons.push(`${interests} shared research interest${interests === 1 ? '' : 's'}`)
      if (mine.department && norm(mine.department) === norm(student.department)) { score += 25; reasons.push('Same department') }
      if (mine.level && norm(mine.level) === norm(student.level)) { score += 15; reasons.push('Same academic level') }
      const skills = overlap(mine.skills ?? [], student.skills ?? [])
      if (skills) { score += Math.min(15, skills * 5); reasons.push('Related skills') }
      const goals = overlap(mine.project_goals ?? [], student.project_goals ?? [])
      if (goals) { score += Math.min(10, goals * 5); reasons.push('Shared project goals') }
      return { student, score: Math.round(score), reasons }
    }).sort((a, b) => b.score - a.score)
  }, [mine, rows, blocked])

  const filtered = matches.filter(({ student }) => [student.display_name, student.institution, student.faculty, student.department, student.level, ...(student.research_interests ?? []), ...(student.skills ?? [])].join(' ').toLowerCase().includes(query.trim().toLowerCase()))

  const message = async (student: Student) => {
    if (!userId) { navigate('/auth'); return }
    setBusy(student.user_id)
    try {
      const id = await startConversation(student.user_id)
      navigate(`/messages/${id}`)
    } catch (err) { toast(err instanceof Error ? err.message : 'Message request could not be started.', 'error') }
    finally { setBusy(null) }
  }

  const block = async (student: Student) => {
    if (!supabase || !userId || !window.confirm(`Block ${student.display_name}? They will no longer be suggested to you or be able to message you.`)) return
    const { error: blockError } = await supabase.from('user_blocks').insert({ blocker_id: userId, blocked_id: student.user_id })
    if (blockError) toast(blockError.message, 'error')
    else { setBlocked((current) => [...current, student.user_id]); toast('Student blocked.', 'success') }
  }

  return <div className="mx-auto max-w-5xl"><PageHeading title="Discover students" subtitle="Find students with overlapping academic interests. Only students who opt in appear here." /><div className="mb-4 flex items-center gap-2 rounded-xl border border-line bg-surface px-3"><Search className="size-4 text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, department, interests or skills" className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" /></div>{error ? <Card className="p-4 text-sm text-muted">{error}{!userId ? <Button className="mt-3" size="sm" onClick={() => navigate('/auth')}>Sign in</Button> : null}</Card> : loading ? <Card className="p-5 text-sm text-muted">Finding opted-in students…</Card> : filtered.length === 0 ? <Card className="p-8 text-center"><Users className="mx-auto size-8 text-muted" /><h2 className="mt-3 font-semibold">No matching students yet</h2><p className="mt-1 text-sm text-muted">Try a broader search, or update your academic interests and discovery preferences in your profile.</p><Button className="mt-4" variant="secondary" onClick={() => navigate('/profile-setup')}>Update my profile</Button></Card> : <div className="grid gap-3 md:grid-cols-2">{filtered.map(({ student, score, reasons }) => <Card key={student.user_id} className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-semibold">{student.display_name}</h2><p className="mt-1 text-xs text-muted">{[student.department, student.level ? `Level ${student.level}` : '', student.institution].filter(Boolean).join(' · ')}</p></div><Chip tone={score >= 50 ? 'green' : 'neutral'}>{score ? `${score}% match` : 'Discoverable'}</Chip></div>{reasons.length ? <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><Sparkles className="size-3.5 text-gold" />{reasons.join(' · ')}</p> : null}{student.research_interests?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{student.research_interests.slice(0,5).map((item) => <Chip key={item}>{item}</Chip>)}</div> : null}{student.skills?.length ? <p className="mt-2 text-xs text-muted">Skills: {student.skills.slice(0,5).join(', ')}</p> : null}<div className="mt-4 flex flex-wrap gap-2">{student.collaboration_available ? <Chip tone="green">Open to collaboration</Chip> : null}{student.message_policy !== 'nobody' ? <Button size="sm" onClick={() => void message(student)} disabled={busy === student.user_id} icon={<MessageCircle className="size-3.5" />}>{busy === student.user_id ? 'Opening…' : 'Message'}</Button> : <Chip>Not accepting messages</Chip>}<Button size="sm" variant="ghost" onClick={() => void block(student)}>Block</Button></div></Card>)}</div>}</div>
}
