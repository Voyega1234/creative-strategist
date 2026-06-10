"use client"

import { getStorageClient } from "@/lib/supabase/client"

const IMAGE_BUCKET = "ads-creative-image"
const IMAGE_FILE_PATTERN = /\.(avif|gif|jpe?g|png|webp)$/i

export type StoredReferenceImage = {
  name: string
  url: string
  size: number
  createdAt: string
}

async function listReferenceFolder(folderPath: string, limit: number) {
  const storage = getStorageClient()
  if (!storage) return []

  const { data: files, error } = await storage.from(IMAGE_BUCKET).list(folderPath, {
    limit,
    offset: 0,
    sortBy: { column: "name", order: "desc" },
  })

  if (error || !files?.length) return []

  return files
    .filter((file) => IMAGE_FILE_PATTERN.test(file.name))
    .map((file) => {
      const { data } = storage.from(IMAGE_BUCKET).getPublicUrl(`${folderPath}/${file.name}`)
      return {
        name: file.name,
        url: data.publicUrl,
        size: file.metadata?.size || 0,
        createdAt: file.created_at || new Date().toISOString(),
      }
    })
    .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
}

export async function loadBrandReferenceImages(clientId: string, limit = 100) {
  if (!clientId || clientId === "general") return []
  return listReferenceFolder(`references/${clientId}`, limit)
}

export async function loadAllReferenceImages(limit = 300) {
  const storage = getStorageClient()
  if (!storage) return []

  const { data: rootEntries, error } = await storage.from(IMAGE_BUCKET).list("references", {
    limit: 1000,
    offset: 0,
    sortBy: { column: "name", order: "desc" },
  })

  if (error) return []

  const folderNames = (rootEntries || [])
    .filter((entry) => !IMAGE_FILE_PATTERN.test(entry.name) && !entry.name.startsWith("."))
    .map((entry) => entry.name)

  const [sharedImages, ...clientLibraries] = await Promise.all([
    listReferenceFolder("references", limit),
    ...folderNames.map((folderName) => listReferenceFolder(`references/${folderName}`, 100)),
  ])

  const uniqueImages = new Map<string, StoredReferenceImage>()
  for (const image of [...sharedImages, ...clientLibraries.flat()]) {
    uniqueImages.set(image.url, image)
  }

  return Array.from(uniqueImages.values())
    .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
    .slice(0, limit)
}

export async function loadClientReferenceImages(clientId: string, limit = 100) {
  if (!clientId || clientId === "general") {
    return { images: [], usedSharedLibrary: false }
  }

  const brandImages = await loadBrandReferenceImages(clientId, limit)
  if (brandImages.length > 0) {
    return { images: brandImages, usedSharedLibrary: false }
  }

  return {
    images: await listReferenceFolder("references", limit),
    usedSharedLibrary: true,
  }
}

export async function uploadClientReferenceFiles(clientId: string, files: File[]) {
  if (!clientId || clientId === "general") {
    throw new Error("Select a client before uploading reference images")
  }

  const storage = getStorageClient()
  if (!storage) {
    throw new Error("Storage client not available")
  }

  return Promise.all(
    files
      .filter((file) => file.type.startsWith("image/"))
      .map(async (file) => {
        const extension = file.name.split(".").pop() || "png"
        const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`
        const path = `references/${clientId}/${filename}`
        const { error } = await storage.from(IMAGE_BUCKET).upload(path, file)
        if (error) throw error

        const { data } = storage.from(IMAGE_BUCKET).getPublicUrl(path)
        return {
          name: filename,
          url: data.publicUrl,
          size: file.size,
          createdAt: new Date().toISOString(),
        } satisfies StoredReferenceImage
      }),
  )
}
