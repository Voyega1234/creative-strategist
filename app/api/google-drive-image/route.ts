import { NextResponse } from "next/server"

import { getGoogleDriveFileId } from "@/lib/images/external-url"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string }
    const fileId = getGoogleDriveFileId(body.url || "")

    if (!fileId) {
      return NextResponse.json({ error: "Invalid Google Drive image link" }, { status: 400 })
    }

    const response = await fetch(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    })

    if (!response.ok) {
      return NextResponse.json({ error: `Unable to download Google Drive image (${response.status})` }, { status: 400 })
    }

    const contentType = response.headers.get("content-type")?.split(";")[0].trim() || ""
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "Google Drive did not return an image. Set access to Anyone with the link and use an image file." },
        { status: 400 },
      )
    }

    return new NextResponse(await response.arrayBuffer(), {
      headers: {
        "Cache-Control": "private, max-age=300",
        "Content-Type": contentType,
      },
    })
  } catch (error) {
    console.error("[google-drive-image] Failed to import image:", error)
    return NextResponse.json({ error: "Unable to import Google Drive image" }, { status: 500 })
  }
}
