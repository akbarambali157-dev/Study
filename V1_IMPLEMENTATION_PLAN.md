# Study Hub — Version 1.x Completion Programme

**Scope:** Versions 1.0, 1.1, 1.2, 1.3 and 1.4  
**Execution rule:** Work in small, reviewable, deployable batches. Do not start a later batch until the current batch has recorded implementation results, automated checks and deployment identity.  
**Performance rule:** Low-end Android is a first-class target for every batch, not a final polish item.

## 1. Release posture

- **Version 1.0 had already been accepted by the product owner before this update; that acceptance was reaffirmed in the 15 November 2026 conversation.** Do not leave it labelled as awaiting user acceptance.
- Its historical manual checklist remains a regression/security checklist. Unchecked individual boxes mean that a test has not been recorded in this document; they do not override the product owner's acceptance.
- Do not reopen V1.0 wholesale. Reopen a specific item only for a reproducible defect, security finding, production regression or data-integrity issue.
- V1.1–V1.4 remain under implementation and release acceptance until their own gates pass.
- A code commit, migration, function deployment or READY Vercel deployment proves only that layer, not end-to-end acceptance.
- Retain the existing Vite/React/TypeScript + Supabase architecture. No rewrite without measured evidence.

## 2. Engineering execution loop

Every work package follows this sequence:

1. **Baseline:** record main commit, production deployment, relevant Supabase schema/functions/advisors, existing tests and current behaviour.
2. **Trace:** map the user flow to React components, shared libraries, Supabase tables/RLS/storage, Edge Functions and Vercel configuration.
3. **Reproduce:** establish the defect or missing acceptance criterion before changing code.
4. **Design:** identify affected contracts, migration needs, offline behaviour, performance cost and rollback strategy.
5. **Implement:** make a bounded, focused, reversible change. Avoid unrelated refactors.
6. **Verify:** run typecheck, production build, relevant unit/integration/browser tests, dependency checks and bundle inspection.
7. **Backend verify:** inspect RLS/grants/indexes/functions/storage policies; run Supabase security, performance and health advisors after relevant database changes.
8. **Deploy:** push the verified commit to main, verify Vercel deployed that exact commit and reached READY, inspect logs on failure.
9. **Regress:** exercise adjacent flows, especially authentication, PDF, AI, local study and account switching.
10. **Record:** update VERSION_MAP.md and USER_ACCEPTANCE_TESTS.md with what changed, what passed, what remains blocked and the deployed commit.

Never report a feature fixed merely because code was committed or Vercel says READY.

## 3. Workstream order

### Workstream 0 — Audit and protection baseline
- Map all V1.x requirements to source files, routes, tests, tables, RLS, storage, functions and Vercel configuration.
- Record production commit/deployment identity and build output.
- Capture baseline bundle/chunk sizes, startup, route transition, long tasks, scrolling, memory and idle network activity.
- Inspect Supabase security, performance and health advisors.
- Identify test gaps and add a repeatable test harness before broad refactors.
- Produce a findings ledger with severity, reproduction, workstream and verification method.

**Exit:** every V1.x requirement has an implementation location, evidence status and test method; critical security findings are triaged.

### Workstream 1 — V1.1 PWA and mobile reliability
- Validate manifest, icons, install guidance and standalone display on physical iPhone and Android.
- Validate service-worker precache/runtime caching, offline fallback and update lifecycle.
- Test installed app across a later deployment, including stale-cache recovery and active upload/draft safety.
- Validate local-first learning while offline and account-specific cache cleanup on logout/account switch.
- Test notification preferences, permission education, subscription lifecycle, real push delivery, click-through, quiet hours, grouping, unsubscribe and logout cleanup.
- Push failure must not delete the in-app notification.

**Exit:** physical-device install/update/offline tests pass; at least one real device receives a test push and opens the correct destination; account switching exposes no stale private data.

### Workstream 2 — V1.2 Learning productivity
- Audit Planner tasks/goals, calendar/date handling, persistence and empty/error states.
- Verify flashcard deck CRUD, review states, scheduling and Card Rush behaviour.
- Verify quiz generation, answer explanations, scoring, attempt history and source grounding.
- Verify topic mastery is explainable and does not overstate certainty from small samples.
- Add deterministic unit tests for scheduling, scoring, date boundaries, progress aggregation and export.
- Verify local-first behaviour and clearly label device-local versus cloud-synced records.
- Keep phone workflows comfortable without eagerly loading every dashboard widget or history record.

**Exit:** core learning logic is covered by automated tests; planner, revision and quiz workflows persist and remain usable on a small phone; no PDF/AI/offline regression.

### Workstream 3 — V1.3 UI, Settings and performance

**Approved Settings interaction model (supersedes earlier focused-page wording):**
- Settings opens as a clear overview.
- **AI & Providers is the only dedicated full settings page**, because provider configuration is extensive.
- All other categories expand inline beneath their row with a restrained slide-down/opacity transition: Account, Academic Profile, Appearance, Notifications, Privacy & Safety, Storage & Documents, Offline & App, Help & About.
- Expanded content appears directly underneath the selected category; it does not navigate to a separate page.
- Keep browser Back behaviour sensible for the dedicated AI & Providers page and Settings entry/exit.
- Put **Animations inside Appearance**. Preserve the currently accepted default (ON for a new profile), local persistence and OS reduced-motion. Do not silently change the default.
- Accordion motion becomes static/instant when app Animations is OFF or OS reduced-motion is enabled.
- Avoid rendering all heavy settings panels before they are opened.

Other UI work:
- Consolidate duplicate/conflicting global and visual-refresh CSS into one semantic token system.
- Refine responsive navigation and Home, Learn, Library, PDF, Notes, Flashcards, Tests, Planner, Community, Discover, Messages and Profile.
- Ensure useful loading, empty, error, disabled, offline and success states.
- Fix keyboard, focus, touch targets, safe areas, orientation and narrow viewport issues.
- Show admin display name and stable user ID only to authorised admins.
- Avoid heavy dependencies and decorative effects.

**Exit:** agreed Settings model is implemented; key pages are coherent; motion/offline behaviour passes; measured performance does not regress; iPhone and Redmi 10A testing is acceptable.

### Workstream 4 — V1.4 Data continuity and operations
- Create an explicit sync matrix: local-only, account-synced, cloud-backed, community-shared and exportable data.
- Audit Dexie/local queues, idempotency, retry classification, conflict resolution and account ownership.
- Test notes, cards, review history, quiz attempts, planner tasks/goals and preferences across two devices.
- Test concurrent edits and deterministic conflict handling.
- Test export/import, clean-device restore, deletion and retention messaging.
- Verify admin usage/limits/diagnostics and stable user identity; never expose credentials, prompts or private document text.
- Add automated integration/browser regression coverage.
- Resolve or explicitly document Supabase advisor findings; enable leaked-password protection in Auth.
- Monitor Vercel, Supabase database, Storage, Edge Functions and AI provider usage as separate operational surfaces.

**Exit:** two-device sync/conflict/account-switch tests pass; backup/export/restore/deletion are proven; admin data is scoped; critical automated tests and security checks pass.

### Workstream 5 — V1.x release hardening
- Run V1.0 regression/security checks plus V1.1–V1.4 acceptance suites.
- Run two-account privacy and storage isolation tests.
- Run physical iPhone and Android PWA checks.
- Verify push delivery and account cleanup.
- Verify weak-network/offline/reconnect scenarios.
- Confirm exact production commit and READY deployment.
- Publish release notes and mark every gate honestly.

**Exit:** all V1.x release gates pass, or each exception is explicitly accepted by the product owner with risk and workaround recorded.

## 4. Low-end Android performance contract

Use Redmi 10A as the named low-end baseline, alongside the additional Android tester. Desktop emulation alone cannot establish device acceptance.

### Measure before and after
- Production JS/CSS chunk sizes and total initial transferred bytes.
- Cold start to first usable screen.
- Route transition and first interaction latency.
- Long tasks and layout shifts on Home and Learn.
- Scroll responsiveness on Feed, Library and Planner.
- Memory during repeated navigation and PDF open/close.
- Network requests at idle, offline and reconnect.
- Service-worker cache size and update behaviour.

### Initial engineering targets
These are targets to measure and tune against the real baseline, not claims about current performance:
- Initial compressed JS transfer target at or below **250 KB where practical**. Justify exceptions and defer the affected feature.
- Do not eagerly download PDF.js, provider SDKs, admin tools, charts or community-only modules on the Home route.
- Target first usable Home interaction within **3 seconds** on a repeatable constrained-device/network profile.
- Investigate repeated long tasks over **100 ms** and any task over **200 ms** in ordinary navigation/scrolling.
- Avoid layout shifts during initial render, keyboard opening and navigation.
- No idle polling loops; suspend subscriptions/timers when hidden, offline or outside the relevant feature.
- Paginate server lists; never fetch the entire feed, library, message history or admin user list at once.
- Lazy-load images, reserve dimensions and avoid autoplay media.
- Keep PDF rendering worker-based; render only needed pages, release object URLs/arrays/buffers and avoid duplicate full-document copies.
- Avoid large blur surfaces, expensive shadows, permanent will-change, animated backgrounds and large layout animations.
- Prefer transform/opacity for small transitions; respect reduced motion.
- Use memoisation/virtualisation only where profiling proves benefit.
- Preserve offline capability without precaching every large optional engine.
- Test weak mobile data and constrained CPU as repeatable proxies, then confirm on physical Redmi 10A.

### Performance release gate
- No crash/reload during the agreed PDF/navigation loop.
- No progressive slowdown after repeated route changes.
- No obvious scroll hitching on Home, Library and Feed.
- No excessive network activity while idle/offline.
- No significant initial bundle/startup regression from baseline.
- Document unmet targets with measurements and mitigation; do not label the app simply “optimised”.

## 5. Test strategy
- **Unit:** scheduling, scoring, date boundaries, formatting, state transitions, sync merge and retry/idempotency.
- **Integration:** PDF metadata/page-index lifecycle, storage ownership, AI provider adapters, notification creation/deduplication and sync ownership.
- **Database/security:** RLS/grants, two-account access matrix, storage policies, function auth and privilege review.
- **Browser/E2E:** signup/login, upload/reopen, AI generation, local study, planner, update flow, community/messaging access and account switching.
- **Device:** installed iPhone PWA, Redmi 10A Android Chrome, additional Android tester and desktop fallback.
- **Production:** exact deployed commit, function versions, service-worker build ID and safe smoke tests.

A test is PASS only when steps, environment and result are recorded. If it requires a physical device or second account the engineering team cannot access, mark it BLOCKED / OWNER TEST REQUIRED rather than inventing a result.

## 6. Scope discipline
- Do not implement V2+ features as a substitute for closing V1.x.
- Do not refactor stable code solely for style.
- Do not expose provider credentials in client code.
- Do not apply destructive database changes without reviewed migration and rollback/backup plan.
- Do not weaken RLS to make the UI work.
- Do not claim push delivery because a subscription exists.
- Do not claim OCR for scanned PDFs unless implemented and tested.
- Keep each batch small enough to diagnose and roll back.
- Report files changed, schema/functions changed, tests run, results, deployment commit/status and remaining owner-only acceptance items.

## 7. Infrastructure locator (15 November 2026)
- GitHub: akbarambali157-dev/Study, branch main.
- Supabase project: ewqogapdsvivpgpwaxfh (OOU-StudyPlatform beta).
- Vercel project: study-platform.
- Re-query live infrastructure before every release; this locator is not a guarantee of current deployment state.


## 8. First implementation slice and measured baseline (15 November 2026)

### Settings accordion slice

- Commit: 1fe2a07b0553c1e91ef06ed8e9a5460722f15000.
- Vercel deployment: dpl_EeZQqGpCmoS28pFEKUUzNE44FTJY — READY, production target.
- Non-AI Settings categories now expand inline; AI & Providers remains the dedicated page.
- Animations now lives inside Appearance and keeps the existing ON default, local persistence and OS reduced-motion override.
- Accordion content is only mounted while its panel is open; transitions are disabled when app motion is OFF or OS reduced-motion is active.
- This is an implementation slice, not manual acceptance. Test every category, AI connection/model selection, browser Back, keyboard/focus and phone layout before marking the V1.3 Settings criteria PASS.

### Production build baseline

Captured from the READY Vercel build for the Settings slice:

| Asset | Raw size | Gzip |
|---|---:|---:|
| Main entry JavaScript | 342.81 KB | 108.70 KB |
| Main CSS | 89.56 KB | 17.30 KB |
| Settings route chunk | 35.90 KB | 10.65 KB |
| Supabase client chunk | 216.60 KB | 55.97 KB |
| Local database chunk | 101.80 KB | 32.10 KB |
| PDF engine chunk | 444.23 KB | 133.64 KB |
| PDF worker | 1,202.27 KB | not shown in build output |

Vite transformed 2,314 modules. Feature routes are already lazy-loaded, and the PDF engine is a separate chunk; preserve those boundaries. The PDF worker is excluded from the PWA precache by the current Vite config.

The build completed successfully but emitted a Lightning CSS warning for an unrecognised @theme rule in the separately imported visual-refresh stylesheet. This is a known cleanup item for the CSS consolidation workstream; do not ignore or silence it without fixing the processing boundary.

### Immediate measured findings

- The application has route-level lazy loading, but the main entry is still 342.81 KB raw and the initial compressed entry is 108.70 KB before accounting for any statically imported shared chunks.
- The PDF engine and worker are materially larger than ordinary feature chunks; keep them deferred and measure their memory impact on Redmi 10A.
- globals.css and visual-refresh.css both define root design tokens. visual-refresh.css also repeats a Tailwind-specific @theme directive, while main.tsx imports both stylesheets. Consolidate this into one authoritative token system and remove the build warning.
- package.json currently has build and typecheck scripts but no dedicated unit/integration test runner. Add deterministic tests before expanding sync and learning logic.
- Supabase currently reports 30 public tables, all with RLS enabled; the private study-documents bucket is limited to PDF files and 50 MiB. Policy semantics and two-account isolation still require test coverage.
- Supabase advisors currently report leaked-password protection disabled (security warning), 34 unused indexes (informational; review query usage before changing), and no health findings.


## 9. Authentication, Discover and Android reliability implementation (15 November 2026)

### Source changes committed

- `60bb293`: wait for Supabase's `INITIAL_SESSION` restoration before asking for the current user; add a shared `getAuthenticatedUser()` helper; create one academic-profile persistence helper; write signup academic details to the account.
- `561ed90`: make profile setup require a real signed-in account when Supabase is configured; persist profile and discovery preferences to `student_profiles`; show a clear profile/discovery opt-in state.
- `eed35db`, `1360711`, `b9aa0f8`, `4beb395`: retain PWA update state across React mounting; apply restored-session handling across Settings, Discover, profile and account flows; keep public Discover usable if optional identity lookup fails; preserve discovery preferences on sign-in.
- `3309b6b`: on browsers exposing `navigator.deviceMemory <= 2`, cap local PDF processing at 20 MB / 150 pages and yield to the browser every ten pages. Other devices retain the 50 MB / 400-page ceiling.
- `8b6d58a`, `0cee0eb`, `e306f8e`, `3398e86`: extend restored-session handling to Library, messaging, community, groups, notifications and private document sync; complete the authenticated identity migration.

### Supabase findings

- `student_profiles` has RLS enabled, authenticated-only table grants, and policies for own-profile CRUD plus opted-in public discovery.
- `public_materials` has an `anon SELECT` grant and a SELECT policy for public rows. Public browsing does not require an account; save/progress actions do.
- At inspection time, the project had 1 student profile (1 opted-in/public) and 4 public materials. If that single profile is the current tester's, student matching has no second account to recommend yet. This is a data-availability limit, not evidence that the profile write failed.
- No database migration was required for this code slice; existing table columns and policies already support the intended profile fields.
- Keep the leaked-password-protection advisor warning open until the Auth setting is enabled by an authorised project operator.

### Verification

- Vercel deployment `dpl_6JQRPumQ4tL2VhCRUzxHTzyRgH4G`, commit `3398e8619439b88f16da4508ba77ce2f944508be`, reached READY after `npm run build` completed.
- The build runs `tsc -b && vite build`; the current code therefore passes the TypeScript build gate.
- This does not prove sign-in on physical Android, account switching, anonymous public browsing, profile persistence for a real test account, or the update button on an installed PWA. Those remain explicit device/owner acceptance tests.

### Remaining V1.x work — not declared complete

- Exercise signup, email confirmation, password login, Google OAuth, token refresh, expired session, logout and account switching on physical Android and iPhone.
- Run a two-account profile test: save profile A, enable discovery, sign out, sign in as B, confirm B cannot read/edit A's private fields; only opted-in public profile fields are visible.
- Confirm public Discover shows the public materials while signed out; verify save/progress requires sign-in and returns a clear sign-in path.
- Verify real Android PWA update notice, visible Update button, click-through, activation and no lost local study data.
- Verify low-memory PDF behaviour on Redmi 10A; confirm the device exposes a memory hint and the adaptive cap is selected.
- Add a deterministic unit/integration/browser test harness; current verification is TypeScript + production build, not full automated regression.
- Continue V1.1 push/offline/update, V1.2 learning-logic, V1.3 design/performance and V1.4 sync/backup acceptance to the release gates above.
