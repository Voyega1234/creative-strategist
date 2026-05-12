import type { IdeaRecommendation } from "@/lib/ideas/types"

export const VISUAL_ROUTES_BY_IDEA_STORAGE_KEY = "cvc_visual_routes_by_idea"

export function getIdeaSelectionKey(idea: Pick<IdeaRecommendation, "title" | "concept_idea">) {
  return (idea.title || idea.concept_idea || "").trim()
}
