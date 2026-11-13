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
