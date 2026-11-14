import { supabase } from './supabase'

export async function getVapidPublicKey(): Promise<string> {
  if (!supabase) throw new Error('Push notifications need an account connection.')
  const { data, error } = await supabase.functions.invoke('push-dispatch', { body: { action: 'public-key' } })
  if (error || typeof data?.publicKey !== 'string' || !data.publicKey) {
    throw new Error('The server could not provide the public push key.')
  }
  return data.publicKey
}

export function supportsWebPush(): boolean {
  return typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
}

function decodeApplicationServerKey(value: string): Uint8Array {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

/** Must be called from a direct user action because the browser may prompt for permission. */
export async function registerCurrentDeviceForPush(applicationServerKey: string): Promise<PushSubscription> {
  if (!supportsWebPush()) throw new Error('This browser does not support Web Push.')
  if (!applicationServerKey.trim()) throw new Error('The public VAPID key is not configured.')
  let permission = Notification.permission
  if (permission !== 'granted') permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was not granted.')
  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  return existing ?? registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeApplicationServerKey(applicationServerKey) as BufferSource,
  })
}

export async function getCurrentDevicePushEndpoint(): Promise<string | null> {
  if (!supportsWebPush()) return null
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  return subscription?.endpoint ?? null
}

export async function removeCurrentDevicePushSubscription(): Promise<string | null> {
  if (!supportsWebPush()) return null
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return null
  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  return endpoint
}
