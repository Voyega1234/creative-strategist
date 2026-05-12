"use client"

import { getStorageClient } from "@/lib/supabase/client"

const DEFAULT_IMAGE_BUCKET = "ads-creative-image"
const IMAGE_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
}

export const SUPPORTED_ASPECT_RATIO_LABELS = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
] as const

export type SupportedAspectRatioLabel = (typeof SUPPORTED_ASPECT_RATIO_LABELS)[number]

function randomStorageSuffix() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export function getImageExtension(mimeType: string) {
  return IMAGE_EXTENSION_BY_MIME_TYPE[mimeType.toLowerCase()] || "png"
}

export function withImageExtension(filename: string, extension: string) {
  return filename.replace(/\.(png|jpe?g|webp)$/i, "") + `.${extension}`
}

export function dataUrlToBlob(dataUrl: string) {
  const [metadata, base64Data] = dataUrl.split(",")
  const mimeType = metadata.match(/^data:(.*?);base64$/)?.[1] || "image/png"
  return base64ToBlob(base64Data || "", mimeType)
}

export function base64ToBlob(base64: string, mimeType = "image/png") {
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new Blob([bytes], { type: mimeType })
}

export async function downloadImageFromUrl(url: string, filename: string) {
  const response = await fetch(url)
  const blob = await response.blob()
  downloadBlob(blob, filename)
}

export function downloadBlob(blob: Blob, filename: string) {
  const extension = getImageExtension(blob.type || "image/png")
  const objectUrl = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = objectUrl
  link.download = withImageExtension(filename, extension)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000)
}

export function downloadImagesFromUrls(urls: string[], baseFilename: string, staggerMs = 180) {
  urls.forEach((url, index) => {
    window.setTimeout(() => {
      void downloadImageFromUrl(url, `${baseFilename}-${index + 1}.png`)
    }, index * staggerMs)
  })
}

export function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new window.Image()

    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
      URL.revokeObjectURL(objectUrl)
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error(`ไม่สามารถอ่านขนาดภาพ ${file.name} ได้`))
    }

    image.src = objectUrl
  })
}

export function getClosestAspectRatioLabel(width: number, height: number) {
  const rawRatio = width / height

  return SUPPORTED_ASPECT_RATIO_LABELS.reduce((closest, current) => {
    const [currentWidth, currentHeight] = current.split(":").map(Number)
    const [closestWidth, closestHeight] = closest.split(":").map(Number)
    const currentDistance = Math.abs(rawRatio - currentWidth / currentHeight)
    const closestDistance = Math.abs(rawRatio - closestWidth / closestHeight)
    return currentDistance < closestDistance ? current : closest
  }, "1:1" as SupportedAspectRatioLabel)
}

export async function uploadFileToImageStorage(file: File, folderPath: string) {
  const extension = file.name.split(".").pop() || "png"
  const path = `${folderPath}/${randomStorageSuffix()}.${extension}`
  return uploadBlobToImageStorage(file, file.type || "application/octet-stream", path)
}

export async function uploadBlobToImageStorage(blob: Blob, mimeType: string, path: string) {
  const storage = getStorageClient()
  if (!storage) {
    throw new Error("Storage client not available")
  }

  const { error } = await storage.from(DEFAULT_IMAGE_BUCKET).upload(path, blob, {
    contentType: mimeType,
  })

  if (error) {
    throw new Error(error.message)
  }

  const { data } = storage.from(DEFAULT_IMAGE_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadGeneratedImageBlob(blob: Blob, folderPath: string, filenameSuffix = "") {
  const mimeType = blob.type || "image/png"
  const extension = getImageExtension(mimeType)
  const suffix = filenameSuffix ? `-${filenameSuffix}` : ""
  const path = `${folderPath}/${randomStorageSuffix()}${suffix}.${extension}`
  return uploadBlobToImageStorage(blob, mimeType, path)
}

export async function uploadDataUrlToImageStorage(dataUrl: string, folderPath: string) {
  const blob = dataUrlToBlob(dataUrl)
  const publicUrl = await uploadGeneratedImageBlob(blob, folderPath)
  return { publicUrl, mimeType: blob.type || "image/png" }
}
