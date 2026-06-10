import http from "node:http"
import https from "node:https"

import { NextResponse } from "next/server"

import { getSupabase } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
// Apify run-sync can take a while to scrape a page; allow a long-running function.
export const maxDuration = 300

const BUCKET = "ads-creative-image"
const FOLDER_PREFIX = "style-references"
const DEFAULT_RESULTS_LIMIT = 20
const APIFY_TOKEN = process.env.APIFY_TOKEN || process.env.NEXT_PUBLIC_APIFY_API_KEY || ""
const APIFY_ACTOR_RUN_URL =
  "https://api.apify.com/v2/actors/curious_coder~facebook-ads-library-scraper/run-sync-get-dataset-items"

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

const DOWNLOAD_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
}

// Download with node:https so we control the timeout. Global fetch (undici) caps the connect
// timeout at 10s, which is too short for some networks reaching Facebook's far CDN edges.
function downloadImageBuffer(
  url: string,
  timeoutMs = 30000,
  redirectsLeft = 3,
): Promise<{ buffer: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("http://") ? http : https
    const request = client.get(url, { headers: DOWNLOAD_HEADERS, timeout: timeoutMs }, (response) => {
      const status = response.statusCode || 0
      if (status >= 300 && status < 400 && response.headers.location && redirectsLeft > 0) {
        response.resume()
        const nextUrl = new URL(response.headers.location, url).toString()
        downloadImageBuffer(nextUrl, timeoutMs, redirectsLeft - 1).then(resolve, reject)
        return
      }
      if (status !== 200) {
        response.resume()
        reject(new Error(`HTTP ${status}`))
        return
      }
      const chunks: Buffer[] = []
      response.on("data", (chunk) => chunks.push(chunk as Buffer))
      response.on("end", () =>
        resolve({
          buffer: Buffer.concat(chunks),
          contentType: response.headers["content-type"] || "image/jpeg",
        }),
      )
      response.on("error", reject)
    })
    request.on("timeout", () => request.destroy(new Error("download timeout")))
    request.on("error", reject)
  })
}

function folderFor(clientId: string) {
  return `${FOLDER_PREFIX}/${clientId}`
}

// Ads Library items keep their creative under `snapshot`. We only want single-image ads
// (display_format === "IMAGE"); their image URL lives at snapshot.images[].original_image_url.
function extractImageUrls(items: unknown): string[] {
  if (!Array.isArray(items)) return []
  const urls: string[] = []
  for (const item of items) {
    const snapshot = item && typeof item === "object" ? (item as Record<string, unknown>).snapshot : null
    if (!snapshot || typeof snapshot !== "object") continue
    const snap = snapshot as Record<string, unknown>
    if (snap.display_format !== "IMAGE") continue

    const images = Array.isArray(snap.images) ? snap.images : []
    for (const image of images) {
      if (!image || typeof image !== "object") continue
      const candidate =
        (image as Record<string, unknown>).original_image_url ||
        (image as Record<string, unknown>).resized_image_url
      if (typeof candidate === "string" && /^https?:\/\//.test(candidate) && !urls.includes(candidate)) {
        urls.push(candidate)
      }
    }
  }
  return urls
}

async function listStoredReferences(clientId: string) {
  const supabase = getSupabase()
  const folder = folderFor(clientId)
  const { data: files, error } = await supabase.storage
    .from(BUCKET)
    .list(folder, { limit: 100, sortBy: { column: "name", order: "desc" } })
  if (error) throw new Error(error.message)

  return (files || [])
    .filter((file) => file.name && !file.name.startsWith("."))
    .map((file) => {
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(`${folder}/${file.name}`)
      return { name: file.name, url: data.publicUrl }
    })
}

// GET: return the references already scraped for this client (no Apify call).
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get("clientId")?.trim()
    if (!clientId) {
      return NextResponse.json({ success: false, error: "clientId is required" }, { status: 400 })
    }

    const images = await listStoredReferences(clientId)
    return NextResponse.json({ success: true, images })
  } catch (error) {
    console.error("[style-references] GET failed:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load references" },
      { status: 500 },
    )
  }
}

// POST: scrape the page via Apify, replace any existing references, and store them in Supabase.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const clientId = typeof body.clientId === "string" ? body.clientId.trim() : ""
    const facebookUrl = typeof body.facebookUrl === "string" ? body.facebookUrl.trim() : ""
    // The Ads Library actor requires "count" >= 10 ("Maximum charged results").
    const limit = Math.min(Math.max(Number(body.limit) || DEFAULT_RESULTS_LIMIT, 10), 50)

    if (!clientId || !facebookUrl) {
      return NextResponse.json(
        { success: false, error: "clientId and facebookUrl are required" },
        { status: 400 },
      )
    }

    const runResponse = await fetch(`${APIFY_ACTOR_RUN_URL}?token=${APIFY_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        urls: [{ url: facebookUrl }],
        count: limit,
        "scrapePageAds.countryCode": "ALL",
        "scrapePageAds.activeStatus": "all",
      }),
    })

    if (!runResponse.ok) {
      const detail = await runResponse.text()
      throw new Error(`Apify request failed (${runResponse.status}): ${detail.slice(0, 200)}`)
    }

    const items = await runResponse.json()
    const imageUrls = extractImageUrls(items).slice(0, limit)

    if (imageUrls.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "ไม่พบโฆษณาแบบรูปภาพ (IMAGE) ใน Ads Library ของเพจนี้ ลองตรวจสอบ URL หรือเพจนี้อาจไม่มีโฆษณาที่ใช้รูปภาพ",
        },
        { status: 422 },
      )
    }

    const supabase = getSupabase()
    const folder = folderFor(clientId)

    // Refresh = replace: clear previously stored references first.
    const { data: existing } = await supabase.storage.from(BUCKET).list(folder, { limit: 1000 })
    if (existing && existing.length > 0) {
      await supabase.storage.from(BUCKET).remove(existing.map((file) => `${folder}/${file.name}`))
    }

    const saved: Array<{ name: string; url: string }> = []
    for (const [index, imageUrl] of imageUrls.entries()) {
      try {
        // Ads Library images sit on region-pinned *.fna.fbcdn.net edges that aren't reachable
        // from outside their ISP, so route them through the wsrv.nl image proxy.
        const downloadUrl = `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}`
        let downloaded: { buffer: Buffer; contentType: string } | null = null
        for (let attempt = 0; attempt < 2 && !downloaded; attempt++) {
          try {
            downloaded = await downloadImageBuffer(downloadUrl)
          } catch (downloadError) {
            if (attempt === 1) throw downloadError
          }
        }
        if (!downloaded) continue

        const mimeType = (downloaded.contentType || "image/jpeg").split(";")[0].trim()
        const extension = EXTENSION_BY_MIME_TYPE[mimeType.toLowerCase()] || "jpg"
        const filename = `${Date.now()}-${index}-${Math.random().toString(36).substring(2, 8)}.${extension}`
        const path = `${folder}/${filename}`

        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, downloaded.buffer, { contentType: mimeType })
        if (error) continue

        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
        saved.push({ name: filename, url: data.publicUrl })
      } catch (uploadError) {
        console.warn("[style-references] Failed to store one image:", uploadError)
      }
    }

    if (saved.length === 0) {
      throw new Error("ดึงรูปได้แต่บันทึกไม่สำเร็จ กรุณาลองใหม่")
    }

    return NextResponse.json({ success: true, images: saved })
  } catch (error) {
    console.error("[style-references] POST failed:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to scrape references" },
      { status: 500 },
    )
  }
}
