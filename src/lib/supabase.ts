import { createClient } from '@supabase/supabase-js'

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
