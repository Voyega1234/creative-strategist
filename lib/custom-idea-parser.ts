export interface ParsedCustomIdea {
  title: string
  description: string
  category: string
  concept_type: string
  competitiveGap: string
  tags: string[]
  content_pillar: string
  concept_idea: string
  copywriting: {
    headline: string
    sub_headline_1: string
    sub_headline_2: string
    bullets: string[]
    cta: string
  }
}

export function getTopicPreviewText(description: string) {
  try {
    const parsed = JSON.parse(description)
    if (parsed && typeof parsed === "object" && "summary" in parsed && parsed.summary) {
      return String(parsed.summary)
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
      const firstItem = parsed[0]
      if (firstItem && typeof firstItem === "object" && "text" in firstItem && firstItem.text) {
        return String(firstItem.text)
      }
    }
  } catch {
    return description
  }

  return description
}

export function extractListValue(input?: string) {
  if (!input) return []
  return input
    .split(/[,|]/)
    .map((item) => item.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean)
}

function normalizeText(value: unknown) {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number") return String(value)
  return ""
}

function normalizeStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeText(item))
      .filter(Boolean)
  }

  if (typeof value === "string") {
    return extractListValue(value)
  }

  return []
}

export function buildCustomIdeaFallback(rawText: string): ParsedCustomIdea {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  const fields: Record<string, string> = {}
  const unlabeledLines: string[] = []
  const bulletLines: string[] = []

  const labelMap: Record<string, string> = {
    title: "title",
    description: "description",
    category: "category",
    "concept type": "concept_type",
    concept: "concept_idea",
    "concept idea": "concept_idea",
    "competitive gap": "competitiveGap",
    tags: "tags",
    "content pillar": "content_pillar",
    headline: "headline",
    "subheadline 1": "sub_headline_1",
    "subheadline 2": "sub_headline_2",
    bullets: "bullets",
    cta: "cta",
  }

  lines.forEach((line) => {
    const labeledMatch = line.match(/^([^:]+):\s*(.*)$/)
    if (labeledMatch) {
      const normalizedLabel = labeledMatch[1].trim().toLowerCase()
      const key = labelMap[normalizedLabel]
      if (key) {
        fields[key] = labeledMatch[2].trim()
        return
      }
    }

    if (/^[-•]\s+/.test(line)) {
      bulletLines.push(line.replace(/^[-•]\s+/, "").trim())
      return
    }

    unlabeledLines.push(line)
  })

  const hashtagTags = Array.from(
    new Set(
      rawText.match(/#([^\s#]+)/g)?.map((tag) => tag.replace(/^#/, "").trim()).filter(Boolean) || [],
    ),
  )

  const title = fields.title || unlabeledLines[0] || "Custom Idea"
  const remainingDescriptionLines = unlabeledLines.filter((line) => line !== title)
  const description = fields.description || remainingDescriptionLines.join(" ") || rawText.trim()
  const tags = Array.from(new Set([...extractListValue(fields.tags), ...hashtagTags]))
  const bullets = Array.from(new Set([...extractListValue(fields.bullets), ...bulletLines]))

  return {
    title,
    description,
    category: fields.category || "Educate",
    concept_type: fields.concept_type || "New Concept",
    competitiveGap: fields.competitiveGap || "",
    tags,
    content_pillar: fields.content_pillar || "",
    concept_idea: fields.concept_idea || description,
    copywriting: {
      headline: fields.headline || title,
      sub_headline_1: fields.sub_headline_1 || "",
      sub_headline_2: fields.sub_headline_2 || "",
      bullets,
      cta: fields.cta || "",
    },
  }
}

export function normalizeParsedCustomIdea(payload: unknown, fallbackText: string): ParsedCustomIdea {
  if (!payload || typeof payload !== "object") {
    return buildCustomIdeaFallback(fallbackText)
  }

  const source = payload as Record<string, unknown>
  const copywritingSource =
    source.copywriting && typeof source.copywriting === "object"
      ? (source.copywriting as Record<string, unknown>)
      : {}

  const fallback = buildCustomIdeaFallback(fallbackText)
  const title = normalizeText(source.title) || fallback.title
  const description = normalizeText(source.description) || fallback.description

  return {
    title,
    description,
    category: normalizeText(source.category) || fallback.category,
    concept_type: normalizeText(source.concept_type) || fallback.concept_type,
    competitiveGap:
      normalizeText(source.competitiveGap) ||
      normalizeText(source.competitive_gap) ||
      fallback.competitiveGap,
    tags: normalizeStringArray(source.tags).length > 0 ? normalizeStringArray(source.tags) : fallback.tags,
    content_pillar:
      normalizeText(source.content_pillar) ||
      normalizeText(source.contentPillar) ||
      fallback.content_pillar,
    concept_idea:
      normalizeText(source.concept_idea) ||
      normalizeText(source.conceptIdea) ||
      fallback.concept_idea,
    copywriting: {
      headline: normalizeText(copywritingSource.headline) || fallback.copywriting.headline || title,
      sub_headline_1:
        normalizeText(copywritingSource.sub_headline_1) ||
        normalizeText(copywritingSource.subheadline1) ||
        fallback.copywriting.sub_headline_1,
      sub_headline_2:
        normalizeText(copywritingSource.sub_headline_2) ||
        normalizeText(copywritingSource.subheadline2) ||
        fallback.copywriting.sub_headline_2,
      bullets:
        normalizeStringArray(copywritingSource.bullets).length > 0
          ? normalizeStringArray(copywritingSource.bullets)
          : fallback.copywriting.bullets,
      cta: normalizeText(copywritingSource.cta) || fallback.copywriting.cta,
    },
  }
}

export function cleanAndParseCustomIdeaResponse(text: string, fallbackText: string) {
  if (typeof text !== "string" || !text.trim()) {
    return buildCustomIdeaFallback(fallbackText)
  }

  let cleaned = text.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "")
  const objectMatch = cleaned.match(/\{[\s\S]*\}/)
  if (objectMatch) {
    cleaned = objectMatch[0]
  }

  try {
    const parsed = JSON.parse(cleaned)
    return normalizeParsedCustomIdea(parsed, fallbackText)
  } catch {
    return buildCustomIdeaFallback(fallbackText)
  }
}
