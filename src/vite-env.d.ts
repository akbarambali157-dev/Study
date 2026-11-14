/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_DATA_BACKEND?: 'local' | 'supabase'
  /** Anthropic, or an Anthropic-compatible gateway. A URL, never a key. */
  readonly VITE_AI_BASE_URL?: string
  /** Public VAPID application-server key; never a private signing key. */
  readonly VITE_VAPID_PUBLIC_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __APP_VERSION__: string
declare const __BUILD_ID__: string
