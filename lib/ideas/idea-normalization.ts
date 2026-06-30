import type { IdeaRecommendation } from "@/lib/ideas/types"

export function normalizeIdea(idea: any): IdeaRecommendation {
  const conceptType = idea?.concept_type || idea?.impact || "New Concept"
  const rawVisualRoutes = Array.isArray(idea?.visual_routes)
    ? idea.visual_routes
    : Array.isArray(idea?.visualRoutes)
      ? idea.visualRoutes
      : []
  const visualRoutes = rawVisualRoutes.length
    ? rawVisualRoutes
        .filter((route: any) => route && typeof route === "object")
        .map((route: any) => ({
          route_name: String(route.route_name || route.routeName || route.name || "").trim(),
          route_type: String(route.route_type || route.routeType || route.type || "").trim(),
          visual_idea: String(route.visual_idea || route.visualIdea || route.direction || "").trim(),
          why_it_fits: String(route.why_it_fits || route.whyItFits || route.rationale || "").trim(),
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
