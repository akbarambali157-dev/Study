# Study Hub — User Acceptance & Device Testing Checklist
**Created:** 15 November 2026  
**Purpose:** The product owner’s hands-on test list for features that cannot be fully accepted by code review alone.  
**Companion documents:** [VERSION_MAP.md](VERSION_MAP.md), [plan.MD](plan.MD), [UI_DESIGN_PLAN.md](UI_DESIGN_PLAN.md).

## How to report a test
For each test, record:
- Result: PASS / FAIL / BLOCKED / NOT TESTED.
- Device and browser (e.g. iPhone 11, iOS 18.7.4, Safari; Redmi 10A, Android version, Chrome).
- Whether using an installed Home Screen PWA or a normal browser tab.
- Account used: Account A / Account B / signed out / admin (never write passwords or API keys here).
- Network: Wi-Fi / mobile data / weak network / offline.
- Exact steps and what happened.
- Screenshot or short screen recording for visible defects. Hide email addresses, user IDs, messages and private documents before sharing screenshots.

**Do not send passwords, API keys, recovery codes or private document contents in this checklist.** For AI tests, report only the provider mode and whether it passed; redact credentials and private data.

A test marked NOT READY should wait until the relevant implementation has been deployed. A test marked PASS is user acceptance evidence, not proof that every other browser/device is supported.

---

## A. Test environment and release identification

For the complete V1.x execution order and Android performance measurement contract, see [V1_IMPLEMENTATION_PLAN.md](V1_IMPLEMENTATION_PLAN.md).

- [ ] A1. Open Study Hub and record the visible app version and build ID from Settings.
- [ ] A2. Confirm the deployed build matches the Git commit the release notes identify.
- [ ] A3. Test in a normal browser tab.
- [ ] A4. Test the installed Home Screen PWA separately.
- [ ] A5. Test on iPhone Safari.
- [ ] A6. Test on Redmi 10A / Android Chrome.
- [ ] A7. Test on the additional Android tester's device and record model/OS/browser.
- [ ] A8. Test on desktop browser if available.
- [ ] A9. Record cold-start behaviour after fully closing the browser/app.
- [ ] A10. Record any blank screen, browser reload, tab crash, excessive heat or unusual battery use.

## B. Version 1.0 — Account, PDF and AI regression/security suite

**Product-owner status: ALREADY ACCEPTED before this update; reaffirmed on 15 November 2026.** The product owner has already accepted V1.0. The unchecked boxes below are retained as individual regression/security checks whose execution has not necessarily been recorded here; they do not mean V1.0 is awaiting the user's acceptance. Reopen V1.0 only for a reproducible regression, security issue or data-integrity defect. Do not mark individual checks PASS without recording an actual test.

### B1. Authentication and profile
- [ ] Register a new test account with an email you control.
- [ ] Confirm name/email prefill correctly into profile setup.
- [ ] Complete institution, faculty, department, level and academic session.
- [ ] Refresh and confirm the profile persists.
- [ ] Sign out and sign in again.
- [ ] Confirm the existing profile is not replaced by blank/default provider data.
- [ ] If a social sign-in option is enabled, test its profile prefill and cancellation path.
- [ ] Change account on the same device and confirm the previous account's private content is not displayed.
- [ ] Sign out while offline and record the exact behaviour/message.
- [ ] Confirm private in-memory messages and notifications disappear after sign-out.

### B2. PDF upload and processing
Use a non-sensitive, text-based PDF you are allowed to use.
- [ ] Upload a small PDF (1–5 MB).
- [ ] Confirm title, filename, page count and status are correct.
- [ ] Open the document and inspect extracted text against the original.
- [ ] Confirm page references/citations point to the right page.
- [ ] Generate notes and key points.
- [ ] Generate flashcards and test questions.
- [ ] Confirm outputs actually relate to the PDF, not generic content.
- [ ] Close the document, return to Library and reopen it.
- [ ] Upload a medium PDF (10–20 MB).
- [ ] Upload a larger PDF close to the currently tested practical limit (around 50 MB); do not assume larger files are supported.
- [ ] Confirm the interface remains responsive while processing.
- [ ] Test a corrupt PDF and confirm a useful error with retry/recovery.
- [ ] Test a scanned/image-only PDF and confirm the app does not pretend it extracted text if OCR is unavailable.
- [ ] Test cancellation or leaving the page during upload/processing.
- [ ] Test a failed upload followed by retry.
- [ ] Confirm no duplicate Library entries are created after retry.

### B3. PDF cloud sync and account isolation
Perform only with two test accounts and non-sensitive sample PDFs.
- [ ] With Account A online, sync a private PDF.
- [ ] Confirm sync state is clear and the document remains readable locally.
- [ ] Sign in as Account B on the same device; confirm Account A's cloud PDF is not shown as Account B's.
- [ ] Confirm Account B cannot delete or access Account A's cloud object.
- [ ] Sign back in as Account A and confirm its own document remains available.
- [ ] Delete a synced test PDF online and confirm cloud object/index/metadata cleanup.
- [ ] Queue deletion while offline, reconnect as the original owner and confirm cleanup completes.
- [ ] Confirm pending deletion is not sent under another signed-in account.
- [ ] On a second device, sign in as Account A and restore/open the synced PDF.
- [ ] Confirm private source PDF is never made public by sharing generated study material.

### B4. AI provider tests
- [ ] Test hosted AI mode using a normal signed-in test account.
- [ ] Test a full PDF-to-notes/cards/questions generation.
- [ ] Test follow-up questions grounded in a selected key point.
- [ ] Test BYOK only if you have intentionally configured your own provider key.
- [ ] Confirm BYOK connection test returns a plain-text confirmation.
- [ ] Confirm invalid/mismatched provider key and endpoint are rejected safely.
- [ ] Confirm provider failure produces a readable error and diagnostic ID without exposing the key.
- [ ] Confirm empty response is treated as failure, not success.
- [ ] Confirm AI usage is not silently repeated after an ambiguous timeout.
- [ ] Confirm changing provider mode persists after refresh/restart.
- [ ] Confirm no API key appears in browser storage, page source, logs or screenshots.
- [ ] Test AI unavailable/quota-exhausted state; local PDFs and saved learning materials must remain usable.

## C. Version 1.1 — PWA, offline and push

### C1. Installation and launch
- [ ] Install on iPhone using Add to Home Screen.
- [ ] Open from the Home Screen and confirm standalone display.
- [ ] Confirm icon, app name, status bar and safe areas.
- [ ] Install on Android using the browser's install option.
- [ ] Open Android installed app and confirm standalone display.
- [ ] Rotate the phone; confirm no clipped or unusable controls.
- [ ] Open keyboard/input fields near the bottom; confirm navigation and fields remain reachable.

### C2. Offline learning
- [ ] Open Study Hub online and wait for the app shell to finish loading.
- [ ] Turn on Airplane Mode or disable Wi-Fi/mobile data.
- [ ] Reopen the app.
- [ ] Confirm Home and local Library remain usable.
- [ ] Open a previously saved PDF and read notes/key points.
- [ ] Review saved flashcards.
- [ ] Complete a locally available quiz/test and confirm the attempt is saved locally.
- [ ] Open Planner and confirm locally stored tasks remain available.
- [ ] Confirm Community, Discover network actions, Students, Groups, Messages, Notifications and Admin are not offered as online destinations while offline.
- [ ] Try opening an online-only URL directly while offline; confirm it returns safely to local Home rather than presenting a broken network page.
- [ ] Confirm AI question input is hidden/disabled while offline.
- [ ] Confirm no offline AI question can be submitted.
- [ ] If a question draft was entered before losing connectivity, reconnect and confirm the draft is preserved if the same screen remains open.
- [ ] Reconnect and confirm online-only features return without a full app reset.
- [ ] Confirm no flicker or repeated online/offline banners during a stable connection.
- [ ] Confirm offline work is not lost after app restart.

### C3. Update lifecycle
- [ ] Install one production build.
- [ ] Deploy a later build and open the installed app.
- [ ] Confirm update notification appears and the build ID changes after applying.
- [ ] Choose Later; confirm current screen/work remains available.
- [ ] Apply update when no work is in progress.
- [ ] Repeat while an unsaved draft exists; confirm it is not silently lost.
- [ ] Repeat during a document upload only when safe; confirm update does not corrupt the upload.
- [ ] Launch offline after an update and confirm cached local study tools still work.

### C4. Web Push (requires a supported installed PWA and permission)
- [ ] Open the installed iPhone PWA or supported Android PWA.
- [ ] Enable push from the explicit Settings action.
- [ ] Confirm the browser permission prompt appears only after the action.
- [ ] Confirm the device is registered.
- [ ] Send a self-test notification.
- [ ] Confirm it arrives on the physical device.
- [ ] Tap it and confirm the correct Study Hub destination opens.
- [ ] Disable one notification category and confirm it stops.
- [ ] Enable quiet hours and test a notification inside the quiet period.
- [ ] Pause all notifications and confirm no push is sent.
- [ ] Unsubscribe this device and confirm it no longer receives pushes.
- [ ] Sign out and confirm device/account subscription cleanup.
- [ ] Confirm in-app notification records remain even if push delivery fails.

## D. Version 1.2 — Study productivity

- [ ] Create a study task with a due date.
- [ ] Edit, complete and delete the task.
- [ ] Refresh/restart and confirm task state persists.
- [ ] Create a study goal and record sessions.
- [ ] Confirm progress values update correctly.
- [ ] Create or open a flashcard deck.
- [ ] Review cards and test Again/Hard/Good/Easy scheduling.
- [ ] Close and reopen the deck; confirm review state persists.
- [ ] Confirm due cards are correctly identified.
- [ ] Run Card Rush several times and check that rounds are varied and do not immediately repeat the same sequence.
- [ ] Complete a guided quiz and inspect answer explanations.
- [ ] Complete an exam-mode test and inspect score, duration and attempt history.
- [ ] Confirm missed questions can be reviewed.
- [ ] Confirm topic mastery does not jump to an implausible value from one small quiz.
- [ ] Test date boundaries and time zone changes if possible.
- [ ] Export study data and confirm the downloaded JSON opens.
- [ ] Confirm local study productivity still works offline.

## E. Version 1.3 — UI redesign, navigation, motion and performance

**Run these tests only after the redesigned build is deployed.**

### E1. Visual system and page hierarchy
- [ ] Home feels clear and welcoming; one obvious next action is visible.
- [ ] Home does not feel like a wall of statistics.
- [ ] Learn/Library cards, statuses and actions are consistent.
- [ ] PDF reading controls and source citations remain easy to find.
- [ ] Notes are comfortable to read on a phone.
- [ ] Flashcards and tests have clear study states and answer feedback.
- [ ] Planner has a useful agenda and clear empty state.
- [ ] Research Feed is readable without visual clutter.
- [ ] Discover explains why a student/resource is recommended.
- [ ] Profile privacy and visibility controls are understandable.
- [ ] Messages and Notifications remain easy to reach when online.
- [ ] Light and dark themes both have readable contrast.
- [ ] No horizontal scrolling, clipped cards or overlapping controls.
- [ ] Touch targets are comfortable to tap.
- [ ] Keyboard focus is visible and screen-reader labels make sense.

### E2. Navigation
- [ ] Phone shows the agreed limited primary bottom navigation.
- [ ] Secondary destinations are discoverable without overcrowding the bottom bar.
- [ ] Desktop/tablet uses an appropriate sidebar/top navigation at supported widths.
- [ ] Browser back works from a focused page.
- [ ] Direct links and refresh keep the correct page.
- [ ] Returning from a page does not unexpectedly lose useful scroll position.
- [ ] No full-screen remount or visible flicker during ordinary navigation.

### E3. Settings redesign
- [ ] Settings opens to a clean category overview.
- [ ] Side/slider-style navigation is gone.
- [ ] Account expands inline beneath its row and preserves account controls.
- [ ] Academic Profile expands inline and preserves current values.
- [ ] AI & Providers alone opens a dedicated page; connection test and key management remain intact.
- [ ] Appearance expands inline; dark mode, learning trail and Animations are available there.
- [ ] Notifications expands inline; all existing preferences still work.
- [ ] Privacy & Safety expands inline; blocked-user controls still work.
- [ ] Storage & Documents expands inline; export and delete controls remain correct.
- [ ] Offline & App expands inline; update/build information remains visible.
- [ ] Help & About expands inline; shortcuts are readable.
- [ ] Accordion expands/collapses directly under its row with restrained motion.
- [ ] Accordion motion becomes static/instant when Animations is OFF or OS reduced-motion is enabled.
- [ ] Back navigation does not lose unsaved settings.
- [ ] Every visible toggle actually changes and persists.

### E4. Animation preference
- [ ] A new browser profile has Animations ON by default; the control is located in Settings → Appearance.
- [ ] With animations ON, navigation and small UI feedback are subtle and do not delay actions.
- [ ] Turn Animations OFF; the interface returns to the current static UI baseline.
- [ ] Refresh while OFF; preference remains OFF.
- [ ] Close/reopen the installed app while OFF; preference remains OFF.
- [ ] Turn ON; preference persists after restart.
- [ ] Enable OS reduced-motion; interface motion is suppressed even when app setting is ON.
- [ ] Disable OS reduced-motion; app setting takes effect again.
- [ ] Flashcard flipping remains understandable and usable with motion OFF.
- [ ] No infinite decorative loops, parallax, particles or animated backgrounds.
- [ ] No animation causes layout jumps or delays a tap.

### E5. Offline-aware UI
- [ ] Online-only destinations disappear while offline.
- [ ] Direct navigation to an online-only destination while offline returns safely to Home.
- [ ] Local study pages remain available.
- [ ] AI question input is hidden/disabled offline.
- [ ] Online-only features reappear after reconnection.
- [ ] No saved local material disappears during connectivity changes.

### E6. Admin user identity
- [ ] Admin list shows display name and stable user ID together.
- [ ] ID copy action copies the correct ID.
- [ ] Search/pagination works if included.
- [ ] Non-admin account cannot see Admin navigation or access Admin route.
- [ ] Admin UI shows only authorised fields.
- [ ] No admin-only data leaks to ordinary accounts.

### E7. Performance and usability
- [ ] Cold start feels acceptable on iPhone.
- [ ] Cold start feels acceptable on Redmi 10A.
- [ ] Home scrolling is smooth enough on Redmi 10A.
- [ ] Bottom navigation responds immediately.
- [ ] Opening/closing dialogs does not freeze the phone.
- [ ] Keyboard opening does not make the page jump or hide controls.
- [ ] Opening a large supported PDF does not crash/reload the tab.
- [ ] Switching between pages does not progressively slow the app.
- [ ] No unusual memory growth after several page changes.
- [ ] No excessive network requests while idle/offline.
- [ ] Compare perceived speed with the pre-redesign build.
- [ ] Send any Android tester feedback with device model and exact reproduction steps.

## F. Version 1.4 — Data continuity and operations

- [ ] Edit a note on Device A; confirm expected sync to Device B.
- [ ] Edit the same note on both devices before sync; record conflict resolution.
- [ ] Create a flashcard/review on Device A; confirm expected sync to Device B.
- [ ] Create a quiz attempt on Device A; confirm expected sync to Device B.
- [ ] Create planner task/goal on Device A; confirm expected sync to Device B.
- [ ] Work offline, reconnect and confirm queued changes sync once.
- [ ] Switch accounts while pending changes exist; confirm no cross-account upload.
- [ ] Export data and confirm included fields are documented.
- [ ] Import/restore export into a clean test profile if import is supported.
- [ ] Delete account-owned test data and confirm retention/deletion behaviour is explained.
- [ ] Admin usage totals match the test activity within the documented aggregation window.
- [ ] Admin shows display names and IDs correctly.
- [ ] Admin controls do not allow a non-admin to change limits.
- [ ] Confirm no API keys, raw prompts or private PDF text appear in diagnostics.

## G. Version 2.0 — Research Feed and academic community

Use two separate test accounts. Never test privacy with real sensitive material.
- [ ] Account A creates a public research post.
- [ ] Account B can view the public post.
- [ ] Account A creates a department-only post; Account B in another department cannot see it.
- [ ] Account A creates a private post; Account B cannot see it.
- [ ] Edit and delete own post.
- [ ] Confirm another user cannot edit/delete the post.
- [ ] Add each available reaction and change reaction; confirm only one active reaction per user.
- [ ] Add a comment and threaded reply.
- [ ] Edit/delete own comment.
- [ ] Confirm another user cannot edit/delete it.
- [ ] Bookmark and unbookmark a post.
- [ ] Follow and unfollow an author.
- [ ] Test feed tabs and filters.
- [ ] Scroll/paginate through a longer feed; confirm it does not load everything at once.
- [ ] Report a post/comment.
- [ ] Block an account and confirm it no longer contacts/reaches the blocker through supported surfaces.
- [ ] Confirm moderation actions are reflected and auditable.
- [ ] Join a Course Hub and view its discussions/resources.
- [ ] Confirm Course Hub is distinct from the Research Feed.
- [ ] Test Community UI offline; it should not be offered as an online destination.

## H. Version 2.1 — Messaging and notifications

Use two separate test accounts.
- [ ] Account A sends a message request to Account B.
- [ ] Account B accepts the request.
- [ ] Both accounts can exchange messages.
- [ ] Refresh and confirm message history persists.
- [ ] Confirm unread/read state updates.
- [ ] Decline a request; confirm the sender cannot bypass the decision.
- [ ] Block a user; confirm new contact is prevented.
- [ ] Report a conversation/message.
- [ ] Confirm a non-member cannot access a conversation URL or message data.
- [ ] Confirm messages do not appear in public feed or profile.
- [ ] Mute a conversation if available.
- [ ] Test notifications for message, reply, mention and collaboration invite.
- [ ] Confirm category preferences and quiet hours are respected.
- [ ] Confirm repeated reactions are grouped rather than spamming notifications.
- [ ] Test notification deep link to correct conversation/post.
- [ ] Sign out and confirm prior account's message content is cleared from the interface.
- [ ] Confirm online-only messaging is hidden offline.

## I. Version 2.5 — Matching, Research Circles and collaboration

Use test profiles with intentionally different academic attributes.
- [ ] Opt into student discovery.
- [ ] Opt out and confirm profile is no longer recommended.
- [ ] Confirm recommendation explains shared department/interests/skills.
- [ ] Confirm a student can dismiss a recommendation.
- [ ] Confirm same-level/department matching behaves according to published criteria.
- [ ] Confirm no private email/phone is revealed.
- [ ] Create a Research Circle.
- [ ] Set Circle public/private membership.
- [ ] Invite a student; accept and decline from another account.
- [ ] Confirm private Circle content is invisible to non-members.
- [ ] Leave a Circle and confirm access is revoked.
- [ ] Mute/report a Circle or member where supported.
- [ ] Share a resource/deck explicitly; confirm only intended members can access it.
- [ ] Confirm original private PDF is not shared automatically.
- [ ] Create a project workspace and invite collaborators.
- [ ] Assign tasks and milestones to different members.
- [ ] Confirm members can only edit permitted project resources.
- [ ] Remove a member and confirm access is revoked.
- [ ] Export project summary if supported.

## J. Version 3.0 — AI learning and research tools

- [ ] Ask AI Study Coach about a selected document.
- [ ] Verify answer against source page references.
- [ ] Ask a question not answered by the source; confirm uncertainty is stated.
- [ ] Generate targeted practice for a weak topic.
- [ ] Confirm recommendation basis is shown.
- [ ] Dismiss a recommendation and confirm it does not immediately reappear without new evidence.
- [ ] Search research discovery resources and open source links.
- [ ] Confirm research summaries link to real sources.
- [ ] Add papers to a literature workspace.
- [ ] Check extracted title/author/year/DOI against source metadata.
- [ ] Compare papers in a synthesis matrix.
- [ ] Confirm no fabricated author, journal, DOI or citation.
- [ ] Generate a bibliography and verify each entry manually.
- [ ] Export bibliography in selected style.
- [ ] Confirm source permission rules apply to AI retrieval.
- [ ] Confirm AI usage remains within configured limits and errors do not trigger repeated paid requests.
- [ ] Confirm non-AI study tools still work when AI is unavailable.

## K. Version 3.5 — Portfolio and achievements

- [ ] Create an academic portfolio.
- [ ] Set one project public and another private.
- [ ] Confirm public portfolio contains only chosen fields.
- [ ] Confirm private project is invisible to other accounts.
- [ ] Complete an achievement-eligible action and confirm award is accurate.
- [ ] Repeat the same action; confirm duplicate XP is not awarded.
- [ ] Confirm achievement history has an understandable reason/date.
- [ ] Hide gamification and confirm XP/streak/leaderboard surfaces are removed or minimised.
- [ ] Confirm no reward encourages spam, repeated posting or unnecessary app opening.
- [ ] Confirm optional leaderboard participation can be disabled.

## L. Version 4.0 — Multi-university ecosystem

- [ ] Confirm OOU directory data remains correct.
- [ ] Select a second institution in a test profile.
- [ ] Confirm faculty, department, level, session and courses match that institution.
- [ ] Confirm an institution admin cannot edit another institution's records.
- [ ] Join a second-institution Course Hub.
- [ ] Confirm official/verified labels appear only on verified institutional spaces.
- [ ] Opt into cross-university discovery and test matching.
- [ ] Opt out and confirm cross-university profile is no longer discoverable.
- [ ] Confirm no institution's private course/community content leaks to another.

## M. Version 4.5 — Academic opportunities and integrations

- [ ] Open an academic opportunity and inspect source link and last-checked date.
- [ ] Confirm expired opportunity is labelled/removed.
- [ ] Save and unsave an opportunity.
- [ ] Test deadline/time zone display.
- [ ] Report an inaccurate listing.
- [ ] Confirm official/partner labels are evidence-backed.
- [ ] Confirm no opportunity is shown without a traceable source.
- [ ] Confirm third-party data is not shared without consent.

## N. Version 5.0 — Scale, governance and operations

These tests require a release-specific test plan and may require an administrator/operator:
- [ ] Backup completes and restore drill succeeds.
- [ ] Service outage/status communication is accurate.
- [ ] Incident and moderation escalation paths work.
- [ ] Admin role boundaries are correct across institutions.
- [ ] Data retention/deletion policy is understandable and applied.
- [ ] Accessibility review completed on supported devices.
- [ ] Older installed PWA versions migrate/update safely.
- [ ] Rate limits and quotas behave fairly under load.
- [ ] Performance remains within agreed budgets during load testing.
- [ ] Aggregate institution analytics do not expose individual student records.
- [ ] Rollback procedure is tested.

---

## O. Defect report template

Copy this block when reporting a failed test:

**Test ID:**  
**Result:** FAIL / BLOCKED  
**Device / OS / browser:**  
**Installed PWA or browser tab:**  
**Account type:** signed out / student / admin / Account A / Account B  
**Network:** Wi-Fi / mobile data / weak / offline  
**App version / build ID:**  
**Steps to reproduce:**  
1.  
2.  
3.  

**Expected result:**  
**Actual result:**  
**How often:** always / sometimes / once  
**Screenshot or recording:** (attach only after hiding personal data)  
**Anything else:**  

## P. Release sign-off

A release is accepted only after:
- [ ] Automated typecheck/build/validation pass for the exact commit.
- [ ] Security and data-isolation checks pass for changed features.
- [ ] Vercel deployment is READY for the exact commit.
- [ ] Production smoke test passes.
- [ ] Relevant user acceptance tests above are PASS.
- [ ] Remaining BLOCKED/NOT TESTED items are listed honestly and have an owner/next step.
- [ ] No critical or high-severity defect remains open.


## Q. V1.x authentication, Discover and Android update regressions

These checks were added after reports of Android users seeing a missing update button, Settings reporting a missing Auth session, and academic profiles not appearing in student discovery. Do not mark them PASS until tested on the stated device/account.

### Q1. Supabase session restoration
- [ ] Open a fresh Android browser tab and wait for startup; confirm Settings has no transient missing-session error.
- [ ] Close/reopen the installed Android PWA while signed in; open Settings immediately.
- [ ] Navigate Settings, Library, Messages, Groups, Notifications and Community without being incorrectly treated as signed out.
- [ ] Test sign-in, token refresh, expired session and logout; show a clear recovery path when a session is genuinely invalid.
- [ ] Switch between two test accounts; confirm cloud operations always use the currently signed-in account.

### Q2. Academic profile persistence and discovery
- [ ] Create an account with academic details; after email confirmation and sign-in, verify its `student_profiles` row exists.
- [ ] Edit and save; reload and confirm all fields, interests, skills, goals and discovery preferences persist.
- [ ] Sign in again; confirm existing discovery preferences are preserved.
- [ ] Keep the profile private and confirm it is not visible to another account.
- [ ] Opt into public discovery and confirm visibility to a second account.
- [ ] Confirm Account B cannot read or edit Account A's private profile fields.
- [ ] Confirm an opted-in profile is never suggested to itself.
- [ ] With only one student profile, show a helpful “no other students yet” state.

### Q3. Discover public browsing
- [ ] Open Discover signed out; public materials load without an account gate.
- [ ] Confirm public materials remain visible if an optional identity lookup fails.
- [ ] Try saving while signed out; show a clear sign-in action.
- [ ] Sign in, save a material, reload and confirm it remains saved to that account.
- [ ] Confirm private materials and private PDF objects never appear in anonymous browsing.

### Q4. Android PWA update lifecycle
- [ ] Install Study Hub on Android Chrome and record device model, OS and browser version.
- [ ] Keep the app open while a newer production deployment becomes available; confirm the update notice appears.
- [ ] Confirm the Update button appears even if the service-worker event occurred before the app shell mounted.
- [ ] Background and reopen the app; confirm update detection recovers.
- [ ] Tap Update; confirm the waiting worker activates and the app reloads onto the new build.
- [ ] Confirm notes, cards, planner data and cached PDFs remain intact.
- [ ] Repeat on weak network and with a draft/upload in progress; active work must not be silently discarded.

### Q5. Low-memory Android PDF processing
- [ ] On Redmi 10A, record whether the browser exposes a device-memory estimate.
- [ ] Confirm the UI reports the adaptive PDF size/page limit selected for the device.
- [ ] Process a supported PDF near the low-memory limit and confirm progress remains responsive.
- [ ] Confirm a file above the adaptive limit is rejected before a large buffer is allocated.
- [ ] Open and close several PDFs; confirm no progressive slowdown or tab reload.
- [ ] On a device above the low-memory threshold, confirm the normal 50 MB / 400-page limit remains.

**Status when added:** code and production build checks passed; all physical-device and two-account checks above remain NOT TESTED until an actual run is recorded.


## R. Discover material parity with manually uploaded study documents

- [ ] While signed out, open a public contribution and add it to the local Library without being forced to sign in.
- [ ] Confirm the imported item appears in the normal Library document list and opens at `/doc/:id`.
- [ ] Confirm its shared summary appears as Short notes and shared key points appear in the normal notes/key-points view.
- [ ] Confirm its flashcards appear in the normal Study session and support grading/spaced-repetition reviews.
- [ ] Confirm flashcard examples, tags and page citations are retained, and contributor-shared organisations/references appear under the normal key-point view.
- [ ] Confirm its quiz questions appear in the normal Test route, accept answers, show explanations and save a quiz attempt.
- [ ] Confirm Rush remains optional and is not the only available study action.
- [ ] Confirm import works even when the contributor did not share the original PDF; do not expose or attempt to download a private original.
- [ ] Confirm shared page references are retained as references but do not falsely imply the original PDF is stored locally.
- [ ] Reload the app and open the imported document offline; notes, key points, cards and quiz content remain usable.
- [ ] Import the same contribution again; it updates the same local document instead of creating duplicates and preserves existing card-review scheduling for unchanged cards.
- [ ] Remove a saved bookmark from Discover and confirm it does not delete the locally imported document.
- [ ] Delete the imported document from Library and confirm its local notes, key points, cards, reviews and questions are removed.
- [ ] Confirm an imported contribution is clearly labelled as coming from Discover and remains separate from a private PDF upload.
