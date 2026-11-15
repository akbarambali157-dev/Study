import { registerSW } from 'virtual:pwa-register'

export type PwaInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let apply: ((reloadPage?: boolean) => Promise<void>) | null = null
let registration: ServiceWorkerRegistration | undefined
let started = false
let deferredInstallPrompt: PwaInstallPromptEvent | null = null
let updateAvailable = false
const updateListeners = new Set<(available: boolean) => void>()

function publishUpdateState(available: boolean) {
  updateAvailable = available
  for (const listener of updateListeners) listener(available)
  if (available) window.dispatchEvent(new Event('studyhub:pwa-update'))
}

export function hasPwaUpdate() { return updateAvailable }

export function subscribePwaUpdates(listener: (available: boolean) => void) {
  updateListeners.add(listener)
  listener(updateAvailable)
  return () => { updateListeners.delete(listener) }
}

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
    onNeedRefresh() { publishUpdateState(true) },
    onRegisteredSW(_url, reg) {
      registration = reg
      if (reg && reg.waiting && navigator.serviceWorker.controller) publishUpdateState(true)
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
  if (apply) { await apply(true); return }
  let worker = registration?.waiting
  if (!worker) {
    await registration?.update().catch(() => undefined)
    worker = registration?.waiting
  }
  if (!worker) throw new Error('The update is no longer waiting. Check again in a moment.')
  await new Promise<void>((resolve) => {
    navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })
    worker!.postMessage({ type: 'SKIP_WAITING' })
  })
  window.location.reload()
}
