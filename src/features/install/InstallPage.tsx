import { useEffect, useState } from 'react'
import { CheckCircle2, Download, Share, Smartphone } from 'lucide-react'
import { PageHeading } from '@/components/PageShell'
import { Button } from '@/components/ui/Button'
import { Card, Chip } from '@/components/ui/misc'

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }> }

export function InstallPage() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [ios, setIos] = useState(false)
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
    setInstalled(standalone)
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
    const onPrompt = (event: Event) => { event.preventDefault(); setPromptEvent(event as InstallPromptEvent) }
    const onInstalled = () => { setInstalled(true); setPromptEvent(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [])
  const install = async () => {
    if (!promptEvent) return
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice.outcome === 'accepted') setInstalled(true)
    setPromptEvent(null)
  }
  return <div className="mx-auto max-w-3xl">
    <PageHeading title="Install Study Hub" subtitle="Add Study Hub to your Home Screen for a focused, app-like study experience." />
    <Card className="mb-4 p-5"><div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-forest/10 text-forest-400"><Smartphone className="size-6"/></span><div><h2 className="font-semibold">Your installation status</h2><p className="text-xs text-muted">Study Hub installs from your browser.</p></div></div><div className="mt-4">{installed?<Chip tone="green"><CheckCircle2 className="mr-1 inline size-3.5"/>Installed on this device</Chip>:promptEvent?<Button onClick={()=>void install()} icon={<Download className="size-4"/>}>Install Study Hub</Button>:<Chip>Use your browser's install menu</Chip>}</div></Card>
    {ios?<Card className="p-5"><h2 className="font-semibold">Install on iPhone or iPad</h2><ol className="mt-4 space-y-3 text-sm"><li className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 font-semibold">1</span><span>Open this page in <strong>Safari</strong>. The Add to Home Screen option may not appear in other browsers.</span></li><li className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 font-semibold">2</span><span>Tap the <Share className="inline size-4"/> Share button.</span></li><li className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 font-semibold">3</span><span>Choose <strong>Add to Home Screen</strong>.</span></li><li className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 font-semibold">4</span><span>If offered, enable <strong>Open as Web App</strong>, then tap Add.</span></li></ol><p className="mt-4 text-xs text-muted">Web Push on iPhone/iPad requires a supported iOS/iPadOS version, Home Screen installation and explicit permission.</p></Card>:<Card className="p-5"><h2 className="font-semibold">Install on Android</h2><ol className="mt-3 list-inside list-decimal space-y-2 text-sm"><li>Open Study Hub in Chrome or another supported browser.</li><li>Open the browser menu and choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>.</li><li>Confirm the installation and launch Study Hub from your app drawer.</li></ol></Card>}
    <p className="mt-4 text-xs text-muted">The app shell and selected study data are designed for offline use. Cloud sync and hosted AI still require an internet connection.</p>
  </div>
}
