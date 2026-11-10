import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. These are public, non-secret values safe to ship in the bundle.',
  )
}

/**
 * Supabase client for auth + Edge Function calls.
 *
 * VITE_* variables are intentional here: the Supabase URL and anon key are
 * public by design. The brewkeg.dev API key stays server-side in the Edge
 * Function and never becomes a VITE variable.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Full URL of the ai-proxy Edge Function, e.g.
 * https://<project-ref>.supabase.co/functions/v1/ai-proxy
 */
export function aiProxyUrl(): string {
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/ai-proxy`
}
