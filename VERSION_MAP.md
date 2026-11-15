# Study Hub — Master Version Map
**Last updated:** 15 November 2026  
**Purpose:** The single high-level delivery map for the complete Study Hub product.  
**Audience:** Product owner, developers, coding agents, testers and future contributors.  
**Product direction:** Nigeria-first academic ecosystem, beginning with OOU; mobile-first PWA; local-first learning; privacy- and performance-conscious; expand only after release gates pass.

> This is a planning and status-control document, not a claim that every listed feature exists or is production-ready. A feature is complete only when its acceptance criteria pass. A code commit, CI pass, database migration or Vercel READY deployment is evidence for only that layer—not proof of end-to-end product acceptance.

## 1. How to read this map

Status labels:
- **DONE IN CODE** — implementation is present in the repository or backend, but may still need production/device acceptance.
- **USER-REPORTED WORKING** — the product owner has tested it successfully in current use; retain regression tests and do not reopen it without evidence.
- **IN ACCEPTANCE** — implementation exists but real-account, multi-account, provider, device or production testing remains.
- **NEXT** — immediate planned work.
- **PLANNED** — approved product scope, not yet fully implemented.
- **LATER / OPTIONAL** — useful expansion, deliberately behind core reliability and safety.

Version numbering:
- Patch commits fix defects without changing product scope.
- Minor versions complete a coherent capability set and its acceptance gate.
- Major versions introduce a new product domain (community, collaboration, intelligence, ecosystem).
- A version may be coded but not released until its gate passes.
- Do not skip release gates just because a later feature is attractive.

## 2. Product vision and complete information architecture

Study Hub is one connected academic workspace, not a collection of unrelated mini-apps.

### Five primary destinations
1. **Home** — personal dashboard, next actions, study goals, recent materials, useful updates.
2. **Learn** — Library, PDFs, Notes, key points, flashcards, quizzes/tests, Card Rush, Planner and learning progress.
3. **Community** — Research Feed, Course Hubs, department/course discussions and Research Circles.
4. **Discover** — academic materials, students, research interests, collaborators, courses and opportunities.
5. **Profile** — academic identity, privacy, interests, projects, contributions and achievements.

Messages and notifications are reachable from the top bar and relevant profiles/posts. Settings and Admin are utility areas, not competing primary destinations.

### Product principles
- Learning usefulness before social activity.
- Academic relevance before popularity.
- Mobile-first, accessible and fast on low-powered phones.
- Nigeria-first, institution-configurable architecture.
- Local-first study workflows; network features must declare their connectivity needs.
- Privacy and student safety by design, with opt-in discovery and contact.
- AI only when it materially improves an outcome; ordinary social actions never need AI.
- No manipulative streaks, artificial urgency, notification spam or engagement traps.
- Preserve working architecture and features; do not rewrite without measured reason.

## 3. Version overview

| Version | Name | Main outcome | Status |
|---|---|---|---|
| 1.0 | Reliable learning foundation | PDFs, AI, accounts, profiles, saved learning materials, isolation | **PREVIOUSLY ACCEPTED BY PRODUCT OWNER (reaffirmed 15 Nov 2026); regression/security checks remain** |
| 1.1 | PWA, mobile and notifications foundation | Installability, safe areas, updates, offline shell, push pipeline | Implemented substantially; device/push acceptance remains |
| 1.2 | Learning productivity | Planner, flashcards, quizzes, mastery and progress | Core implemented; enhancements and tests remain |
| 1.3 | Complete UI, UX and performance redesign | Cohesive design system, Settings accordions, animation preference, offline-aware shell, Android/iPhone polish | In progress; next major implementation workstream |
| 1.4 | Data continuity and operational maturity | Reliable cross-device study data, admin visibility, backup/export, observability and limits | Partly implemented; close remaining gaps |
| 2.0 | Academic community | Research Feed, reactions, comments, follows, Course Hubs, moderation | Base features implemented; full acceptance and polish remain |
| 2.1 | Messaging and notification experience | Safe messaging, requests, realtime, notification centre and tested push | Base implementation present; end-to-end acceptance and remaining controls |
| 2.5 | Collaboration workspace | Matching, Research Circles, shared resources and project workflows | Partly implemented; advanced collaboration planned |
| 3.0 | Intelligent learning and research | AI Study Coach, research discovery, literature and citation tools | Planned |
| 3.5 | Academic identity and achievements | Portfolio, contribution history, trusted achievements and optional goals | Planned |
| 4.0 | Nigerian multi-university ecosystem | Institution directories, institution communities and cross-university discovery | Planned |
| 4.5 | Academic opportunities and integrations | Events, opportunity listings, verified institutional integrations and external resources | Later, subject to partnerships |
| 5.0 | Scale, governance and ecosystem maturity | Scalable operations, quality, governance, analytics and sustainable service delivery | Long-term; scope to be validated |

## 4. Version 1.0 — Reliable learning foundation

**Product-owner acceptance: ACCEPTED previously and reaffirmed on 15 November 2026.** This records the user's explicit acceptance of V1.0; it does not falsely mark every historical test checkbox as individually executed. Keep the V1.0 checklist as a regression and security suite. Reopen only a specific item when evidence shows a regression, security issue or data-integrity defect.

The detailed remaining V1.x delivery sequence is maintained in [V1_IMPLEMENTATION_PLAN.md](V1_IMPLEMENTATION_PLAN.md).

**Goal:** A student can create an account, bring in a supported document, study it, save the outputs and return to their work safely.

### 1.0A — Authentication and identity
- Email/password registration and sign-in.
- Sign-out and session restoration.
- Account details and profile persistence.
- Collect name and email once during registration.
- Prefill name and email into academic profile onboarding.
- Use provider metadata when social sign-in is enabled; handle missing metadata safely.
- Email changes must use a verified account flow.
- Academic profile: institution, faculty, department, level, academic session, interests and visibility.
- Existing accounts and chosen display names must not be overwritten by blank provider metadata.
- Clear private in-memory messages and notifications on sign-out.
- Preserve account isolation across account switching.

**Current evidence:** Profile prefill and account-backed profile work are implemented. Continue testing new/existing accounts, provider metadata, sign-out and session recovery.

### 1.0B — PDF ingestion and learning pipeline
End-to-end path:
1. Select file and validate PDF signature/type.
2. Enforce the current practical size limit (approximately 50 MB based on user testing; never imply a larger supported limit without testing).
3. Extract page-aware text locally.
4. Show extraction/processing states and clear errors.
5. Optionally sync the private PDF to the student's own cloud storage.
6. Persist document metadata and page index consistently.
7. Index and retrieve the correct document content.
8. Generate grounded learning materials.
9. Reopen, restore or delete safely.

Required states: selecting, validating, extracting, ready locally, syncing, synced, indexing, partially readable, failed and retryable.

Learning outputs:
- Concise notes.
- Key points and explanations/examples.
- Relevant organisations/entities where appropriate.
- Flashcards.
- Quiz/test questions.
- Source/page references and follow-up questions grounded in the document.

PDF rules:
- Local study access must not depend on cloud sync.
- Cloud sync is explicit and account-owned.
- Scanned/image-only PDFs must show an honest OCR limitation; never invent extracted text.
- Do not duplicate large PDF buffers or retain every page array in memory.
- Preserve PDF.js worker separation and older WebKit compatibility helpers.
- Keep upload cancellation, resumable transfer and safe retry behaviour.
- A storage upload alone is not proof that extraction, indexing, retrieval and generation work.

**Current evidence:** User reports PDFs working well in current testing, around 50 MB practical limit. Cloud restore/deletion and page indexing are implemented in code; cross-device/two-account acceptance still matters.

### 1.0C — AI provider reliability
- Hosted AI through authenticated server-side proxy.
- Optional personal BYOK through separate authenticated proxy and protected secret storage.
- Show active mode/provider/model clearly.
- Hosted and BYOK paths must be tested independently.
- BYOK must use only the signed-in user's credential; no silent fallback to hosted credentials.
- Restrict supported provider endpoints and validate key-prefix/endpoint pairing.
- Normalise supported Anthropic and OpenAI-compatible response envelopes.
- Plain-text connection test; strict structured JSON is not required just to prove connectivity.
- Validate structured outputs only for tasks that require them.
- Reject empty or malformed HTTP 200 responses.
- No automatic repeat of ambiguous paid generation requests.
- Safe diagnostic codes and correlation IDs; redact secrets, prompts and document content.
- User reports AI question/answer working in current use; preserve it and regression-test rather than rewriting it.

### 1.0D — Learning library and local-first storage
- Library of local documents and generated materials.
- Notes, key points, flashcards, tests and attempts.
- Local IndexedDB/Dexie persistence.
- Learning trail and local citations.
- Explicit private PDF cloud sync/restore where supported.
- Safe account-owned deletion queue, including offline deletion.
- JSON export for supported local learning data.
- Clear distinction between device-local, cloud-synced and community-shared content.
- Community sharing opt-in; new study sets private by default.
- Original PDF sharing is separately consented and served through validated short-lived download links.

### 1.0 release gate
- [ ] Real signed-in PDF upload and reopen on supported iPhone and Android browsers.
- [ ] Validate file metadata, Storage object path and page-index consistency.
- [ ] Generate learning output grounded in the uploaded file.
- [ ] Test multi-page and near-50 MB supported documents.
- [ ] Test corrupt and scanned/image-only PDFs with honest error states.
- [ ] Test interrupted upload, retry and cancellation.
- [ ] Test account A cannot read/delete account B's documents.
- [ ] Test private cloud restore and deletion on a second device.
- [ ] Hosted AI and BYOK each pass a real connection and generation test.
- [ ] Verify no key or private document content leaks into frontend, logs or analytics.
- [ ] Verify local study work remains usable if cloud sync fails.

## 5. Version 1.1 — PWA, mobile and notifications foundation

**Goal:** The same product works as a reliable installable PWA on iPhone, Android and desktop.

### 1.1A — Installable PWA
- Web manifest with app name, short name, theme/background colours, app ID, start URL and standalone display.
- Branded 192px and 512px icons, SVG icon and Apple touch icon.
- Standalone launch and installation guidance.
- iPhone Safari Add to Home Screen instructions.
- Android browser install prompt and fallback instructions.
- Safe-area-aware header and bottom navigation.
- Do not force orientation; responsive layouts must work when rotated.
- App shell/offline fallback and controlled cache policy.
- Do not cache private messages or sensitive API responses in shared caches.
- Clear account-specific cached information on logout/account switch.

### 1.1B — Update lifecycle
- Controlled service-worker update prompt.
- Check for updates on startup and foreground return where supported.
- Show an Update available action.
- Apply only when safe; do not destroy unsaved work, uploads or drafts.
- Show app version/build identifier in About/diagnostics.
- Verify installed app receives and applies a later deployment, not just browser refresh.
- Recover from stale app-shell/asset-cache states.

### 1.1C — Notifications and Web Push
- In-app notification records.
- Per-category preferences, global pause and quiet hours.
- Per-device subscription registration/removal.
- Ask permission only after an explicit user action and explanation.
- iOS/iPadOS requires supported version and Home Screen installation.
- Server-side dispatch with VAPID private key protected in Vault.
- Notification outbox/trigger, dispatch function, deduplication claims and stale endpoint cleanup.
- Push failure must not delete the in-app notification.
- Group reactions to avoid notification spam.
- Notification click opens the correct post, conversation or group.
- Sign-out must remove the current device's account subscription safely.

**Current evidence:** PWA assets, safe areas, update prompt/version ID, notification preferences, subscription flow and server-side push dispatch are implemented. The push pipeline has been hardened, but actual device delivery/click-through and quiet-hour acceptance require a registered device. Do not confuse subscription registration with successful push delivery.

### 1.1 release gate
- [ ] Install and launch on a physical iPhone Home Screen.
- [ ] Install and launch on a physical Android device.
- [ ] Confirm app icon, standalone display and safe areas.
- [ ] Test offline shell and local study access.
- [ ] Deploy a later build and verify installed app update detection/build ID.
- [ ] Test update with offline state, unsaved work and an active upload.
- [ ] Register a real device and receive a push self-test.
- [ ] Verify notification click-through, quiet hours, category pause, unsubscribe and logout cleanup.
- [ ] Verify no private account cache leaks after account switching.

## 6. Version 1.2 — Learning productivity

**Goal:** Turn the learning tools into a coherent system for planning, revision and measuring understanding.

### 1.2A — Planner
- Personal study tasks and goals.
- Due dates and prioritisation.
- Recent tests and study activity.
- Link tasks to documents/topics.
- Daily/weekly planning views.
- Recurring revision scheduling.
- Reminder controls without notification spam.
- Local-first persistence and explicit sync/backup status.

### 1.2B — Flashcards and revision
- Deck creation and editing.
- Review scheduling/spaced repetition.
- Local review history.
- Due/learning/review states.
- Shuffle and reverse recall where appropriate.
- Card Rush with varied rounds and no immediate repeats.
- Fair distractors and transparent scoring.
- Accessible controls and keyboard support.

### 1.2C — Quizzes and mastery
- Quiz generation from supported material.
- Answer explanations and source grounding.
- Attempt history.
- Topic-level mastery based on actual answers.
- Review missed/weak concepts.
- Trends over time.
- Avoid presenting a small sample as a definitive ability score.
- Unit tests for scoring, scheduling, date handling and mastery calculations.

### 1.2D — Progress
- Personal goals and milestones.
- Recent documents and saved resources.
- Continue studying action.
- Useful progress summaries, not a wall of vanity statistics.
- Export relevant planner/progress data.
- Clear device-local versus account-synced status.

**Current evidence:** Planner, goals, quiz history, flashcard scheduling, Card Rush, local XP/streak and topic mastery are implemented in part. Planner-to-document links, recurring scheduling, richer trends, cross-device study-data sync and automated unit tests remain.

### 1.2 release gate
- [ ] Planner tasks/goals persist across reload and restart.
- [ ] Flashcard scheduling and quiz scoring pass unit tests.
- [ ] History and topic mastery are explainable and accurate.
- [ ] Small-screen planner and revision workflows are usable.
- [ ] Export includes the promised planner/learning data.
- [ ] No regression to PDF, AI or offline workflows.

## 7. Version 1.3 — Complete UI, UX and performance redesign (**NEXT**)

**Goal:** Make Study Hub visually coherent, inviting, efficient and genuinely usable on iPhone and low-powered Android without sacrificing working features.

The detailed implementation specification is in [UI_DESIGN_PLAN.md](UI_DESIGN_PLAN.md). This version map defines its full delivery scope.

### 1.3A — Baseline audit
- Record current Vite bundle size and build output.
- Measure startup, navigation, scrolling and memory where practical.
- Audit existing routes, shared shell, tokens, styles and duplicated CSS.
- Audit settings, admin, connectivity state and online-only entry points.
- Capture real iPhone and Redmi 10A baseline screenshots/observations.
- Identify actual Android pain points before choosing fixes.
- Do not change behaviour during baseline capture.

### 1.3B — Visual identity and design system
- Consistent Study Hub brand and icon treatment.
- Semantic colour tokens and accessible contrast.
- Typography scale, spacing scale, radii and restrained elevation.
- Reusable buttons, inputs, cards, tabs, menus, dialogs, navigation, badges and feedback.
- Consistent loading, skeleton, empty, error, disabled, success and offline states.
- Refine light/dark themes.
- Avoid generic dashboard styling, overly bare screens and crowded cards.
- Avoid excessive accent colours, heavy shadows and large-area blur.
- Preserve the new brand icon and iOS/Android assets.

### 1.3C — Navigation and responsive shell
- Five primary destinations: Home, Learn, Community, Discover, Profile.
- Mobile: fixed safe-area-aware bottom navigation with clear active state.
- Desktop/tablet: sidebar when width supports it; readable max content width.
- Messages and notifications from top bar/context, not permanent bottom-nav clutter.
- Preserve URLs, browser back behaviour and useful scroll positions.
- Avoid remounting the entire app for small navigation changes.
- Respect keyboard, notch, Dynamic Island and home-indicator safe areas.
- Test narrow phones, tablets, desktop and orientation changes.

### 1.3D — Animation preference and motion system
- Add Settings → Appearance → Animations.
- Default ON for new users.
- OFF restores the current static UI baseline: no decorative entrances/transitions.
- Persist locally per device; setting works offline and requires no server call.
- Respect OS prefers-reduced-motion; system reduced motion makes effective motion OFF.
- User OFF always wins.
- Central preference/provider or hook; one root attribute/class controls motion.
- Avoid first-paint flash and inconsistent feature-specific animation settings.
- Use short, purposeful feedback (roughly 120–200ms small actions; 160–240ms surfaces).
- Prefer transform/opacity; no infinite decorative loops, parallax, animated gradients, particles, bounce or motion that delays actions.
- Pause/remove nonessential motion when document is hidden.
- No new heavy animation dependency.

### 1.3E — Settings redesign
Replace current side/slider-style section navigation with a clear Settings overview. AI & Providers is the only dedicated full page because provider configuration is extensive. All other categories expand inline directly beneath their row with a smooth, restrained accordion transition:
1. Account & identity.
2. Academic profile.
3. AI & providers.
4. Appearance.
5. Notifications.
6. Privacy & safety.
7. Storage & documents.
8. Offline & app.
9. Help & about.

Rules:
- Account, Academic Profile, Appearance, Notifications, Privacy & Safety, Storage & Documents, Offline & App, and Help & About expand inline beneath their row.
- AI & Providers alone opens a dedicated page.
- Animations lives inside Appearance; preserve the accepted ON default for new profiles and OS reduced-motion override.
- Accordion motion becomes static/instant when Animations is OFF or OS reduced-motion is enabled.
- Do not render all heavy settings panels until opened.
- Preserve actual existing permissions and behaviour.
- Group related controls; avoid duplicate/conflicting settings.
- Every control must work; no decorative nonfunctional toggles.
- Provide validation and save feedback, plus loading/error/success states.

### 1.3F — Offline-aware product shell
- One shared connectivity/reachability state for navigation and controls.
- Do not rely on navigator.onLine alone; combine browser events and real request/reachability state.
- Hide online-only Community, Discover network actions, messaging and remote-only controls while offline.
- Keep local-first Library, notes, saved documents, flashcards and other offline learning tools available.
- Disable/hide AI question input while offline and explain briefly that AI needs a connection.
- Do not let a question appear to submit when no request can reach the server.
- Preserve drafts and local work.
- Restore online features safely when connectivity returns.
- Debounce transitions to prevent flicker; avoid aggressive polling.
- Small non-blocking offline indicator.

### 1.3G — Admin usability
- Show each user's display name and stable user ID together.
- Make ID copyable and visually secondary.
- Add search/pagination if needed for a growing list.
- Display only fields the authorised admin role may see.
- Do not weaken RLS or backend permissions to simplify UI.

### 1.3H — Page-by-page visual polish
- **Home:** Continue studying, goals, recent materials, relevant replies/updates; contextual next action; useful new-account and empty states; no wall of stats.
- **Learn/Library:** Clear document cards, sync state, processing state, recent items and upload feedback.
- **PDF viewer:** Readable controls, source references, loading/errors; preserve PDF.js worker and memory behaviour.
- **Notes:** Strong reading hierarchy, useful local editing; AI prompt disabled offline.
- **Flashcards/Tests:** Clear study modes, answer feedback, review state and accessible touch controls.
- **Planner:** Compact agenda, useful empty states and manageable task entry.
- **Research Feed:** Readable post composition, academic context, restrained actions and pagination.
- **Discover:** Explain why a person/resource is recommended; respect visibility and opt-in.
- **Messages:** Clear inbox, unread state and focused mobile conversation.
- **Profile:** Academic identity first, privacy controls visible and understandable.
- **Settings/Admin:** Consistent focused screens, not dense forms.

### 1.3I — Performance requirements

Use Redmi 10A as an explicit low-end Android baseline. Measure initial compressed JS, startup, first interaction, long tasks, scrolling, memory after repeated navigation/PDF open-close, idle network requests and offline cache behaviour before and after significant changes. Initial compressed JS target: at or below 250 KB where practical; defer PDF.js, provider SDKs, admin, charts and community-only modules. Target first usable Home interaction within 3 seconds on a repeatable constrained-device/network profile. Investigate repeated long tasks over 100 ms and any task over 200 ms. These are engineering targets, not claims of current compliance. See [V1_IMPLEMENTATION_PLAN.md](V1_IMPLEMENTATION_PLAN.md) for the full measurement contract.
- Lazy-load PDF viewer, admin, charts, community and other heavy routes where architecture permits.
- Avoid adding dependencies unless measured need exists.
- Avoid unnecessary fonts, image requests, third-party calls and large JS bundles.
- Avoid broad React context updates and needless rerenders.
- Keep feed, Library, notifications and admin lists incremental/paginated.
- Virtualise only when measured list size warrants it.
- Avoid eager loading every feature on app launch.
- Avoid unnecessary network fetches and background polling.
- Stop polling/subscriptions when hidden or offline where appropriate.
- Preserve PDF worker split; avoid duplicate buffers and page arrays.
- Avoid expensive blur, animated layout, heavy shadows and permanent will-change.
- Keep low-memory Android as a first-class acceptance target.

### 1.3J — Devices and accessibility
- iPhone Safari and installed PWA.
- Redmi 10A as explicit low-end Android baseline.
- Additional Android tester's feedback must be incorporated.
- Check cold launch, scrolling, keyboard, dialogs, bottom nav, PDF memory, offline mode and reconnection.
- Keyboard/focus support, screen-reader labels, contrast and touch target sizing.
- OS reduced-motion behaviour.
- No horizontal overflow or clipped controls.

### 1.3 release gate
- [ ] New visual system is consistent across primary destinations.
- [ ] Settings side/slider navigation is removed.
- [ ] Non-AI Settings categories expand inline as accordions; AI & Providers alone uses a dedicated page.
- [ ] Animation toggle defaults ON, persists, and OFF matches static baseline.
- [ ] OS reduced-motion preference is respected.
- [ ] Online-only destinations/actions are hidden offline.
- [ ] Offline AI input cannot submit.
- [ ] Local study remains available offline.
- [ ] Admin name and ID are visible only to authorised admins.
- [ ] iPhone and Redmi 10A usability is acceptable; pending Android feedback addressed.
- [ ] Bundle/startup does not materially regress.
- [ ] PDF, AI, sync, auth and push code paths remain intact.
- [ ] CI/build pass and Vercel deploys the matching commit READY before production claims.

## 8. Version 1.4 — Data continuity and operational maturity

**Goal:** Make student data, diagnostics and platform operations dependable across devices and service conditions.

### 1.4A — Cross-device learning-data continuity
- Define exactly which data syncs and which remains device-local.
- Sync notes, flashcards, review history, quiz attempts, planner tasks/goals and preferences where appropriate.
- Conflict resolution for edits from multiple devices.
- Durable offline write queue with account ownership.
- Retry only safe/idempotent operations.
- Account switching must never upload one user's pending data into another account.
- Clear sync status per item and global sync health.
- Preserve local data on remote failures.
- Export/import and recovery path.
- Avoid syncing sensitive learning trails unless user explicitly opts in.

### 1.4B — Backup, export and deletion
- User-readable export for documents metadata and supported learning data.
- Clear data deletion and retention controls.
- Private cloud PDF deletion includes object, page index and metadata.
- Safe account deletion policy and cleanup workflow.
- Explain what is device-local, cloud-stored, shared publicly and retained after deletion.
- Test restore on a clean second device.

### 1.4C — Admin and operations
- Admin-only infrastructure/usage overview.
- Per-user request/usage limits and resource alerts.
- AI usage ledger: model, provider, request outcome, input/output tokens, cache metrics where available, weighted usage.
- Distinguish provider-reported usage from estimates.
- Separate Study Hub allocation from other activity on the same BrewKeg account.
- Monitor Supabase storage, database, egress, Edge Functions and Vercel separately.
- Safe diagnostics and correlation IDs.
- Never show credentials, raw prompts or private document content.
- Admin user identity: display name + stable ID, with authorised scope only.

### 1.4D — Reliability and security hardening
- RLS tests with at least two accounts.
- Storage ownership tests.
- Auth/session expiry and account-switch tests.
- Request quotas, rate limits and abuse controls.
- Idempotency for paid AI requests, notifications and sync.
- Typed errors and retry classification.
- Service outage and quota-exhaustion handling.
- Leaked-password protection enabled in Supabase Auth.
- Secrets only in protected server-side settings/Vault.
- Dependency and migration review.

### 1.4E — Automated quality
- Add unit tests for flashcard scheduling, scoring, date handling, sync merge and other deterministic logic.
- Add integration tests for PDF metadata/index lifecycle, provider response adapters and access policies.
- Add browser tests for core flows where feasible.
- Keep CI typecheck/build and independent validation.
- Track bundle size and basic performance budgets.

### 1.4 release gate
- [ ] Two-device sync and conflict cases pass.
- [ ] Account switching cannot cross-contaminate pending sync.
- [ ] Export/import and deletion paths pass.
- [ ] Admin data is scoped and auditable.
- [ ] AI usage and infrastructure limits are visible without exposing secrets.
- [ ] Security advisor issues are resolved or explicitly accepted with rationale.
- [ ] Automated tests cover critical data and learning logic.

## 9. Version 2.0 — Academic community

**Goal:** Students can publish useful academic contributions, discuss them and follow relevant spaces safely.

### 2.0A — Research Feed
Tabs:
- For You.
- Following.
- My Department.
- Discover.

Post types:
- Research idea/question.
- Research progress/findings.
- Academic discussion.
- Request for help.
- Resource/reference.
- Project/collaboration invitation.
- Study tip/explanation.

Post fields:
- Title and body.
- Category and subject tags.
- Optional attachments.
- Visibility.
- Author and timestamps.
- Edit/delete by author.
- Bookmark/share/report.
- Moderation state.

### 2.0B — Interactions
- Like, Insightful, Helpful and Support reactions.
- One active reaction per user per post; changeable.
- Threaded comments/replies.
- Edit/delete own comments.
- Mentions where safe.
- Save useful responses.
- Follow authors.
- Bookmark posts.
- Report content.
- Notifications based on preferences.
- Avoid popularity rankings and reaction farming.

### 2.0C — Feed discovery and performance
- Cursor pagination.
- Database-backed filters and search.
- Index author, visibility, category, creation time and common query paths.
- Fetch counts efficiently; avoid N+1 comments/reactions.
- Optimistic reaction with rollback.
- Lazy-load attachments.
- Cache only public/non-sensitive content carefully.
- Preserve private post/comment visibility through RLS.

### 2.0D — Course Hubs
- Course identity and academic metadata.
- Course discussion board.
- Questions and student explanations.
- Shared course resources.
- Past-question practice where permitted.
- Course study groups.
- Authorised announcements/moderators.
- Separate course community from research feed and Research Circles.

### 2.0E — Moderation and safety
- Clear community rules.
- Report post/comment/profile.
- Block user.
- Moderation queue and roles.
- Moderator audit trail.
- Spam/repeated-message controls.
- Privacy and contact defaults.
- Appeals/escalation process as the community grows.
- No public exposure of private academic records or contact details.

### 2.0 release gate
- [ ] Two accounts can create, edit, delete and view posts according to visibility.
- [ ] Reactions enforce one active record.
- [ ] Threaded replies and notifications work.
- [ ] Feed filters, pagination and search work without loading everything.
- [ ] Bookmarks and follows persist.
- [ ] Course Hubs and Research Feed remain distinct.
- [ ] Report/block/moderation controls work.
- [ ] RLS blocks unauthorised access to private posts, comments and groups.
- [ ] Community entry points are hidden while offline.

## 10. Version 2.1 — Messaging and notification experience

**Goal:** Students can contact each other safely and reliably, with predictable notifications.

### 2.1A — Direct messages
- One-to-one conversations.
- Inbox and conversation list.
- Message history and persistence.
- Send/receive text.
- Unread counts and read state.
- Scoped Realtime updates with safe polling fallback.
- Message requests/contact permissions.
- Block and report.
- Clear unavailable/restricted states from profiles.
- Conversation search.
- Per-conversation notification controls.
- Basic attachment support only after secure upload is ready.
- Keep private conversations out of public profile/feed queries and shared caches.
- Clear private in-memory state on sign-out.
- Group messaging remains deferred until one-to-one safety is reliable.

### 2.1B — Notification centre
- In-app notification list and read/unread state.
- Reply, comment, mention, message, invite, group and system events.
- Group similar reactions.
- Deep links to the relevant content.
- Quiet hours and per-category preferences.
- Global pause.
- Device registration and removal.
- Push delivery retry and deduplication.
- Expired endpoint cleanup.
- Do not notify when a category is disabled.
- Do not make push failure block the underlying action.

### 2.1C — Student profile actions
- Message/Send message.
- Follow/connect where enabled.
- Invite to collaboration when owner opted in.
- Show restricted/unavailable states.
- Report and block.
- Never reveal private email/phone/contact data by default.

**Current evidence:** Base direct messaging, requests, read state, block/report and push backend are implemented. Actual device push delivery has not been verified until a real subscription receives a notification. Conversation search, attachment controls and per-conversation settings remain.

### 2.1 release gate
- [ ] Two independent accounts can start and receive conversations.
- [ ] History survives refresh and session restart.
- [ ] Requests and contact controls work.
- [ ] Blocking prevents new contact and bypass attempts.
- [ ] RLS denies non-members access.
- [ ] Unread/read state works.
- [ ] Real push delivery, click-through and quiet hours pass on physical devices.
- [ ] Logout protects previous user's conversations and device subscription.

## 11. Version 2.5 — Connections and collaboration workspace

**Goal:** Turn academic discovery into safe, purposeful collaboration.

### 2.5A — Academic student discovery and matching
Profile fields:
- Display name.
- Institution, faculty and department.
- Level and academic session.
- Research interests.
- Skills (research, writing, statistics, presentation, etc.).
- Current projects the student chooses to share.
- Availability/open-to-collaborate setting.

Matching:
- Opt-in only.
- Suggested initial weights: shared research interests 35%, same department 25%, same level 15%, complementary skills 15%, shared project goals 10%.
- Treat weights as hypotheses to test, not permanent truths.
- SQL/database matching first; no AI call for every match.
- Explain why a person is suggested.
- Dismiss suggestions and hide profile from discovery.
- Never expose private contact information.
- Do not rank by popularity.

### 2.5B — Research Circles
- Topic-based small communities.
- Owner/moderator/member roles.
- Public/private membership.
- Invitations and join requests.
- Topic discussion.
- Shared resources/reading list.
- Project goals and progress updates.
- Clear purpose and community rules.
- Leave, mute, report and block controls.

### 2.5C — Study groups and shared learning
- Group study spaces.
- Group discussions.
- Shared flashcard decks.
- Shared quizzes.
- Group revision sessions.
- Resource collection.
- Membership permissions and ownership transfer.
- Do not expose private source documents unless explicitly shared.

### 2.5D — Project workspaces
- Project description and goals.
- Member roles and invitations.
- Task board and assignments.
- Milestones and due dates.
- Shared reading/reference list.
- Progress updates.
- Decisions/notes.
- Project-level notifications.
- Export project summary.
- Permission checks for every resource and action.

### 2.5E — Collaboration workflow
1. Discover relevant student or Circle.
2. View why they match.
3. Send a request/invitation.
4. Recipient accepts/declines.
5. Shared project/workspace created.
6. Members work toward milestones.
7. Contributions and outcomes are recorded.

**Current evidence:** Basic Course Hubs and Research Circles, membership, invitations and discussions are implemented. Base matching/discovery and direct messaging exist in part. Shared resources, reading lists, project goals/task boards, group flashcard decks/quizzes and group messaging remain planned.

### 2.5 release gate
- [ ] Matching is opt-in and explains its criteria.
- [ ] Students can dismiss/hide recommendations.
- [ ] Invitations respect blocks, privacy and discoverability.
- [ ] Private Circles remain private.
- [ ] Shared decks/resources have explicit ownership and permissions.
- [ ] Project tasks, milestones and membership permissions pass two-account tests.
- [ ] No private documents are shared by default.

## 12. Version 3.0 — Intelligent learning and research

**Goal:** Add high-value AI capabilities on top of reliable learning data and research workflows.

### 3.0A — AI Study Coach
- Explain difficult concepts using student's own materials where permitted.
- Generate targeted practice.
- Identify weak topics from actual learning history.
- Suggest a manageable revision plan.
- Ask follow-up questions grounded in retrieved sources.
- Show citations/page references when based on uploaded documents.
- Make uncertainty and missing source coverage clear.
- Do not fabricate citations or claim a source supports unsupported text.

### 3.0B — Personalised learning recommendations
- Recommend what to revise next based on quiz answers, review history and goals.
- Explain why an item is recommended.
- Let student dismiss or adjust recommendations.
- Use deterministic/local rules where adequate.
- Avoid continuous expensive AI calls.
- Keep a user-controlled recommendation setting.

### 3.0C — Research Discovery Centre
- Search and organise research topics/resources.
- Topic exploration and terminology.
- Research question development.
- Identify scope, population, variables and feasibility.
- Research summaries with source links.
- Save relevant resources to a project.
- Separate generated suggestions from verified facts.

### 3.0D — Literature review workspace
- Organise papers and sources.
- Extract bibliographic metadata.
- Notes and annotations.
- Thematic grouping and synthesis matrix.
- Compare arguments/methods/findings.
- Track gaps and disagreements.
- Citation/source verification.
- Export a structured literature review outline.
- Never invent a paper, author, DOI or citation.

### 3.0E — Citation and source management
- Reference library.
- Source metadata and URL/DOI.
- Citation style support (e.g. APA, MLA, Chicago, Harvard where requirements are defined).
- In-text citation and bibliography formatting.
- Duplicate detection.
- Source verification and missing-field warnings.
- Export bibliography.
- Keep user corrections and source provenance.

### 3.0F — Topic maps and academic terminology
- Topic/term relationships.
- Definitions and examples grounded in sources.
- Concept maps for a course/research area.
- Link terms to notes, questions and references.
- Keep graph generation bounded and explainable.

### 3.0G — AI cost and quality guardrails
- Haiku/low-cost model first for routine tasks.
- Stronger model only when task quality justifies it.
- No automatic expensive escalation.
- Opus excluded from routine routing unless a measured future use case is approved.
- Fable excluded from normal model selection/routing.
- Reuse extracted text and retrieval chunks.
- Cache stable prompts/results where measured cost-effective.
- Bound output tokens and retries.
- Deduplicate equivalent generation requests.
- Track provider-reported versus estimated usage.
- Enforce configurable budgets and warnings.
- No AI for likes, comments, messaging, notifications, simple matching or XP rules.

### 3.0 release gate
- [ ] Study Coach answers are grounded in selected sources.
- [ ] Recommendations explain their basis and can be dismissed.
- [ ] Research summaries link to verifiable sources.
- [ ] Citation metadata is never fabricated.
- [ ] Token use is measured and bounded.
- [ ] Privacy and document permissions apply to retrieval.
- [ ] Student can use non-AI learning tools when AI is unavailable.

## 13. Version 3.5 — Academic identity, portfolio and achievements

**Goal:** Recognise real academic progress and useful contributions without addictive mechanics.

### 3.5A — Academic portfolio
- Profile summary and academic interests.
- Selected projects.
- Research contributions.
- Public resources/posts chosen by the student.
- Skills and collaboration interests.
- Achievement evidence.
- Privacy controls per section.
- Exportable portfolio view.

### 3.5B — Contribution history
- Published academic posts.
- Helpful answers/contributions.
- Completed collaborative milestones.
- Shared learning resources.
- Project participation.
- Corrections/removal controls where appropriate.
- Avoid treating quantity as quality.

### 3.5C — Trusted achievement system
- Achievement definitions.
- Server-authoritative awards.
- Auditable XP transaction ledger.
- Achievements for meaningful work: completed study deck, helpful answer, research update, project milestone, topic mastery.
- No rewards for opening app, refreshing feed or spamming messages.
- No punitive streak reset.
- Student can hide gamification.
- Optional weekly challenges and research quests.
- Topic mastery and progress milestones.

### 3.5D — Optional leaderboards
- Scoped to course/group and opt-in.
- No global popularity leaderboard.
- Do not rank students by Likes.
- Do not expose private grades or academic records.
- Make participation optional and easy to hide.

**Current evidence:** Local XP/streak tracking exists. A server-backed, tamper-resistant XP/achievement ledger is not yet complete; do not present local XP as trusted account-wide achievement.

### 3.5 release gate
- [ ] XP awards come from trusted server-side rules.
- [ ] Ledger is auditable and duplicate-proof.
- [ ] Achievements reflect meaningful actions.
- [ ] Portfolio fields have granular privacy controls.
- [ ] Gamification can be hidden.
- [ ] No manipulative streaks, timers or popularity ranking.

## 14. Version 4.0 — Nigerian multi-university ecosystem

**Goal:** Expand beyond OOU without hardcoding a single institution's academic structure.

### 4.0A — Configurable institution model
Hierarchy:
**University → Faculty → Department → Level → Course → Semester**

- Institution directory.
- Faculties and departments.
- Configurable academic levels (100–500 and alternatives).
- Academic sessions and semesters.
- Course catalogue.
- Course memberships.
- Institution-specific validation and aliases.
- Data ownership and institution boundaries.
- Admin process for correcting directory data.

### 4.0B — Institution communities
- University-level community spaces.
- Faculty/department communities.
- Course Hubs.
- Institution moderators.
- Verified institutional spaces only where partnership/verification exists.
- Clear distinction between official and student-run content.

### 4.0C — Cross-university discovery
- Students can opt into cross-institution discovery.
- Research interests and projects can cross university boundaries.
- Course/resource equivalence where verified.
- Privacy and block rules remain in force.
- Avoid implying institutional endorsement.

### 4.0D — Nigeria-first operations
- Low-data mode and compressed media.
- Robustness on intermittent connections.
- Clear date/session formats.
- Support for varied academic calendars.
- Accurate directory maintenance.
- Support and moderation workflows suitable for Nigerian launch.
- Expand institution by institution, based on demand and verified data.

### 4.0 release gate
- [ ] OOU remains correctly configured.
- [ ] At least one additional institution can be added without code redesign.
- [ ] Institution/faculty/department/course records remain correctly scoped.
- [ ] Cross-university discovery is opt-in.
- [ ] Official/verified status is never implied without evidence.
- [ ] RLS and moderation boundaries pass multi-institution tests.

## 15. Version 4.5 — Academic opportunities and integrations

**Goal:** Connect students to relevant academic activity beyond the app.

Planned, subject to trusted data sources and partnerships:
- Academic events and seminars.
- Conferences and student research events.
- Scholarships, grants and competitions.
- Internships and research opportunities.
- Calls for papers and student journals.
- Academic resource integrations.
- Institution calendars and official announcements where authorised.
- Saved opportunities and reminders.
- Eligibility/closing-date explanations with source links.
- Report expired or inaccurate listings.
- Verified source/partner labels.
- No fabricated opportunity, deadline or institutional affiliation.

Release gate:
- [ ] Every listing has a traceable source and last-checked date.
- [ ] Expired listings are labelled or removed.
- [ ] Partner/official labels are verified.
- [ ] Students can report inaccurate listings.
- [ ] Personal data is not shared with third parties without clear consent.

## 16. Version 5.0 — Scale, governance and ecosystem maturity

This is a long-term direction, not a promise to build every item automatically.

Potential workstreams:
- Scalable database/query and storage operations.
- Reliable backups, disaster recovery and restore drills.
- Observability, error budgets and incident response.
- Formal moderation governance and escalation.
- Institution administrator roles and scoped access.
- Service status and maintenance communication.
- Accessibility audits and supported-browser policy.
- Privacy/data retention and account lifecycle review.
- Sustainable infrastructure and commercial plan review.
- Transparent limits and fair usage controls.
- API/integration governance.
- Product analytics focused on learning outcomes and safety, not screen time.
- Research/community quality evaluation.
- Optional institution dashboards with aggregate, privacy-preserving metrics.
- Migration/version compatibility strategy for old installed PWAs.

Only select items for implementation after evidence, user demand, capacity and compliance review. Do not add monetisation, ads or data-sharing features by implication.

## 17. Complete functional inventory

This inventory is the cross-version checklist to prevent features being forgotten.

### Learning
- [ ] PDF selection/validation and ~50 MB practical limit.
- [ ] Page-aware extraction and source references.
- [ ] Private cloud PDF sync/restore/delete.
- [ ] Indexing and retrieval.
- [ ] Notes and key points.
- [ ] Worked examples/explanations where supported.
- [ ] Organisation/entity extraction where useful.
- [ ] Flashcards and spaced repetition.
- [ ] Quiz/test generation and attempts.
- [ ] Card Rush variety and fair scoring.
- [ ] Planner, goals, tasks and revision calendar.
- [ ] Topic mastery and progress trends.
- [ ] Local learning trail and export.
- [ ] Cross-device sync of learning data.
- [ ] Cross-document search.
- [ ] Past-question practice where permitted.
- [ ] AI Study Coach.
- [ ] Research question/literature/citation tools.

### Community and collaboration
- [ ] Research Feed and filters.
- [ ] Posts, tags, visibility and attachments.
- [ ] Reactions, threaded comments and mentions.
- [ ] Follows, bookmarks, sharing and reports.
- [ ] Course Hubs.
- [ ] Research Circles.
- [ ] Department communities.
- [ ] Student discovery and matching.
- [ ] Direct messages and message requests.
- [ ] Blocking and moderation.
- [ ] Shared resources and reading lists.
- [ ] Shared decks and group quizzes.
- [ ] Project spaces, task boards and milestones.
- [ ] Group messaging after direct messaging is safe.
- [ ] Academic portfolio and contribution history.

### App experience
- [ ] Responsive mobile/desktop UI.
- [ ] Five primary destinations and clear hierarchy.
- [ ] Settings overview, inline category accordions and dedicated AI & Providers page.
- [ ] Animation toggle ON by default; OFF = current static baseline.
- [ ] OS reduced-motion support.
- [ ] Offline-aware navigation and AI controls.
- [ ] Installable PWA and branded icons.
- [ ] Safe-area support.
- [ ] Controlled update flow and build ID.
- [ ] Push notifications and in-app notification centre.
- [ ] Accessible controls and keyboard support.
- [ ] Light/dark appearance.
- [ ] Useful loading/empty/error/success states.
- [ ] Admin name + stable user ID.
- [ ] Admin usage/operations overview.
- [ ] Search/pagination for large lists.

### Trust, safety and operations
- [ ] RLS and storage ownership.
- [ ] Multi-account isolation tests.
- [ ] BYOK secret protection and endpoint restrictions.
- [ ] AI usage accounting and budget controls.
- [ ] Notification deduplication and quiet hours.
- [ ] Block/report/moderation and audit.
- [ ] Account switching/logout cache cleanup.
- [ ] Export, deletion and retention controls.
- [ ] Backup and restore.
- [ ] Rate limits and abuse prevention.
- [ ] Diagnostics without secrets/content.
- [ ] Infrastructure monitoring.
- [ ] Institution data governance.
- [ ] Production deployment and rollback discipline.

## 18. Shared technical architecture and non-negotiable rules

### Existing foundation to preserve
- React + TypeScript + Vite.
- PWA/service worker.
- Supabase Auth, Postgres, Storage, RLS, Realtime and Edge Functions.
- Dexie/IndexedDB for local-first learning.
- PDF.js with dedicated worker and compatibility helpers.
- Hosted AI and separate authenticated BYOK proxy.
- Existing routes/components and migrations.

Do not replace the stack without a concrete, measured reason.

### Data model domains
Proposed/implemented entities must be reviewed against actual migrations before adding duplicates:
- Identity: profiles, institutions, faculties, departments, academic levels, courses, course memberships.
- Learning: documents, document pages/index, notes, decks/cards, quiz attempts, planner tasks/goals, progress.
- Community: posts, tags, reactions, comments, bookmarks, follows, reports, blocks.
- Groups: groups, group memberships, invitations, group resources.
- Collaboration: projects, project members, tasks, milestones, reading lists.
- Messaging: conversations, conversation members, messages, requests.
- Notifications: notifications, preferences, push subscriptions, delivery log/outbox.
- Achievements: definitions, user achievements, XP transactions.
- Operations: usage ledger, rate limits, diagnostics and admin audit records.

### Security rules
- Every user-owned/community table has appropriate RLS.
- Private messages only visible to conversation members.
- Private posts/comments only visible according to parent visibility.
- Storage paths must be owner-scoped and validated server-side.
- BYOK credentials never exposed to frontend or logs.
- Service-role credentials never enter frontend bundles.
- Admin visibility must not weaken RLS.
- Blocking and contact restrictions enforced server-side.
- XP/achievements awarded by trusted server logic.
- Notifications idempotent and scoped to recipient/device.
- Account logout clears private client state and account-specific caches.
- Never use a UI-hidden button as the only access control.

### AI and token rules
- Haiku/low-cost model first for routine tasks.
- Sonnet only when stronger synthesis/reasoning is justified.
- No silent expensive escalation.
- Opus excluded from ordinary routing unless explicitly re-approved after measurement.
- Fable excluded from normal selection/routing.
- Process documents once; retrieve relevant chunks rather than resending whole files.
- Cache only when measured to be cost-effective.
- Bound output tokens, retries and request size.
- Deduplicate equivalent paid requests.
- Record model, provider, request result, usage and cache metrics where available.
- Separate Study Hub usage from unrelated account activity.
- Treat budgets as configurable allocations, not ownership of the provider account balance.
- No AI for ordinary reactions, comments, messages, notifications, basic matching or deterministic achievements.

## 19. Shared performance and device standards

- Measure bundle size and startup before/after redesigns.
- Lazy-load heavy feature routes.
- Avoid adding UI/animation dependencies without measured need.
- Keep initial app shell small.
- Minimise font/image/third-party requests.
- Paginate/incrementally render feeds, Library, notifications and admin lists.
- Avoid unnecessary React context rerenders.
- Stop polling when hidden/offline.
- Avoid duplicate Realtime subscriptions.
- Keep PDF worker split and avoid duplicate buffers/page arrays.
- Prefer transform/opacity for motion.
- Avoid large blur, animated gradients, heavy shadows and permanent will-change.
- Test low-memory devices and variable/weak network.
- Redmi 10A is the explicit low-end Android benchmark.
- iPhone Safari and installed iOS PWA are separate test targets.
- Never declare Android acceptance complete from desktop emulation alone.

## 20. Cross-version release process and definition of done

Every workstream must report:
1. Scope and user-visible behaviour.
2. Files/components changed.
3. Database migrations and Edge Functions changed.
4. Security/RLS impact.
5. Automated checks and results.
6. Manual tests, device, browser, account and network conditions.
7. Known gaps and unverified items.
8. Exact Git commit pushed to `main`.
9. Whether Vercel detected that commit.
10. Vercel deployment state and deployed commit/build ID.
11. Production smoke-test results.

Release discipline:
- Work in coherent, reviewable phases.
- Do not bundle unrelated backend refactors into visual work.
- Run typecheck, production build and repository validation after meaningful changes.
- Apply versioned migrations and verify them.
- Test RLS with multiple accounts.
- Test real devices for PWA/mobile claims.
- Vercel READY must match the commit being described as live.
- CI passing does not prove production deployment.
- Deployment READY does not prove end-to-end feature behaviour.
- Do not mark a checklist complete based on code review alone.
- Keep a rollback path for risky releases.

## 21. Current project status snapshot — 15 November 2026

This snapshot reconciles the implementation ledger with the latest hands-on feedback. It is not a substitute for a fresh live check.

### Product-owner acceptance
- **Version 1.0: previously accepted by the product owner; reaffirmed on 15 November 2026.** Do not describe V1.0 as awaiting user acceptance. Retain its test matrix as a regression/security checklist; unchecked individual tests are not retroactively marked PASS.

### User-reported working
- Offline study-data sync is working well in current user testing.
- PDF upload/processing is working well for tested files; practical tested limit is around 50 MB.
- AI question/answer functionality is working in current use.
- User is testing on iPhone.
- User reports Android experience so far is poor on Redmi 10A; another Android tester's feedback is pending.

### Implemented in code/backend (still retain acceptance tests)
- PDF extraction, private cloud storage, page indexing, resumable upload and cloud restore/delete workflow.
- Hosted AI proxy and Vault-backed BYOK proxy.
- Provider response normalisation and safer diagnostics.
- Auth/profile onboarding and account-backed academic profile.
- Learning Library, flashcards, quizzes, planner, goals and learning progress.
- PWA manifest/icons, safe-area-aware navigation, controlled update flow and app build identifier.
- Notification preferences, push subscription management, server-side dispatch and delivery deduplication.
- Research posts, reactions/comments, follows/bookmarks and visibility controls.
- Course Hubs and Research Circles base membership/invitation/discussion.
- Direct one-to-one messaging base, message requests, read state, block/report.
- Modular Settings navigation.
- PDF memory and offline deletion/account-isolation hardening.
- Admin infrastructure/usage foundations where already present.

### Immediate next work (complete all remaining V1.x scope)
- **Implementation in progress (15 November 2026):** persistent animation preference (default ON), OS reduced-motion override, static-motion CSS baseline, inline accordion Settings categories with AI & Providers as the only dedicated page, Animations under Appearance, offline-only navigation hiding/route fallback, useful three-item mobile navigation while offline, offline AI question-entry guard, and removal of a persistent compositor hint are committed. The Settings slice is deployed READY but still requires manual category, accessibility and device acceptance. This is not completion of Version 1.3.
- **Manual acceptance checklist:** see [USER_ACCEPTANCE_TESTS.md](USER_ACCEPTANCE_TESTS.md). Tests for this slice should be run only after its matching Vercel build is READY.
1. Manually accept the deployed Settings accordion on phone and desktop, including AI provider/model configuration, browser Back, keyboard/focus and reduced-motion behaviour.
2. Finish the shared design system, navigation and page-by-page visual hierarchy.
3. Complete measured low-end Android optimisation before and after visual changes.
4. Complete V1.1 physical-device PWA install/update/offline/push acceptance.
5. Complete V1.2 planner, flashcard, quiz, mastery and progress tests/quality gaps.
6. Complete V1.4 sync, conflict handling, backup/export/restore, admin operations and automated regression coverage.
7. Run V1.0 regression/security checks without reopening the accepted release unless a defect is found.
8. Incorporate pending Android tester feedback and verify the exact production deployment.

### Important unclosed acceptance items
- Real-device PDF tests at the current practical limit and cross-device restore/delete.
- Real hosted AI and real user BYOK provider requests (unless subsequently confirmed by a new test).
- Two-account RLS/privacy tests for documents, posts, groups and messaging.
- Real Web Push registration, delivery, click-through, quiet hours and unsubscribe on a physical device.
- Installed iPhone and Android update flow.
- Android performance and usability acceptance.
- Full cross-device sync for notes, cards, attempts and planner data.
- Server-backed trusted XP/achievement ledger.
- Advanced collaboration assets and project tools.
- Literature-review/research intelligence features.
- Multi-university directory and institution integrations.
- Supabase Auth leaked-password protection setting should be enabled.

### Deployment caution
Historical notes reported Vercel build-rate-limit and an older READY deployment. Always re-check the current GitHub main commit and Vercel deployment before stating what is live. Never rely on an old deployment snapshot.

## 22. Recommended execution sequence

Do not attempt every version in one enormous implementation pass. Build the product in this dependency order:

1. **Protect accepted V1.0:** keep its regression/security suite active; fix only evidence-backed defects.
2. **Complete V1.1:** physical-device PWA install/update/offline and push delivery.
3. **Complete V1.2:** learning productivity correctness, progress quality and automated deterministic tests.
4. **Complete V1.3:** corrected Settings accordion design, cohesive UI and measured Android-first performance.
5. **Complete V1.4:** cross-device sync/conflicts, export/restore/deletion, admin operations and automated integration tests.
4. **Release 2.0:** feed, course spaces, moderation and two-account privacy tests.
5. **Release 2.1:** messaging and push end-to-end safety/reliability.
6. **Release 2.5:** matching, shared resources and project collaboration.
7. **Release 3.0:** AI learning and research tools with strict source/cost controls.
8. **Release 3.5:** trusted academic portfolio and achievements.
9. **Release 4.0:** multi-university Nigerian expansion.
10. **Release 4.5/5.0:** verified opportunities, integrations, governance and scale only when justified.

A feature may already have implementation ahead of its version gate. Keep it behind appropriate flags/permissions or treat it as beta until its own acceptance gate passes.

## 22A. Dated implementation update — 15 November 2026

The accepted V1.0 release remains accepted. A V1.x reliability batch is implemented and deployed through commit `3398e8619439b88f16da4508ba77ce2f944508be` (Vercel READY).

Implemented in this batch:
- Centralised Supabase initial-session restoration and authenticated-user lookup.
- Account-backed academic profile persistence during signup, sign-in and profile setup.
- Public Discover browsing separated from sign-in-required save/progress actions.
- Explicit student-discovery opt-in guidance when a profile is private or not discoverable.
- Persistent PWA update-available state so an early service-worker event is not lost before the app shell mounts.
- Shared session restoration across Settings, groups, notifications, messages, community, Library and cloud document sync.
- Adaptive PDF size/page limits for browsers reporting 2 GB RAM or less.

Not yet accepted: physical Android/iPhone update and auth tests, real two-account privacy checks, push delivery, full offline/reconnect tests and the remaining V1.1–V1.4 release gates. See [V1_IMPLEMENTATION_PLAN.md](V1_IMPLEMENTATION_PLAN.md) and [USER_ACCEPTANCE_TESTS.md](USER_ACCEPTANCE_TESTS.md) for evidence and the outstanding test list.

## 23. Change control

When the product owner changes a requirement:
- Update this map and the relevant detailed specification.
- Record whether the new requirement supersedes an earlier one.
- Preserve historical implementation evidence.
- Do not erase failed tests or old deployment notes; append a dated correction.
- Update the version overview if scope or dependency order changes.
- Do not promote a feature to DONE without acceptance evidence.

**Master rule:** Study Hub is complete only when the learning foundation, mobile experience, privacy, community and collaboration workflows work together reliably—not when the roadmap has merely been implemented in code.


## 22B. Discover study workflow implementation — 15 November 2026

Public community contributions now have a first-class import path into the same local document stores used by manual uploads. The importer creates a community-sourced document and note, key points, organisations/references, flashcards, and quiz questions. The standard document reader, flashcard study session, spaced-repetition reviews, quiz/test route, attempts, exports and offline IndexedDB persistence are used after import. Rush also imports and uses that same deck rather than creating a separate disconnected deck. Re-import updates the existing local document.

The original PDF remains optional and private unless its contributor explicitly shares it. Community imports contain only the approved shared learning content; they do not fabricate a local copy of the original PDF.

Source commits: `e35fd63`, `917a452`, `57de3f9`, `fa086c2`, `c4465d2`. Both GitHub CI workflows passed on `c4465d2`. Vercel deployment is pending because its deployment API daily quota returned HTTP 402; see `V1_IMPLEMENTATION_PLAN.md`. Do not mark the feature released until a Vercel READY deployment and Section R acceptance checks.


## 22C. Admin control room, release queue and persistent upload feedback

**Implementation status:** Core database and UI implementation committed; end-to-end admin-account and device acceptance remains open. See [ADMIN_CONTROL_ROOM_PLAN.md](ADMIN_CONTROL_ROOM_PLAN.md).

- Admin users are sourced from Supabase Auth and joined with academic profile, AI usage and public-material activity. AI usage is no longer treated as the user directory.
- Admin can create/edit drafts, publish manually, enable automatic publishing, filter documentation updates and manage named release notes.
- Published updates are delivered in a sequential iPhone-style in-app notification queue. PWA code-update prompts remain a separate mechanism.
- New-upload default visibility is configurable in Settings. Generated content may be public while the original PDF remains private unless separately selected.
- Upload progress is surfaced globally while extraction/cloud save/AI generation remains active.
- AI reduce now has one bounded schema-correction call and a smaller-batch fallback; hosted mode remains serial and BYOK uses a bounded two-worker fallback.
- Do not mark this work fully accepted until the matching manual checks in USER_ACCEPTANCE_TESTS.md pass on an admin account and mobile devices.


## 22D. Comprehensive study engine and configurable testing — 15 November 2026

A new implementation slice replaces the short-note-first approach with selectable Quick, Balanced, Comprehensive and Near-source depth. Comprehensive is the default and aims to preserve all meaningful source information. Long-document digests are synthesized in consecutive batches without the former arbitrary final 8,000-character truncation. The document reader displays study depth and page/section/concept coverage.

Validated map-section results are cached locally by document, content fingerprint, model, depth and prompt version so retries can reuse completed work. Map and synthesis stages use bounded parallel workers. AI tests are now generated on demand; students choose 1–100 questions and a difficulty level, with progressive difficulty and AI/source/mixed question-source modes.

A guarded authenticated RPC now creates direct conversations atomically after checking discoverability, message policy and blocks. Existing conversations remain openable after new-message preferences change.

Implementation details and the acceptance plan are in [COMPREHENSIVE_STUDY_ENGINE_PLAN.md](COMPREHENSIVE_STUDY_ENGINE_PLAN.md). Do not mark the feature accepted until Section T is completed on a real 191-page PDF and the two-account messaging checks pass. This implementation branch must pass GitHub CI/validation and receive a READY Vercel deployment before production/device testing.
