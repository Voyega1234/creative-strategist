import type { IdeaRecommendation } from "@/lib/ideas/types"

export type ShareIdeaPayload = Pick<
  IdeaRecommendation,
  | "title"
  | "description"
  | "category"
  | "concept_type"
  | "competitiveGap"
  | "tags"
  | "content_pillar"
  | "product_focus"
  | "concept_idea"
  | "copywriting"
>

type CreateShareLinkParams = {
  ideas: IdeaRecommendation[]
  clientName: string
  productFocus: string
  instructions: string | null
  model: string
}

type ShareIdeasResponse = {
  success: boolean
  shareUrl?: string
  error?: string
}

export function toShareIdeaPayload(idea: IdeaRecommendation): ShareIdeaPayload {
  return {
    title: idea.title,
    description: idea.description,
    category: idea.category,
    concept_type: idea.concept_type,
    competitiveGap: idea.competitiveGap,
    tags: idea.tags,
    content_pillar: idea.content_pillar,
    product_focus: idea.product_focus,
    concept_idea: idea.concept_idea,
    copywriting: idea.copywriting,
  }
}

export async function createShareLink({
  ideas,
  clientName,
  productFocus,
  instructions,
  model,
}: CreateShareLinkParams): Promise<string> {
  const response = await fetch("/api/share-ideas", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ideas: ideas.map(toShareIdeaPayload),
      clientName,
      productFocus,
      instructions,
      model,
    }),
  })

  const data = (await response.json()) as ShareIdeasResponse

  if (!data.success || !data.shareUrl) {
    throw new Error(data.error || "Failed to create share link")
  }

  return data.shareUrl
}
