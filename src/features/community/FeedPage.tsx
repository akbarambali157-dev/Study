import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowUpRight, BookOpen, Check, Heart, Lightbulb,
  Bookmark, MessageCircle, Plus, RefreshCw, Send, Sparkles, Users, UserPlus, UserMinus, X,
} from 'lucide-react'
import { PageHeading } from '@/components/PageShell'
import { Button } from '@/components/ui/Button'
import { Card, Chip } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { db } from '@/lib/db'
import { getAuthenticatedUser, supabase } from '@/lib/supabase'

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
  visibility: 'public' | 'private'
}
type Comment = {
  id: string
  post_id: string
  author_id: string
  author_name: string
  body: string
  created_at: string
  parent_comment_id: string | null
}
type Reaction = {
  id: string
  post_id: string
  user_id: string
  reaction: ReactionType
}

const FEED_PAGE_SIZE = 20

const FILTERS = [
  { value: 'all', label: 'All research' },
  { value: 'idea', label: 'Ideas' },
  { value: 'question', label: 'Questions' },
  { value: 'collaboration', label: 'Collaborators' },
  { value: 'paper', label: 'Papers' },
  { value: 'following', label: 'Following' },
  { value: 'saved', label: 'Saved' },
  { value: 'department', label: 'My department' },
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
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [loadedCommentPosts, setLoadedCommentPosts] = useState<Set<string>>(() => new Set())
  const [loadingCommentsPost, setLoadingCommentsPost] = useState<string | null>(null)
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() => new Set())
  const [followedAuthors, setFollowedAuthors] = useState<Set<string>>(() => new Set())
  const [myDepartment, setMyDepartment] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [authorName, setAuthorName] = useState('Student')
  const [loading, setLoading] = useState(true)
  const [loadingMorePosts, setLoadingMorePosts] = useState(false)
  const [hasMorePosts, setHasMorePosts] = useState(false)
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
      const [user, profile] = await Promise.all([
        getAuthenticatedUser(),
        db.profile.get('me').catch(() => null),
      ])
      setUserId(user?.id ?? null)
      const metadataName = String(user?.user_metadata?.display_name ?? user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '')
      setAuthorName(profile?.displayName && profile.displayName !== 'Student' ? profile.displayName : metadataName || user?.email?.split('@')[0] || 'Student')
      if (!user) {
        setPosts([])
        setComments([])
        setCommentCounts({})
        setLoadedCommentPosts(new Set())
        setReactions([])
        setBookmarkedIds(new Set())
        setFollowedAuthors(new Set())
        setMyDepartment('')
        setLoading(false)
        return
      }
      const [{ data: postRows, error: postError }, { data: profileRow }, { data: bookmarkRows, error: bookmarkError }, { data: followRows, error: followError }] = await Promise.all([
        supabase.from('research_posts').select('id,author_id,author_name,title,body,post_type,discipline,tags,created_at,visibility').order('created_at', { ascending: false }).range(0, FEED_PAGE_SIZE - 1),
        supabase.from('student_profiles').select('department').eq('user_id', user.id).maybeSingle(),
        supabase.from('post_bookmarks').select('post_id').eq('user_id', user.id),
        supabase.from('research_follows').select('followed_id').eq('follower_id', user.id),
      ])
      if (bookmarkError) throw bookmarkError
      if (followError) throw followError
      setMyDepartment(profileRow?.department ?? '')
      setBookmarkedIds(new Set((bookmarkRows ?? []).map((row) => row.post_id)))
      setFollowedAuthors(new Set((followRows ?? []).map((row) => row.followed_id)))
      if (postError) throw postError
      const rows = (postRows ?? []) as Post[]
      setPosts(rows)
      setHasMorePosts(rows.length === FEED_PAGE_SIZE)
      // Fetch comment bodies only when a thread is opened.
      setComments([])
      setCommentCounts({})
      setLoadedCommentPosts(new Set())
      setOpenComments({})
      if (rows.length === 0) {
        setReactions([])
        return
      }
      const ids = rows.map((post) => post.id)
      const { data: reactionRows, error: reactionError } = await supabase
        .from('research_reactions')
        .select('id,post_id,user_id,reaction')
        .in('post_id', ids)
      if (reactionError) throw reactionError
      setReactions((reactionRows ?? []) as Reaction[])
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'The research feed could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadFeed()
  }, [loadFeed])

  const loadMorePosts = async () => {
    if (!supabase || loadingMorePosts || !hasMorePosts) return
    setLoadingMorePosts(true)
    try {
      const { data, error } = await supabase.from('research_posts')
        .select('id,author_id,author_name,title,body,post_type,discipline,tags,created_at,visibility')
        .order('created_at', { ascending: false })
        .range(posts.length, posts.length + FEED_PAGE_SIZE - 1)
      if (error) throw error
      const nextPosts = (data ?? []) as Post[]
      if (nextPosts.length) {
        const { data: reactionRows, error: reactionError } = await supabase.from('research_reactions')
          .select('id,post_id,user_id,reaction')
          .in('post_id', nextPosts.map((post) => post.id))
        if (reactionError) throw reactionError
        setPosts((current) => {
          const existing = new Set(current.map((post) => post.id))
          return [...current, ...nextPosts.filter((post) => !existing.has(post.id))]
        })
        setReactions((current) => [...current, ...((reactionRows ?? []) as Reaction[])])
      }
      setHasMorePosts(nextPosts.length === FEED_PAGE_SIZE)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'More research posts could not be loaded.', 'error')
    } finally {
      setLoadingMorePosts(false)
    }
  }

  const toggleComments = async (postId: string) => {
    const opening = !openComments[postId]
    setOpenComments((current) => ({ ...current, [postId]: opening }))
    if (!opening || loadedCommentPosts.has(postId) || loadingCommentsPost === postId || !supabase) return

    setLoadingCommentsPost(postId)
    try {
      const [countResult, commentsResult] = await Promise.all([
        supabase.from('research_comments').select('id', { count: 'exact', head: true }).eq('post_id', postId),
        supabase.from('research_comments')
          .select('id,post_id,author_id,author_name,body,created_at,parent_comment_id')
          .eq('post_id', postId)
          .order('created_at', { ascending: true })
          .range(0, 49),
      ])
      if (countResult.error) throw countResult.error
      if (commentsResult.error) throw commentsResult.error
      setComments((current) => [
        ...current.filter((comment) => comment.post_id !== postId),
        ...((commentsResult.data ?? []) as Comment[]),
      ])
      setCommentCounts((current) => ({
        ...current,
        [postId]: countResult.count ?? commentsResult.data?.length ?? 0,
      }))
      setLoadedCommentPosts((current) => new Set(current).add(postId))
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Comments could not be loaded.', 'error')
    } finally {
      setLoadingCommentsPost(null)
    }
  }

  const loadMoreComments = async (postId: string) => {
    if (!supabase || loadingCommentsPost === postId) return
    const existing = commentsByPost.get(postId) ?? []
    setLoadingCommentsPost(postId)
    try {
      const { data, error } = await supabase.from('research_comments')
        .select('id,post_id,author_id,author_name,body,created_at,parent_comment_id')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
        .range(existing.length, existing.length + 49)
      if (error) throw error
      if (data?.length) setComments((current) => [...current, ...(data as Comment[])])
    } catch (error) {
      toast(error instanceof Error ? error.message : 'More comments could not be loaded.', 'error')
    } finally {
      setLoadingCommentsPost(null)
    }
  }

  const visiblePosts = useMemo(
    () => {
      if (filter === 'all') return posts
      if (filter === 'following') return posts.filter((post) => followedAuthors.has(post.author_id))
      if (filter === 'saved') return posts.filter((post) => bookmarkedIds.has(post.id))
      if (filter === 'department') return myDepartment ? posts.filter((post) => post.discipline.toLowerCase() === myDepartment.toLowerCase()) : []
      return posts.filter((post) => post.post_type === filter)
    },
    [filter, posts, followedAuthors, bookmarkedIds, myDepartment],
  )

  // Build per-post indexes once. Filtering the complete comments/reactions
  // arrays inside every rendered post made feed rendering quadratic.
  const commentsByPost = useMemo(() => {
    const grouped = new Map<string, Comment[]>()
    for (const comment of comments) {
      const list = grouped.get(comment.post_id)
      if (list) list.push(comment)
      else grouped.set(comment.post_id, [comment])
    }
    return grouped
  }, [comments])

  const reactionsByPost = useMemo(() => {
    const grouped = new Map<string, Reaction[]>()
    for (const reaction of reactions) {
      const list = grouped.get(reaction.post_id)
      if (list) list.push(reaction)
      else grouped.set(reaction.post_id, [reaction])
    }
    return grouped
  }, [reactions])

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
        visibility,
      })
      if (error) throw error
      setTitle('')
      setBody('')
      setDiscipline('')
      setTags('')
      setPostType('idea')
      setVisibility('public')
      setComposerOpen(false)
      toast('Your research post is now in the community feed.', 'success')
      await loadFeed()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Your post could not be published.', 'error')
    } finally {
      setPosting(false)
    }
  }

  const submitComment = async (postId: string, parentCommentId?: string) => {
    const value = parentCommentId ? replyDrafts[parentCommentId]?.trim() : commentDrafts[postId]?.trim()
    if (!supabase || !userId || !value) return
    if (value.length > 2000) {
      toast('Comments must be 2,000 characters or fewer.', 'error')
      return
    }
    setBusyPost(postId)
    try {
      const { data, error } = await supabase.from('research_comments').insert({
        post_id: postId, author_id: userId, author_name: authorName.slice(0, 80), body: value, parent_comment_id: parentCommentId ?? null,
      }).select('id,post_id,author_id,author_name,body,created_at,parent_comment_id').single()
      if (error) throw error
      if (data) {
        setComments((current) => [...current, data as Comment])
        setCommentCounts((current) => ({ ...current, [postId]: (current[postId] ?? 0) + 1 }))
      }
      if (parentCommentId) setReplyDrafts((current) => ({ ...current, [parentCommentId]: '' }))
      else setCommentDrafts((current) => ({ ...current, [postId]: '' }))
      setReplyingTo(null)
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
        const { data, error } = await supabase.from('research_reactions').upsert(
          { post_id: postId, user_id: userId, reaction },
          { onConflict: 'post_id,user_id' },
        ).select('id,post_id,user_id,reaction').single()
        if (error) throw error
        if (data) setReactions((current) => [
          ...current.filter((item) => !(item.post_id === postId && item.user_id === userId)),
          data as Reaction,
        ])
      }
      if (current?.reaction === reaction) {
        setReactions((items) => items.filter((item) => !(item.post_id === postId && item.user_id === userId)))
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Your reaction could not be saved.', 'error')
    } finally {
      setBusyPost(null)
    }
  }

  const toggleBookmark = async (postId: string) => {
    if (!supabase || !userId) { toast('Sign in to save research posts.', 'info'); return }
    const saved = bookmarkedIds.has(postId)
    const result = saved
      ? await supabase.from('post_bookmarks').delete().eq('post_id', postId).eq('user_id', userId)
      : await supabase.from('post_bookmarks').insert({ post_id: postId, user_id: userId })
    if (result.error) toast(result.error.message, 'error')
    else setBookmarkedIds((current) => { const next = new Set(current); saved ? next.delete(postId) : next.add(postId); return next })
  }

  const toggleFollow = async (authorId: string) => {
    if (!supabase || !userId || authorId === userId) return
    const followed = followedAuthors.has(authorId)
    const result = followed
      ? await supabase.from('research_follows').delete().eq('follower_id', userId).eq('followed_id', authorId)
      : await supabase.from('research_follows').insert({ follower_id: userId, followed_id: authorId })
    if (result.error) toast(result.error.message, 'error')
    else setFollowedAuthors((current) => { const next = new Set(current); followed ? next.delete(authorId) : next.add(authorId); return next })
  }

  const deletePost = async (postId: string) => {
    if (!supabase || !userId || !window.confirm('Delete this research post? This also removes its comments and reactions.')) return
    try {
      const { error } = await supabase.from('research_posts').delete().eq('id', postId).eq('author_id', userId)
      if (error) throw error
      setPosts((current) => current.filter((post) => post.id !== postId))
      setComments((current) => current.filter((comment) => comment.post_id !== postId))
      setReactions((current) => current.filter((reaction) => reaction.post_id !== postId))
      toast('Post deleted.', 'success')
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
      toast('Your report has been recorded. Thank you for flagging this.', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'The report could not be submitted.', 'error')
    }
  }

  if (!supabase) {
    return (
      <div className="hub-community-page mx-auto max-w-3xl">
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
      <div className="hub-community-page mx-auto max-w-3xl">
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
    <div className="hub-community-page mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeading title="Research community" subtitle="Ideas become stronger when people think together." />
        <Button onClick={() => setComposerOpen((open) => !open)} icon={composerOpen ? <X className="size-4" /> : <Plus className="size-4" />}>
          {composerOpen ? 'Close composer' : 'Share research'}
        </Button>
      </div>

      <section className="community-banner hub-community-hero mb-5 overflow-hidden rounded-3xl p-5 text-white sm:p-7">
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
        <Card className="hub-community-composer mb-5 p-4 sm:p-5">
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
              <label className="text-xs font-semibold text-muted">Who can see this?
                <select value={visibility} onChange={(event) => setVisibility(event.target.value as 'public' | 'private')} className="mt-1.5 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm text-body">
                  <option value="public">Community members</option><option value="private">Only me</option>
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

      <div className="community-toolbar hub-community-toolbar mb-4 flex flex-wrap items-center justify-between gap-3">
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
            const postComments = commentsByPost.get(post.id) ?? []
            const postReactions = reactionsByPost.get(post.id) ?? []
            const mine = postReactions.find((reaction) => reaction.user_id === userId)
            return (
              <Card key={post.id} className="community-post overflow-hidden p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500/15 to-sky-500/15 font-semibold text-indigo-600 dark:text-indigo-200">{post.author_name.trim().charAt(0).toUpperCase() || 'S'}</span>
                    <div className="min-w-0"><p className="truncate text-sm font-semibold">{post.author_name}</p><p className="text-xs text-muted">{post.discipline} · {timeAgo(post.created_at)}{post.visibility === 'private' ? ' · Private' : ''}</p></div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Chip tone="neutral">{POST_TYPES.find((item) => item.value === post.post_type)?.label ?? 'Research'}</Chip>
                    {post.author_id !== userId ? <button type="button" onClick={() => void toggleFollow(post.author_id)} className="rounded-lg p-2 text-muted hover:bg-surface-2" aria-label={followedAuthors.has(post.author_id) ? 'Unfollow author' : 'Follow author'}>{followedAuthors.has(post.author_id) ? <UserMinus className="size-4" /> : <UserPlus className="size-4" />}</button> : null}
                    {post.author_id === userId ? <button type="button" onClick={() => void deletePost(post.id)} className="rounded-lg p-2 text-muted hover:bg-rose-500/10 hover:text-rose-500" aria-label="Delete your post"><X className="size-4" /></button> : <button type="button" onClick={() => void reportPost(post.id)} className="rounded-lg p-2 text-muted hover:bg-amber-500/10 hover:text-amber-600" aria-label="Report this post"><AlertTriangle className="size-4" /></button>}
                  </div>
                </div>
                <h2 className="mt-4 text-lg font-semibold tracking-tight">{post.title}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-body">{post.body}</p>
                {post.tags?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{post.tags.map((tag) => <span key={tag} className="rounded-full bg-indigo-500/8 px-2.5 py-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-200">#{tag}</span>)}</div> : null}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => void toggleBookmark(post.id)} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold ${bookmarkedIds.has(post.id) ? 'border-indigo-400 bg-indigo-500/10 text-indigo-600' : 'border-line text-muted'}`}><Bookmark className="size-3.5" />{bookmarkedIds.has(post.id) ? 'Saved' : 'Save'}</button>
                    {REACTIONS.map((item) => {
                      const Icon = item.icon
                      const count = postReactions.filter((reaction) => reaction.reaction === item.value).length
                      const active = mine?.reaction === item.value
                      return <button key={item.value} type="button" disabled={busyPost === post.id} onClick={() => void toggleReaction(post.id, item.value)} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition ${active ? 'border-indigo-400 bg-indigo-500/10 text-indigo-600 dark:text-indigo-200' : 'border-line text-muted hover:border-indigo-300 hover:text-body'}`}><Icon className="size-3.5" />{item.label}{count > 0 ? <span className="tabular-nums">{count}</span> : null}</button>
                    })}
                  </div>
                  <button type="button" onClick={() => void toggleComments(post.id)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-body"><MessageCircle className="size-3.5" />{commentCounts[post.id] === undefined ? 'Comments' : `${commentCounts[post.id]} comments`}</button>
                </div>
                {openComments[post.id] ? (
                  <div className="mt-3 border-t border-line pt-3">
                    {loadingCommentsPost === post.id && !loadedCommentPosts.has(post.id) ? <p className="mb-3 text-xs text-muted">Loading comments…</p> : postComments.length ? <div className="mb-3 space-y-3">{postComments.filter((comment) => !comment.parent_comment_id).map((comment) => <div key={comment.id} className="space-y-2"><div className="flex gap-2.5"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-[11px] font-semibold">{comment.author_name.charAt(0).toUpperCase()}</span><div className="min-w-0 flex-1 rounded-xl bg-surface-2/70 px-3 py-2"><div className="flex flex-wrap items-baseline gap-2"><span className="text-xs font-semibold">{comment.author_name}</span><span className="text-[10px] text-muted">{timeAgo(comment.created_at)}</span></div><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{comment.body}</p><button type="button" onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)} className="mt-2 text-[11px] font-semibold text-indigo-600">Reply</button></div></div>{postComments.filter((reply) => reply.parent_comment_id === comment.id).map((reply) => <div key={reply.id} className="ml-9 flex gap-2"><span className="grid size-6 shrink-0 place-items-center rounded-lg bg-surface-2 text-[10px] font-semibold">{reply.author_name.charAt(0).toUpperCase()}</span><div className="min-w-0 flex-1 rounded-xl bg-surface-2/50 px-3 py-2"><p className="text-[11px] font-semibold">{reply.author_name}</p><p className="mt-1 whitespace-pre-wrap text-sm">{reply.body}</p></div></div>)}{replyingTo === comment.id ? <form onSubmit={(event) => { event.preventDefault(); void submitComment(post.id, comment.id) }} className="ml-9 flex gap-2"><input value={replyDrafts[comment.id] ?? ''} onChange={(event) => setReplyDrafts((current) => ({ ...current, [comment.id]: event.target.value }))} maxLength={2000} placeholder="Write a reply…" className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-app px-2.5 text-xs" /><Button type="submit" size="sm" disabled={busyPost === post.id || !(replyDrafts[comment.id] ?? '').trim()}>Reply</Button></form> : null}</div>)}</div> : <p className="mb-3 text-xs text-muted">No comments yet. Add a constructive thought or question.</p>}
                    {commentCounts[post.id] !== undefined && postComments.length < commentCounts[post.id] ? <button type="button" disabled={loadingCommentsPost === post.id} onClick={() => void loadMoreComments(post.id)} className="mb-3 rounded-lg px-3 py-2 text-xs font-semibold text-indigo-600 disabled:opacity-50">{loadingCommentsPost === post.id ? 'Loading…' : 'Load more comments'}</button> : null}
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
      {hasMorePosts ? <div className="mt-5 text-center"><Button variant="secondary" disabled={loadingMorePosts} onClick={() => void loadMorePosts()}>{loadingMorePosts ? 'Loading posts…' : 'Load more research posts'}</Button></div> : null}

      <p className="mt-6 flex items-center gap-2 text-xs text-muted"><Check className="size-3.5 text-emerald-500" /> Be curious, be constructive, credit original work and report content that doesn't belong here. <ArrowUpRight className="size-3.5" /></p>
    </div>
  )
}
