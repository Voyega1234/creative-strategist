import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 180

const GEMINI_MODEL = "gemini-3.1-flash-image-preview"
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY
const SUPPORTED_ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"] as const

function getMimeTypeFromBuffer(buffer: Uint8Array) {
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png"
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return "image/jpeg"
  }
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp"
  }
  return "image/png"
}

function parsePngDimensions(buffer: Uint8Array) {
  if (buffer.length < 24) return null
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
  }
}

function parseJpegDimensions(buffer: Uint8Array) {
  let offset = 2

  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1
      continue
    }

    const marker = buffer[offset + 1]
    const segmentLength = (buffer[offset + 2] << 8) | buffer[offset + 3]

    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      return {
        height: (buffer[offset + 5] << 8) | buffer[offset + 6],
        width: (buffer[offset + 7] << 8) | buffer[offset + 8],
      }
    }

    if (segmentLength <= 0) break
    offset += 2 + segmentLength
  }

  return null
}

function parseWebpDimensions(buffer: Uint8Array) {
  if (buffer.length < 30) return null

  const chunkHeader = String.fromCharCode(buffer[12], buffer[13], buffer[14], buffer[15])

  if (chunkHeader === "VP8X") {
    const width = 1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16)
    const height = 1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16)
    return { width, height }
  }

  return null
}

function inferDimensions(buffer: Uint8Array, mimeType: string) {
  if (mimeType === "image/png") return parsePngDimensions(buffer)
  if (mimeType === "image/jpeg") return parseJpegDimensions(buffer)
  if (mimeType === "image/webp") return parseWebpDimensions(buffer)
  return null
}

function getClosestAspectRatio(width: number, height: number) {
  const rawRatio = width / height

  return SUPPORTED_ASPECT_RATIOS.reduce((closest, current) => {
    const [currentWidth, currentHeight] = current.split(":").map(Number)
    const [closestWidth, closestHeight] = closest.split(":").map(Number)
    const currentDistance = Math.abs(rawRatio - currentWidth / currentHeight)
    const closestDistance = Math.abs(rawRatio - closestWidth / closestHeight)
    return currentDistance < closestDistance ? current : closest
  }, "1:1" as (typeof SUPPORTED_ASPECT_RATIOS)[number])
}

function getPreservePrompt(basePrompt?: string) {
  const promptPrefix =
    "Upscale this exact image to 2K. Preserve the same composition, layout, aspect ratio, text, colors, branding, and subject placement. Do not redesign, crop, replace, or add elements. Improve sharpness, texture, and detail only."

  if (!basePrompt?.trim()) return promptPrefix
  return `${promptPrefix}\n\nOriginal creative context:\n${basePrompt.trim()}`
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const imageUrl = typeof body.image_url === "string" ? body.image_url.trim() : ""
    const basePrompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
    const requestedAspectRatio = typeof body.aspect_ratio === "string" ? body.aspect_ratio.trim() : ""

    if (!imageUrl) {
      return NextResponse.json({ success: false, error: "image_url is required" }, { status: 400 })
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ success: false, error: "Gemini API key not configured" }, { status: 500 })
    }

    const sourceResponse = await fetch(imageUrl)
    if (!sourceResponse.ok) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch source image (${sourceResponse.status})` },
        { status: 400 },
      )
    }

    const imageBuffer = new Uint8Array(await sourceResponse.arrayBuffer())
    const mimeType =
      sourceResponse.headers.get("content-type")?.split(";")[0].trim() || getMimeTypeFromBuffer(imageBuffer)
    const dimensions = inferDimensions(imageBuffer, mimeType)
    const aspectRatio =
      SUPPORTED_ASPECT_RATIOS.find((ratio) => ratio === requestedAspectRatio) ||
      (dimensions ? getClosestAspectRatio(dimensions.width, dimensions.height) : "1:1")

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
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
                  text: getPreservePrompt(basePrompt),
                },
                {
                  inlineData: {
                    mimeType,
                    data: Buffer.from(imageBuffer).toString("base64"),
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
            imageConfig: {
              aspectRatio,
              imageSize: "2K",
            },
          },
        }),
      },
    )

    const responseText = await geminiResponse.text()
    let geminiPayload: any = null

    try {
      geminiPayload = responseText ? JSON.parse(responseText) : null
    } catch (error) {
      console.error("[upscale-image] Failed to parse Gemini response:", error, responseText)
      return NextResponse.json({ success: false, error: "Invalid Gemini response" }, { status: 500 })
    }

    if (!geminiResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: geminiPayload?.error?.message || `Gemini request failed (${geminiResponse.status})`,
        },
        { status: geminiResponse.status },
      )
    }

    const parts =
      geminiPayload?.candidates?.flatMap((candidate: any) => candidate?.content?.parts || []) || []

    const imagePart = parts.find(
      (part: any) =>
        (part.inlineData?.data && part.inlineData?.mimeType) ||
        (part.inline_data?.data && part.inline_data?.mime_type),
    )

    const imageBase64 = imagePart?.inlineData?.data || imagePart?.inline_data?.data
    const outputMimeType = imagePart?.inlineData?.mimeType || imagePart?.inline_data?.mime_type || "image/png"
    const responseMessage =
      parts
        .filter((part: any) => typeof part.text === "string")
        .map((part: any) => part.text)
        .join("\n")
        .trim() || null

    if (!imageBase64) {
      console.error("[upscale-image] No image returned from Gemini:", geminiPayload)
      return NextResponse.json(
        { success: false, error: "Gemini did not return an upscaled image", details: responseMessage },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      image_base64: imageBase64,
      mime_type: outputMimeType,
      aspect_ratio: aspectRatio,
      model: GEMINI_MODEL,
      details: responseMessage,
    })
  } catch (error) {
    console.error("[upscale-image] Unexpected error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to upscale image",
      },
      { status: 500 },
    )
  }
}
