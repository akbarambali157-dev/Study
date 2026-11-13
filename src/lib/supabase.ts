import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? ''
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? ''

/** Supabase is optional: BYOK + IndexedDB mode must boot without it. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/** Null in local-only mode; callers must handle that state explicitly. */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

/** Full URL of the ai-proxy Edge Function. */
export function aiProxyUrl(): string {
  if (!isSupabaseConfigured) {
    throw new Error('Hosted AI is not configured. Add the Supabase URL and anon key, or use your own API key.')
  }
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/ai-proxy`
}
