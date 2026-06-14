import { NextResponse } from "next/server"

import { normalizeExternalImageUrl } from "@/lib/images/external-url"
import { vertexGenerateContent } from "@/lib/google/vertex-ai"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const SPELL_CHECK_MODEL = process.env.SPELL_CHECK_GEMINI_MODEL || "gemini-3.1-pro-preview"

type SpellCheckRequest = {
  image_url?: string
  image_data_url?: string
}

// Normalized 0-1 region, same shape as edit-image-chat's mask_bounds so an issue
// can be sent straight to the image editor for a targeted fix.
type IssueBox = {
  left: number
  top: number
  right: number
  bottom: number
}

type SpellCheckIssue = {
  original_text: string
  suggested_text: string
  language: string
  issue: string
  rationale: string
  location_description: string
  box: IssueBox | null
  edit_instruction: string
}

const SPELL_CHECK_PROMPT = `
You are a dedicated Thai and English spell-check agent for advertising creatives.
Your only job: read every piece of visible text in the image, find spelling errors,
and report each error with its exact location so another AI can fix that exact spot.

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
- ดิจิตอล -> ดิจิทัล
- กราฟิค/กราฟฟิก -> กราฟิก
- วีดิโอ -> วิดีโอ
- ลิงค์ -> ลิงก์
- โปรโมชั่น -> โปรโมชัน
- กลยุทธิ์/กลยุทธ -> กลยุทธ์
- คำนวน -> คำนวณ
- สังเกตุ -> สังเกต
- อนุญาติ -> อนุญาต
- กฏหมาย -> กฎหมาย
- เวอร์ชั่น -> เวอร์ชัน
- อินเตอร์เน็ต -> อินเทอร์เน็ต
- แพ็คเกจ -> แพ็กเกจ
- เกมส์ -> เกม
- ลิขสิทธ์/ลิขสิทธิ -> ลิขสิทธิ์
- แผนการณ์ -> แผนการ

AI-Generated Image Glyph Errors (CRITICAL):
This image may be AI-generated. AI image models frequently swap visually similar Thai
glyphs, producing non-words or wrong words that look almost correct at a glance.
Actively check for:
- ก <-> ท (e.g. ป้องทัน -> ป้องกัน, ปวดทัน -> ปวดก้น, ทรมธรรม -> กรมธรรม์)
- จ <-> อ (e.g. อาก -> จาก)
- ฝ <-> ต/ผ (e.g. ตังเข็ม -> ฝังเข็ม)
- บ <-> ป, ด <-> ค, พ <-> ผ, ร <-> ธ
- Missing or wrong tone marks, missing การันต์ (e.g. กรมธรรม -> กรมธรรม์)
- Vowels rendered incorrectly (เ-ื, sara am position)
- แ rendered as two เ glyphs (เเ): zoom into every แ and check whether it is actually
  a single แ glyph or two เ curls with a visible gap between them
  (e.g. เเพทย์ -> แพทย์, เเละ -> และ, เเนะนำ -> แนะนำ)
Transcribe text EXACTLY as the pixels are rendered. Do NOT silently normalize
visually similar sequences into the correct word while reading — if the rendering is
wrong, the transcription in detected_text and original_text must show the wrong form.
Read every word character-by-character and verify it is a real Thai word that makes
sense in its sentence context. A word that is "almost right" is exactly what you are
hunting for.

Spell Check Rules:
1. Compare every visible Thai word against the misspelling list and glyph-error patterns above.
2. Read English text too: typos, wrong words, broken letters.
3. Handle mixed Thai/English in the same line.
4. Only report words that are actually wrong. Never "correct" text that is already correct.
5. Brand names, logos, and intentional stylized spellings are not errors unless clearly broken.
6. Do not infer hidden text, filenames, or metadata. Visible pixels only.
7. If text is too small or blurry to verify, mention that in confidence_note instead of guessing.
8. If no errors exist, return an empty issues array and confidence_note "No spelling errors found."

Location Rules (CRITICAL):
- For EVERY issue, return box_2d: the tight bounding box around the misspelled word/phrase
  ONLY (not the whole text block), as [ymin, xmin, ymax, xmax] integers normalized to 0-1000.
- Also return location_description: a short Thai phrase a human can use to find the spot,
  naming the visual container and position (e.g. "ป้ายสีชมพูด้านบนสุดของภาพ",
  "บรรทัดที่สามในกล่องสีขาวด้านซ้าย", "ป้ายราคาสีแดงมุมขวาล่าง").

Return valid JSON only with this schema:
{
  "detected_text": string[],
  "issues": [
    {
      "original_text": string,
      "suggested_text": string,
      "language": "th" | "en" | "mixed" | "unknown",
      "issue": string,
      "rationale": string,
      "box_2d": [number, number, number, number],
      "location_description": string
    }
  ],
  "corrected_text_recommendation": string,
  "confidence_note": string
}

Rules for output:
- rationale and location_description in Thai
- detected_text lists each distinct visible text block exactly as seen
- Do not mention JSON or formatting
`.trim()

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
    throw new Error("Spell-check agent did not return JSON")
  }

  return JSON.parse(raw.slice(start, end + 1))
}

function parseImageDataUrl(value: unknown) {
  if (typeof value !== "string") return null
  const match = value.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i)
  if (!match) return null
  return { mimeType: match[1], base64: match[2] }
}

async function fetchImageAsBase64(url: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Unable to fetch image (${response.status})`)
  }
  const arrayBuffer = await response.arrayBuffer()
  const mimeType = response.headers.get("content-type")?.split(";")[0].trim() || "image/png"
  return { base64: Buffer.from(arrayBuffer).toString("base64"), mimeType }
}

const BOX_PADDING = 0.015

// Gemini returns box_2d as [ymin, xmin, ymax, xmax] on a 0-1000 scale.
// Convert to the 0-1 left/top/right/bottom shape used by edit-image-chat mask_bounds,
// with slight padding so the editor has safe context around the word.
function normalizeBox(value: unknown): IssueBox | null {
  if (!Array.isArray(value) || value.length !== 4) return null
  const [ymin, xmin, ymax, xmax] = value.map((item) => Number(item))
  if ([ymin, xmin, ymax, xmax].some((item) => !Number.isFinite(item))) return null
  if (ymax <= ymin || xmax <= xmin) return null

  return {
    left: Math.max(0, xmin / 1000 - BOX_PADDING),
    top: Math.max(0, ymin / 1000 - BOX_PADDING),
    right: Math.min(1, xmax / 1000 + BOX_PADDING),
    bottom: Math.min(1, ymax / 1000 + BOX_PADDING),
  }
}

function buildEditInstruction(originalText: string, suggestedText: string, locationDescription: string) {
  return [
    `แก้ข้อความ "${originalText}" ให้เป็น "${suggestedText}"`,
    locationDescription ? `ตำแหน่ง: ${locationDescription}` : "",
    "คงฟอนต์ ขนาด สี การจัดวาง และเอฟเฟกต์ตัวอักษรเดิมทุกอย่าง ห้ามแก้ส่วนอื่นของภาพ",
  ]
    .filter(Boolean)
    .join(" ")
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : []
}

function normalizeIssues(value: unknown): SpellCheckIssue[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item: any) => {
      const originalText = typeof item?.original_text === "string" ? item.original_text.trim() : ""
      const suggestedText = typeof item?.suggested_text === "string" ? item.suggested_text.trim() : ""
      const locationDescription =
        typeof item?.location_description === "string" ? item.location_description.trim() : ""
      return {
        original_text: originalText,
        suggested_text: suggestedText,
        language: typeof item?.language === "string" ? item.language.trim() : "unknown",
        issue: typeof item?.issue === "string" ? item.issue.trim() : "",
        rationale: typeof item?.rationale === "string" ? item.rationale.trim() : "",
        location_description: locationDescription,
        box: normalizeBox(item?.box_2d),
        edit_instruction: buildEditInstruction(originalText, suggestedText, locationDescription),
      }
    })
    .filter((issue) => issue.original_text || issue.suggested_text)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SpellCheckRequest

    let image: { base64: string; mimeType: string } | null = parseImageDataUrl(body.image_data_url)
    if (!image) {
      const imageUrl = typeof body.image_url === "string" ? normalizeExternalImageUrl(body.image_url.trim()) : ""
      if (!imageUrl) {
        return NextResponse.json(
          { success: false, error: "image_url or image_data_url is required" },
          { status: 400 },
        )
      }
      image = await fetchImageAsBase64(imageUrl)
    }

    const response = await vertexGenerateContent(SPELL_CHECK_MODEL, {
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: image.base64,
                mimeType: image.mimeType,
              },
            },
            { text: SPELL_CHECK_PROMPT },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
      },
    })

    const text = await response.text()
    let payload: any = null

    try {
      payload = text ? JSON.parse(text) : null
    } catch (error) {
      console.error("[spell-check-image] Failed to parse Gemini response:", error, text)
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
    const result = extractJsonObject(modelText)

    return NextResponse.json({
      success: true,
      model: SPELL_CHECK_MODEL,
      spell_check: {
        detected_text: normalizeStringArray(result?.detected_text),
        issues: normalizeIssues(result?.issues),
        corrected_text_recommendation:
          typeof result?.corrected_text_recommendation === "string"
            ? result.corrected_text_recommendation.trim()
            : "",
        confidence_note: typeof result?.confidence_note === "string" ? result.confidence_note.trim() : "",
      },
    })
  } catch (error) {
    console.error("[spell-check-image] Unexpected error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to spell-check image",
      },
      { status: 500 },
    )
  }
}
