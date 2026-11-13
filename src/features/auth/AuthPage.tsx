import { useEffect, useState, type FormEvent } from 'react'
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
  const [mode, setMode] = useState<'signup' | 'signin' | 'reset'>('signup')
  const [busy, setBusy] = useState(false)

  // OAuth returns to this hash route with a PKCE code in the query string.
  // Supabase exchanges it during getSession(); create a local profile once.
  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active || error) return
      if (window.location.hash.includes('mode=reset')) {
        setMode('reset')
        return
      }
      if (!data.session) return
      const existing = await db.profile.get('me')
      if (!active) return
      if (existing) {
        navigate('/')
        return
      }
      const metadataName =
        typeof data.session.user.user_metadata?.full_name === 'string'
          ? data.session.user.user_metadata.full_name
          : typeof data.session.user.user_metadata?.name === 'string'
            ? data.session.user.user_metadata.name
            : data.session.user.email?.split('@')[0] ?? 'Student'
      await saveProfile(metadataName, '', '', '')
      if (active) navigate('/')
    }).catch(() => {
      // Normal email/password flows can briefly have no OAuth callback to process.
    })
    return () => { active = false }
  }, [navigate])

  const signInWithGoogle = async () => {
    if (!supabase) return
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}${window.location.pathname}#/auth` },
      })
      if (error) throw error
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google sign-in could not start.'
      toast(message, 'error')
      setBusy(false)
    }
  }

  const sendPasswordReset = async () => {
    if (!supabase) return
    const email = (document.getElementById('email') as HTMLInputElement | null)?.value.trim() ?? ''
    if (!email) {
      toast('Enter your email address first.', 'error')
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${window.location.pathname}#/auth?mode=reset`,
      })
      if (error) throw error
      toast('Password reset email sent. Follow its link to choose a new password.', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Password reset could not be started.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const displayName = (form.elements.namedItem('displayName') as HTMLInputElement | null)?.value.trim() ?? ''
    const email = (form.elements.namedItem('email') as HTMLInputElement | null)?.value.trim() ?? ''
    const password = (form.elements.namedItem('password') as HTMLInputElement | null)?.value ?? ''
    const passwordConfirm = (form.elements.namedItem('passwordConfirm') as HTMLInputElement | null)?.value ?? ''
    const faculty = (form.elements.namedItem('faculty') as HTMLInputElement | null)?.value.trim() ?? ''
    const department = (form.elements.namedItem('department') as HTMLInputElement | null)?.value.trim() ?? ''
    const level = (form.elements.namedItem('level') as HTMLInputElement | null)?.value.trim() ?? ''

    if (mode === 'signup' && !displayName) {
      toast('Please enter your name.', 'error')
      return
    }

    setBusy(true)
    try {
      if (mode === 'reset') {
        if (!supabase) throw new Error('Password reset is unavailable in local-only mode.')
        if (password.length < 8) throw new Error('Use a password with at least 8 characters.')
        if (password !== passwordConfirm) throw new Error('The passwords do not match.')
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        await supabase.auth.signOut()
        setMode('signin')
        toast('Password updated. Sign in with your new password.', 'success')
        return
      }

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
    <div className="mx-auto max-w-md py-2 sm:py-6">
      <PageHeading
        title={
          !supabase
            ? 'Create your local profile'
            : mode === 'signup'
              ? 'Create your account'
              : mode === 'reset'
                ? 'Set a new password'
                : 'Sign in'
        }
        subtitle={
          !supabase
            ? 'Your study profile stays on this device. Online sign-in and hosted AI need Supabase configuration.'
            : mode === 'signup'
              ? 'Create an account to use the site-provided AI model.'
              : mode === 'reset'
                ? 'Choose a new password for your Study Hub account.'
                : 'Sign in to continue using your account.'
        }
        back={{ to: '/', label: 'Back' }}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="p-5 shadow-lg shadow-forest/5 sm:p-6">
          {supabase && mode !== 'reset' ? (
            <>
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                disabled={busy}
                className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-body shadow-sm transition hover:border-forest-400/60 hover:bg-surface-2 disabled:cursor-wait disabled:opacity-60"
              >
                <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5">
                  <path fill="#FFC107" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z"/>
                  <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"/>
                  <path fill="#4A90E2" d="M12.6 27.7a12 12 0 0 1 0-7.4V15H5.8a20 20 0 0 0 0 18l6.8-5.3Z"/>
                  <path fill="#EA4335" d="M24 11.9c3 0 5.7 1 7.8 3.1l5.9-5.9C34.1 5.8 29.5 4 24 4A20 20 0 0 0 5.8 15l6.8 5.3c1.6-4.8 6.1-8.4 11.4-8.4Z"/>
                </svg>
                Continue with Google
              </button>
              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-line" />
                <span className="text-[10px] font-semibold uppercase tracking-[.18em] text-muted">or use email</span>
                <span className="h-px flex-1 bg-line" />
              </div>
            </>
          ) : null}
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
          ) : mode === 'reset' ? (
            <>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="New password (at least 8 characters)"
                minLength={8}
                required
                autoComplete="new-password"
                className="h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400"
              />
              <input
                id="passwordConfirm"
                name="passwordConfirm"
                type="password"
                placeholder="Confirm new password"
                minLength={8}
                required
                autoComplete="new-password"
                className="mt-3 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400"
              />
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
            {busy ? 'Working…' : !supabase ? 'Save local profile' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Update password' : 'Sign in'}
          </Button>

          {supabase && mode !== 'reset' ? (
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
          {supabase && mode === 'signin' ? (
            <button type="button" onClick={() => void sendPasswordReset()} disabled={busy} className="mt-3 w-full text-center text-xs font-medium text-forest-400 underline hover:text-gold dark:text-gold">
              Forgot password?
            </button>
          ) : null}
          {supabase && mode === 'reset' ? (
            <button type="button" onClick={() => setMode('signin')} className="mt-3 w-full text-center text-xs font-medium text-forest-400 underline hover:text-gold dark:text-gold">
              Back to sign in
            </button>
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
