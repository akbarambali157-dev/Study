# Working in this repository

Read `PLAN.txt` first — it is the durable plan and wins over this file whenever
the two disagree.

## Rules this project holds to

- **The API key never becomes a `VITE_` variable.** Vite inlines those into the
  public bundle. Student-typed keys live in `sessionStorage` (opt-in
  `localStorage`). `VITE_AI_BASE_URL` is fine: a URL is not a secret. When the
  site provides the model, the brewkeg.dev key lives only in the Supabase Edge
  Function's secrets — never in the bundle, never in a `VITE_` variable.
- **`material/` stays out of git.** It holds a result slip with personal data.
  Do not read, print, commit or send its contents anywhere.
- **No `dangerouslySetInnerHTML`.** Markdown from the model is rendered to React
  elements by `src/components/Markdown.tsx`, which cannot emit HTML or links.
- **Validate every model response with zod** before it reaches state or the DB.
  Schemas live in `src/lib/llm/schema.ts`.
- **Citations are structural.** A page number is clamped to the chunk it came
  from and paired with a snippet taken from the real page text, never from the
  model.
- **`npm run typecheck` must pass** before calling anything done. It caught
  real errors in optional-field widening that the build order hides.

## Where things live

| Concern | File |
|---|---|
| Routes (all code-split) | `src/router.tsx` |
| Local database + schema | `src/lib/db.ts` |
| All reads/writes | `src/lib/store.ts` |
| React bindings | `src/lib/hooks.ts` |
| AI orchestration | `src/lib/llm/pipeline.ts` |
| AI client (retries, errors, redaction) | `src/lib/llm/ai.ts` |
| AI proxy (Supabase Edge Function) | `supabase/functions/ai-proxy/index.ts` |
| Prompts | `src/lib/llm/prompts.ts` |
| Spaced repetition | `src/lib/srs.ts` |
| Learning trail | `src/lib/inquiries.ts` |

## Conventions

- Pages live in `src/features/<feature>/<Name>Page.tsx` and export a named
  component, because `router.tsx` imports them by name.
- Prefer the existing kit — `Button`, `Card`, `Chip`, `EmptyState`, `Progress`,
  `CitationChip`, `toast` — over new one-off markup.
- State that is server-ish goes through Dexie; ephemeral UI state stays in
  `useState` or zustand.
- Comments explain *why*, not what. If a line exists to avoid a bug, say which
  bug.
