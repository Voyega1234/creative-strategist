import { NextResponse } from "next/server"

import { vertexGenerateContent } from "@/lib/google/vertex-ai"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const DESCRIBE_MODEL = "gemini-2.5-flash"

const DESCRIBE_PROMPT = `
You are assisting a creative strategist at an advertising agency.
Describe the attached image so the description can be inserted into a creative brief
used by another AI to generate advertising concept ideas.

Cover concisely:
- What the image shows: subject, product, people, setting
- Any visible text or messages (quote exactly when readable)
- Style, mood, tone, and color palette
- Composition / layout and notable creative techniques
- What the image seems intended to communicate or sell

Rules:
- Write in Thai
- Plain text only: no headings, no JSON, no markdown, no bullet symbols
- Around 80-150 words
- Describe only what is visible; do not invent details
`.trim()

function parseImageDataUrl(value: unknown) {
  if (typeof value !== "string") return null
  const match = value.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i)
  if (!match) return null
  return { mimeType: match[1], base64: match[2] }
}

function extractTextFromGemini(payload: any) {
  const parts = payload?.candidates?.flatMap((candidate: any) => candidate?.content?.parts || []) || []
  return parts
    .filter((part: any) => typeof part.text === "string")
    .map((part: any) => part.text)
    .join("\n")
    .trim()
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const image = parseImageDataUrl(body.imageDataUrl)

    if (!image) {
      return NextResponse.json(
        { success: false, error: "imageDataUrl must be a base64 image data URL" },
        { status: 400 },
      )
    }

    const response = await vertexGenerateContent(DESCRIBE_MODEL, {
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: image.base64,
                mimeType: image.mimeType,
              },
            },
            {
              text: DESCRIBE_PROMPT,
            },
          ],
        },
      ],
    })

    const text = await response.text()
    let payload: any = null

    try {
      payload = text ? JSON.parse(text) : null
    } catch (error) {
      console.error("[describe-image] Failed to parse Gemini response:", error, text)
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

    const description = extractTextFromGemini(payload)

    if (!description) {
      return NextResponse.json({ success: false, error: "Gemini returned an empty description" }, { status: 500 })
    }

    return NextResponse.json({ success: true, description, model: DESCRIBE_MODEL })
  } catch (error) {
    console.error("[describe-image] Unexpected error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to describe image",
      },
      { status: 500 },
    )
  }
}
