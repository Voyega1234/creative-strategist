"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import {
  ArrowDownToLine,
  Check,
  ExternalLink,
  ImagePlus,
  Loader2,
  RefreshCw,
  RotateCcw,
  Scaling,
  Upload,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  SUPPORTED_ASPECT_RATIO_LABELS,
  dataUrlToBlob,
  downloadBlob,
  uploadFileToImageStorage,
  uploadGeneratedImageBlob,
  type SupportedAspectRatioLabel,
} from "@/lib/images/client"
import { cn } from "@/lib/utils"

type ResizeStatus = "queued" | "generating" | "retrying" | "completed" | "failed"

type ResizeResult = {
  aspectRatio: SupportedAspectRatioLabel
  status: ResizeStatus
  attempts: number
  publicUrl?: string
  outputBlob?: Blob
  dimensions?: { width: number; height: number }
  error?: string
}

type ResizeApiResponse = {
  success?: boolean
  image_url?: string
  image_data_url?: string
  error?: string
}

type ImageResizePanelProps = {
  productFocus?: string | null
}

const DEFAULT_RATIOS: SupportedAspectRatioLabel[] = ["1:1", "4:5", "16:9", "9:16"]

async function readResizeResponse(response: Response): Promise<ResizeApiResponse> {
  const rawText = await response.text()
  if (!rawText) return {}

  try {
    return JSON.parse(rawText) as ResizeApiResponse
  } catch {
    throw new Error(rawText.replace(/\s+/g, " ").trim() || `Resize failed (${response.status})`)
  }
}

async function responseImageToBlob(payload: ResizeApiResponse) {
  if (payload.image_data_url) return dataUrlToBlob(payload.image_data_url)

  if (payload.image_url) {
    const response = await fetch(payload.image_url)
    if (!response.ok) throw new Error(`Cannot download resized image (${response.status})`)
    return response.blob()
  }

  throw new Error("Resize response did not include an image.")
}

async function getBlobDimensions(blob: Blob) {
  const bitmap = await createImageBitmap(blob)
  const dimensions = { width: bitmap.width, height: bitmap.height }
  bitmap.close()
  return dimensions
}

function matchesAspectRatio(
  dimensions: { width: number; height: number },
  aspectRatio: SupportedAspectRatioLabel,
) {
  const [width, height] = aspectRatio.split(":").map(Number)
  return Math.abs(dimensions.width / dimensions.height - width / height) <= 0.04
}

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let nextIndex = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex]
        nextIndex += 1
        await worker(item)
      }
    }),
  )
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ImageResizePanel({ productFocus = null }: ImageResizePanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState("")
  const [sourcePublicUrl, setSourcePublicUrl] = useState("")
  const [selectedRatios, setSelectedRatios] = useState<SupportedAspectRatioLabel[]>(DEFAULT_RATIOS)
  const [results, setResults] = useState<ResizeResult[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    return () => {
      if (sourcePreviewUrl) URL.revokeObjectURL(sourcePreviewUrl)
    }
  }, [sourcePreviewUrl])

  const selectSourceFile = (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) {
      setError("Please choose a PNG, JPG, or WebP image.")
      return
    }

    setSourceFile(file)
    setSourcePreviewUrl(URL.createObjectURL(file))
    setSourcePublicUrl("")
    setResults([])
    setError("")
  }

  const toggleRatio = (ratio: SupportedAspectRatioLabel) => {
    if (isProcessing) return
    setSelectedRatios((current) =>
      current.includes(ratio) ? current.filter((item) => item !== ratio) : [...current, ratio],
    )
  }

  const updateResult = (aspectRatio: SupportedAspectRatioLabel, patch: Partial<ResizeResult>) => {
    setResults((current) =>
      current.map((result) =>
        result.aspectRatio === aspectRatio ? { ...result, ...patch } : result,
      ),
    )
  }

  const ensureSourceUrl = async () => {
    if (sourcePublicUrl) return sourcePublicUrl
    if (!sourceFile) throw new Error("Upload a source image first.")

    const publicUrl = await uploadFileToImageStorage(sourceFile, "generated/resize-image-inputs")
    setSourcePublicUrl(publicUrl)
    return publicUrl
  }

  const requestResize = async (aspectRatio: SupportedAspectRatioLabel, imageUrl: string) => {
    const response = await fetch("/api/edit-image-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        instruction: "Resize this image while preserving all existing content and visual details.",
        operation: "resize",
        output_aspect_ratio: aspectRatio,
        output_image_size: "2K",
        product_focus: productFocus,
      }),
    })
    const payload = await readResizeResponse(response)

    if (!response.ok || !payload.success) {
      throw new Error(payload.error || `Cannot resize image to ${aspectRatio}`)
    }

    return payload
  }

  const resizeRatio = async (aspectRatio: SupportedAspectRatioLabel, imageUrl: string) => {
    let lastError: unknown = null

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      updateResult(aspectRatio, {
        status: attempt === 1 ? "generating" : "retrying",
        attempts: attempt,
        error: undefined,
      })

      try {
        const payload = await requestResize(aspectRatio, imageUrl)
        const outputBlob = await responseImageToBlob(payload)
        const dimensions = await getBlobDimensions(outputBlob)

        if (!matchesAspectRatio(dimensions, aspectRatio)) {
          throw new Error(`Output does not match ${aspectRatio}`)
        }

        const publicUrl =
          payload.image_url ||
          (await uploadGeneratedImageBlob(
            outputBlob,
            "generated/resize-image-outputs",
            aspectRatio.replace(":", "x"),
          ))

        updateResult(aspectRatio, {
          status: "completed",
          publicUrl,
          outputBlob,
          dimensions,
        })
        return
      } catch (resizeError) {
        lastError = resizeError
      }
    }

    updateResult(aspectRatio, {
      status: "failed",
      error: lastError instanceof Error ? lastError.message : "Resize failed",
    })
  }

  const handleResize = async () => {
    if (!sourceFile || isProcessing) return
    if (selectedRatios.length === 0) {
      setError("Select at least one output size.")
      return
    }

    setIsProcessing(true)
    setError("")
    setResults(selectedRatios.map((aspectRatio) => ({ aspectRatio, status: "queued", attempts: 0 })))

    try {
      const imageUrl = await ensureSourceUrl()
      const runRatio = (ratio: SupportedAspectRatioLabel) => resizeRatio(ratio, imageUrl)
      await runWithConcurrency(selectedRatios, 2, runRatio)
    } catch (resizeError) {
      const message = resizeError instanceof Error ? resizeError.message : "Cannot resize image"
      setError(message)
      setResults((current) =>
        current.map((result) =>
          result.status === "queued" ? { ...result, status: "failed", error: message } : result,
        ),
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRetry = async (ratio: SupportedAspectRatioLabel) => {
    if (isProcessing) return
    setIsProcessing(true)
    setError("")

    try {
      const imageUrl = await ensureSourceUrl()
      await resizeRatio(ratio, imageUrl)
    } catch (resizeError) {
      setError(resizeError instanceof Error ? resizeError.message : "Cannot resize image")
    } finally {
      setIsProcessing(false)
    }
  }

  const reset = () => {
    setSourceFile(null)
    setSourcePreviewUrl("")
    setSourcePublicUrl("")
    setSelectedRatios(DEFAULT_RATIOS)
    setResults([])
    setError("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const downloadAll = () => {
    results
      .filter((result) => result.status === "completed" && result.outputBlob)
      .forEach((result, index) => {
        window.setTimeout(() => {
          void downloadBlob(result.outputBlob!, `resized-${result.aspectRatio.replace(":", "x")}.jpg`)
        }, index * 250)
      })
  }

  const completedCount = results.filter((result) => result.status === "completed").length

  return (
    <div className="h-full overflow-y-auto rounded-[28px] border border-black/10 bg-[#f7f8fa] p-4 shadow-[0_18px_45px_rgba(15,23,42,0.07)] sm:p-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          selectSourceFile(event.target.files?.[0] || null)
          event.target.value = ""
        }}
      />

      <div className="mb-6 max-w-2xl">
        <h2 className="text-2xl font-semibold tracking-tight text-[#1f1f1f] sm:text-3xl">Resize Image</h2>
        <p className="mt-2 text-sm leading-6 text-[#667085] sm:text-base">
          Upload one image and choose the aspect ratios you need.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <section className="min-h-[440px] rounded-[24px] border border-black/10 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-[#1f1f1f]">Source image</h3>
              <p className="mt-1 text-sm text-[#667085]">PNG, JPG or WebP</p>
            </div>
            {sourceFile ? (
              <Button type="button" variant="outline" className="rounded-full" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
                <Upload className="mr-2 h-4 w-4" />
                Replace
              </Button>
            ) : null}
          </div>

          {sourceFile ? (
            <div className="mt-5 flex min-h-[340px] flex-col">
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[20px] bg-[#f3f4f6] p-4">
                <Image
                  src={sourcePreviewUrl}
                  alt="Source selected for resizing"
                  width={1600}
                  height={1200}
                  unoptimized
                  className="h-auto max-h-[48vh] w-auto max-w-full object-contain"
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <p className="min-w-0 truncate font-medium text-[#344054]">{sourceFile.name}</p>
                <span className="shrink-0 text-[#667085]">{formatFileSize(sourceFile.size)}</span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                selectSourceFile(event.dataTransfer.files?.[0] || null)
              }}
              className="mt-5 flex min-h-[340px] w-full flex-col items-center justify-center rounded-[20px] border border-dashed border-[#c8cdd5] bg-[#fafafa] p-8 text-center transition hover:border-[#667085] hover:bg-[#f7f8fa] active:scale-[0.99]"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1f1f1f] text-white">
                <ImagePlus className="h-6 w-6" />
              </span>
              <span className="mt-4 text-base font-semibold text-[#1f1f1f]">Upload image</span>
              <span className="mt-1 text-sm text-[#667085]">Click or drop an image here</span>
            </button>
          )}
        </section>

        <section className="rounded-[24px] border border-black/10 bg-white p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-[#1f1f1f]">Output sizes</h3>
              <p className="mt-1 text-sm text-[#667085]">Select one or more aspect ratios</p>
            </div>
            <span className="shrink-0 text-sm font-medium text-[#475467]">{selectedRatios.length} selected</span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
            {SUPPORTED_ASPECT_RATIO_LABELS.map((ratio) => {
              const selected = selectedRatios.includes(ratio)
              return (
                <button
                  key={ratio}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleRatio(ratio)}
                  disabled={isProcessing}
                  className={cn(
                    "relative flex min-h-24 flex-col items-center justify-center rounded-2xl border px-3 py-3 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
                    selected
                      ? "border-[#1f1f1f] bg-[#1f1f1f] text-white"
                      : "border-black/10 bg-[#fafafa] text-[#344054] hover:border-black/25 hover:bg-white",
                  )}
                >
                  <span
                    className={cn("block max-h-10 max-w-12 border-2", selected ? "border-white" : "border-[#98a2b3]")}
                    style={{ aspectRatio: ratio.replace(":", " / "), height: "32px" }}
                  />
                  <span className="mt-2 text-sm font-semibold">{ratio}</span>
                  {selected ? <Check className="absolute right-2 top-2 h-3.5 w-3.5" /> : null}
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setSelectedRatios(DEFAULT_RATIOS)} disabled={isProcessing}>
              PMax defaults
            </Button>
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setSelectedRatios([...SUPPORTED_ASPECT_RATIO_LABELS])} disabled={isProcessing}>
              Select all
            </Button>
            <Button type="button" variant="ghost" size="sm" className="rounded-full text-[#667085]" onClick={() => setSelectedRatios([])} disabled={isProcessing}>
              Clear
            </Button>
          </div>

          <a
            href="https://www.iloveimg.com/resize-image"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-3 text-left transition hover:border-black/25 hover:bg-white active:scale-[0.99]"
          >
            <span>
              <span className="block text-sm font-semibold text-[#344054]">ต้องการกำหนดขนาดเป็น Pixel?</span>
              <span className="mt-0.5 block text-xs leading-5 text-[#667085]">
                เช่น แปลงภาพจาก 1450 × 1450 px เป็น 1080 × 1080 px ด้วย iLoveIMG
              </span>
            </span>
            <ExternalLink className="h-4 w-4 shrink-0 text-[#667085]" />
          </a>

          {error ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

          <Button
            type="button"
            className="mt-5 h-12 w-full rounded-full bg-[#1f1f1f] text-base font-semibold text-white hover:bg-[#303030] active:scale-[0.99]"
            onClick={() => void handleResize()}
            disabled={!sourceFile || selectedRatios.length === 0 || isProcessing}
          >
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Scaling className="mr-2 h-4 w-4" />}
            {isProcessing ? "Resizing..." : `Resize ${selectedRatios.length} size${selectedRatios.length === 1 ? "" : "s"}`}
          </Button>
          <p className="mt-3 text-center text-xs leading-5 text-[#667085]">Two sizes process at a time. Failed ratios retry once.</p>
        </section>
      </div>

      {results.length > 0 ? (
        <section className="mt-4 rounded-[24px] border border-black/10 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-[#1f1f1f]">Resized images</h3>
              <p className="mt-1 text-sm text-[#667085]">{completedCount} of {results.length} ready</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="rounded-full" onClick={reset} disabled={isProcessing}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Start over
              </Button>
              <Button type="button" className="rounded-full bg-[#1f1f1f] text-white hover:bg-[#303030]" onClick={downloadAll} disabled={completedCount === 0}>
                <ArrowDownToLine className="mr-2 h-4 w-4" />
                Download all
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((result) => (
              <article key={result.aspectRatio} className="rounded-[20px] border border-black/10 bg-[#fafafa] p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-[#1f1f1f]">{result.aspectRatio}</span>
                  <span className={cn("text-xs font-medium", result.status === "failed" ? "text-red-600" : "text-[#667085]")}>{result.status}</span>
                </div>

                {result.publicUrl ? (
                  <div className="mt-3 flex h-52 items-center justify-center overflow-hidden rounded-2xl bg-white p-3">
                    <Image
                      src={result.publicUrl}
                      alt={`Resized output ${result.aspectRatio}`}
                      width={1600}
                      height={1200}
                      unoptimized
                      className="h-auto max-h-full w-auto max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="mt-3 flex h-52 items-center justify-center rounded-2xl bg-[#eef0f3] px-5 text-center text-sm text-[#667085]">
                    {result.status === "failed" ? result.error || "Resize failed" : <Loader2 className="h-5 w-5 animate-spin" />}
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 rounded-full"
                    disabled={!result.outputBlob}
                    onClick={() => result.outputBlob && void downloadBlob(result.outputBlob, `resized-${result.aspectRatio.replace(":", "x")}.jpg`)}
                  >
                    <ArrowDownToLine className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  {result.status === "failed" ? (
                    <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={() => void handleRetry(result.aspectRatio)} disabled={isProcessing}>
                      <RefreshCw className="h-4 w-4" />
                      <span className="sr-only">Retry {result.aspectRatio}</span>
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
