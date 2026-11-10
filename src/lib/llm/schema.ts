import { z } from 'zod'

/**
 * Every AI response passes through one of these before it touches the
 * database or the screen. If a PDF tries to talk the model into returning
 * something else, the parse fails and we retry — we never store the result of
 * an unvalidated generation.
 */

// ── stage 1: per-chunk map ───────────────────────────────────────────────
export const ChunkMapSchema = z.object({
  summary: z
    .string()
    .max(1500)
    .describe('Three to six sentences covering only exam-relevant content in this chunk.'),
  keyPoints: z
    .array(
      z.object({
        heading: z.string().max(120),
        body: z.string().max(600),
        page: z.number().int().describe('The page number this point came from.'),
      }),
    )
    .min(1)
    .max(10),
})
export type ChunkMap = z.infer<typeof ChunkMapSchema>

// ── stage 2: reduce into notes + key points ──────────────────────────────
export const NotesSchema = z.object({
  title: z.string().max(140),
  summary: z
    .string()
    .max(8000)
    .describe('Short revision notes in light markdown. Paragraphs and bullet lists only.'),
  takeaways: z.array(z.string().max(240)).min(3).max(8),
  keyPoints: z
    .array(
      z.object({
        heading: z.string().max(120),
        body: z.string().max(700),
        example: z
          .string()
          .max(600)
          .describe('A concrete worked example, calculation or local illustration of this point.'),
        page: z.number().int(),
        confidence: z.number().min(0).max(1),
        tags: z.array(z.string().max(40)).max(5),
      }),
    )
    .min(3)
    .max(14),
})
export type NotesResult = z.infer<typeof NotesSchema>

// ── stage 3: organizations (closed set + proposals) ──────────────────────
export const OrgSchema = z.object({
  links: z.array(
    z.object({
      keyPointIndex: z.number().int(),
      slug: z.string().describe('Must be an exact slug from the supplied catalogue.'),
      why: z.string().max(240),
    }),
  ),
  proposed: z
    .array(
      z.object({
        keyPointIndex: z.number().int(),
        name: z.string().max(120),
        kind: z.enum(['authority', 'professional', 'local', 'reading']),
        url: z.string().max(300),
        why: z.string().max(240),
      }),
    )
    .max(6),
})
export type OrgResult = z.infer<typeof OrgSchema>

// ── stage 4: flashcards ─────────────────────────────────────────────────
export const CardsSchema = z.object({
  cards: z
    .array(
      z.object({
        keyPointIndex: z.number().int(),
        front: z
          .string()
          .max(320)
          .describe('A single question or a cloze statement. Never a yes/no question.'),
        back: z.string().max(600).describe('The answer, under 40 words where possible.'),
        example: z.string().max(400),
        page: z.number().int(),
      }),
    )
    .min(4)
    .max(40),
})
export type CardsResult = z.infer<typeof CardsSchema>

// ── stage 5: test questions (generated on demand) ────────────────────────
export const QuizSchema = z.object({
  questions: z
    .array(
      z.object({
        keyPointIndex: z.number().int(),
        stem: z.string().max(400),
        options: z.array(z.string().max(220)).length(4),
        answerIndex: z.number().int().min(0).max(3),
        explanation: z
          .string()
          .max(600)
          .describe('Why the right answer is right, and why the most tempting wrong one is not.'),
        page: z.number().int(),
      }),
    )
    .min(4)
    .max(20),
})
export type QuizResult = z.infer<typeof QuizSchema>

// ── follow-up question about a key point ─────────────────────────────────
export const AskSchema = z.object({
  answer: z.string().max(2500),
  page: z.number().int().describe('The best page to check this answer against.'),
  followUps: z.array(z.string().max(120)).max(3),
})
export type AskResult = z.infer<typeof AskSchema>

// ── learning profile (one batched call, never per query) ─────────────────
export const ProfileSchema = z.object({
  narrative: z.string().max(1200),
  interests: z
    .array(
      z.object({
        topic: z.string().max(80),
        weight: z.number().min(0).max(1),
        evidence: z.array(z.string().max(160)).max(3),
      }),
    )
    .max(6),
  gaps: z.array(z.string().max(200)).max(5),
  suggestedNext: z
    .array(
      z.object({
        title: z.string().max(120),
        reason: z.string().max(240),
      }),
    )
    .max(5),
})
export type ProfileResult = z.infer<typeof ProfileSchema>
