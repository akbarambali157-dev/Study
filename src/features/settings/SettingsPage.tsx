import { useEffect, useState, type ReactNode } from 'react'
import {
  Check,
  Download,
  KeyRound,
  Moon,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { PageHeading, SectionTitle } from '@/components/PageShell'
import { Button } from '@/components/ui/Button'
import { Card, Chip } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import {
  clearApiKey,
  getApiKey,
  hasApiKey,
  isPersisted,
  looksLikeApiKey,
  maskKey,
  saveApiKey,
} from '@/lib/apiKey'
import { formatUsd, MODELS } from '@/lib/cost'
import { db, saveSettings, wipeEverything } from '@/lib/db'
import { useSettings } from '@/lib/hooks'
import { downloadFile } from '@/lib/export'
import { SCOPE_ORDER, SHORTCUTS } from '@/lib/shortcuts'
import { cn } from '@/lib/utils'

export function SettingsPage() {
  const settings = useSettings()

  const [keyInput, setKeyInput] = useState('')
  const [storedKey, setStoredKey] = useState<string | null>(null)
  const [persist, setPersist] = useState(false)
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl ?? '')
  const [confirmWipe, setConfirmWipe] = useState(false)

  useEffect(() => {
    setStoredKey(getApiKey())
    setPersist(isPersisted())
  }, [])

  useEffect(() => {
    setBaseUrl(settings.baseUrl ?? '')
  }, [settings.baseUrl])

  const saveKey = () => {
    const trimmed = keyInput.trim()
    if (!trimmed) {
      toast('Paste a key first.', 'error')
      return
    }
    if (!looksLikeApiKey(trimmed)) {
      toast('That does not look like an API key. It should start with sk-ant- or be an issued token.', 'error')
      return
    }
    saveApiKey(trimmed, persist)
    setStoredKey(trimmed)
    setKeyInput('')
    toast('Key saved. It stays in this browser.', 'success')
  }

  const removeKey = () => {
    clearApiKey()
    setStoredKey(null)
    toast('Key removed from this browser.', 'success')
  }

  const exportAll = async () => {
    const [documents, notes, keyPoints, decks, cards, reviews, inquiries, profile] =
      await Promise.all([
        db.documents.toArray(),
        db.notes.toArray(),
        db.keyPoints.toArray(),
        db.decks.toArray(),
        db.cards.toArray(),
        db.reviews.toArray(),
        db.inquiries.toArray(),
        db.profile.toArray(),
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
    clearApiKey()
    setStoredKey(null)
    setConfirmWipe(false)
    toast('Everything deleted from this browser.', 'success')
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading title="Settings" subtitle="Your key, your model, your data." />

      {/* ── API key ────────────────────────────────────────────────────── */}
      <section className="mb-6">
        <SectionTitle hint="Takes the place of a login: only you can spend it">
          API key
        </SectionTitle>
        <Card>
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 size-5 shrink-0 text-forest-400" />
            <div className="min-w-0 flex-1">
              {storedKey ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-surface-2 px-2 py-1 font-mono text-[13px]">
                      {maskKey(storedKey)}
                    </code>
                    <Chip tone={persist ? 'green' : 'neutral'}>
                      {persist ? 'Saved on this device' : 'This tab only'}
                    </Chip>
                  </div>
                  <p className="mt-2 text-[13px] text-muted">
                    {persist
                      ? 'It survives a reload. Do not do this on a shared or lab machine.'
                      : 'It is cleared when this tab closes. Tick “remember” below to keep it.'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="danger" onClick={removeKey} icon={<Trash2 className="size-3.5" />}>
                      Remove key
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        saveApiKey(storedKey, !persist)
                        setPersist(!persist)
                        toast(!persist ? 'Now remember this device.' : 'Now this tab only.')
                      }}
                    >
                      {persist ? 'Stop remembering' : 'Remember on this device'}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[13px] leading-relaxed text-muted">
                    Add your own API key. It is stored in this browser and sent only to the
                    API — there is no server here to hold it.
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
                    <Button onClick={saveKey} disabled={!hasApiKey() && !keyInput.trim()}>
                      Save key
                    </Button>
                  </div>
                  <label className="mt-3 flex cursor-pointer items-start gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      checked={persist}
                      onChange={(event) => setPersist(event.target.checked)}
                      className="mt-0.5 size-4 accent-forest"
                    />
                    <span>
                      Remember this key on this device
                      <span className="block text-[12px] text-muted">
                        Leave it off on a shared computer — the key then dies with the tab.
                      </span>
                    </span>
                  </label>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 border-t border-line pt-4">
            <label className="text-xs font-medium uppercase tracking-wide text-muted">
              API base URL (optional)
            </label>
            <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
              <input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://api.anthropic.com"
                spellCheck={false}
                className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-app px-3 font-mono text-[12px] outline-none focus:border-forest-400"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await saveSettings({ baseUrl: baseUrl.trim() || undefined })
                  toast('Saved.', 'success')
                }}
              >
                Save
              </Button>
            </div>
            <p className="mt-1.5 text-[12px] text-muted">
              Only needed if you use an Anthropic-compatible gateway. Leave it empty for the
              standard API.
            </p>
          </div>
        </Card>
      </section>

      {/* ── model ─────────────────────────────────────────────────────── */}
      <section className="mb-6">
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
                    ≈{formatUsd(estimateFor40Pages(model.inputPerMTok, model.outputPerMTok))} per
                    handout
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{model.note}</p>
              </button>
            )
          })}
        </div>
      </section>

      {/* ── preferences ───────────────────────────────────────────────── */}
      <section className="mb-6">
        <SectionTitle>Preferences</SectionTitle>
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

      {/* ── data ──────────────────────────────────────────────────────── */}
      <section className="mb-6">
        <SectionTitle hint="No account, no server — so this is the whole story">
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
              This erases documents, notes, cards, grades, tests, the trail and your key from
              this browser. It cannot be undone.
            </p>
          ) : null}
          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            PDFs never leave this device. Their text is sent to the model to generate notes.
            If you have a result slip or any personal record in a PDF, do not upload it.
          </p>
        </Card>
      </section>

      {/* ── shortcuts ─────────────────────────────────────────────────── */}
      <section>
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

      <p className="mt-6 flex items-start gap-1.5 text-[12px] text-muted">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
        Built for Olabisi Onabanjo University students. Your key, your documents and your
        trail stay in your browser.
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

/** Matches the estimate printed on the upload screen, for comparison shopping. */
function estimateFor40Pages(inputPerMTok: number, outputPerMTok: number): number {
  const inputTokens = 46_000
  const outputTokens = 15_000
  return (
    (inputTokens / 1_000_000) * inputPerMTok + (outputTokens / 1_000_000) * outputPerMTok
  )
}
