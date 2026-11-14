import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  CalendarDays,
  Smartphone,
  Command,
  Compass,
  Flame,
  Home,
  Newspaper,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldCheck,
  Globe2,
  MoreHorizontal,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useProfile, useSettings } from '@/lib/hooks'
import { isTypingTarget } from '@/lib/shortcuts'
import { ShortcutsSheet } from '@/components/ShortcutsSheet'
import { Toaster } from '@/components/ui/toast'
import { IconButton } from '@/components/ui/Button'
import { applyPwaUpdate, checkForPwaUpdate } from '@/lib/pwa'

const NAV = [
  { to: '/', label: 'Today', icon: Home, end: true },
  { to: '/community', label: 'Research', icon: Newspaper, end: false },
  { to: '/library', label: 'Library', icon: BookOpen, end: false },
  { to: '/planner', label: 'Planner', icon: CalendarDays, end: false },
  { to: '/install', label: 'Install', icon: Smartphone, end: false },
  { to: '/discover', label: 'Discover', icon: Globe2, end: false },
  { to: '/trail', label: 'Trail', icon: Compass, end: false },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, end: false },
]

export function App() {
  const settings = useSettings()
  const profile = useProfile()
  const navigate = useNavigate()
  const location = useLocation()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const navItems = isAdmin ? [...NAV, { to: '/admin', label: 'Admin', icon: ShieldCheck, end: false }] : NAV
  const mobilePrimaryItems = navItems.filter((item) => ['/', '/community', '/library'].includes(item.to))
  const mobileMoreItems = navItems.filter((item) => !['/', '/community', '/library'].includes(item.to))
  const moreIsActive = mobileMoreItems.some((item) => location.pathname === item.to || location.pathname.startsWith(item.to + '/'))
  const pendingG = useRef(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.dark)
    // Keep the iOS standalone status-bar contrast aligned with the active theme.
    const statusBar = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-status-bar-style"]')
    if (statusBar) statusBar.content = settings.dark ? 'black' : 'default'
  }, [settings.dark])
  useEffect(() => {
    if (!supabase) return
    let mounted = true
    void supabase.auth.getUser().then(({ data }) => { if (mounted) setIsAdmin(data.user?.app_metadata?.role === 'admin') })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setIsAdmin(session?.user.app_metadata?.role === 'admin'))
    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    const onUpdate=()=>setUpdateAvailable(true)
    window.addEventListener('studyhub:pwa-update',onUpdate)
    checkForPwaUpdate()
    return ()=>window.removeEventListener('studyhub:pwa-update',onUpdate)
  },[])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [location.pathname])

  const openShortcuts = useCallback(() => setShortcutsOpen(true), [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
        event.preventDefault()
        setShortcutsOpen((open) => !open)
        return
      }
      if (event.key === 'Escape') {
        setShortcutsOpen(false)
        return
      }
      if (event.key === 'g') {
        pendingG.current = true
        setTimeout(() => { pendingG.current = false }, 1200)
        return
      }
      if (pendingG.current) {
        pendingG.current = false
        const target =
          event.key === 'l' ? '/library'
            : event.key === 't' ? '/trail'
              : event.key === 's' ? '/settings'
                : event.key === 'h' ? '/'
                  : event.key === 'r' ? '/community'
                    : null
        if (target) {
          event.preventDefault()
          navigate(target)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  return (
    <div className="app-backdrop flex min-h-full flex-col text-body">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-forest focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <header className="hub-topbar sticky top-0 z-30">
        <div className="hub-topbar-inner mx-auto flex w-full max-w-7xl items-center gap-3 px-3 sm:px-6 lg:px-8">
          <NavLink to="/" className="hub-brand group flex shrink-0 items-center gap-2.5" aria-label="Study Hub home">
            <span className="hub-brand-mark" aria-hidden="true">
              <img src="./studyhub-icon.svg" alt="" className="hub-brand-image" />
            </span>
            <span className="hub-brand-copy">
              <span className="block font-display text-[15px] font-bold leading-none tracking-tight text-body">Study Hub</span>
              <span className="mt-1 hidden text-[10px] font-medium leading-none tracking-[.13em] text-muted sm:block">YOUR CAMPUS, CONNECTED</span>
            </span>
          </NavLink>
          <div className="hub-topbar-divider hidden lg:block" aria-hidden="true" />
          <nav className="hub-desktop-nav ml-1 hidden items-center gap-1 sm:flex" aria-label="Main">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cn(
                'hub-nav-link relative rounded-xl px-3 py-2 text-[13px] font-semibold transition',
                isActive ? 'is-active' : 'text-muted',
              )}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {profile && profile.streakDays > 0 ? (
              <span className="hub-streak" title={`${profile.streakDays}-day streak`}>
                <Flame className="size-3.5" /><span className="tnum">{profile.streakDays}</span><span className="hidden sm:inline">day streak</span>
              </span>
            ) : null}
            <IconButton label="Keyboard shortcuts" onClick={openShortcuts}><Command className="size-4" /></IconButton>
          </div>
        </div>
      </header>
      {updateAvailable ? <div className="mx-auto mt-3 flex w-[calc(100%-1.5rem)] max-w-6xl items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-white/95 px-4 py-3 text-sm shadow-lg dark:border-indigo-900 dark:bg-slate-900/95" role="status" aria-live="polite">
        <div><p className="font-semibold text-body">A new Study Hub version is ready</p><p className="text-xs text-muted">Update when ready. Your current work stays open until you choose.</p></div>
        <div className="flex shrink-0 items-center gap-2"><button type="button" className="rounded-lg px-2 py-2 text-xs text-muted" onClick={()=>setUpdateAvailable(false)}>Later</button><button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white" onClick={()=>void applyPwaUpdate()}><RefreshCw className="size-3.5"/>Update</button></div>
      </div> : null}
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-3 pb-28 pt-5 sm:px-6 sm:pb-16 lg:px-8 lg:pt-8">
        <Outlet />
      </main>
      <nav className="hub-mobile-nav fixed inset-x-0 bottom-0 z-30 sm:hidden" aria-label="Main">
        <div className="hub-mobile-nav-inner mx-auto grid max-w-md grid-cols-4 items-stretch px-2 pb-[env(safe-area-inset-bottom)]">
          {mobilePrimaryItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cn(
                'hub-mobile-link flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl py-2.5 text-[10px] font-semibold transition',
                isActive ? 'text-forest dark:text-gold' : 'text-muted',
              )}>
                <Icon className="size-5" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
          <details className="relative flex min-w-0 flex-col items-center justify-center">
            <summary className={cn(
              'hub-mobile-more flex w-full cursor-pointer list-none flex-col items-center justify-center gap-1 rounded-xl py-2.5 text-[10px] font-semibold transition',
              moreIsActive ? 'text-forest dark:text-gold' : 'text-muted',
            )}>
              <MoreHorizontal className="size-5" />
              <span>More</span>
            </summary>
            <div className="hub-mobile-more-menu absolute bottom-full right-0 mb-2 grid w-64 grid-cols-2 gap-2 rounded-2xl border border-line bg-app p-2 shadow-xl">
              {mobileMoreItems.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink key={item.to} to={item.to} end={item.end} onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')} className={({ isActive }) => cn(
                    'flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-3 text-xs font-medium transition',
                    isActive ? 'bg-forest/10 text-forest dark:bg-gold/10 dark:text-gold' : 'text-body hover:bg-surface-2',
                  )}>
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          </details>
        </div>
      </nav>
      <ShortcutsSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <Toaster />
    </div>
  )
}
