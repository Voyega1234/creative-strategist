import { NextResponse } from "next/server"

import { vertexGenerateContent } from "@/lib/google/vertex-ai"

export const dynamic = "force-dynamic"
export const maxDuration = 600

const GEMINI_IMAGE_MODEL =
  process.env.SEO_BLOG_BANNER_RESIZE_MODEL ||
  process.env.SEO_BLOG_BANNER_GEMINI_MODEL ||
  process.env.SEO_BLOG_BANNER_IMAGE_MODEL ||
  "gemini-3.1-flash-image-preview"
const GEMINI_IMAGE_SIZE = process.env.SEO_BLOG_BANNER_RESIZE_IMAGE_SIZE || "2K"

const TARGET_SIZES = {
  blog_card: {
    label: "Blog Card / Thumbnail",
    width: 800,
    height: 450,
    aspectRatio: "16:9",
  },
  featured_blog: {
    label: "Featured Blog Image",
    width: 1200,
    height: 675,
    aspectRatio: "16:9",
  },
  social_share: {
    label: "Social Share (OG)",
    width: 1200,
    height: 630,
    aspectRatio: "16:9",
  },
} as const

type TargetSizeKey = keyof typeof TARGET_SIZES

type ResizeRequest = {
  image_url?: string
  image_data_url?: string
  locked_logo_url?: string
  target_size?: TargetSizeKey
}

type GeminiInlineImage = {
  data: string
  mimeType?: string
}

function normalizeUrl(value: unknown) {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null

  return {
    mimeType: match[1] || "image/png",
    base64: match[2] || "",
  }
}

async function fetchImageAsBase64(url: string) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Unable to fetch master image (${response.status})`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const contentType = response.headers.get("content-type")?.split(";")[0].trim() || "image/png"

  return {
    base64: Buffer.from(arrayBuffer).toString("base64"),
    mimeType: contentType,
  }
}

function getGeminiImages(payload: any): GeminiInlineImage[] {
  const parts = payload?.candidates?.flatMap((candidate: any) => candidate?.content?.parts || []) || []

  return parts
    .map((part: any) => ({
      data: part?.inlineData?.data || part?.inline_data?.data || "",
      mimeType: part?.inlineData?.mimeType || part?.inline_data?.mime_type || "image/png",
    }))
    .filter((part: GeminiInlineImage) => Boolean(part.data))
}

function buildResizePrompt(target: (typeof TARGET_SIZES)[TargetSizeKey]) {
  return [
    `Create one resized derivative of the approved SEO blog banner for: ${target.label}.`,
    `Final target export size: ${target.width} x ${target.height} px.`,
    "",
    "Use the provided master banner as the source of truth.",
    "The second provided image is the locked brand logo and is the only permitted logo.",
    "Keep that logo visually identical. Never redraw, regenerate, restyle, recolor, retype, crop, distort, or replace it.",
    "Preserve its exact spelling, letterforms, symbol geometry, spacing, colors, proportions, transparency, and internal details.",
    "Do not create a new concept. Do not redesign the brand system.",
    "Preserve the same headline, sub-headline, logo, brand identity, art direction, color palette, hero visual, and overall mood.",
    "Recompose only as needed so the banner works naturally for the target size.",
    "Keep every important visual element and all text inside safe margins.",
    "Do not crop away important text, logo, product, face, or key visual hook.",
    "Write no new text. Add no fake buttons, badges, icons, prices, phone numbers, or promotional copy.",
    "Return only one final clean banner image.",
  ].join("\n")
}

async function callGeminiResize({
  prompt,
  image,
  lockedLogo,
  aspectRatio,
}: {
  prompt: string
  image: { base64: string; mimeType: string }
  lockedLogo: { base64: string; mimeType: string }
  aspectRatio: string
}) {
  const response = await vertexGenerateContent(GEMINI_IMAGE_MODEL, {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: image.base64,
              mimeType: image.mimeType,
            },
          },
          { text: "LOCKED BRAND LOGO REFERENCE. Preserve this exact asset without modification:" },
          {
            inlineData: {
              data: lockedLogo.base64,
              mimeType: lockedLogo.mimeType,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio,
        imageSize: GEMINI_IMAGE_SIZE,
      },
    },
  }, {
    labels: { feature: "seo_banner", operation: "resize" },
  })

  const responseText = await response.text()
  let payload: any = null

  try {
    payload = responseText ? JSON.parse(responseText) : null
  } catch (error) {
    console.error("[seo-blog-banner-resize] Failed to parse Gemini response:", error, responseText)
    throw new Error("Invalid Gemini response")
  }

  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gemini resize request failed (${response.status})`)
  }

  return payload
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ResizeRequest
    const targetSizeKey = body.target_size && body.target_size in TARGET_SIZES ? body.target_size : "blog_card"
    const target = TARGET_SIZES[targetSizeKey]
    const imageUrl = normalizeUrl(body.image_url)
    const lockedLogoUrl = normalizeUrl(body.locked_logo_url)
    const imageDataUrl = typeof body.image_data_url === "string" ? body.image_data_url.trim() : ""

    if (!imageUrl && !imageDataUrl) {
      return NextResponse.json({ success: false, error: "master image is required" }, { status: 400 })
    }

    if (!lockedLogoUrl) {
      return NextResponse.json({ success: false, error: "locked_logo_url is required" }, { status: 400 })
    }

    const parsedDataUrl = imageDataUrl ? parseDataUrl(imageDataUrl) : null
    const [sourceImage, lockedLogo] = await Promise.all([
      parsedDataUrl ? Promise.resolve(parsedDataUrl) : fetchImageAsBase64(imageUrl),
      fetchImageAsBase64(lockedLogoUrl),
    ])
    const prompt = buildResizePrompt(target)

    console.log("[seo-blog-banner-resize] Resizing approved master", {
      model: GEMINI_IMAGE_MODEL,
      targetSize: targetSizeKey,
      targetDimensions: `${target.width}x${target.height}`,
      imageConfig: {
        aspectRatio: target.aspectRatio,
        imageSize: GEMINI_IMAGE_SIZE,
      },
      source: imageUrl ? "url" : "data-url",
    })

    const geminiPayload = await callGeminiResize({
      prompt,
      image: sourceImage,
      lockedLogo,
      aspectRatio: target.aspectRatio,
    })
    const images = getGeminiImages(geminiPayload)
    const imageBase64 = images[0]?.data || ""
    const mimeType = images[0]?.mimeType || "image/png"

    if (!imageBase64) {
      console.error("[seo-blog-banner-resize] No image returned from Gemini:", geminiPayload)
      return NextResponse.json({ success: false, error: "Gemini did not return an image" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      image_base64: imageBase64,
      image_data_url: `data:${mimeType};base64,${imageBase64}`,
      mime_type: mimeType,
      model: GEMINI_IMAGE_MODEL,
      requested_size: GEMINI_IMAGE_SIZE,
      target_size: targetSizeKey,
      target_label: target.label,
      target_width: target.width,
      target_height: target.height,
      aspect_ratio: target.aspectRatio,
      prompt,
    })
  } catch (error) {
    console.error("[seo-blog-banner-resize] Unexpected error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to resize SEO blog banner",
      },
      { status: 500 },
    )
  }
}
