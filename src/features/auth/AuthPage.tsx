import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, ShieldCheck, User } from 'lucide-react'
import { PageHeading } from '@/components/PageShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { nowIso } from '@/lib/utils'

export function AuthPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signup' | 'signin'>('signup')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    const displayName = (form.elements.namedItem('displayName') as HTMLInputElement | null)?.value.trim() ?? ''
    const email = (form.elements.namedItem('email') as HTMLInputElement | null)?.value.trim() ?? ''
    const password = (form.elements.namedItem('password') as HTMLInputElement | null)?.value.trim() ?? ''
    const faculty = (form.elements.namedItem('faculty') as HTMLInputElement | null)?.value.trim() ?? ''
    const department = (form.elements.namedItem('department') as HTMLInputElement | null)?.value.trim() ?? ''
    const level = (form.elements.namedItem('level') as HTMLInputElement | null)?.value.trim() ?? ''

    if (!displayName) {
      toast('Please enter your name.', 'error')
      return
    }

    setBusy(true)
    try {
      if (mode === 'signup') {
        if (supabase) {
          const { error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName } } })
          if (error) throw error
        }
        await saveProfile(displayName, faculty, department, level)
        toast('Account created. Welcome.', 'success')
      } else {
        if (supabase) {
          const { error } = await supabase.auth.signInWithPassword({ email, password })
          if (error) throw error
        }
        const existing = await db.profile.get('me')
        if (existing) {
          await db.profile.put({ ...existing, displayName, faculty, department, level })
        } else {
          await saveProfile(displayName, faculty, department, level)
        }
        toast('Welcome back.', 'success')
      }
      navigate('/')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      toast(message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <PageHeading
        title={mode === 'signup' ? 'Create your account' : 'Sign in'}
        subtitle={
          mode === 'signup'
            ? 'Tell us a little about yourself so your study records feel like yours.'
            : 'Sign in to your existing account.'
        }
        back={{ to: '/', label: 'Back' }}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="p-5">
          {mode === 'signup' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <input
                  id="displayName"
                  name="displayName"
                  placeholder="e.g. Adeola Adebayo"
                  required
                  autoComplete="name"
                  className="h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400"
                />
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@student.oouagoiwonyi.edu.ng"
                  required
                  autoComplete="email"
                  disabled={!supabase}
                  className="h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400"
                />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                minLength={8}
                required
                autoComplete="new-password"
                disabled={!supabase}
                className="h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400 mt-3"
              />
              <div className="grid grid-cols-3 gap-4 mt-4">
                <input
                  id="faculty"
                  name="faculty"
                  placeholder="e.g. Science"
                  autoComplete="organization"
                  className="h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400"
                />
                <input
                  id="department"
                  name="department"
                  placeholder="e.g. Computer Science"
                  autoComplete="organization"
                  className="h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400"
                />
                <input
                  id="level"
                  name="level"
                  placeholder="e.g. 200"
                  autoComplete="organization"
                  className="h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400"
                />
              </div>
              <p className="mt-3 text-[12px] text-muted">
                Your details are stored in this browser only. There is no server to share them with.
              </p>
            </>
          ) : (
            <>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@student.oouagoiwonyi.edu.ng"
                required
                autoComplete="email"
                disabled={!supabase}
                className="h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400"
              />
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                disabled={!supabase}
                className="h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400 mt-3"
              />
              <div className="mt-2 grid grid-cols-2 gap-4">
                <input
                  id="displayName"
                  name="displayName"
                  placeholder="e.g. Adeola Adebayo"
                  required
                  autoComplete="name"
                  className="h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400"
                />
                <input
                  id="faculty"
                  name="faculty"
                  placeholder="e.g. Science"
                  autoComplete="organization"
                  className="h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <input
                  id="department"
                  name="department"
                  placeholder="e.g. Computer Science"
                  autoComplete="organization"
                  className="h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400"
                />
                <input
                  id="level"
                  name="level"
                  placeholder="e.g. 200"
                  autoComplete="organization"
                  className="h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400"
                />
              </div>
            </>
          )}
          <Button type="submit" disabled={busy} className="w-full" icon={mode === 'signup' ? <User className="size-4" /> : <Lock className="size-4" />}>
            {busy ? 'Working…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </Button>
          <p className="mt-4 text-center text-xs text-muted">
            {mode === 'signup'
              ? 'Already have an account?'
              : "Don't have an account yet?"}
            <button
              type="button"
              onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
              className="text-forest-400 font-medium underline hover:text-gold dark:text-gold"
            >
              {mode === 'signup' ? 'Sign in instead' : 'Create account'}
            </button>
          </p>
        </Card>

        <div className="mt-6 rounded-xl border border-line bg-surface-2/50 p-4 text-center">
          <ShieldCheck className="mx-auto size-5 mb-2 text-forest-400" />
          <h3 className="text-sm font-semibold">Private by default</h3>
          <p className="mt-1 text-[12px] text-muted">
            Your profile, documents and study trail stay in this browser. Nothing is uploaded to a
            server unless you explicitly use a share link.
          </p>
        </div>
      </form>
    </div>
  )
}

async function saveProfile(
  displayName: string,
  faculty: string,
  department: string,
  level: string,
) {
  const existing = await db.profile.get('me')
  const now = nowIso()
  if (existing) {
    await db.profile.put({
      ...existing,
      displayName,
      faculty: faculty || undefined,
      department: department || undefined,
      level: level || undefined,
    })
  } else {
    await db.profile.put({
      id: 'me',
      displayName,
      faculty: faculty || undefined,
      department: department || undefined,
      level: level || undefined,
      xp: 0,
      streakDays: 0,
      lastActive: now,
    })
  }
}
