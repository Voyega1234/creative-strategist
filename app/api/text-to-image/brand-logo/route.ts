import { NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const IMAGE_BUCKET = "ads-creative-image"

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function isPublicImageUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:"
  } catch {
    return false
  }
}

function sanitizeFileName(value: string) {
  const sanitized = value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "")
  return sanitized || "brand-logo.png"
}

function logoFolder(clientId: string) {
  return `brand-logos/${clientId}`
}

function originalFileName(storedName: string) {
  return storedName.replace(/^\d+-/, "") || "Brand logo"
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = normalizeString(searchParams.get("clientId"))

    if (!clientId) {
      return NextResponse.json({ success: false, error: "clientId is required" }, { status: 400 })
    }

    const supabase = getSupabase()
    const { data, error } = await supabase
      .storage
      .from(IMAGE_BUCKET)
      .list(logoFolder(clientId), { limit: 1, sortBy: { column: "created_at", order: "desc" } })

    if (error) throw new Error(error.message)

    const file = data?.[0]
    const logo = file
      ? {
          url: supabase.storage.from(IMAGE_BUCKET).getPublicUrl(`${logoFolder(clientId)}/${file.name}`).data.publicUrl,
          name: originalFileName(file.name),
        }
      : null
    return NextResponse.json({ success: true, logo })
  } catch (error) {
    console.error("[text-to-image/brand-logo] GET failed:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load brand logo" },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const clientId = normalizeString(body.clientId)
    const logoUrl = normalizeString(body.logoUrl)
    const logoName = normalizeString(body.logoName) || "Brand logo"

    if (!clientId) {
      return NextResponse.json({ success: false, error: "clientId is required" }, { status: 400 })
    }
    if (!isPublicImageUrl(logoUrl)) {
      return NextResponse.json({ success: false, error: "A valid public logo URL is required" }, { status: 400 })
    }

    const imageResponse = await fetch(logoUrl)
    if (!imageResponse.ok) {
      throw new Error(`Could not download logo (${imageResponse.status})`)
    }
    const contentType = imageResponse.headers.get("content-type") || ""
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ success: false, error: "Logo URL must point to an image" }, { status: 400 })
    }

    const supabase = getSupabase()
    const folder = logoFolder(clientId)
    const storedName = `${Date.now()}-${sanitizeFileName(logoName)}`
    const path = `${folder}/${storedName}`
    const { error: uploadError } = await supabase.storage.from(IMAGE_BUCKET).upload(path, await imageResponse.arrayBuffer(), {
      contentType,
      upsert: false,
    })
    if (uploadError) throw new Error(uploadError.message)

    const { data: oldFiles, error: listError } = await supabase.storage
      .from(IMAGE_BUCKET)
      .list(folder, { limit: 100, sortBy: { column: "created_at", order: "desc" } })
    if (listError) throw new Error(listError.message)

    const obsoletePaths = (oldFiles || [])
      .filter((file) => file.name !== storedName)
      .map((file) => `${folder}/${file.name}`)
    if (obsoletePaths.length > 0) {
      const { error: removeError } = await supabase.storage.from(IMAGE_BUCKET).remove(obsoletePaths)
      if (removeError) console.warn("[text-to-image/brand-logo] Could not remove old logos:", removeError.message)
    }

    const publicUrl = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
    return NextResponse.json({ success: true, logo: { url: publicUrl, name: logoName } })
  } catch (error) {
    console.error("[text-to-image/brand-logo] PUT failed:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to save brand logo" },
      { status: 500 },
    )
  }
}
