import type { IdeaRecommendation } from "@/lib/ideas/types"

export function normalizeIdea(idea: any): IdeaRecommendation {
  const conceptType = idea?.concept_type || idea?.impact || "Proven Concept"
  const visualRoutes = Array.isArray(idea?.visual_routes)
    ? idea.visual_routes
        .filter((route: any) => route && typeof route === "object")
        .map((route: any) => ({
          route_name: String(route.route_name || "").trim(),
          route_type: String(route.route_type || "").trim(),
          visual_idea: String(route.visual_idea || "").trim(),
          why_it_fits: String(route.why_it_fits || "").trim(),
        }))
        .filter((route: any) => route.route_name || route.visual_idea)
    : []

  return {
    ...idea,
    concept_type: conceptType,
    impact: conceptType,
    visual_routes: visualRoutes,
  } as IdeaRecommendation
}
