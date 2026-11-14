import { db } from '@/lib/db'
import type { Card, Deck } from '@/lib/types'
import type { NavigateFunction } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export interface PublicStudyMaterial {
  id: string
  title: string
  content: Record<string, unknown>
}

export function publicMaterialCards(material: PublicStudyMaterial): Card[] {
  const raw = material.content.flashcards
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return []
    const front = typeof (item as { front?: unknown }).front === 'string' ? (item as { front: string }).front.trim() : ''
    const back = typeof (item as { back?: unknown }).back === 'string' ? (item as { back: string }).back.trim() : ''
    if (!front || !back) return []
    return [{
      id: `public-${material.id}-${index}`,
      deckId: `public-${material.id}`,
      documentId: '',
      front,
      back,
      tags: ['community', 'public material'],
    }]
  })
}

export async function launchPublicMaterialRush(
  material: PublicStudyMaterial,
  navigate: NavigateFunction,
): Promise<void> {
  const cards = publicMaterialCards(material)
  if (cards.length < 4) throw new Error('This material needs at least four flashcards before it can be played in Rush.')
  const deckId = `public-${material.id}`
  const deck: Deck = {
    id: deckId,
    documentId: '',
    title: material.title,
    createdAt: new Date().toISOString(),
  }
  await db.transaction('rw', [db.decks, db.cards], async () => {
    await db.decks.put(deck)
    await db.cards.where('deckId').equals(deckId).delete()
    await db.cards.bulkPut(cards)
  })
  navigate(`/deck/${deckId}/rush?publicMaterial=${encodeURIComponent(material.id)}`)
}


/** Returns a short-lived download URL only for a currently public contribution. */
export async function getPublicMaterialDownloadUrl(materialId: string): Promise<string> {
  if (!supabase) throw new Error('The community library is not connected.')
  const { data, error } = await supabase.functions.invoke('public-material-download', {
    body: { materialId },
  })
  if (error) throw new Error(error.message || 'The original PDF could not be prepared for download.')
  if (!data || typeof data.signedUrl !== 'string') {
    throw new Error('This contributor has not made the original PDF available.')
  }
  return data.signedUrl
}
