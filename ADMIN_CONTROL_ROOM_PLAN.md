# Admin Control Room & Update Delivery System

**Status:** Implementation started 15 November 2026  
**Project:** Study Hub (akbarambali157-dev/Study)  
**Backend:** Supabase project ewqogapdsvivpgpwaxfh; Vercel production deployment from main.

## Product rules

1. Supabase Auth is the source of truth for accounts. AI usage is a separate activity ledger and must never be used as the user count.
2. Code deployments remain GitHub → Vercel automatic deployments. The admin release queue manages user-facing release notes and documentation announcements; it does not block or replace Vercel deployment.
3. Every release note has a human-readable title, category, short notification summary, optional full details, version label and optional documentation destination.
4. Updates can be saved as drafts for manual approval or published automatically when saved. Manual drafts are not visible to students. Publishing makes them available to the in-app notification queue.
5. Documentation updates have their own category and filter.
6. Upload visibility is private by default. Students may opt into a default-public preference. This publishes generated study content; the original PDF remains private unless the student separately chooses to share it.
7. Upload progress notifications are persistent while the underlying task is active. They are cleared only when that task completes, fails, is cancelled or is saved offline.

## AI document-generation reliability

- Keep map, reduce, organizations, cards and quiz as explicit stages with stage-specific diagnostics.
- Map-stage oversized page ranges can split recursively, retaining original page citations.
- Reduce-stage schema failures get one bounded correction call when a parsed candidate exists. The correction request receives the invalid candidate and schema issue paths, not the entire original PDF; it is explicitly told to treat candidate text as data, preserve supported facts and shorten invalid fields.
- If the full reduce request still fails schema validation, split the digest list and reduce smaller batches. The results are merged deterministically, deduplicating repeated headings while retaining separate topics and source page evidence.
- Two concurrent reduction workers are allowed for personal-provider mode; hosted/shared-provider mode stays serial to protect the shared quota and avoid overload.
- Never automatically retry ambiguous network/time-out/rate-limit failures: a provider may already have accepted and billed the request.
- All repair and split calls contribute to token usage and cost accounting. Abort signals apply to every recursive request.
- A repair is bounded to one corrective call per failed structured request. No infinite self-correction loops.

## Admin sections

### Overview
- Total registered non-deleted accounts.
- Accounts with sign-in records, academic profiles, published study sets, AI-active accounts, requests and token usage.
- Clear distinction between account counts and AI-usage counts.

### Users
- Read-only directory from auth.users, joined to student_profiles, AI usage and published materials.
- Show display name, email, department/institution/level, account creation, last sign-in, last recorded activity, AI request/token counts and public material count.
- Retain existing per-user AI quota and hosted-AI suspension controls.
- Do not expose password hashes, tokens, provider credentials, raw metadata or private documents.
- Directory access is server-authorized using app_metadata.role = admin; never trust editable user metadata.

### Updates
- Create, edit, publish, return to draft and delete release notes.
- Filter by Feature, Improvement, Fix, Documentation, Security and Announcement.
- Manual mode saves a draft; automatic mode publishes on save.
- A published update appears as an iPhone-style in-app banner. Banners are queued newest-first; dismissing one advances to the next and dismissal survives reload on that browser.
- Optional documentation links must be root-relative app paths or HTTPS links.

## Upload experience

- Add a setting under Privacy & Safety: “Make new study sets public by default”.
- New upload queue entries inherit that setting. Students can still override visibility per file.
- Sharing generated content does not publish the source PDF. The existing explicit “share original” choice remains separate.
- A global floating progress card reports the active file, current stage/detail and approximate stage progress. It remains visible during PDF extraction, cloud persistence and AI generation, including when navigating away from the upload route.
- Progress is task-state based, not a false claim of exact byte-level upload progress. The card must not auto-dismiss while work remains active.

## Supabase security

- app_updates has RLS: the public can read published rows; only server-managed admins can manage all rows and drafts.
- app_update_dismissals is scoped to auth.uid().
- admin_user_directory() is a narrowly scoped SECURITY DEFINER function because the browser must not receive direct access to auth.users. It checks the signed-in JWT's server-managed app metadata role before returning a minimal directory projection. Execute is granted only to authenticated users; the function rejects non-admins itself.
- The Supabase security advisor may flag authenticated execution of this SECURITY DEFINER RPC. This is intentional only because the function performs an explicit admin-role check and returns a restricted projection. Revisit if moving the directory behind a dedicated server endpoint.
- Never grant browser access to service-role keys, password hashes, Vault secrets or raw authentication/session tables.

## Acceptance and release gates

### AI
- Retry the same long PDF that failed in reduce with a fresh generation.
- Confirm one too-long key-point body triggers one repair call and valid content is saved.
- Force a reduce batch schema failure and confirm recursive smaller batches finish without losing page ranges.
- Confirm hosted mode remains serial and BYOK reduction uses at most two workers.
- Confirm token usage includes repair/split calls; abort stops all outstanding work.
- Confirm no automatic retries on network, timeout, provider overload or rate-limit failures.

### Admin users
- A signed-in account with zero AI calls still appears in Users.
- Directory count matches non-deleted auth.users; current database baseline: 2 registered accounts, 2 with sign-in, 2 academic profiles.
- A non-admin cannot call the directory RPC or read drafts.
- Quota controls work for users with and without AI history.

### Updates
- Draft is not shown to students.
- Manual publish shows the named update in the app notification banner.
- Automatic mode publishes immediately on save.
- Documentation filter returns only documentation entries.
- Dismissing one update advances to the next and remains dismissed after reload.
- Admin sees their own published update too.
- PWA deployment/update prompt remains separate from release-note announcements.

### Uploads
- Default-public OFF creates private material.
- Default-public ON publishes generated study content without publishing the original PDF.
- Per-file override works in both directions.
- Progress card stays visible during processing/navigation and clears only on terminal task state.
- Offline save clears the network-processing notification and preserves local content.

### Device and production
- Test iPhone Safari/PWA and Android Chrome, including low-memory Android.
- Test weak network and offline transitions.
- Confirm mobile layout, no horizontal scrolling, accessible dismiss controls and reduced-motion behaviour.
- Confirm the production deployment SHA matches the tested Git commit.
