import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 180

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY
const ANALYSIS_MODEL = "gemini-3-flash-preview"

function normalizeScore(rawScore: unknown) {
  const numeric =
    typeof rawScore === "number"
      ? rawScore
      : typeof rawScore === "string"
        ? Number.parseFloat(rawScore)
        : Number.NaN

  if (!Number.isFinite(numeric)) {
    return 0
  }

  const normalized = numeric > 10 && numeric <= 100 ? numeric / 10 : numeric
  const clamped = Math.min(10, Math.max(0, normalized))

  return Math.round(clamped * 10) / 10
}

function extractTextFromGemini(payload: any) {
  const parts = payload?.candidates?.flatMap((candidate: any) => candidate?.content?.parts || []) || []
  return parts
    .filter((part: any) => typeof part.text === "string")
    .map((part: any) => part.text)
    .join("\n")
    .trim()
}

function extractJsonObject(text: string) {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i)
  const raw = fencedMatch?.[1]?.trim() || text.trim()
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI critique did not return JSON")
  }

  return JSON.parse(raw.slice(start, end + 1))
}

async function fetchImageAsBase64(url: string) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Unable to fetch image from URL (${response.status})`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const mimeType = response.headers.get("content-type")?.split(";")[0].trim() || "image/png"

  return {
    base64: Buffer.from(arrayBuffer).toString("base64"),
    mimeType,
  }
}

function buildCritiquePrompt() {
  return `
You are a senior advertising art director and creative reviewer.

Analyze the uploaded image as a marketing or ad creative.
Be specific, practical, and honest.
Praise what works. Criticize what hurts performance.

Evaluate these dimensions:
- clarity
- visual hierarchy
- branding
- conversion readiness
- realism / polish
- originality

Decide the recommended next move:
- "preserve" if the image is fundamentally strong and only needs cleanup, polish, or light quality improvement
- "reimagine" if the image needs a stronger concept, framing, layout, hierarchy, or new direction

Return valid JSON only with this schema:
{
  "overall_score": number,
  "top_strength": string,
  "main_issue": string,
  "what_works": string[],
  "what_hurts_performance": string[],
  "priority_fixes": string[],
  "recommended_mode": "preserve" | "reimagine",
  "rationale": string,
  "preserve_focus": string[],
  "reimagine_brief": string
}

Rules:
- All text must be in Thai
- overall_score must be on a 0 to 10 scale only
- use decimals when needed, for example 6.8
- Keep each item concise but specific
- Give 2 to 4 bullets for each array
- Do not use generic praise
- Do not mention JSON or formatting
  `.trim()
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const imageUrl = typeof body.image_url === "string" ? body.image_url.trim() : ""

    if (!imageUrl) {
      return NextResponse.json({ success: false, error: "image_url is required" }, { status: 400 })
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ success: false, error: "Gemini API key not configured" }, { status: 500 })
    }

    const { base64, mimeType } = await fetchImageAsBase64(imageUrl)

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${ANALYSIS_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": GEMINI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    data: base64,
                    mimeType,
                  },
                },
                {
                  text: buildCritiquePrompt(),
                },
              ],
            },
          ],
        }),
      },
    )

    const text = await response.text()
    let payload: any = null

    try {
      payload = text ? JSON.parse(text) : null
    } catch (error) {
      console.error("[enhance-critique] Failed to parse Gemini response:", error, text)
      return NextResponse.json({ success: false, error: "Invalid Gemini response" }, { status: 500 })
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: payload?.error?.message || `Gemini request failed (${response.status})`,
        },
        { status: response.status },
      )
    }

    const modelText = extractTextFromGemini(payload)
    const critique = extractJsonObject(modelText)
    critique.overall_score = normalizeScore(critique?.overall_score)

    return NextResponse.json({
      success: true,
      critique,
      model: ANALYSIS_MODEL,
    })
  } catch (error) {
    console.error("[enhance-critique] Unexpected error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to critique image",
      },
      { status: 500 },
    )
  }
}
