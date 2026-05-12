"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  Download,
  Eraser,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { downloadImageFromUrl, downloadImagesFromUrls, uploadDataUrlToImageStorage, uploadFileToImageStorage } from "@/lib/images/client"
import { cn } from "@/lib/utils"
import { MaterialToSceneError } from "@/components/material-to-scene/material-to-scene-error"
import { MaterialToSceneHeader } from "@/components/material-to-scene/material-to-scene-header"
import { MaterialToSceneSteps } from "@/components/material-to-scene/material-to-scene-steps"

type Preset = "Ad Creative" | "E-commerce Product Shot" | "Interior & Material" | "Social Media Content"
type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "9:16" | "16:9" | "21:9"
type ImageSize = "1K" | "2K" | "4K"

const DEFAULT_PRESET: Preset = "Ad Creative"
const DEFAULT_IMAGE_SIZE: ImageSize = "1K"

const ASPECT_RATIOS: AspectRatio[] = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "9:16", "16:9", "21:9"]
const MAX_SCENE_REFERENCES = 3
const DEFAULT_GENERATED_SCENE_COUNT = 4

type SceneReference = {
  file: File
  previewUrl: string
}

async function uploadFileToStorage(file: File) {
  return uploadFileToImageStorage(file, "generated/material-to-scene-inputs")
}

async function uploadDataUrlToStorage(dataUrl: string) {
  return uploadDataUrlToImageStorage(dataUrl, "generated/material-to-scene-temp")
}

export function MaterialToScenePanel() {
  const [file, setFile] = useState<File | null>(null)
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null)
  const [sceneReferences, setSceneReferences] = useState<SceneReference[]>([])
  const [prompt, setPrompt] = useState("")
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1")
  const [generatedImageUrls, setGeneratedImageUrls] = useState<string[]>([])
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRemovingBg, setIsRemovingBg] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const sceneInputRef = useRef<HTMLInputElement | null>(null)
  const sceneReferencesRef = useRef<SceneReference[]>([])
  const generationInFlightRef = useRef(false)
  const removeBackgroundInFlightRef = useRef(false)

  useEffect(() => {
    return () => {
      if (originalImageUrl) {
        URL.revokeObjectURL(originalImageUrl)
      }
    }
  }, [originalImageUrl])

  useEffect(() => {
    sceneReferencesRef.current = sceneReferences
  }, [sceneReferences])

  useEffect(() => {
    return () => {
      sceneReferencesRef.current.forEach((reference) => URL.revokeObjectURL(reference.previewUrl))
    }
  }, [])

  const currentImageUrl = generatedImageUrls[selectedImageIndex] || ""
  const hasOutput = generatedImageUrls.length > 0
  const canGenerate = Boolean(file && prompt.trim())

  const uploadHint = useMemo(() => {
    if (!file) return "อัปโหลด material photo เพื่อให้ระบบวิเคราะห์ texture และสร้าง scene ใหม่"
    return `${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB`
  }, [file])

  const handleFileSelect = (selectedFile: File) => {
    if (originalImageUrl) {
      URL.revokeObjectURL(originalImageUrl)
    }

    setFile(selectedFile)
    setOriginalImageUrl(URL.createObjectURL(selectedFile))
    setGeneratedImageUrls([])
    setSelectedImageIndex(0)
    setError(null)
  }

  const handleSceneReferencesSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles?.length) return

    const nextReferences = Array.from(selectedFiles)
      .slice(0, Math.max(MAX_SCENE_REFERENCES - sceneReferences.length, 0))
      .map((selectedFile) => ({
        file: selectedFile,
        previewUrl: URL.createObjectURL(selectedFile),
      }))

    if (nextReferences.length === 0) return

    setSceneReferences((prev) => [...prev, ...nextReferences].slice(0, MAX_SCENE_REFERENCES))
    setGeneratedImageUrls([])
    setSelectedImageIndex(0)
    setError(null)
  }

  const handleRemoveSceneReference = (indexToRemove: number) => {
    setSceneReferences((prev) => {
      const removed = prev[indexToRemove]
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl)
      }
      return prev.filter((_, index) => index !== indexToRemove)
    })
    setGeneratedImageUrls([])
    setSelectedImageIndex(0)
  }

  const handleGenerate = async () => {
    if (generationInFlightRef.current) return

    if (!file) {
      alert("กรุณาอัปโหลด material photo ก่อน")
      return
    }

    if (!prompt.trim()) {
      alert("กรุณาใส่ prompt ก่อน generate")
      return
    }

    generationInFlightRef.current = true
    setIsGenerating(true)
    setError(null)

    try {
      const referenceImageUrl = await uploadFileToStorage(file)
      const sceneReferenceImageUrls =
        sceneReferences.length > 0
          ? await Promise.all(sceneReferences.map((reference) => uploadFileToStorage(reference.file)))
          : []
      const response = await fetch("/api/material-to-scene", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "generate",
          reference_image_url: referenceImageUrl,
          scene_reference_image_urls: sceneReferenceImageUrls,
          mime_type: file.type,
          preset: DEFAULT_PRESET,
          prompt: prompt.trim(),
          aspect_ratio: aspectRatio,
          image_size: DEFAULT_IMAGE_SIZE,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result?.error || "ไม่สามารถสร้าง Material to Scene ได้")
      }

      const urls = Array.isArray(result.images)
        ? result.images
            .map((image: { data_url?: string; url?: string }) => image.url || image.data_url)
            .filter((value: string | undefined): value is string => Boolean(value))
        : []

      if (urls.length === 0) {
        throw new Error("ไม่พบภาพที่สร้างจากระบบ")
      }

      setGeneratedImageUrls(urls)
      setSelectedImageIndex(0)
    } catch (err) {
      console.error("Material to Scene generation failed:", err)
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการสร้างภาพ"
      setError(message)
      alert(message)
    } finally {
      generationInFlightRef.current = false
      setIsGenerating(false)
    }
  }

  const handleRemoveBackground = async () => {
    if (removeBackgroundInFlightRef.current) return
    if (!currentImageUrl) return

    removeBackgroundInFlightRef.current = true
    setIsRemovingBg(true)
    setError(null)

    try {
      const { publicUrl, mimeType } = await uploadDataUrlToStorage(currentImageUrl)
      const response = await fetch("/api/material-to-scene", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "remove_background",
          image_url: publicUrl,
          mime_type: mimeType,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result.success || !result.image_data_url) {
        throw new Error(result?.error || "ไม่สามารถลบพื้นหลังได้")
      }

      setGeneratedImageUrls((prev) => {
        const next = [...prev]
        next[selectedImageIndex] = result.image_data_url
        return next
      })
    } catch (err) {
      console.error("Material to Scene remove background failed:", err)
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการลบพื้นหลัง"
      setError(message)
      alert(message)
    } finally {
      removeBackgroundInFlightRef.current = false
      setIsRemovingBg(false)
    }
  }

  const handleBackToEditor = () => {
    setGeneratedImageUrls([])
    setSelectedImageIndex(0)
    setError(null)
  }

  return (
    <div className="space-y-8">
      <MaterialToSceneHeader aspectRatio={aspectRatio} />

      <MaterialToSceneError message={error} />

      {!hasOutput ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
          <Card className="rounded-[32px] border-slate-200/80 bg-white p-7 shadow-[0_14px_32px_rgba(15,23,42,0.04)]">
            <div className="space-y-8">
              <MaterialToSceneSteps />

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const selectedFile = event.target.files?.[0]
                  if (selectedFile) {
                    handleFileSelect(selectedFile)
                  }
                }}
              />
              <input
                ref={sceneInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  handleSceneReferencesSelect(event.target.files)
                  event.target.value = ""
                }}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "group flex min-h-[320px] w-full items-center justify-center overflow-hidden rounded-[30px] border border-dashed transition-all",
                  file
                    ? "border-slate-300 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] hover:border-slate-400"
                    : "border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] hover:border-slate-300",
                )}
              >
                {originalImageUrl ? (
                  <div className="grid h-full w-full gap-6 p-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
                    <div className="relative mx-auto aspect-square w-full max-w-[220px] overflow-hidden rounded-[24px] bg-slate-50 shadow-sm">
                      <img src={originalImageUrl} alt="Material preview" className="h-full w-full object-contain" />
                    </div>
                    <div className="space-y-3 text-left">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Material ready</p>
                      <h3 className="text-2xl font-semibold tracking-[-0.02em] text-slate-950">Replace or keep this material</h3>
                      <p className="max-w-xl text-base leading-7 text-slate-600">
                        ระบบจะใช้ภาพนี้เป็น hero material แล้วพยายามรักษา texture, color และ surface เดิมให้มากที่สุดใน scene ใหม่
                      </p>
                      <p className="text-base text-slate-500">{uploadHint}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 px-6 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-slate-950 text-white shadow-sm">
                      <UploadCloud className="h-7 w-7" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold tracking-[-0.02em] text-slate-950">Upload material photo</h3>
                      <p className="mx-auto max-w-md text-base leading-7 text-slate-600">
                        อัปโหลดภาพสินค้า, วัสดุ, texture sample หรือ product detail shot ที่ต้องการเอาไปสร้างเป็น scene ใหม่
                      </p>
                    </div>
                    <p className="text-sm text-slate-500">JPG, PNG, WEBP</p>
                  </div>
                )}
              </button>

              <div className="rounded-[30px] border border-slate-200 bg-slate-50/70 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Optional Scene Reference
                    </p>
                    <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-slate-950">
                      Upload scene or background guide
                    </h3>
                    <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">
                      ใช้เป็น background/source scene ได้ด้วย เช่น คงฉากเดิม เปลี่ยนเฉพาะ object ตาม material แล้วปรับมุมกล้อง แสง
                      และเงาให้เนียนเหมือนภาพถ่ายจริง
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => sceneInputRef.current?.click()}
                    disabled={sceneReferences.length >= MAX_SCENE_REFERENCES}
                    className="h-11 shrink-0 rounded-2xl border-slate-200 bg-white"
                  >
                    <UploadCloud className="mr-2 h-4 w-4" />
                    {sceneReferences.length ? "Add scene" : "Upload scene"}
                  </Button>
                </div>

                {sceneReferences.length > 0 ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {sceneReferences.map((reference, index) => (
                      <div key={reference.previewUrl} className="relative overflow-hidden rounded-[20px] border border-slate-200 bg-white">
                        <div className="aspect-[4/3] bg-slate-100">
                          <img
                            src={reference.previewUrl}
                            alt={`Scene reference ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSceneReference(index)}
                          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/75 text-white shadow-sm backdrop-blur transition-colors hover:bg-black"
                          aria-label={`Remove scene reference ${index + 1}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <div className="px-3 py-2">
                          <p className="truncate text-sm font-medium text-slate-900">{reference.file.name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{(reference.file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[22px] border border-dashed border-slate-200 bg-white px-4 py-5 text-sm leading-6 text-slate-500">
                    ถ้าไม่อัปโหลด scene reference ระบบจะสร้างฉากจาก scene brief อย่างเดียว
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Scene Brief</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-slate-950">Describe what you want to create</h3>
                  </div>
                  {prompt.trim() && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
                      {prompt.trim().length} chars
                    </span>
                  )}
                </div>
                <Textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="เช่น: ใช้ material นี้เป็น hero wall panel ใน living room modern luxury แสงธรรมชาติช่วงเช้า soft shadow โทนอุ่น composition แบบงาน interior campaign มีเฟอร์นิเจอร์น้อยแต่ดูพรีเมียม"
                  className="min-h-[180px] resize-none rounded-[24px] border-slate-200 bg-white px-5 py-4 text-slate-950 focus:border-slate-950 focus:ring-0"
                />
                <p className="text-sm leading-6 text-slate-500">
                  เขียนให้ตรงงาน เช่น “เปลี่ยนเสื้อบนเก้าอี้ให้เป็น material นี้ ใช้พื้นหลังเดิม และเปลี่ยนแค่มุมกล้อง”
                </p>
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="rounded-[28px] border-slate-200/80 bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Output</p>
                  <h3 className="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-slate-950">Format settings</h3>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <ImageIcon className="h-3.5 w-3.5 text-slate-700" />
                    Aspect ratio
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ASPECT_RATIOS.map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setAspectRatio(ratio)}
                        className={cn(
                          "rounded-full border px-2.5 py-1.5 text-sm font-medium transition-all",
                          aspectRatio === ratio
                            ? "border-slate-950 bg-slate-950 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                        )}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[20px] bg-slate-50 px-3.5 py-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Current setup</p>
                  <div className="mt-2.5 space-y-1.5 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-3">
                      <span>Aspect ratio</span>
                      <span className="font-medium text-slate-900">{aspectRatio}</span>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!canGenerate || isGenerating}
                  className="h-11 w-full rounded-2xl bg-slate-950 text-sm font-medium text-white hover:bg-slate-800"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating {DEFAULT_GENERATED_SCENE_COUNT} scenes...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate {DEFAULT_GENERATED_SCENE_COUNT} scenes
                    </>
                  )}
                </Button>
                <p className="text-xs leading-5 text-slate-500">
                  {!canGenerate
                    ? "ต้องมี material photo และ scene brief ก่อนจึงจะ generate ได้"
                    : `พร้อมสร้างแล้ว ระบบจะ generate scene ใหม่ ${DEFAULT_GENERATED_SCENE_COUNT} ภาพ`}
                </p>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <Card className="rounded-[32px] border-slate-200/80 bg-white p-7 shadow-[0_14px_32px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={handleBackToEditor}
                className="w-fit rounded-full px-0 text-slate-500 hover:bg-transparent hover:text-slate-900"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to editor
              </Button>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={isGenerating || isRemovingBg}
                  className="rounded-full border-slate-200"
                >
                  <RefreshCw className={cn("mr-2 h-4 w-4", isGenerating && "animate-spin")} />
                  Regenerate
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRemoveBackground}
                  disabled={!currentImageUrl || isGenerating || isRemovingBg}
                  className="rounded-full border-slate-200"
                >
                  {isRemovingBg ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eraser className="mr-2 h-4 w-4" />}
                  Remove BG
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => generatedImageUrls.length && downloadImagesFromUrls(generatedImageUrls, "material-to-scene")}
                  disabled={!generatedImageUrls.length || isGenerating}
                  className="rounded-full border-slate-200"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download all
                </Button>
                <Button
                  type="button"
                  onClick={() => currentImageUrl && void downloadImageFromUrl(currentImageUrl, `material-to-scene-${selectedImageIndex + 1}.png`)}
                  disabled={!currentImageUrl || isGenerating}
                  className="rounded-full bg-slate-950 text-white hover:bg-slate-800"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download selected
                </Button>
              </div>
            </div>
          </Card>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_320px]">
            <Card className="rounded-[28px] border-slate-200/80 bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Generated Scenes</p>
                    <h3 className="mt-1.5 text-xl font-semibold tracking-[-0.02em] text-slate-950">Review the output</h3>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                    {selectedImageIndex + 1} / {generatedImageUrls.length}
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px] lg:items-stretch">
                  <button
                    type="button"
                    onClick={() => currentImageUrl && setIsPreviewOpen(true)}
                    disabled={!currentImageUrl}
                    className="relative mx-auto block w-full max-w-[580px] overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,_#f8fafc_0%,_#ffffff_100%)] text-left transition-transform lg:max-w-[540px]"
                  >
                    <div className="aspect-[6/5] min-h-[300px] lg:h-full lg:min-h-[490px] lg:aspect-auto">
                      {isGenerating ? (
                        <div className="flex h-full items-center justify-center">
                          <div className="flex flex-col items-center text-slate-500">
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <p className="mt-3 text-sm">Generating {DEFAULT_GENERATED_SCENE_COUNT} new scenes...</p>
                          </div>
                        </div>
                      ) : isRemovingBg ? (
                        <div className="flex h-full items-center justify-center">
                          <div className="flex flex-col items-center text-slate-500">
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <p className="mt-3 text-sm">Removing background...</p>
                          </div>
                        </div>
                      ) : currentImageUrl ? (
                        <img src={currentImageUrl} alt="Generated scene" className="h-full w-full object-contain" />
                      ) : null}
                    </div>
                    {currentImageUrl && !isGenerating && !isRemovingBg ? (
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-black/30 via-transparent to-transparent p-3">
                        <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm backdrop-blur">
                          Click to zoom
                        </span>
                      </div>
                    ) : null}
                  </button>

                  <div className="grid grid-cols-2 gap-2 lg:h-full lg:grid-cols-1 lg:grid-rows-2">
                    {generatedImageUrls.map((url, index) => (
                      <div
                        key={`${url}-${index}`}
                        className={cn(
                          "relative overflow-hidden rounded-[18px] border bg-white transition-all lg:h-full",
                          selectedImageIndex === index
                            ? "border-slate-950 shadow-[0_10px_20px_rgba(15,23,42,0.08)]"
                            : "border-slate-200 hover:border-slate-300",
                        )}
                      >
                        <button type="button" onClick={() => setSelectedImageIndex(index)} className="block w-full lg:h-full">
                          <div className="aspect-square bg-slate-50 lg:h-full lg:aspect-auto">
                            <img src={url} alt={`Generated scene ${index + 1}`} className="h-full w-full object-cover" />
                          </div>
                        </button>
                        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2">
                          <span className="rounded-full bg-white/90 px-2 py-1 text-[10px] font-medium text-slate-600 shadow-sm backdrop-blur">
                            Image {index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => void downloadImageFromUrl(url, `material-to-scene-${index + 1}.png`)}
                            className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-slate-950"
                            aria-label={`Download image ${index + 1}`}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <div className="space-y-5">
              <Card className="rounded-[28px] border-slate-200/80 bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Reference</p>
                    <h3 className="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-slate-950">Original material</h3>
                  </div>
                  <div className="relative overflow-hidden rounded-[20px] bg-slate-50">
                    <div className="aspect-square">
                      {originalImageUrl ? (
                        <img src={originalImageUrl} alt="Original material" className="h-full w-full object-contain" />
                      ) : null}
                    </div>
                  </div>
                </div>
              </Card>

              {sceneReferences.length > 0 ? (
                <Card className="rounded-[28px] border-slate-200/80 bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
                  <div className="space-y-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Scene Reference</p>
                      <h3 className="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-slate-950">
                        Background guide
                      </h3>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {sceneReferences.map((reference, index) => (
                        <div key={reference.previewUrl} className="overflow-hidden rounded-[14px] bg-slate-50">
                          <div className="aspect-square">
                            <img
                              src={reference.previewUrl}
                              alt={`Scene reference ${index + 1}`}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm leading-6 text-slate-500">
                      Scene reference ใช้เป็นฉากตั้งต้นได้ ถ้า prompt ระบุให้คงพื้นหลังเดิม ระบบจะพยายามเปลี่ยนเฉพาะ object/material ที่สั่ง
                    </p>
                  </div>
                </Card>
              ) : null}

              <Card className="rounded-[28px] border-slate-200/80 bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
                <div className="space-y-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Scene setup</p>
                  <div className="space-y-2.5 text-base text-slate-600">
                    <div className="flex items-center justify-between gap-3">
                      <span>Aspect ratio</span>
                      <span className="font-medium text-slate-900">{aspectRatio}</span>
                    </div>
                  </div>
                  <div className="rounded-[20px] bg-slate-50 px-3.5 py-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Brief</p>
                    <p className="mt-2.5 text-base leading-7 text-slate-600">{prompt}</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl border-slate-200 p-0">
          <DialogHeader className="border-b border-slate-200 px-6 py-4">
            <DialogTitle className="text-base text-slate-950">Preview image {selectedImageIndex + 1}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(92vh-72px)] overflow-auto bg-[linear-gradient(180deg,_#f8fafc_0%,_#ffffff_100%)] p-4 sm:p-6">
            {currentImageUrl ? (
              <img src={currentImageUrl} alt={`Preview image ${selectedImageIndex + 1}`} className="mx-auto h-auto max-w-full rounded-[20px] object-contain" />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
