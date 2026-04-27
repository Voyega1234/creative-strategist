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
  const mimeType = response.headers.get("content-type")?.split(";")[0].trim() || "image/png"

  return {
    base64: Buffer.from(arrayBuffer).toString("base64"),
    mimeType,
  }
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
  `.trim()
}

function buildCreativeCritiquePrompt() {
  return `
You are a senior advertising art director and visual craft reviewer.

Analyze the uploaded image mainly from an aesthetic, art direction, and visual quality perspective.
The goal is to judge whether the image looks beautiful, polished, premium, intentional, and suitable for advertising.

Be specific, practical, and honest.
Praise what visually works.
Criticize what makes the image look cheap, generic, messy, AI-generated, awkward, or less attractive.

This is not a spell check task.
Do not focus on spelling unless text mistakes directly damage the visual impression or ad clarity.

Evaluate these dimensions:

1. Overall visual appeal
- Is the image immediately attractive?
- Does it feel polished, premium, and worth looking at?
- Does it look like a finished ad or still like a draft?

2. Art direction quality
- Does the image have a clear visual style?
- Is the mood, lighting, color, texture, and composition intentional?
- Does it feel art-directed or randomly generated?

3. Composition and balance
- Are the main elements placed beautifully?
- Is the layout balanced or awkward?
- Is there enough breathing room?
- Does the image feel too empty, too crowded, too flat, or too chaotic?

4. Color and lighting
- Do the colors work well together?
- Is the contrast attractive?
- Does the lighting make the subject look better?
- Are there color clashes, muddy tones, over-saturation, or dull areas?

5. Typography and text treatment
- Does the text look well-designed?
- Are font size, weight, spacing, alignment, and placement visually strong?
- Does the typography feel premium, modern, playful, bold, or cheap?
- Does the text support the image or ruin the design?

6. Visual hierarchy
- What does the eye see first, second, and third?
- Is the most beautiful or important element getting enough focus?
- Are there elements stealing attention for the wrong reason?

7. Brand fit and design taste
- Does the image feel suitable for the type of brand?
- Does it match the expected level of taste for this category?
- Does it look too generic, too template-like, too stock-like, or too AI-like?

8. Realism and polish
- Are there unnatural shadows, strange lighting, bad cutouts, distorted objects, weird hands/faces/products, fake reflections, or over-smoothed AI details?
- Does the image feel believable and professionally finished?

9. Originality and stopping power
- Does it look visually memorable?
- Would it stand out in a feed?
- Is there any fresh visual idea, or is it just a normal-looking design?

10. Advertising readiness
- Even if the image is beautiful, is it strong enough to be used as an ad?
- Does it have enough clarity, focus, and visual impact?
- Would small refinements make it usable, or does it need a new visual direction?

Map your critique into the JSON fields like this:
- overall_score: final holistic score from 1-10 based on beauty, art direction, composition, color/lighting, typography, polish/realism, originality, and ad readiness
- rationale: one-line visual verdict in Thai
- top_strength: strongest visual quality in one direct Thai sentence
- main_issue: art director diagnosis in one direct Thai sentence
- what_works: only the most important visual qualities that are worth preserving
- what_hurts_performance: only the most important visual problems that reduce beauty, polish, or ad quality
- priority_fixes: must-fix practical edits only
- preserve_focus: cleanup/refinement items if preserving the current direction
- reimagine_brief: if reimagining is needed, suggest 2-3 better visual directions with mood, composition, color/lighting, typography style, and why it would look better

Choose exactly one recommended_mode:
- "preserve" if the image already looks visually strong and only needs cleanup, refinement, better typography, color grading, spacing, or polish
- "reimagine" if the image looks too generic, awkward, unattractive, messy, flat, cheap, or lacks a strong visual direction

Decision rule:
Choose "preserve" when the image has good taste, strong composition, clear style, and fixable craft issues.
Choose "reimagine" when the image has weak visual appeal, unclear art direction, awkward layout, poor style, or looks like a generic AI-generated image.

Be direct and visual-focused.
Avoid generic comments like "make it more engaging" unless you explain exactly what should change visually.
  `.trim()
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
    critique.spell_check = normalizeSpellCheck(critique?.spell_check)

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
