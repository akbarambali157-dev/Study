import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, Check, MessageCircle, Send, ShieldAlert, UserRound } from 'lucide-react'
import { PageHeading } from '@/components/PageShell'
import { Button } from '@/components/ui/Button'
import { Card, Chip } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { supabase } from '@/lib/supabase'

type Membership = { conversation_id: string; status: 'pending' | 'accepted'; member_role: 'sender' | 'recipient'; last_read_at: string | null; display_name: string }
type Conversation = { id: string; created_by: string; recipient_id: string; updated_at: string; last_message_at: string | null }
type Student = { user_id: string; display_name: string; institution: string; department: string; level: string }
type Message = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string; edited_at: string | null; deleted_at: string | null }
type InboxItem = { conversation: Conversation; membership: Membership; student: Student; latest?: Message; unread: boolean }

export function MessagesPage() {
  const { id: selectedId } = useParams()
  const navigate = useNavigate()
  const [userId, setUserId] = useState<string | null>(null)
  const [inbox, setInbox] = useState<InboxItem[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const loadInbox = useCallback(async () => {
    if (!supabase) { setError('Messaging is not connected.'); setLoading(false); return }
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (authError || !auth.user) { setUserId(null); setInbox([]); setLoading(false); return }
      const uid = auth.user.id
      setUserId(uid)
      const { data: memberRows, error: memberError } = await supabase.from('conversation_members')
        .select('conversation_id,status,member_role,last_read_at,display_name')
        .eq('user_id', uid).order('joined_at', { ascending: false }).limit(50)
      if (memberError) throw memberError
      const memberships = (memberRows ?? []) as Membership[]
      const ids = memberships.map((item) => item.conversation_id)
      if (!ids.length) { setInbox([]); setLoading(false); return }
      const [{ data: conversations, error: conversationsError }, { data: messageRows, error: messagesError }, { data: blockRows, error: blockError }] = await Promise.all([
        supabase.from('conversations').select('id,created_by,recipient_id,updated_at,last_message_at').in('id', ids).order('updated_at', { ascending: false }),
        supabase.from('messages').select('id,conversation_id,sender_id,body,created_at,edited_at,deleted_at').in('conversation_id', ids).order('created_at', { ascending: false }).limit(150),
        supabase.from('user_blocks').select('blocked_id').eq('blocker_id', uid),
      ])
      if (conversationsError) throw conversationsError
      if (messagesError) throw messagesError
      if (blockError) throw blockError
      const blockedIds = new Set((blockRows ?? []).map((row) => row.blocked_id as string))
      const conversationRows = (conversations ?? []) as Conversation[]
      const peerIds = [...new Set(conversationRows.map((item) => item.created_by === uid ? item.recipient_id : item.created_by))]
      const { data: profiles, error: profileError } = await supabase.from('student_profiles')
        .select('user_id,display_name,institution,department,level').in('user_id', peerIds)
      if (profileError) throw profileError
      const profileMap = new Map(((profiles ?? []) as Student[]).map((item) => [item.user_id, item]))
      const membershipMap = new Map(memberships.map((item) => [item.conversation_id, item]))
      const latestMap = new Map<string, Message>()
      for (const message of (messageRows ?? []) as Message[]) if (!latestMap.has(message.conversation_id)) latestMap.set(message.conversation_id, message)
      setInbox(conversationRows.flatMap((conversation) => {
        const membership = membershipMap.get(conversation.id)
        const peerId = conversation.created_by === uid ? conversation.recipient_id : conversation.created_by
        if (!membership || blockedIds.has(peerId)) return []
        const student = profileMap.get(peerId) ?? { user_id: peerId, display_name: membership.display_name || 'Student', institution: '', department: '', level: '' }
        const latest = latestMap.get(conversation.id)
        return [{ conversation, membership, student, latest, unread: Boolean(latest && latest.sender_id !== uid && (!membership.last_read_at || latest.created_at > membership.last_read_at)) }]
      }))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your inbox could not be loaded.')
    } finally { setLoading(false) }
  }, [])

  const loadMessages = useCallback(async (conversationId: string) => {
    if (!supabase) return
    setLoadingMessages(true)
    try {
      const { data, error: loadError } = await supabase.from('messages')
        .select('id,conversation_id,sender_id,body,created_at,edited_at,deleted_at')
        .eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(100)
      if (loadError) throw loadError
      const rows = ((data ?? []) as Message[]).reverse()
      setMessages(rows)
      if (userId) await supabase.from('conversation_members').update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId).eq('user_id', userId)
      void loadInbox()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Messages could not be loaded.', 'error')
    } finally { setLoadingMessages(false) }
  }, [userId, loadInbox])

  useEffect(() => { void loadInbox() }, [loadInbox])
  useEffect(() => {
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUserId(null); setInbox([]); setMessages([]); setDraft('')
      } else {
        void Promise.resolve().then(() => loadInbox())
      }
    })
    return () => data.subscription.unsubscribe()
  }, [loadInbox])
  useEffect(() => {
    if (!userId || !supabase) { setMessages([]); return }
    if (!selectedId) {
      const inboxPoll = window.setInterval(() => { void loadInbox() }, 10000)
      return () => window.clearInterval(inboxPoll)
    }
    void loadMessages(selectedId)
    let pollId: number | undefined
    const startPolling = () => {
      if (pollId !== undefined) return
      pollId = window.setInterval(() => {
        void loadMessages(selectedId)
      }, 7000)
    }
    const stopPolling = () => {
      if (pollId !== undefined) window.clearInterval(pollId)
      pollId = undefined
    }
    const channel = supabase.channel(`messages:${selectedId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedId}` }, () => {
        void loadMessages(selectedId)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members', filter: `user_id=eq.${userId}` }, () => {
        void loadInbox()
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') stopPolling()
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') startPolling()
      })
    return () => {
      stopPolling()
      void supabase?.removeChannel(channel)
    }
  }, [selectedId, userId, loadInbox, loadMessages])

  const selected = useMemo(() => inbox.find((item) => item.conversation.id === selectedId), [inbox, selectedId])

  const send = async (event: FormEvent) => {
    event.preventDefault()
    const body = draft.trim()
    if (!supabase || !selectedId || !userId || !body || sending) return
    if (!navigator.onLine) { toast('You are offline. Your message has not been sent.', 'info'); return }
    setSending(true)
    try {
      const { error: sendError } = await supabase.from('messages').insert({ conversation_id: selectedId, sender_id: userId, body })
      if (sendError) throw sendError
      setDraft('')
      await loadMessages(selectedId)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Message could not be sent. Your draft is still here.', 'error')
    } finally { setSending(false) }
  }

  const acceptRequest = async () => {
    if (!supabase || !selectedId || !userId) return
    const { error: acceptError } = await supabase.from('conversation_members').update({ status: 'accepted', last_read_at: new Date().toISOString() })
      .eq('conversation_id', selectedId).eq('user_id', userId)
    if (acceptError) { toast(acceptError.message, 'error'); return }
    toast('Message request accepted.', 'success')
    await loadInbox()
  }

  if (!supabase) return <div className="mx-auto max-w-4xl"><PageHeading title="Messages" /><Card className="p-5">Messaging needs an account connection.</Card></div>
  if (!userId && !loading) return <div className="mx-auto max-w-4xl"><PageHeading title="Messages" /><Card className="p-5"><p className="text-sm text-muted">Sign in to send and receive private messages.</p><Button className="mt-3" onClick={() => navigate('/auth')}>Sign in</Button></Card></div>

  if (selectedId) return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center gap-3"><Button size="sm" variant="secondary" onClick={() => navigate('/messages')} icon={<ArrowLeft className="size-4" />}>Inbox</Button><div className="min-w-0 flex-1"><h1 className="truncate text-xl font-semibold">{selected?.student.display_name ?? 'Conversation'}</h1><p className="text-xs text-muted">{selected ? [selected.student.department, selected.student.level ? `Level ${selected.student.level}` : ''].filter(Boolean).join(' · ') : 'Loading conversation…'}</p></div>{selected && userId ? <><Button size="sm" variant="ghost" onClick={async () => { if (!supabase || !window.confirm(`Block ${selected.student.display_name}? This will prevent messages in either direction.`)) return; const { error } = await supabase.from('user_blocks').insert({ blocker_id: userId, blocked_id: selected.student.user_id }); if (error) toast(error.message, 'error'); else { toast('Student blocked.', 'success'); navigate('/messages'); void loadInbox() } }} icon={<Ban className="size-3.5" />}>Block</Button><Button size="sm" variant="ghost" onClick={async () => { if (!supabase) return; const reason = window.prompt('Why are you reporting this account?'); if (!reason?.trim()) return; const { error } = await supabase.from('user_reports').insert({ reporter_id: userId, target_user_id: selected.student.user_id, conversation_id: selected.conversation.id, reason: reason.trim().slice(0,500) }); if (error) toast(error.message, 'error'); else toast('Report submitted for review.', 'success') }} icon={<ShieldAlert className="size-3.5" />}>Report</Button></> : null}</div>
      {!selected && !loading ? <Card className="p-5"><p className="text-sm text-muted">This conversation is unavailable or you do not have access.</p></Card> : null}
      {selected ? <Card className="overflow-hidden p-0">
        {selected.membership.status === 'pending' && selected.membership.member_role === 'recipient' ? <div className="border-b border-line bg-amber-500/10 p-4"><p className="text-sm font-semibold">Message request</p><p className="mt-1 text-xs text-muted">Accept this request before replying. You can block the sender if you do not want further contact.</p><Button size="sm" className="mt-3" onClick={() => void acceptRequest()} icon={<Check className="size-4" />}>Accept request</Button></div> : null}
        <div className="flex min-h-[48vh] max-h-[65vh] flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
          {loadingMessages ? <p className="text-sm text-muted">Loading messages…</p> : messages.length === 0 ? <p className="m-auto text-sm text-muted">This is the beginning of the conversation.</p> : messages.map((message) => <div key={message.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${message.sender_id === userId ? 'ml-auto bg-forest text-white' : 'mr-auto bg-surface-2 text-body'}`}><p className="whitespace-pre-wrap break-words">{message.deleted_at ? 'This message was removed.' : message.body}</p><p className={`mt-1 text-[10px] ${message.sender_id === userId ? 'text-white/65' : 'text-muted'}`}>{new Date(message.created_at).toLocaleString()}</p></div>)}
        </div>
        {selected.membership.status === 'accepted' ? <form onSubmit={send} className="flex gap-2 border-t border-line p-3"><input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4000} placeholder="Write a message…" className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-app px-3 text-sm" /><Button type="submit" disabled={sending || !draft.trim() || !navigator.onLine} aria-label="Send message" icon={<Send className="size-4" />}>{sending ? 'Sending…' : 'Send'}</Button></form> : null}
      </Card> : null}
    </div>
  )

  return <div className="mx-auto max-w-4xl"><PageHeading title="Messages" subtitle="Private conversations and message requests." />{error ? <Card className="mb-3 p-4 text-sm text-rose-600">{error}</Card> : null}{loading ? <Card className="p-5 text-sm text-muted">Loading your inbox…</Card> : inbox.length === 0 ? <Card className="p-8 text-center"><MessageCircle className="mx-auto size-8 text-muted" /><h2 className="mt-3 font-semibold">Your inbox is quiet</h2><p className="mt-1 text-sm text-muted">You can start a conversation from a student's public academic profile.</p><Link className="mt-4 inline-flex text-sm font-semibold text-forest underline dark:text-gold" to="/students">Discover students</Link></Card> : <div className="space-y-2">{inbox.map((item) => <button key={item.conversation.id} type="button" onClick={() => navigate(`/messages/${item.conversation.id}`)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition hover:border-forest/40"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-forest/10 text-forest dark:text-gold"><UserRound className="size-5" /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><strong className="truncate text-sm">{item.student.display_name}</strong>{item.membership.status === 'pending' && item.membership.member_role === 'recipient' ? <Chip tone="gold">Request</Chip> : null}{item.unread ? <Chip tone="green">Unread</Chip> : null}</span><span className="mt-1 block truncate text-xs text-muted">{item.latest?.deleted_at ? 'Message removed' : item.latest?.body ?? 'No messages yet'}</span></span><span className="shrink-0 text-[10px] text-muted">{item.latest ? new Date(item.latest.created_at).toLocaleDateString() : ''}</span></button>)}</div>}</div>
}
