"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { downloadImageFromUrl, downloadImagesFromUrls, uploadDataUrlToImageStorage, uploadFileToImageStorage } from "@/lib/images/client"
import { cn } from "@/lib/utils"
import { MaterialToSceneError } from "@/components/material-to-scene/material-to-scene-error"
import { MaterialToSceneHeader } from "@/components/material-to-scene/material-to-scene-header"
import {
  GeneratedImageGallery,
  type ImageGenerationSession,
} from "@/components/generated-image-gallery"

type Preset = "Ad Creative" | "E-commerce Product Shot" | "Interior & Material" | "Social Media Content"
type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "9:16" | "16:9" | "21:9"
type ImageSize = "1K" | "2K" | "4K"
type PhotographyStyle =
  | "auto"
  | "clean-white"
  | "lifestyle"
  | "minimal"
  | "dark-moody"
  | "natural-light"
  | "flat-lay"
  | "hero-shot"
  | "texture-rich"
  | "reflection"
  | "pop-color"

const DEFAULT_PRESET: Preset = "Ad Creative"
const DEFAULT_IMAGE_SIZE: ImageSize = "1K"

const ASPECT_RATIOS: AspectRatio[] = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "9:16", "16:9", "21:9"]
const MAX_SCENE_REFERENCES = 3
const DEFAULT_GENERATED_SCENE_COUNT = 4
const PROMPT_GUIDE_IMAGES = [
  "https://jztytulnuaxqkrwrymrt.supabase.co/storage/v1/object/public/images_document/714323688_26825581140398513_5075227470531270632_n.jpg",
  "https://jztytulnuaxqkrwrymrt.supabase.co/storage/v1/object/public/images_document/714840598_26825579840398643_4814536452737644819_n.jpg",
  "https://jztytulnuaxqkrwrymrt.supabase.co/storage/v1/object/public/images_document/712644070_26825580187065275_6773900674408780827_n.jpg",
  "https://jztytulnuaxqkrwrymrt.supabase.co/storage/v1/object/public/images_document/711466084_26825579797065314_1169710766738408931_n.jpg",
  "https://jztytulnuaxqkrwrymrt.supabase.co/storage/v1/object/public/images_document/712586086_26825580647065229_1204656809304785058_n.jpg",
  "https://jztytulnuaxqkrwrymrt.supabase.co/storage/v1/object/public/images_document/713328683_26825580620398565_5089659842261570408_n.jpg",
  "https://jztytulnuaxqkrwrymrt.supabase.co/storage/v1/object/public/images_document/714223586_26825579770398650_4047996130643631903_n.jpg",
  "https://jztytulnuaxqkrwrymrt.supabase.co/storage/v1/object/public/images_document/713843467_26825581153731845_4863941376081867232_n.jpg",
  "https://jztytulnuaxqkrwrymrt.supabase.co/storage/v1/object/public/images_document/714466175_26825580263731934_8112067728227924977_n.jpg",
] as const
const PHOTOGRAPHY_STYLES: Array<{
  value: PhotographyStyle
  label: string
  description: string
}> = [
  { value: "auto", label: "Auto — Follow brief", description: "ให้ระบบเลือกสไตล์จาก scene brief และ reference" },
  { value: "clean-white", label: "Clean White", description: "พื้นขาวสะอาด แสงสตูดิโอนุ่ม รายละเอียดสินค้าชัด" },
  { value: "lifestyle", label: "Lifestyle", description: "จัดสินค้าในสถานการณ์ใช้งานจริงและดูเป็นธรรมชาติ" },
  { value: "minimal", label: "Minimal", description: "องค์ประกอบน้อย พื้นที่ว่างชัด และสินค้าเด่น" },
  { value: "dark-moody", label: "Dark & Moody", description: "โทนเข้ม คอนทราสต์สูง และแสงดรามาติก" },
  { value: "natural-light", label: "Natural Light", description: "แสงธรรมชาติอบอุ่นพร้อมเงาที่สมจริง" },
  { value: "flat-lay", label: "Flat Lay", description: "มุมมองจากด้านบนพร้อมองค์ประกอบที่เป็นระบบ" },
  { value: "hero-shot", label: "Hero Shot", description: "มุมทรงพลัง เน้นรูปทรงและความโดดเด่นของสินค้า" },
  { value: "texture-rich", label: "Texture Rich", description: "เน้นพื้นผิว วัสดุ และรายละเอียดสัมผัส" },
  { value: "reflection", label: "Reflection", description: "ใช้เงาสะท้อนที่ควบคุมอย่างประณีตเพื่อเพิ่มมิติ" },
  { value: "pop-color", label: "Pop Color", description: "สีสดและ color blocking ที่ทำให้สินค้าสะดุดตา" },
]

const PREVIEW_ASPECT_CLASS: Record<AspectRatio, string> = {
  "1:1": "aspect-square",
  "2:3": "aspect-[2/3]",
  "3:2": "aspect-[3/2]",
  "3:4": "aspect-[3/4]",
  "4:3": "aspect-[4/3]",
  "4:5": "aspect-[4/5]",
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-video",
  "21:9": "aspect-[21/9]",
}

const PREVIEW_WIDTH_CLASS: Record<AspectRatio, string> = {
  "1:1": "max-w-[620px]",
  "2:3": "max-w-[440px]",
  "3:2": "max-w-[760px]",
  "3:4": "max-w-[480px]",
  "4:3": "max-w-[700px]",
  "4:5": "max-w-[500px]",
  "9:16": "max-w-[390px]",
  "16:9": "max-w-[820px]",
  "21:9": "max-w-[900px]",
}

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

type MaterialToScenePanelProps = {
  clientName?: string | null
  productFocus?: string | null
}

export function MaterialToScenePanel({ clientName, productFocus }: MaterialToScenePanelProps = {}) {
  const [file, setFile] = useState<File | null>(null)
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null)
  const [sceneReferences, setSceneReferences] = useState<SceneReference[]>([])
  const [prompt, setPrompt] = useState("")
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1")
  const [photographyStyle, setPhotographyStyle] = useState<PhotographyStyle>("auto")
  const [generatedImageUrls, setGeneratedImageUrls] = useState<string[]>([])
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [promptGuideIndex, setPromptGuideIndex] = useState<number | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRemovingBg, setIsRemovingBg] = useState(false)
  // Per-image AI edit: prompt applies to the currently selected output only;
  // the result is appended as a new image, never overwriting the original.
  const [sceneEditPrompt, setSceneEditPrompt] = useState("")
  const [isEditingScene, setIsEditingScene] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const [selectedHistorySessionId, setSelectedHistorySessionId] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const sceneInputRef = useRef<HTMLInputElement | null>(null)
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null)
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

  // Edit only the selected image with Gemini; append the result as a NEW image.
  const handleEditCurrentScene = async () => {
    const instruction = sceneEditPrompt.trim()
    if (!currentImageUrl || !instruction || isEditingScene) return

    setIsEditingScene(true)
    setError(null)
    try {
      const response = await fetch("/api/edit-image-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: currentImageUrl, instruction }),
      })
      const result = await response.json()
      const editedImageUrl =
        typeof result?.image_url === "string" && result.image_url
          ? result.image_url
          : typeof result?.image_data_url === "string" && result.image_data_url
            ? result.image_data_url
            : ""

      if (!response.ok || !result.success || !editedImageUrl) {
        throw new Error(result?.error || "แก้ไขรูปไม่สำเร็จ กรุณาลองใหม่")
      }

      const publicUrl = editedImageUrl.startsWith("data:")
        ? (await uploadDataUrlToImageStorage(editedImageUrl, "generated/material-to-scene-edits")).publicUrl
        : editedImageUrl

      setGeneratedImageUrls((current) => {
        const next = [...current, publicUrl]
        setSelectedImageIndex(next.length - 1)
        return next
      })
      setSceneEditPrompt("")
      void saveGenerationSession({
        outputUrls: [publicUrl],
        inputUrls: [currentImageUrl],
        model: result.model || "gemini-3.1-flash-image",
        promptOverride: `แก้ไข: ${instruction}`,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "แก้ไขรูปไม่สำเร็จ กรุณาลองใหม่")
    } finally {
      setIsEditingScene(false)
    }
  }
  const canGenerate = Boolean(file && prompt.trim())

  const saveGenerationSession = async ({
    outputUrls,
    inputUrls,
    model,
    promptOverride,
  }: {
    outputUrls: string[]
    inputUrls: string[]
    model: string
    promptOverride?: string
  }) => {
    const sessionPrompt = (promptOverride ?? prompt).trim()
    try {
      const response = await fetch("/api/image-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          featureType: "product-scene",
          clientName,
          productFocus,
          title: sessionPrompt.slice(0, 100),
          prompt: sessionPrompt,
          model,
          outputUrls,
          inputUrls,
          metadata: {
            aspectRatio,
            photographyStyle,
            preset: DEFAULT_PRESET,
            imageSize: DEFAULT_IMAGE_SIZE,
          },
        }),
      })

      if (response.ok) setHistoryRefreshKey((value) => value + 1)
    } catch (error) {
      console.error("Failed to save Product Scene session:", error)
    }
  }

  const handleGalleryImageSelect = (session: ImageGenerationSession, imageIndex: number) => {
    if (session.outputUrls.length === 0) return

    const savedAspectRatio = session.metadata.aspectRatio
    const savedPhotographyStyle = session.metadata.photographyStyle

    if (typeof savedAspectRatio === "string" && ASPECT_RATIOS.includes(savedAspectRatio as AspectRatio)) {
      setAspectRatio(savedAspectRatio as AspectRatio)
    }
    if (
      typeof savedPhotographyStyle === "string" &&
      PHOTOGRAPHY_STYLES.some((style) => style.value === savedPhotographyStyle)
    ) {
      setPhotographyStyle(savedPhotographyStyle as PhotographyStyle)
    }

    setPrompt(session.prompt || "")
    setGeneratedImageUrls(session.outputUrls)
    setSelectedImageIndex(imageIndex)
    setSelectedHistorySessionId(session.id)
    setError(null)
  }

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
          photography_style: photographyStyle,
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
      setSelectedHistorySessionId(null)
      void saveGenerationSession({
        outputUrls: urls,
        inputUrls: [referenceImageUrl, ...sceneReferenceImageUrls],
        model: typeof result.model === "string" ? result.model : "gemini-image",
      })
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

  const selectedPhotographyStyle =
    PHOTOGRAPHY_STYLES.find((style) => style.value === photographyStyle) ?? PHOTOGRAPHY_STYLES[0]
  const selectedPromptGuide = promptGuideIndex === null ? null : PROMPT_GUIDE_IMAGES[promptGuideIndex]

  const handlePromptChange = (value: string) => {
    setPrompt(value)

    const textarea = promptTextareaRef.current
    if (!textarea) return

    textarea.style.height = "72px"
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 72), 160)}px`
  }

  const showPreviousPromptGuide = () => {
    setPromptGuideIndex((current) =>
      current === null ? 0 : (current - 1 + PROMPT_GUIDE_IMAGES.length) % PROMPT_GUIDE_IMAGES.length,
    )
  }

  const showNextPromptGuide = () => {
    setPromptGuideIndex((current) => (current === null ? 0 : (current + 1) % PROMPT_GUIDE_IMAGES.length))
  }

  const showPreviousGeneratedImage = () => {
    setSelectedImageIndex((current) => (current - 1 + generatedImageUrls.length) % generatedImageUrls.length)
  }

  const showNextGeneratedImage = () => {
    setSelectedImageIndex((current) => (current + 1) % generatedImageUrls.length)
  }

  return (
    <div className="space-y-4">
      <MaterialToSceneHeader aspectRatio={aspectRatio} />

      <MaterialToSceneError message={error} />

      {!hasOutput ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_340px]">
          <Card className="rounded-[28px] border-slate-200/80 bg-white p-5 shadow-[0_14px_32px_rgba(15,23,42,0.04)]">
            <div className="space-y-5">
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

              <Tabs defaultValue="product" className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-3">
                <TabsList className="grid h-10 w-full grid-cols-2 rounded-[14px] bg-slate-200/60 p-1">
                  <TabsTrigger
                    value="product"
                    className="rounded-[10px] py-1 text-sm text-slate-600 data-[state=active]:text-slate-950"
                  >
                    Product / Material{file ? " · 1" : ""}
                  </TabsTrigger>
                  <TabsTrigger
                    value="background"
                    className="rounded-[10px] py-1 text-sm text-slate-600 data-[state=active]:text-slate-950"
                  >
                    Background / Scene{sceneReferences.length ? ` · ${sceneReferences.length}` : ""}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="product" className="mt-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "group flex min-h-[190px] w-full items-center justify-center overflow-hidden rounded-[20px] border border-dashed transition-all",
                      file
                        ? "border-slate-300 bg-white hover:border-slate-400"
                        : "border-slate-200 bg-white hover:border-slate-300",
                    )}
                  >
                    {originalImageUrl ? (
                      <div className="grid h-full w-full gap-4 p-4 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
                        <div className="relative mx-auto aspect-square w-full max-w-[140px] overflow-hidden rounded-[16px] bg-slate-50 shadow-sm">
                          <img src={originalImageUrl} alt="Product or material preview" className="h-full w-full object-contain" />
                        </div>
                        <div className="space-y-2 text-left">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Asset ready</p>
                          <h3 className="text-lg font-semibold text-slate-950">Product or material selected</h3>
                          <p className="max-w-xl text-sm leading-6 text-slate-600">
                            ระบบจะใช้ภาพนี้เป็น hero asset และพยายามรักษารูปทรง สี พื้นผิว และรายละเอียดเดิมใน scene ใหม่
                          </p>
                          <p className="text-sm text-slate-500">{uploadHint}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 px-6 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[16px] bg-slate-950 text-white shadow-sm">
                          <UploadCloud className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-lg font-semibold text-slate-950">Upload product or material</h3>
                          <p className="mx-auto max-w-md text-sm leading-6 text-slate-600">
                            เลือกภาพสินค้า วัสดุ texture sample หรือ product detail shot ที่ต้องการใช้เป็นพระเอกของภาพ
                          </p>
                        </div>
                        <p className="text-xs text-slate-500">JPG, PNG, WEBP</p>
                      </div>
                    )}
                  </button>
                </TabsContent>

                <TabsContent value="background" className="mt-3">
                  <div className="min-h-[190px] rounded-[20px] border border-dashed border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                          Optional reference
                        </p>
                        <h3 className="mt-1 text-lg font-semibold text-slate-950">
                          Add background or scene
                        </h3>
                        <p className="mt-1.5 text-sm text-slate-500">เพิ่มได้สูงสุด {MAX_SCENE_REFERENCES} รูป</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => sceneInputRef.current?.click()}
                        disabled={sceneReferences.length >= MAX_SCENE_REFERENCES}
                        className="h-10 shrink-0 rounded-xl border-slate-200 bg-white"
                      >
                        <UploadCloud className="mr-2 h-4 w-4" />
                        {sceneReferences.length ? "Add more" : "Upload images"}
                      </Button>
                    </div>

                    {sceneReferences.length > 0 ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        {sceneReferences.map((reference, index) => (
                          <div key={reference.previewUrl} className="relative overflow-hidden rounded-[18px] border border-slate-200 bg-white">
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
                              <p className="mt-0.5 text-xs text-slate-500">
                                {(reference.file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => sceneInputRef.current?.click()}
                        className="mt-3 flex min-h-[105px] w-full flex-col items-center justify-center rounded-[16px] bg-slate-50 px-6 text-center transition-colors hover:bg-slate-100"
                      >
                        <UploadCloud className="h-6 w-6 text-slate-500" />
                        <p className="mt-3 text-sm font-medium text-slate-800">Choose background or scene references</p>
                        <p className="mt-1 text-sm text-slate-500">ถ้าไม่เลือก ระบบจะสร้างฉากจาก scene brief</p>
                      </button>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Scene Brief</p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-950">Describe what you want to create</h3>
                  </div>
                  {prompt.trim() && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
                      {prompt.trim().length} chars
                    </span>
                  )}
                </div>
                <Textarea
                  ref={promptTextareaRef}
                  rows={2}
                  value={prompt}
                  onChange={(event) => handlePromptChange(event.target.value)}
                  placeholder="เช่น: ใช้ material นี้เป็น hero wall panel ใน living room modern luxury แสงธรรมชาติช่วงเช้า soft shadow โทนอุ่น composition แบบงาน interior campaign มีเฟอร์นิเจอร์น้อยแต่ดูพรีเมียม"
                  className="h-[72px] min-h-[72px] max-h-[160px] resize-none overflow-y-auto rounded-[18px] border-slate-200 bg-white px-4 py-3 text-slate-950 focus:border-slate-950 focus:ring-0"
                />
                <p className="text-xs leading-5 text-slate-500">
                  เขียนให้ตรงงาน เช่น “เปลี่ยนเสื้อบนเก้าอี้ให้เป็น material นี้ ใช้พื้นหลังเดิม และเปลี่ยนแค่มุมกล้อง”
                </p>

                <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Prompt guidelines</p>
                      <p className="text-xs text-slate-500">ตัวอย่าง keyword และ visual style สำหรับเขียน scene brief</p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">{PROMPT_GUIDE_IMAGES.length} guides</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {PROMPT_GUIDE_IMAGES.map((imageUrl, index) => (
                      <button
                        key={imageUrl}
                        type="button"
                        onClick={() => setPromptGuideIndex(index)}
                        className="group relative h-[68px] w-[108px] shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-400"
                        aria-label={`Open prompt guideline ${index + 1}`}
                      >
                        <img
                          src={imageUrl}
                          alt={`Prompt guideline ${index + 1}`}
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                        <span className="absolute bottom-1 right-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          {index + 1}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
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
                  <Select value={aspectRatio} onValueChange={(value) => setAspectRatio(value as AspectRatio)}>
                    <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white">
                      <SelectValue aria-label={`Aspect ratio ${aspectRatio}`}>{aspectRatio}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {ASPECT_RATIOS.map((ratio) => (
                        <SelectItem key={ratio} value={ratio}>
                          {ratio}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <Sparkles className="h-3.5 w-3.5 text-slate-700" />
                    Product photography style
                  </div>
                  <Select
                    value={photographyStyle}
                    onValueChange={(value) => setPhotographyStyle(value as PhotographyStyle)}
                  >
                    <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PHOTOGRAPHY_STYLES.map((style) => (
                        <SelectItem key={style.value} value={style.value}>
                          {style.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs leading-5 text-slate-500">{selectedPhotographyStyle.description}</p>
                </div>

                <div className="rounded-[20px] bg-slate-50 px-3.5 py-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Current setup</p>
                  <div className="mt-2.5 space-y-1.5 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-3">
                      <span>Aspect ratio</span>
                      <span className="font-medium text-slate-900">{aspectRatio}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Style</span>
                      <span className="text-right font-medium text-slate-900">{selectedPhotographyStyle.label}</span>
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
                  onClick={() => currentImageUrl && void downloadImageFromUrl(currentImageUrl, `material-to-scene-${selectedImageIndex + 1}.jpg`)}
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

                <div className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#f8fafc_0%,_#ffffff_100%)]">
                  <button
                    type="button"
                    onClick={() => currentImageUrl && setIsPreviewOpen(true)}
                    disabled={!currentImageUrl}
                    className="block w-full text-left"
                  >
                    <div className="flex min-h-[320px] items-center justify-center p-4 lg:h-[min(58vh,620px)]">
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
                        <div
                          className={cn(
                            "relative w-full overflow-hidden rounded-[20px] bg-white shadow-sm",
                            PREVIEW_ASPECT_CLASS[aspectRatio],
                            PREVIEW_WIDTH_CLASS[aspectRatio],
                          )}
                        >
                          <img src={currentImageUrl} alt="Generated scene" className="h-full w-full object-contain" />
                        </div>
                      ) : null}
                    </div>
                    {currentImageUrl && !isGenerating && !isRemovingBg ? (
                      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm backdrop-blur">
                        Click to zoom
                      </span>
                    ) : null}
                  </button>

                  {generatedImageUrls.length > 1 && !isGenerating && !isRemovingBg ? (
                    <>
                      <button
                        type="button"
                        onClick={showPreviousGeneratedImage}
                        className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md backdrop-blur transition hover:bg-white"
                        aria-label="Previous generated scene"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={showNextGeneratedImage}
                        className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md backdrop-blur transition hover:bg-white"
                        aria-label="Next generated scene"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  ) : null}

                  <div className="flex items-center justify-between gap-4 border-t border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-center gap-2">
                      {generatedImageUrls.map((url, index) => (
                        <button
                          key={`${url}-${index}`}
                          type="button"
                          onClick={() => setSelectedImageIndex(index)}
                          className={cn(
                            "h-2 rounded-full transition-all",
                            selectedImageIndex === index ? "w-6 bg-slate-950" : "w-2 bg-slate-300 hover:bg-slate-400",
                          )}
                          aria-label={`Show generated scene ${index + 1}`}
                        />
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        currentImageUrl &&
                        void downloadImageFromUrl(currentImageUrl, `material-to-scene-${selectedImageIndex + 1}.jpg`)
                      }
                      className="rounded-full border-slate-200 bg-white"
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Download image {selectedImageIndex + 1}
                    </Button>
                  </div>

                  <div className="mt-4 rounded-[18px] border border-slate-200 bg-slate-50/70 p-3.5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Sparkles className="h-4 w-4 text-slate-700" />
                      แก้ไขรูปนี้ด้วย AI
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      สั่งแก้เฉพาะรูปที่เลือกอยู่ — ผลลัพธ์จะถูกเพิ่มเป็นรูปใหม่ ไม่ทับรูปเดิม
                    </p>
                    <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={sceneEditPrompt}
                        onChange={(event) => setSceneEditPrompt(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault()
                            void handleEditCurrentScene()
                          }
                        }}
                        placeholder="เช่น เปลี่ยนพื้นหลังเป็นโทนครีม, เพิ่มเงาให้นุ่มลง, เอาของด้านหลังออก..."
                        disabled={isEditingScene}
                        className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 disabled:opacity-60"
                      />
                      <Button
                        type="button"
                        onClick={() => void handleEditCurrentScene()}
                        disabled={isEditingScene || !sceneEditPrompt.trim() || !currentImageUrl}
                        className="h-10 shrink-0 rounded-xl bg-slate-950 px-4 text-white hover:bg-slate-800"
                      >
                        {isEditingScene ? (
                          <>
                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                            กำลังแก้ไข...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-1.5 h-4 w-4" />
                            แก้ไขรูปนี้
                          </>
                        )}
                      </Button>
                    </div>
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

      <GeneratedImageGallery
        featureType="product-scene"
        clientName={clientName}
        productFocus={productFocus}
        refreshKey={historyRefreshKey}
        selectedSessionId={selectedHistorySessionId}
        onSelect={handleGalleryImageSelect}
      />

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl border-slate-200 p-0">
          <DialogHeader className="border-b border-slate-200 px-6 py-4">
            <DialogTitle className="text-base text-slate-950">Preview image {selectedImageIndex + 1}</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[calc(92vh-72px)] items-center justify-center overflow-auto bg-[linear-gradient(180deg,_#f8fafc_0%,_#ffffff_100%)] p-4 sm:p-6">
            {currentImageUrl ? (
              <div
                className={cn(
                  "relative w-full overflow-hidden rounded-[20px] bg-white shadow-sm",
                  PREVIEW_ASPECT_CLASS[aspectRatio],
                  PREVIEW_WIDTH_CLASS[aspectRatio],
                )}
              >
                <img src={currentImageUrl} alt={`Preview image ${selectedImageIndex + 1}`} className="h-full w-full object-contain" />
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={promptGuideIndex !== null} onOpenChange={(open) => !open && setPromptGuideIndex(null)}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden border-slate-200 bg-white p-0">
          <DialogHeader className="border-b border-slate-200 px-6 py-4">
            <DialogTitle className="text-base text-slate-950">
              Prompt guideline {promptGuideIndex === null ? "" : `${promptGuideIndex + 1} / ${PROMPT_GUIDE_IMAGES.length}`}
            </DialogTitle>
          </DialogHeader>
          <div className="relative flex min-h-0 items-center justify-center bg-slate-100 p-4 sm:p-6">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={showPreviousPromptGuide}
              className="absolute left-3 z-10 h-10 w-10 rounded-full border-slate-200 bg-white/95 shadow-sm"
              aria-label="Previous prompt guideline"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            {selectedPromptGuide ? (
              <img
                src={selectedPromptGuide}
                alt={`Prompt guideline ${(promptGuideIndex ?? 0) + 1}`}
                className="max-h-[calc(92vh-112px)] max-w-full rounded-[16px] object-contain shadow-sm"
              />
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={showNextPromptGuide}
              className="absolute right-3 z-10 h-10 w-10 rounded-full border-slate-200 bg-white/95 shadow-sm"
              aria-label="Next prompt guideline"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
