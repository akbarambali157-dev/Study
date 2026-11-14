/** BYOK secrets are stored in Supabase Vault and are never persisted in browser storage. */
export function looksLikeApiKey(key: string): boolean {
  const trimmed = key.trim()
  if (trimmed.length < 24 || trimmed.length > 500 || /\s/.test(trimmed)) return false
  return /^[A-Za-z0-9._~+/=-]+$/.test(trimmed)
}

/** Both hosted and private account-backed AI modes require Supabase auth. */
export function hasAiAccess(_useProxy: boolean): boolean {
  return Boolean(
    (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() &&
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim(),
  )
}
