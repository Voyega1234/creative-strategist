import { NextRequest, NextResponse } from "next/server"

import { vertexGenerateContent } from "@/lib/google/vertex-ai"

const HIGHLIGHT_MODEL = process.env.IDEA_HIGHLIGHT_GEMINI_MODEL || "gemini-3-flash-preview"
const MAX_ITEMS = 20
const MAX_TERMS_PER_ITEM = 2

type HighlightRequestItem = {
  id: string
  hook?: string
  subheadline: string
  concept?: string
  cta?: string
  why?: string
  tags?: string[]
}

function getGeminiText(payload: unknown) {
  const candidates =
    payload && typeof payload === "object" && "candidates" in payload
      ? (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates
      : undefined

  return (
    candidates?.[0]?.content?.parts
      ?.map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("\n")
      .trim() || ""
  )
}

function parseHighlightResponse(text: string, allowedIds: Set<string>) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "")
  const parsed = JSON.parse(cleaned) as unknown
  const items =
    parsed && typeof parsed === "object" && "items" in parsed
      ? (parsed as { items?: unknown[] }).items
      : Array.isArray(parsed)
        ? parsed
        : []

  const highlights: Record<string, string[]> = {}

  for (const item of items || []) {
    if (!item || typeof item !== "object") continue
    const source = item as { id?: unknown; highlights?: unknown; terms?: unknown; keywords?: unknown }
    const id = typeof source.id === "string" ? source.id : ""
    if (!allowedIds.has(id)) continue

    const rawTerms = Array.isArray(source.highlights)
      ? source.highlights
      : Array.isArray(source.terms)
        ? source.terms
        : Array.isArray(source.keywords)
          ? source.keywords
          : []

    highlights[id] = rawTerms
      .filter((term): term is string => typeof term === "string")
      .map((term) => term.trim())
      .filter(Boolean)
      .slice(0, MAX_TERMS_PER_ITEM)
  }

  return highlights
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const rawItems = Array.isArray(body?.items) ? body.items : []
    const items: HighlightRequestItem[] = rawItems
      .map((item: unknown) => {
        const source = item && typeof item === "object" ? (item as Record<string, unknown>) : {}
        return {
          id: typeof source.id === "string" ? source.id : "",
          hook: typeof source.hook === "string" ? source.hook : "",
          subheadline: typeof source.subheadline === "string" ? source.subheadline : "",
          concept: typeof source.concept === "string" ? source.concept : "",
          cta: typeof source.cta === "string" ? source.cta : "",
          why: typeof source.why === "string" ? source.why : "",
          tags: Array.isArray(source.tags) ? source.tags.filter((tag): tag is string => typeof tag === "string") : [],
        }
      })
      .filter((item) => item.id && item.subheadline)
      .slice(0, MAX_ITEMS)

    if (items.length === 0) {
      return NextResponse.json({ highlights: {}, model: HIGHLIGHT_MODEL })
    }

    const prompt = `
You are choosing visual emphasis words for a client-facing ad idea PDF.

For each item, select only 1-2 truly important exact words or short phrases from the subheadline that a reader should skim first.

Rules:
- Return JSON only.
- Use exact text spans from subheadline. Do not rewrite.
- Prefer only the strongest strategic noun, product/service term, audience pain, proof, or conversion angle.
- Avoid generic words, filler, conjunctions, and common Thai particles.
- If the subheadline has no clearly important term, return an empty array.

Return this exact shape:
{
  "items": [
    { "id": "same id", "highlights": ["exact phrase", "exact phrase"] }
  ]
}

Items:
${JSON.stringify(items, null, 2)}
`.trim()

    const response = await vertexGenerateContent(HIGHLIGHT_MODEL, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        response_mime_type: "application/json",
        temperature: 0.1,
      },
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.error?.message || `Gemini request failed (${response.status})`, highlights: {} },
        { status: response.status },
      )
    }

    const text = getGeminiText(payload)
    const highlights = parseHighlightResponse(text, new Set(items.map((item) => item.id)))

    return NextResponse.json({ highlights, model: HIGHLIGHT_MODEL })
  } catch (error) {
    console.error("[idea-highlight-keywords] Request failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate highlight keywords", highlights: {} },
      { status: 500 },
    )
  }
}
