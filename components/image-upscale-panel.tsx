"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getStorageClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Copy, Download, Loader2, Sparkles, Upload, X } from "lucide-react"

const UPSCALE_SIZE_OPTIONS = ["1K", "2K", "4K"] as const

type UpscaleSize = (typeof UPSCALE_SIZE_OPTIONS)[number]

type UploadedImage = {
  id: string
  file: File
  previewUrl: string
}

type UpscaleResult = {
  id: string
  url: string
  size: UpscaleSize
  fileName: string
  createdAt: string
}

export function ImageUpscalePanel() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [targetSize, setTargetSize] = useState<UpscaleSize>("2K")
  const [isUpscaling, setIsUpscaling] = useState(false)
  const [activeBatchIndex, setActiveBatchIndex] = useState(0)
  const [results, setResults] = useState<UpscaleResult[]>([])

  useEffect(() => {
    return () => {
      uploadedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl))
    }
  }, [uploadedImages])

  const appendFiles = (files: FileList | null) => {
    if (!files?.length) return

    const nextImages = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      }))

    setUploadedImages((prev) => [...prev, ...nextImages])
  }

  const removeUploadedImage = (imageId: string) => {
    setUploadedImages((prev) => {
      const image = prev.find((item) => item.id === imageId)
      if (image) {
        URL.revokeObjectURL(image.previewUrl)
      }
      return prev.filter((item) => item.id !== imageId)
    })
  }

  const uploadFileToStorage = async (file: File) => {
    const storage = getStorageClient()
    if (!storage) {
      throw new Error("Storage client not available")
    }

    const extension = file.name.split(".").pop() || "png"
    const path = `generated/upscale-inputs/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`
    const { error } = await storage.from("ads-creative-image").upload(path, file, {
      contentType: file.type,
    })

    if (error) {
      throw new Error(error.message)
    }

    const { data } = storage.from("ads-creative-image").getPublicUrl(path)
    return data.publicUrl
  }

  const uploadUpscaledBlobToStorage = async (blob: Blob, mimeType: string, size: UpscaleSize) => {
    const storage = getStorageClient()
    if (!storage) {
      throw new Error("Storage client not available")
    }

    const extensionMap: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
    }

    const extension = extensionMap[mimeType] || "png"
    const path = `generated/upscaled/${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${size.toLowerCase()}.${extension}`
    const { error } = await storage.from("ads-creative-image").upload(path, blob, {
      contentType: mimeType,
    })

    if (error) {
      throw new Error(error.message)
    }

    const { data } = storage.from("ads-creative-image").getPublicUrl(path)
    return data.publicUrl
  }

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const objectUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = objectUrl
      link.download = `upscaled-${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(objectUrl)
    } catch (error) {
      console.error("Download failed:", error)
    }
  }

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
    } catch (error) {
      console.error("Copy failed:", error)
    }
  }

  const handleUpscale = async () => {
    if (uploadedImages.length === 0) {
      alert("กรุณาอัปโหลดรูปก่อน")
      return
    }

    try {
      setIsUpscaling(true)

      for (let index = 0; index < uploadedImages.length; index += 1) {
        const image = uploadedImages[index]
        setActiveBatchIndex(index + 1)

        const sourceUrl = await uploadFileToStorage(image.file)

        const response = await fetch("/api/upscale-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image_url: sourceUrl,
            target_size: targetSize,
          }),
        })

        const result = await response.json()
        if (!response.ok || !result.success || !result.image_base64) {
          throw new Error(result?.error || `ไม่สามารถ upscale ภาพ ${image.file.name} ได้`)
        }

        const binary = atob(result.image_base64)
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
        const mimeType = result.mime_type || "image/png"
        const publicUrl = await uploadUpscaledBlobToStorage(
          new Blob([bytes], { type: mimeType }),
          mimeType,
          targetSize,
        )

        setResults((prev) => [
          {
            id: crypto.randomUUID(),
            url: publicUrl,
            size: targetSize,
            fileName: image.file.name,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ])
      }
    } catch (error) {
      console.error("Upscale failed:", error)
      alert(error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการ upscale ภาพ")
    } finally {
      setIsUpscaling(false)
      setActiveBatchIndex(0)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-950">Image Upscale</h3>
          <p className="mt-1 text-sm text-slate-600">
            Upload multiple images and upscale them to 1K, 2K, or 4K.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className="rounded-full bg-slate-100 text-slate-700 hover:bg-slate-100">
            {uploadedImages.length} file{uploadedImages.length === 1 ? "" : "s"}
          </Badge>
          <Badge className="rounded-full bg-slate-900 text-white hover:bg-slate-900">
            {targetSize}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px,minmax(0,1fr)]">
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="border-b border-slate-200 bg-white px-6 py-5">
            <h4 className="text-lg font-semibold text-slate-950">Upload & Settings</h4>
            <p className="mt-1 text-sm text-slate-600">
              Add one or more images, then run batch upscale.
            </p>
          </div>

          <div className="space-y-5 p-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => appendFiles(event.target.files)}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex min-h-[180px] w-full items-center justify-center rounded-[24px] border border-dashed px-6 text-center transition-colors",
                uploadedImages.length > 0
                  ? "border-slate-200 bg-white hover:border-slate-300"
                  : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100",
              )}
            >
              <div className="space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {uploadedImages.length > 0 ? "Add more images" : "Upload images for upscale"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">PNG, JPG, WEBP</p>
                </div>
              </div>
            </button>

            {uploadedImages.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-900">Selected Images</p>
                  <p className="text-xs text-slate-500">{uploadedImages.length} selected</p>
                </div>
                <div className="max-h-[340px] overflow-y-auto pr-2">
                  <div className="grid grid-cols-2 gap-3">
                    {uploadedImages.map((image) => (
                      <div key={image.id} className="rounded-[20px] border border-slate-200 bg-white p-2">
                        <div className="relative aspect-square overflow-hidden rounded-2xl bg-slate-50">
                          <Image src={image.previewUrl} alt={image.file.name} fill className="object-cover" sizes="180px" />
                          <button
                            type="button"
                            onClick={() => removeUploadedImage(image.id)}
                            className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="mt-2 truncate text-xs font-medium text-slate-700">{image.file.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-sm font-medium text-slate-900">Target Size</p>
              <div className="grid grid-cols-3 gap-2">
                {UPSCALE_SIZE_OPTIONS.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setTargetSize(size)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                      targetSize === size
                        ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleUpscale}
              disabled={uploadedImages.length === 0 || isUpscaling}
              className="h-11 w-full rounded-full bg-slate-900 text-white hover:bg-slate-800"
            >
              {isUpscaling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Upscaling {activeBatchIndex}/{uploadedImages.length} to {targetSize}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Upscale {uploadedImages.length || 0} Image{uploadedImages.length === 1 ? "" : "s"} to {targetSize}
                </>
              )}
            </Button>
          </div>
        </Card>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="border-b border-slate-200 bg-white px-6 py-5">
            <h4 className="text-lg font-semibold text-slate-950">Upscale Results</h4>
            <p className="mt-1 text-sm text-slate-600">
              Recent outputs from this tab.
            </p>
          </div>

          <div className="p-6">
            {results.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-slate-200 bg-[linear-gradient(135deg,_#f8fafc_0%,_#ffffff_100%)] px-6 py-16 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h5 className="mt-5 text-lg font-semibold text-slate-950">No upscale results yet</h5>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                  Upload one or more images, pick 1K, 2K, or 4K, then run batch upscale.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((result) => (
                  <Card key={result.id} className="overflow-hidden rounded-[24px] border-slate-200 bg-white shadow-sm">
                    <div className="relative aspect-square bg-slate-50">
                      <Image src={result.url} alt={`Upscaled ${result.size}`} fill className="object-contain p-3" sizes="(max-width: 768px) 100vw, 33vw" />
                      <div className="absolute left-3 top-3">
                        <Badge className="rounded-full bg-slate-900 text-white hover:bg-slate-900">
                          {result.size}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-3 p-4">
                      <div>
                        <p className="text-sm font-medium text-slate-950">Upscaled Output</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{result.fileName}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="rounded-full border-slate-200" onClick={() => handleDownload(result.url)}>
                          <Download className="mr-1 h-3.5 w-3.5" />
                          Download
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-full border-slate-200" onClick={() => handleCopyUrl(result.url)}>
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          Copy URL
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
