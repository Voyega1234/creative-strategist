import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const OPENBRAND_ENDPOINT = "https://openbrand.sh/api/extract"

type OpenBrandLogo = {
  url?: string
  type?: string
  resolution?: {
    width?: number
    height?: number
    aspect_ratio?: number
  }
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
    console.warn("[seo-blog-banner/assets] Could not fetch website context:", error)
    return ""
  }
}

function isRasterImageUrl(url: string) {
  return /\.(png|jpe?g|webp)(?:\?|#|$)/i.test(url)
}

function selectOpenBrandLogo(logos: OpenBrandLogo[]) {
  const withUrl = logos.filter((logo) => typeof logo.url === "string" && logo.url.trim().length > 0)
  const raster = withUrl.filter((logo) => isRasterImageUrl(logo.url || ""))
  const nonFaviconRaster = raster.find((logo) => logo.type && !/favicon/i.test(logo.type))
  return nonFaviconRaster?.url || raster[0]?.url || withUrl[0]?.url || ""
}

async function fetchOpenBrandAssets(website: string) {
  const apiKey = process.env.OPENBRAND_API
  if (!apiKey) {
    throw new Error("OPENBRAND_API is not configured")
  }

  const response = await fetch(`${OPENBRAND_ENDPOINT}?url=${encodeURIComponent(website)}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })
  const rawText = await response.text()
  let payload: any = null

  try {
    payload = rawText ? JSON.parse(rawText) : null
  } catch {
    throw new Error("Invalid OpenBrand response")
  }

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `OpenBrand request failed (${response.status})`)
  }

  const data = payload.data || {}
  const logos = Array.isArray(data.logos) ? data.logos : []
  const colors = Array.isArray(data.colors) ? data.colors : []

  return {
    brand_name: typeof data.brandName === "string" ? data.brandName : "",
    colors,
    logos,
    selected_logo_url: selectOpenBrandLogo(logos),
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { website?: string }
    const website = normalizeUrl(body.website)

    if (!website) {
      return NextResponse.json({ success: false, error: "website is required" }, { status: 400 })
    }

    const [websiteContext, openBrandAssets] = await Promise.all([
      fetchWebsiteContext(website),
      fetchOpenBrandAssets(website),
    ])

    return NextResponse.json({
      success: true,
      website,
      brand_name: openBrandAssets.brand_name,
      brand_colors: openBrandAssets.colors
        ?.map((color: { usage?: string; hex?: string }) => [color.usage, color.hex].filter(Boolean).join(": "))
        .filter(Boolean)
        .join(", "),
      brand_context: websiteContext,
      selected_logo_url: openBrandAssets.selected_logo_url,
      raw_assets: openBrandAssets,
    })
  } catch (error) {
    console.error("[seo-blog-banner/assets] Unexpected error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to extract brand assets",
      },
      { status: 500 },
    )
  }
}
