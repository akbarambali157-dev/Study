# Comprehensive Study Engine and Test Builder

**Date:** 15 November 2026  
**Status:** Implementation branch in progress; automated and live acceptance pending.

## Product decision

The default study depth is **Comprehensive**: preserve all meaningful information in the source, including definitions, explanations, assumptions, examples, exceptions, classifications, processes, formulas, comparisons, cases, figures and supporting arguments. Remove repetition and filler, not concepts. Students may choose a shorter or more source-faithful treatment per upload.

## Study-depth presets

- **Quick overview:** central concepts and essential definitions.
- **Balanced notes:** main concepts with useful explanation, examples and qualifications.
- **Comprehensive (default):** all meaningful information, reorganised into readable notes.
- **Near-source:** preserve nearly every meaningful detail, with minimal condensation.

The selected depth is per file, stored with the resulting Note, and displayed in the document reader.

## Document processing architecture

1. Extract and retain every readable PDF page locally.
2. Split pages into bounded, overlapping source sections. Page numbers remain attached to source evidence.
3. Map each section into a faithful overview and a generous set of validated concepts. A section worker must not discard a concept because it seems unlikely to appear in an examination.
4. Persist each validated section result in IndexedDB. Cache keys include document identity, section-content fingerprint, selected model, study depth and prompt version. A retry reuses successful unchanged sections; changed source content, depth, model or prompt version invalidates the relevant cache entry.
5. Synthesize the retained digests in small consecutive batches. Do not collapse the whole document into one short final prompt. Combine all batch notes without a fixed 8,000-character truncation.
6. Save source coverage metadata: original page count, processed section count, concept count and the pages covered. The reader displays this report.
7. Generate flashcards from the full concept set. Import objective questions from the PDF when present; otherwise defer AI question generation until the student requests a test.

## Parallel worker model

The current implementation uses bounded parallel model calls, not independent autonomous agents. Map workers handle independent source sections; synthesis workers handle separate consecutive groups; a final merge retains ordering and page references. Hosted requests use a conservative two-worker cap and BYOK uses a small bounded pool. Schema repair remains a single bounded correction attempt; failed synthesis groups can be split and retried without repeating completed map work.

A separate autonomous subagent is not required for the current bottleneck: it would still need the same schema validation, source coverage checks and merge stage, and could add coordination overhead. The worker pool provides the useful parallelism while preserving deterministic validation.

## Test builder

- Students choose any question count from 1 to 100.
- Students choose progressive, foundational, university examination or advanced difficulty.
- Progressive tests move from recall and definitions through application and analysis to multi-concept challenge.
- Requests are generated in validated batches of at most 20 questions, with concept partitions to spread coverage across the source.
- Duplicate stems are filtered and a bounded refill pass requests missing questions.
- Students with source objective questions can choose AI-generated, source-only or mixed tests.
- AI tests are generated on demand, avoiding the old fixed eight-question generation during every upload.

## Messaging permission model

Starting a new direct conversation is handled by an authenticated database RPC. It checks the recipient's public discoverability, message policy and mutual block state, then creates the conversation and both membership rows atomically. Existing conversations remain accessible even if the recipient later changes their setting for new requests. The RPC is executable only by authenticated users; its SECURITY DEFINER body uses an empty search path and performs all authorization checks itself. A request-policy recipient receives a pending request; an everyone-policy recipient is added as accepted.

## Acceptance gates

- Process a real 191-page PDF at Comprehensive and Near-source depth. Confirm every page is represented in processed coverage, the saved note is not truncated, and important examples/qualifications remain.
- Interrupt a run after some map sections finish, retry it and verify unchanged sections are reused from cache.
- Change depth/model or source content and verify the corresponding cache entries are not reused.
- Delete a document and verify its section cache is deleted.
- Generate 5, 20, 50 and 100 questions. Confirm exact counts, distinct stems, answer validation, source citations and coverage across chapters.
- Confirm the upload does not make an unnecessary fixed eight-question AI call.
- Test all three question-source modes when a PDF contains original questions.
- With two real accounts, verify an everyone-policy discoverable student can be messaged, requests-policy creates a pending request, nobody-policy blocks new requests, and either-direction blocking prevents new conversations.
- Confirm existing conversations can still be opened after a recipient changes their new-message preference.
- Run GitHub CI and validation, then verify the exact commit has a READY production deployment before live-device testing.

## Known limitations until acceptance

- Automated source checks are not proof that every semantic detail from a real 191-page document has been captured; the 191-page acceptance run remains essential.
- The progress bar reports stages, not exact provider token progress.
- Question formats in this implementation remain multiple-choice; written/essay and short-answer grading are a separate future extension.
- The worker pool is bounded concurrency, not a true autonomous subagent framework.
