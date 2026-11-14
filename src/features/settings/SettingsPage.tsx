import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check,
  Download,
  KeyRound,
  Moon,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wrench,
} from 'lucide-react'
import { PageHeading, SectionTitle } from '@/components/PageShell'
import { Button } from '@/components/ui/Button'
import { Card, Chip } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { looksLikeApiKey } from '@/lib/apiKey'
import { estimateGenerationCost, formatUsd, MODELS } from '@/lib/cost'
import { db, saveSettings, wipeEverything } from '@/lib/db'
import { useSettings } from '@/lib/hooks'
import { downloadFile } from '@/lib/export'
import { checkForPwaUpdate } from '@/lib/pwa'
import { AiError, generateText, redactSecrets } from '@/lib/llm/ai'
import { SCOPE_ORDER, SHORTCUTS } from '@/lib/shortcuts'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { getVapidPublicKey, registerCurrentDeviceForPush, removeCurrentDevicePushSubscription, supportsWebPush } from '@/lib/push'

export function SettingsPage() {
  const settings = useSettings()
  const navigate = useNavigate()

  const [keyInput, setKeyInput] = useState('')
  const [credentialConfigured, setCredentialConfigured] = useState(false)
  const [credentialLoading, setCredentialLoading] = useState(true)
  const [accountEmail, setAccountEmail] = useState('')
  const [accountName, setAccountName] = useState('')
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl ?? 'https://api.anthropic.com')
  const [useProxy, setUseProxy] = useState(settings.useProxy ?? true)
  const [confirmWipe, setConfirmWipe] = useState(false)
const [testingAI, setTestingAI] = useState(false)
const [aiTestResult, setAiTestResult] = useState<'ok' | 'fail' | null>(null)
const [aiTestDiagnostic, setAiTestDiagnostic] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const checkCredential = async () => {
      if (!supabase) { setCredentialLoading(false); return }
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) { setCredentialLoading(false); return }
      setAccountEmail(auth.user.email ?? '')
      const { data: profile } = await supabase.from('student_profiles').select('display_name').eq('user_id', auth.user.id).maybeSingle()
      setAccountName(profile?.display_name ?? String(auth.user.user_metadata?.display_name ?? ''))
      const { data, error } = await supabase.functions.invoke('byok-proxy', { body: { action: 'status' } })
      if (!active) return
      if (error) toast('Private-key status could not be checked. Sign in again or retry.', 'error')
      else { setCredentialConfigured(data?.configured === true); if (typeof data?.base_url === 'string') setBaseUrl(data.base_url) }
      setCredentialLoading(false)
    }
    void checkCredential().catch(() => { if (active) setCredentialLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    setUseProxy(settings.useProxy ?? true)
  }, [settings.useProxy])

  const saveUseProxy = async (checked: boolean) => {
    setUseProxy(checked)
    await saveSettings({ useProxy: checked })
    if (checked) {
      toast('Site-provided model enabled — no key needed.', 'success')
    } else {
      toast('Site-provided model disabled — add your own key in Settings.', 'info')
    }
  }

  const testAI = useCallback(async () => {
    if (!useProxy && !credentialConfigured) {
      toast('No key and proxy mode is off — add a key or turn on "Site provides the model".', 'error')
      return
    }
    setTestingAI(true)
    setAiTestResult(null)
    setAiTestDiagnostic(null)
    try {
      const model=settings.model
      const {text:reply,usage}=await generateText({system:'You are checking whether the Study Hub AI connection is available. Reply with one short plain-text confirmation.',prompt:'Reply: Study Hub connection OK',model,maxTokens:32,baseUrl:settings.baseUrl||undefined,useProxy})
      if(reply.trim()){
        setAiTestResult('ok')
        toast(`AI is working — ${useProxy?'hosted provider':'your configured provider'} replied (${usage.inputTokens} in / ${usage.outputTokens} out tokens).`,'success')
      }else{
        setAiTestResult('fail')
        toast('The provider returned an empty response. The connection test did not pass.','error')
      }
    } catch (err) {
      setAiTestResult('fail')
      const message = err instanceof Error ? redactSecrets(err.message) : 'Unknown provider error.'
      const diagnostic = err instanceof AiError
        ? `${err.diagnosticId} · ${err.code}${err.requestId ? ` · request ${err.requestId}` : ''}`
        : `AI-TEST-UNKNOWN · ${err instanceof Error ? err.name : 'unknown'}`
      setAiTestDiagnostic(diagnostic)
      toast(`AI test failed: ${message} [${diagnostic}]`, 'error')
    } finally {
      setTestingAI(false)
    }
  }, [useProxy, credentialConfigured, settings.model, settings.baseUrl])

  const saveKey = async () => {
    const trimmed = keyInput.trim()
    if (!trimmed) { toast('Paste a key first.', 'error'); return }
    if (!looksLikeApiKey(trimmed)) {
      toast('That does not look like a complete provider key. Check the value and try again.', 'error')
      return
    }
    if (!supabase) { toast('Sign in before saving a private provider key.', 'error'); return }
    try {
      const { data, error } = await supabase.functions.invoke('byok-proxy', { body: { action: 'save', api_key: trimmed, base_url: trimmed.startsWith('sk-ant-') ? 'https://api.anthropic.com' : 'https://brewkeg.dev' } })
      if (error || data?.saved !== true) {
        toast(typeof data?.error === 'string' ? data.error : 'The secure credential vault could not save your key.', 'error')
        return
      }
      setCredentialConfigured(true)
      setKeyInput('')
      setUseProxy(false)
      await saveSettings({ useProxy: false })
      toast('Your key is encrypted in your account vault. It is never stored in this browser.', 'success')
    } catch {
      toast('The secure credential vault could not be reached. Your key was not saved.', 'error')
    }
  }

  const removeKey = async () => {
    if (!supabase) return
    try {
      const { data, error } = await supabase.functions.invoke('byok-proxy', { body: { action: 'delete' } })
      if (error || data?.deleted !== true) { toast('The saved key could not be removed from the secure vault.', 'error'); return }
      setCredentialConfigured(false)
      toast('Private provider key removed from your account vault.', 'success')
    } catch {
      toast('The secure credential vault could not be reached. The key was not changed.', 'error')
    }
  }

  const signOut = async () => {
    if (!supabase || !window.confirm('Sign out of Study Hub? Offline study materials will remain on this device. Clear local data first if this is a shared phone or computer.')) return
    try {
      const { data: auth } = await supabase.auth.getUser()
      if (auth.user) {
        const endpoint = await removeCurrentDevicePushSubscription()
        if (endpoint) {
          await supabase.from('push_subscriptions').delete().eq('user_id', auth.user.id).eq('endpoint', endpoint)
        }
      }
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      toast('You have been signed out. Local study data remains on this device.', 'success')
      navigate('/auth')
    } catch {
      toast('Sign-out could not be completed. Please try again.', 'error')
    }
  }

  const exportAll = async () => {
    const [documents, notes, keyPoints, decks, cards, reviews, inquiries, profile, studyTasks, studyGoals] =
      await Promise.all([
        db.documents.toArray(),
        db.notes.toArray(),
        db.keyPoints.toArray(),
        db.decks.toArray(),
        db.cards.toArray(),
        db.reviews.toArray(),
        db.inquiries.toArray(),
        db.profile.toArray(),
        db.studyTasks.toArray(),
        db.studyGoals.toArray(),
      ])
    // Page text is deliberate left out: it can be hundreds of KB per document
    // and the export is meant to be portable, not a backup of the PDFs.
    const payload = {
      exportedAt: new Date().toISOString(),
      documents: documents.map(({ pages, ...rest }) => ({ ...rest, pageCount: pages.length })),
      notes,
      keyPoints,
      decks,
      cards,
      reviews,
      inquiries,
      profile,
      studyTasks,
      studyGoals,
    }
    downloadFile(
      'oou-study-hub-export.json',
      JSON.stringify(payload, null, 2),
      'application/json',
    )
    toast('Everything exported as JSON.', 'success')
  }

  const wipe = async () => {
    if (!confirmWipe) {
      setConfirmWipe(true)
      return
    }
    await wipeEverything()
    setConfirmWipe(false)
    toast('Everything deleted from this browser.', 'success')
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading title="Settings" subtitle="Manage your account, learning experience, privacy and app preferences." />
      <nav aria-label="Settings modules" className="sticky top-[4.5rem] z-20 mb-5 flex gap-2 overflow-x-auto rounded-2xl border border-line bg-app/95 p-2 backdrop-blur-sm">
        {[
          ['account','Account'],['academic','Academic'],['ai','AI'],['appearance','Appearance'],
          ['notifications','Notifications'],['privacy','Privacy'],['storage','Storage'],['offline','Offline & app'],['help','Help'],
        ].map(([id,label]) => <a key={id} href={`#settings-${id}`} className="shrink-0 rounded-xl px-3 py-2 text-xs font-semibold text-muted transition hover:bg-surface-2 hover:text-body">{label}</a>)}
      </nav>
      <section id="settings-account" className="mb-6 scroll-mt-28">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Student account</h2>
            <p className="mt-1 text-[13px] text-muted">{accountName || 'Student'}{accountEmail ? ` · ${accountEmail}` : ''}</p>
            <p className="mt-1 text-[11px] text-muted">Email is managed by your verified sign-in account. Academic details are editable in your profile.</p>
          </div>
          <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => navigate('/profile-setup')}>Edit student profile</Button><Button size="sm" variant="ghost" onClick={() => void signOut()}>Sign out</Button></div>
        </div>
      </Card>
      </section>
      <section id="settings-academic" className="mb-6 scroll-mt-28">
        <Card><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Academic profile and discovery</h2><p className="mt-1 text-[13px] text-muted">Manage research interests, skills, profile visibility, message requests and collaboration availability.</p></div><Button size="sm" variant="secondary" onClick={() => navigate('/profile-setup')}>Open academic profile</Button></div></Card>
      </section>

      {/* ── API key ────────────────────────────────────────────────────── */}
      <section id="settings-ai" className="mb-6 scroll-mt-28">
        <SectionTitle hint="Hosted provider or your own configured key">
          API key
        </SectionTitle>
        <Card>
          {/* Proxy mode toggle: site provides the model vs BYOK */}
          <div className="p-4 border-b border-line">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={useProxy}
                onChange={(event) => void saveUseProxy(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-forest"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  Site provides the model
                </span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">
                  Students don’t need their own key. The site holds the brewkeg.dev
                  key server-side and you pay for usage. Turn this off to let each
                  student paste their own key instead.
                </span>
              </span>
            </label>
          </div>

          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 size-5 shrink-0 text-forest-400" />
            <div className="min-w-0 flex-1">
              {useProxy ? (
                <>
                  <p className="text-[13px] leading-relaxed text-muted">
                    BrewKeg is the shared provider. You do not need a personal API key. Sign in to your Study Hub account, then upload a PDF to generate notes, cards and tests.
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-3 mr-2"
                    onClick={() => navigate('/auth')}
                  >
                    Sign in / create account
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-3"
                    onClick={() => void saveUseProxy(false)}
                  >
                    {credentialConfigured ? 'Use my saved private key instead' : 'Set up my private API key'}
                  </Button>
                </>
              ) : credentialConfigured ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone="green">Encrypted in your account vault</Chip>
                    {credentialLoading ? <Chip>Checking…</Chip> : null}
                  </div>
                  <p className="mt-2 text-[13px] text-muted">
                    Your key is stored encrypted in Supabase Vault and is only retrieved by the authenticated server-side proxy for your account. It is never returned to the browser or included in app logs.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="danger" onClick={() => void removeKey()} icon={<Trash2 className="size-3.5" />}>Remove key</Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[13px] leading-relaxed text-muted">
                    Optional: use a personal provider key instead of the shared BrewKeg provider. It is sent once over HTTPS and stored encrypted in your account's Supabase Vault.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="password"
                      value={keyInput}
                      onChange={(event) => setKeyInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') saveKey()
                      }}
                      placeholder="sk-ant-… or your gateway token"
                      autoComplete="off"
                      spellCheck={false}
                      className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-app px-3 font-mono text-[13px] outline-none focus:border-forest-400"
                    />
                    <Button onClick={() => void saveKey()} disabled={!keyInput.trim() || credentialLoading}>
                      Save key
                    </Button>
                  </div>

                </>
              )}
            </div>
          </div>

          {/* ── AI connection test ───────────────────────────────────────── */}
          {(useProxy || credentialConfigured) && (
            <div className="mt-4 border-t border-line pt-4">
              <label className="text-xs font-medium uppercase tracking-wide text-muted">
                Test the model connection
              </label>
              <div className="mt-1.5 flex flex-wrap gap-2 sm:flex-row">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={testAI}
                  disabled={testingAI}
                  icon={
                    testingAI ? (
                      <Wrench className="size-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="size-3.5" />
                    )
                  }
                >
                  {testingAI ? 'Testing…' : 'Test connection'}
                </Button>
                {aiTestResult === 'ok' ? (
                  <Chip tone="green">Connection OK — the model replied.</Chip>
                ) : aiTestResult === 'fail' ? (
                  <Chip tone="clay">Test failed. Check the diagnostic below.</Chip>
                ) : null}
              </div>
              {aiTestDiagnostic ? (
                <p className="mt-2 rounded-lg border border-clay/30 bg-clay/5 px-3 py-2 font-mono text-[11px] text-muted">
                  Diagnostic: {aiTestDiagnostic}
                </p>
              ) : null}
              <p className="mt-1.5 text-[12px] text-muted">
                Sends a single test prompt to the current model. Uses a few tokens
                and shows you exactly whether the AI is reachable before you upload a PDF.
              </p>
            </div>
          )}

          <div className="mt-4 border-t border-line pt-4 text-[12px] text-muted">
            <p className="font-semibold text-body">Provider endpoint</p>
            <p className="mt-1">{useProxy ? 'https://brewkeg.dev (site-managed)' : credentialConfigured ? baseUrl : 'Selected automatically when you save your key'}</p>
            <p className="mt-1">Personal credentials are restricted to the official Anthropic API or the configured BrewKeg endpoint. The endpoint is saved alongside your encrypted account credential and cannot be changed to an arbitrary URL.</p>
          </div>
        </Card>
      </section>

      {/* ── model ─────────────────────────────────────────────────────── */}
      <section className="mb-6 scroll-mt-28">
        <SectionTitle hint="What a 40-page handout costs to process">
          Model
        </SectionTitle>
        <div className="space-y-2">
          {MODELS.map((model) => {
            const active = settings.model === model.id
            return (
              <button
                key={model.id}
                type="button"
                onClick={async () => {
                  await saveSettings({ model: model.id })
                  toast(`${model.label} selected.`, 'success')
                }}
                className={cn(
                  'w-full rounded-xl border px-4 py-3 text-left transition',
                  active
                    ? 'border-forest-400 bg-forest-400/5'
                    : 'border-line bg-surface hover:border-forest-400/40',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {model.label}
                    {active ? <Check className="size-4 text-forest-400" /> : null}
                  </span>
                  <span className="tnum text-[12px] text-muted">
                    ≈{formatUsd(estimateFor40Pages(model.id))} per
                    handout
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{model.note}</p>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted">Cost examples use Anthropic list rates. BrewKeg and other gateways apply their own billing rates.</p>
      </section>

      {/* ── preferences ───────────────────────────────────────────────── */}
      <section id="settings-appearance" className="mb-6 scroll-mt-28">
        <SectionTitle>Appearance & learning preferences</SectionTitle>
        <Card className="divide-y divide-line p-0">
          <ToggleRow
            title="Learning trail"
            body="Record what you search for, ask about and miss, so the app can tell you what you keep coming back to. Nothing leaves the device except in the one batched insight call."
            checked={settings.trailEnabled}
            onChange={(checked) => void saveSettings({ trailEnabled: checked })}
          />
          <ToggleRow
            title="Dark mode"
            icon={<Moon className="size-4" />}
            body="Same palette, inverted. Useful for reading at night."
            checked={settings.dark}
            onChange={(checked) => void saveSettings({ dark: checked })}
          />
        </Card>
      </section>

      <section id="settings-notifications" className="mb-6 scroll-mt-28">
        <SectionTitle hint="Choose what Study Hub may notify you about">Notifications</SectionTitle>
        <NotificationPreferences />
      </section>

      {/* ── data ──────────────────────────────────────────────────────── */}
      <section id="settings-storage" className="mb-6 scroll-mt-28">
        <SectionTitle hint="Export a portable copy of your local study data">
          Your data
        </SectionTitle>
        <Card>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={exportAll}
              icon={<Download className="size-3.5" />}
            >
              Export everything (JSON)
            </Button>
            <Button
              variant={confirmWipe ? 'danger' : 'secondary'}
              size="sm"
              onClick={wipe}
              icon={<Trash2 className="size-3.5" />}
            >
              {confirmWipe ? 'Tap again to delete everything' : 'Delete everything'}
            </Button>
          </div>
          {confirmWipe ? (
            <p className="mt-2 text-[13px] text-clay">
              This erases documents, notes, cards, grades, tests, planner tasks, learning goals, the trail and your key from
              this browser. It cannot be undone.
            </p>
          ) : null}
          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            When you are signed in, the original PDF is stored in private account storage; extracted text is sent to your selected AI provider only when you generate study materials. Without an account, the local copy stays on this device. Do not upload result slips or other personal records.
          </p>
        </Card>
      </section>

      <section id="settings-privacy" className="mb-6 scroll-mt-28">
        <SectionTitle hint="Control your academic visibility and unwanted contact">Privacy & safety</SectionTitle>
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">Academic profile visibility</p><p className="text-xs text-muted">Your profile is private until you opt in to student discovery.</p></div><Button size="sm" variant="secondary" onClick={() => navigate('/profile-setup')}>Manage visibility</Button></div>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">Blocked students</p><p className="text-xs text-muted">Review or unblock accounts you have blocked.</p></div><BlockedUsersSettings /></div>
        </Card>
      </section>
      <section id="settings-offline" className="mb-6 scroll-mt-28">
        <SectionTitle hint="Prepare this device for weak networks and offline study">Offline & app</SectionTitle>
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">Connection status</p><p className="text-xs text-muted">{navigator.onLine ? 'Online — cloud features are available.' : 'Offline — saved local study materials remain available.'}</p></div><Chip tone={navigator.onLine ? 'green' : 'gold'}>{navigator.onLine ? 'Online' : 'Offline'}</Chip></div>
          <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => navigate('/install')}>Installation & offline guide</Button><Button size="sm" variant="secondary" onClick={() => void checkForPwaUpdate()}>Check for app updates</Button></div>
          <p className="text-[11px] text-muted">Study Hub {__APP_VERSION__} · Build {__BUILD_ID__}</p>
        </Card>
      </section>
      {/* ── shortcuts ─────────────────────────────────────────────────── */}
      <section id="settings-help" className="scroll-mt-28">
        <SectionTitle hint="Press ? anywhere for this list">Keyboard</SectionTitle>
        <Card className="p-0">
          <div className="divide-y divide-line">
            {SCOPE_ORDER.map((scope) => {
              const rows = SHORTCUTS.filter((shortcut) => shortcut.where === scope)
              if (rows.length === 0) return null
              return (
                <div key={scope} className="px-4 py-3">
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {scope}
                  </h3>
                  <ul className="space-y-1.5">
                    {rows.map((shortcut) => (
                      <li
                        key={`${scope}-${shortcut.label}`}
                        className="flex items-baseline justify-between gap-3 text-[13px]"
                      >
                        <span className="min-w-0 flex-1 text-muted">{shortcut.label}</span>
                        <span className="flex shrink-0 gap-1">
                          {shortcut.keys.map((key) => (
                            <kbd
                              key={key}
                              className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]"
                            >
                              {key}
                            </kbd>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </Card>
      </section>

      <p className="mb-2 text-center text-[11px] text-muted">
        Study Hub {__APP_VERSION__} · Build {__BUILD_ID__}
      </p>
      <p className="mt-6 flex items-start gap-1.5 text-[12px] text-muted">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
        Built for Olabisi Onabanjo University students. Your personal key and learning trail stay in this browser. Signed-in PDFs are stored in private account storage; extracted text is sent to your selected AI provider only when you generate study materials.
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-gold" />
      </p>
    </div>
  )
}

function ToggleRow({
  title,
  body,
  checked,
  onChange,
  icon,
}: {
  title: string
  body: string
  checked: boolean
  onChange: (checked: boolean) => void
  icon?: ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 p-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-4 shrink-0 accent-forest"
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          {icon}
          {title}
        </span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">{body}</span>
      </span>
    </label>
  )
}

function BlockedUsersSettings() {
  const [rows, setRows] = useState<{ blocked_id: string; display_name: string }[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) { setLoading(false); return }
    const { data, error } = await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', auth.user.id).order('created_at', { ascending: false })
    if (error) { toast(error.message, 'error'); setLoading(false); return }
    const ids = (data ?? []).map((row) => row.blocked_id)
    const { data: profiles } = ids.length
      ? await supabase.from('student_profiles').select('user_id,display_name').in('user_id', ids)
      : { data: [] }
    const names = new Map((profiles ?? []).map((profile) => [profile.user_id, profile.display_name]))
    setRows(ids.map((blocked_id) => ({ blocked_id, display_name: names.get(blocked_id) ?? 'Blocked student' })))
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])
  const unblock = async (id: string) => {
    if (!supabase || busy) return
    setBusy(id)
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) { setBusy(null); return }
    const { error } = await supabase.from('user_blocks').delete().eq('blocker_id', auth.user.id).eq('blocked_id', id)
    if (error) toast(error.message, 'error')
    else { setRows((current) => current.filter((row) => row.blocked_id !== id)); toast('Student unblocked.', 'success') }
    setBusy(null)
  }
  if (loading) return <span className="text-xs text-muted">Loading…</span>
  if (!rows.length) return <span className="text-xs text-muted">No blocked accounts</span>
  return <div className="w-full space-y-2">{rows.map((row) => <div key={row.blocked_id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2"><span className="truncate text-xs font-medium">{row.display_name}</span><Button size="sm" variant="ghost" disabled={busy === row.blocked_id} onClick={() => void unblock(row.blocked_id)}>{busy === row.blocked_id ? 'Working…' : 'Unblock'}</Button></div>)}</div>
}

/** Uses the same staged model mix as the upload cost preview. */
function estimateFor40Pages(model: Parameters<typeof estimateGenerationCost>[1]): number {
  const samplePages = Array.from({ length: 40 }, () => 'x'.repeat(2_500))
  return estimateGenerationCost(samplePages, model).usd
}


type NotificationPrefs = {
  direct_messages: boolean
  replies: boolean
  mentions: boolean
  reactions: boolean
  collaboration_invites: boolean
  course_discussions: boolean
  suggested_connections: boolean
  product_announcements: boolean
  quiet_hours_enabled: boolean
  quiet_hours_start: string
  quiet_hours_end: string
  time_zone: string
  pause_all: boolean
}
const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  direct_messages: true, replies: true, mentions: true, reactions: true,
  collaboration_invites: true, course_discussions: false, suggested_connections: false,
  product_announcements: false, quiet_hours_enabled: false,
  quiet_hours_start: '22:00', quiet_hours_end: '07:00', time_zone: 'UTC', pause_all: false,
}
function NotificationPreferences() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [vapidKey, setVapidKey] = useState('')
  useEffect(() => {
    let active = true
    const load = async () => {
      const pushAvailable = supportsWebPush()
      setPushSupported(pushAvailable)
      const publicKeyPromise = pushAvailable ? getVapidPublicKey().catch(() => '') : Promise.resolve('')
      if (!supabase) { if (active) { setLoading(false); setVapidKey(await publicKeyPromise) }; return }
      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      const user = auth.user
      if (!user) { if (active) { setUserId(null); setVapidKey(await publicKeyPromise); setLoading(false) }; return }
      const { data, error } = await supabase.from('notification_preferences').select('*').eq('user_id', user.id).maybeSingle()
      if (error) throw error
      const initial = {
        ...DEFAULT_NOTIFICATION_PREFS,
        ...(data ?? {}),
        quiet_hours_start: typeof data?.quiet_hours_start === 'string' ? data.quiet_hours_start.slice(0, 5) : DEFAULT_NOTIFICATION_PREFS.quiet_hours_start,
        quiet_hours_end: typeof data?.quiet_hours_end === 'string' ? data.quiet_hours_end.slice(0, 5) : DEFAULT_NOTIFICATION_PREFS.quiet_hours_end,
        time_zone: typeof data?.time_zone === 'string' ? data.time_zone : (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'),
      }
      if (!data) {
        const { error: insertError } = await supabase.from('notification_preferences').insert({ user_id: user.id, time_zone: initial.time_zone })
        if (insertError) throw insertError
      }
      let hasSubscription = false
      if (supportsWebPush()) {
        try {
          const registration = await navigator.serviceWorker.ready
          hasSubscription = Boolean(await registration.pushManager.getSubscription())
        } catch { hasSubscription = false }
      }
      const publicKey = await publicKeyPromise
      if (active) { setUserId(user.id); setPrefs(initial); setPushEnabled(hasSubscription); setVapidKey(publicKey); setLoading(false) }
    }
    void load().catch(error => { if (active) { setLoading(false); toast(error instanceof Error ? error.message : 'Notification preferences could not be loaded.', 'error') } })
    return () => { active = false }
  }, [])
  const change = async (key: keyof NotificationPrefs, value: boolean) => {
    if (!supabase || !userId || saving) return
    const previous = prefs
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    setSaving(true)
    try {
      const { error } = await supabase.from('notification_preferences').upsert({ user_id: userId, ...next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      if (error) throw error
    } catch (error) {
      setPrefs(previous)
      toast(error instanceof Error ? error.message : 'Preference could not be saved.', 'error')
    } finally { setSaving(false) }
  }
  const enablePush = async () => {
    if (!supabase || !userId || !vapidKey || pushBusy) return
    setPushBusy(true)
    try {
      const subscription = await registerCurrentDeviceForPush(vapidKey)
      const details = subscription.toJSON()
      const p256dh = details.keys?.p256dh
      const authSecret = details.keys?.auth
      if (!p256dh || !authSecret) throw new Error('The browser did not return the required encryption keys.')
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: userId, endpoint: subscription.endpoint, p256dh, auth_secret: authSecret,
        expiration_time: subscription.expirationTime ? new Date(subscription.expirationTime).toISOString() : null,
        user_agent: navigator.userAgent.slice(0, 300), updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,endpoint' })
      if (error) throw error
      setPushEnabled(true)
      toast('This device is registered for Study Hub push notifications.', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'This device could not be registered for notifications.', 'error')
    } finally { setPushBusy(false) }
  }
  const disablePush = async () => {
    if (!supabase || !userId || pushBusy) return
    setPushBusy(true)
    try {
      const endpoint = await removeCurrentDevicePushSubscription()
      if (endpoint) {
        const { error } = await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint)
        if (error) throw error
      }
      setPushEnabled(false)
      toast('Push subscription removed from this device.', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'The device subscription could not be removed.', 'error')
    } finally { setPushBusy(false) }
  }
  const changeTime = async (key: 'quiet_hours_start' | 'quiet_hours_end', value: string) => {
    if (!supabase || !userId || saving || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return
    const previous = prefs
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    setSaving(true)
    try {
      const { error } = await supabase.from('notification_preferences').upsert(
        { user_id: userId, ...next, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
      if (error) throw error
    } catch (error) {
      setPrefs(previous)
      toast(error instanceof Error ? error.message : 'Quiet hours could not be saved.', 'error')
    } finally {
      setSaving(false)
    }
  }
  if (loading) return <Card className="p-4 text-sm text-muted">Loading notification preferences…</Card>
  if (!userId) return <Card className="p-4 text-sm text-muted">Sign in to save notification preferences and register this device.</Card>
  return <Card className="divide-y divide-line p-0">
    <ToggleRow title="Pause all notifications" body="Temporarily turn off notification categories without changing each preference." checked={prefs.pause_all} onChange={value => void change('pause_all', value)} />
    <ToggleRow title="Direct messages" body="Notify me when a student sends a message." checked={prefs.direct_messages} onChange={value => void change('direct_messages', value)} />
    <ToggleRow title="Replies to my posts" body="Notify me when someone replies to my research posts." checked={prefs.replies} onChange={value => void change('replies', value)} />
    <ToggleRow title="Mentions" body="Notify me when someone mentions me in a discussion." checked={prefs.mentions} onChange={value => void change('mentions', value)} />
    <ToggleRow title="Reactions" body="Notify me about reactions to my contributions." checked={prefs.reactions} onChange={value => void change('reactions', value)} />
    <ToggleRow title="Collaboration invitations" body="Notify me about invitations to academic projects and groups." checked={prefs.collaboration_invites} onChange={value => void change('collaboration_invites', value)} />
    <ToggleRow title="Course discussions" body="Notify me about activity in courses I follow." checked={prefs.course_discussions} onChange={value => void change('course_discussions', value)} />
    <ToggleRow title="Suggested connections" body="Allow occasional suggestions for relevant academic peers." checked={prefs.suggested_connections} onChange={value => void change('suggested_connections', value)} />
    <ToggleRow title="Product announcements" body="Receive important Study Hub product updates." checked={prefs.product_announcements} onChange={value => void change('product_announcements', value)} />
    <div className="border-t border-line p-4">
      <ToggleRow title="Quiet hours" body="Pause push notifications during the hours you choose. Times use this device's local clock." checked={prefs.quiet_hours_enabled} onChange={value => void change('quiet_hours_enabled', value)} />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-xs text-muted">
          Start
          <input
            type="time"
            value={prefs.quiet_hours_start}
            disabled={!prefs.quiet_hours_enabled || saving}
            onChange={event => void changeTime('quiet_hours_start', event.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-line bg-app px-2 text-sm text-body disabled:opacity-50"
          />
        </label>
        <label className="text-xs text-muted">
          End
          <input
            type="time"
            value={prefs.quiet_hours_end}
            disabled={!prefs.quiet_hours_enabled || saving}
            onChange={event => void changeTime('quiet_hours_end', event.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-line bg-app px-2 text-sm text-body disabled:opacity-50"
          />
        </label>
      </div>
      <p className="mt-2 text-[11px] text-muted">Quiet hours use {prefs.time_zone || 'your device timezone'} and are enforced by the server-side sender. In-app notifications remain available at all times.</p>
    </div>
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">This device's push subscription</p><p className="mt-1 text-xs text-muted">{pushEnabled ? 'This browser has a registered subscription.' : 'Register this device to prepare it for Web Push.'}</p></div>
        {pushEnabled ? <Button size="sm" variant="secondary" disabled={pushBusy} onClick={() => void disablePush()}>{pushBusy ? 'Working…' : 'Disable on this device'}</Button> : <Button size="sm" disabled={!pushSupported || !vapidKey || pushBusy} onClick={() => void enablePush()}>{pushBusy ? 'Registering…' : 'Enable on this device'}</Button>}
      </div>
      {!pushSupported ? <p className="mt-2 text-[11px] text-muted">This browser does not support Web Push.</p> : !vapidKey ? <p className="mt-2 text-[11px] text-muted">The server could not provide the public VAPID key. Push delivery remains unavailable until the server configuration is restored.</p> : <p className="mt-2 text-[11px] text-muted">On iPhone and iPad, install Study Hub to the Home Screen before enabling Web Push. The public VAPID key is fetched from the server; the private signing key never reaches this device.</p>}
    </div>
  </Card>
}
