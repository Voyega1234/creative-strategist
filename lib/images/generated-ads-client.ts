"use client"

import { base64ToBlob, downloadBlob } from "@/lib/images/client"
import {
  getFirstGeneratedImageFromResponse,
  getGeneratedImagesFromResponse,
  type ImageEntry,
} from "@/lib/images/generated-ads"

export type GeneratedAdRequestPayload = Record<string, unknown>

export type ImageOperationResult = {
  blob: Blob
  mimeType: string
  aspectRatio?: string
}

export async function runConcurrentImageJobs<T>(params: {
  items: T[]
  concurrency: number
  run: (item: T) => Promise<void>
  onError?: (item: T, error: unknown) => void
}) {
  let failedCount = 0
  let nextIndex = 0

  const worker = async () => {
    while (true) {
      const currentIndex = nextIndex
      nextIndex += 1

      if (currentIndex >= params.items.length) {
        return
      }

      const item = params.items[currentIndex]

      try {
        await params.run(item)
      } catch (error) {
        failedCount += 1
        params.onError?.(item, error)
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(params.concurrency, params.items.length) }, () => worker()),
  )

  return { failedCount }
}

async function parseJsonResponse(response: Response, invalidMessage: string) {
  const responseText = await response.text()

  try {
    return responseText ? JSON.parse(responseText) : {}
  } catch (parseError) {
    console.error(invalidMessage, parseError, responseText)
    throw new Error(invalidMessage)
  }
}

export async function requestGeneratedAdImage(payload: GeneratedAdRequestPayload): Promise<ImageEntry> {
  const response = await fetch("/api/generate-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  const result = await parseJsonResponse(response, "Invalid response from image generator")

  if (!response.ok) {
    throw new Error(result?.error || `การสร้างรูปไม่สำเร็จ (${response.status})`)
  }

  const finalImage = getFirstGeneratedImageFromResponse(result)
  if (!finalImage) {
    throw new Error(result?.error || "No valid image URL returned from generator")
  }

  return finalImage
}

export async function requestGeneratedAdImages(payload: GeneratedAdRequestPayload): Promise<ImageEntry[]> {
  const response = await fetch("/api/generate-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  const result = await parseJsonResponse(response, "Invalid response from image generator")

  if (!response.ok) {
    throw new Error(result?.error || `การสร้างรูปไม่สำเร็จ (${response.status})`)
  }

  const images = getGeneratedImagesFromResponse(result)
  if (images.length === 0) {
    throw new Error(result?.error || "No valid image URL returned from generator")
  }

  return images
}

export async function requestUpscaledImage(imageUrl: string): Promise<ImageOperationResult> {
  const response = await fetch("/api/upscale-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_url: imageUrl,
    }),
  })

  const result = await response.json()
  if (!response.ok || !result.success || !result.image_base64) {
    throw new Error(result?.error || "ไม่สามารถ upscale ภาพได้")
  }

  const mimeType = result.mime_type || "image/png"
  return {
    blob: base64ToBlob(result.image_base64, mimeType),
    mimeType,
    aspectRatio: result.aspect_ratio,
  }
}

export async function requestTextRemovedImage(params: {
  imageUrl: string
  sourceAspectRatio: string
  targetSize: string
}): Promise<ImageOperationResult> {
  const response = await fetch("/api/remove-text-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_url: params.imageUrl,
      source_aspect_ratio: params.sourceAspectRatio,
      target_size: params.targetSize,
    }),
  })

  const result = await response.json()
  if (!response.ok || !result.success || !result.image_base64) {
    throw new Error(result?.error || "ไม่สามารถลบข้อความออกจากภาพได้")
  }

  const mimeType = result.mime_type || "image/png"
  return {
    blob: base64ToBlob(result.image_base64, mimeType),
    mimeType,
    aspectRatio: result.aspect_ratio,
  }
}

export async function downloadGeneratedAdImage(imageUrl: string) {
  console.log("🔄 Starting image download from:", imageUrl)

  try {
    const response = await fetch(imageUrl, {
      mode: "cors",
      headers: {
        Accept: "image/*",
      },
    })

    if (response.ok) {
      await downloadBlob(await response.blob(), `ai-generated-${Date.now()}.jpg`)
      console.log("✅ Image downloaded successfully")
      return
    }
  } catch (corsError) {
    console.log("⚠️ CORS download failed, trying proxy method:", corsError)
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ""
  const proxyResponse = await fetch(`${baseUrl}/api/download-image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_url: imageUrl,
    }),
  })

  if (proxyResponse.ok) {
    await downloadBlob(await proxyResponse.blob(), `ai-generated-${Date.now()}.jpg`)
    console.log("✅ Image downloaded via proxy")
    return
  }

  console.log("⚠️ Proxy download failed, opening in new tab")
  window.open(imageUrl, "_blank")
  alert('ไม่สามารถดาวน์โหลดอัตโนมัติได้ กรุณาคลิกขวาที่รูปภาพแล้วเลือก "บันทึกรูปภาพ"')
}
