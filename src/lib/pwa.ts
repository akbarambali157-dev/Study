import { registerSW } from 'virtual:pwa-register'

export type PwaInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let apply: ((reloadPage?: boolean) => Promise<void>) | null = null
let registration: ServiceWorkerRegistration | undefined
let started = false
let deferredInstallPrompt: PwaInstallPromptEvent | null = null

function check() {
  if (document.visibilityState === 'visible') void registration?.update().catch(() => undefined)
}

export function getDeferredInstallPrompt() {
  return deferredInstallPrompt
}

export function clearDeferredInstallPrompt() {
  deferredInstallPrompt = null
}

export function registerPwaUpdates() {
  if (started || typeof window === 'undefined') return
  started = true
  window.addEventListener('beforeinstallprompt', (event: Event) => {
    event.preventDefault()
    deferredInstallPrompt = event as PwaInstallPromptEvent
    window.dispatchEvent(new Event('studyhub:install-prompt'))
  })
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null
    window.dispatchEvent(new Event('studyhub:app-installed'))
  })
  apply = registerSW({
    immediate: true,
    onNeedRefresh() { window.dispatchEvent(new Event('studyhub:pwa-update')) },
    onRegisteredSW(_url, reg) {
      registration = reg
      window.addEventListener('focus', check)
      document.addEventListener('visibilitychange', check)
      check()
    },
  })
}

export function checkForPwaUpdate() {
  check()
}

export async function applyPwaUpdate() {
  await apply?.(true)
}
