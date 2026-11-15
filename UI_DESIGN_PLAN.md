# Study Hub UI Redesign & Performance Plan

**Status:** Approved design direction; implementation in progress (first motion/offline safeguards committed; full redesign not complete)  
**Date:** 15 November 2026  
**Repository:** `akbarambali157-dev/Study`  
**Scope:** Visual system, navigation, settings, admin user list, offline-aware UI, motion preference, mobile performance and acceptance testing.

This document is the implementation brief for the next UI pass. It is deliberately performance-first: the redesign must feel more polished and lively without making the app heavier, slower, harder to use offline, or unreliable on lower-end Android devices.

## 1. Product direction

Study Hub should feel like a modern academic workspace with a clear identity—not a generic admin dashboard and not a noisy social network.

The visual direction is:

- **Calm but lively:** confident typography, clear surfaces, restrained accent colour and purposeful visual hierarchy.
- **Academic, not corporate:** welcoming, focused and useful for students.
- **Content-first:** documents, study progress, questions and useful community contributions take priority over decoration.
- **Mobile-first:** touch-friendly layouts and predictable navigation on narrow screens.
- **Consistent:** one design language across Learn, Research, Community, Discover, Profile, Settings and Admin.
- **Progressive enhancement:** the app remains fully understandable and usable when animation, blur, shadows or other visual effects are unavailable.

The redesign should improve the current UI substantially while retaining familiar workflows. Do not rewrite working features or replace the existing React/Supabase architecture just to achieve a visual change.

## 2. Non-negotiable design and performance rules

1. No new visual effect may block a user's action or delay content becoming usable.
2. No continuous decorative animation, animated background, particle effect, parallax or heavy 3D.
3. Prefer CSS transitions and transforms over JavaScript animation loops.
4. Animate only opacity and transform for routine transitions; avoid animating layout dimensions, large shadows, filters or blur.
5. Respect the user's motion setting and the operating system's reduced-motion preference.
6. Preserve keyboard access, visible focus, readable contrast and comfortable touch targets.
7. Avoid loading large image assets or icon libraries for decoration.
8. Keep PDF.js, PDF workers, AI clients and community data out of the initial app-shell path unless the relevant feature is opened.
9. Preserve offline-first study workflows. Network-dependent UI must not masquerade as usable while offline.
10. Every phase must pass TypeScript, production build and existing validation before moving on.

## 3. Visual system

### 3.1 Colour and surfaces

First audit the current tokens in `src/styles/globals.css` and `src/styles/visual-refresh.css`; consolidate rather than layering another competing theme file.

Establish semantic tokens for:
- App background and elevated surface.
- Primary text, secondary text and muted text.
- Brand/accent, accent-soft and focus ring.
- Border, subtle divider and disabled state.
- Success, warning, error and informational states.
- Overlay/scrim.

Use the existing brand palette as the starting point, then tune contrast and consistency. Avoid introducing many unrelated accent colours. Colour must never be the only way to communicate state.

### 3.2 Typography

- Use a compact, consistent type scale with clear page titles, section headings, body text, labels and metadata.
- Keep body copy comfortable on phone screens; avoid tiny grey text for essential information.
- Use tabular numerals for counts, dates and IDs where helpful.
- Keep line lengths controlled on desktop and allow natural wrapping on phones.
- Use the existing font stack unless a measured benefit justifies adding a font download.

### 3.3 Spacing, shape and elevation

- Define a small spacing scale and apply it consistently.
- Use a restrained radius scale for cards, inputs, menus and dialogs.
- Prefer borders and surface contrast over large blurred shadows.
- Keep cards visually distinct without nesting cards inside cards unnecessarily.
- Make buttons, inputs and icon controls consistent in height, radius and focus treatment.

### 3.4 Iconography

Use one consistent icon family already available in the project. Keep icons paired with labels where meaning is not universal. Avoid emoji as primary navigation icons. Ensure icon-only controls have accessible names and comfortable hit areas.

## 4. Navigation and responsive shell

### Phone layout

- Retain a fixed, safe-area-aware bottom navigation for the primary destinations.
- Keep the number of primary destinations limited and labels visible.
- Put secondary actions such as notifications and messaging in the top bar or relevant page context.
- Use a consistent page header with title, optional subtitle and one clear primary action.
- Ensure the content scroll area accounts for the bottom bar and iPhone safe areas.
- Use full-screen or near-full-screen focused views for complex tasks rather than cramped nested modals.

### Tablet and desktop layout

- Use a stable sidebar for primary navigation where there is sufficient width.
- Keep content within a readable maximum width.
- Use two-column layouts only when both columns remain useful at intermediate widths.
- Avoid simply stretching phone cards across a very wide screen.

### Navigation behaviour

- Preserve route URLs and browser back behaviour.
- Avoid remounting the whole application when switching tabs.
- Keep scroll position where it is useful and expected.
- Use clear loading placeholders that match the final layout to reduce layout shift.

## 5. Page-by-page visual plan

### Home / Dashboard

- Give the page a strong but compact welcome/header area.
- Make the main action obvious: continue studying or resume the most recent useful task.
- Prioritise a small number of relevant cards: continue learning, upcoming plan, recent materials and useful updates.
- Use compact progress summaries; do not turn the dashboard into a wall of statistics.
- Make empty states instructive, with one useful next action.
- Defer secondary widgets below the primary study content.

### Learn

- Present Library, Notes, Flashcards, Tests and Planner as a coherent learning workspace.
- Use clear tabs, segmented navigation or grouped entry cards depending on the existing route structure.
- Make recent documents and saved work easy to resume.
- Keep PDF controls compact and predictable; do not redesign the working PDF processing pipeline.
- Preserve the current tested practical PDF limit of approximately 50 MB. Keep upload progress, cancellation and failure/retry states clear.
- Avoid rendering large extracted page collections in lists; retain the existing incremental/cursor-based loading strategy.

### Notes and AI assistance

- Keep the note editor focused, readable and fast.
- Make local editing and saving clearly available offline.
- When offline, remove or disable the network-dependent AI question input and explain briefly that AI requests need a connection.
- Do not discard typed content when connectivity changes. If a draft exists, preserve it locally and make its status clear.
- When online, distinguish local note actions from hosted AI actions visually.
- Do not change working AI request logic as part of a visual-only pass.

### Research Feed and Community

- Use a readable feed column with clear author, department/level context where public, timestamp, post body and action row.
- Make post actions discoverable but visually secondary to the post itself.
- Use restrained reaction and comment states; avoid noisy counters and excessive badges.
- Use clear filters and pagination; do not fetch an unlimited feed.
- When offline, hide Community and other online-only destinations/entry points rather than presenting dead-end screens. If a user navigates directly to a cached route, show a concise offline state and a route back to available study tools.
- Restore community entry points when connectivity returns.
- Do not expose private posts, messages or profile fields through cached UI.

### Discover and student profiles

- Make matching criteria understandable: shared department, level, research interests and skills.
- Clearly distinguish suggested connections from confirmed connections.
- Respect opt-in discoverability and profile visibility.
- Keep profile cards concise; show academic context before decorative profile details.
- Do not expose private contact details.

### Messaging and notifications

- Keep conversation lists compact, with clear unread state and timestamps.
- Make message requests and block/report controls easy to find without dominating the interface.
- Use a focused conversation view on phones.
- Do not cache private messages in shared caches or show stale private content after account switching.
- Hide or disable network-dependent messaging entry points while offline.

### Settings redesign

Remove the current side/slider-style section selector.

Use a **Settings overview** with grouped, tappable rows. Each row has a clear title, short description and optional current value/status. **AI & Providers is the only dedicated full settings page** because it contains extensive provider, endpoint, model, key and connection-test configuration. It has a clear back control and preserves browser Back behaviour.

All other categories expand inline directly underneath their row using a restrained accordion interaction: Account, Academic Profile, Appearance, Notifications, Privacy & Safety, Storage & Documents, Offline & App, and Help & About. The content appears below the selected category rather than navigating away to a separate page. Support keyboard and screen readers, and avoid rendering every heavy panel before it is opened. The expansion/collapse transition is subtle and short when motion is enabled; it becomes static/instant when app Animations is OFF or OS reduced-motion is enabled.

Put the **Animations** preference inside **Appearance**. Preserve the currently accepted default of ON for a new profile, local persistence and OS reduced-motion override. Do not add a second animation setting under Offline & App.

Do not make nonfunctional controls look operational. If an option is not implemented or unavailable, label it honestly or omit it until it works.

Do not make nonfunctional controls look operational. If an option is not implemented or unavailable, label it honestly or omit it until it works.

### Admin

- In the user list, show display name as the primary identity and the stable Supabase user ID as secondary metadata.
- Add a copy-ID control with accessible label and brief copied confirmation.
- Provide search/filter and pagination rather than loading all users at once.
- Keep role/status indicators clear and restrained.
- Only return fields authorised for the admin role; never expose credentials, tokens or private profile fields.
- Ensure user IDs remain selectable/copyable on touch devices.

### Authentication and onboarding

- Keep sign-in and registration focused with clear validation.
- Avoid large decorative illustrations that slow first load.
- Make errors actionable and preserve form values after recoverable failures.
- Explain installation and notification permission at the moment they become relevant, not as an intrusive first-launch sequence.

## 6. Motion system and Settings toggle

### User-facing setting

Add a setting named **Animations** in Settings → Appearance.

- **Default for new users: ON.**
- **OFF must reproduce the current static UI experience**, with no decorative transitions or animated entrance effects.
- Store the preference locally on the device so it is available before the rest of the app loads and works offline.
- Do not require a server request to read or change it.
- Keep the preference device-local unless a future product decision explicitly calls for cross-device preference sync.
- Explain the control simply: “Use subtle transitions when moving around Study Hub.”

The current interface is the no-animation baseline. The ON state adds only restrained, useful motion; it must not become a completely different layout or interaction model.

### Motion allowed when ON

- Short page/content transitions.
- Small press/selection feedback on buttons and navigation.
- Subtle expansion/collapse of menus and settings sections.
- Lightweight toast and dialog entrance/exit.
- Progress indicators where motion communicates actual progress.

Suggested timing: approximately 120–200 ms for small feedback and 160–240 ms for screen/surface transitions. Use a consistent easing curve. These are ceilings/guidelines, not a requirement to animate every interaction.

### Motion prohibited

- Infinite decorative loops.
- Large spring/bounce effects.
- Parallax, animated gradients, particle effects or animated page backgrounds.
- Animations that delay form submission, navigation or content access.
- Animating large lists item-by-item.
- Motion that causes layout shifts or repeated repaints.

### Accessibility precedence

- Respect the operating system's `prefers-reduced-motion: reduce` setting.
- If the OS requests reduced motion, effective motion is OFF even if the app preference is ON.
- Keep the app preference ON by default for users whose OS does not request reduced motion.
- If the user switches Animations OFF, it remains OFF regardless of OS setting.
- Ensure the no-motion state has no smooth scrolling, animated skeleton shimmer or CSS transition that remains perceptible.

### Implementation shape

- Add one central motion preference hook/provider rather than scattered per-component settings.
- Apply a root class or data attribute such as `data-motion="on|off"`.
- Define motion tokens centrally in the existing global styles.
- Use CSS transitions for simple states; do not add an animation dependency just for this.
- Prevent first-paint flashes by reading the local preference before the main UI renders where practical.
- Test preference persistence after refresh, app restart and offline launch.

## 7. Offline-aware interface

The UI must reflect the actual capabilities available offline.

### Offline behaviour

- Keep local-first Learn tools visible and usable.
- Hide Community, Discover actions that require the network, messaging, remote sync controls and other online-only entry points while offline.
- Do not delete local content or hide local notes/documents.
- Disable the AI prompt/input when offline, with a concise explanation.
- Preserve drafts and local edits across connectivity changes.
- Show a small, non-blocking offline indicator rather than a large persistent warning banner.
- When connectivity returns, restore online features and allow existing sync queues to resume safely.

### Connectivity correctness

- Do not rely on `navigator.onLine` as the sole proof that the backend is reachable.
- Combine browser connectivity events with the app's existing request/error state or a lightweight reachability signal.
- Avoid repeated health checks and aggressive polling.
- Prevent flicker during brief network changes with a small state debounce.
- Make all offline/online visibility decisions from one shared connectivity state to avoid inconsistent navigation.

## 8. Performance and optimisation plan

### Bundle and startup

- Inspect the Vite bundle before and after the redesign.
- Lazy-load feature routes and heavy modules such as PDF viewing, admin, charts and community where architecture permits.
- Keep the app shell small and avoid importing feature-specific dependencies into the root layout.
- Do not add a UI, icon or animation library without a measured need.
- Avoid unnecessary font, image and third-party requests.
- Preserve service-worker caching rules and avoid caching sensitive responses.

### Rendering

- Use stable keys and memoisation only where profiling shows repeated expensive work.
- Avoid broad context updates that rerender the entire application for a small preference change.
- Keep feed, user list, notifications and Library data paginated or incrementally rendered.
- Virtualise only genuinely long lists, and only after measuring; avoid adding complexity to short lists.
- Keep expensive derived data out of render paths.
- Avoid large DOM trees and deeply nested card wrappers.

### CSS and animation

- Prefer transform/opacity transitions.
- Avoid large-area backdrop filters, heavy shadows and complex selectors on frequently updated lists.
- Avoid permanent will-change declarations; apply them only where a measured transition benefits.
- Do not animate height for large content blocks when a simple opacity/state change is sufficient.
- Ensure animations pause or disappear when the document is hidden where relevant.

### PDF and memory

- Do not regress PDF.js worker separation or compatibility helpers.
- Do not keep multiple full page arrays or duplicate PDF buffers in React state.
- Keep the existing 50 MB upload ceiling and resumable upload path.
- Use progressive loading and clear progress/error feedback.
- Re-test opening, scrolling and closing PDFs after any global CSS or layout changes.

### Network and data

- Do not fetch data solely to decorate a card.
- Keep cursor pagination and query limits.
- Avoid polling when a page is hidden or the user is offline.
- Use existing Realtime/polling fallback behaviour rather than introducing duplicate subscriptions.
- Avoid eager loading all community, message or admin data on app launch.

### Low-end Android

Use the Redmi 10A as an explicit baseline, not as an afterthought. Record repeatable before/after measurements for compressed initial JS, cold start, first usable interaction, long tasks, scroll responsiveness, memory after repeated navigation/PDF open-close, idle network requests and service-worker cache size. Initial compressed JS target is at or below 250 KB where practical; defer PDF.js, provider SDKs, admin, charts and community-only modules. Target first usable Home interaction within 3 seconds on a repeatable constrained-device/network profile. Investigate repeated long tasks over 100 ms and any task over 200 ms. These are targets to measure, not current claims.
- Avoid heavy blur, layered shadows and large animated surfaces.
- Keep transitions short and optional.
- Minimise simultaneous mounted screens and hidden panels.
- Avoid large images and oversized list pages.
- Keep tap targets generous without making the page excessively tall.
- Test scrolling, keyboard appearance, bottom navigation, dialogs and PDF memory.
- If performance degrades, remove the expensive effect rather than asking the device to work harder.

## 9. Implementation phases

### Phase 0 — Baseline and audit

- [ ] Record current Lighthouse/web-vitals and Vite bundle baseline where measurable.
- [ ] Review `src/styles/globals.css`, `src/styles/visual-refresh.css` and component-level styles for duplicated/conflicting rules.
- [ ] Map existing routes and current settings/admin components.
- [ ] Identify current offline state source and online-only routes/actions.
- [ ] Capture current iPhone and Redmi 10A screenshots/performance observations.
- [ ] Do not change behaviour during the baseline audit.

### Phase 1 — Foundations

- [ ] Consolidate semantic design tokens and typography/spacing scales.
- [ ] Refine shared page shell, headers, cards, buttons, inputs, dialogs and empty states.
- [ ] Add the central animation preference, default ON, local persistence and reduced-motion support.
- [ ] Verify OFF state matches the existing static experience.
- [ ] Keep all changes backward-compatible with existing feature components.

### Phase 2 — Navigation and Settings

- [ ] Remove Settings side/slider navigation.
- [ ] Build Settings overview with inline accordion categories; AI & Providers remains the only dedicated full page.
- [ ] Keep single-toggle settings compact.
- [ ] Add the Animations toggle under App & Offline.
- [ ] Preserve browser back navigation and mobile safe areas.

### Phase 3 — Offline-aware shell

- [ ] Add shared online/offline capability state.
- [ ] Hide online-only navigation and community/social entry points while offline.
- [ ] Disable AI question input offline with a clear explanation.
- [ ] Preserve notes, drafts and local learning actions.
- [ ] Restore online entry points safely when connectivity returns.
- [ ] Test offline launch, connectivity loss during use and reconnect.

### Phase 4 — Admin and page polish

- [ ] Show admin user display name and stable user ID.
- [ ] Add copy-ID action and pagination/search where needed.
- [ ] Polish Dashboard, Learn, Notes, Feed, Discover, Messages and Profile in that order of priority.
- [ ] Keep existing feature logic and security policies intact.
- [ ] Use consistent loading, empty, error and success states.

### Phase 5 — Device optimisation and acceptance

- [ ] Run type-check, production build and repository validation.
- [ ] Compare bundle and startup metrics against Phase 0.
- [ ] Test animation ON and OFF.
- [ ] Test OS reduced-motion mode.
- [ ] Test iPhone Safari and installed PWA.
- [ ] Test Redmi 10A and the pending Android tester's device.
- [ ] Test offline/online transitions and verify no draft or local data loss.
- [ ] Re-test PDFs up to the currently supported 50 MB practical limit and AI online.
- [ ] Verify admin user IDs are visible only to authorised admins.
- [ ] Confirm no new console errors, broken routes, horizontal overflow or inaccessible controls.

## 10. Acceptance criteria

The redesign is accepted only when all of the following are true:

- [ ] The app has a consistent, recognisable visual system across its main sections.
- [ ] Phone navigation is clear, stable and safe-area aware.
- [ ] Settings no longer uses the side/slider section selector.
- [ ] Account, Academic Profile, Appearance, Notifications, Privacy & Safety, Storage & Documents, Offline & App, and Help & About expand inline beneath their rows.
- [ ] AI & Providers alone opens its dedicated configuration page.
- [ ] Animations toggle is inside Appearance and respects app OFF plus OS reduced-motion.
- [ ] Animations are ON by default for new users.
- [ ] Turning Animations OFF produces the current static UI baseline.
- [ ] OS reduced-motion preference is respected.
- [ ] Animation preference persists across reloads and offline launches.
- [ ] Admin can see a user's display name and stable user ID, subject to admin authorisation.
- [ ] Community and other online-only entry points disappear while offline.
- [ ] AI question input cannot submit while offline and clearly explains why.
- [ ] Local notes and learning materials remain available offline.
- [ ] The UI remains responsive on iPhone and Redmi 10A.
- [ ] No material regression in PDF handling, AI, offline sync, authentication or data privacy.
- [ ] No avoidable increase in initial bundle size or cold-start time.
- [ ] CI and production build pass; deployment is separately verified before calling the changes live.

## 11. Out of scope for this UI pass

- Rewriting the PDF processing or AI pipelines that the user reports are working.
- Replacing Supabase, Dexie, routing or the existing app architecture.
- Adding new social features or gamification systems.
- Building a new native mobile application.
- Adding a heavy animation framework.
- Changing backend permissions merely to make admin data easier to display.
- Declaring device acceptance complete before the pending Android feedback arrives.

## 12. Delivery rule

Implement in small, reviewable phases on `main`, with a successful validation/build after each meaningful phase. Preserve the existing working baseline and avoid combining broad visual changes with unrelated backend refactors. A GitHub commit is not proof of production deployment: verify that Vercel has deployed the matching commit and reports READY before describing the redesign as live.


## 15. Implementation progress — 15 November 2026

The initial implementation includes a persistent Animations preference (default ON), OS reduced-motion override, a CSS static baseline when motion is off, focused Settings category screens with URL-backed back navigation, offline-aware navigation, a safe offline route fallback and hiding the document AI question entry while offline. The focused Settings screens are an interim implementation and do not match the product owner's corrected requirement: all categories except AI & Providers must become inline accordions, and Animations belongs under Appearance. This is not completion of the design plan. The full navigation hierarchy, shared connectivity/reachability handling, admin display names, page-by-page visual polish, measured performance work and device acceptance remain open. Track manual tests in [USER_ACCEPTANCE_TESTS.md](USER_ACCEPTANCE_TESTS.md).
