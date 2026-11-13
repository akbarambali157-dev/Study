import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowUpRight, BookOpen, Check, Heart, Lightbulb,
  MessageCircle, Plus, RefreshCw, Send, Sparkles, Users, X,
} from 'lucide-react'
import { PageHeading } from '@/components/PageShell'
import { Button } from '@/components/ui/Button'
import { Card, Chip } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'

type PostType = 'idea' | 'paper' | 'question' | 'discovery' | 'progress' | 'resource' | 'collaboration'
type ReactionType = 'like' | 'insightful' | 'helpful'
type Post = {
  id: string
  author_id: string
  author_name: string
  title: string
  body: string
  post_type: PostType
  discipline: string
  tags: string[]
  created_at: string
}
type Comment = {
  id: string
  post_id: string
  author_id: string
  author_name: string
  body: string
  created_at: string
}
type Reaction = {
  id: string
  post_id: string
  user_id: string
  reaction: ReactionType
}

const FILTERS = [
  { value: 'all', label: 'All research' },
  { value: 'idea', label: 'Ideas' },
  { value: 'question', label: 'Questions' },
  { value: 'collaboration', label: 'Collaborators' },
  { value: 'paper', label: 'Papers' },
] as const

const POST_TYPES: { value: PostType; label: string }[] = [
  { value: 'idea', label: 'Research idea' },
  { value: 'question', label: 'Academic question' },
  { value: 'collaboration', label: 'Seeking collaborators' },
  { value: 'paper', label: 'Research paper' },
  { value: 'discovery', label: 'Research discovery' },
  { value: 'progress', label: 'Progress update' },
  { value: 'resource', label: 'Learning resource' },
]

const REACTIONS: { value: ReactionType; label: string; icon: typeof Heart }[] = [
  { value: 'like', label: 'Like', icon: Heart },
  { value: 'insightful', label: 'Insightful', icon: Lightbulb },
  { value: 'helpful', label: 'I can help', icon: Users },
]

function timeAgo(value: string): string {
  const date = new Date(value)
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return date.toLocaleDateString()
}

export function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [authorName, setAuthorName] = useState('Student')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('all')
  const [composerOpen, setComposerOpen] = useState(false)
  const [postType, setPostType] = useState<PostType>('idea')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [discipline, setDiscipline] = useState('')
  const [tags, setTags] = useState('')
  const [posting, setPosting] = useState(false)
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({})
  const [busyPost, setBusyPost] = useState<string | null>(null)

  const loadFeed = useCallback(async () => {
    if (!supabase) {
      setLoadError('The community needs the Supabase project URL and public key configured in the deployment.')
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      const [{ data: sessionData, error: sessionError }, profile] = await Promise.all([
        supabase.auth.getSession(),
        db.profile.get('me').catch(() => null),
      ])
      if (sessionError) throw sessionError
      const user = sessionData.session?.user
      setUserId(user?.id ?? null)
      const metadataName = String(user?.user_metadata?.display_name ?? user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '')
      setAuthorName(profile?.displayName && profile.displayName !== 'Student' ? profile.displayName : metadataName || user?.email?.split('@')[0] || 'Student')
      if (!user) {
        setPosts([])
        setComments([])
        setReactions([])
        setLoading(false)
        return
      }
      const { data: postRows, error: postError } = await supabase
        .from('research_posts')
        .select('id,author_id,author_name,title,body,post_type,discipline,tags,created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      if (postError) throw postError
      const rows = (postRows ?? []) as Post[]
      setPosts(rows)
      if (rows.length === 0) {
        setComments([])
        setReactions([])
        return
      }
      const ids = rows.map((post) => post.id)
      const [commentResult, reactionResult] = await Promise.all([
        supabase.from('research_comments').select('id,post_id,author_id,author_name,body,created_at').in('post_id', ids).order('created_at', { ascending: true }),
        supabase.from('research_reactions').select('id,post_id,user_id,reaction').in('post_id', ids),
      ])
      if (commentResult.error) throw commentResult.error
      if (reactionResult.error) throw reactionResult.error
      setComments((commentResult.data ?? []) as Comment[])
      setReactions((reactionResult.data ?? []) as Reaction[])
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'The research feed could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadFeed()
  }, [loadFeed])

  const visiblePosts = useMemo(
    () => filter === 'all' ? posts : posts.filter((post) => post.post_type === filter),
    [filter, posts],
  )

  const submitPost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !userId) {
      toast('Sign in before publishing to the research community.', 'error')
      return
    }
    if (title.trim().length < 4 || body.trim().length < 10) {
      toast('Add a clear title and at least a little context to your post.', 'error')
      return
    }
    setPosting(true)
    try {
      const { error } = await supabase.from('research_posts').insert({
        author_id: userId,
        author_name: authorName.slice(0, 80),
        title: title.trim(),
        body: body.trim(),
        post_type: postType,
        discipline: discipline.trim().slice(0, 80) || 'General',
        tags: tags.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean).slice(0, 8),
      })
      if (error) throw error
      setTitle('')
      setBody('')
      setDiscipline('')
      setTags('')
      setPostType('idea')
      setComposerOpen(false)
      toast('Your research post is now in the community feed.', 'success')
      await loadFeed()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Your post could not be published.', 'error')
    } finally {
      setPosting(false)
    }
  }

  const submitComment = async (postId: string) => {
    const value = commentDrafts[postId]?.trim()
    if (!supabase || !userId || !value) return
    if (value.length > 2000) {
      toast('Comments must be 2,000 characters or fewer.', 'error')
      return
    }
    setBusyPost(postId)
    try {
      const { error } = await supabase.from('research_comments').insert({
        post_id: postId, author_id: userId, author_name: authorName.slice(0, 80), body: value,
      })
      if (error) throw error
      setCommentDrafts((current) => ({ ...current, [postId]: '' }))
      await loadFeed()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Your comment could not be added.', 'error')
    } finally {
      setBusyPost(null)
    }
  }

  const toggleReaction = async (postId: string, reaction: ReactionType) => {
    if (!supabase || !userId) return
    const current = reactions.find((item) => item.post_id === postId && item.user_id === userId)
    setBusyPost(postId)
    try {
      if (current?.reaction === reaction) {
        const { error } = await supabase.from('research_reactions').delete().eq('post_id', postId).eq('user_id', userId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('research_reactions').upsert(
          { post_id: postId, user_id: userId, reaction },
          { onConflict: 'post_id,user_id' },
        )
        if (error) throw error
      }
      await loadFeed()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Your reaction could not be saved.', 'error')
    } finally {
      setBusyPost(null)
    }
  }

  const deletePost = async (postId: string) => {
    if (!supabase || !userId || !window.confirm('Delete this research post? This also removes its comments and reactions.')) return
    try {
      const { error } = await supabase.from('research_posts').delete().eq('id', postId).eq('author_id', userId)
      if (error) throw error
      toast('Post deleted.', 'success')
      await loadFeed()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'The post could not be deleted.', 'error')
    }
  }

  const reportPost = async (postId: string) => {
    if (!supabase || !userId) return
    const reason = window.prompt('Briefly explain why this post should be reviewed:')
    if (!reason?.trim()) return
    try {
      const { error } = await supabase.from('community_reports').insert({
        reporter_id: userId, target_type: 'post', target_id: postId, reason: reason.trim().slice(0, 500),
      })
      if (error) throw error
      toast('Report submitted for review. Thank you.', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'The report could not be submitted.', 'error')
    }
  }

  if (!supabase) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeading title="Research community" subtitle="Share ideas, exchange feedback and find people to explore questions with." />
        <Card className="p-6">
          <h2 className="font-semibold">Community connection is not configured</h2>
          <p className="mt-2 text-sm text-muted">The Supabase URL and public key are required for shared posts. Your private study library continues to work locally.</p>
        </Card>
      </div>
    )
  }

  if (!userId && !loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeading title="Research community" subtitle="Share ideas, exchange feedback and find people to explore questions with." />
        <Card className="p-6 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-indigo-500/10 text-indigo-500"><Users className="size-7" /></span>
          <h2 className="mt-4 text-lg font-semibold">Your next research partner could be here.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">Sign in to join the academic community, publish research ideas and take part in discussions.</p>
          <Link to="/auth" className="mt-5 inline-flex"><Button>Sign in to continue</Button></Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeading title="Research community" subtitle="Ideas become stronger when people think together." />
        <Button onClick={() => setComposerOpen((open) => !open)} icon={composerOpen ? <X className="size-4" /> : <Plus className="size-4" />}>
          {composerOpen ? 'Close composer' : 'Share research'}
        </Button>
      </div>

      <section className="community-banner mb-5 overflow-hidden rounded-2xl p-5 text-white sm:p-7">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-white/20 bg-white/10"><Sparkles className="size-5 text-amber-200" /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-indigo-100">A place for curious minds</p>
            <h2 className="mt-1 text-xl font-semibold sm:text-2xl">What are you investigating?</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-indigo-100/80">Share a question, explain a discovery or invite other students to help develop an idea. Keep it constructive and credit the people whose work you build on.</p>
          </div>
        </div>
      </section>

      {composerOpen ? (
        <Card className="mb-5 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><h2 className="font-semibold">Create a research post</h2><p className="text-xs text-muted">Your post will be visible to signed-in Study Hub members.</p></div>
            <Chip tone="green">Community post</Chip>
          </div>
          <form onSubmit={submitPost} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-muted">Post type
                <select value={postType} onChange={(event) => setPostType(event.target.value as PostType)} className="mt-1.5 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm text-body">
                  {POST_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-muted">Discipline / subject
                <input value={discipline} onChange={(event) => setDiscipline(event.target.value)} maxLength={80} placeholder="e.g. Business Administration" className="mt-1.5 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm text-body" />
              </label>
            </div>
            <label className="block text-xs font-semibold text-muted">Title
              <input value={title} onChange={(event) => setTitle(event.target.value)} required minLength={4} maxLength={140} placeholder="What are you researching?" className="mt-1.5 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm text-body" />
            </label>
            <label className="block text-xs font-semibold text-muted">Your post
              <textarea value={body} onChange={(event) => setBody(event.target.value)} required minLength={10} maxLength={6000} rows={5} placeholder="Explain the idea, question, finding or help you are looking for…" className="mt-1.5 w-full resize-y rounded-xl border border-line bg-app px-3 py-3 text-sm text-body" />
              <span className="mt-1 block text-right text-[11px] font-normal">{body.length}/6000</span>
            </label>
            <label className="block text-xs font-semibold text-muted">Tags (comma separated)
              <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="entrepreneurship, Nigeria, SMEs" className="mt-1.5 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm text-body" />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setComposerOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={posting} icon={<Send className="size-4" />}>{posting ? 'Publishing…' : 'Publish post'}</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="community-toolbar mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter research posts">
          {FILTERS.map((item) => (
            <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${filter === item.value ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm' : 'border-line bg-surface text-muted hover:border-indigo-300 hover:text-body'}`}>
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => void loadFeed()} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-body"><RefreshCw className="size-3.5" /> Refresh</button>
      </div>

      {loadError ? <Card className="mb-4 border-rose-300 p-4"><div className="flex gap-2 text-sm"><AlertTriangle className="size-4 shrink-0 text-rose-500" /><span>{loadError}</span></div></Card> : null}
      {loading ? (
        <Card className="p-8 text-center text-sm text-muted">Loading the research community…</Card>
      ) : visiblePosts.length === 0 ? (
        <Card className="p-8 text-center sm:p-10">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-indigo-500/10 text-indigo-500"><BookOpen className="size-7" /></span>
          <h2 className="mt-4 text-lg font-semibold">The next useful question could be yours.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">{posts.length === 0 ? 'The community is just getting started. Share a research idea or question to open the conversation.' : 'There are no posts in this category yet. Try another filter.'}</p>
          {posts.length === 0 ? <Button className="mt-5" onClick={() => setComposerOpen(true)}>Create the first post</Button> : null}
        </Card>
      ) : (
        <div className="space-y-4">
          {visiblePosts.map((post) => {
            const postComments = comments.filter((comment) => comment.post_id === post.id)
            const postReactions = reactions.filter((reaction) => reaction.post_id === post.id)
            const mine = postReactions.find((reaction) => reaction.user_id === userId)
            return (
              <Card key={post.id} className="community-post overflow-hidden p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500/15 to-sky-500/15 font-semibold text-indigo-600 dark:text-indigo-200">{post.author_name.trim().charAt(0).toUpperCase() || 'S'}</span>
                    <div className="min-w-0"><p className="truncate text-sm font-semibold">{post.author_name}</p><p className="text-xs text-muted">{post.discipline} · {timeAgo(post.created_at)}</p></div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Chip tone="neutral">{POST_TYPES.find((item) => item.value === post.post_type)?.label ?? 'Research'}</Chip>
                    {post.author_id === userId ? <button type="button" onClick={() => void deletePost(post.id)} className="rounded-lg p-2 text-muted hover:bg-rose-500/10 hover:text-rose-500" aria-label="Delete your post"><X className="size-4" /></button> : <button type="button" onClick={() => void reportPost(post.id)} className="rounded-lg p-2 text-muted hover:bg-amber-500/10 hover:text-amber-600" aria-label="Report this post"><AlertTriangle className="size-4" /></button>}
                  </div>
                </div>
                <h2 className="mt-4 text-lg font-semibold tracking-tight">{post.title}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-body">{post.body}</p>
                {post.tags?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{post.tags.map((tag) => <span key={tag} className="rounded-full bg-indigo-500/8 px-2.5 py-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-200">#{tag}</span>)}</div> : null}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                  <div className="flex flex-wrap gap-1.5">
                    {REACTIONS.map((item) => {
                      const Icon = item.icon
                      const count = postReactions.filter((reaction) => reaction.reaction === item.value).length
                      const active = mine?.reaction === item.value
                      return <button key={item.value} type="button" disabled={busyPost === post.id} onClick={() => void toggleReaction(post.id, item.value)} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition ${active ? 'border-indigo-400 bg-indigo-500/10 text-indigo-600 dark:text-indigo-200' : 'border-line text-muted hover:border-indigo-300 hover:text-body'}`}><Icon className="size-3.5" />{item.label}{count > 0 ? <span className="tabular-nums">{count}</span> : null}</button>
                    })}
                  </div>
                  <button type="button" onClick={() => setOpenComments((current) => ({ ...current, [post.id]: !current[post.id] }))} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-body"><MessageCircle className="size-3.5" />{postComments.length} comments</button>
                </div>
                {openComments[post.id] ? (
                  <div className="mt-3 border-t border-line pt-3">
                    {postComments.length ? <div className="mb-3 space-y-3">{postComments.map((comment) => <div key={comment.id} className="flex gap-2.5"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-[11px] font-semibold">{comment.author_name.charAt(0).toUpperCase()}</span><div className="min-w-0 flex-1 rounded-xl bg-surface-2/70 px-3 py-2"><div className="flex flex-wrap items-baseline gap-2"><span className="text-xs font-semibold">{comment.author_name}</span><span className="text-[10px] text-muted">{timeAgo(comment.created_at)}</span></div><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{comment.body}</p></div></div>)}</div> : <p className="mb-3 text-xs text-muted">No comments yet. Add a constructive thought or question.</p>}
                    <form onSubmit={(event) => { event.preventDefault(); void submitComment(post.id) }} className="flex gap-2">
                      <input value={commentDrafts[post.id] ?? ''} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} maxLength={2000} placeholder="Write a helpful comment…" className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-app px-3 text-sm" />
                      <Button type="submit" size="sm" disabled={busyPost === post.id || !(commentDrafts[post.id] ?? '').trim()} aria-label="Send comment"><Send className="size-4" /></Button>
                    </form>
                  </div>
                ) : null}
              </Card>
            )
          })}
        </div>
      )}

      <p className="mt-6 flex items-center gap-2 text-xs text-muted"><Check className="size-3.5 text-emerald-500" /> Be curious, be constructive, credit original work and report content that doesn't belong here. <ArrowUpRight className="size-3.5" /></p>
    </div>
  )
}
