import { NextResponse } from "next/server"
import { getSeoBlogBannerWebsite } from "@/lib/seo-blog-banner/client-websites"
import { getSupabase } from "@/lib/supabase/server"

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

type CachedClientBrandAssets = {
  clientWebsiteUrl?: string | null
  clientName?: string | null
  color_palette?: unknown
  logo_page?: string | null
}

function normalizeUrl(value: unknown) {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function normalizeColorPalette(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim()
        if (item && typeof item === "object" && "hex" in item && typeof item.hex === "string") return item.hex.trim()
        return ""
      })
      .filter(Boolean)
  }

  if (typeof value === "string") {
    try {
      return normalizeColorPalette(JSON.parse(value))
    } catch {
      return value.match(/#[0-9a-fA-F]{3,8}\b/g) || []
    }
  }

  return []
}

function formatBrandColors(colors: string[]) {
  return colors.map((color, index) => `${index === 0 ? "Primary" : index === 1 ? "Secondary" : "Accent"}: ${color}`).join(", ")
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

function isLikelyFaviconLogo(logo: OpenBrandLogo) {
  const url = logo.url || ""
  const width = logo.resolution?.width || 0
  const height = logo.resolution?.height || 0
  return /favicon|apple-touch-icon|cropped-favicon/i.test(`${logo.type || ""} ${url}`) || (width > 0 && height > 0 && width <= 180 && height <= 180)
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

async function getClientBrandAssets(clientId: string) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("Clients")
    .select("clientName, clientWebsiteUrl, color_palette, logo_page")
    .eq("id", clientId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  const client = data as CachedClientBrandAssets | null
  if (!client) return null

  const website = normalizeUrl(client.clientWebsiteUrl) || normalizeUrl(getSeoBlogBannerWebsite(client.clientName))
  const colors = normalizeColorPalette(client.color_palette)
  const selectedLogoUrl = normalizeUrl(client.logo_page)
  const brandContext = website ? await fetchWebsiteContext(website) : ""

  return {
    success: true,
    source: selectedLogoUrl || colors.length > 0 ? "cache" : "mapping",
    website,
    brand_name: client.clientName || "",
    brand_colors: formatBrandColors(colors),
    brand_context: brandContext,
    selected_logo_url: selectedLogoUrl,
    raw_assets: null,
  }
}

async function saveClientBrandAssets({
  clientId,
  website,
  colors,
  selectedLogoUrl,
}: {
  clientId?: string
  website: string
  colors: Array<{ hex?: string }>
  selectedLogoUrl: string
}) {
  if (!clientId) return

  const colorPalette = colors.map((color) => color.hex).filter(Boolean)
  const supabase = getSupabase()
  const { error } = await supabase
    .from("Clients")
    .update({
      clientWebsiteUrl: website,
      color_palette: colorPalette,
      logo_page: selectedLogoUrl || null,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", clientId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get("clientId") || ""

    if (!clientId) {
      return NextResponse.json({ success: false, error: "clientId is required" }, { status: 400 })
    }

    const payload = await getClientBrandAssets(clientId)
    if (!payload) {
      return NextResponse.json({ success: false, error: "Client not found" }, { status: 404 })
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error("[seo-blog-banner/assets] Could not load cached client assets:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load cached brand assets",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { clientId?: string; website?: string }
    const website = normalizeUrl(body.website)

    if (!website) {
      return NextResponse.json({ success: false, error: "website is required" }, { status: 400 })
    }

    const [websiteContext, openBrandAssets] = await Promise.all([
      fetchWebsiteContext(website),
      fetchOpenBrandAssets(website),
    ])

    await saveClientBrandAssets({
      clientId: body.clientId,
      website,
      colors: openBrandAssets.colors,
      selectedLogoUrl: openBrandAssets.selected_logo_url,
    })

    return NextResponse.json({
      success: true,
      source: "openbrand",
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
