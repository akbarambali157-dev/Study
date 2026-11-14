# OOU Study Hub — Product Roadmap & Implementation Specification

**Status:** Product direction established; implementation specification  
**Audience:** Nigeria-first, beginning with OOU  
**Platform direction:** Complete academic ecosystem  
**Community direction:** Research community and course communities as distinct spaces  
**Gamification direction:** Balanced, meaningful and optional  
**Experience direction:** Polished, modern, lively academic community without clutter or distracting engagement tricks  
**Document purpose:** Preserve the agreed product vision, roadmap, technical requirements, acceptance criteria and implementation order. Read this document before planning or implementing major product changes. Update it when decisions or scope change.

> This is the strategic product roadmap. It does not claim that the features below are already implemented. The immediate engineering priority remains stabilising the existing PDF and AI foundation before expanding the product.

---

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
