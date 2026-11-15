import { getAuthenticatedUser, supabase } from '@/lib/supabase'

export async function startConversation(recipientId: string): Promise<string> {
  if (!supabase) throw new Error('Messaging is unavailable because the account service is not configured.')
  const user = await getAuthenticatedUser()
  if (!user) throw new Error('Sign in before starting a conversation.')
  if (user.id === recipientId) throw new Error('You cannot message your own account.')

  // Existing conversations remain accessible even if the recipient later
  // changes their preference for NEW message requests.
  const { data: existing, error: lookupError } = await supabase
    .from('conversations')
    .select('id')
    .or(`and(created_by.eq.${user.id},recipient_id.eq.${recipientId}),and(created_by.eq.${recipientId},recipient_id.eq.${user.id})`)
    .maybeSingle()
  if (lookupError) throw lookupError
  if (existing?.id) return existing.id as string

  // Conversation creation is performed by one database RPC so the recipient
  // preference, discoverability, block checks, unique-pair handling and member
  // creation are evaluated atomically. This avoids exposing a half-created
  // conversation to the client and keeps the RLS policy as defence in depth.
  const { data, error } = await supabase.rpc('start_direct_conversation', {
    p_recipient_id: recipientId,
  })

  if (error) {
    if (error.code === '42501') {
      throw new Error(error.message || 'This student is not accepting new message requests, or a safety restriction applies.')
    }
    if (error.code === '28000') {
      throw new Error('Your sign-in session has expired. Sign in again before messaging.')
    }
    throw error
  }

  if (typeof data !== 'string' || !data) {
    throw new Error('The conversation could not be started. Please refresh and try again.')
  }
  return data
}
