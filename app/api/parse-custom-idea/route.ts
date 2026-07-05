import { NextRequest, NextResponse } from "next/server"
import {
  buildCustomIdeaFallback,
  normalizeParsedCustomIdea,
} from "@/lib/custom-idea-parser"
import { vertexGenerateContent } from "@/lib/google/vertex-ai"

const GEMINI_MODEL = "gemini-3.1-flash-lite-preview"

function normalizeContentType(value: unknown) {
  const text = typeof value === "string" ? value.trim().toUpperCase() : ""
  if (text.includes("UGC")) return "UGC VIDEO"
  if (text.includes("ALBUM")) return "ALBUM AD"
  if (text.includes("MOTION") || text.includes("SHORT VDO") || text.includes("SHORT VIDEO")) return "SHORT VDO"
  if (text.includes("STATIC")) return "STATIC AD"
  return undefined
}

function splitFallbackIdeas(inputText: string) {
  const blocks = inputText
    .split(/\n(?=(?:Static\s+\d+|UGC\s+Video|Album(?:\s+Ad)?|Motion(?:\s+Ad)?|Short\s+(?:VDO|Video)|Option\s+[A-Z])\b)/gi)
    .map((block) => block.trim())
    .filter(Boolean)

  return (blocks.length > 1 ? blocks : [inputText]).map((block) => ({
    ...buildCustomIdeaFallback(block),
    content_type: normalizeContentType(block.split("\n", 1)[0]),
  }))
}

async function callGeminiParser(inputText: string, clientName?: string, productFocus?: string) {
  const prompt = `
You convert a user's freeform ad idea note into a structured JSON object for an internal creative workflow.

Context:
- Client name: ${clientName || "Unknown"}
- Product focus: ${productFocus || "Unknown"}

The input may contain one idea or many ideas. Extract every distinct idea in the same order.
Return JSON only. Do not wrap in markdown.

Required JSON shape:
{
  "ideas": [
    {
      "title": "short clear idea title",
      "description": "1-3 sentence summary of the idea",
      "category": "short marketing category",
      "concept_type": "short concept type",
      "content_type": "STATIC AD | UGC VIDEO | ALBUM AD | SHORT VDO | null",
      "competitiveGap": "market gap or strategic angle",
      "tags": ["tag1", "tag2"],
      "content_pillar": "content pillar",
      "product_focus": "product or service focus from the idea",
      "concept_idea": "core creative concept",
      "copywriting": {
        "headline": "headline",
        "sub_headline_1": "sub headline 1",
        "sub_headline_2": "sub headline 2",
        "bullets": ["bullet 1", "bullet 2"],
        "cta": "call to action"
      }
    }
  ]
}

Rules:
- Preserve the user's meaning. Do not invent a new strategy unrelated to the input.
- Return exactly one array item for each idea found in the input. Never merge separate ideas.
- Map Static to STATIC AD, UGC to UGC VIDEO, Album to ALBUM AD, and Motion/Short video to SHORT VDO.
- Use null for content_type when the input does not identify a format.
- If some fields are missing, infer lightly from the input and keep them concise.
- Keep the response practical for static image ad generation.
- Tags must be short lowercase phrases without #.
- Use the same language as the user's input when possible.

User input:
${inputText}
`.trim()

  const response = await vertexGenerateContent(GEMINI_MODEL, {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      response_mime_type: "application/json",
      temperature: 0.2,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API error: ${response.status} ${errorText}`)
  }

  const result = await response.json()
  const text = result.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("\n") || ""
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "")
  const parsed = JSON.parse(cleaned) as { ideas?: unknown[] } | unknown[]
  const rawIdeas = Array.isArray(parsed) ? parsed : Array.isArray(parsed.ideas) ? parsed.ideas : []

  if (rawIdeas.length === 0) throw new Error("Gemini returned no ideas")

  return rawIdeas.map((rawIdea) => {
    const source = rawIdea && typeof rawIdea === "object" ? rawIdea as Record<string, unknown> : {}
    return {
      ...normalizeParsedCustomIdea(source, inputText),
      content_type: normalizeContentType(source.content_type ?? source.contentType),
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const inputText = typeof body.inputText === "string" ? body.inputText.trim() : ""
    const clientName = typeof body.clientName === "string" ? body.clientName.trim() : ""
    const productFocus = typeof body.productFocus === "string" ? body.productFocus.trim() : ""

    if (!inputText) {
      return NextResponse.json({ error: "inputText is required" }, { status: 400 })
    }

    const fallbackIdeas = splitFallbackIdeas(inputText)

    try {
      const ideas = await callGeminiParser(inputText, clientName, productFocus)
      return NextResponse.json({
        ideas,
        idea: ideas[0],
        source: "gemini",
        model: GEMINI_MODEL,
      })
    } catch (error) {
      console.error("[parse-custom-idea] Gemini parse failed:", error)
      return NextResponse.json({
        ideas: fallbackIdeas,
        idea: fallbackIdeas[0],
        source: "fallback",
        warning: error instanceof Error ? error.message : "Gemini parse failed",
      })
    }
  } catch (error) {
    console.error("[parse-custom-idea] Request failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to parse custom idea" },
      { status: 500 },
    )
  }
}
