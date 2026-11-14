import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Save } from 'lucide-react'
import { PageHeading } from '@/components/PageShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'

export function ProfileSetupPage() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [form, setForm] = useState({
    displayName: '', institution: 'Olabisi Onabanjo University', faculty: '', department: '',
    level: '', programme: '', academicSession: '',
  })

  useEffect(() => {
    let active = true
    const load = async () => {
      const local = await db.profile.get('me')
      const auth = supabase ? await supabase.auth.getUser() : null
      const user = auth?.data.user ?? null
      let remote: Record<string, unknown> | null = null
      if (supabase && user) {
        const { data, error } = await supabase.from('student_profiles').select('display_name,institution,faculty,department,level,programme,academic_session').eq('user_id', user.id).maybeSingle()
        if (error) throw error
        remote = data as Record<string, unknown> | null
      }
      if (!active) return
      setEmail(user?.email ?? '')
      setUserId(user?.id ?? null)
      setForm({
        displayName: String(remote?.display_name ?? (local?.displayName && local.displayName !== 'Student' ? local.displayName : user?.user_metadata?.display_name ?? user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? '')),
        institution: String(remote?.institution ?? local?.institution ?? 'Olabisi Onabanjo University'),
        faculty: String(remote?.faculty ?? local?.faculty ?? ''),
        department: String(remote?.department ?? local?.department ?? ''),
        level: String(remote?.level ?? local?.level ?? ''),
        programme: String(remote?.programme ?? local?.programme ?? ''),
        academicSession: String(remote?.academic_session ?? local?.academicSession ?? ''),
      })
    }
    void load().catch(error => { if (active) toast(error instanceof Error ? error.message : 'Profile could not be loaded.', 'error') })
    return () => { active = false }
  }, [])

  const update = (field: keyof typeof form, value: string) => setForm(current => ({ ...current, [field]: value }))

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.displayName.trim() || !form.institution.trim() || !form.faculty.trim() || !form.department.trim() || !form.level.trim()) {
      toast('Complete your name, institution, faculty, department and level.', 'error')
      return
    }
    setBusy(true)
    try {
      if (supabase && userId) {
        const { error } = await supabase.from('student_profiles').upsert({
          user_id: userId, display_name: form.displayName.trim().slice(0, 80),
          institution: form.institution.trim().slice(0, 120), faculty: form.faculty.trim().slice(0, 120),
          department: form.department.trim().slice(0, 120), level: form.level.trim().slice(0, 30),
          programme: form.programme.trim().slice(0, 120), academic_session: form.academicSession.trim().slice(0, 30),
        }, { onConflict: 'user_id' })
        if (error) throw error
        const { error: metadataError } = await supabase.auth.updateUser({ data: { display_name: form.displayName.trim(), full_name: form.displayName.trim() } })
        if (metadataError) throw metadataError
      }
      const existing = await db.profile.get('me')
      await db.profile.put({
        id: 'me', displayName: form.displayName.trim(), institution: form.institution.trim(),
        faculty: form.faculty.trim(), department: form.department.trim(), level: form.level.trim(),
        programme: form.programme.trim() || undefined, academicSession: form.academicSession.trim() || undefined,
        xp: existing?.xp ?? 0, streakDays: existing?.streakDays ?? 0,
        lastActive: existing?.lastActive, lastRushBonusDate: existing?.lastRushBonusDate,
      })
      toast(supabase && userId ? 'Your academic profile is saved to your account and this device.' : 'Your academic profile is saved on this device.', 'success')
      navigate('/')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Profile could not be saved.', 'error')
    } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-2xl py-2 sm:py-6">
      <PageHeading title="Your student profile" subtitle="Your academic details are saved to your account and can be updated later from Settings." back={{ to: '/', label: 'Back' }} />
      <Card className="p-5 shadow-lg shadow-forest/5 sm:p-7">
        <div className="mb-5 flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-2xl bg-forest/10 text-forest dark:text-gold"><GraduationCap className="size-5" /></span><div><h2 className="font-semibold">Academic identity</h2><p className="text-xs text-muted">Your profile is private by default. Discovery settings can be added when student matching launches.</p></div></div>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {email ? <label className="text-sm font-medium sm:col-span-2">Account email<input value={email} readOnly aria-readonly="true" autoComplete="email" className="mt-1.5 h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-muted" /></label> : null}
          <label className="text-sm font-medium sm:col-span-2">Full name<input value={form.displayName} onChange={e => update('displayName', e.target.value)} required maxLength={80} autoComplete="name" className="mt-1.5 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400" placeholder="Your full name" /></label>
          <label className="text-sm font-medium sm:col-span-2">Institution<input value={form.institution} onChange={e => update('institution', e.target.value)} required maxLength={120} className="mt-1.5 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400" /></label>
          <label className="text-sm font-medium">Faculty<input value={form.faculty} onChange={e => update('faculty', e.target.value)} required maxLength={120} className="mt-1.5 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400" placeholder="e.g. Social Sciences" /></label>
          <label className="text-sm font-medium">Department<input value={form.department} onChange={e => update('department', e.target.value)} required maxLength={120} className="mt-1.5 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400" placeholder="Your department" /></label>
          <label className="text-sm font-medium">Current level<select value={form.level} onChange={e => update('level', e.target.value)} required className="mt-1.5 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400"><option value="">Select your level</option>{['100','200','300','400','500','600','Postgraduate'].map(level => <option key={level} value={level}>{level}</option>)}</select></label>
          <label className="text-sm font-medium">Programme / course<input value={form.programme} onChange={e => update('programme', e.target.value)} maxLength={120} className="mt-1.5 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400" placeholder="e.g. B.Sc. Business Administration" /></label>
          <label className="text-sm font-medium sm:col-span-2">Academic session<input value={form.academicSession} onChange={e => update('academicSession', e.target.value)} maxLength={30} className="mt-1.5 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400" placeholder="e.g. 2026/2027" /></label>
          <div className="pt-2 sm:col-span-2"><Button type="submit" disabled={busy} className="w-full" icon={<Save className="size-4" />}>{busy ? 'Saving profile…' : 'Save profile'}</Button></div>
        </form>
      </Card>
      <p className="mt-3 text-center text-xs text-muted">A matriculation number is not required and is not collected here.</p>
    </div>
  )
}
