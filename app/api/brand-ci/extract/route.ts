import { NextResponse } from "next/server"

import { vertexGenerateContent } from "@/lib/google/vertex-ai"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const BRAND_CI_MODEL = process.env.BRAND_CI_GEMINI_MODEL || "gemini-3-flash-preview"
const MAX_FILE_SIZE = 10 * 1024 * 1024
const SUPPORTED_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"])

function extractText(payload: any) {
  return (payload?.candidates || [])
    .flatMap((candidate: any) => candidate?.content?.parts || [])
    .filter((part: any) => typeof part.text === "string")
    .map((part: any) => part.text)
    .join("\n")
    .trim()
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File) || !SUPPORTED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ success: false, error: "กรุณาอัปโหลดไฟล์ PDF, PNG หรือ JPG" }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: "ไฟล์ต้องมีขนาดไม่เกิน 10 MB" }, { status: 400 })
    }

    const response = await vertexGenerateContent(BRAND_CI_MODEL, {
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: Buffer.from(await file.arrayBuffer()).toString("base64"),
                mimeType: file.type,
              },
            },
            {
              text: `Extract all usable brand identity rules from this Brand CI document or image.
Preserve exact brand names, colors (including HEX/RGB/CMYK), typography, logo rules, tone of voice, imagery direction, layout rules, and explicit do/don't constraints.
Do not invent or summarize away specific constraints. Return concise plain text only, organized with clear labels.`,
            },
          ],
        },
      ],
      generationConfig: { temperature: 0.1 },
    }, {
      labels: { feature: "brand_ci", operation: "extract" },
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
      return NextResponse.json({ success: false, error: "ไม่พบข้อมูล Brand CI ในไฟล์" }, { status: 422 })
    }

    return NextResponse.json({ success: true, text, model: BRAND_CI_MODEL })
  } catch (error) {
    console.error("[brand-ci/extract] Failed to extract Brand CI:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "อ่านไฟล์ Brand CI ไม่สำเร็จ" },
      { status: 500 },
    )
  }
}
