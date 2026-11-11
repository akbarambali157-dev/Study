import { useCallback, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  FileText,
  Loader2,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { PageHeading } from '@/components/PageShell'
import { Button } from '@/components/ui/Button'
import { Card, Chip, Progress } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { hasApiKey } from '@/lib/apiKey'
import { estimateGenerationCost, formatUsd, modelInfo, nairaHint } from '@/lib/cost'
import { useSettings } from '@/lib/hooks'
import { AiError, redactSecrets } from '@/lib/llm/ai'
import { generateStudyMaterial, STAGE_LABEL, type Stage } from '@/lib/llm/pipeline'
import { cachePdfBlob, extractPdf, MAX_PAGES, PdfError, type ExtractedPdf } from '@/lib/pdf'
import { saveDocument, touchStreak } from '@/lib/store'
import type { DocumentRec } from '@/lib/types'
import { nowIso, stripExtension, titleCase, uid } from '@/lib/utils'

const STAGE_ORDER: Stage[] = ['extract', 'map', 'reduce', 'orgs', 'cards', 'quiz']

/**
 * Patterns that mark a document as somebody's personal record rather than
 * lecture material. The repo already contains one result slip, so this is not
 * a hypothetical: a warning here is the cheapest place to stop it reaching the
 * API or a share link.
 */
const PII_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /result\s+slip|statement\s+of\s+result/i, label: '“result slip”' },
  { re: /matric(ulation)?\s*(no|number|num)/i, label: 'a matriculation number' },
  { re: /\bcgpa\b|grade\s+point\s+average/i, label: 'CGPA / GPA' },
  { re: /\bdate\s+of\s+birth\b|\bJAMB\s+reg/i, label: 'personal identifiers' },
]

function findPiiSignal(fileName: string, pages: string[]): string | null {
  const haystack = `${fileName}\n${pages.slice(0, 2).join('\n')}`
  for (const { re, label } of PII_PATTERNS) {
    if (re.test(haystack)) return label
  }
  return null
}

type FilePhase =
  | { kind: 'idle' }
  | { kind: 'reading'; done: number; total: number }
  | { kind: 'ready' }
  | { kind: 'running'; stage: Stage; detail?: string }
  | { kind: 'done'; docId: string }
  | { kind: 'error'; message: string }

type QueuedFile = {
  id: string
  file: File
  extracted: ExtractedPdf | null
  title: string
  phase: FilePhase
  pii: string | null
  piiAcknowledged: boolean
}

export function UploadPage() {
  const navigate = useNavigate()
  const settings = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [files, setFiles] = useState<QueuedFile[]>([])
  const [dragging, setDragging] = useState(false)

  const keyReady = hasApiKey()
  const info = modelInfo(settings.model)

  // ── helpers ──────────────────────────────────────────────────────────────

  const isBusy = files.some((f) => f.phase.kind === 'reading' || f.phase.kind === 'running')

  const addFiles = useCallback(
    (picked: FileList | File[]) => {
      const newFiles = Array.from(picked)
      const toAdd: QueuedFile[] = []
      for (const f of newFiles) {
        if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') {
          toast(`“${f.name}” is not a PDF.`, 'error')
          continue
        }
        toAdd.push({
          id: uid('file'),
          file: f,
          extracted: null,
          title: '',
          phase: { kind: 'idle' },
          pii: null,
          piiAcknowledged: false,
        })
      }
      if (toAdd.length === 0) return
      setFiles((prev) => [...prev, ...toAdd])
      // Kick off extraction for each newly added file.
      for (const item of toAdd) {
        void extractFile(item.id)
      }
    },
    [],
  )

  const extractFile = useCallback(
    async (id: string) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, phase: { kind: 'reading', done: 0, total: 0 } } : f,
        ),
      )
      const item = files.find((f) => f.id === id)
      if (!item) return

      try {
        const result = await extractPdf(item.file, (done, total) => {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === id
                ? { ...f, phase: { kind: 'reading', done, total } }
                : f,
            ),
          )
        })
        setFiles((prev) =>
          prev.map((f) =>
            f.id === id
              ? {
                  ...f,
                  extracted: result,
                  title: titleCase(result.title || stripExtension(item.file.name)),
                  pii: findPiiSignal(item.file.name, result.pages),
                  phase: { kind: 'ready' },
                }
              : f,
          ),
        )
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === id
              ? {
                  ...f,
                  phase: {
                    kind: 'error',
                    message:
                      err instanceof PdfError
                        ? err.message
                        : 'This PDF could not be read. It may be damaged or password-protected.',
                  },
                }
              : f,
          ),
        )
      }
    },
    [files],
  )

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const resetFile = useCallback((id: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              extracted: null,
              title: '',
              phase: { kind: 'idle' },
              pii: null,
              piiAcknowledged: false,
            }
          : f,
      ),
    )
  }, [])

  // ── per-file title & PII ────────────────────────────────────────────────

  const setFileTitle = useCallback((id: string, value: string) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, title: value } : f)))
  }, [])

  const togglePiiAck = useCallback((id: string, checked: boolean) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, piiAcknowledged: checked } : f)))
  }, [])

  // ── run generation for one file ─────────────────────────────────────────

  const runFile = useCallback(
    async (id: string) => {
      const item = files.find((f) => f.id === id)
      if (!item || !item.extracted) return
      if (!keyReady) {
        toast('Add your API key in Settings first — it stays in this browser.', 'error')
        return
      }
      if (item.pii && !item.piiAcknowledged) {
        toast('Tick the personal-document warning first.', 'error')
        return
      }

      const doc: DocumentRec = {
        id: uid('doc'),
        title: item.title.trim() || stripExtension(item.file.name),
        fileName: item.file.name,
        pageCount: item.extracted.pageCount,
        pages: item.extracted.pages,
        createdAt: nowIso(),
        status: 'extracting',
        source: 'upload',
        sizeBytes: item.file.size,
      }

      await saveDocument(doc)
      await cachePdfBlob(doc.id, item.file)

      const controller = new AbortController()
      abortRef.current = controller
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, phase: { kind: 'running', stage: 'map' } }
            : f,
        ),
      )

      try {
        const result = await generateStudyMaterial({
          doc,
          model: settings.model,
          baseUrl: settings.baseUrl || undefined,
          signal: controller.signal,
          useProxy: settings.useProxy,
          onStage: (stage, detail) => {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === id
                  ? { ...f, phase: { kind: 'running', stage, detail } }
                  : f,
              ),
            )
          },
        })

        await saveDocument({ ...doc, status: 'ready' })
        await touchStreak()
        setFiles((prev) =>
          prev.map((f) =>
            f.id === id
              ? { ...f, phase: { kind: 'done', docId: doc.id } }
              : f,
          ),
        )
        toast(
          `${result.keyPointCount} key points, ${result.cardCount} cards — ${formatUsd(
            result.costUsd,
          )} for “${doc.title}”.`,
          'success',
        )
        navigate(`/doc/${doc.id}`)
      } catch (err) {
        const stopped = controller.signal.aborted
        await saveDocument({ ...doc, status: stopped ? 'extracting' : 'failed' })
        if (stopped) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === id ? { ...f, phase: { kind: 'ready' } } : f,
            ),
          )
          toast('Stopped. Nothing else will be spent on this PDF.')
          return
        }
        const message =
          err instanceof AiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Generation failed.'
        setFiles((prev) =>
          prev.map((f) =>
            f.id === id
              ? { ...f, phase: { kind: 'error', message: redactSecrets(message) } }
              : f,
          ),
        )
      } finally {
        abortRef.current = null
      }
    },
    [files, keyReady, navigate, settings.baseUrl, settings.model],
  )

  const runAll = useCallback(async () => {
    const ready = files.filter(
      (f) => f.phase.kind === 'ready' && f.extracted && !f.pii,
    )
    if (ready.length === 0) return
    for (const item of ready) {
      await runFile(item.id)
      // Small gap so toasts are readable.
      await new Promise((r) => setTimeout(r, 800))
    }
  }, [files, runFile])

  // ── render helpers ──────────────────────────────────────────────────────

  const phaseLabel = (phase: FilePhase): string => {
    if (phase.kind === 'idle') return 'Idle'
    if (phase.kind === 'reading') return `Reading page ${phase.done || 1}…`
    if (phase.kind === 'ready') return 'Ready'
    if (phase.kind === 'running')
      return `${STAGE_LABEL[phase.stage as Stage]}${phase.detail ? ` — ${phase.detail}` : ''}`
    if (phase.kind === 'done') return 'Done'
    if (phase.kind === 'error') return 'Error'
    return ''
  }

  const renderFileCard = (item: QueuedFile) => {
    const { extracted } = item
    const estimate = extracted
      ? estimateGenerationCost(extracted.pages, settings.model)
      : null

    const isRunning = item.phase.kind === 'running'
    const isReading = item.phase.kind === 'reading'
    const busy = isRunning || isReading

    const stageIndex =
      item.phase.kind === 'running' ? STAGE_ORDER.indexOf(item.phase.stage) : -1
    const stagePct =
      item.phase.kind === 'running'
        ? Math.round(((stageIndex + 1) / STAGE_ORDER.length) * 100)
        : 0

    return (
      <Card
        key={item.id}
        className={[
          'key-point-card transition',
          busy ? 'opacity-80' : '',
          item.phase.kind === 'done' ? 'border-forest-400 bg-forest-400/5' : '',
        ].join(' ')}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="size-4 text-forest-400" />
              <span
                className={[
                  'text-sm font-semibold truncate',
                  item.phase.kind === 'done' ? 'text-forest-400' : 'text-body',
                ].join(' ')}
              >
                {item.file.name}
              </span>
              {item.phase.kind === 'done' && (
                <Chip tone="green" className="text-[10px]">
                  Done
                </Chip>
              )}
              {item.phase.kind === 'error' && (
                <Chip tone="clay" className="text-[10px]">
                  Error
                </Chip>
              )}
            </div>
            <p className="text-[12px] text-muted leading-relaxed">
              {phaseLabel(item.phase)}
              {item.phase.kind === 'error' ? ` — ${item.phase.message}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            {!busy && item.phase.kind !== 'done' && item.phase.kind !== 'error' ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeFile(item.id)}
                icon={<Trash2 className="size-3.5" />}
                aria-label={`Remove ${item.file.name}`}
              />
            ) : null}
            {!busy && item.phase.kind === 'idle' ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => resetFile(item.id)}
                icon={<X className="size-3.5" />}
                aria-label={`Reset ${item.file.name}`}
              />
            ) : null}
            {busy && item.phase.kind === 'running' ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => abortRef.current?.abort()}
                icon={<X className="size-3.5" />}
              >
                Stop
              </Button>
            ) : null}
          </div>
        </div>

        {/* reading progress */}
        {item.phase.kind === 'reading' && (
          <div className="mb-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted">
              <Loader2 className="size-4 animate-spin text-forest-400" />
              Reading page {item.phase.done || 1}
              {item.phase.total ? ` of ${item.phase.total}` : ''}…
            </div>
            <Progress
              className="mt-2"
              value={item.phase.total ? item.phase.done : 20}
              max={item.phase.total || 100}
            />
          </div>
        )}

        {/* PII warning */}
        {item.pii && !item.piiAcknowledged && (
          <Card className="mb-3 border-clay/40 bg-clay-soft/40">
            <div className="flex gap-3">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-clay" />
              <div>
                <h2 className="text-sm font-semibold text-clay">This looks personal</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-body">
                  This file appears to contain {item.pii}. Personal records like result slips do
                  not belong in a study app.
                </p>
                <label className="mt-3 flex cursor-pointer items-start gap-2 text-[13px] text-body">
                  <input
                    type="checkbox"
                    checked={item.piiAcknowledged}
                    onChange={(event) => togglePiiAck(item.id, event.target.checked)}
                    className="mt-0.5 size-4 accent-clay"
                  />
                  <span>
                    I understand, and I want to process this file anyway.
                  </span>
                </label>
              </div>
            </div>
          </Card>
        )}

        {/* ready card */}
        {item.phase.kind === 'ready' && extracted && (
          <>
            <label className="block text-xs font-medium uppercase tracking-wide text-muted mb-1">
              Title
            </label>
            <input
              value={item.title}
              onChange={(event) => setFileTitle(item.id, event.target.value)}
              className="h-10 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none focus:border-forest-400 mb-3"
            />

            <dl className="grid grid-cols-2 gap-3 text-sm mb-3">
              <div>
                <dt className="text-xs text-muted">Pages</dt>
                <dd className="tnum font-semibold">{extracted.pageCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Model</dt>
                <dd className="font-semibold">{info.label}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Estimated cost</dt>
                <dd className="tnum font-semibold">
                  {estimate ? formatUsd(estimate.usd) : '—'}
                  {estimate ? (
                    <span className="ml-1 text-xs font-normal text-muted">
                      ≈{nairaHint(estimate.usd)}
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Tokens</dt>
                <dd className="tnum font-semibold">
                  {estimate ? `~${Math.round(estimate.inputTokens / 1000)}k in` : '—'}
                </dd>
              </div>
            </dl>

            {!keyReady && (
              <p className="mt-2 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-[12px]">
                You need your own API key first.{' '}
                <Link to="/settings" className="font-semibold underline">
                  Add it in Settings
                </Link>{' '}
                — it stays in this browser.
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                onClick={() => void runFile(item.id)}
                disabled={!keyReady || (Boolean(item.pii) && !item.piiAcknowledged)}
                icon={<Sparkles className="size-4" />}
              >
                Generate
              </Button>
            </div>

          </>
        )}

        {/* running progress */}
        {item.phase.kind === 'running' && (
          <div className="mt-3">
            <div className="flex items-center justify-between gap-3 text-sm font-semibold text-muted mb-2">
              <Loader2 className="size-4 animate-spin text-forest-400" />
              {STAGE_LABEL[item.phase.stage]}
              {item.phase.detail ? (
                <span className="text-xs">{item.phase.detail}</span>
              ) : null}
            </div>
            <Progress className="mb-3" value={stagePct} />
            <ol className="space-y-1.5 text-[12px]">
              {STAGE_ORDER.map((stage, index) => {
                const done = index < stageIndex
                const active = index === stageIndex
                return (
                  <li
                    key={stage}
                    className={[
                      'flex items-center gap-2',
                      done ? 'text-forest-400' : active ? 'font-semibold' : 'text-muted',
                    ].join(' ')}
                  >
                    {done ? (
                      <Check className="size-3.5" />
                    ) : active ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <span className="size-3.5 rounded-full border border-line" />
                    )}
                    {STAGE_LABEL[stage]}
                  </li>
                )
              })}
            </ol>
          </div>
        )}

        {/* done */}
        {item.phase.kind === 'done' && (
          <p className="mt-2 text-xs text-forest-400 font-medium">
            Study set ready.{' '}
            <ArrowRight className="inline size-3.5 ml-1" />
          </p>
        )}
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading
        title="Add material"
        subtitle="Drop one or more lecture PDFs. Each becomes notes, cards and a test."
        back={{ to: '/library', label: 'Library' }}
      />

      {/* ── dropzone ───────────────────────────────────────────────────── */}
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          if (isBusy) return
          const dropped = event.dataTransfer.files
          if (dropped?.length) void addFiles(dropped)
        }}
        className={[
          'rounded-2xl border-2 border-dashed px-6 py-10 text-center transition key-point-card',
          dragging ? 'border-forest-400 bg-forest-400/5' : 'border-line bg-surface/60',
          isBusy ? 'opacity-60' : '',
        ].join(' ')}
      >
        {files.length > 0 ? (
          <div className="flex flex-col items-center gap-2">
            <FileText className="size-7 text-forest-400" />
            <p className="text-sm font-semibold">
              {files.length} file{files.length === 1 ? '' : 's'} queued
            </p>
            <p className="text-xs text-muted">
              {files.filter((f) => f.phase.kind === 'done').length} done ·{' '}
              {files.filter((f) => f.phase.kind === 'error').length} failed
            </p>
            {!isBusy ? (
              <Button size="sm" variant="ghost" onClick={() => setFiles([])} icon={<X className="size-3.5" />}>
                Clear all
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <Upload className="mx-auto size-7 text-muted" />
            <p className="mt-3 font-display text-base font-semibold">
              Drop PDFs here, or choose files
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Lecture notes, slides, handouts. Up to {MAX_PAGES} pages each, with selectable
              text — scans are refused rather than guessed at.
            </p>
            <Button className="mt-5" onClick={() => fileRef.current?.click()}>
              Choose PDFs
            </Button>
          </>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          onChange={(event) => {
            const picked = event.target.files
            if (picked?.length) void addFiles(picked)
          }}
        />
      </div>

      {/* ── file list ───────────────────────────────────────────────────── */}
      {files.length > 0 && (
        <div className="mt-6 space-y-3">
          {files.map((item) => renderFileCard(item))}
        </div>
      )}

      {/* ── generate all ────────────────────────────────────────────────── */}
      {files.length > 0 && (
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Button
            onClick={runAll}
            disabled={isBusy || !files.some((f) => f.phase.kind === 'ready')}
            icon={<Sparkles className="size-4" />}
          >
            {isBusy ? 'Processing…' : 'Generate all ready'}
          </Button>
          {keyReady ? null : (
            <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>
              Add API key
            </Button>
          )}
        </div>
      )}

      {!keyReady && files.length === 0 && (
        <p className="mt-6 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-[13px]">
          You need your own API key first.{' '}
          <Link to="/settings" className="font-semibold underline">
            Add it in Settings
          </Link>{' '}
          — it is stored in this browser and never sent anywhere except the API.
        </p>
      )}

      <p className="mt-8 flex items-center gap-1.5 text-xs text-muted">
        <Chip tone="green">Private by default</Chip>
        The PDF text is sent to the AI provider to generate notes. Nothing is sent to us —
        there is no server.
      </p>
    </div>
  )
}
