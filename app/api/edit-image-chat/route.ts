import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 600

const GEMINI_IMAGE_MODEL =
  process.env.EDIT_IMAGE_GEMINI_MODEL ||
  process.env.SEO_BLOG_BANNER_GEMINI_MODEL ||
  process.env.SEO_BLOG_BANNER_IMAGE_MODEL ||
  "gemini-3.1-flash-image-preview"
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY

type EditImageChatRequest = {
  image_url?: string
  instruction?: string
  operation?: "edit" | "resize"
  mask_bounds?: {
    left: number
    top: number
    right: number
    bottom: number
  } | null
  reference_image_urls?: string[]
  material_image_urls?: string[]
  client_name?: string
  product_focus?: string | null
  output_aspect_ratio?: string
  output_image_size?: string
}

type FetchedImage = {
  base64: string
  mimeType: string
}

type GeminiInlineImage = {
  data: string
  mimeType?: string
}

const GEMINI_ASPECT_RATIOS = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
] as const

const GEMINI_IMAGE_SIZES = ["1K", "2K", "4K"] as const

function normalizeUrl(value: unknown) {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

async function fetchImageAsBase64(url: string): Promise<FetchedImage> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`Unable to fetch image (${response.status})`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const mimeType = response.headers.get("content-type")?.split(";")[0].trim() || "image/png"
    return {
      base64: Buffer.from(arrayBuffer).toString("base64"),
      mimeType,
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Timeout while downloading ${url}`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
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

function isValidMaskBounds(bounds: EditImageChatRequest["mask_bounds"]) {
  return (
    Boolean(bounds) &&
    typeof bounds?.left === "number" &&
    typeof bounds?.top === "number" &&
    typeof bounds?.right === "number" &&
    typeof bounds?.bottom === "number" &&
    bounds.left >= 0 &&
    bounds.top >= 0 &&
    bounds.right <= 1 &&
    bounds.bottom <= 1 &&
    bounds.right > bounds.left &&
    bounds.bottom > bounds.top
  )
}

function normalizeChoice<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T[number]) : fallback
}

function normalizeUrlList(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => normalizeUrl(item)).filter(Boolean).slice(0, 6)
}

async function fetchOptionalImages(urls: string[]) {
  const results = await Promise.allSettled(urls.map((url) => fetchImageAsBase64(url)))
  return results.flatMap((result, index) => {
    if (result.status === "fulfilled") return [result.value]
    console.warn("[edit-image-chat] Skipped auxiliary image", { url: urls[index], error: result.reason })
    return []
  })
}

function buildEditPrompt({
  instruction,
  maskBounds,
  operation,
  clientName,
  productFocus,
  referenceCount,
  materialCount,
  outputAspectRatio,
  outputImageSize,
}: {
  instruction: string
  maskBounds: NonNullable<EditImageChatRequest["mask_bounds"]> | null
  operation: "edit" | "resize"
  clientName: string
  productFocus: string
  referenceCount: number
  materialCount: number
  outputAspectRatio: string
  outputImageSize: string
}) {
  if (operation === "resize") {
    const userInstruction = instruction || "N/A"

    return [
      "TASK: Resize Image for Performance Max and adaptation. Do not edit objects.",
      "",
      `User Instruction: "${userInstruction}"`,
      '- If NOT "N/A", follow this instruction first while keeping the original image intact.',
      "",
      "CRITICAL RULES:",
      "- Use ONLY the source image provided above as your base.",
      "- This is a RESIZE / ADAPTATION task, NOT a new image creation task.",
      "- Do not create a new concept, new background style, new product, new logo, new text, or new layout system.",
      "- Keep all essential elements from the source: products, people, text, logos, background style, colors, typography, and overall visual identity.",
      "- Preserve every readable text element and logo as accurately as possible.",
      referenceCount > 0
        ? "- Reference images are secondary guidance only for safe framing or style continuity. The source image remains the base."
        : "",
      materialCount > 0
        ? "- Material images are secondary assets only if the user instruction explicitly asks to use them. Do not replace the source content with them."
        : "",
      clientName ? `- Client context: ${clientName}${productFocus ? ` / ${productFocus}` : ""}.` : "- Client context: default freestyle mode.",
      "",
      `Target Aspect Ratio: ${outputAspectRatio}`,
      `Target Image Size: ${outputImageSize}`,
      "",
      "HOW TO RESIZE:",
      `- Adapt the composition to fit ${outputAspectRatio}.`,
      "- If more space is needed, intelligently extend the existing background while preserving the same visual style, lighting, grain, gradients, and color behavior.",
      "- If less space is available, crop smartly while keeping the main subject, important text, logos, product, and CTA-safe visual hierarchy inside the safe area.",
      "- Reposition elements only when necessary for the new format, but keep the design looking as close to the original as possible.",
      "- Maintain image quality, sharpness, realistic shadows, and natural edges.",
      "- Avoid stretching, warping, squashing, or distorting any person, product, logo, or typography.",
      "",
      "OUTPUT:",
      `The source image resized/adapted to ${outputAspectRatio}, looking as close to the original as possible while fitting the new dimensions.`,
      "Return only the final adapted image.",
    ].join("\n")
  }

  return [
    "You are a professional image editing assistant.",
    operation === "resize"
      ? "Resize and recompose the provided image to the requested output format."
      : "Edit the provided image according to the user's instruction.",
    `Requested output: aspect ratio ${outputAspectRatio}, image size ${outputImageSize}.`,
    clientName ? `Client context: ${clientName}${productFocus ? ` / ${productFocus}` : ""}.` : "Client context: default freestyle mode.",
    referenceCount > 0
      ? "Reference images are provided after the source image. Use them as style, composition, mood, and visual DNA guidance. Do not copy random objects unless the user asks."
      : "",
    materialCount > 0
      ? "Material images are provided after references. Preserve their identity if the instruction asks to use them, and integrate them with matching light, perspective, texture, and scale."
      : "",
    maskBounds
      ? [
          "The user painted an edit area in the UI, but that paint is NOT part of the image.",
          "Use this semantic mask area only as location guidance.",
          `Approximate edit region in normalized image coordinates: left=${maskBounds.left.toFixed(3)}, top=${maskBounds.top.toFixed(3)}, right=${maskBounds.right.toFixed(3)}, bottom=${maskBounds.bottom.toFixed(3)}.`,
          "Edit only inside this approximate region. Do not draw or reproduce any brush marks, strokes, mask colors, outlines, boxes, or highlighted overlays.",
        ].join(" ")
      : "",
    "",
    "Core rules:",
    "- Preserve all areas, objects, typography, brand elements, composition, and identity that the user did not ask to change.",
    operation === "resize"
      ? "- Resize rule is strict: keep the same image content and design intent. Do not crop important content. Extend or recompose background naturally when the aspect ratio changes."
      : "",
    maskBounds
      ? "- Semantic mask rule is strict: use the coordinate region only to locate the edit area. Preserve everything outside that region as close to unchanged as possible."
      : "",
    "- Make the edit look natural, coherent, and production-ready.",
    "- Match lighting, shadows, perspective, texture, color grading, and scale with the original image.",
    "- Do not add extra text, icons, logos, badges, buttons, watermarks, or UI unless explicitly requested.",
    "- If the instruction is broad, make the smallest high-quality edit that satisfies it without redesigning the whole image.",
    "- Return only the edited image.",
    "",
    `User instruction: ${instruction}`,
  ].join("\n")
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EditImageChatRequest
    const imageUrl = normalizeUrl(body.image_url)
    const instruction = typeof body.instruction === "string" ? body.instruction.trim() : ""
    const operation = body.operation === "resize" ? "resize" : "edit"
    const maskBounds = isValidMaskBounds(body.mask_bounds) ? body.mask_bounds : null
    const referenceUrls = normalizeUrlList(body.reference_image_urls)
    const materialUrls = normalizeUrlList(body.material_image_urls)
    const clientName = typeof body.client_name === "string" ? body.client_name.trim() : ""
    const productFocus = typeof body.product_focus === "string" ? body.product_focus.trim() : ""
    const outputAspectRatio = operation === "resize" ? normalizeChoice(body.output_aspect_ratio, GEMINI_ASPECT_RATIOS, "1:1") : ""
    const outputImageSize = operation === "resize" ? normalizeChoice(body.output_image_size, GEMINI_IMAGE_SIZES, "1K") : ""

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ success: false, error: "Gemini API key not configured" }, { status: 500 })
    }

    if (!imageUrl) {
      return NextResponse.json({ success: false, error: "image_url is required" }, { status: 400 })
    }

    if (!instruction) {
      return NextResponse.json({ success: false, error: "instruction is required" }, { status: 400 })
    }

    const image = await fetchImageAsBase64(imageUrl)
    const [referenceImages, materialImages] = await Promise.all([
      fetchOptionalImages(referenceUrls),
      fetchOptionalImages(materialUrls),
    ])
    const prompt = buildEditPrompt({
      instruction,
      maskBounds,
      operation,
      clientName,
      productFocus,
      referenceCount: referenceImages.length,
      materialCount: materialImages.length,
      outputAspectRatio,
      outputImageSize,
    })

    console.log("[edit-image-chat] Editing image", {
      model: GEMINI_IMAGE_MODEL,
      source: imageUrl,
      mimeType: image.mimeType,
      hasMaskBounds: Boolean(maskBounds),
      operation,
      referenceCount: referenceImages.length,
      materialCount: materialImages.length,
      outputAspectRatio,
      outputImageSize,
      instructionLength: instruction.length,
    })

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
                { text: prompt },
                {
                  inlineData: {
                    data: image.base64,
                    mimeType: image.mimeType,
                  },
                },
                ...(referenceImages.length > 0
                  ? [
                      { text: "Reference images for style, layout, mood, and visual DNA:" },
                      ...referenceImages.map((referenceImage) => ({
                        inlineData: {
                          data: referenceImage.base64,
                          mimeType: referenceImage.mimeType,
                        },
                      })),
                    ]
                  : []),
                ...(materialImages.length > 0
                  ? [
                      { text: "Material images to optionally integrate when requested:" },
                      ...materialImages.map((materialImage) => ({
                        inlineData: {
                          data: materialImage.base64,
                          mimeType: materialImage.mimeType,
                        },
                      })),
                    ]
                  : []),
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
            ...(operation === "resize"
              ? {
                  imageConfig: {
                    aspectRatio: outputAspectRatio,
                    imageSize: outputImageSize,
                  },
                }
              : {}),
          },
        }),
      },
    )

    const rawText = await response.text()
    let payload: any = null

    try {
      payload = rawText ? JSON.parse(rawText) : null
    } catch (error) {
      console.error("[edit-image-chat] Failed to parse Gemini response:", error, rawText)
      throw new Error("Invalid Gemini response")
    }

    if (!response.ok) {
      throw new Error(payload?.error?.message || `Gemini edit request failed (${response.status})`)
    }

    const images = getGeminiImages(payload)
    const imageBase64 = images[0]?.data || ""
    const mimeType = images[0]?.mimeType || "image/png"

    if (!imageBase64) {
      console.error("[edit-image-chat] No image returned from Gemini:", payload)
      return NextResponse.json({ success: false, error: "Gemini did not return an image" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      image_base64: imageBase64,
      image_data_url: `data:${mimeType};base64,${imageBase64}`,
      mime_type: mimeType,
      model: GEMINI_IMAGE_MODEL,
      image_config:
        operation === "resize"
          ? {
              aspectRatio: outputAspectRatio,
              imageSize: outputImageSize,
            }
          : null,
      prompt,
    })
  } catch (error) {
    console.error("[edit-image-chat] Unexpected error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to edit image",
      },
      { status: 500 },
    )
  }
}
