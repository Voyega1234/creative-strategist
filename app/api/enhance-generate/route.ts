import { NextResponse } from "next/server"

import { OPENROUTER_IMAGE_MODEL, openRouterGenerateImage } from "@/lib/openrouter"

export const dynamic = "force-dynamic"
export const maxDuration = 600

const DEFAULT_FINAL_IMAGE_SIZE = "4K"

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

function buildReferenceGuidance(mode: EnhanceMode) {
  const modeGuidance =
    mode === "preserve"
      ? "For this preserve pass, keep the source composition and identity authoritative. Apply only compatible visual finish cues from the reference."
      : "For this reimagine pass, you may translate the reference's visual principles into a new composition, but the source image's subject, product identity, message, and required content remain authoritative."

  return [
    "Two images are provided in this order: IMAGE 1 is the source image to enhance. IMAGE 2 is an optional visual reference.",
    "Use IMAGE 2 only as advisory visual direction for mood, lighting quality, color treatment, material finish, composition rhythm, depth, and overall craft level.",
    modeGuidance,
    "Do not replace the source subject with the reference subject. Do not copy or import products, people, faces, logos, brand marks, text, claims, prices, props, or distinctive objects from the reference.",
    "Do not blend the two images literally. Extract visual principles from the reference and apply them selectively where they improve IMAGE 1.",
    "If the reference conflicts with the source image, the source image and the user's requested edit always win.",
  ].join(" ")
}

function buildPreservePrompt(critique: CritiquePayload, hasReference: boolean) {
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
    hasReference ? buildReferenceGuidance("preserve") : "",
    "Do not make it look like a new campaign route.",
    "The result should feel like the same image, only improved slightly.",
  ].filter(Boolean).join(" ")
}

function buildReimaginePrompt(critique: CritiquePayload, hasReference: boolean) {
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
    hasReference ? buildReferenceGuidance("reimagine") : "",
    "The result should feel like a better advertising idea built from the same original asset, not a random style experiment.",
  ].filter(Boolean).join(" ")
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const imageUrl = typeof body?.image_url === "string" ? body.image_url.trim() : ""
    const referenceImageUrl =
      typeof body?.reference_image_url === "string" ? body.reference_image_url.trim() : ""
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

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ success: false, error: "OPENROUTER_API_KEY ไม่ได้ถูกตั้งค่า" }, { status: 500 })
    }

    const basePrompt =
      mode === "preserve"
        ? buildPreservePrompt(critique, Boolean(referenceImageUrl))
        : buildReimaginePrompt(critique, Boolean(referenceImageUrl))
    const prompt = userNotes
      ? `${basePrompt} Additional team direction to follow: ${userNotes}`
      : basePrompt
    let expectedAspectRatio =
      isSaneDimensions(sourceWidth, sourceHeight) ? getClosestAspectRatioLabel(sourceWidth, sourceHeight) : detectedAspectRatio || null
    if (expectedAspectRatio === "4:5") expectedAspectRatio = "3:4"
    const response = await openRouterGenerateImage({
      prompt,
      inputReferences: [imageUrl, ...(referenceImageUrl ? [referenceImageUrl] : [])],
      resolution: DEFAULT_FINAL_IMAGE_SIZE,
      aspectRatio: expectedAspectRatio || undefined,
    })

    const rawText = await response.text()
    let payload: any = null

    try {
      payload = rawText ? JSON.parse(rawText) : null
    } catch (parseError) {
      console.error("[enhance-generate] Failed to parse OpenRouter response:", parseError, rawText)
      return NextResponse.json({ success: false, error: "Invalid OpenRouter response" }, { status: 500 })
    }

    if (!response.ok) {
      console.error("[enhance-generate] OpenRouter request failed:", payload)
      return NextResponse.json(
        {
          success: false,
          error: payload?.error?.message || `OpenRouter image generation failed (${response.status})`,
        },
        { status: response.status },
      )
    }

    const imageBase64 = payload?.data?.[0]?.b64_json
    const outputMimeType = payload?.data?.[0]?.media_type || (payload?.output_format ? `image/${payload.output_format}` : "image/png")

    if (!imageBase64) {
      console.error("[enhance-generate] No image returned from OpenRouter:", payload)
      return NextResponse.json({ success: false, error: "OpenRouter did not return an image" }, { status: 500 })
    }

    const resizedImage = { imageBase64, mimeType: outputMimeType, details: null }

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
      model: OPENROUTER_IMAGE_MODEL,
      output_dimensions: finalDimensions,
      requested_source_aspect_ratio: expectedAspectRatio,
      output_aspect_ratio: finalAspectRatio || expectedAspectRatio,
      requested_openrouter_size: DEFAULT_FINAL_IMAGE_SIZE,
      final_image_size: DEFAULT_FINAL_IMAGE_SIZE,
      reference_used: Boolean(referenceImageUrl),
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
