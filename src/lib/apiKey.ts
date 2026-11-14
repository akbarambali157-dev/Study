/** BYOK secrets are stored in Supabase Vault and are never persisted in browser storage. */
if (typeof window !== 'undefined') {
  try {
    window.sessionStorage.removeItem('oou.anthropic.key.session')
    window.localStorage.removeItem('oou.anthropic.key.local')
  } catch {
    // Storage may be unavailable in private browsing; no key is read or written.
  }
}
export function looksLikeApiKey(key: string): boolean {
  const trimmed = key.trim()
  if (trimmed.length < 24 || trimmed.length > 500 || /\s/.test(trimmed)) return false
  return /^[A-Za-z0-9._~+/=-]+$/.test(trimmed) && (trimmed.startsWith('sk-ant-') || trimmed.startsWith('bk_live_'))
}

/** Both hosted and private account-backed AI modes require Supabase auth. */
export function hasAiAccess(_useProxy: boolean): boolean {
  return Boolean(
    (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() &&
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim(),
  )
}
