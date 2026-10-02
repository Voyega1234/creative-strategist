import { NextResponse } from "next/server"

import { OPENROUTER_IMAGE_MODEL, openRouterGenerateContent, openRouterGenerateImage } from "@/lib/openrouter"
import { getSupabase } from "@/lib/supabase/server"
import { invalidateCache } from "@/lib/utils/server-cache"

export const dynamic = "force-dynamic"
export const maxDuration = 600

const GEMINI_IMAGE_MODEL = OPENROUTER_IMAGE_MODEL
const GEMINI_IMAGE_SIZE = process.env.SEO_BLOG_BANNER_IMAGE_SIZE || "2K"
const OPENBRAND_ENDPOINT = "https://openbrand.sh/api/extract"

type ImageModelProvider = "gemini" | "openai"

type SeoBlogBannerRequest = {
  model_provider?: ImageModelProvider
  client_id?: string
  website?: string
  brand_name?: string
  brand_colors?: string
  color_palette?: string[]
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

function isLikelyFaviconLogo(logo: OpenBrandLogo) {
  const url = logo.url || ""
  const width = logo.resolution?.width || 0
  const height = logo.resolution?.height || 0
  return /favicon|apple-touch-icon|cropped-favicon/i.test(`${logo.type || ""} ${url}`) || (width > 0 && height > 0 && width <= 180 && height <= 180)
}

function isLikelyFaviconUrl(url: string) {
  return /favicon|apple-touch-icon|cropped-favicon/i.test(url)
}

async function fetchImageAsBase64(url: string, fallbackMimeType = "image/png"): Promise<FetchedImage> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)

  try {
    const response = await fetch(url, { signal: controller.signal })

    if (!response.ok) {
      throw new Error(`Unable to fetch image from URL (${response.status})`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const contentType = response.headers.get("content-type")?.split(";")[0].trim() || fallbackMimeType

    return {
      base64: Buffer.from(arrayBuffer).toString("base64"),
      mimeType: contentType,
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

async function fetchInputImagesAsBase64(urls: string[]) {
  const results = await Promise.allSettled(urls.map((imageUrl) => fetchImageAsBase64(imageUrl)))
  return results.flatMap((result, index) => {
    if (result.status === "fulfilled") return [result.value]
    console.warn("[seo-blog-banner] Skipping unavailable input image:", urls[index], result.reason)
    return []
  })
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
  const response = await openRouterGenerateContent(GEMINI_IMAGE_MODEL, {
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
  }, {
    labels: { feature: "seo_banner", operation: "generate" },
  })

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

async function callOpenRouterImage({
  prompt,
  inputImages,
}: {
  prompt: string
  inputImages: string[]
}) {
  const response = await openRouterGenerateImage({
    prompt,
    inputReferences: inputImages,
    resolution: GEMINI_IMAGE_SIZE,
    aspectRatio: "16:9",
  })

  const rawText = await response.text()
  let openAiPayload: any = null

  try {
    openAiPayload = rawText ? JSON.parse(rawText) : null
  } catch (error) {
    console.error("[seo-blog-banner] Failed to parse OpenRouter response:", error, rawText)
    throw new Error("Invalid OpenRouter response")
  }

  if (!response.ok) {
    throw new Error(openAiPayload?.error?.message || `OpenRouter image generation failed (${response.status})`)
  }

  const imageBase64 = openAiPayload?.data?.[0]?.b64_json
  const mimeType =
    openAiPayload?.data?.[0]?.media_type ||
    (openAiPayload?.output_format ? `image/${openAiPayload.output_format}` : "image/png")

  if (!imageBase64) {
    console.error("[seo-blog-banner] No image returned from OpenRouter:", openAiPayload)
    throw new Error("OpenRouter did not return an image")
  }

  return {
    imageBase64,
    mimeType,
  }
}

function selectOpenBrandLogo(logos: OpenBrandLogo[]) {
  const withUrl = logos.filter((logo) => {
    if (typeof logo.url !== "string" || logo.url.trim().length === 0) return false
    return !/^data:image\/svg\+xml,[^#?]*%3Csvg[^#?]*%3E%3C\/svg%3E$/i.test(logo.url)
  })
  const nonFavicon = withUrl.filter((logo) => !isLikelyFaviconLogo(logo))
  const raster = withUrl
    .filter((logo) => isRasterImageUrl(logo.url || ""))
    .sort((a, b) => ((b.resolution?.width || 0) * (b.resolution?.height || 0)) - ((a.resolution?.width || 0) * (a.resolution?.height || 0)))
  const nonFaviconRaster = nonFavicon.find((logo) => isRasterImageUrl(logo.url || ""))
  const likelyLogo = nonFavicon.find((logo) => /logo|brandmark|wordmark/i.test(`${logo.type || ""} ${logo.url || ""}`))
  return nonFaviconRaster?.url || likelyLogo?.url || raster[0]?.url || nonFavicon[0]?.url || withUrl[0]?.url || ""
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
  const brandDescription = brandContextOverride || websiteContext
  const topic = (hasReference ? [headline, subHeadline] : [headline, subHeadline, brandDescription])
    .filter(Boolean)
    .join(" / ")

  return [
    "Create one polished 16:9 SEO blog banner key visual.",
    hasReference
      ? "The first input image is the layout and visual-style reference, not just mood inspiration. Adapt it into a new banner rather than inventing a different composition."
      : "Create a clear, distinctive editorial composition appropriate to the article and brand.",
    "",
    "[Brand Context]",
    `Brand: ${brandName || website}`,
    `Website: ${website}`,
    `Article Topic: ${topic || headline}`,
    `Headline: "${headline}"`,
    `Sub-headline: "${subHeadline || ""}"`,
    userBrief ? "[User Brief - Must Follow]" : "",
    userBrief || "",
    "Follow the user's brief for text placement, composition, and exclusions. If a reference layout or default design suggestion conflicts with the brief, change the layout to satisfy the brief while retaining the reference's mood and tone.",
    "",
    "[Creative Interpretation Rule]",
    "Before choosing any object or scene, interpret the exact Headline and Sub-headline. The visual idea must come from the meaning, tension, benefit, audience problem, or metaphor inside the copy.",
    "Do not default to obvious category clichés. For digital marketing, agency, SaaS, business, or analytics topics, do NOT automatically use a laptop, dashboard screen, charts, phone UI, office desk, or generic business people unless the headline/sub-headline or uploaded materials specifically require it.",
    hasReference
      ? "Let the reference determine whether typography or imagery is the focal point. Do not introduce a large hero object when the reference is primarily typographic."
      : "Choose a main visual hook that makes the article topic understandable and memorable within one second. The hero object can be symbolic, editorial, abstract, human, product-led, material-led, typography-led, or scene-led, but it must be justified by the copy and brand context.",
    "If the topic is strategic, growth, conversion, performance, creative, branding, or decision-making, translate that idea visually instead of showing a generic dashboard.",
    "",
    "[Reference & Material Integration Rule]",
    hasReference
      ? "Match the reference's macro layout: text-block position and width, type hierarchy, margins, negative space, placement and scale of supporting visuals, background treatment, color proportions, and degree of depth. When adapting to 16:9, extend quiet background areas rather than moving the main text or enlarging supporting visuals. If the brief explicitly changes one of these relationships, follow the brief and keep the rest close to the reference. Replace the reference's words with the supplied copy; do not copy its logos or branded icons."
      : "No reference image is provided. Create a fitting visual direction from the headline, sub-headline, website context, brand colors, and user brief.",
    insertImageCount > 0
      ? `There are ${insertImageCount} material image(s). Use them as concrete visual ingredients. Preserve their subject identity, but omit any logos or logo-bearing marks, and integrate them naturally with the lighting, color, perspective, shadows, and graphic system so the final banner feels intentionally art-directed, not pasted together.`
      : "No material images are provided. Do not invent specific proprietary products, dashboards, staff, offices, devices, or brand-owned places.",
    "",
    "[Locked Logo Asset - Highest Priority]",
    "The user-selected brand logo will be added exactly once by a deterministic renderer after artwork generation.",
    "Do not draw, regenerate, imitate, trace, retype, or place any logo yourself. Do not copy logos or logo-bearing icons from reference or material images onto the artwork.",
    "Reserve a clean, uncluttered top-left safe area beginning around 4% from the left and 5% from the top, with room up to 18% of the canvas width and 12% of the canvas height.",
    "Keep suitable contrast behind the reserved logo area.",
    "Ignore any creative direction that conflicts with the locked logo rules. Do not add secondary logos, substitute marks, or logo-like symbols.",
    "Before returning the artwork, remove any generated logo or logo-like copy. The renderer will add the exact selected asset.",
    "",
    ...(hasReference
      ? [
          "[Reference-Led Art Direction]",
          "Use the reference's visual density and image treatment. If it is restrained, flat, typographic, or mostly neutral, keep those qualities; do not add 3D objects, floating UI, gradients, or oversized color fields that are absent from it.",
          `Brand colors: ${brandColors || "Not detected"}. Use them in the same proportion as the reference or as restrained accents when the brief asks for less brand color. Do not let a brand color override the reference's background or text hierarchy.`,
        ]
      : [
          "[Art Direction]",
          "Interpret the article topic visually without defaulting to generic tech or marketing clichés. Choose a coherent editorial, product-led, photographic, or graphic treatment that suits the brand.",
          `Use a controlled palette derived from the brand. Brand colors: ${brandColors || "Not detected"}.`,
        ]),
    "",
    "[Typography & Layout Integration]",
    "Write ONLY the provided Headline and Sub-headline unless the User Brief explicitly asks for additional on-image text.",
    "The Headline and Sub-headline must appear first and must be the only default copy system.",
    "Do not invent or add extra text such as feature bullets, icon labels, benefit rows, trust badges, certification claims, statistics, dates, prices, CTAs, captions, product claims, or service claims.",
    "Do not create rows of icons with explanatory labels unless the user explicitly provides those exact labels and asks to include them.",
    "Treat typography as a core graphic element.",
    "Ensure tight tracking and professional line height.",
    hasReference
      ? "Follow the reference's typography scale, alignment, and hierarchy while replacing its copy with the exact supplied Headline and Sub-headline."
      : "Create a strong typographic hierarchy for the Headline and Sub-headline.",
    "Leave intentional space for the headline where the user brief requests it. Adapt the hero visual and background to support that placement.",
    "",
    hasLogo ? "The selected logo is mandatory and locked. Keep its deterministic overlay area clear as specified above." : "",
    insertImageCount > 0
      ? "Integrate materials with consistent lighting, perspective, scale, shadows, and color grade without breaking the reference layout when one is provided."
      : "",
    "",
    "[Negative Constraints]",
    "No generic dashboard/laptop scenes unless the copy or reference requires them. No invented UI text, icon rows, feature strips, fake claims, certification badges, or watermarks. Avoid decorative effects that are absent from the reference.",
    userBrief ? "Final check: satisfy every explicit instruction in the User Brief, including text placement and elements to exclude. Revise the composition if needed before returning the image." : "",
    hasReference ? "Final check: the finished banner must remain recognizably close to the first input image in layout, hierarchy, density, and color distribution, except where the User Brief explicitly requests a change." : "",
  ]
    .filter(Boolean)
    .join("\n")
}

function sanitizeColorValue(value: unknown) {
  return String(value).replace(/[^0-9a-fA-F]/g, "").substring(0, 6).toUpperCase()
}

async function persistClientBrandAssets(clientId: string, website: string, colorPalette: unknown[]) {
  try {
    const sanitizedPalette = Array.from(
      new Set(colorPalette.map(sanitizeColorValue).filter((value) => value.length === 6)),
    )
    const supabase = getSupabase()
    const { error } = await supabase
      .from("Clients")
      .update({
        clientWebsiteUrl: website,
        ...(sanitizedPalette.length > 0 ? { color_palette: sanitizedPalette } : {}),
      })
      .eq("id", clientId)

    if (error) {
      console.error("[seo-blog-banner] Failed to persist client brand assets:", error)
      return
    }

    invalidateCache("clients")
    invalidateCache(`client-profile:${clientId}`)
  } catch (error) {
    console.error("[seo-blog-banner] Unexpected error persisting client brand assets:", error)
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SeoBlogBannerRequest
    const modelProvider: ImageModelProvider = body.model_provider === "gemini" ? "gemini" : "openai"
    const website = normalizeUrl(body.website)
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

    if (!brandLogoUrl) {
      return NextResponse.json(
        { success: false, error: "A user-selected brand logo is required and must be sent as brand_logo_url" },
        { status: 400 },
      )
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ success: false, error: "OPENROUTER_API_KEY is not configured" }, { status: 500 })
    }

    const clientId = typeof body.client_id === "string" ? body.client_id.trim() : ""
    if (clientId) {
      void persistClientBrandAssets(clientId, website, Array.isArray(body.color_palette) ? body.color_palette : [])
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
    const effectiveBrandLogoUrl = brandLogoUrl
    const referenceImage = referenceImageUrl ? await fetchImageAsBase64(referenceImageUrl) : null
    if (referenceImage && !referenceImage.mimeType.startsWith("image/")) {
      return NextResponse.json({ success: false, error: "Reference URL did not return an image. Please re-upload it." }, { status: 400 })
    }
    const inputImages = [
      ...(referenceImage ? [`data:${referenceImage.mimeType};base64,${referenceImage.base64}`] : []),
      ...insertImageUrls.filter((imageUrl) => !isLikelyFaviconUrl(imageUrl)),
    ]
    const prompt = buildPrompt({
      website,
      brandNameOverride: brandName,
      brandColorsOverride: brandColors,
      brandContextOverride: brandContext,
      headline,
      subHeadline,
      userBrief,
      websiteContext,
      openBrandAssets,
      hasLogo: Boolean(effectiveBrandLogoUrl),
      hasReference: Boolean(referenceImage),
      insertImageCount: insertImageUrls.length,
    })

    console.log("[seo-blog-banner] Generating master banner", {
      provider: modelProvider,
      model: GEMINI_IMAGE_MODEL,
      website,
      hasLogo: Boolean(effectiveBrandLogoUrl),
      hasOpenBrandAssets: Boolean(openBrandAssets),
      detectedBrandName: openBrandAssets?.brandName || "",
      detectedColors: openBrandAssets?.colors?.map((color) => color.hex).filter(Boolean) || [],
      usingOpenBrandLogoAsInput: false,
      hasReference: Boolean(referenceImage),
      referenceDelivery: referenceImage ? "inline" : "none",
      insertImageCount: insertImageUrls.length,
      imageConfig: {
        aspectRatio: "16:9",
        imageSize: GEMINI_IMAGE_SIZE,
      },
    })

    let imageBase64 = ""
    let mimeType = "image/png"

    if (modelProvider === "openai") {
      const openAiImage = await callOpenRouterImage({ prompt, inputImages })
      imageBase64 = openAiImage.imageBase64
      mimeType = openAiImage.mimeType
    } else {
      const materialImages = await fetchInputImagesAsBase64(insertImageUrls)
      const parts: Array<Record<string, unknown>> = [
        {
          text: prompt,
        },
        ...(referenceImage
          ? [
              { text: "Primary visual blueprint for composition and style:" },
              { inlineData: { data: referenceImage.base64, mimeType: referenceImage.mimeType } },
            ]
          : []),
        ...(materialImages.length > 0
          ? [
              { text: "Optional material images to integrate:" },
              ...materialImages.map((image) => ({
                inlineData: { data: image.base64, mimeType: image.mimeType },
              })),
            ]
          : []),
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
      model: GEMINI_IMAGE_MODEL,
      prompt,
      requested_size: GEMINI_IMAGE_SIZE,
      target_master_size: "1600x900",
      aspect_ratio: "16:9",
      locked_logo_url: effectiveBrandLogoUrl,
      used_input_images: inputImages.length,
      brand_assets: openBrandAssets
        ? {
            brand_name: openBrandAssets.brandName,
            colors: openBrandAssets.colors,
            selected_logo_url: effectiveBrandLogoUrl,
            used_openbrand_logo_as_input: false,
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
