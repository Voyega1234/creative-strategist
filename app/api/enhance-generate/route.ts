import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 480

const OPENAI_EDITS_ENDPOINT = "https://api.openai.com/v1/images/edits"
const OPENAI_IMAGE_MODEL = "gpt-image-2"
const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview"
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY
const DEFAULT_FINAL_IMAGE_SIZE = "4K"
type OpenAiImageSize = "1024x1024" | "1536x1024" | "1024x1536"

const OPENAI_EXACT_SIZE_BY_RATIO: Record<string, OpenAiImageSize> = {
  "1:1": "1024x1024",
  "3:2": "1536x1024",
  "2:3": "1024x1536",
}

const OPENAI_SUPPORTED_SIZES: Array<{ ratio: string; size: OpenAiImageSize }> = [
  { ratio: "1:1", size: "1024x1024" },
  { ratio: "3:2", size: "1536x1024" },
  { ratio: "2:3", size: "1024x1536" },
]

type EnhanceMode = "preserve" | "reimagine"

type CritiquePayload = {
  top_strength: string
  main_issue: string
  what_works: string[]
  what_hurts_performance: string[]
  priority_fixes: string[]
  preserve_focus: string[]
  reimagine_brief: string
  spell_check?: {
    detected_text?: string[]
    issues?: Array<{
      original_text?: string
      suggested_text?: string
      language?: string
      issue?: string
      rationale?: string
    }>
    corrected_text_recommendation?: string
    confidence_note?: string
  }
}

function buildSpellCheckGuidance(critique: CritiquePayload) {
  const spellCheck = critique.spell_check
  if (!spellCheck) return ""

  const detectedText = Array.isArray(spellCheck.detected_text) ? spellCheck.detected_text.filter(Boolean) : []
  const issues = Array.isArray(spellCheck.issues)
    ? spellCheck.issues
        .map((issue) => {
          const originalText = issue.original_text || ""
          const suggestedText = issue.suggested_text || ""
          const note = [issue.language, issue.issue, issue.rationale].filter(Boolean).join(" - ")
          return `${originalText} => ${suggestedText}${note ? ` (${note})` : ""}`
        })
        .filter(Boolean)
    : []
  const recommendation = spellCheck.corrected_text_recommendation || ""
  const confidenceNote = spellCheck.confidence_note || ""

  if (!detectedText.length && !issues.length && !recommendation && !confidenceNote) {
    return ""
  }

  return [
    "Use this spell-check and copy QA from the source image.",
    detectedText.length ? `Visible text detected in the image: ${detectedText.join(" | ")}` : "",
    issues.length ? `Spelling or copy issues to fix: ${issues.join(" | ")}` : "",
    recommendation ? `Corrected text recommendation to preserve or typeset: ${recommendation}` : "",
    confidenceNote ? `Spell-check confidence note: ${confidenceNote}` : "",
  ]
    .filter(Boolean)
    .join(" ")
}

function getClosestAspectRatioLabel(width: number, height: number) {
  const supportedRatios = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"] as const
  const rawRatio = width / height

  return supportedRatios.reduce((closest, current) => {
    const [currentWidth, currentHeight] = current.split(":").map(Number)
    const [closestWidth, closestHeight] = closest.split(":").map(Number)
    const currentDistance = Math.abs(rawRatio - currentWidth / currentHeight)
    const closestDistance = Math.abs(rawRatio - closestWidth / closestHeight)
    return currentDistance < closestDistance ? current : closest
  }, "1:1" as (typeof supportedRatios)[number])
}

function ratioLabelToNumber(ratio: string) {
  const [width, height] = ratio.split(":").map(Number)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }
  return width / height
}

function getClosestOpenAiSizeForRatio(ratio: string): OpenAiImageSize {
  const targetRatio = ratioLabelToNumber(ratio)
  if (!targetRatio) return "1024x1024"

  return OPENAI_SUPPORTED_SIZES.reduce((closest, current) => {
    const currentRatio = ratioLabelToNumber(current.ratio) || 1
    const closestRatio = ratioLabelToNumber(closest.ratio) || 1
    return Math.abs(currentRatio - targetRatio) < Math.abs(closestRatio - targetRatio) ? current : closest
  }).size
}

function isSaneDimensions(width: number, height: number) {
  return (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0 &&
    width <= 20000 &&
    height <= 20000
  )
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

    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
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
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return parseJpegDimensions(buffer)
  if (mimeType === "image/webp") return parseWebpDimensions(buffer)
  return null
}

function extractGeminiImagePart(payload: any) {
  const parts = payload?.candidates?.flatMap((candidate: any) => candidate?.content?.parts || []) || []
  const imagePart = parts.find(
    (part: any) =>
      (part.inlineData?.data && part.inlineData?.mimeType) ||
      (part.inline_data?.data && part.inline_data?.mime_type),
  )

  return {
    imageBase64: imagePart?.inlineData?.data || imagePart?.inline_data?.data || "",
    mimeType: imagePart?.inlineData?.mimeType || imagePart?.inline_data?.mime_type || "image/png",
    details:
      parts
        .filter((part: any) => typeof part.text === "string")
        .map((part: any) => part.text)
        .join("\n")
        .trim() || null,
  }
}

async function resizeWithGemini({
  imageBase64,
  mimeType,
  aspectRatio,
}: {
  imageBase64: string
  mimeType: string
  aspectRatio: string
}) {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key not configured")
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`,
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
                text: "Resize/upscale this exact image only. Preserve the image content, composition, layout, typography, products, colors, mood, tone, and visual design. Do not redesign, crop, add, remove, or change anything except final resolution and canvas aspect ratio.",
              },
              {
                inlineData: {
                  mimeType,
                  data: imageBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio,
            imageSize: DEFAULT_FINAL_IMAGE_SIZE,
          },
        },
      }),
    },
  )

  const rawText = await response.text()
  let payload: any = null

  try {
    payload = rawText ? JSON.parse(rawText) : null
  } catch (error) {
    console.error("[enhance-generate] Failed to parse Gemini resize response:", error, rawText)
    throw new Error("Invalid Gemini resize response")
  }

  if (!response.ok) {
    console.error("[enhance-generate] Gemini resize failed:", payload)
    throw new Error(payload?.error?.message || `Gemini resize failed (${response.status})`)
  }

  const geminiImage = extractGeminiImagePart(payload)
  if (!geminiImage.imageBase64) {
    console.error("[enhance-generate] Gemini resize returned no image:", payload)
    throw new Error("Gemini did not return resized image")
  }

  return geminiImage
}

function buildPreservePrompt(critique: CritiquePayload) {
  const spellCheckGuidance = buildSpellCheckGuidance(critique)

  return [
    "Edit the provided image and keep it very close to the original creative direction.",
    "This is a light-improvement pass, not a full redesign or a new composition.",
    "Preserve the same core subject, product, composition logic, framing, visual intent, and advertising message.",
    "Preserve the original mood, tone, color family, lighting style, category taste, and overall visual world.",
    "Do not change the creative genre. Do not turn a minimal, soft, premium, lifestyle, beauty, clinical, natural, or retail image into sci-fi, cyberpunk, fantasy, game-like 3D, futuristic, neon, cinematic action, or any opposite visual style unless the source image already has that style.",
    `Top strength to preserve: ${critique.top_strength}`,
    `Main issue to fix lightly: ${critique.main_issue}`,
    `What already works: ${critique.what_works.join(" | ")}`,
    `Light fixes to apply: ${critique.priority_fixes.join(" | ")}`,
    `Preserve focus: ${critique.preserve_focus.join(" | ")}`,
    "Make the result cleaner, more polished, more realistic, and more ad-ready.",
    "Preserve all existing text, typography, pricing, product names, badges, promotional labels, logo placement, and graphic overlays from the source image.",
    "If text styling needs cleanup, re-typeset it cleanly while keeping the same meaning, offer, and hierarchy.",
    spellCheckGuidance,
    "Do not make it look like a new campaign route.",
    "The result should feel like the same image, only improved slightly.",
  ].filter(Boolean).join(" ")
}

function buildReimaginePrompt(critique: CritiquePayload) {
  const spellCheckGuidance = buildSpellCheckGuidance(critique)

  return [
    "Edit the provided image into a stronger new design direction while keeping it clearly based on the original source image.",
    "This is a reimagined route, not a completely unrelated new image.",
    "Keep the same core subject, product identity, category cues, essential visual information, and advertising message from the source image.",
    "Keep the same mood, tone, color family, lighting atmosphere, category taste, and brand world from the source image.",
    "Reimagine within the same visual universe. The result may improve composition, hierarchy, styling, lighting quality, and typography, but it must not jump to an unrelated genre or extreme style.",
    "Do not convert the image into sci-fi, cyberpunk, fantasy, game-like 3D, futuristic neon, dark cinematic action, surreal CGI, or any opposite mood/tone unless the source image clearly belongs to that world.",
    "Keep all important text content from the source image, including product names, prices, promotional labels, percentages, CTA-style callouts, and brand marks.",
    "You may redesign the composition, framing, lighting, scene styling, hierarchy, typography layout, and overall art direction, but it must still feel derived from the original image.",
    `Keep the strongest existing quality: ${critique.top_strength}`,
    `Avoid this core weakness: ${critique.main_issue}`,
    `What did not work before: ${critique.what_hurts_performance.join(" | ")}`,
    `Priority improvements: ${critique.priority_fixes.join(" | ")}`,
    `New direction: ${critique.reimagine_brief}`,
    "Make the image commercially clear, visually stronger, and more campaign-worthy.",
    "Typography is important. Rebuild the ad layout so the text feels intentionally designed, readable, persuasive, and integrated with the image.",
    "Do not remove or forget the source image's key product details, prices, or promotional information.",
    spellCheckGuidance,
    "The result should feel like a better advertising idea built from the same original asset, not a random style experiment.",
  ].filter(Boolean).join(" ")
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const imageUrl = typeof body?.image_url === "string" ? body.image_url.trim() : ""
    const userNotes = typeof body?.user_notes === "string" ? body.user_notes.trim() : ""
    const sourceWidth = typeof body?.source_width === "number" ? body.source_width : Number(body?.source_width)
    const sourceHeight = typeof body?.source_height === "number" ? body.source_height : Number(body?.source_height)
    const detectedAspectRatio =
      typeof body?.detected_aspect_ratio === "string" ? body.detected_aspect_ratio.trim() : ""
    const mode = body?.mode === "reimagine" ? "reimagine" : "preserve"
    const critique = body?.critique as CritiquePayload | undefined

    if (!imageUrl) {
      return NextResponse.json({ success: false, error: "image_url is required" }, { status: 400 })
    }

    if (!critique) {
      return NextResponse.json({ success: false, error: "critique is required" }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "OPENAI_API_KEY ไม่ได้ถูกตั้งค่า" }, { status: 500 })
    }

    const basePrompt = mode === "preserve" ? buildPreservePrompt(critique) : buildReimaginePrompt(critique)
    const prompt = userNotes
      ? `${basePrompt} Additional team direction to follow: ${userNotes}`
      : basePrompt
    const expectedAspectRatio =
      isSaneDimensions(sourceWidth, sourceHeight) ? getClosestAspectRatioLabel(sourceWidth, sourceHeight) : detectedAspectRatio || null
    const needsFinalGeminiResize = !!expectedAspectRatio && !OPENAI_EXACT_SIZE_BY_RATIO[expectedAspectRatio]
    const requestedOpenAiSize = expectedAspectRatio
      ? OPENAI_EXACT_SIZE_BY_RATIO[expectedAspectRatio] || getClosestOpenAiSizeForRatio(expectedAspectRatio)
      : "auto"

    if (needsFinalGeminiResize && !GEMINI_API_KEY) {
      return NextResponse.json({ success: false, error: "Gemini API key not configured" }, { status: 500 })
    }

    const endpoint = OPENAI_EDITS_ENDPOINT
    const bodyPayload = {
      model: OPENAI_IMAGE_MODEL,
      images: [{ image_url: imageUrl }],
      prompt,
      size: requestedOpenAiSize,
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(bodyPayload),
    })

    const rawText = await response.text()
    let payload: any = null

    try {
      payload = rawText ? JSON.parse(rawText) : null
    } catch (parseError) {
      console.error("[enhance-generate] Failed to parse OpenAI response:", parseError, rawText)
      return NextResponse.json({ success: false, error: "Invalid OpenAI response" }, { status: 500 })
    }

    if (!response.ok) {
      console.error("[enhance-generate] OpenAI request failed:", payload)
      return NextResponse.json(
        {
          success: false,
          error: payload?.error?.message || `OpenAI image generation failed (${response.status})`,
        },
        { status: response.status },
      )
    }

    const imageBase64 = payload?.data?.[0]?.b64_json
    const outputMimeType = payload?.output_format ? `image/${payload.output_format}` : "image/png"

    if (!imageBase64) {
      console.error("[enhance-generate] No image returned from OpenAI:", payload)
      return NextResponse.json({ success: false, error: "OpenAI did not return an image" }, { status: 500 })
    }

    const resizedImage = needsFinalGeminiResize
      ? await resizeWithGemini({
          imageBase64,
          mimeType: outputMimeType,
          aspectRatio: expectedAspectRatio!,
        })
      : {
          imageBase64,
          mimeType: outputMimeType,
          details: null,
        }

    const finalBuffer = Uint8Array.from(Buffer.from(resizedImage.imageBase64, "base64"))
    const finalDimensions = inferDimensions(finalBuffer, resizedImage.mimeType)
    const finalAspectRatio =
      finalDimensions && isSaneDimensions(finalDimensions.width, finalDimensions.height)
        ? getClosestAspectRatioLabel(finalDimensions.width, finalDimensions.height)
        : null

    if (expectedAspectRatio && finalAspectRatio && finalAspectRatio !== expectedAspectRatio) {
      return NextResponse.json(
        {
          success: false,
          error: `Enhance final resize ratio changed from ${expectedAspectRatio} to ${finalAspectRatio}`,
          requested_aspect_ratio: expectedAspectRatio,
          actual_aspect_ratio: finalAspectRatio,
          output_dimensions: finalDimensions,
          details: resizedImage.details,
        },
        { status: 422 },
      )
    }

    return NextResponse.json({
      success: true,
      mode,
      prompt,
      mime_type: resizedImage.mimeType,
      image_base64: resizedImage.imageBase64,
      image_data_url: `data:${resizedImage.mimeType};base64,${resizedImage.imageBase64}`,
      model: needsFinalGeminiResize ? `${OPENAI_IMAGE_MODEL} -> ${GEMINI_IMAGE_MODEL}` : OPENAI_IMAGE_MODEL,
      output_dimensions: finalDimensions,
      requested_source_aspect_ratio: expectedAspectRatio,
      output_aspect_ratio: finalAspectRatio || expectedAspectRatio,
      requested_openai_size: requestedOpenAiSize,
      final_image_size: needsFinalGeminiResize ? DEFAULT_FINAL_IMAGE_SIZE : null,
    })
  } catch (error) {
    console.error("[enhance-generate] Unexpected error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate enhanced image",
      },
      { status: 500 },
    )
  }
}
