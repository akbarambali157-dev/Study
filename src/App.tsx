import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Command,
  Compass,
  Flame,
  Home,
  Newspaper,
  RefreshCw,
  Settings as SettingsIcon,
} from 'lucide-react'
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
  const pendingG = useRef(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.dark)
  }, [settings.dark])
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
            {NAV.map((item) => (
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
        <div className="mx-auto flex max-w-md items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
          {NAV.map((item) => {
            const Icon = item.icon
            return (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cn(
                'flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition',
                isActive ? 'text-forest dark:text-gold' : 'text-muted',
              )}>
                <Icon className="size-5" />
                {item.label}
              </NavLink>
            )
          })}
        </div>
      </nav>
      <ShortcutsSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <Toaster />
    </div>
  )
}
