export interface Shortcut {
  keys: string[]
  label: string
  where: ShortcutScope
}

export type ShortcutScope =
  | 'Anywhere'
  | 'Library'
  | 'Notes'
  | 'Flashcards'
  | 'Card Rush'
  | 'Test'

/**
 * The single source of truth for the keymap. The `?` sheet, the Settings
 * reference, and the actual handlers all read from here, so they can't drift.
 */
export const SHORTCUTS: Shortcut[] = [
  { keys: ['?'], label: 'Show or hide this shortcut sheet', where: 'Anywhere' },
  { keys: ['Esc'], label: 'Back out of a session or close a panel', where: 'Anywhere' },
  { keys: ['g', 'l'], label: 'Go to library', where: 'Anywhere' },
  { keys: ['g', 't'], label: 'Go to learning trail', where: 'Anywhere' },
  { keys: ['g', 's'], label: 'Go to settings', where: 'Anywhere' },

  { keys: ['/'], label: 'Focus search', where: 'Library' },
  { keys: ['n'], label: 'Upload a new PDF', where: 'Library' },

  { keys: ['j'], label: 'Next key point', where: 'Notes' },
  { keys: ['k'], label: 'Previous key point', where: 'Notes' },
  { keys: ['a'], label: 'Ask more about the focused key point', where: 'Notes' },
  { keys: ['o'], label: 'Open the cited page', where: 'Notes' },

  { keys: ['Space'], label: 'Flip the card', where: 'Flashcards' },
  { keys: ['→'], label: 'Next card', where: 'Flashcards' },
  { keys: ['←'], label: 'Previous card', where: 'Flashcards' },
  { keys: ['1'], label: 'Grade: Again', where: 'Flashcards' },
  { keys: ['2'], label: 'Grade: Hard', where: 'Flashcards' },
  { keys: ['3'], label: 'Grade: Good', where: 'Flashcards' },
  { keys: ['4'], label: 'Grade: Easy', where: 'Flashcards' },

  { keys: ['1', '2', '3', '4'], label: 'Answer with that option', where: 'Card Rush' },
  { keys: ['Space'], label: 'Skip (costs 3 seconds)', where: 'Card Rush' },

  { keys: ['1', '2', '3', '4'], label: 'Choose an answer', where: 'Test' },
  { keys: ['Enter'], label: 'Next question', where: 'Test' },
  { keys: ['r'], label: 'Review your answers', where: 'Test' },
]

export const SCOPE_ORDER: ShortcutScope[] = [
  'Anywhere',
  'Library',
  'Notes',
  'Flashcards',
  'Card Rush',
  'Test',
]

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    target.isContentEditable
  )
}
