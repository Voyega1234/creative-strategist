import { normalizeIdea } from "@/lib/ideas/idea-normalization"
import type { IdeaRecommendation } from "@/lib/ideas/types"

const IDEA_STORAGE_TTL_MS = 24 * 60 * 60 * 1000

function getIdeaStorageKey(clientName: string, productFocus: string) {
  return `ideas_${clientName}_${productFocus}`
}

export function saveIdeasToStorage(
  ideas: IdeaRecommendation[],
  clientName: string,
  productFocus: string
) {
  try {
    const key = getIdeaStorageKey(clientName, productFocus)
    const normalized = ideas.map(normalizeIdea)
    localStorage.setItem(
      key,
      JSON.stringify({
        ideas: normalized,
        timestamp: Date.now(),
        clientName,
        productFocus,
      })
    )
  } catch (error) {
    console.error("Error saving ideas to localStorage:", error)
  }
}

export function loadIdeasFromStorage(
  clientName: string,
  productFocus: string
): IdeaRecommendation[] {
  try {
    const key = getIdeaStorageKey(clientName, productFocus)
    const stored = localStorage.getItem(key)
    if (!stored) {
      return []
    }

    const data = JSON.parse(stored)
    const timeDiff = Date.now() - data.timestamp
    if (timeDiff < IDEA_STORAGE_TTL_MS) {
      return (data.ideas || []).map(normalizeIdea)
    }
  } catch (error) {
    console.error("Error loading ideas from localStorage:", error)
  }

  return []
}
