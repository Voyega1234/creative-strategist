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

function getRecord(record: RawRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (isRecord(value)) return value
  }
  return null
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
  if (normalized === "UGC" || normalized === "UGC VIDEO" || normalized === "VIDEO AD") return "UGC VIDEO"
  if (normalized === "ALBUM" || normalized === "ALBUM AD") return "ALBUM AD"
  return undefined
}

export function normalizeIdea(idea: unknown): IdeaRecommendation {
  const source = isRecord(idea) ? idea : {}
  const copywriting = isRecord(source.copywriting) ? source.copywriting : {}
  const creativeDirection = getRecord(source, "creative_direction", "creativeDirection")
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
    title: getString(source, "title") || getString(copywriting, "headline") || getString(source, "concept_idea", "conceptIdea"),
    description: source.description || source.format_execution || source.formatExecution || "",
    category: getString(source, "category", "strategic_angle", "strategicAngle") || "New Concept",
    concept_type: conceptType,
    impact: conceptType,
    competitiveGap: getString(source, "competitiveGap", "competitive_gap", "why_this_concept", "whyThisConcept"),
    content_type: normalizeContentType(source.content_type) || source.content_type,
    content_pillar: getString(source, "content_pillar", "contentPillar"),
    product_focus: getString(source, "product_focus", "productFocus", "product_service_focus", "productServiceFocus"),
    concept_idea: getString(source, "concept_idea", "conceptIdea") || getString(source, "title"),
    copywriting: {
      headline: getString(copywriting, "headline") || getString(source, "headline", "title"),
      sub_headline_1: getString(copywriting, "sub_headline_1", "subHeadline1", "subheadline"),
      sub_headline_2: getString(copywriting, "sub_headline_2", "subHeadline2"),
      bullets: Array.isArray(copywriting.bullets) ? copywriting.bullets.filter((item): item is string => typeof item === "string") : [],
      cta: getString(copywriting, "cta"),
    },
    tags: Array.isArray(source.tags) ? source.tags.filter((item): item is string => typeof item === "string") : [],
    format_execution: getString(source, "format_execution", "formatExecution"),
    product_service_focus: getString(source, "product_service_focus", "productServiceFocus"),
    strategic_angle: getString(source, "strategic_angle", "strategicAngle"),
    why_this_concept: getString(source, "why_this_concept", "whyThisConcept"),
    creative_direction: creativeDirection
      ? {
          main_visual_or_scene: getString(creativeDirection, "main_visual_or_scene", "mainVisualOrScene"),
          layout_or_sequence: getString(creativeDirection, "layout_or_sequence", "layoutOrSequence"),
          production_notes: getString(creativeDirection, "production_notes", "productionNotes"),
        }
      : undefined,
    visual_routes: visualRoutes,
  } as IdeaRecommendation
}
