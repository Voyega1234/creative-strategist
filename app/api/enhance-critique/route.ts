import { NextResponse } from "next/server"
import { createHash } from "node:crypto"

import { vertexGenerateContent } from "@/lib/google/vertex-ai"

export const dynamic = "force-dynamic"
export const maxDuration = 180

const ANALYSIS_MODEL = "gemini-3.1-pro-preview"
// Spell check runs on Claude (Sonnet 4.6) via OpenRouter, separate from the Gemini critique.
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_SPELL_CHECK_MODEL =
  process.env.OPENROUTER_SPELL_CHECK_MODEL || "anthropic/claude-sonnet-4.6"
const OPENROUTER_CHAT_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
const ANALYSIS_PROMPT_VERSION = "2026-06-15-claude-spellcheck-v1"
const ANALYSIS_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const analysisCache = new Map<string, { expiresAt: number; critique: any; model: string }>()
const SCORE_BREAKDOWN_FIELDS = [
  "overall_beauty",
  "art_direction",
  "composition",
  "color_lighting",
  "typography",
  "polish_realism",
  "originality",
  "ad_readiness",
] as const

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

function normalizeScoreBreakdown(value: any) {
  const normalized: Record<string, number> = {}

  for (const field of SCORE_BREAKDOWN_FIELDS) {
    normalized[field] = normalizeScore(value?.[field])
  }

  return normalized
}

function averageScoreBreakdown(scoreBreakdown: Record<string, number>) {
  const scores = SCORE_BREAKDOWN_FIELDS.map((field) => scoreBreakdown[field]).filter((score) => score > 0)
  if (!scores.length) return 0

  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length
  return Math.round(average * 10) / 10
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : []
}

function normalizeSpellCheck(value: any) {
  const issues = Array.isArray(value?.issues)
    ? value.issues
        .map((issue: any) => ({
          original_text: typeof issue?.original_text === "string" ? issue.original_text.trim() : "",
          suggested_text: typeof issue?.suggested_text === "string" ? issue.suggested_text.trim() : "",
          language: typeof issue?.language === "string" ? issue.language.trim() : "",
          issue: typeof issue?.issue === "string" ? issue.issue.trim() : "",
          rationale: typeof issue?.rationale === "string" ? issue.rationale.trim() : "",
        }))
        .filter((issue: any) => issue.original_text || issue.suggested_text || issue.issue)
    : []

  return {
    detected_text: normalizeStringArray(value?.detected_text),
    issues,
    corrected_text_recommendation:
      typeof value?.corrected_text_recommendation === "string" ? value.corrected_text_recommendation.trim() : "",
    confidence_note: typeof value?.confidence_note === "string" ? value.confidence_note.trim() : "",
  }
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
  const buffer = Buffer.from(arrayBuffer)
  const mimeType = response.headers.get("content-type")?.split(";")[0].trim() || "image/png"
  const imageHash = createHash("sha256").update(buffer).digest("hex")

  return {
    base64: buffer.toString("base64"),
    imageHash,
    mimeType,
  }
}

function getCachedAnalysis(cacheKey: string) {
  const cached = analysisCache.get(cacheKey)
  if (!cached) return null

  if (cached.expiresAt <= Date.now()) {
    analysisCache.delete(cacheKey)
    return null
  }

  return {
    critique: JSON.parse(JSON.stringify(cached.critique)),
    model: cached.model,
  }
}

function setCachedAnalysis(cacheKey: string, critique: any, model: string) {
  analysisCache.set(cacheKey, {
    expiresAt: Date.now() + ANALYSIS_CACHE_TTL_MS,
    critique: JSON.parse(JSON.stringify(critique)),
    model,
  })
}

function buildClaudeSpellCheckPrompt() {
  return `
Analyze and proofread the actual text elements visible in this image for a medical clinic advertisement.

Your main task is to inspect the text exactly as it appears in the artwork. Do not assume what the text is intended to say. Do not auto-correct the text during transcription.
Please review the image in 2 steps:
Step 1: Exact visual transcription

Transcribe every visible text element exactly as shown in the image, character by character.

Important rules:

Preserve the exact Thai letters, English letters, numbers, vowels, tone marks, punctuation, symbols, spacing, and line breaks as much as possible.
Do not silently correct spelling or wording.
Do not rewrite text based on what sounds more natural.
If a word looks wrong, transcribe the visible version first.
If any character or word is difficult to read, mark it as "unclear / needs visual confirmation" and explain which part is unclear.
Review all text areas, including headline, subhead, labels, service details, promotion box, CTA, logo text, English terms, numbers, dates, prices, and fine print.
Do not skip small text.

Step 2: Critical issues only

From the transcribed text, report ONLY issues that meet at least one of these criteria:

Spelling mistake that changes the meaning of the word
Wrong character choice that makes the word unrecognizable or meaningless
Missing or extra characters that break the word entirely
Factually incorrect medical or brand terminology
Legal or compliance risk (e.g. wrong insurance term, wrong price, misleading medical claim)

Do NOT report:

Minor stylistic preferences
Informal vs formal word choice unless meaning is lost
Punctuation style
Anything that is subjective or debatable

Output format (STRICT):
Return ONLY a valid JSON object, no prose, no markdown fences, mapping the analysis above to this exact schema:
{
  "detected_text": string[],            // Step 1: every visible text element, transcribed exactly as seen (one entry per block/line)
  "issues": [
    {
      "original_text": string,          // "Text found in image" (the exact visible version)
      "suggested_text": string,         // "Suggested correction"
      "language": "th" | "en" | "mixed" | "unknown",
      "issue": string,                  // short label for the "Issue"
      "rationale": string               // the "Reason", written in Thai
    }
  ],
  "corrected_text_recommendation": string, // optional full corrected copy; "" if not applicable
  "confidence_note": string             // note any "unclear / needs visual confirmation" parts in Thai; if Step 2 finds nothing, set this to "No critical issues detected."
}

Rules:
- Only include entries in "issues" that meet the Step 2 critical criteria. If none, return "issues": [] and set "confidence_note" to "No critical issues detected."
- "rationale" and "confidence_note" must be in Thai.
- Do not wrap the JSON in markdown or add any text before or after it.
`.trim()
}

async function runClaudeSpellCheck(base64: string, mimeType: string) {
  const emptySpellCheck = {
    detected_text: [] as string[],
    issues: [] as unknown[],
    corrected_text_recommendation: "",
    confidence_note: "",
  }

  if (!OPENROUTER_API_KEY) {
    console.error("[enhance-critique] OPENROUTER_API_KEY not configured; skipping spell check")
    return normalizeSpellCheck({ ...emptySpellCheck, confidence_note: "Spell check unavailable: OPENROUTER_API_KEY not configured" })
  }

  try {
    const response = await fetch(OPENROUTER_CHAT_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENROUTER_SPELL_CHECK_MODEL,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: buildClaudeSpellCheckPrompt() },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          },
        ],
      }),
    })

    const rawText = await response.text()
    if (!response.ok) {
      console.error("[enhance-critique] OpenRouter spell check failed:", response.status, rawText.slice(0, 500))
      return normalizeSpellCheck({ ...emptySpellCheck, confidence_note: "Spell check failed" })
    }

    const payload = JSON.parse(rawText)
    const content = payload?.choices?.[0]?.message?.content
    const contentText = Array.isArray(content)
      ? content.map((part: any) => (typeof part?.text === "string" ? part.text : "")).join("\n")
      : typeof content === "string"
        ? content
        : ""

    const parsed = extractJsonObject(contentText)
    return normalizeSpellCheck(parsed)
  } catch (error) {
    console.error("[enhance-critique] OpenRouter spell check error:", error)
    return normalizeSpellCheck({ ...emptySpellCheck, confidence_note: "Spell check failed" })
  }
}

function buildLegacyCreativeCritiquePrompt() {
  return `
You are a senior advertising art director and creative reviewer.

Analyze the uploaded image as a marketing or ad creative.
Be specific, practical, and honest.
Praise what works. Criticize what hurts performance.
This creative critique task is separate from spell check. Do not spend creative critique fields on spelling corrections unless spelling directly harms conversion clarity.

Start by looking at the image like a professional visual craft reviewer, not like a generic marketing checklist.
Before choosing main_issue, inspect the whole image and identify the single weakness that most damages professional quality, believability, and first impression.

Priority diagnosis order:
1. First check visual plausibility and craft:
- Do the main products/objects feel physically grounded in the scene?
- Are contact shadows, object placement, depth, perspective, scale, lighting direction, and reflections believable?
- Does anything look pasted in, floating, cut out badly, over-smoothed, distorted, or obviously AI-generated?
- Do people, products, hands, faces, objects, materials, and scene details feel natural and professionally finished?

2. Then check composition and visual hierarchy:
- Does the viewer understand what to look at first, second, and third?
- Are the main product and selling message supported by the layout?
- Is the image balanced, too crowded, too empty, or visually awkward?

3. Then check typography, price tags, callouts, and graphic design:
- Only treat text boxes, price tags, typography, or graphic overlays as the main issue if they are truly the highest-impact weakness.
- Do not criticize bold promo labels, red price tags, or large offer text just because they are visually loud if they are intentional and useful for the ad.

Evaluate these dimensions:
- clarity
- visual hierarchy
- branding
- conversion readiness
- realism / polish
- originality

Main issue rule:
- main_issue must be the highest-impact visual or advertising weakness in the whole image.
- Do not choose a minor taste preference, secondary spacing issue, or easy-to-describe graphic detail if a larger realism, object placement, composition, or craft problem is present.
- If the image has a major plausibility problem, mention that before smaller typography or layout concerns.

Art direction prescription:
- Do not stop at criticism. Every weakness you mention must lead to a concrete visual fix.
- priority_fixes must be written as actionable art direction, not generic advice.
- Each priority_fixes item should say what to change visually and how to change it.
- preserve_focus must describe what is already working and must not be damaged during improvement.
- reimagine_brief must propose a stronger visual route, including composition, product placement, lighting, typography, and scene direction.
- what_hurts_performance should explain why the issue makes the image less attractive, less believable, less premium, or less useful as an ad.

Output quality bar:
- Avoid vague advice such as "make it more engaging", "improve layout", "make it premium", or "make it cleaner" unless you specify exactly what should visually change.
- Prefer concrete directions such as: adjust object placement, add believable contact shadows, reduce competing focal points, create one hero product, improve type scale, align price cards to a grid, unify lighting direction, add depth separation, simplify background, or preserve readable offer hierarchy.
- If the current image is already good, still recommend the smallest specific refinements that would make it better without damaging what works.

Decide the recommended next move:
- "preserve" if the image is fundamentally strong and only needs cleanup, polish, or light quality improvement
- "reimagine" if the image needs a stronger concept, framing, layout, hierarchy, or new direction
  `.trim()
}

function buildCreativeCritiquePrompt() {
  return buildLegacyCreativeCritiquePrompt()
}

function buildCritiquePrompt() {
  return `
${buildCreativeCritiquePrompt()}

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
- priority_fixes must be practical visual edit instructions, not just observations
- preserve_focus must specify what to keep intact during improvement
- reimagine_brief must be a usable art direction brief, not a generic summary
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

    const { base64, imageHash, mimeType } = await fetchImageAsBase64(imageUrl)
    const cacheKey = `${ANALYSIS_MODEL}:${ANALYSIS_PROMPT_VERSION}:${imageHash}`
    const cachedAnalysis = getCachedAnalysis(cacheKey)

    if (cachedAnalysis) {
      return NextResponse.json({
        success: true,
        critique: cachedAnalysis.critique,
        model: cachedAnalysis.model,
        cached: true,
      })
    }

    // Spell check (Claude via OpenRouter) runs in parallel with the Gemini creative critique.
    const spellCheckPromise = runClaudeSpellCheck(base64, mimeType)

    const response = await vertexGenerateContent(ANALYSIS_MODEL, {
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
    }, {
      labels: { feature: "enhance_image", operation: "creative_critique" },
    })

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
    critique.spell_check = await spellCheckPromise
    setCachedAnalysis(cacheKey, critique, ANALYSIS_MODEL)

    return NextResponse.json({
      success: true,
      critique,
      model: ANALYSIS_MODEL,
      cached: false,
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
