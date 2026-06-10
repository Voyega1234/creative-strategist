import { NextResponse } from "next/server"

import { getSupabase } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const imageUrl = typeof body.image_url === "string" ? body.image_url.trim() : ""
    const clientId = typeof body.client_id === "string" ? body.client_id.trim() : ""

    if (!imageUrl || !clientId) {
      return NextResponse.json(
        { success: false, error: "image_url and client_id are required" },
        { status: 400 },
      )
    }

    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      throw new Error(`Failed to download generated image (${imageResponse.status})`)
    }

    const imageBlob = await imageResponse.blob()
    const mimeType = imageBlob.type || imageResponse.headers.get("content-type") || "image/png"
    const extension = EXTENSION_BY_MIME_TYPE[mimeType.toLowerCase()] || "png"
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`
    const path = `references/${clientId}/${filename}`
    const supabase = getSupabase()

    const { error } = await supabase.storage.from("ads-creative-image").upload(path, imageBlob, {
      contentType: mimeType,
    })
    if (error) throw new Error(error.message)

    const { data } = supabase.storage.from("ads-creative-image").getPublicUrl(path)

    return NextResponse.json({
      success: true,
      image: {
        name: filename,
        path,
        url: data.publicUrl,
      },
    })
  } catch (error) {
    console.error("[reference-images] Failed to save generated image:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save reference image",
      },
      { status: 500 },
    )
  }
}
