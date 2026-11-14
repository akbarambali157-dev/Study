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
  const [form, setForm] = useState({
    displayName: '',
    faculty: '',
    department: '',
    level: '',
    programme: '',
    matricNo: '',
  })

  useEffect(() => {
    let active = true
    void Promise.all([db.profile.get('me'), supabase?.auth.getUser()]).then(([profile, auth]) => {
      if (!active) return
      const user = auth && 'data' in auth ? auth.data.user : null
      setEmail(user?.email ?? '')
      setForm({
        displayName: profile?.displayName && profile.displayName !== 'Student'
          ? profile.displayName
          : String(user?.user_metadata?.display_name ?? user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email?.split('@')[0] ?? ''),
        faculty: profile?.faculty ?? '',
        department: profile?.department ?? '',
        level: profile?.level ?? '',
        programme: profile?.programme ?? '',
        matricNo: profile?.matricNo ?? '',
      })
    }).catch(() => undefined)
    return () => { active = false }
  }, [])

  const update = (field: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [field]: value }))

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.displayName.trim() || !form.faculty.trim() ||
        !form.department.trim() || !form.level.trim()) {
      toast('Please complete your name, faculty, department and level.', 'error')
      return
    }
    setBusy(true)
    try {
      const existing = await db.profile.get('me')
      await db.profile.put({
        id: 'me',
        displayName: form.displayName.trim(),
        faculty: form.faculty.trim(),
        department: form.department.trim(),
        level: form.level.trim(),
        programme: form.programme.trim() || undefined,
        matricNo: form.matricNo.trim() || undefined,
        xp: existing?.xp ?? 0,
        streakDays: existing?.streakDays ?? 0,
        lastActive: existing?.lastActive,
      })
      if (supabase) {
        const { error } = await supabase.auth.updateUser({
          data: {
            display_name: form.displayName.trim(),
            full_name: form.displayName.trim(),
            faculty: form.faculty.trim(),
            department: form.department.trim(),
            level: form.level.trim(),
            programme: form.programme.trim(),
          },
        })
        if (error) throw error
      }
      toast('Your student profile has been saved.', 'success')
      navigate('/')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Profile could not be saved.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl py-2 sm:py-6">
      <PageHeading
        title="Set up your student profile"
        subtitle="Add your academic details once. You can review or change them later from Settings."
        back={{ to: '/', label: 'Back' }}
      />
      <Card className="p-5 shadow-lg shadow-forest/5 sm:p-7">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-forest/10 text-forest dark:text-gold">
            <GraduationCap className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold">Your academic details</h2>
            <p className="text-xs text-muted">You can update these later in your profile settings.</p>
          </div>
        </div>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {email ? <label className="text-sm font-medium sm:col-span-2">Account email
            <input value={email} readOnly aria-readonly="true" autoComplete="email" className="mt-1.5 h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-muted" />
            <span className="mt-1 block text-xs font-normal text-muted">Change this through account verification, not here.</span>
          </label> : null}
          <label className="text-sm font-medium sm:col-span-2">Full name
            <input value={form.displayName} onChange={e => update('displayName', e.target.value)} required autoComplete="name" className="mt-1.5 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400" placeholder="Your full name" />
          </label>
          <label className="text-sm font-medium">Faculty
            <input value={form.faculty} onChange={e => update('faculty', e.target.value)} required className="mt-1.5 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400" placeholder="e.g. Social Sciences" />
          </label>
          <label className="text-sm font-medium">Department
            <input value={form.department} onChange={e => update('department', e.target.value)} required className="mt-1.5 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400" placeholder="Your department" />
          </label>
          <label className="text-sm font-medium">Current level
            <select value={form.level} onChange={e => update('level', e.target.value)} required className="mt-1.5 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400">
              <option value="">Select your level</option>
              {['100','200','300','400','500','600','Postgraduate'].map(level => <option key={level} value={level}>{level}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Programme / course (optional)
            <input value={form.programme} onChange={e => update('programme', e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400" placeholder="e.g. B.Sc. Business Administration" />
          </label>
          <label className="text-sm font-medium sm:col-span-2">Matriculation number (optional)
            <input value={form.matricNo} onChange={e => update('matricNo', e.target.value)} autoComplete="off" className="mt-1.5 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400" placeholder="Optional — stored with your profile" />
          </label>
          <div className="pt-2 sm:col-span-2">
            <Button type="submit" disabled={busy} className="w-full" icon={<Save className="size-4" />}>
              {busy ? 'Saving profile…' : 'Save and continue'}
            </Button>
          </div>
        </form>
      </Card>
      <p className="mt-3 text-center text-xs text-muted">Your academic details are used to personalise your Study Hub experience. Do not enter sensitive personal information you do not want stored.</p>
    </div>
  )
}
