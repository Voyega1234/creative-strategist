import { NextResponse } from "next/server"

import { vertexGenerateContent } from "@/lib/google/vertex-ai"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const BRIEF_FILE_MODEL = process.env.BRIEF_FILE_GEMINI_MODEL || "gemini-3-flash-preview"
const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_TEXT_CHARS = 80_000

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
])

function inferMimeType(file: File) {
  if (SUPPORTED_MIME_TYPES.has(file.type)) return file.type
  const extension = file.name.split(".").pop()?.toLowerCase()
  if (extension === "pdf") return "application/pdf"
  if (extension === "txt") return "text/plain"
  if (extension === "csv") return "text/csv"
  return ""
}

type GeminiTextPart = { text?: unknown }
type GeminiCandidate = { content?: { parts?: GeminiTextPart[] } }
type GeminiPayload = { candidates?: GeminiCandidate[] }

function isGeminiPayload(payload: unknown): payload is GeminiPayload {
  return Boolean(payload && typeof payload === "object" && "candidates" in payload)
}

function extractText(payload: unknown) {
  if (!isGeminiPayload(payload)) return ""

  return (payload.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .filter((part) => typeof part.text === "string")
    .map((part) => part.text as string)
    .join("\n")
    .trim()
}

function buildPrompt(fileName: string) {
  return `You are helping a Thai advertising strategist turn an uploaded brief file into usable input for concept idea generation.

Extract only information that can guide creative strategy:
- client / brand / product / service details
- campaign objective, target audience, offer, pain points, objections
- required messages, tone, do/don't constraints, claims, proof, keywords
- any rows or fields in CSV that look like campaign/product/context data

Rules:
- Write in Thai unless exact English terms, brand names, or product terms should be preserved.
- Return concise plain text only. No markdown tables, no JSON.
- Keep specific facts, numbers, constraints, and exact phrases.
- Do not invent missing details.

Uploaded file: ${fileName}`
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "กรุณาอัปโหลดไฟล์ PDF, TXT หรือ CSV" }, { status: 400 })
    }

    const mimeType = inferMimeType(file)
    if (!mimeType) {
      return NextResponse.json({ success: false, error: "รองรับเฉพาะไฟล์ PDF, TXT หรือ CSV เท่านั้น" }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: "ไฟล์ต้องมีขนาดไม่เกิน 10 MB" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const prompt = buildPrompt(file.name)
    const parts =
      mimeType === "application/pdf"
        ? [
            {
              inlineData: {
                data: buffer.toString("base64"),
                mimeType,
              },
            },
            { text: prompt },
          ]
        : [
            {
              text: `${prompt}

File content:
${buffer.toString("utf8").slice(0, MAX_TEXT_CHARS)}`,
            },
          ]

    const response = await vertexGenerateContent(BRIEF_FILE_MODEL, {
      contents: [{ parts }],
      generationConfig: { temperature: 0.1 },
    })

    const raw = await response.text()
    const payload = raw ? JSON.parse(raw) : null

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: payload?.error?.message || `Gemini request failed (${response.status})` },
        { status: response.status },
      )
    }

    const text = extractText(payload)
    if (!text) {
      return NextResponse.json({ success: false, error: "ไม่พบข้อมูล brief ที่ใช้งานได้ในไฟล์" }, { status: 422 })
    }

    return NextResponse.json({ success: true, text, model: BRIEF_FILE_MODEL })
  } catch (error) {
    console.error("[brief-file/extract] Failed to extract brief file:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "อ่านไฟล์ brief ไม่สำเร็จ" },
      { status: 500 },
    )
  }
}
