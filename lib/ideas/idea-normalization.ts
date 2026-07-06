import type { IdeaContentType, IdeaRecommendation } from "@/lib/ideas/types"

type RawRecord = Record<string, unknown>

function isRecord(value: unknown): value is RawRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function getString(record: RawRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string") return value.trim()
  }
  return ""
}

function normalizeConceptType(value: unknown): IdeaRecommendation["concept_type"] {
  return typeof value === "string" && value.trim().toLowerCase() === "proven concept"
    ? "Proven Concept"
    : "New Concept"
}

function normalizeContentType(value: unknown): IdeaContentType | undefined {
  if (typeof value !== "string") return undefined
  const normalized = value.trim().toUpperCase()
  if (normalized === "SHORT VIDEO" || normalized === "SHORT VDO" || normalized === "MOTION" || normalized === "MOTION AD") {
    return "SHORT VDO"
  }
  if (normalized === "STATIC" || normalized === "STATIC AD") return "STATIC AD"
  if (normalized === "UGC" || normalized === "UGC VIDEO") return "UGC VIDEO"
  if (normalized === "ALBUM" || normalized === "ALBUM AD") return "ALBUM AD"
  return undefined
}

export function normalizeIdea(idea: unknown): IdeaRecommendation {
  const source = isRecord(idea) ? idea : {}
  const conceptType = normalizeConceptType(source.concept_type || source.impact)
  const rawVisualRoutes = Array.isArray(source.visual_routes)
    ? source.visual_routes
    : Array.isArray(source.visualRoutes)
      ? source.visualRoutes
      : []
  const visualRoutes = rawVisualRoutes.length
    ? rawVisualRoutes
        .filter(isRecord)
        .map((route) => ({
          route_name: getString(route, "route_name", "routeName", "name"),
          route_type: getString(route, "route_type", "routeType", "type"),
          visual_idea: getString(route, "visual_idea", "visualIdea", "direction"),
          why_it_fits: getString(route, "why_it_fits", "whyItFits", "rationale"),
        }))
        .filter((route) => route.route_name || route.visual_idea)
    : []

  return {
    ...source,
    concept_type: conceptType,
    impact: conceptType,
    content_type: normalizeContentType(source.content_type) || source.content_type,
    visual_routes: visualRoutes,
  } as IdeaRecommendation
}
