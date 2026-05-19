import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 600

const GEMINI_IMAGE_MODEL = process.env.SEO_BLOG_BANNER_GEMINI_MODEL || process.env.SEO_BLOG_BANNER_IMAGE_MODEL || "gemini-3.1-flash-image-preview"
const GEMINI_IMAGE_SIZE = process.env.SEO_BLOG_BANNER_IMAGE_SIZE || "2K"
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY
const OPENAI_IMAGE_MODEL = process.env.SEO_BLOG_BANNER_OPENAI_MODEL || "gpt-image-2"
const OPENAI_GENERATIONS_ENDPOINT = "https://api.openai.com/v1/images/generations"
const OPENAI_EDITS_ENDPOINT = "https://api.openai.com/v1/images/edits"
const OPENAI_LANDSCAPE_SIZE = "1536x1024"
const OPENBRAND_ENDPOINT = "https://openbrand.sh/api/extract"

type ImageModelProvider = "gemini" | "openai"

type SeoBlogBannerRequest = {
  model_provider?: ImageModelProvider
  website?: string
  facebook_page?: string
  brand_name?: string
  brand_colors?: string
  brand_context?: string
  brand_logo_url?: string
  openbrand_logo_url?: string
  reference_image_url?: string
  insert_image_urls?: string[]
  headline?: string
  sub_headline?: string
  user_brief?: string
}

type OpenBrandLogo = {
  url?: string
  type?: string
  resolution?: {
    width?: number
    height?: number
    aspect_ratio?: number
  }
}

type OpenBrandColor = {
  hex?: string
  usage?: string
}

type OpenBrandAssets = {
  brandName: string
  colors: OpenBrandColor[]
  logos: OpenBrandLogo[]
  selectedLogoUrl: string
}

type FetchedImage = {
  base64: string
  mimeType: string
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

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function getMetaContent(html: string, name: string) {
  const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i")
  return html.match(pattern)?.[1]?.trim() || ""
}

async function fetchWebsiteContext(website: string) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const response = await fetch(website, {
      signal: controller.signal,
      headers: {
        "User-Agent": "CreativeCompassBot/1.0",
      },
    })
    clearTimeout(timeout)

    if (!response.ok) return ""

    const html = await response.text()
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || ""
    const description = getMetaContent(html, "description") || getMetaContent(html, "og:description")
    const siteName = getMetaContent(html, "og:site_name")
    const bodyText = stripHtml(html).slice(0, 1800)

    return [
      siteName ? `Site name: ${siteName}` : "",
      title ? `Page title: ${title}` : "",
      description ? `Meta description: ${description}` : "",
      bodyText ? `Visible website text sample: ${bodyText}` : "",
    ]
      .filter(Boolean)
      .join("\n")
  } catch (error) {
    console.warn("[seo-blog-banner] Could not fetch website context:", error)
    return ""
  }
}

function isRasterImageUrl(url: string) {
  return /\.(png|jpe?g|webp)(?:\?|#|$)/i.test(url)
}

async function fetchImageAsBase64(url: string, fallbackMimeType = "image/png"): Promise<FetchedImage> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Unable to fetch image from URL (${response.status})`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const contentType = response.headers.get("content-type")?.split(";")[0].trim() || fallbackMimeType

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

async function callGeminiImage(parts: Array<Record<string, unknown>>) {
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
            parts,
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: GEMINI_IMAGE_SIZE,
          },
        },
      }),
    },
  )

  const responseText = await response.text()
  let payload: any = null

  try {
    payload = responseText ? JSON.parse(responseText) : null
  } catch (error) {
    console.error("[seo-blog-banner] Failed to parse Gemini response:", error, responseText)
    throw new Error("Invalid Gemini response")
  }

  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gemini request failed (${response.status})`)
  }

  return payload
}

async function callOpenAiImage({
  prompt,
  inputImages,
}: {
  prompt: string
  inputImages: string[]
}) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured")
  }

  const endpoint = inputImages.length > 0 ? OPENAI_EDITS_ENDPOINT : OPENAI_GENERATIONS_ENDPOINT
  const payload: Record<string, unknown> = {
    model: OPENAI_IMAGE_MODEL,
    prompt,
    size: OPENAI_LANDSCAPE_SIZE,
  }

  if (inputImages.length > 0) {
    payload.images = inputImages.map((imageUrl) => ({ image_url: imageUrl }))
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  const rawText = await response.text()
  let openAiPayload: any = null

  try {
    openAiPayload = rawText ? JSON.parse(rawText) : null
  } catch (error) {
    console.error("[seo-blog-banner] Failed to parse OpenAI response:", error, rawText)
    throw new Error("Invalid OpenAI response")
  }

  if (!response.ok) {
    throw new Error(openAiPayload?.error?.message || `OpenAI image generation failed (${response.status})`)
  }

  const imageBase64 = openAiPayload?.data?.[0]?.b64_json
  const mimeType = openAiPayload?.output_format ? `image/${openAiPayload.output_format}` : "image/png"

  if (!imageBase64) {
    console.error("[seo-blog-banner] No image returned from OpenAI:", openAiPayload)
    throw new Error("OpenAI did not return an image")
  }

  return {
    imageBase64,
    mimeType,
  }
}

async function resizeOpenAiMasterWithGemini({
  imageBase64,
  mimeType,
}: {
  imageBase64: string
  mimeType: string
}) {
  const resizePrompt = [
    "Resize and recompose this approved SEO blog banner into the final master format: 1600 x 900 px, 16:9.",
    "Use the provided image as the source of truth.",
    "Do not create a new concept. Do not change the art direction, brand identity, headline, sub-headline, logo, hero visual, color palette, or overall mood.",
    "Only adapt the composition so it becomes a clean 16:9 master banner with safe margins.",
    "Keep all important text, logo, product, face, and visual hook fully visible.",
    "Do not crop away important content.",
    "Do not add new text, fake buttons, badges, icons, prices, phone numbers, watermarks, or promotional copy.",
    "Return one final clean banner image only.",
  ].join("\n")
  const geminiPayload = await callGeminiImage([
    {
      text: resizePrompt,
    },
    {
      inlineData: {
        data: imageBase64,
        mimeType,
      },
    },
  ])
  const images = getGeminiImages(geminiPayload)
  const resizedBase64 = images[0]?.data || ""
  const resizedMimeType = images[0]?.mimeType || "image/png"

  if (!resizedBase64) {
    console.error("[seo-blog-banner] No master resize image returned from Gemini:", geminiPayload)
    throw new Error("Gemini did not return a resized master image")
  }

  return {
    imageBase64: resizedBase64,
    mimeType: resizedMimeType,
  }
}

function selectOpenBrandLogo(logos: OpenBrandLogo[]) {
  const withUrl = logos.filter((logo) => typeof logo.url === "string" && logo.url.trim().length > 0)
  const raster = withUrl.filter((logo) => isRasterImageUrl(logo.url || ""))
  const nonFaviconRaster = raster.find((logo) => logo.type && !/favicon/i.test(logo.type))
  return nonFaviconRaster?.url || raster[0]?.url || withUrl[0]?.url || ""
}

async function fetchOpenBrandAssets(website: string): Promise<OpenBrandAssets | null> {
  const apiKey = process.env.OPENBRAND_API
  if (!apiKey) {
    console.warn("[seo-blog-banner] OPENBRAND_API is not configured")
    return null
  }

  try {
    const response = await fetch(`${OPENBRAND_ENDPOINT}?url=${encodeURIComponent(website)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
    const rawText = await response.text()
    let payload: any = null

    try {
      payload = rawText ? JSON.parse(rawText) : null
    } catch (error) {
      console.warn("[seo-blog-banner] Failed to parse OpenBrand response:", error)
      return null
    }

    if (!response.ok || !payload?.success) {
      console.warn("[seo-blog-banner] OpenBrand request failed:", response.status, payload?.error || payload)
      return null
    }

    const data = payload.data || {}
    const logos = Array.isArray(data.logos) ? data.logos : []
    const colors = Array.isArray(data.colors) ? data.colors : []

    return {
      brandName: typeof data.brandName === "string" ? data.brandName : "",
      colors,
      logos,
      selectedLogoUrl: selectOpenBrandLogo(logos),
    }
  } catch (error) {
    console.warn("[seo-blog-banner] Could not fetch OpenBrand assets:", error)
    return null
  }
}

function buildPrompt({
  website,
  facebookPage,
  brandNameOverride,
  brandColorsOverride,
  brandContextOverride,
  headline,
  subHeadline,
  userBrief,
  websiteContext,
  openBrandAssets,
  hasLogo,
  hasReference,
  insertImageCount,
}: {
  website: string
  facebookPage: string
  brandNameOverride: string
  brandColorsOverride: string
  brandContextOverride: string
  headline: string
  subHeadline: string
  userBrief: string
  websiteContext: string
  openBrandAssets: OpenBrandAssets | null
  hasLogo: boolean
  hasReference: boolean
  insertImageCount: number
}) {
  const brandColors =
    brandColorsOverride ||
    openBrandAssets?.colors
      ?.map((color) => [color.usage, color.hex].filter(Boolean).join(": "))
      .filter(Boolean)
      .join(", ") ||
    ""
  const brandName = brandNameOverride || openBrandAssets?.brandName || ""
  const brandDescription = [brandContextOverride || websiteContext, facebookPage ? `Facebook page: ${facebookPage}` : ""]
    .filter(Boolean)
    .join("\n")
  const topic = [headline, subHeadline, brandDescription].filter(Boolean).join(" / ")

  return [
    "Create one world-class 16:9 SEO blog banner key visual.",
    "The target quality is an absolute 10/10 top-tier commercial advertising banner. It must look highly converting, dynamic, and hyper-professional—similar to top campaigns from premium tech, fashion, or FMCG brands.",
    "",
    "[Brand Context]",
    `Brand: ${brandName || website}`,
    `Website: ${website}`,
    `Article Topic: ${topic || headline}`,
    `Headline: "${headline}"`,
    `Sub-headline: "${subHeadline || ""}"`,
    userBrief ? "[User Brief - Must Follow]" : "",
    userBrief || "",
    "",
    "[Creative Interpretation Rule - MUST FOLLOW FIRST]",
    "Before choosing any object or scene, interpret the exact Headline and Sub-headline. The visual idea must come from the meaning, tension, benefit, audience problem, or metaphor inside the copy.",
    "Do not default to obvious category clichés. For digital marketing, agency, SaaS, business, or analytics topics, do NOT automatically use a laptop, dashboard screen, charts, phone UI, office desk, or generic business people unless the headline/sub-headline or uploaded materials specifically require it.",
    "Choose a main visual hook that makes the article topic understandable and memorable within one second. The hero object can be symbolic, editorial, abstract, human, product-led, material-led, typography-led, or scene-led, but it must be justified by the copy and brand context.",
    "If the topic is strategic, growth, conversion, performance, creative, branding, or decision-making, translate that idea visually instead of showing a generic dashboard.",
    "",
    "[Reference & Material Integration Rule]",
    hasReference
      ? "A reference image is provided. Extract and follow its visual DNA: layout logic, composition, focal point, color mood, graphic treatment, spacing, depth, and typography relationship. Do not merely copy objects from it."
      : "No reference image is provided. Create a fitting visual direction from the headline, sub-headline, website context, brand colors, and user brief.",
    insertImageCount > 0
      ? `There are ${insertImageCount} material image(s). Use them as concrete visual ingredients. Preserve their identity and integrate them naturally with the lighting, color, perspective, shadows, and graphic system so the final banner feels intentionally art-directed, not pasted together.`
      : "No material images are provided. Do not invent specific proprietary products, dashboards, staff, offices, devices, or brand-owned places.",
    "",
    "[The Art Director's Mindset - MUST FOLLOW]",
    "Think like a Master Graphic Designer creating a highly layered, 2.5D spatial composition.",
    "Stop thinking of the canvas as a flat image. You must design with extreme depth utilizing distinct layers:",
    "Layer 1 (Deep Background): Textured or smooth gradient base.",
    "Layer 2 (Midground Shapes): Bold framing elements (e.g., 3D geometric cutouts, fluid blobs, or dynamic swooshes) serving as a stage for the main subject. Add realistic drop shadows to these shapes to make them pop.",
    "Layer 3 (Foreground Subject): The hero product, model, or symbolic object seamlessly integrated.",
    "Layer 4 (Floating Elements): Out-of-focus flying particles, leaves, UI elements, or splashes to break the frame and create extreme depth.",
    "",
    "[Visual Style & Framing Mechanism]",
    "Select ONE of the following highly professional layout styles that best fits the brand context:",
    "The Abstract Cutout (Fashion/Lifestyle): Use fluid, organic blob shapes or paper-cutout layers with crisp drop shadows framing the subject.",
    "The Geometric Color-Block (Modern/Retail): Use massive, sharp triangles, circles, or overlapping diamond grids with solid, high-contrast vibrant colors.",
    "The Tech Flow (Gadgets/Software): Use abstract system flow, data movement, modular structure, or interface-inspired graphic rhythm only when the copy calls for it. Avoid literal laptop/dashboard scenes unless explicitly relevant.",
    "The High-Energy Mixed Media (Sports/Food/Beverage): Combine hyper-realistic photography with hand-drawn scribbles, glowing neon typography, grunge textures, or dynamic splashes.",
    "",
    "[Color Palette & Lighting]",
    `Apply a highly controlled, striking color palette (3-4 colors max) derived from the brand. Brand colors: ${brandColors || "Not detected"}.`,
    "Use extreme contrast (e.g., vibrant warm subject against a deep, rich cool background).",
    "The lighting must perfectly match the vibe: soft studio lighting for fashion, high-contrast rim lighting for sports/tech, or vibrant sunny lighting for food/beverages.",
    "",
    "[Typography & Layout Integration]",
    "Write ONLY the provided Headline and Sub-headline unless the User Brief explicitly asks for additional on-image text.",
    "The Headline and Sub-headline must appear first and must be the only default copy system.",
    "Do not invent or add extra text such as feature bullets, icon labels, benefit rows, trust badges, certification claims, statistics, dates, prices, CTAs, captions, product claims, or service claims.",
    "Do not create rows of icons with explanatory labels unless the user explicitly provides those exact labels and asks to include them.",
    "Treat typography as a core graphic element.",
    "Ensure tight tracking and professional line height.",
    "Create a powerful lockup (e.g., Massive ultra-bold Headline paired with a clean, light tracking Sub-headline).",
    "Use strategic overlapping (e.g., have a small part of the main subject slightly overlap the text or the background shapes to create a 3D interplay).",
    "Leave massive, intentional White Space on either the left or right side of the canvas dedicated specifically for the typographic hierarchy.",
    "",
    hasLogo ? "Use the provided/uploaded/detected logo. Preserve original shape, color, proportions, and spelling. Do not redesign." : "",
    hasReference || insertImageCount > 0
      ? "The final result must look like the reference/materials belong to the same photographed/designed world: matched lighting, perspective, scale, shadows, color grade, texture, and composition."
      : "",
    "",
    "[Negative Constraints]",
    "No flat, boring layouts. No generic centered stock photos. No repeated cliché laptop/dashboard/charts for business or agency topics. No icon rows, no feature label strips, no fake claims, no certification badges, no invented UI text, no messy color vomits. No AI-plastic looking humans. Avoid cheap artificial glows unless it fits a neon aesthetic.",
  ]
    .filter(Boolean)
    .join("\n")
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SeoBlogBannerRequest
    const modelProvider: ImageModelProvider = body.model_provider === "gemini" ? "gemini" : "openai"
    const website = normalizeUrl(body.website)
    const facebookPage = normalizeUrl(body.facebook_page)
    const brandName = typeof body.brand_name === "string" ? body.brand_name.trim() : ""
    const brandColors = typeof body.brand_colors === "string" ? body.brand_colors.trim() : ""
    const brandContext = typeof body.brand_context === "string" ? body.brand_context.trim() : ""
    const brandLogoUrl = normalizeUrl(body.brand_logo_url)
    const openBrandLogoUrl = normalizeUrl(body.openbrand_logo_url)
    const referenceImageUrl = normalizeUrl(body.reference_image_url)
    const insertImageUrls = Array.isArray(body.insert_image_urls)
      ? body.insert_image_urls.map(normalizeUrl).filter(Boolean).slice(0, 4)
      : []
    const headline = typeof body.headline === "string" ? body.headline.trim() : ""
    const subHeadline = typeof body.sub_headline === "string" ? body.sub_headline.trim() : ""
    const userBrief = typeof body.user_brief === "string" ? body.user_brief.trim() : ""

    if (!website) {
      return NextResponse.json({ success: false, error: "website is required" }, { status: 400 })
    }

    if (!headline) {
      return NextResponse.json({ success: false, error: "headline is required" }, { status: 400 })
    }

    if (modelProvider === "gemini" && !GEMINI_API_KEY) {
      return NextResponse.json({ success: false, error: "Gemini API key not configured" }, { status: 500 })
    }

    if (modelProvider === "openai" && !process.env.OPENAI_API_KEY) {
      return NextResponse.json({ success: false, error: "OPENAI_API_KEY is not configured" }, { status: 500 })
    }

    if (modelProvider === "openai" && !GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Gemini API key not configured for GPT Image master resize" },
        { status: 500 },
      )
    }

    const websiteContext = await fetchWebsiteContext(website)
    const openBrandAssets =
      brandName || brandColors || brandContext || openBrandLogoUrl
        ? {
            brandName,
            colors: brandColors
              .split(/[,;\n]+/)
              .map((value) => value.trim())
              .filter(Boolean)
              .map((hex) => ({ hex })),
            logos: openBrandLogoUrl ? [{ url: openBrandLogoUrl }] : [],
            selectedLogoUrl: openBrandLogoUrl,
          }
        : await fetchOpenBrandAssets(website)
    const openBrandLogoAsInput =
      !brandLogoUrl && openBrandAssets?.selectedLogoUrl && isRasterImageUrl(openBrandAssets.selectedLogoUrl)
        ? openBrandAssets.selectedLogoUrl
        : ""
    const effectiveBrandLogoUrl = brandLogoUrl || openBrandLogoAsInput
    const inputImages = [effectiveBrandLogoUrl, referenceImageUrl, ...insertImageUrls].filter(Boolean)
    const prompt = buildPrompt({
      website,
      facebookPage,
      brandNameOverride: brandName,
      brandColorsOverride: brandColors,
      brandContextOverride: brandContext,
      headline,
      subHeadline,
      userBrief,
      websiteContext,
      openBrandAssets,
      hasLogo: Boolean(effectiveBrandLogoUrl),
      hasReference: Boolean(referenceImageUrl),
      insertImageCount: insertImageUrls.length,
    })

    console.log("[seo-blog-banner] Generating master banner", {
      provider: modelProvider,
      model: modelProvider === "openai" ? OPENAI_IMAGE_MODEL : GEMINI_IMAGE_MODEL,
      website,
      hasLogo: Boolean(effectiveBrandLogoUrl),
      hasOpenBrandAssets: Boolean(openBrandAssets),
      detectedBrandName: openBrandAssets?.brandName || "",
      detectedColors: openBrandAssets?.colors?.map((color) => color.hex).filter(Boolean) || [],
      usingOpenBrandLogoAsInput: Boolean(openBrandLogoAsInput),
      hasReference: Boolean(referenceImageUrl),
      insertImageCount: insertImageUrls.length,
      imageConfig: {
        aspectRatio: "16:9",
        imageSize:
          modelProvider === "openai"
            ? `${OPENAI_LANDSCAPE_SIZE} -> ${GEMINI_IMAGE_SIZE} -> 1600x900`
            : GEMINI_IMAGE_SIZE,
      },
    })

    let imageBase64 = ""
    let mimeType = "image/png"

    if (modelProvider === "openai") {
      const openAiImage = await callOpenAiImage({ prompt, inputImages })
      const resizedMaster = await resizeOpenAiMasterWithGemini(openAiImage)
      imageBase64 = resizedMaster.imageBase64
      mimeType = resizedMaster.mimeType
    } else {
      const fetchedInputImages = await Promise.all(inputImages.map((imageUrl) => fetchImageAsBase64(imageUrl)))
      const parts: Array<Record<string, unknown>> = [
        {
          text: prompt,
        },
        ...fetchedInputImages.map((image) => ({
          inlineData: {
            data: image.base64,
            mimeType: image.mimeType,
          },
        })),
      ]
      const geminiPayload = await callGeminiImage(parts)
      const images = getGeminiImages(geminiPayload)
      imageBase64 = images[0]?.data || ""
      mimeType = images[0]?.mimeType || "image/png"

      if (!imageBase64) {
        console.error("[seo-blog-banner] No image returned from Gemini:", geminiPayload)
        return NextResponse.json({ success: false, error: "Gemini did not return an image" }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      image_base64: imageBase64,
      image_data_url: `data:${mimeType};base64,${imageBase64}`,
      mime_type: mimeType,
      provider: modelProvider,
      model: modelProvider === "openai" ? `${OPENAI_IMAGE_MODEL} -> ${GEMINI_IMAGE_MODEL}` : GEMINI_IMAGE_MODEL,
      prompt,
      requested_size: modelProvider === "openai" ? `${OPENAI_LANDSCAPE_SIZE} -> ${GEMINI_IMAGE_SIZE}` : GEMINI_IMAGE_SIZE,
      target_master_size: "1600x900",
      aspect_ratio: "16:9",
      used_input_images: inputImages.length,
      brand_assets: openBrandAssets
        ? {
            brand_name: openBrandAssets.brandName,
            colors: openBrandAssets.colors,
            selected_logo_url: openBrandAssets.selectedLogoUrl,
            used_openbrand_logo_as_input: Boolean(openBrandLogoAsInput),
          }
        : null,
    })
  } catch (error) {
    console.error("[seo-blog-banner] Unexpected error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate SEO blog banner",
      },
      { status: 500 },
    )
  }
}
