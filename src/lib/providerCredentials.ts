import { supabase } from '@/lib/supabase'

export type ProviderCredentialStatus = {
  configured: boolean
  base_url: string | null
  updated_at?: string | null
}

async function invoke(action: string, payload: Record<string, unknown> = {}) {
  if (!supabase) throw new Error('Account-backed provider settings are unavailable.')
  const { data, error } = await supabase.functions.invoke('ai-credentials', {
    body: { action, ...payload },
  })
  if (error) throw new Error(error.message || 'Secure provider settings could not be reached.')
  if (data?.error) throw new Error(String(data.error))
  return data as Record<string, unknown>
}

export async function getProviderCredentialStatus(): Promise<ProviderCredentialStatus> {
  const data = await invoke('status')
  return {
    configured: data.configured === true,
    base_url: typeof data.base_url === 'string' ? data.base_url : null,
    updated_at: typeof data.updated_at === 'string' ? data.updated_at : null,
  }
}

export async function saveProviderCredential(key: string, baseUrl: string): Promise<void> {
  await invoke('save', { key, base_url: baseUrl })
}

export async function deleteProviderCredential(): Promise<void> {
  await invoke('delete')
}
