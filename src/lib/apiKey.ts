/**
 * The Anthropic API key never leaves this browser and is never sent anywhere
 * except api.anthropic.com.
 *
 * Default storage is sessionStorage: it dies with the tab, so a shared lab
 * machine does not keep a usable key. "Remember on this device" upgrades it to
 * localStorage, which the student opts into explicitly.
 */

const SESSION_KEY = 'oou.anthropic.key.session'
const LOCAL_KEY = 'oou.anthropic.key.local'

function read(store: Storage | undefined, key: string): string | null {
  try {
    return store?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function getApiKey(): string | null {
  if (typeof window === 'undefined') return null
  const fromSession = read(window.sessionStorage, SESSION_KEY)
  if (fromSession) return fromSession
  const fromLocal = read(window.localStorage, LOCAL_KEY)
  if (fromLocal) {
    // Promote it into the session so a single accessor sees one value.
    try {
      window.sessionStorage.setItem(SESSION_KEY, fromLocal)
    } catch {
      /* private mode — session read still works via localStorage above */
    }
    return fromLocal
  }
  return null
}

export function hasApiKey(): boolean {
  return Boolean(getApiKey())
}

export function saveApiKey(rawKey: string, persist: boolean): void {
  const key = rawKey.trim()
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(SESSION_KEY, key)
    if (persist) window.localStorage.setItem(LOCAL_KEY, key)
    else window.localStorage.removeItem(LOCAL_KEY)
  } catch {
    /* storage unavailable; the key simply won't survive a reload */
  }
}

export function clearApiKey(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(SESSION_KEY)
    window.localStorage.removeItem(LOCAL_KEY)
  } catch {
    /* nothing to clear */
  }
}

export function isPersisted(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(read(window.localStorage, LOCAL_KEY))
}

/** Sk-ant-abcd…wxyz — enough to recognise, not enough to use. */
export function maskKey(key: string): string {
  if (key.length <= 12) return '••••'
  return `${key.slice(0, 7)}…${key.slice(-4)}`
}

/**
 * Cheap shape check only. We deliberately do not "validate" a key by calling
 * the API (that would spend the student's tokens on a typing check), and we
 * never log it.
 *
 * Both accepted shapes matter: an Anthropic key goes in x-api-key, while a
 * gateway or reseller token is an opaque string sent as a bearer token. The
 * check is only here to catch a pasted password or a half-copied line.
 */
export function looksLikeApiKey(key: string): boolean {
  const trimmed = key.trim()
  if (trimmed.length < 24 || trimmed.includes(' ')) return false
  if (trimmed.startsWith('sk-ant-')) return true
  return /^[A-Za-z0-9._~+/=-]+$/.test(trimmed)
}

/** Whether the selected AI payment mode has its required client configuration. */
export function hasAiAccess(useProxy: boolean): boolean {
  if (!useProxy) return hasApiKey()
  return Boolean(
    (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() &&
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim(),
  )
}
