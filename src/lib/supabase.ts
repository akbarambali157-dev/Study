import { createClient, type User } from '@supabase/supabase-js'

export const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? ''
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? ''

/** Supabase is optional for local study data; account-backed hosted AI and Vault-backed BYOK require it. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/** Null in local-only mode; callers must handle that state explicitly. */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { flowType: 'pkce' } })
  : null

/** Full URL of the ai-proxy Edge Function. */
export function aiProxyUrl(): string {
  if (!isSupabaseConfigured) {
    throw new Error('Hosted AI is not configured. Add the Supabase URL and anon key, or use your own API key.')
  }
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/ai-proxy`
}

/** Full URL of the authenticated BYOK Edge Function. */
export function byokProxyUrl(): string {
  if (!isSupabaseConfigured) throw new Error('Secure personal-key mode needs a signed-in Study Hub account.')
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/byok-proxy`
}


/** Wait for supabase-js to restore the persisted browser session before checking identity. */
let authInitialization: Promise<void> | null = null
export async function waitForAuthInitialization(): Promise<void> {
  if (!supabase) return
  if (!authInitialization) {
    authInitialization = new Promise<void>((resolve) => {
      let unsubscribe = () => undefined
      let initialized = false
      const { data } = supabase!.auth.onAuthStateChange((event) => {
        if (event !== 'INITIAL_SESSION') return
        initialized = true
        unsubscribe()
        resolve()
      })
      unsubscribe = () => data.subscription.unsubscribe()
      if (initialized) unsubscribe()
    })
  }
  await authInitialization
}

/** Use the restored local session first, then verify identity with Auth while online. */
export async function getAuthenticatedUser(): Promise<User | null> {
  if (!supabase) return null
  await waitForAuthInitialization()
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  const session = sessionData.session
  if (!session) return null
  if (typeof navigator !== 'undefined' && !navigator.onLine) return session.user
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data.user
}
