import { NextResponse } from "next/server"

import { normalizeExternalImageUrl } from "@/lib/images/external-url"
import { vertexGenerateContent } from "@/lib/google/vertex-ai"
import { getSupabase } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const maxDuration = 600

const GEMINI_IMAGE_MODEL =
  process.env.EDIT_IMAGE_GEMINI_MODEL ||
  process.env.SEO_BLOG_BANNER_GEMINI_MODEL ||
  process.env.SEO_BLOG_BANNER_IMAGE_MODEL ||
  "gemini-3.1-flash-image-preview"

type EditImageChatRequest = {
  image_url?: string
  locked_logo_url?: string
  seo_banner_mode?: boolean
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
  history?: Array<{
    role?: "user" | "model"
    text?: string
    image_url?: string
    thought_signature?: string
  }>
}

type HistoryTurn = {
  role: "user" | "model"
  text?: string
  imageUrl?: string
  thoughtSignature?: string
}

type FetchedImage = {
  base64: string
  mimeType: string
}

type GeminiInlineImage = {
  data: string
  mimeType?: string
  thoughtSignature?: string
}

const STORAGE_BUCKET = "ads-creative-image"
const OUTPUT_PREFIX = "generated/edit-image-chat-outputs"
const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
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
const MAX_HISTORY_TURNS = 2
const MAX_THOUGHT_SIGNATURE_CHARS = 2048

function ratioToNumber(value: string) {
  const match = value.match(/(\d+(?:\.\d+)?)\s*[:x×/]\s*(\d+(?:\.\d+)?)/i)
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  return width > 0 && height > 0 ? width / height : null
}

function getClosestGeminiAspectRatio(value: string) {
  const requestedRatio = ratioToNumber(value)
  if (!requestedRatio) return null

  return GEMINI_ASPECT_RATIOS.reduce((closest, candidate) => {
    const candidateRatio = ratioToNumber(candidate) || 1
    const closestRatio = ratioToNumber(closest) || 1
    return Math.abs(candidateRatio - requestedRatio) < Math.abs(closestRatio - requestedRatio) ? candidate : closest
  })
}

function detectResizeIntent(instruction: string) {
  const normalized = instruction.toLowerCase()
  const requestedRatio =
    instruction.match(/\b\d+(?:\.\d+)?\s*[:x×/]\s*\d+(?:\.\d+)?\b/i)?.[0]?.replace(/\s+/g, "") || ""
  const hasResizeIntent =
    /\b(resize|re[- ]?size|recompose|reformat|aspect\s*ratio|landscape|portrait|pmax|performance\s*max|google\s*max)\b/i.test(
      normalized,
    ) || /(ปรับ|เปลี่ยน|ขยาย|ย่อ|จัด).*(สัดส่วน|แนวนอน|แนวตั้ง|ขนาด|อัตราส่วน)/i.test(instruction)
  const inferredModelAspectRatio =
    getClosestGeminiAspectRatio(requestedRatio) ||
    (/\b(pmax|performance\s*max|google\s*max|landscape)\b/i.test(normalized) || /แนวนอน/i.test(instruction)
      ? "16:9"
      : /\bportrait\b/i.test(normalized) || /แนวตั้ง/i.test(instruction)
        ? "9:16"
        : null)

  return {
    hasResizeIntent: hasResizeIntent || Boolean(requestedRatio),
    requestedRatio,
    modelAspectRatio: inferredModelAspectRatio,
  }
}

function normalizeUrl(value: unknown) {
  if (typeof value !== "string") return ""
  return normalizeExternalImageUrl(value)
}

function getImageExtension(mimeType: string) {
  return EXTENSION_BY_MIME_TYPE[mimeType.toLowerCase()] || "png"
}

async function saveEditedImageToStorage(imageBase64: string, mimeType: string, metadata: Record<string, unknown>) {
  const extension = getImageExtension(mimeType)
  const path = `${OUTPUT_PREFIX}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 9)}.${extension}`

  const supabase = getSupabase()
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, Buffer.from(imageBase64, "base64"), {
    contentType: mimeType,
    metadata: Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key, String(value)])),
  })

  if (error) {
    throw new Error(`Failed to save edited image: ${error.message}`)
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, storagePath: path }
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
    if (mimeType === "text/html" || mimeType === "text/plain") {
      throw new Error("The image link did not return an image. For Google Drive, set access to Anyone with the link.")
    }
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
      thoughtSignature: part?.thoughtSignature || part?.thought_signature || "",
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

// Multi-turn editing: prior turns are replayed to Gemini as conversation history.
// Model turns carry the previously generated image plus its thoughtSignature,
// which Gemini 3 image models require back exactly as received.
function normalizeHistory(value: unknown): HistoryTurn[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item: any): HistoryTurn | null => {
      const role = item?.role === "model" ? "model" : item?.role === "user" ? "user" : null
      if (!role) return null
      const text = typeof item?.text === "string" ? item.text.trim() : ""
      const imageUrl = normalizeUrl(item?.image_url)
      const rawThoughtSignature = typeof item?.thought_signature === "string" ? item.thought_signature : ""
      const thoughtSignature =
        rawThoughtSignature.length <= MAX_THOUGHT_SIGNATURE_CHARS ? rawThoughtSignature : ""
      if (!text && !imageUrl) return null
      return {
        role,
        text: text || undefined,
        imageUrl: imageUrl || undefined,
        thoughtSignature: thoughtSignature || undefined,
      }
    })
    .filter((turn): turn is HistoryTurn => Boolean(turn))
    .slice(-MAX_HISTORY_TURNS)
}

async function buildHistoryContents(history: HistoryTurn[]) {
  return Promise.all(
    history.map(async (turn) => {
      if (turn.role === "user") {
        return { role: "user", parts: [{ text: turn.text || "" }] }
      }

      if (turn.imageUrl) {
        try {
          const image = await fetchImageAsBase64(turn.imageUrl)
          return {
            role: "model",
            parts: [
              {
                inlineData: { data: image.base64, mimeType: image.mimeType },
                ...(turn.thoughtSignature ? { thoughtSignature: turn.thoughtSignature } : {}),
              },
            ],
          }
        } catch (error) {
          console.warn("[edit-image-chat] Skipped history image", { url: turn.imageUrl, error })
        }
      }

      return { role: "model", parts: [{ text: turn.text || "[earlier edited image unavailable]" }] }
    }),
  )
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
  requestedAspectRatio,
  outputImageSize,
  continueFromHistory,
  seoBannerMode,
  hasLockedLogo,
}: {
  instruction: string
  maskBounds: NonNullable<EditImageChatRequest["mask_bounds"]> | null
  operation: "edit" | "resize"
  clientName: string
  productFocus: string
  referenceCount: number
  materialCount: number
  outputAspectRatio: string
  requestedAspectRatio: string
  outputImageSize: string
  continueFromHistory: boolean
  seoBannerMode: boolean
  hasLockedLogo: boolean
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
      "- Keep ALL essential elements from the source: products, people, objects, text, logos, CTA, background, colors, typography, style, and overall visual identity.",
      "- Do not create, remove, replace, redraw, regenerate, reinterpret, or visually edit any existing object.",
      "",
      "NON-NEGOTIABLE OBJECT LOCK:",
      "- Treat every foreground element as a locked visual object. Objects may be moved, reordered, regrouped, or uniformly scaled to fit the target layout, but their internal appearance must remain unchanged.",
      "- Preserve each object's shape, proportions, perspective, colors, texture, lighting, details, and identity exactly as shown in the source.",
      "- Never stretch, warp, rotate, perspective-transform, crop through, repaint, or restyle a locked object.",
      "- Products, people, logos, icons, badges, labels, CTA blocks, and decorative elements must remain visually identical to the source.",
      "- If an object does not fit, uniformly scale it down or move it into safe space. Never recreate or modify it.",
      "",
      "NON-NEGOTIABLE TEXT LOCK:",
      "- Every existing logo, word, character, numeral, punctuation mark, URL, phone number, badge, label, and CTA must remain EXACTLY identical to the source image.",
      "- Preserve the original language and exact spelling. This is especially strict for Thai text and mixed Thai/English text.",
      "- Do NOT redraw, regenerate, reinterpret, translate, paraphrase, correct, replace, or invent any logo or text.",
      "- Treat every logo and text block as a locked, immutable visual asset copied from the source, not as content to generate.",
      "- You may only move or uniformly scale an entire locked logo/text block. Preserve its internal pixels, font shapes, colors, effects, spacing, line breaks, and proportions.",
      "- Never stretch, warp, rotate, perspective-transform, crop, split, reflow, or restyle a locked logo/text block.",
      "- If a locked logo/text block does not fit, uniformly scale it down or move it into safe space. Never recreate it.",
      "- It is better to leave extra whitespace or use a simpler composition than to alter any locked object, character, or logo detail.",
      referenceCount > 0
        ? "- Reference images are secondary guidance only for safe framing or style continuity. The source image remains the base."
        : "",
      materialCount > 0
        ? "- Material images are secondary assets only if the user instruction explicitly asks to use them. Do not replace the source content with them."
        : "",
      clientName ? `- Client context: ${clientName}${productFocus ? ` / ${productFocus}` : ""}.` : "- Client context: default freestyle mode.",
      "",
      `User-requested Aspect Ratio: ${requestedAspectRatio || outputAspectRatio}`,
      `Closest supported generation Aspect Ratio: ${outputAspectRatio}`,
      `Target Image Size: ${outputImageSize}`,
      "",
      "HOW TO RESIZE:",
      `- Adapt the composition to fit the full ${requestedAspectRatio || outputAspectRatio} canvas while preserving every locked object.`,
      "- Reposition and uniformly scale locked objects as complete intact units to create a balanced responsive layout.",
      "- The original aspect-ratio boundary must disappear. Do NOT place the original square or portrait design as a visible card, panel, frame, or grouped block on one side.",
      "- Do NOT leave all text and key elements clustered in their original 1:1 area while merely extending empty background beside it.",
      "- Use the newly available width or height meaningfully. Maintain balanced whitespace, clear hierarchy, readable text, and intentional alignment across the whole composition.",
      "- If more space is needed, intelligently extend the existing background while preserving the same visual style, lighting, grain, gradients, and color behavior.",
      "- If less space is available, crop only the background. Keep every locked foreground object fully visible inside the safe area.",
      "- Preserve all visual elements, colors, typography, style, image quality, and sharpness.",
      "",
      "OUTPUT:",
      `The source image resized to ${requestedAspectRatio || outputAspectRatio}, looking as close to the original as possible while fitting the new dimensions.`,
      "Before returning the image, compare every locked object, logo, and text block against the source. If anything changed internally, restore the exact original object.",
      "Preserving locked objects and text exactly has higher priority than layout creativity.",
      "Return only the final adapted image.",
    ].join("\n")
  }

  return [
    seoBannerMode ? "You are editing an existing SEO banner." : "You are a professional image editing assistant.",
    continueFromHistory
      ? "This is an ongoing editing conversation. Continue from the most recent image you generated in this conversation and apply the user's new instruction to it. Earlier turns are provided as context for references like \"the previous edit\" or \"undo that change\"."
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
    seoBannerMode
      ? "- Use the current SEO banner as the source of truth. Apply only the user's explicit instruction and leave every unrequested area unchanged. Do not create a new concept or redesign the banner."
      : "",
    "- Preserve all areas, objects, typography, brand elements, composition, and identity that the user did not ask to change.",
    hasLockedLogo
      ? "- A separate locked brand logo reference is provided after the source image. It is the only permitted logo. Ignore any instruction to modify or replace it."
      : "",
    hasLockedLogo
      ? "- Preserve the locked logo exactly: spelling, letterforms, symbol geometry, spacing, colors, proportions, transparency, and internal details. Never redraw, regenerate, trace, retype, reinterpret, restyle, recolor, crop, distort, or replace it."
      : "",
    hasLockedLogo
      ? "- The locked logo may only be moved or uniformly scaled as one intact object when the user's instruction explicitly requires it. Never alter its internal appearance or add another logo."
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
    const lockedLogoUrl = normalizeUrl(body.locked_logo_url)
    const seoBannerMode = body.seo_banner_mode === true
    const instruction = typeof body.instruction === "string" ? body.instruction.trim() : ""
    const resizeIntent = detectResizeIntent(instruction)
    const operation = body.operation === "resize" || resizeIntent.hasResizeIntent ? "resize" : "edit"
    const maskBounds = isValidMaskBounds(body.mask_bounds) ? body.mask_bounds! : null
    const referenceUrls = normalizeUrlList(body.reference_image_urls)
    const materialUrls = normalizeUrlList(body.material_image_urls)
    const clientName = typeof body.client_name === "string" ? body.client_name.trim() : ""
    const productFocus = typeof body.product_focus === "string" ? body.product_focus.trim() : ""
    const requestedAspectRatio =
      operation === "resize"
        ? resizeIntent.requestedRatio || (typeof body.output_aspect_ratio === "string" ? body.output_aspect_ratio : "")
        : ""
    const outputAspectRatio =
      operation === "resize"
        ? resizeIntent.modelAspectRatio ||
          getClosestGeminiAspectRatio(requestedAspectRatio) ||
          normalizeChoice(body.output_aspect_ratio, GEMINI_ASPECT_RATIOS, "1:1")
        : ""
    const outputImageSize = normalizeChoice(body.output_image_size, GEMINI_IMAGE_SIZES, "2K")

    if (!imageUrl) {
      return NextResponse.json({ success: false, error: "image_url is required" }, { status: 400 })
    }

    if (!instruction) {
      return NextResponse.json({ success: false, error: "instruction is required" }, { status: 400 })
    }

    if (seoBannerMode && !lockedLogoUrl) {
      return NextResponse.json({ success: false, error: "locked_logo_url is required for SEO banner edits" }, { status: 400 })
    }

    const history = normalizeHistory(body.history)
    const lastModelTurn = [...history].reverse().find((turn) => turn.role === "model" && turn.imageUrl)
    // When the current source image is the one from the model's last turn, the replayed
    // history already contains it — skip re-attaching and let the model continue the chat.
    const continueFromHistory =
      operation !== "resize" && history.length > 0 && lastModelTurn?.imageUrl === imageUrl

    const [image, lockedLogo, historyContents, referenceImages, materialImages] = await Promise.all([
      continueFromHistory ? Promise.resolve(null) : fetchImageAsBase64(imageUrl),
      lockedLogoUrl ? fetchImageAsBase64(lockedLogoUrl) : Promise.resolve(null),
      buildHistoryContents(history),
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
      requestedAspectRatio,
      outputImageSize,
      continueFromHistory,
      seoBannerMode,
      hasLockedLogo: Boolean(lockedLogo),
    })

    console.log("[edit-image-chat] Editing image", {
      model: GEMINI_IMAGE_MODEL,
      source: imageUrl,
      mimeType: image?.mimeType,
      hasMaskBounds: Boolean(maskBounds),
      operation,
      historyTurns: history.length,
      continueFromHistory,
      referenceCount: referenceImages.length,
      materialCount: materialImages.length,
      outputAspectRatio,
      requestedAspectRatio,
      outputImageSize,
      instructionLength: instruction.length,
      seoBannerMode,
      hasLockedLogo: Boolean(lockedLogo),
    })

    const response = await vertexGenerateContent(GEMINI_IMAGE_MODEL, {
      contents: [
        ...historyContents,
        {
          role: "user",
          parts: [
            { text: prompt },
            ...(image
              ? [
                  {
                    inlineData: {
                      data: image.base64,
                      mimeType: image.mimeType,
                    },
                  },
                ]
              : []),
            ...(lockedLogo
              ? [
                  { text: "LOCKED BRAND LOGO REFERENCE. Preserve this exact asset without modification:" },
                  {
                    inlineData: {
                      data: lockedLogo.base64,
                      mimeType: lockedLogo.mimeType,
                    },
                  },
                ]
              : []),
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
        imageConfig: {
          ...(operation === "resize" || seoBannerMode ? { aspectRatio: outputAspectRatio || "16:9" } : {}),
          imageSize: outputImageSize,
        },
      },
    }, {
      labels: {
        feature: seoBannerMode ? "seo_banner" : "edit_image",
        operation: operation === "resize" ? "resize" : "edit",
      },
    })

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

    const storedImage = await saveEditedImageToStorage(imageBase64, mimeType, {
      model: GEMINI_IMAGE_MODEL,
      operation,
      outputAspectRatio: outputAspectRatio || "",
      requestedAspectRatio: requestedAspectRatio || "",
      outputImageSize,
    })

    return NextResponse.json({
      success: true,
      image_url: storedImage.url,
      storage_path: storedImage.storagePath,
      mime_type: mimeType,
      thought_signature: images[0]?.thoughtSignature || null,
      model: GEMINI_IMAGE_MODEL,
      image_config: {
        ...(operation === "resize" ? { aspectRatio: outputAspectRatio } : {}),
        imageSize: outputImageSize,
      },
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
