export interface ParsedObjectiveQuestion {
  number: number
  stem: string
  options: [string, string, string, string]
  answerIndex: number
  answerText: string
  page: number
}

type DraftQuestion = {
  number: number
  stem: string
  options: string[]
  answerIndex: number | null
  answerText: string
  page: number
  active: 'stem' | 'option' | 'answer' | null
}

const QUESTION_START = /^\s*(?:question\s*)?(\d{1,3})[.)]\s*(.+?)\s*$/i
const OPTION_START = /^\s*([A-D])[.)]\s*(.*?)\s*$/i
const ANSWER_START = /^\s*(?:correct\s+)?answer\s*[:\-]\s*([A-D])(?:[.)]\s*(.*))?\s*$/i

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/**
 * Deterministically extracts four-option objective questions from selectable
 * PDF text. It never asks an LLM to rewrite stems or options, so imported
 * questions remain faithful to the source. Questions without four options or
 * an identifiable answer are left out and counted as unparsed by the caller.
 */
export function parseObjectiveQuestions(pages: string[]): ParsedObjectiveQuestion[] {
  const drafts: DraftQuestion[] = []
  let current: DraftQuestion | null = null

  const finish = () => {
    if (!current) return
    const stem = clean(current.stem)
    const options = current.options.map(clean)
    if (
      stem &&
      options.length === 4 &&
      options.every(Boolean) &&
      current.answerIndex !== null &&
      current.answerIndex >= 0 &&
      current.answerIndex < 4
    ) {
      drafts.push({ ...current, stem, options, answerText: clean(current.answerText) })
    }
    current = null
  }

  pages.forEach((pageText, pageIndex) => {
    const lines = pageText.split(/\r?\n/)
    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue

      const questionMatch = line.match(QUESTION_START)
      if (questionMatch) {
        finish()
        current = {
          number: Number(questionMatch[1]),
          stem: questionMatch[2],
          options: [],
          answerIndex: null,
          answerText: '',
          page: pageIndex + 1,
          active: 'stem',
        }
        continue
      }
      if (!current) continue

      const answerMatch = line.match(ANSWER_START)
      if (answerMatch) {
        current.answerIndex = 'ABCD'.indexOf(answerMatch[1].toUpperCase())
        current.answerText = answerMatch[2] ?? ''
        current.active = 'answer'
        continue
      }

      const optionMatch = line.match(OPTION_START)
      if (optionMatch) {
        const optionIndex = 'ABCD'.indexOf(optionMatch[1].toUpperCase())
        if (optionIndex !== current.options.length || optionIndex > 3) continue
        current.options.push(optionMatch[2])
        current.active = 'option'
        continue
      }

      if (current.active === 'stem') {
        current.stem += ' ' + line
      } else if (current.active === 'option' && current.options.length > 0) {
        const last = current.options.length - 1
        current.options[last] += ' ' + line
      } else if (current.active === 'answer' && !current.answerText) {
        current.answerText = line
      }
    }
  })
  finish()

  return drafts.map((draft) => ({
    number: draft.number,
    stem: draft.stem,
    options: draft.options as [string, string, string, string],
    answerIndex: draft.answerIndex as number,
    answerText: draft.answerText || draft.options[draft.answerIndex as number],
    page: draft.page,
  }))
}

/** A conservative threshold avoids misclassifying ordinary lecture notes. */
export function isObjectiveQuestionDocument(questions: ParsedObjectiveQuestion[]): boolean {
  if (questions.length < 4) return false
  const numbers = questions.map((question) => question.number)
  const uniqueNumbers = new Set(numbers)
  return uniqueNumbers.size === questions.length
}
