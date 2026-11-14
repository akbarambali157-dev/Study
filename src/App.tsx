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
      <header className="sticky top-0 z-30 border-b border-line bg-app/90 backdrop-blur-md surface-elevated">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-3 sm:px-6 lg:px-8">
          <NavLink to="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-2xl bg-gradient-to-br from-forest to-forest-500 font-display text-[15px] font-bold text-white shadow-sm">S</span>
            <span className="hidden sm:block">
              <span className="block font-display text-[15px] font-semibold leading-none text-body">Study Hub</span>
              <span className="mt-1 block text-[11px] leading-none text-muted">Learn · share · research</span>
            </span>
          </NavLink>
          <nav className="ml-4 hidden items-center gap-1 sm:flex" aria-label="Main">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition',
                isActive ? 'bg-surface-2 text-body' : 'text-muted hover:bg-surface-2/60 hover:text-body',
              )}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {profile && profile.streakDays > 0 ? (
              <span className="hidden items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs font-semibold text-[#8a5a00] dark:text-gold sm:inline-flex" title={`${profile.streakDays}-day streak`}>
                <Flame className="size-3.5" /><span className="tnum">{profile.streakDays}</span>
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
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-app/95 backdrop-blur-md sm:hidden" aria-label="Main">
        <div className="mx-auto grid max-w-md grid-cols-4 items-stretch px-2 pb-[env(safe-area-inset-bottom)]">
          {mobilePrimaryItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cn(
                'flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl py-2.5 text-[10px] font-semibold transition',
                isActive ? 'text-forest dark:text-gold' : 'text-muted',
              )}>
                <Icon className="size-5" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
          <details className="relative flex min-w-0 flex-col items-center justify-center">
            <summary className={cn(
              'flex w-full cursor-pointer list-none flex-col items-center justify-center gap-1 rounded-xl py-2.5 text-[10px] font-semibold transition',
              moreIsActive ? 'text-forest dark:text-gold' : 'text-muted',
            )}>
              <MoreHorizontal className="size-5" />
              <span>More</span>
            </summary>
            <div className="absolute bottom-full right-0 mb-2 grid w-64 grid-cols-2 gap-2 rounded-2xl border border-line bg-app p-2 shadow-xl">
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
