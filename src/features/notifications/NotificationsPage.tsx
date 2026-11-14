import { useCallback, useEffect, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeading } from '@/components/PageShell'
import { Button } from '@/components/ui/Button'
import { Card, Chip } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { supabase } from '@/lib/supabase'

type NotificationRow = { id: string; notification_type: string; title: string; body: string; target_path: string; created_at: string; read_at: string | null }

export function NotificationsPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth.user?.id ?? null
    setUserId(uid)
    if (!uid) { setRows([]); setLoading(false); return }
    const { data, error } = await supabase.from('notifications').select('id,notification_type,title,body,target_path,created_at,read_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(50)
    if (error) toast(error.message, 'error')
    else setRows((data ?? []) as NotificationRow[])
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!userId || !supabase) return
    const channel = supabase.channel(`notifications:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
        setRows((current) => [payload.new as NotificationRow, ...current].slice(0, 50))
      }).subscribe()
    return () => { void supabase?.removeChannel(channel) }
  }, [userId])
  const markRead = async (row: NotificationRow) => {
    if (!supabase || !userId || row.read_at) return
    const now = new Date().toISOString()
    const { error } = await supabase.from('notifications').update({ read_at: now }).eq('id', row.id).eq('user_id', userId)
    if (error) toast(error.message, 'error')
    else setRows((current) => current.map((item) => item.id === row.id ? { ...item, read_at: now } : item))
  }
  const markAll = async () => {
    if (!supabase || !userId) return
    const now = new Date().toISOString()
    const { error } = await supabase.from('notifications').update({ read_at: now }).eq('user_id', userId).is('read_at', null)
    if (error) toast(error.message, 'error')
    else setRows((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? now })))
  }
  return <div className="mx-auto max-w-3xl"><div className="flex items-start justify-between gap-3"><PageHeading title="Notifications" subtitle="Replies, messages and important activity." />{rows.some((row) => !row.read_at) ? <Button size="sm" variant="secondary" onClick={() => void markAll()} icon={<CheckCheck className="size-4" />}>Mark all read</Button> : null}</div>{loading ? <Card className="p-5 text-sm text-muted">Loading notifications…</Card> : rows.length === 0 ? <Card className="p-8 text-center"><Bell className="mx-auto size-8 text-muted" /><h2 className="mt-3 font-semibold">You're all caught up</h2><p className="mt-1 text-sm text-muted">New activity will appear here.</p></Card> : <div className="space-y-2">{rows.map((row) => <button key={row.id} type="button" onClick={() => { void markRead(row); navigate(row.target_path.startsWith('/') ? row.target_path : '/') }} className={`w-full rounded-2xl border p-4 text-left transition ${row.read_at ? 'border-line bg-surface' : 'border-forest/30 bg-forest/5'}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold">{row.title}</p><p className="mt-1 text-sm text-muted">{row.body}</p><p className="mt-2 text-[11px] text-muted">{new Date(row.created_at).toLocaleString()}</p></div>{!row.read_at ? <Chip tone="green">New</Chip> : null}</div></button>)}</div>}</div>
}
