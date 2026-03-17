import { NextRequest, NextResponse } from "next/server"
import {
  buildCustomIdeaFallback,
  cleanAndParseCustomIdeaResponse,
} from "@/lib/custom-idea-parser"

const GEMINI_MODEL = "gemini-3.1-flash-lite-preview"
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY

async function callGeminiParser(inputText: string, clientName?: string, productFocus?: string) {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key not configured")
  }

  const prompt = `
You convert a user's freeform ad idea note into a structured JSON object for an internal creative workflow.

Context:
- Client name: ${clientName || "Unknown"}
- Product focus: ${productFocus || "Unknown"}

Return JSON only. Do not wrap in markdown.

Required JSON shape:
{
  "title": "short clear idea title",
  "description": "1-3 sentence summary of the idea",
  "category": "short marketing category",
  "concept_type": "short concept type",
  "competitiveGap": "market gap or strategic angle",
  "tags": ["tag1", "tag2"],
  "content_pillar": "content pillar",
  "concept_idea": "core creative concept",
  "copywriting": {
    "headline": "headline",
    "sub_headline_1": "sub headline 1",
    "sub_headline_2": "sub headline 2",
    "bullets": ["bullet 1", "bullet 2"],
    "cta": "call to action"
  }
}

Rules:
- Preserve the user's meaning. Do not invent a new strategy unrelated to the input.
- If some fields are missing, infer lightly from the input and keep them concise.
- Keep the response practical for static image ad generation.
- Tags must be short lowercase phrases without #.
- Use the same language as the user's input when possible.

User input:
${inputText}
`.trim()

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        response_mime_type: "application/json",
        temperature: 0.2,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API error: ${response.status} ${errorText}`)
  }

  const result = await response.json()
  const text = result.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("\n") || ""
  return cleanAndParseCustomIdeaResponse(text, inputText)
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

    const fallbackIdea = buildCustomIdeaFallback(inputText)

    if (!GEMINI_API_KEY) {
      return NextResponse.json({
        idea: fallbackIdea,
        source: "fallback",
        warning: "Gemini API key not configured",
      })
    }

    try {
      const idea = await callGeminiParser(inputText, clientName, productFocus)
      return NextResponse.json({
        idea,
        source: "gemini",
        model: GEMINI_MODEL,
      })
    } catch (error) {
      console.error("[parse-custom-idea] Gemini parse failed:", error)
      return NextResponse.json({
        idea: fallbackIdea,
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
