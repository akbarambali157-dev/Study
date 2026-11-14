import { supabase } from '@/lib/supabase'

export async function startConversation(recipientId: string): Promise<string> {
  if (!supabase) throw new Error('Messaging is unavailable because the account service is not configured.')
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw new Error('Sign in before starting a conversation.')
  if (auth.user.id === recipientId) throw new Error('You cannot message your own account.')

  const findExisting = async () => {
    const { data, error } = await supabase!.from('conversations').select('id')
      .or(`and(created_by.eq.${auth.user.id},recipient_id.eq.${recipientId}),and(created_by.eq.${recipientId},recipient_id.eq.${auth.user.id})`)
      .maybeSingle()
    if (error) throw error
    return data?.id as string | undefined
  }
  const existing = await findExisting()
  if (existing) return existing

  const { data, error } = await supabase.from('conversations')
    .insert({ created_by: auth.user.id, recipient_id: recipientId })
    .select('id').single()
  if (!error && data?.id) return data.id
  // A second tap/device may have created the unique pair concurrently.
  if (error?.code === '23505') {
    const raced = await findExisting()
    if (raced) return raced
  }
  if (error?.code === '42501') throw new Error('This student is not accepting new message requests, or a safety restriction applies.')
  throw error ?? new Error('The conversation could not be started.')
}
