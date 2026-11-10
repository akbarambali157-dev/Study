import { useCallback, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Check,
  FileText,
  Loader2,
  ShieldAlert,
  Sparkles,
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

type Phase =
  | { kind: 'idle' }
  | { kind: 'reading'; done: number; total: number }
  | { kind: 'ready' }
  | { kind: 'running'; stage: Stage; detail?: string }
  | { kind: 'done'; docId: string }

export function UploadPage() {
  const navigate = useNavigate()
  const settings = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [file, setFile] = useState<File | null>(null)
  const [extracted, setExtracted] = useState<ExtractedPdf | null>(null)
  const [title, setTitle] = useState('')
  const [pii, setPii] = useState<string | null>(null)
  const [piiAcknowledged, setPiiAcknowledged] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const keyReady = hasApiKey()
  const estimate = extracted ? estimateGenerationCost(extracted.pages, settings.model) : null
  const info = modelInfo(settings.model)

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setPhase({ kind: 'idle' })
    setFile(null)
    setExtracted(null)
    setTitle('')
    setPii(null)
    setPiiAcknowledged(false)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  const accept = useCallback(
    async (picked: File) => {
      setError(null)
      abortRef.current?.abort()
      setFile(picked)
      setExtracted(null)
      setPii(null)
      setPiiAcknowledged(false)
      setPhase({ kind: 'reading', done: 0, total: 0 })

      if (!/\.pdf$/i.test(picked.name) && picked.type !== 'application/pdf') {
        setError('That is not a PDF. Export the document as PDF and try again.')
        setPhase({ kind: 'idle' })
        return
      }

      try {
        const result = await extractPdf(picked, (done, total) => {
          setPhase({ kind: 'reading', done, total })
        })
        setExtracted(result)
        setTitle(titleCase(result.title || stripExtension(picked.name)))
        setPii(findPiiSignal(picked.name, result.pages))
        setPhase({ kind: 'ready' })
      } catch (err) {
        setError(
          err instanceof PdfError
            ? err.message
            : 'This PDF could not be read. It may be damaged or password-protected.',
        )
        setPhase({ kind: 'idle' })
      }
    },
    [],
  )

  const run = useCallback(async () => {
    if (!file || !extracted) return
    if (!keyReady) {
      toast('Add your API key in Settings first — it stays in this browser.', 'error')
      return
    }
    if (pii && !piiAcknowledged) {
      toast('Tick the personal-document warning first.', 'error')
      return
    }

    const doc: DocumentRec = {
      id: uid('doc'),
      title: title.trim() || stripExtension(file.name),
      fileName: file.name,
      pageCount: extracted.pageCount,
      pages: extracted.pages,
      createdAt: nowIso(),
      status: 'extracting',
      source: 'upload',
      sizeBytes: file.size,
    }

    await saveDocument(doc)
    // The binary stays on this device only; it exists so a citation can open
    // the real page in the browser's PDF viewer later.
    await cachePdfBlob(doc.id, file)

    const controller = new AbortController()
    abortRef.current = controller
    setPhase({ kind: 'running', stage: 'map' })

    try {
      const result = await generateStudyMaterial({
        doc,
        model: settings.model,
        baseUrl: settings.baseUrl || undefined,
        signal: controller.signal,
        onStage: (stage, detail) => setPhase({ kind: 'running', stage, detail }),
      })

      await saveDocument({ ...doc, status: 'ready' })
      await touchStreak()
      setPhase({ kind: 'done', docId: doc.id })
      toast(
        `${result.keyPointCount} key points, ${result.cardCount} cards, ${result.orgCount} links — ${formatUsd(result.costUsd)}.`,
        'success',
      )
      navigate(`/doc/${doc.id}`)
    } catch (err) {
      const stopped = controller.signal.aborted
      await saveDocument({ ...doc, status: stopped ? 'extracting' : 'failed' })
      if (stopped) {
        setPhase({ kind: 'ready' })
        toast('Stopped. Nothing else will be spent on this PDF.')
        return
      }
      const message =
        err instanceof AiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Generation failed.'
      setError(redactSecrets(message))
      setPhase({ kind: 'ready' })
    } finally {
      abortRef.current = null
    }
  }, [extracted, file, keyReady, navigate, pii, piiAcknowledged, settings.baseUrl, settings.model, title])

  const busy = phase.kind === 'reading' || phase.kind === 'running'
  const stageIndex = phase.kind === 'running' ? STAGE_ORDER.indexOf(phase.stage) : -1
  const stagePct =
    phase.kind === 'running' ? Math.round(((stageIndex + 1) / STAGE_ORDER.length) * 100) : 0

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeading
        title="Add material"
        subtitle="One lecture handout becomes notes, cards, a test and a trail."
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
          if (busy) return
          const dropped = event.dataTransfer.files?.[0]
          if (dropped) void accept(dropped)
        }}
        className={[
          'rounded-2xl border-2 border-dashed px-6 py-10 text-center transition',
          dragging ? 'border-forest-400 bg-forest-400/5' : 'border-line bg-surface/60',
          busy ? 'opacity-60' : '',
        ].join(' ')}
      >
        {file ? (
          <div className="flex flex-col items-center gap-2">
            <FileText className="size-7 text-forest-400" />
            <p className="text-sm font-semibold">{file.name}</p>
            <p className="text-xs text-muted">
              {(file.size / 1024 / 1024).toFixed(1)} MB
              {extracted ? ` · ${extracted.pageCount} pages` : ''}
            </p>
            {!busy ? (
              <Button size="sm" variant="ghost" onClick={reset} icon={<X className="size-3.5" />}>
                Choose another
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <Upload className="mx-auto size-7 text-muted" />
            <p className="mt-3 font-display text-base font-semibold">
              Drop a PDF here, or choose one
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Lecture notes, slides, a handout. Up to {MAX_PAGES} pages, with selectable
              text — scans are refused rather than guessed at.
            </p>
            <Button className="mt-5" onClick={() => fileRef.current?.click()}>
              Choose a PDF
            </Button>
          </>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={(event) => {
            const picked = event.target.files?.[0]
            if (picked) void accept(picked)
          }}
        />
      </div>

      {/* ── reading the PDF ────────────────────────────────────────────── */}
      {phase.kind === 'reading' ? (
        <Card className="mt-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Loader2 className="size-4 animate-spin text-forest-400" />
            Reading page {phase.done || 1}
            {phase.total ? ` of ${phase.total}` : ''}…
          </div>
          <Progress
            className="mt-3"
            value={phase.total ? phase.done : 20}
            max={phase.total || 100}
          />
          <p className="mt-2 text-xs text-muted">
            This happens on your device. Nothing is uploaded anywhere.
          </p>
        </Card>
      ) : null}

      {/* ── personal document warning ──────────────────────────────────── */}
      {pii ? (
        <Card className="mt-4 border-clay/40 bg-clay-soft/40">
          <div className="flex gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-clay" />
            <div>
              <h2 className="text-sm font-semibold text-clay">This looks personal</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-body">
                This file appears to contain {pii}. Personal records like result slips do
                not belong in a study app: they would be sent to the model and could end
                up in a share link.
              </p>
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-[13px] text-body">
                <input
                  type="checkbox"
                  checked={piiAcknowledged}
                  onChange={(event) => setPiiAcknowledged(event.target.checked)}
                  className="mt-0.5 size-4 accent-clay"
                />
                <span>
                  I understand, and I want to process this file anyway.
                </span>
              </label>
            </div>
          </div>
        </Card>
      ) : null}

      {/* ── ready to run ───────────────────────────────────────────────── */}
      {phase.kind === 'ready' && extracted ? (
        <Card className="mt-4">
          <label className="block text-xs font-medium uppercase tracking-wide text-muted">
            Title
          </label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1.5 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm outline-none transition focus:border-forest-400"
          />

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
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
                    ≈{nairaHint(estimate.usd)} so far
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

          {error ? (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-clay/30 bg-clay-soft/40 px-3 py-2 text-[13px] text-clay">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          ) : null}

          {!keyReady ? (
            <p className="mt-4 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-[13px]">
              You need your own API key first.{' '}
              <Link to="/settings" className="font-semibold underline">
                Add it in Settings
              </Link>{' '}
              — it is stored in this browser and never sent anywhere except the API.
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              onClick={run}
              disabled={!keyReady || (Boolean(pii) && !piiAcknowledged)}
              icon={<Sparkles className="size-4" />}
            >
              Generate study material
            </Button>
            <Button variant="ghost" onClick={reset}>
              Cancel
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted">
            Generation usually takes one to three minutes. You can stop at any stage; what
            was already generated is kept.
          </p>
        </Card>
      ) : null}

      {/* ── running ────────────────────────────────────────────────────── */}
      {phase.kind === 'running' ? (
        <Card className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Loader2 className="size-4 animate-spin text-forest-400" />
              {STAGE_LABEL[phase.stage]}
            </div>
            {phase.detail ? (
              <span className="text-xs text-muted">{phase.detail}</span>
            ) : null}
          </div>
          <Progress className="mt-3" value={stagePct} />
          <ol className="mt-4 space-y-1.5">
            {STAGE_ORDER.map((stage, index) => {
              const done = index < stageIndex
              const active = index === stageIndex
              return (
                <li
                  key={stage}
                  className={[
                    'flex items-center gap-2 text-[13px]',
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
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => abortRef.current?.abort()}
          >
            Stop
          </Button>
        </Card>
      ) : null}

      {error && phase.kind === 'idle' ? (
        <Card className="mt-4 border-clay/40">
          <p className="flex items-start gap-2 text-[13px] text-clay">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        </Card>
      ) : null}

      <p className="mt-6 flex items-center gap-1.5 text-xs text-muted">
        <Chip tone="green">Private by default</Chip>
        The PDF text is sent to the AI provider to generate notes. Nothing is sent to us —
        there is no server.
      </p>
    </div>
  )
}
