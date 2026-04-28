import { NextResponse } from "next/server"
import { createHash } from "node:crypto"

export const dynamic = "force-dynamic"
export const maxDuration = 180

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY
const ANALYSIS_MODEL = "gemini-3.1-pro-preview"
const ANALYSIS_PROMPT_VERSION = "2026-04-28-art-direction-prescription-v1"
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

function buildSpellCheckPrompt() {
  return `
English and Thai Spell Checker

You are a highly proficient and accurate English and Thai spell checker.
Your task is to read visible text from the uploaded image, identify spelling errors in either language, and provide correct spelling.
This spell check task is separate from creative critique. Do not critique design, layout, marketing idea, composition, hierarchy, branding, or conversion quality here.

Common Thai Misspellings to Check First (INCORRECT -> CORRECT):
- นะค่ะ -> นะคะ
- กูเกิ้ล -> กูเกิล
- เฟสบุ๊ค -> เฟซบุ๊ก
- กดไลค์ -> กดไลก์
- อัพเดท -> อัปเดต
- อัพโหลด -> อัปโหลด
- ดาวโหลด -> ดาวน์โหลด
- คลิ๊ก -> คลิก
- คอนเท้นต์ -> คอนเทนต์
- อีเมล์ -> อีเมล
- แอพพลิเคชั่น -> แอปพลิเคชัน
- เว็ปไซต์ -> เว็บไซต์
- อีบุ๊ค -> อีบุ๊ก
- ดิจิตอล -> ดิจิทัล
- ไตรมาตร -> ไตรมาส
- กราฟิค/กราฟฟิก -> กราฟิก
- วีดิโอ -> วิดีโอ
- ลิงค์ -> ลิงก์
- บล็อค -> บล็อก
- โปรโมชั่น -> โปรโมชัน
- พิม -> พิมพ์
- กลยุทธิ์/กลยุทธ -> กลยุทธ์
- คำนวน -> คำนวณ
- เซ็นต์ชื่อ -> เซ็นชื่อ
- เวิร์คช็อป -> เวิร์กชอป
- สังเขบ -> สังเขป
- สังเกตุ -> สังเกต
- สัมภาสน์/สัมภาษ -> สัมภาษณ์
- อนุญาติ -> อนุญาต
- กฏหมาย -> กฎหมาย
- ซีรีย์ -> ซีรีส์
- ก้อ -> ก็
- ล็อคอิน -> ล็อกอิน
- แพลทฟอร์ม -> แพลตฟอร์ม
- แฮชแท็ค -> แฮชแท็ก
- เวอร์ชั่น -> เวอร์ชัน
- บุ๊คกิ้ง -> บุกกิง
- อินเตอร์เน็ต -> อินเทอร์เน็ต
- แพ็คเกจ -> แพ็กเกจ
- ก็อปปี้ -> ก๊อปปี้
- โปรเจค -> โพรเจกต์
- โปรไฟล์ -> โพร์ไฟล์
- เซิร์ช -> เสิร์ช
- สคริปท์ -> สคริปต์
- แบล็คลิสต์ -> แบล็กลิสต์
- เกมส์ -> เกม
- อัลกอรึทึ่ม -> อัลกอรึทึม
- อาร์ทเวิร์ค -> อาร์ตเวิร์ก
- ลิขสิทธ์/ลิขสิทธิ -> ลิขสิทธิ์
- แผนการณ์ -> แผนการ

Common Thai Typing Errors:
- เลา -> เรา
- ขื้น -> ขึ้น
- ขึ่น -> ขึ้น
- เค้า -> เขา
- ค้าบ -> ครับ

Spell Check Responsibilities:
1. First compare every visible Thai word against the common misspellings list above.
2. Carefully read visible English and Thai text from the image only.
3. Identify spelling mistakes, typos, or incorrect word choices.
4. Handle mixed-language text within the same sentence or layout.
5. Only report words that are actually misspelled. Do not correct words that are already correct.
6. Do not infer hidden text, filename text, metadata, or brand details that are not visible.
7. If text is unclear, include that limitation in confidence_note instead of guessing aggressively.
8. If no errors are found, return an empty issues array and set confidence_note to "No spelling errors found."

For each spelling issue, provide:
- original_text: the misspelled word or phrase exactly as seen
- suggested_text: the corrected spelling
- language: th, en, mixed, or unknown
- issue: short issue type
- rationale: short Thai reason
  `.trim()
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

${buildSpellCheckPrompt()}

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
  "reimagine_brief": string,
  "spell_check": {
    "detected_text": string[],
    "issues": [
      {
        "original_text": string,
        "suggested_text": string,
        "language": "th" | "en" | "mixed" | "unknown",
        "issue": string,
        "rationale": string
      }
    ],
    "corrected_text_recommendation": string,
    "confidence_note": string
  }
}

Rules:
- All text must be in Thai
- overall_score must be on a 0 to 10 scale only
- use decimals when needed, for example 6.8
- Creative fields must contain creative critique only
- spell_check must contain spelling/copy QA only
- Do not duplicate spell-check issues inside what_hurts_performance or priority_fixes unless the typo is a major ad-performance issue
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

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ success: false, error: "Gemini API key not configured" }, { status: 500 })
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
    critique.spell_check = normalizeSpellCheck(critique?.spell_check)
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
