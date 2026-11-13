import { useState, type FormEvent } from 'react'
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const displayName = (form.elements.namedItem('displayName') as HTMLInputElement | null)?.value.trim() ?? ''
    const email = (form.elements.namedItem('email') as HTMLInputElement | null)?.value.trim() ?? ''
    const password = (form.elements.namedItem('password') as HTMLInputElement | null)?.value ?? ''
    const faculty = (form.elements.namedItem('faculty') as HTMLInputElement | null)?.value.trim() ?? ''
    const department = (form.elements.namedItem('department') as HTMLInputElement | null)?.value.trim() ?? ''
    const level = (form.elements.namedItem('level') as HTMLInputElement | null)?.value.trim() ?? ''

    if (mode === 'signup' && !displayName) {
      toast('Please enter your name.', 'error')
      return
    }

    setBusy(true)
    try {
      if (mode === 'signup') {
        if (supabase) {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { display_name: displayName } },
          })
          if (error) throw error

          // Supabase may require email confirmation before creating a session.
          // Do not pretend hosted AI is ready until the student has confirmed.
          if (!data.session) {
            toast('Account created. Check your email to confirm it, then sign in.', 'success')
            return
          }
        }

        await saveProfile(displayName, faculty, department, level)
        toast(
          supabase ? 'Account created. Welcome.' : 'Local profile created on this device.',
          'success',
        )
      } else {
        if (!supabase) {
          throw new Error('Online sign-in is unavailable in local-only mode. Create a local profile instead.')
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error

        const existing = await db.profile.get('me')
        const metadataName =
          typeof data.user.user_metadata?.display_name === 'string'
            ? data.user.user_metadata.display_name
            : ''
        const name =
          displayName ||
          existing?.displayName ||
          metadataName ||
          data.user.email?.split('@')[0] ||
          'Student'

        if (existing) {
          await db.profile.put({
            ...existing,
            displayName: name,
            faculty: faculty || existing.faculty,
            department: department || existing.department,
            level: level || existing.level,
          })
        } else {
          await saveProfile(name, faculty, department, level)
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
        title={
          !supabase
            ? 'Create your local profile'
            : mode === 'signup'
              ? 'Create your account'
              : 'Sign in'
        }
        subtitle={
          !supabase
            ? 'Your study profile stays on this device. Online sign-in and hosted AI need Supabase configuration.'
            : mode === 'signup'
              ? 'Create an account to use the site-provided AI model.'
              : 'Sign in to continue using your account.'
        }
        back={{ to: '/', label: 'Back' }}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="p-5">
          {mode === 'signup' ? (
            <>
              <input
                id="displayName"
                name="displayName"
                placeholder="Your name"
                required
                autoComplete="name"
                className="h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400"
              />
              {supabase ? (
                <>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Email address"
                    required
                    autoComplete="email"
                    className="mt-3 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400"
                  />
                  <input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Password (at least 8 characters)"
                    minLength={8}
                    required
                    autoComplete="new-password"
                    className="mt-3 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400"
                  />
                </>
              ) : null}
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  id="faculty"
                  name="faculty"
                  placeholder="Faculty"
                  autoComplete="organization"
                  className="h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400"
                />
                <input
                  id="department"
                  name="department"
                  placeholder="Department"
                  autoComplete="organization"
                  className="h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400"
                />
                <input
                  id="level"
                  name="level"
                  placeholder="Level"
                  inputMode="numeric"
                  className="h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400"
                />
              </div>
            </>
          ) : (
            <>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="Email address"
                required
                autoComplete="email"
                className="h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400"
              />
              <input
                id="password"
                name="password"
                type="password"
                placeholder="Password"
                required
                autoComplete="current-password"
                className="mt-3 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400"
              />
              <input
                id="displayName"
                name="displayName"
                placeholder="Name (optional)"
                autoComplete="name"
                className="mt-3 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400"
              />
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  id="faculty"
                  name="faculty"
                  placeholder="Faculty"
                  autoComplete="organization"
                  className="h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400"
                />
                <input
                  id="department"
                  name="department"
                  placeholder="Department"
                  autoComplete="organization"
                  className="h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400"
                />
                <input
                  id="level"
                  name="level"
                  placeholder="Level"
                  inputMode="numeric"
                  className="h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400"
                />
              </div>
            </>
          )}

          <Button
            type="submit"
            disabled={busy}
            className="mt-4 w-full"
            icon={mode === 'signup' ? <User className="size-4" /> : <Lock className="size-4" />}
          >
            {busy ? 'Working…' : !supabase ? 'Save local profile' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </Button>

          {supabase ? (
            <p className="mt-4 text-center text-xs text-muted">
              {mode === 'signup' ? 'Already have an account?' : "Don't have an account yet?"}{' '}
              <button
                type="button"
                onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
                className="font-medium text-forest-400 underline hover:text-gold dark:text-gold"
              >
                {mode === 'signup' ? 'Sign in instead' : 'Create account'}
              </button>
            </p>
          ) : null}
        </Card>

        <div className="rounded-xl border border-line bg-surface-2/50 p-4 text-center">
          <ShieldCheck className="mx-auto mb-2 size-5 text-forest-400" />
          <h3 className="text-sm font-semibold">Private by default</h3>
          <p className="mt-1 text-[12px] text-muted">
            Your profile, documents and study trail stay in this browser. PDF text is sent to the
            configured AI provider only when you choose to generate study material.
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
