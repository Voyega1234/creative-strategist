import { NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase/server"
import { invalidateCache } from "@/lib/utils/server-cache"

export const dynamic = "force-dynamic"

const OPENBRAND_ENDPOINT = "https://openbrand.sh/api/extract"
const IMAGE_BUCKET = "ads-creative-image"

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

function normalizeUrl(value: unknown) {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function sanitizeColorValue(value: string) {
  return value.replace(/[^0-9a-fA-F]/g, "").substring(0, 6).toUpperCase()
}

function normalizeColorPalette(values: unknown[]) {
  return Array.from(
    new Set(values.map((value) => sanitizeColorValue(String(value))).filter((value) => value.length === 6)),
  )
}

function getImageExtension(mimeType: string, url: string) {
  if (/svg/i.test(mimeType) || /\.svg(?:\?|#|$)/i.test(url)) return "svg"
  if (/webp/i.test(mimeType) || /\.webp(?:\?|#|$)/i.test(url)) return "webp"
  if (/jpe?g/i.test(mimeType) || /\.jpe?g(?:\?|#|$)/i.test(url)) return "jpg"
  return "png"
}

function isRasterImageUrl(url: string) {
  return /\.(png|jpe?g|webp)(?:\?|#|$)/i.test(url)
}

function isLikelyFaviconLogo(logo: OpenBrandLogo) {
  const url = logo.url || ""
  const width = logo.resolution?.width || 0
  const height = logo.resolution?.height || 0
  return (
    /favicon|apple-touch-icon|cropped-favicon/i.test(`${logo.type || ""} ${url}`) ||
    (width > 0 && height > 0 && width <= 180 && height <= 180)
  )
}

function selectOpenBrandLogo(logos: OpenBrandLogo[]) {
  const withUrl = logos.filter((logo) => {
    if (typeof logo.url !== "string" || logo.url.trim().length === 0) return false
    return !/^data:image\/svg\+xml,[^#?]*%3Csvg[^#?]*%3E%3C\/svg%3E$/i.test(logo.url)
  })
  const nonFavicon = withUrl.filter((logo) => !isLikelyFaviconLogo(logo))
  const raster = withUrl
    .filter((logo) => isRasterImageUrl(logo.url || ""))
    .sort(
      (a, b) =>
        (b.resolution?.width || 0) * (b.resolution?.height || 0) -
        (a.resolution?.width || 0) * (a.resolution?.height || 0),
    )
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
  const payload = rawText ? JSON.parse(rawText) : null

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `OpenBrand request failed (${response.status})`)
  }

  const data = payload.data || {}
  const logos = Array.isArray(data.logos) ? data.logos : []
  const colors = Array.isArray(data.colors) ? data.colors : []

  return {
    brandName: typeof data.brandName === "string" ? data.brandName : "",
    colors: colors as OpenBrandColor[],
    selectedLogoUrl: selectOpenBrandLogo(logos),
  }
}

async function uploadLogoMaterial(clientId: string, logoUrl: string) {
  if (!logoUrl) return ""

  const response = await fetch(logoUrl, {
    headers: {
      "User-Agent": "CreativeCompassBot/1.0",
    },
  })
  if (!response.ok) {
    throw new Error(`Could not download logo (${response.status})`)
  }

  const contentType = response.headers.get("content-type") || "image/png"
  const extension = getImageExtension(contentType, logoUrl)
  const imageBuffer = await response.arrayBuffer()
  const supabase = getSupabase()
  const path = `materials/${clientId}/openbrand-logo-${Date.now()}.${extension}`

  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, imageBuffer, {
    contentType,
    upsert: true,
  })
  if (error) {
    throw new Error(error.message)
  }

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      website?: string
      clientId?: string
      currentColorPalette?: unknown[]
    }
    const website = normalizeUrl(body.website)
    const clientId = typeof body.clientId === "string" ? body.clientId.trim() : ""

    if (!website) {
      return NextResponse.json({ success: false, error: "website is required" }, { status: 400 })
    }
    if (!clientId) {
      return NextResponse.json({ success: false, error: "clientId is required" }, { status: 400 })
    }

    const openBrandAssets = await fetchOpenBrandAssets(website)
    const extractedColors = normalizeColorPalette(openBrandAssets.colors.map((color) => color.hex || ""))
    const colorPalette = normalizeColorPalette([...(body.currentColorPalette || []), ...extractedColors])

    let logoMaterialUrl = ""
    if (openBrandAssets.selectedLogoUrl) {
      logoMaterialUrl = await uploadLogoMaterial(clientId, openBrandAssets.selectedLogoUrl)
    }

    const supabase = getSupabase()
    const { error } = await supabase
      .from("Clients")
      .update({
        clientWebsiteUrl: website,
        color_palette: colorPalette,
      })
      .eq("id", clientId)

    if (error) {
      throw new Error(error.message)
    }

    invalidateCache("clients")
    invalidateCache(`client-profile:${clientId}`)

    return NextResponse.json({
      success: true,
      website,
      brand_name: openBrandAssets.brandName,
      color_palette: colorPalette,
      extracted_colors: extractedColors,
      selected_logo_url: openBrandAssets.selectedLogoUrl,
      logo_material_url: logoMaterialUrl,
    })
  } catch (error) {
    console.error("[text-to-image/brand-assets] Unexpected error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to extract brand assets",
      },
      { status: 500 },
    )
  }
}
