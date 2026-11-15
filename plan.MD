# OOU Study Hub — Product Roadmap & Implementation Specification

**Status:** Product direction established; Version 1.0 accepted by the product owner; Versions 1.1–1.4 remain under implementation and release acceptance  
**Audience:** Nigeria-first, beginning with OOU  
**Platform direction:** Complete academic ecosystem  
**Community direction:** Research community and course communities as distinct spaces  
**Gamification direction:** Balanced, meaningful and optional  
**Experience direction:** Polished, modern, lively academic community without clutter or distracting engagement tricks  
**Document purpose:** Preserve the agreed product vision, roadmap, technical requirements, acceptance criteria and implementation order. Read this document before planning or implementing major product changes. Update it when decisions or scope change.

> This is the strategic product roadmap. It does not claim that every feature below is implemented. The product owner has accepted Version 1.0; preserve it and use its checklist as a regression/security suite. The immediate engineering priority is to complete the remaining Version 1.1–1.4 scope in the dependency order defined in [V1_IMPLEMENTATION_PLAN.md](V1_IMPLEMENTATION_PLAN.md). Low-end Android performance is a release requirement across every V1.x workstream.

---

## 1A. Version 1.x delivery and performance contract

Follow [V1_IMPLEMENTATION_PLAN.md](V1_IMPLEMENTATION_PLAN.md) for the workstream order, engineering loop, test strategy, Android performance budgets and release gates. Do not reopen accepted V1.0 without a reproducible regression, security issue or data-integrity defect.

## 1. Product identity and vision

Study Hub is a **complete academic ecosystem**: one place where students learn, organise academic work, discover research, meet collaborators, participate in course communities and build a record of academic contributions.

The product is organised around five connected areas:

1. **Learn** — lecture materials, notes, flashcards, quizzes, revision and study planning.
2. **Research** — research discovery, academic posts, questions, progress and project collaboration.
3. **Community** — course discussions, groups, comments and messaging.
4. **Discover** — students, research interests, collaborators, courses and academic resources.
5. **Profile** — academic identity, projects, achievements and personal progress.

The learning system remains the foundation. The community should help students accomplish more together, not distract them from learning.

### Product principles

- Academic usefulness before social activity.
- Mobile-first, fast and accessible.
- Nigeria-first, but architected for multiple institutions.
- Privacy and student safety by design.
- Engagement through relevance, progress and contribution—not addictive mechanics.
- Use AI only where it materially improves the experience.
- Keep ordinary social interactions inexpensive and fast.
- Avoid clutter, excessive animations, artificial urgency and notification spam.

## 2. Main navigation and information architecture

Use five primary destinations:

| Destination | Purpose |
|---|---|
| Home | Personal dashboard and relevant updates |
| Learn | Library, documents, notes, flashcards and tests |
| Community | Research Feed, Course Hubs and groups |
| Discover | Students, research, courses and opportunities |
| Profile | Academic identity, projects and achievements |

Messaging and notifications should be accessible from the top bar, without consuming permanent bottom-navigation space.

On phones, use a fixed bottom navigation bar with a clear active state. On desktop, the same destinations can appear in a sidebar.

### Dashboard content

The dashboard should adapt to the student's activity and show relevant information such as:

- Continue studying.
- Upcoming study goals.
- Discussions from followed courses.
- Research posts relevant to the student's interests.
- Replies to the student's questions.
- Active collaborations.
- Suggested academic resources.

Do not place every feature on the dashboard simultaneously. Prioritise the most useful information.

## 3. Mobile app and PWA requirements

Build Study Hub as an installable **Progressive Web App (PWA)** first. This allows one React application to serve the website, iPhone and Android, rather than immediately maintaining three separate codebases.

The PWA experience is a first-class product requirement, not a later cosmetic enhancement.

### iPhone experience

- Students open Study Hub in Safari.
- They can use Share → Add to Home Screen.
- Where available, enable “Open as Web App”.
- The installed app launches from its own Home Screen icon in standalone mode.
- Provide clear in-app installation instructions.
- Web Push on iPhone/iPad requires a supported iOS/iPadOS version (16.4 or later), Home Screen installation and explicit notification permission. Do not treat an ordinary Safari tab as equivalent to an installed app for this feature.

### Android experience

- Students can install Study Hub from a supported browser.
- It launches from the Home Screen or app drawer.
- Use the same navigation and feature set as iPhone.
- Use standard Push API, Notifications API and service-worker capabilities with feature detection and graceful fallback.

### Mobile presentation requirements

| Requirement | Implementation |
|---|---|
| Installation | Web app manifest, installable icons and service worker |
| App appearance | Standalone display, branded splash experience and icons |
| Orientation | Portrait-first layouts; do not depend on forcibly locking orientation |
| Safe areas | Respect iPhone notch, Dynamic Island and bottom home indicator |
| Navigation | Fixed mobile bottom navigation |
| Touch | Comfortable tap targets, swipe-friendly lists and dialogs |
| Loading | Skeleton screens and safe optimistic interactions |
| Offline | Cached app shell and locally saved study materials |
| Updates | Notify users when a new version is available; do not unexpectedly interrupt work |

The interface must remain usable if the device rotates. Do not rely on forcibly locking phone orientation.

### PWA implementation components

| Component | Requirement |
|---|---|
| `manifest.webmanifest` | Name, short name, theme/background colours, icons, start URL, display and app ID |
| App icons | Proper 192px and 512px icons, plus iOS touch icon |
| Service worker | App-shell caching, offline fallback, push events and notification clicks |
| Install experience | iOS and Android installation instructions |
| Update flow | Detect new version and offer controlled refresh |
| Offline data | Save permitted learning content locally |
| Network handling | Clear offline state and retry controls |

For Vite, `vite-plugin-pwa` is a suitable starting point.

### Caching and privacy rules

- Cache static app assets and the offline fallback.
- Cache explicitly selected learning materials where appropriate.
- Do not cache private messages or sensitive API responses in a shared cache.
- Clear account-specific cached information on logout.
- Avoid aggressive caching of changing application data.
- Ensure local offline queues cannot sync one user's data into another user's account after logout or account switching.

### iPhone installation help screen

1. Open Study Hub in Safari.
2. Open the Share menu.
3. Select Add to Home Screen.
4. Enable Open as Web App if the option appears.
5. Tap Add.

## 4. Push notifications and notification centre

Study Hub should support push notifications for:

- Replies to a student's research post.
- Comments on their post.
- Reactions to their post.
- Direct messages.
- Mentions in a discussion.
- Collaboration invitations.
- Important updates in followed courses or groups.

Tapping a notification should open the relevant post, conversation or group.

### Notification preferences

Recommended initial defaults:

| Notification type | Default |
|---|---|
| Direct messages | On |
| Replies to my posts | On |
| Mentions | On |
| Reactions | On, grouped where possible |
| Collaboration invitations | On |
| Course discussions | Optional |
| Suggested connections | Off or weekly digest |
| Product announcements | Off |

Provide quiet hours, a global pause, per-category controls and an in-app notification centre.

Do not send a separate push for every Like. Group reactions that happen close together into one notification, e.g. “Several students reacted to your research post.”

### Permission flow

Do not ask for notification permission immediately on first launch.

1. Student signs in.
2. Student uses a community or messaging feature.
3. Study Hub explains the value of notifications.
4. Student chooses Enable notifications.
5. If supported and installed as required, request browser permission following that user action.
6. Associate the resulting subscription with the correct account.
7. Allow the student to change preferences or unsubscribe later.

### Notification processing architecture

Use a reliable server-side event/outbox or queue pattern:

1. A student performs an action (reply, reaction, message or invitation).
2. Supabase records the event after validating actor, recipient and permissions.
3. Notification processing applies preferences, grouping, deduplication and quiet hours.
4. Create an in-app notification record.
5. Attempt push delivery to registered devices.
6. Preserve the in-app notification if push delivery fails.

Push failure must not delete the notification or affect the underlying message.

Protect push subscription endpoints and encryption keys. Associate subscriptions with the correct account. On logout, do not leave private conversations visible to another user of the same device.

Remove expired subscriptions and prevent duplicate notification delivery.

## 5. Version roadmap

### Version 1.0 — Reliable Study Hub foundation

**Highest priority.**

- Fix PDF upload, loading, extraction, storage and retrieval.
- Fix the Settings AI connection test.
- Stabilise hosted BrewKeg AI and optional BYOK.
- Complete registration, sign-in, account settings and academic profiles.
- Verify document ownership, data isolation and Supabase security.
- Test notes, flashcards, quizzes, learning trails and offline access.

**Release gate:** Students can reliably sign in, upload supported PDFs, generate learning materials and return to saved work.

### Version 1.1 — Mobile app foundation

- Installable PWA for iPhone and Android.
- Portrait-first mobile interface.
- App icons, splash experience and standalone display.
- Responsive dashboard and bottom navigation.
- Service worker, offline app shell and update handling.
- Push subscription and notification preferences.

**Release gate:** The same core learning experience works well in installed mode on real iPhones and Android devices.

### Version 1.2 — Learning experience

- Improved learning dashboard.
- Study planner and revision calendar.
- Flashcard improvements and spaced repetition.
- Quiz history and topic mastery.
- Personal learning goals.
- Saved resources and recent documents.

**Release gate:** Students can organise their studies and see meaningful academic progress.

### Version 2.0 — Academic community

- Research Feed.
- Academic posts, questions, discoveries and progress updates.
- Likes, Insightful/Helpful/Support reactions and threaded comments.
- Following, bookmarks, sharing and reporting.
- Course Hubs and department communities.
- Feed filtering and search.
- In-app notification centre.

**Release gate:** Students can publish academic contributions, participate in discussions and follow communities safely.

### Version 2.5 — Connections and collaboration

- Academic student discovery.
- Opt-in student matching.
- Research Circles.
- Study groups and group discussions.
- Shared flashcard decks and group quizzes.
- Collaboration invitations.
- Project workspaces and task tracking.
- Direct messaging.

**Release gate:** Students can find collaborators and complete meaningful academic work together.

### Version 3.0 — Intelligent learning and research

- AI Study Coach.
- Personalised revision recommendations.
- Research Discovery Centre.
- Research question development.
- Literature review workspace.
- Citation and source management.
- Topic maps and academic terminology.
- Recommendations based on learning needs and research interests.

**Release gate:** AI improves learning and research without becoming an unnecessary source of token consumption.

### Version 3.5 — Achievement and academic identity

- Academic portfolio.
- Research contribution history.
- Achievement system.
- Research quests and weekly challenges.
- Personal progress milestones.
- Optional course and group leaderboards.

**Release gate:** Achievements recognise real academic contributions rather than time spent in the application.

### Version 4.0 — Nigerian academic ecosystem

- Expand beyond OOU to other Nigerian institutions.
- Institution, faculty, department and course directories.
- Institution-level communities.
- Cross-university research connections.
- Academic events and opportunities.
- Verified institutional spaces where partnerships exist.

**Release gate:** The platform supports multiple universities without mixing academic structures or student data.

## 6. Research Feed specification

The Research Feed is a central feature of the academic community.

### Feed tabs and filters

- For You
- Following
- My Department
- Discover

Use database-backed filters and pagination. Do not load the entire feed at once.

### Supported post types

Students should be able to publish:

- Research ideas and questions.
- Research progress and findings.
- Academic discussions.
- Requests for help.
- Resources and useful references.
- Project and collaboration invitations.
- Study tips and explanations.

### Post fields and capabilities

A post should support:

- Title.
- Body.
- Category.
- Subject tags.
- Optional attachments.
- Visibility settings.
- Author and timestamps.
- Edit/delete controls for the author.
- Report controls.
- Bookmarking and sharing.

### Reactions

Use reactions that communicate academic value:

- Like
- Insightful
- Helpful
- Support

A student should have a constrained reaction record per post (one active reaction per student, changeable to another type). Avoid turning reactions into a popularity competition. Do not rank students by Likes.

### Comments

Support:

- Threaded replies.
- Mentions.
- Editing and deletion by the author.
- Reporting inappropriate content.
- Saving useful responses.
- Notification preferences.

### Feed performance

- Cursor-based pagination.
- Index creation time, author, category and visibility fields.
- Do not fetch every comment and reaction when loading a feed page.
- Fetch counts efficiently.
- Use optimistic reactions with rollback if the server rejects an action.
- Lazy-load images and attachments.
- Cache public and non-sensitive feed data carefully.
- Refresh or invalidate the correct query after interactions.

## 7. Academic profiles and student matching

A student's profile should be an academic identity, not simply a social-media profile.

### Profile fields

| Field | Purpose |
|---|---|
| Display name | Student identity |
| Institution | OOU or another supported university |
| Faculty | Academic faculty |
| Department | Course of study |
| Level | 100–500 level or configured equivalent |
| Academic session | Current academic session |
| Research interests | Areas they want to explore |
| Skills | Research, writing, statistics, presentation, etc. |
| Current projects | Work they choose to share |
| Contributions | Published academic activity |
| Availability | Whether they are open to collaboration |

Not all fields should be public. Students must control profile visibility.

### Matching logic

Matching should use academic relevance, not popularity. Initial suggested weights (to be tested, not treated as permanent rules):

| Matching factor | Suggested weight |
|---|---:|
| Shared research interests | 35% |
| Same department | 25% |
| Same academic level | 15% |
| Complementary skills | 15% |
| Shared project goals | 10% |

Allow students to opt in, dismiss suggestions and hide their profiles from discovery. Never reveal private contact information.

Begin with database/SQL-based matching. Do not call AI for every matching request.

## 8. Research Circles

Research Circles are small, topic-based communities where students can:

- Discuss a research subject.
- Share relevant resources.
- Invite collaborators.
- Set project goals.
- Maintain a shared reading list.
- Publish progress updates.

Each Circle should have an owner, moderators, members, membership rules and a clear purpose.

## 9. Course Hubs and learning communities

Research and course discussions must be separate spaces.

Course Hubs should support:

- Course descriptions and academic information.
- Course discussion boards.
- Student questions and explanations.
- Shared study resources.
- Past-question practice where permitted.
- Study groups.
- Announcements from authorised moderators.

The university structure must be configurable rather than hardcoded to OOU. For the initial Nigerian launch, support:

**University → Faculty → Department → Level → Course → Semester**

This enables expansion to other institutions without redesigning the data model.

## 10. Messaging specification

Messaging should be a proper feature, not just a comment box.

### Direct messaging

- One-to-one conversations.
- Message history.
- Unread message counts.
- Read state.
- Message requests and blocking.
- Report conversation.
- Basic attachment support after secure upload is ready.
- Conversation search.
- Notification controls per conversation.

Group messaging can follow with Research Circles and study groups.

### Security

- Only conversation members can read messages.
- Message writes must validate sender membership server-side and through database policies.
- Blocked users must not bypass restrictions through an existing conversation.
- Message requests and contact controls should protect students from unwanted contact.
- Account logout must protect private messages on shared devices.

## 11. Balanced gamification

Gamification should recognise achievement, not manufacture addiction.

### Features

| Feature | Purpose |
|---|---|
| XP | Award for meaningful learning and contributions |
| Achievements | Recognise milestones |
| Research quests | Encourage useful academic activities |
| Weekly challenges | Optional goals |
| Topic mastery | Track understanding |
| Contribution record | Recognise helpful community activity |
| Leaderboards | Optional, scoped to a course or group |

Examples of meaningful achievements:

- Completed a study deck.
- Helped answer a course question.
- Published a research update.
- Completed a collaborative project milestone.
- Improved understanding of a difficult topic.

Do not award XP for simply opening the app, repeatedly refreshing a feed or sending large numbers of low-quality messages.

No punitive streak resets, manipulative countdowns or endless reward loops. Students should be able to hide gamification elements entirely.

XP must be awarded through trusted server-side logic, not directly trusted from the browser.

## 12. Technical architecture

Retain the existing Vite/React/TypeScript and Supabase foundation. Do not rewrite the application without a concrete technical reason.

### High-level architecture

- **Study Hub PWA:** React, TypeScript, responsive UI, service worker.
- **Learning:** PDFs, notes, decks and tests.
- **Community:** Feed, comments and groups.
- **Connections:** Profiles, matching and messaging.
- **Notifications:** In-app centre and Web Push.
- **Supabase:** Postgres, Auth, Storage, RLS, Realtime and Edge Functions.
- **External services:** BrewKeg AI, Web Push delivery and academic data sources.

### Proposed database entities

These are proposed entities and relationships, not a claim that all tables already exist.

| Table | Responsibility |
|---|---|
| `profiles` | Student identity and profile settings |
| `institutions` | Nigerian universities and other institutions |
| `faculties` | Institution faculties |
| `departments` | Department directory |
| `academic_levels` | Configurable academic levels |
| `courses` | Course catalogue |
| `course_memberships` | Student course participation |
| `posts` | Research and community posts |
| `post_tags` | Post topics and subject tags |
| `post_reactions` | One student's active reaction to a post |
| `comments` | Comments and threaded replies |
| `post_bookmarks` | Saved posts |
| `follows` | Following students or communities |
| `groups` | Course Hubs and Research Circles |
| `group_memberships` | Membership and role |
| `projects` | Collaborative academic projects |
| `project_members` | Project participants |
| `conversations` | Direct-message conversations |
| `conversation_members` | Conversation participants |
| `messages` | Individual messages |
| `notifications` | In-app notification records |
| `push_subscriptions` | Registered devices and push endpoints |
| `notification_preferences` | User notification controls |
| `reports` | Content and account reports |
| `blocks` | User blocking |
| `achievements` | Achievement definitions |
| `user_achievements` | Student achievement records |
| `xp_transactions` | Auditable XP awards |

Use UUID identifiers, timestamps, foreign keys, appropriate unique constraints and indexes.

### Database integrity rules

- A student should have only one active reaction per post.
- A student should not join the same group twice.
- A conversation should only be accessible to its members.
- A comment must belong to a valid post and have a valid parent if it is a reply.
- XP must be awarded by trusted server-side logic.
- Deleting a post must handle comments, reactions and related notifications consistently.
- Notification creation must be idempotent so retries do not produce duplicates.

### Supabase Row Level Security

Every user-owned or community table must have appropriate RLS policies.

| Data | Access rule |
|---|---|
| Public academic profile | Read according to profile visibility |
| Private profile fields | Owner and explicitly authorised functions |
| Research posts | Read according to post visibility |
| Draft posts | Author only |
| Comments | Visible only when parent post is visible |
| Private messages | Conversation members only |
| Push subscriptions | Owner only; server-controlled changes |
| Reports | Restricted to reporter and authorised moderation personnel |
| XP transactions | Read-only to student; writes through trusted backend |

Never expose the Supabase service-role key in frontend code. Keep it server-side.

### Feed and Realtime performance

- Use cursor pagination.
- Index common filters and ordering.
- Avoid N+1 queries for comments and reactions.
- Use efficient counts.
- Use optimistic updates only when safe.
- Lazy-load media.
- Use Realtime selectively for active conversations, notifications and relevant discussions.
- Do not subscribe every client to every database event.

## 13. Nigeria-first launch strategy

Nigeria is the first market, beginning with OOU. Keep the architecture ready for other Nigerian institutions.

### Initial launch requirements

- OOU as the first configured institution.
- Nigerian university profiles.
- Faculty and department selection.
- 100–500 Level support, with configurable alternatives.
- Academic session and semester fields.
- Nigerian academic communities and course structures.
- Mobile performance suitable for variable network conditions.

Add other institutions gradually, based on student demand and the ability to maintain accurate directories.

### Local usability requirements

- Keep the app lightweight.
- Compress images and attachments.
- Avoid unnecessarily large background animations.
- Support slow or interrupted connections.
- Preserve draft posts and messages locally until they can be submitted safely.
- Make the interface readable on smaller screens.
- Use clear date and academic-session formats.
- Do not make core learning dependent on continuous connectivity.

## 14. Moderation, privacy and student safety

Community features must be designed with privacy and safety built in from the beginning.

Required:

- Block and report controls.
- Moderation queue.
- Spam and repeated-message controls.
- Private-by-default contact information.
- Opt-in student discovery.
- No public display of personal phone numbers or home addresses.
- Controls for who can message a student.
- Clear community rules.
- A process for handling harassment and inappropriate content.
- No public exposure of private academic records.

Provide moderator roles and audit trails for moderation actions. Limit moderator access to information needed for their duties.

## 15. Engagement strategy

The central principle is:

**Give students a reason to return because something useful is happening, not because the application is trying to keep them occupied.**

Use six engagement mechanisms:

| Mechanism | Example |
|---|---|
| Personal relevance | Show research and discussions related to department |
| Academic progress | Show what the student has learned and completed |
| Social contribution | Highlight useful responses to their questions |
| Collaboration | Recommend relevant research partners |
| Discovery | Surface interesting academic discussions |
| Recognition | Celebrate meaningful achievements |

### Healthy engagement cycle

1. **Discover:** Find a useful question, resource or collaborator.
2. **Participate:** Learn, contribute, comment or collaborate.
3. **Make progress:** Complete a study goal or project milestone.
4. **Build connections:** Help other students and find collaborators.

### Metrics

Measure the quality of engagement rather than raw screen time.

| Metric | What it tells us |
|---|---|
| Weekly active learners | Whether learning features are useful |
| Successful PDF processing | Whether the core workflow works |
| Questions receiving helpful answers | Whether the community is useful |
| Meaningful comments per post | Whether discussions are developing |
| Accepted collaboration invitations | Whether matching works |
| Completed group projects | Whether collaboration creates outcomes |
| Notification opt-out rate | Whether notifications are becoming annoying |
| Return rate after meaningful activity | Whether students find lasting value |

Do not optimise for time spent, notification opens or raw reaction volume in isolation.

## 16. AI and token-efficiency policy

The social ecosystem must not make every action an AI call.

| Feature | AI needed? | Preferred approach |
|---|---|---|
| Like/reaction | No | Database write |
| Comment | No | Database write |
| Messaging | No | Realtime/database |
| Feed sorting | Usually no | Database ranking |
| Student matching | Initially no | SQL-based matching |
| Research topic suggestions | Yes | Haiku first |
| Research summaries | Yes | Haiku first |
| Complex research assistance | Sometimes | Sonnet when justified |
| Notifications | No | Event processing |
| XP and achievements | No | Server-side rules |

AI can improve discovery and learning later, but ordinary community interactions should be inexpensive and fast.

Continue the project's resource policy:

- Haiku first; Sonnet only when task quality warrants it.
- No routine Opus routing.
- Fable excluded.
- No automatic expensive escalation.
- Avoid repeated processing of unchanged documents.
- Cache and reuse results carefully.
- Track weighted tokens, model, input/output tokens and cache metrics.
- Separate Study Hub usage from the user's other BrewKeg activity.
- Treat the Study Hub budget as a configurable allocation, not the entire account balance.
- Confirm the live provider rate card before making cost assumptions.

## 17. Work packages and implementation order

| Work package | Deliverable | Priority |
|---|---|---|
| WP1 | Fix existing PDF and AI reliability | Critical |
| WP2 | Verify authentication, profiles and security | Critical |
| WP3 | Mobile UI and installable PWA | High |
| WP4 | Research Feed and post interactions | High |
| WP5 | Course Hubs and community moderation | High |
| WP6 | Notification centre and push infrastructure | High |
| WP7 | Academic matching and Research Circles | Medium |
| WP8 | Direct messaging and collaboration | Medium |
| WP9 | Gamification and portfolios | Medium |
| WP10 | AI research tools and expansion | Later |

Direct messaging and push notifications are not complete until account isolation, RLS policies and notification ownership have been tested.

## 18. Testing and release acceptance criteria

Every phase must pass its own testing before it is considered complete.

### Mobile testing

- [ ] iPhone Safari browsing works.
- [ ] iPhone Home Screen installation works.
- [ ] Installed iPhone app opens independently.
- [ ] Android installation works.
- [ ] Installed Android app launches correctly.
- [ ] Portrait layouts work on small screens.
- [ ] Keyboard does not obscure important input fields.
- [ ] Safe areas are respected.
- [ ] Back navigation works consistently.
- [ ] Offline state is understandable.
- [ ] App updates do not unexpectedly destroy user work.

### Community testing

- [ ] Students can create and edit posts.
- [ ] Reactions work without duplicate records.
- [ ] Comments and threaded replies work.
- [ ] Bookmarks and following work.
- [ ] Feed pagination works.
- [ ] Search and filters work.
- [ ] Private posts remain private.
- [ ] Block and report functions work.
- [ ] Unauthorised users cannot access private content.

### Messaging and notification testing

- [ ] Direct messages arrive correctly.
- [ ] Unread counts update.
- [ ] Replies trigger notifications.
- [ ] Reactions can trigger grouped notifications.
- [ ] Push notifications open the correct content.
- [ ] Quiet hours are respected.
- [ ] Disabled categories do not send push notifications.
- [ ] Expired push subscriptions are removed.
- [ ] Duplicate notification delivery is prevented.
- [ ] Logging out protects the previous user's information.

### Production testing

Test on actual devices, not just browser emulators. Include weak network conditions, interrupted uploads, expired sessions, multiple accounts and database permission tests.

## 19. Definition of the finished product

Study Hub should be one coherent ecosystem, not a collection of unrelated mini-apps:

- **Learn:** Study tools and personal progress.
- **Connect:** Communities and collaboration.
- **Discover:** Ideas, resources and research.
- **Achieve:** Projects, contributions and achievements.

The learning system remains the foundation, while the community enables students to accomplish more together.

Make the PWA experience a first-class requirement from the beginning of the mobile redesign. Do not retrofit installation, safe areas, offline handling and notifications after the desktop interface is finished.

## 20. Implementation discipline and project rules

1. Read this document before starting a major feature.
2. Audit the current repository before changing existing architecture.
3. Preserve working features and avoid unnecessary rewrites.
4. Complete each work package to its acceptance criteria before moving on.
5. Do not claim a feature is complete until it has been tested.
6. Do not expose API keys or service-role credentials in frontend code or public files.
7. Use database migrations for schema changes and keep them version-controlled.
8. Test RLS with multiple accounts, including unauthorised access attempts.
9. Keep mobile and desktop experiences consistent in capability.
10. Keep AI usage efficient and avoid AI calls for ordinary database interactions.
11. Update this document when scope, architecture or product decisions change.
12. Keep the existing `PLAN.txt` for its detailed original project notes, but reconcile older conflicting decisions when those areas are next revised. This roadmap's product direction and later AI-efficiency policy are the current strategic decisions.

---

**Priority reminder:** First make the current learning foundation reliable (especially PDF processing, retrieval, AI connection testing, authentication and data isolation). Then build the mobile/PWA foundation. Only after that should the larger community, matching, messaging and engagement systems be rolled out.

---

## 21. Latest product and reliability requirements — 14 November 2026

This section records the latest user-confirmed requirements. It supplements earlier sections and takes precedence where priorities differ. These are requirements to implement and verify, not claims that the features are already fixed.

### 21.1 Critical blocker: PDF upload and processing end to end

PDF support remains broken and is a release blocker. Audit and test the entire workflow, not just the upload control:

1. File selection, PDF validation, size limits and useful errors for corrupt/unsupported files.
2. Authenticated upload to the intended Supabase Storage bucket and path.
3. Storage policies that restrict each student to files they are entitled to access.
4. Correct database metadata and exact object-path association.
5. Text extraction from multi-page PDFs and explicit handling of image-only/scanned PDFs where OCR may be required.
6. Indexing and retrieval, including resolution of the previously reported object-store KeyPath/source-not-indexed issue.
7. Ensure AI features receive the actual extracted/retrieved document content, not empty content or a stale/mismatched object key.
8. Persistent processing status, progress, retry and failure states; prevent duplicate uploads/processing on retries.
9. Verify document open/download and every dependent workflow: notes, summaries, flashcards, quizzes and other learning outputs.
10. Test interrupted networks, expired sessions, large supported files and multiple accounts.

Required states: selecting, validating, uploading, uploaded, extracting, indexing, ready, partially readable, failed and retryable. Explain failures and the next action.

PDF release gate:
- [ ] Upload a text PDF on iPhone Safari, Android and desktop.
- [ ] Verify the stored object and database path refer to the same file.
- [ ] Verify extracted text is non-empty and belongs to that file.
- [ ] Verify indexing and retrieval return content from that file.
- [ ] Generate a learning output and verify it is grounded in the PDF.
- [ ] Test multi-page, large supported, corrupt and scanned/image-only PDFs.
- [ ] Test interrupted upload, expired authentication and retry.
- [ ] Verify account A cannot read account B's private documents.
- [ ] Verify deletion handles object, index and metadata safely.

A successful Storage upload alone is not proof that PDF support works. The complete upload → extraction → indexing → retrieval → learning-output path must pass.

### 21.2 Critical blocker: hosted/public AI and private BYOK must both work

The hosted/public-key path currently returns malformed data, and the private BYOK path also fails. Diagnose and test both modes independently.

Audit the Settings connection test, browser → Supabase Edge Function → BrewKeg/provider path, credential selection, provider URL/endpoint, model identifier, headers, request body, content type, status, provider error body, streaming/non-streaming handling, JSON parsing, structured-output schema, truncation, empty responses, retries and duplicate requests.

Do not assume every provider returns the same response envelope. Add a provider adapter/normalisation layer that converts supported provider responses into one internal response shape before feature code consumes them.

The Settings Test Connection action must not demand a strict JSON object merely to prove connectivity. Use a small plain-text request, verify a successful response contains usable non-empty text, and show the active connection mode/provider/model with safe diagnostics. Keep strict schema validation for features that genuinely need structured output, with explicit validation and graceful error handling.

BYOK security requirements:
- Handle private keys only through a secure server-side/protected secret path. Never expose them in frontend bundles, URLs, logs, analytics or public repository files.
- Confirm that a BYOK request actually uses the user's configured key; do not silently fall back to the hosted key.
- Clearly show which mode is active: hosted service or private key.
- Do not store private keys in ordinary profile fields or unprotected browser storage.
- Never ask the user to paste private keys into chat.
- Ensure one user's credential cannot be used by another user.
- Redact credentials, authorization headers and private document content from logs.

AI acceptance gate:
- [ ] Hosted/public connection test returns valid plain-text success.
- [ ] Private BYOK connection test works independently.
- [ ] Invalid/expired keys show a clear safe error.
- [ ] HTTP 200 with empty, malformed or unusable content is not treated as successful inference.
- [ ] Structured outputs validate and fail gracefully.
- [ ] Safe diagnostics identify selected provider/model without exposing secrets.
- [ ] No cross-account credential use.
- [ ] No runaway retries or duplicate AI calls.
- [ ] Test both paths on the deployed production app.

### 21.3 Refined visual design and coherent design system

The current interface is not yet sufficiently polished. A full visual refinement pass is an explicit workstream.

Goals:
- Clean, modern, distinctive and cohesive academic product identity.
- Strong hierarchy, readable typography and consistent spacing.
- Restrained, intentional use of colour, surfaces, borders, shadows and depth.
- Reusable design tokens and components for buttons, inputs, cards, menus, dialogs, tabs, navigation and feedback.
- Useful loading, empty, error, success, offline and disabled states.
- Responsive layouts designed for real phone widths first, then tablet and desktop.
- Accessible contrast, focus states, keyboard support and reduced-motion support.
- Avoid both bare/minimal screens and overcrowded dashboards.
- Avoid generic admin-dashboard styling, visual clutter and distracting engagement tricks.

Audit the actual rendered experience on a phone after changes. Do not call the redesign complete based only on code review or desktop screenshots.

### 21.4 Home page animations and idle states

Make Home feel alive and welcoming through purposeful, lightweight motion:
- Subtle section entrance and transition effects.
- Skeleton loading states that match the final layout.
- Clear pressed, selected, hover and focus feedback.
- Small confirmations after meaningful actions.
- Restrained animated visual accents only where they improve the experience.
- Thoughtful empty/idle states for new accounts, no documents, no tasks, no messages and no community activity.
- Contextual next-step prompts with dismiss controls where appropriate.
- Clear offline/connection-lost state and retry action.

Respect the user's reduced-motion preference. Avoid continuous distracting motion, layout shifts, large animation bundles and battery/network-heavy effects. Idle states must be useful rather than blank placeholders. Keep performance suitable for lower-powered phones and variable network conditions.

### 21.5 Modular Settings

Replace the long mixed Settings experience with an overview and focused modules:

1. Account & identity — name, email, account details and security actions.
2. Academic profile — institution, faculty, department, level, session, interests and visibility.
3. AI & providers — hosted/public mode, BYOK, active provider/model, test connection and safe diagnostics.
4. Appearance — theme and supported visual/motion preferences.
5. Notifications — categories, quiet hours, push permission and device subscriptions.
6. Privacy & safety — discoverability, messaging permissions, blocks and data controls.
7. Storage & documents — document list, upload status and processing errors.
8. Offline & app — install instructions, offline state, app version and update status.
9. Help & about — troubleshooting, app information and feedback.

Each module needs a clear title and explanation, related controls grouped together, validation and save feedback, loading/error/success states, mobile-friendly navigation and a clear route back. Avoid duplicated settings with conflicting values. Do not show decorative toggles that do not actually work.

### 21.6 Registration and profile prefill

Sign-up must collect the student's name and email, then prefill those values into the academic profile form after authentication.

- Collect display/full name and email during email/password registration.
- Where social sign-in is enabled, use provider-supplied name/email where permitted; handle missing values explicitly.
- Save the name to the correct profile field during account creation or first authenticated profile initialisation.
- Prefill name and email in profile onboarding; do not ask the student to type the same details twice.
- Treat email as an account/authentication attribute. Display it read-only or change it only through a verified account flow, not as an ordinary profile edit.
- Let the student complete academic details afterward: institution, faculty, department, level, session and interests.
- Provide a clear profile-completion step and allow safe continuation when some academic details are unknown.
- Handle existing accounts, missing provider metadata, duplicate accounts, email verification and interrupted onboarding.
- Backfill missing names safely; never overwrite a chosen display name with a blank provider value.
- Validate server-side and ensure users can update only their own profile.

Acceptance: create a new email/password account and, where available, a social-provider account; verify name/email are saved once and prefilled. Sign out/in to verify persistence. Test existing accounts and incomplete provider metadata.

### 21.7 Profile interactions and direct messaging

Students can currently view other profiles but have no obvious way to interact. An eligible profile must offer clear next steps:
- Message / Send message.
- Follow or connect, if that feature is enabled.
- Collaboration invitation when the profile owner opted in.
- Clear unavailable/restricted states when messaging is disabled or a block exists.
- Report and block controls.

Messaging must be a discoverable, usable feature:
- Add a Messages destination reachable from the top bar and another student's profile.
- Provide inbox/conversation list, empty state, unread indicators and conversation view.
- Support one-to-one text messages, history, sending/receiving, loading/error/retry states.
- Use Supabase Realtime or another suitable approach for timely updates, with safe reconnect/polling fallback.
- Add message requests/contact controls so students are not forced to receive messages from everyone.
- Enforce membership, blocking and RLS on the server/database; hiding a button is not access control.
- Exclude private conversations from public profile/feed queries and shared caches.
- Do not add group messaging until one-to-one messaging and safety controls are reliable.

Messaging acceptance gate: test two separate accounts/sessions; start a conversation from a profile; send and receive messages; refresh and verify history; verify unread state; test requests, blocking and unauthorised conversation access.

### 21.8 Reliable updates on installed phones

Students should not remain stuck on an old app version after a new production deployment. PWA update handling is a first-class requirement.

- Display a running app version/build identifier in About or app diagnostics.
- Use version-aware service-worker updates and correct asset-cache invalidation.
- Check for updates at app startup and when returning to foreground where supported.
- Make a newly available version visible.
- Apply updates automatically when safe (app idle, no unsaved draft or critical action), or offer a clear Update available action if immediate replacement could interrupt work.
- Reload into the new version after applying it and verify the build identifier changed.
- Prevent stale app-shell HTML from continuing to reference old hashed assets.
- Preserve offline support while ensuring new deployments replace old cached assets.
- Provide manual refresh/retry and troubleshooting if an update is stuck.
- Never silently discard drafts, uploads or messages in progress.
- Test installed Home Screen PWA behaviour on real iPhones and Android devices; a normal browser refresh is not sufficient evidence.

Acceptance: deploy a new build while the PWA remains installed on a phone; reopen/foreground it; verify update detection and safe application; confirm the displayed build identifier matches the new deployment. Repeat with weak/offline connectivity and unsaved work.

### 21.9 Revised implementation order

The following order makes the current blockers explicit. Do not expand into broad social features while the learning foundation is failing.

| Order | Workstream | Required outcome | Priority |
|---|---|---|---|
| 1 | PDF pipeline | Upload → storage → extraction → indexing → retrieval → learning output works end to end | Blocker |
| 2 | AI/provider reliability | Hosted/public and private BYOK paths work; normalised responses and safe errors | Blocker |
| 3 | Auth/profile onboarding | Name/email collected once and prefilled; existing accounts preserved; security verified | Blocker |
| 4 | UI/design system | Cohesive visual redesign, responsive layouts and reusable components | High |
| 5 | Modular Settings | Dedicated settings modules with working controls | High |
| 6 | Home experience | Purposeful animations, skeletons, empty/idle states and reduced-motion support | High |
| 7 | Messaging/profile actions | Safe direct interaction from another student's profile | High |
| 8 | PWA update reliability | Installed phone app detects and applies new builds safely | High |
| 9 | PWA/offline/push completion | Installability, offline safety and notification flows pass acceptance tests | High |
| 10 | Research Feed and Course Hubs | Community features built on reliable auth, profiles and moderation | High |
| 11 | Matching, Research Circles and collaboration | Opt-in academic discovery and project collaboration | Medium |
| 12 | Later learning intelligence and achievements | Expand after reliability and core experience are stable | Later |

Parallel work is acceptable only where it does not compromise or obscure critical reliability fixes. Complete each workstream end to end and test it before marking it done.

### 21.10 Definition of done and reporting discipline

For each workstream, report separately:
- Files, database schema and functions changed.
- Behaviour implemented.
- Automated checks and results.
- Manual tests, environment/device and account scenarios.
- Remaining unverified items or blockers.
- Exact Git commit pushed to main.
- Whether Vercel detected and deployed that commit.
- Production deployment state and build identifier.

A Vercel deployment marked READY proves the deployment completed; it does not prove PDF processing, AI inference, authentication, messaging or phone update behaviour works. Do not call a feature fixed until its acceptance tests pass against the deployed app.

Never expose API keys or service-role credentials in frontend code, commits, screenshots, logs or analytics. Never ask the user to paste private keys into chat.

**Immediate next action:** audit and reproduce the PDF upload/processing failure and both AI credential-mode failures; identify root causes, fix them and pass their acceptance tests before moving on to the visual redesign and new interaction features.


---

## 22. Implementation progress ledger — 14 November 2026

This ledger records what has actually been changed and checked. It does not convert untested behaviour into a completed release.

### v1.0 — Reliable foundation

**Implemented**
- Added a private Supabase Storage bucket named `study-documents`, restricted to PDF files and a 30 MB object limit.
- Added `study_documents` metadata and `study_document_pages` page-text records.
- Added owner-scoped RLS policies for document metadata, page text and Storage objects.
- Added a generated full-text search vector and GIN index over extracted page text.
- Added signed-in PDF upload and page-indexing integration. The browser still retains its local IndexedDB copy for offline page citations; unauthenticated BYOK-only use remains local-only.
- Changed Settings connection testing to a small plain-text request instead of strict JSON.
- Added response normalisation for common Anthropic and OpenAI-compatible provider envelopes; empty/unsupported successful responses are rejected.
- Added tolerant structured JSON extraction and removed automatic repeat attempts for deterministic schema failures.
- Normalised a trailing `/v1` from a BYOK Anthropic-compatible base URL.
- Fixed profile onboarding to prefer the sign-up `display_name` metadata and prefill the account email read-only.

**Still to validate**
- A real signed-in PDF upload on iPhone and Android, including Storage object, metadata row and page index.
- Cross-account access denial using two real authenticated accounts.
- A deployed hosted/public AI connection test and a separate private BYOK connection test with a valid user-configured credential.
- Actual generation from an uploaded PDF and source-grounding checks.
- OCR remains unsupported; scanned/image-only PDFs should continue to show an explicit limitation rather than fabricated text.
- Full PDF deletion/cleanup UI and cross-device document restoration are not yet complete.

### v1.1 — Mobile/PWA foundation

**Implemented**
- Switched the PWA from immediate auto-update to a user-controlled update prompt.
- Added update checks on app focus/foreground return.
- Added an explicit “Update” action so the user can decide when to reload.
- Removed the manifest's forced portrait orientation.
- Added app version/build identifiers and surfaced them in Settings.

**Still to validate**
- Install the updated PWA on a real iPhone Home Screen and Android device.
- Deploy a later build and verify the installed app detects it, offers the update and changes its build identifier after applying it.
- Verify update behaviour while offline, during an upload and with unsaved work.
- Verify iPhone push support separately; push subscriptions and delivery are not part of this implementation batch.

### Automated and infrastructure validation

- GitHub Actions CI run **92** for commit `aeec2369eabadca4b18631e9e6c1875c5dfcf66b`: dependency install, TypeScript check and production build all passed.
- Vercel production deployment for that commit: **READY**; deployment ID `dpl_3Mqm8ciwxRDwajbcq1oPhqBipdcQ`; aliases assigned, including `study-platform-delta.vercel.app`.
- Supabase Edge Function `ai-proxy`: version **6**, ACTIVE, JWT verification enabled.
- Supabase Storage bucket `study-documents`: verified private, PDF-only, 30 MB limit.
- Supabase metadata/page tables: verified present with RLS enabled.
- Owner-only table and Storage policies: verified present.
- Supabase security advisor currently reports one separate warning: leaked-password protection is disabled. This is an Auth dashboard setting, not a PDF/AI code failure; enable it in Supabase Auth security settings.

**Release status:** v1.0 and v1.1 are in progress, not fully released. CI/build and deployment pass, but real-account provider tests and real-device PWA/PDF tests remain mandatory before either version can be marked complete.


## 23. PDF ingestion and AI diagnostics architecture — 14 November 2026

### Separation of responsibilities
- Local PDF validation and text extraction are independent from cloud persistence.
- Cloud persistence is an optional sync operation for signed-in accounts. A storage outage must not block local study generation or BYOK.
- Cloud sync errors carry a stage, stable machine-readable code, retryability and a diagnostic reference.
- AI provider failures carry an AI error code and diagnostic reference; hosted proxy requests additionally return a request correlation ID.
- Diagnostics must never include API keys, access tokens, complete prompts, extracted PDF text, or personal document contents.

### Diagnostic stages
- PDF: browser/PDF.js validation and extraction; scanned/image-only documents remain an explicit unsupported state.
- Cloud PDF: session lookup, identity verification, private object upload, metadata write, page-index write, finalization.
- AI: session and configuration, hosted proxy transport, provider transport, provider authentication/model/rate limits, response extraction, structured schema validation, generation pipeline stage.

### Permanent architecture rules
- A failure in one subsystem must not silently cascade into another subsystem.
- Every network boundary must validate inputs and outputs and return a typed error contract.
- Retries are permitted only for explicitly retryable failures; never automatically retry deterministic validation/schema errors or repeat paid generation unexpectedly.
- User-facing errors show a concise explanation plus a safe diagnostic reference. Support/debug details must exclude secrets and document content.
- Keep provider adapters behind the shared AI request contract; do not spread provider-specific fetch logic into feature pages.
- Keep local document availability separate from remote synchronization state.

### Validation still required
- Run an authenticated upload on a real device and capture the DOC diagnostic if storage/indexing fails.
- Run hosted AI connection test and one generation; capture AI diagnostic/request ID if either fails.
- Run BYOK connection test and generation separately from hosted mode.
- Test RLS with a second account and verify no cross-account object or page access.
- Confirm cloud sync can fail while local BYOK generation succeeds.


### PDF mobile-browser diagnostic refinement — 14 November 2026
- PDF extraction tracks validation, file-read, PDF-open, page-read, metadata and cleanup stages.
- Unexpected browser/PDF.js exceptions are wrapped in a typed PdfError with the original exception class and safe, truncated message.
- File reading uses Blob.arrayBuffer when available and FileReader as a compatibility fallback.
- Worker cleanup failures cannot overwrite the original extraction failure.
- User-facing diagnostics include stage and original exception class; they do not include file contents.
- The exact TypeError root cause remains unconfirmed until the next real-device diagnostic is observed.


---

## 17. Implementation and release audit — 14 November 2026

This ledger records repository and deployment evidence. A code path is not release-complete until its acceptance tests have passed.

### Version 1.0 — Reliable foundation

**Implemented**
- PDF extraction, private cloud storage and page indexing.
- AI generation pipeline, structured response validation and hosted AI proxy.
- AI usage accounting, request quotas and administrator controls.
- Authentication and account-backed academic profile persistence.
- Learning library, flashcards, tests and learning trail.

**Remaining release gates**
- Validate a real upload through storage, page indexing, generation and reopen on iOS Safari and Android Chrome.
- Verify failed cloud sync leaves local BYOK processing usable.
- Verify account isolation with two independent student accounts.
- Verify cloud document restoration on a second device and deletion from storage plus page index.
- Run hosted AI and BYOK connection/generation tests separately.
- Confirm PDF.js compatibility on supported iOS Safari versions; pdfjs-dist 6 currently checks for Iterator Helpers and rejects browsers that lack them.
- Enable Supabase leaked-password protection in Auth settings.
- Complete a real-device backup/export and account logout test.

### Version 1.1 — Mobile/PWA foundation

**Implemented**
- Vite PWA plugin with generated manifest, app-shell precache and controlled update flow.
- 192px/512px icons and Apple touch icon asset.
- Safe-area-aware mobile navigation.
- Standalone display metadata and installation guidance for iPhone/iPad and Android.
- Account-owned notification preference records and controls for categories, global pause and local-time quiet-hour windows.
- Per-device Web Push subscription registration and removal, with browser permission requested only after the student presses the button.
- App-wide capture of the deferred install prompt so the installation guide still works when opened after initial page load.

**Remaining release gates**
- Install and launch on a physical iPhone and Android device.
- Verify offline shell, offline local study data and reconnect behaviour.
- Verify update prompt while a student has unsaved work.
- Complete end-to-end push delivery. Browser registration and account storage are implemented, but the server-side sender, private VAPID signing key and public VAPID environment variable are not configured. Registration alone does not send notifications.
- Confirm account-specific caches are cleared on logout/account switch.

### Version 1.2 — Learning experience

**Implemented**
- Flashcard review scheduling and local review history.
- Quiz attempt history.
- Card Rush and local XP/streak tracking.
- Public-material saving and Rush progress.
- Local-first study planner with tasks, learning goals and recent test results.
- Topic-level mastery calculated from recorded quiz answers and linked key points.
- Planner tasks and goals included in local JSON export.

**Remaining release gates**
- Add server-backed, tamper-resistant XP ledger before presenting XP as a trusted account-wide record or introducing leaderboards.
- Add mastery trends over time and richer per-topic performance history.
- Add planner-to-document linking and recurring revision scheduling.
- Validate planner, review and quiz flows on phone-sized screens and across browser restarts.
- Add automated unit tests for scheduling, scoring, date handling and progress calculations.

### Known product and security limitations
- Planner and learning progress remain device-local unless explicitly synced; browser storage is not a cross-device backup.
- BYOK keys are stored in the browser by design; they are not a server-side secrets vault.
- Academic profiles default to private; public discovery is not implemented.
- Notification categories, global pause, quiet-hour settings and per-device push subscription registration/removal are implemented. Quiet-hour enforcement and actual push delivery still need the server-side sender and VAPID secrets.
- Supabase security advisor currently reports leaked-password protection disabled.


## 24. Community contributions, source PDFs and Rush variety — 14 November 2026

**Implemented in the repository**
- Community sharing is now opt-in by default. Newly uploaded study sets remain private unless the uploader explicitly chooses to share them.
- The generation pipeline returns its document-grounded topic title. The saved document and community listing use that title rather than exposing the uploaded filename.
- A contributor can choose to include the original PDF as an additional community download.
- Original PDFs remain in the private `study-documents` bucket. A public-material download Edge Function checks that the contribution is currently public and that the contributor explicitly enabled original-file sharing, then issues a 90-second signed URL. It never accepts an arbitrary bucket path from the browser.
- Making a contribution private prevents new download URLs from being issued. Existing signed URLs may remain usable until their short expiry.
- The existing generated notes, flashcards and quiz questions are stored together in the shared contribution. The new community quiz reads those stored questions; it does not call the AI provider or spend another generation request.
- Discover now offers original-PDF download and Take quiz actions when the contribution contains those assets.
- Card Rush now cycles through a shuffled deck before repeating a card, avoids repeating the previous pass's final card at the next pass boundary, and mixes normal and reverse-recall rounds.

**Database and server**
- Added `share_original` and `source_document_id` to `public_materials`; the source link cascades when the owner's cloud document is deleted.
- Applied the `public_material_original_pdf_sharing` migration to Supabase project `ewqogapdsvivpgpwaxfh`.
- Deployed `public-material-download` Edge Function version 1, ACTIVE, with JWT gateway verification disabled because it serves public contributions; the function performs its own public-record and explicit-share checks before signing.

**Still to validate**
- CI TypeScript/build result for the latest commit.
- End-to-end upload with explicit share consent, including one contribution with PDF and one without it.
- Verify a second signed-in account can read notes, take the stored quiz and download the PDF only when the contributor enabled it.
- Verify private-by-default behaviour, unpublish denial, deletion cascade and expired-link behaviour.
- Confirm topic titles are accurate across different subjects and languages; the generated title can still need contributor editing.
- Test Rush with small decks, duplicate card backs and decks with 10+ cards; verify a full pass before repeats and that reverse-recall distractors remain fair.

**Release note:** These changes are committed to `main`, but they are not considered production-verified until the CI result and the above account-level tests pass. The broader visual redesign remains a separate workstream; navigation, Planner, Install and the earlier responsive fixes are implemented, while the cohesive redesign and remaining UI polish are still in progress.


## 25. Core experience design refresh — 14 November 2026

- Added a dedicated Study Hub identity mark at `public/studyhub-icon.svg`; replaced the legacy letter favicon and wired the mark into the persistent app header.
- Added the SVG identity mark to the PWA manifest while retaining the existing PNG fallback assets. Browser tab and in-app brand use the new mark; the legacy iOS touch PNG remains a fallback and should be replaced with a matching PNG asset in a follow-up.
- Refined the sticky top bar brand treatment and applied consistent visual language to Dashboard, Research community, Discover and Library.
- Added page-specific visual wrappers and styling for the Research composer/feed, Discover knowledge-commons hero and material cards, personal Library cards and saved community materials.
- Updated app theme color and document title to match the new identity.
- Latest GitHub Actions build/type-check passed for commit `1dfc604de6585a90264403551708655b41b372af`.
- Vercel production remains on the earlier `79e6904` header-only deployment; the broader design changes are committed to `main` but are not yet live because the recent deployment attempts hit the Vercel build-rate limit.
- Visual browser/device QA remains outstanding. In particular, check small iPhone widths, dark mode, long material titles, and the PWA home-screen icon before calling the redesign complete.


## 26. Branded app icon completion — 14 November 2026

- Replaced `public/apple-touch-icon.png` with a 180×180 PNG rendered from the approved Study Hub SVG brand mark, so iOS home-screen installs use the current branding.
- Added the SVG brand mark as an `any`-purpose icon in the PWA manifest. Existing PNG manifest sizes remain as compatibility fallbacks.
- The browser favicon and app header already use `studyhub-icon.svg`.
- Remaining validation: wait for the production deployment to become available, then verify iOS Add to Home Screen and Android installation on actual devices. Browser-based visual QA is not yet complete.


## 27. iPhone safe-area and status-bar layout — 14 November 2026

- The sticky top bar now reserves `env(safe-area-inset-top)`, preventing its brand and controls from sitting underneath the iPhone status bar / Dynamic Island region when the installed web app uses `viewport-fit=cover`.
- The iOS standalone status-bar style follows the selected light/dark theme for readable status icons/text.
- The existing bottom navigation continues to reserve `safe-area-inset-bottom` for the home indicator.
- This does not hide iOS system status indicators or Notification Center. iOS web apps cannot force the native immersive fullscreen mode; the layout instead respects the system safe areas.
- Physical iPhone verification remains outstanding until the latest Vercel build is deployed.


## 28. Expanded PDF processing — 14 November 2026

- Raised the browser PDF page ceiling from 120 to 400 and established a shared 50 MB maximum in `src/lib/pdfLimits.ts`.
- Raised the private `study-documents` Storage bucket limit to 50 MB while preserving PDF-only uploads. Supabase Free projects are capped at 50 MB globally, so this is the largest plan-independent cap available without assuming a paid tier.
- Replaced the standard one-shot private PDF upload with TUS resumable uploads in 6 MB chunks, using the signed-in user's access token and the private bucket. Upload cancellation is propagated to the upload request.
- Raised database constraints for `study_documents.page_count`, `study_document_pages.page_number`, `public_materials.page_count` to 400 and `study_documents.size_bytes` to 50 MB.
- Updated the public original-PDF download function to allow files up to 50 MB; deployed `public-material-download` version 2, ACTIVE, with the existing public-record and explicit-share checks unchanged.
- Updated the AI pipeline to keep the inexpensive Haiku model for section mapping, fall back to the selected model if Haiku is unavailable or overloaded, and hierarchically compress validated section digests before final synthesis. This keeps long-document prompts bounded while preserving original page references.
- Validation still required: GitHub type-check/build, a real 400-page text PDF, a 50 MB upload over TUS, and an explicitly shared original-PDF download. iOS memory use and browser stability should be checked on an actual device before treating the upper limits as fully production-verified.


---

## 29. Latest implementation and release audit — 14 November 2026

This section supersedes older status notes where they describe BYOK, cloud restore, push delivery, messaging fallback or community collaboration as not yet implemented. Historical entries above are retained as an audit trail.

### Implemented in code and/or Supabase

**Private PDF cloud lifecycle**
- Added an account-scoped cloud document list in Library.
- Added restore of the original private PDF and its extracted page index to another signed-in device. Restore validates owner, status, page count/order, size and the PDF file signature before writing to IndexedDB.
- Added a Dexie index for remote document IDs and retained the owning account ID on restored documents.
- Deletion removes the local document and queues private cloud cleanup durably when offline; the queue is restricted to the original owner and flushes when connectivity returns.
- The restore/delete path is implemented but still requires a real two-device account test.

**Hosted AI and private BYOK**
- Hosted requests continue through the authenticated ai-proxy Edge Function.
- BYOK requests use the separate authenticated byok-proxy Edge Function. The key is stored in Supabase Vault, with the approved provider endpoint stored alongside it. The browser does not receive the saved secret, and the endpoint is restricted to the official Anthropic API or the configured BrewKeg endpoint.
- Legacy browser key storage is cleared by the API-key module. Settings now describes the account-vault behaviour and does not offer arbitrary provider URLs.
- BYOK credentials are selected by the authenticated user ID; the BYOK path does not silently fall back to the hosted key.
- AI requests are not automatically repeated after ambiguous paid-request failures.
- The hosted and BYOK connection tests are implemented, but a real successful request with a signed-in account and valid user-owned credential is still required.

**Research Feed, messaging and academic spaces**
- Research posts support public/private visibility, bookmarks, author follows, threaded replies and department-based filtering. Private post/comment access is protected by RLS.
- Course Hubs and Research Circles have separate group types, public/private visibility, owner membership, join/leave, discussions and private invitations. Invite acceptance creates membership server-side and respects discoverability/block settings.
- Messages are reachable from the app navigation and student discovery. The inbox refreshes lightly while idle; an open conversation uses scoped Realtime updates with polling fallback when the channel fails.
- These are the base collaboration workflows. Shared resource libraries, shared reading lists, project goals/task boards, group flashcard decks/quizzes and group messaging are not yet implemented.

**Web Push**
- Stored a VAPID keypair and an internal dispatch token in Supabase Vault; the private signing key is not in GitHub or the frontend.
- Added a database notification trigger using pg_net, a server-side push-dispatch Edge Function, a signed-in push-test Edge Function and a service-worker push/click handler.
- Push delivery respects account notification categories, global pause and quiet hours using the saved device timezone. Delivery records prevent duplicate sends; expired endpoints are removed.
- The public VAPID key endpoint was tested and returned HTTP 200. The internal dispatch authentication path was exercised with a deliberately nonexistent notification ID and correctly returned not-found after authentication.
- There are currently zero registered push devices, so actual browser delivery, notification clicks and quiet-hour behaviour have not been end-to-end tested.

**Settings, privacy and documentation**
- Settings has module navigation for account, academic profile, AI, appearance, notifications, privacy, storage, offline/app and help.
- Sign-out removes the current device's push subscription first; if push is enabled, sign-out is blocked while offline so the server-side subscription is not left attached to a shared device.
- README privacy notes now distinguish local-first PDF storage from explicitly requested private cloud sync and document Vault-backed BYOK and opt-in Web Push.

### Automated and backend verification

- GitHub Actions CI and Validate Study Hub both passed for commit 30ab04c64219d77f6aa126ccd38ef84cb03c1230 (TypeScript checks and production build).
- Supabase Edge Functions verified ACTIVE: ai-proxy v11, byok-proxy v4, push-dispatch v5 and push-test v1.
- Supabase migrations for group spaces, Vault-backed BYOK, Web Push delivery, timezone storage and push delivery indexing are applied.
- Supabase performance advisor no longer reports an unindexed foreign key. Its unused-index notices are informational on this low-traffic/new schema.
- Supabase security advisor still reports leaked-password protection disabled. push_delivery_log intentionally has RLS enabled with no client policies; only the service role is granted access.

### Production status and remaining release gates

- The latest application-code commit verified by CI is 30ab04c64219d77f6aa126ccd38ef84cb03c1230. The documentation-only plan ledger update was commit 75fff3d0ffc65327dd6690cd5d31c560a38bb3e8; CI and Validate Study Hub also passed for that commit.
- Vercel has not deployed the current main line. Its GitHub status is failing with build-rate-limit. The latest known READY production deployment is commit 4ebe96edc23c5ed4f3ef74228b6a045d69abaf34; do not treat the newer repository changes as live until Vercel reports READY for the matching commit.
- The 48 unchecked items in the mobile, community, messaging, PDF and AI acceptance checklists above remain open. They require real iPhone/Android devices, signed-in test accounts, a real text/scanned PDF test set, a valid BYOK credential entered through Settings and at least one registered push device. They have deliberately not been marked complete based only on code review or CI.
- Enable Supabase Auth leaked-password protection in the project's Auth security settings.
- The broader roadmap is not fully implemented yet: server-backed XP/achievement ledger, mastery trends, recurring revision, literature-review workspace, shared resources/reading lists/project goals, group study resources and quizzes, attachment/search/per-conversation messaging controls, and broader institutional integrations remain future work.
- Do not expand these later workstreams or declare the product release-complete until the current PDF, AI, account-isolation and real-device acceptance gates pass.

### 29.1 Follow-up hardening and verification — 14 November 2026

This follow-up records corrections made after the audit above. It does not close the real-device or production release gates.

**Account isolation and offline cloud lifecycle**
- Pending private-PDF sync now refuses to upload a document whose recorded remoteOwnerId differs from the signed-in account. A legacy remote document with an ID but no recorded owner is blocked rather than silently assigned to the current account.
- Cloud deletion resolves legacy ownership through the signed-in user's RLS-visible metadata instead of assuming the current account owns the remote object.
- Remote object deletion validates that the Storage path begins with the exact owner ID and remote document ID before calling Storage. The durable deletion queue remains scoped to the original owner.
- Library explains when a cloud sync is blocked because it belongs to another or an older account. The local study copy is preserved.
- Settings now reads the current device's push endpoint, checks connectivity before sign-out when a subscription exists, deletes the server-side subscription row first, then unsubscribes the browser token. This also fixes the earlier TypeScript error caused by referring to a child component's state from the parent Settings page.

**Provider credential hardening**
- Client and server accept only the supported Anthropic sk-ant- and BrewKeg bk_live_ key prefixes. Other key formats are rejected before choosing or contacting a provider.
- The Vault database function independently enforces the same prefix-to-endpoint pairing, so the Edge Function is not the only validation boundary.
- A synthetic BrewKeg-format credential was stored, read back and deleted in a Vault round-trip test. An unsupported prefix was rejected. No test credential remains in the Vault.
- Active BYOK Edge Function: version 5, JWT verification enabled. No real user BYOK credential is currently configured, so a live provider inference test remains outstanding.

**Web Push hardening**
- Added an atomic per-notification/per-device delivery claim. A transactional database test verified: first claim succeeds, duplicate claim is rejected, a failed delivery can be reclaimed, and a sent delivery cannot be claimed again. The test transaction was rolled back and created no notification or subscription.
- Added push_test to the notification-type constraint. Without this, the self-test Edge Function's insert would have been rejected by the database. Explicit self-tests bypass quiet hours and normal category/global pause filters, because the student has deliberately requested a test.
- Active push Edge Functions: push-dispatch version 5 (JWT verification off; internal dispatch token checked by the function) and push-test version 1 (JWT verification on).
- The public VAPID key endpoint returned HTTP 200. Supabase has the VAPID keypair and dispatch token in Vault, and the pg_net notification trigger is present.
- There are still zero registered push devices and zero delivery records. Actual browser delivery, notification click-through and quiet-hour behaviour remain unverified until a student registers a real device and sends the Settings test notification.

**Older mobile PDF compatibility**
- PDF.js compatibility helpers now install on both the main thread and the PDF worker before PDF.js is evaluated. This includes the missing Map/Iterator helper APIs used by PDF.js 6 on older WebKit versions.
- This is a compatibility mitigation, not proof of iPhone success. Physical iOS Safari testing with a text PDF remains required.

**Current verification snapshot**
- GitHub Actions CI and Validate Study Hub both passed for repository commit 75fff3d0ffc65327dd6690cd5d31c560a38bb3e8 (TypeScript check and production build).
- Supabase Edge Functions are ACTIVE: ai-proxy v11, byok-proxy v5, push-dispatch v5, push-test v1 and public-material-download v2.
- Supabase security advisor currently reports leaked-password protection disabled. Enable it in the Supabase Auth security settings.
- The latest READY Vercel production deployment is still commit 4ebe96edc23c5ed4f3ef74228b6a045d69abaf34. Vercel reports build-rate-limit for the newer repository commit; none of the newer frontend changes should be described as live.
- No valid provider key or push subscription is currently stored for an end-to-end user test. No physical iPhone or Android device has been tested in this run.

**Release decision:** These code and database hardening changes are implemented and automated checks pass. v1.0/v1.1 remain in progress until the real-account PDF/AI tests, cross-account tests, real-device PWA/offline tests and actual push delivery tests pass. The broader roadmap items listed in section 29 remain future work; they are not silently marked complete.

---

## 29. Implementation and verification update — 14 November 2026

This section records the implementation pass made after the original roadmap. It does **not** mark device-level release acceptance as complete where a real device, second account, or live provider credential is required.

### Implemented in the repository

- [x] Reduced Library memory spikes: document summaries are now collected through an IndexedDB cursor, so extracted PDF page arrays are not retained together in the Library overview.
- [x] Reduced planner reads to questions, key points and documents referenced by recent attempts.
- [x] Kept Library rendering incremental (20 items at a time).
- [x] Added PDF.js 6 compatibility helpers for Map upsert and Iterator Helpers on both the main thread and dedicated PDF worker. The PDF worker is bundled separately.
- [x] Added a durable local queue for remote PDF deletion. Local document deletion is atomic with queue insertion; cloud object, page-index and metadata cleanup retries only for the original owner account.
- [x] Kept offline document creation local-first and retained explicit user control over uploading private PDFs when connectivity returns.
- [x] Moved personal provider credentials out of browser storage into Supabase Vault. Legacy browser-stored key entries are purged at app startup. The authenticated BYOK Edge Function stores and retrieves a user's own credential server-side and restricts supported endpoints to Anthropic or BrewKeg.
- [x] Routed both hosted and BYOK generation through authenticated server-side proxies. Paid generation requests are no longer automatically retried after ambiguous failures.
- [x] Added direct student conversations, pending message requests, block/report controls, read state and notification creation.
- [x] Added research-post bookmarks, author follows, private-post visibility and threaded replies.
- [x] Added Course Hubs and Research Circles with public joining, private invitations, membership controls and group discussions.
- [x] Added server-side Web Push dispatch through pg_net, with VAPID signing material and dispatch token held in Vault. The browser receives only the public VAPID key. Push self-tests, notification preferences, quiet hours, category mapping, duplicate-delivery claims and stale-subscription cleanup are wired.
- [x] Added account details and sign-out handling; private in-memory inbox and notification state is cleared on sign-out.
- [x] Added/updated SQL migration files to match the applied database changes.

### Supabase Edge Functions

| Function | Active version | Purpose |
|---|---:|---|
| ai-proxy | 11 | Hosted AI requests |
| public-material-download | 2 | Validated private/public material downloads |
| byok-proxy | 5 | Vault-backed personal provider keys |
| push-dispatch | 5 | Server-side Web Push delivery |
| push-test | 1 | User-initiated push self-test |

### Verification completed

- [x] GitHub CI type-check and production build passed on commit `30ab04c64219d77f6aa126ccd38ef84cb03c1230`.
- [x] Independent Study Hub validation workflow passed on the same commit.
- [x] Supabase Vault create/read/delete round-trip was tested using a temporary non-provider test value and the temporary secret was deleted.
- [x] Supabase security advisor no longer reports client-readable BYOK credentials. The push-delivery log is explicitly denied to browser roles.

### Release gates still requiring real-world acceptance

These are intentionally **not** marked complete:

- [ ] Upload, retrieve, re-open and delete representative PDFs end-to-end using a real signed-in account, including a large file and an interrupted connection.
- [ ] Run hosted-AI and Vault-backed BYOK connection tests with valid provider credentials. Never paste provider keys into chat or commit them to Git.
- [ ] Test two separate student accounts for message requests, blocking, reporting, private posts, group invitations and private-group isolation.
- [ ] Register at least one real Android/iOS browser subscription and verify the complete notification → pg_net → Edge Function → device delivery path, including quiet hours and unsubscribe.
- [ ] Test install, update, airplane-mode launch, cached PDF reading and queued deletion on physical low-memory Android devices and supported iOS Safari versions.
- [ ] Complete cross-device synchronisation for notes, flashcards, review history, quiz attempts and planner data. Current offline support remains local-first; the private PDF/page-index upload path is not a substitute for full study-data sync.
- [ ] Complete a real-device performance profile (cold start, scrolling, memory, PDF processing and mobile-data-on behaviour).

### Remaining roadmap work

The later roadmap items are not represented as finished by this pass: server-authoritative XP/achievements, richer study intelligence and recommendations, course/group chat, and full cross-device study-data synchronisation still require their own designs, migrations, implementation and acceptance tests.

### Deployment status at this update

The latest code is committed to `main`. Vercel's Git integration is still returning `build-rate-limit` for newer commits; the latest production deployment is older than the current branch. Do not treat these changes as live until a production deployment for the current commit reaches **READY** and the production alias is verified.

### 29.2 Web Push device safeguards — 14 November 2026

- The signed-in push self-test now has a 30-second per-account cooldown to prevent accidental repeated test notifications. Supabase push-test Edge Function version 2 is ACTIVE.
- iOS/iPadOS browser detection now requires the app to be installed to the Home Screen before enabling Web Push. Unsupported in-tab Safari sessions receive a specific install instruction rather than a generic browser-support error.
- Standalone-mode detection is guarded for older browsers that do not expose matchMedia.
- GitHub Actions CI and Validate Study Hub both passed for commit 2db9e8513532d430c4372b3ed06dac2ddc6ac74f.
- Vercel still reports build-rate-limit for this newer commit. Latest READY production remains 4ebe96edc23c5ed4f3ef74228b6a045d69abaf34. The new client-side iOS guard and other recent frontend changes are not live until a matching READY deployment exists.
- Real push delivery still awaits a registered iOS Home Screen or Android device. The server-side VAPID endpoint and database claim rules are verified, but this is not an end-to-end device test.

---

## 30. Latest user testing feedback and next UI pass — 14 November 2026

This section records the latest hands-on feedback from the product owner. It updates the practical acceptance picture; it does not claim that the requested UI changes have already been implemented.

### Confirmed by current user testing

- [x] Offline study-data synchronisation is working well in the user's current tests.
- [x] PDF upload and processing are working well for the user's tested files. Current practical limit reported by the user: approximately 50 MB.
- [x] AI question/answer functionality is working in the user's current tests.
- [x] Questions can still be asked from Notes while offline in the current implementation/tested experience. This is not the desired final offline behaviour; see the UX requirement below.
- [x] iPhone testing is underway.
- [x] An Android device has been tested. The user's Redmi 10A is considered a useful low-end benchmark, but the user reports that the Android experience tested so far is poor. Feedback from another Android tester is still pending.

These are user-reported acceptance results, not independent laboratory or automated test results. Keep the 50 MB practical limit visible in product copy and validation; do not imply support above it without separate testing.

### Next UI and experience work

**Settings navigation redesign**
- [ ] Remove the current settings side/slider navigation pattern.
- [ ] Make long settings categories open as their own focused page or slide-in screen, with a clear back path to the settings overview.
- [ ] Keep compact settings categories that contain only one toggle as simple inline controls.
- [ ] Preserve existing settings behaviour and permissions while changing presentation; do not imply a nonfunctional setting works merely because its UI is redesigned.

**Admin user identification**
- [ ] In the admin user list, display each user's display name and stable user ID together.
- [ ] Keep the ID copyable and visually secondary to the user's name.
- [ ] Do not expose private account data beyond what the admin role is authorised to see.

**Offline-aware navigation and controls**
- [ ] When offline, hide online-only destinations and entry points, including Community and other network-dependent social features, rather than leaving dead-end options visible.
- [ ] Keep local-first study tools available offline.
- [ ] Disable or hide AI/network question input while offline and show a concise offline explanation; do not allow a question to appear to submit when no request can reach the server.
- [ ] Restore online-only destinations and controls when connectivity returns, without losing local work.
- [ ] Use actual connectivity/request state rather than assuming that navigator.onLine alone proves the service is reachable.

**Overall UI polish**
- [ ] Continue a cohesive visual-design pass across the app: clearer hierarchy, stronger spacing and typography, consistent cards and controls, refined empty/loading/error states, and more deliberate mobile layouts.
- [ ] Prioritise practical readability and responsiveness over decorative animation.
- [ ] Check both installed iPhone and Android layouts, including the Redmi 10A viewport.

### Android acceptance still open

- [ ] Await the additional Android tester's report.
- [ ] Re-test the reported poor Android experience on the Redmi 10A and capture the specific slow or broken screens.
- [ ] Check cold launch, navigation transitions, feed/community visibility, Settings navigation, PDF opening, offline mode and memory/scroll performance.
- [ ] Do not mark Android acceptance complete based only on the fact that the app opens on one Android device.

### Revised immediate priority

1. Implement the Settings navigation redesign and admin name + user ID display.
2. Implement a consistent offline-aware experience that hides online-only community/social features and prevents offline AI submission.
3. Complete the UI polish pass, using the iPhone and Redmi 10A as primary responsive test devices.
4. Incorporate the pending Android tester's feedback and re-test.
5. Keep the broader future roadmap separate from this usability/release pass.

---

## 31. UI redesign plan

- [x] Created the implementation-ready, performance-first UI specification in [`UI_DESIGN_PLAN.md`](UI_DESIGN_PLAN.md).
- [ ] Implement the redesign in phases; this documentation commit does not itself change the application UI.
- [ ] Animations preference: ON by default; OFF preserves the current static interface. Respect operating-system reduced-motion settings.
- [ ] Use iPhone and Redmi 10A as key responsive/performance test devices and incorporate the pending Android tester's feedback.


---

## 32. Master version map — 14 November 2026

The complete end-to-end release sequence, including all approved product areas, current implementation status, future scope, dependencies and release gates, is now maintained in [VERSION_MAP.md](VERSION_MAP.md).

Use the documents together:
- VERSION_MAP.md is the master version-by-version delivery map and cross-project inventory.
- plan.MD remains the detailed product, architecture, security and feature specification, plus the implementation history.
- UI_DESIGN_PLAN.md remains the detailed specification for Version 1.3's visual redesign, motion preference and performance work.

When the documents appear to conflict, use the latest dated user-confirmed status and record a dated correction. Do not treat planned features or code presence as release acceptance. Keep the version map updated as each workstream is implemented and tested.


---

## 33. Full implementation execution and user acceptance

The product owner has authorised implementation of the complete master roadmap in [VERSION_MAP.md](VERSION_MAP.md), not only the immediate UI work. Execute it in dependency order, preserving the existing React/Supabase/Dexie architecture and working PDF/AI/offline flows. Do not mark a version complete without its release gate.

The first Version 1.3 implementation slice (15 November 2026) adds a persistent animation preference defaulting ON, respects OS reduced-motion, adds a static CSS motion baseline, hides online-only navigation when the browser reports offline, redirects offline visits to online-only routes to local Home, and hides the AI question input while offline. This is a partial implementation only; the detailed Settings redesign, shared connectivity/reachability state, admin display names, responsive visual redesign, performance measurements and physical-device acceptance remain outstanding.

The complete manual test inventory is in [USER_ACCEPTANCE_TESTS.md](USER_ACCEPTANCE_TESTS.md). Update it with test results, device/build details and defects as implementation proceeds. Never ask the product owner to test a feature before its matching deployment is READY. Never request secrets or private content in test reports.


## 34. Version 1.3 implementation progress — 15 November 2026

The initial UI implementation has started. Committed code includes the local Animations preference (default ON), OS reduced-motion override, static CSS baseline, focused Settings category screens with URL-backed navigation/back behaviour, online-only navigation filtering while the browser reports offline, offline route fallback, a useful three-item mobile navigation while offline, offline AI question-entry guard, and removal of a persistent compositor hint. The complete design plan is not finished: shared reachability state, full primary navigation redesign, admin display names, page-by-page visual polish, measured performance comparisons, and iPhone/Android acceptance remain open.

The full user testing matrix is [USER_ACCEPTANCE_TESTS.md](USER_ACCEPTANCE_TESTS.md). Wait for the matching production deployment before testing the new controls. The GitHub CI and validation workflows are running for the latest UI/performance commits; report their final result against the exact SHA before claiming those commits are validated.


## 1B. Admin operations and update delivery

The admin console must use Supabase Auth as the account source of truth. AI usage is an independent analytics ledger, never a proxy for total users. Admin can inspect registered accounts, academic profiles, sign-in/activity, AI usage and public study materials.

User-facing release notes are managed separately from GitHub/Vercel deployment. Vercel continues to deploy code from main automatically. Admin release entries have a title, category (including Documentation), summary, details, optional docs link, version label and either manual approval or automatic publication. Published entries appear in a sequential in-app notification banner; the existing PWA update prompt remains separate.

New uploads remain private by default. A Settings preference can make generated study sets public by default, while original PDFs stay private unless separately shared. Upload processing must display a persistent global progress notification that remains until a terminal task state.

See [ADMIN_CONTROL_ROOM_PLAN.md](ADMIN_CONTROL_ROOM_PLAN.md) and [USER_ACCEPTANCE_TESTS.md](USER_ACCEPTANCE_TESTS.md) Section S. Do not claim acceptance until the admin/non-admin and mobile device checks pass.
