import { db } from '@/lib/db'
import type { Card, Deck, DocumentRec, KeyPoint, Note, Org, QuizQuestion } from '@/lib/types'
import type { NavigateFunction } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { nowIso } from '@/lib/utils'

export interface PublicStudyMaterial {
  id: string
  title: string
  content: Record<string, unknown>
  summary?: string
  discipline?: string
  page_count?: number
  tags?: string[]
}

export function publicMaterialCards(material: PublicStudyMaterial): Card[] {
  const raw = material.content.flashcards
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return []
    const front = typeof (item as { front?: unknown }).front === 'string' ? (item as { front: string }).front.trim() : ''
    const back = typeof (item as { back?: unknown }).back === 'string' ? (item as { back: string }).back.trim() : ''
    if (!front || !back) return []
    const itemData = item as { front: string; back: string; example?: unknown; page?: unknown; tags?: unknown }
    const example = typeof itemData.example === 'string' ? itemData.example.trim() : undefined
    const page = Number.isInteger(itemData.page) && Number(itemData.page) > 0 ? Number(itemData.page) : undefined
    const tags = Array.isArray(itemData.tags) ? itemData.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 10) : []
    return [{
      id: `public-${material.id}-${index}`,
      deckId: `public-${material.id}`,
      documentId: '',
      front,
      back,
      example,
      page,
      tags: ['community', 'public material', ...tags],
    }]
  })
}

export async function launchPublicMaterialRush(
  material: PublicStudyMaterial,
  navigate: NavigateFunction,
): Promise<void> {
  const cards = publicMaterialCards(material)
  if (cards.length < 4) throw new Error('This material needs at least four flashcards before it can be played in Rush.')
  await importPublicMaterial(material)
  const deckId = `community-deck-${material.id}`
  navigate(`/deck/${deckId}/rush`)
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
