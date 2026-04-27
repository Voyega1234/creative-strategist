"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { getStorageClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { CheckCircle2, Loader2, Sparkles, Upload, Wand2 } from "lucide-react"

type EnhanceMode = "preserve" | "reimagine"

type SpellCheckIssue = {
  original_text: string
  suggested_text: string
  language: string
  issue: string
  rationale: string
}

type CritiquePayload = {
  overall_score: number
  top_strength: string
  main_issue: string
  what_works: string[]
  what_hurts_performance: string[]
  priority_fixes: string[]
  recommended_mode: EnhanceMode
  rationale: string
  preserve_focus: string[]
  reimagine_brief: string
  spell_check: {
    detected_text: string[]
    issues: SpellCheckIssue[]
    corrected_text_recommendation: string
    confidence_note: string
  }
}

type GeneratedEnhanceResult = {
  mode: EnhanceMode
  imageUrl: string
  mimeType: string
  prompt: string
  model: string
}

type SourceImageMeta = {
  width: number
  height: number
  aspectRatioLabel: string
}

function formatScore(score: number) {
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}

function textareaValueToLines(value: string) {
  return value.replace(/\r\n/g, "\n").split("\n")
}

function cleanLinesForRequest(value: string[]) {
  return value.map((item) => item.trim()).filter(Boolean)
}

function cleanCritiqueForRequest(critique: CritiquePayload): CritiquePayload {
  return {
    ...critique,
    what_works: cleanLinesForRequest(critique.what_works),
    what_hurts_performance: cleanLinesForRequest(critique.what_hurts_performance),
    priority_fixes: cleanLinesForRequest(critique.priority_fixes),
    preserve_focus: cleanLinesForRequest(critique.preserve_focus),
  }
}

function dataUrlToBlob(dataUrl: string) {
  const [metadata, base64Data] = dataUrl.split(",")
  const mimeType = metadata.match(/^data:(.*?);base64$/)?.[1] || "image/png"
  const binary = window.atob(base64Data || "")
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new Blob([bytes], { type: mimeType })
}

function getImageExtension(mimeType: string) {
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "jpg"
  if (mimeType === "image/webp") return "webp"
  return "png"
}

function getClosestAspectRatioLabel(width: number, height: number) {
  const supportedRatios = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]
  const rawRatio = width / height

  return supportedRatios.reduce((closest, current) => {
    const [currentWidth, currentHeight] = current.split(":").map(Number)
    const [closestWidth, closestHeight] = closest.split(":").map(Number)
    const currentDistance = Math.abs(rawRatio - currentWidth / currentHeight)
    const closestDistance = Math.abs(rawRatio - closestWidth / closestHeight)
    return currentDistance < closestDistance ? current : closest
  }, "1:1")
}

async function readImageMeta(file: File): Promise<SourceImageMeta> {
  const objectUrl = URL.createObjectURL(file)

  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new window.Image()
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
      image.onerror = () => reject(new Error("ไม่สามารถอ่านขนาดรูปได้"))
      image.src = objectUrl
    })

    return {
      ...dimensions,
      aspectRatioLabel: getClosestAspectRatioLabel(dimensions.width, dimensions.height),
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function uploadFileToStorage(file: File) {
  const storage = getStorageClient()
  if (!storage) {
    throw new Error("Storage client not available")
  }

  const extension = file.name.split(".").pop() || "png"
  const path = `generated/enhance-inputs/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`
  const { error } = await storage.from("ads-creative-image").upload(path, file, {
    contentType: file.type,
  })

  if (error) {
    throw new Error(error.message)
  }

  const { data } = storage.from("ads-creative-image").getPublicUrl(path)
  return data.publicUrl
}

export function ImageEnhancePanel() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [sourceImageMeta, setSourceImageMeta] = useState<SourceImageMeta | null>(null)
  const [critique, setCritique] = useState<CritiquePayload | null>(null)
  const [selectedMode, setSelectedMode] = useState<EnhanceMode | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRemovingText, setIsRemovingText] = useState(false)
  const [generatedResult, setGeneratedResult] = useState<GeneratedEnhanceResult | null>(null)
  const [isGeneratedPreviewOpen, setIsGeneratedPreviewOpen] = useState(false)
  const [showAllSpellCorrections, setShowAllSpellCorrections] = useState(false)
  const [userNotes, setUserNotes] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const uploadHint = useMemo(() => {
    if (!file) return "อัปโหลดภาพเดิมก่อน เพื่อให้ AI วิจารณ์และแนะนำว่า Preserve หรือ Reimagine เหมาะกว่า"
    return `${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB`
  }, [file])

  const handleFileSelect = async (selectedFile: File) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    try {
      const meta = await readImageMeta(selectedFile)
      setFile(selectedFile)
      setPreviewUrl(URL.createObjectURL(selectedFile))
      setSourceImageMeta(meta)
      setUploadedImageUrl(null)
      setCritique(null)
      setSelectedMode(null)
      setGeneratedResult(null)
      setShowAllSpellCorrections(false)
      setUserNotes("")
      setError(null)
    } catch (err) {
      console.error("Failed to read enhance image metadata:", err)
      alert(err instanceof Error ? err.message : "ไม่สามารถอ่านขนาดรูปได้")
    }
  }

  const updateCritiqueField = <K extends keyof CritiquePayload>(field: K, value: CritiquePayload[K]) => {
    setCritique((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  const updateCritiqueList = (
    field: "what_works" | "what_hurts_performance" | "priority_fixes" | "preserve_focus",
    value: string,
  ) => {
    setCritique((prev) => (prev ? { ...prev, [field]: textareaValueToLines(value) } : prev))
  }

  const handleAnalyze = async () => {
    if (!file) {
      alert("กรุณาอัปโหลดรูปก่อน")
      return
    }

    try {
      setIsAnalyzing(true)
      setError(null)

      const imageUrl = await uploadFileToStorage(file)
      setUploadedImageUrl(imageUrl)
      const response = await fetch("/api/enhance-critique", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url: imageUrl,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result.success || !result.critique) {
        throw new Error(result?.error || "ไม่สามารถวิเคราะห์ภาพได้")
      }

      setCritique(result.critique)
      setShowAllSpellCorrections(false)
      setSelectedMode(result.critique.recommended_mode)
    } catch (err) {
      console.error("Enhance critique failed:", err)
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการวิเคราะห์ภาพ"
      setError(message)
      alert(message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleGenerate = async (mode: EnhanceMode) => {
    if (!critique) {
      alert("กรุณา Run AI Critique ก่อน")
      return
    }

    if (!uploadedImageUrl && !file) {
      alert("กรุณาอัปโหลดรูปก่อน")
      return
    }

    try {
      setIsGenerating(true)
      setSelectedMode(mode)
      setError(null)

      const sourceImageUrl = uploadedImageUrl || (file ? await uploadFileToStorage(file) : null)
      if (!sourceImageUrl) {
        throw new Error("ไม่พบรูปต้นฉบับสำหรับใช้สร้างภาพ")
      }

      if (!uploadedImageUrl) {
        setUploadedImageUrl(sourceImageUrl)
      }

      const response = await fetch("/api/enhance-generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url: sourceImageUrl,
          mode,
          critique: cleanCritiqueForRequest(critique),
          user_notes: userNotes,
          source_width: sourceImageMeta?.width || null,
          source_height: sourceImageMeta?.height || null,
          detected_aspect_ratio: sourceImageMeta?.aspectRatioLabel || null,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result.success || !result.image_data_url) {
        throw new Error(result?.error || "ไม่สามารถสร้างภาพใหม่ได้")
      }

      setGeneratedResult({
        mode,
        imageUrl: result.image_data_url,
        mimeType: result.mime_type || "image/png",
        prompt: result.prompt || "",
        model: result.model || "gpt-image-2",
      })
    } catch (err) {
      console.error("Enhance generation failed:", err)
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการสร้างภาพ"
      setError(message)
      alert(message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownloadGenerated = () => {
    if (!generatedResult) return

    const blob = dataUrlToBlob(generatedResult.imageUrl)
    const objectUrl = URL.createObjectURL(blob)
    const extension = getImageExtension(generatedResult.mimeType || blob.type)
    const link = document.createElement("a")
    link.href = objectUrl
    link.download = `enhance-${generatedResult.mode}-${Date.now()}.${extension}`
    link.click()
    URL.revokeObjectURL(objectUrl)
  }

  const handleRemoveText = async () => {
    if (!generatedResult) return

    try {
      setIsRemovingText(true)
      setError(null)

      const response = await fetch("/api/remove-text-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url: generatedResult.imageUrl,
          target_size: "1K",
        }),
      })

      const result = await response.json()
      if (!response.ok || !result.success || !result.image_base64) {
        throw new Error(result?.error || "ไม่สามารถลบข้อความออกจากภาพได้")
      }

      const mimeType = result.mime_type || "image/png"
      setGeneratedResult((prev) =>
        prev
          ? {
              ...prev,
              imageUrl: `data:${mimeType};base64,${result.image_base64}`,
              mimeType,
              model: `${prev.model} • Text Removed`,
            }
          : prev,
      )
    } catch (err) {
      console.error("Enhance remove text failed:", err)
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการลบข้อความ"
      setError(message)
      alert(message)
    } finally {
      setIsRemovingText(false)
    }
  }

  const spellCorrections = critique?.spell_check?.issues || []
  const visibleSpellCorrections = showAllSpellCorrections ? spellCorrections : spellCorrections.slice(0, 4)

  return (
    <div className="space-y-5">
      <Card className="rounded-[28px] border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Enhance</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">ปรับคุณภาพภาพด้วย AI Critique ก่อนเจน</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              อัปโหลดภาพ ให้ AI แยกตรวจงานครีเอทีฟและตรวจคำผิดจากรูป แล้วเลือกว่าจะปรับภาพเดิมหรือคิดภาพใหม่
            </p>
          </div>
          <div className="grid grid-cols-3 overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-center text-xs font-medium text-slate-500">
            <span className="px-3 py-2 text-slate-900">1 Upload</span>
            <span className="border-x border-slate-200 px-3 py-2">2 Check</span>
            <span className="px-3 py-2">3 Generate</span>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="rounded-[24px] border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error}
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)_360px]">
        <Card className="h-fit overflow-hidden rounded-[28px] border-slate-200 bg-white shadow-sm xl:sticky xl:top-4">
          <div className="border-b border-slate-100 px-5 py-4">
            <h4 className="text-base font-semibold text-slate-950">1. Upload</h4>
            <p className="mt-1 text-sm text-slate-500">เลือกรูปที่ต้องการตรวจและปรับคุณภาพ</p>
          </div>

          <div className="space-y-4 p-5">
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

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex min-h-[260px] w-full items-center justify-center rounded-[24px] border border-dashed px-5 text-center transition-colors",
                previewUrl
                  ? "border-slate-200 bg-white hover:border-slate-300"
                  : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100",
              )}
            >
              {previewUrl ? (
                <div className="w-full space-y-3">
                  <div className="relative mx-auto aspect-square w-full max-w-[230px] overflow-hidden rounded-[22px] bg-slate-50">
                    <Image src={previewUrl} alt={file?.name || "Preview"} fill className="object-contain" sizes="230px" />
                  </div>
                  <div className="space-y-1">
                    <p className="max-w-full truncate text-sm font-medium text-slate-900" title={file?.name || undefined}>
                      {file?.name}
                    </p>
                    <p className="truncate text-xs text-slate-500" title={uploadHint}>{uploadHint}</p>
                    {sourceImageMeta && (
                      <p className="text-xs text-slate-500">
                        {sourceImageMeta.width} × {sourceImageMeta.height} • {sourceImageMeta.aspectRatioLabel}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">อัปโหลดรูปภาพ</p>
                    <p className="mt-1 text-xs text-slate-500">PNG, JPG, WEBP</p>
                  </div>
                </div>
              )}
            </button>

            <Button
              onClick={handleAnalyze}
              disabled={!file || isAnalyzing}
              className="h-12 w-full rounded-full bg-slate-950 text-white hover:bg-slate-800"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังตรวจภาพ...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Run AI Check
                </>
              )}
            </Button>
          </div>
        </Card>

        <Card className="overflow-hidden rounded-[28px] border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h4 className="text-base font-semibold text-slate-950">2. AI Check</h4>
            <p className="mt-1 text-sm text-slate-500">Creative critique และ spell check แยกกันชัดเจน</p>
          </div>

          <div className="p-5">
            {!critique ? (
              <div className="flex min-h-[520px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
                <div>
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-900 shadow-sm">
                    <Wand2 className="h-6 w-6" />
                  </div>
                  <h5 className="mt-5 text-lg font-semibold text-slate-950">ยังไม่มีผลวิเคราะห์</h5>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                    อัปโหลดภาพแล้วกด Run AI Check ระบบจะสรุปจุดแข็ง จุดอ่อน ตรวจคำผิด และแนะนำ next move
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid items-start gap-3 md:grid-cols-[108px_minmax(0,1fr)]">
                  <div className="flex aspect-square w-[108px] flex-col justify-center rounded-[22px] border border-slate-200 bg-slate-950 px-4 text-white">
                    <p className="text-[11px] font-medium text-slate-300">Score</p>
                    <p className="mt-1 text-[36px] font-semibold leading-none tracking-[-0.06em]">{formatScore(critique.overall_score)}</p>
                    <p className="mt-2 text-[11px] text-slate-400">out of 10</p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        className={cn(
                          "rounded-full",
                          critique.recommended_mode === "preserve"
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                            : "bg-amber-100 text-amber-700 hover:bg-amber-100",
                        )}
                      >
                        Recommended: {critique.recommended_mode === "preserve" ? "ปรับภาพเดิม" : "คิดภาพใหม่"}
                      </Badge>
                    </div>
                    <Textarea
                      value={critique.rationale}
                      onChange={(event) => updateCritiqueField("rationale", event.target.value)}
                      className="mt-3 min-h-[88px] border-slate-200 bg-white text-sm leading-6 text-slate-700"
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-[22px] border border-emerald-100 bg-emerald-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Top Strength</p>
                    <Textarea
                      value={critique.top_strength}
                      onChange={(event) => updateCritiqueField("top_strength", event.target.value)}
                      className="mt-2 min-h-[96px] border-emerald-200 bg-white text-sm leading-6 text-emerald-950"
                    />
                  </div>
                  <div className="rounded-[22px] border border-rose-100 bg-rose-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Main Issue</p>
                    <Textarea
                      value={critique.main_issue}
                      onChange={(event) => updateCritiqueField("main_issue", event.target.value)}
                      className="mt-2 min-h-[96px] border-rose-200 bg-white text-sm leading-6 text-rose-950"
                    />
                  </div>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Spell Check From Image</p>
                      <p className="mt-1 text-sm text-slate-600">ตรวจคำผิดจากข้อความที่เห็นในรูปเท่านั้น</p>
                    </div>
                    <Badge className="w-fit rounded-full bg-slate-100 text-slate-700 hover:bg-slate-100">
                      {critique.spell_check?.issues?.length || 0} issue{(critique.spell_check?.issues?.length || 0) === 1 ? "" : "s"}
                    </Badge>
                  </div>

                  <div className="mt-4 grid items-stretch gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                    <div className="flex min-h-0 flex-col">
                      <p className="text-xs font-medium text-slate-500">Detected text</p>
                      <div className="mt-2 flex flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-800">
                        {(critique.spell_check?.detected_text || []).length > 0 ? (
                          <div className="space-y-1">
                            {(critique.spell_check?.detected_text || []).map((item, index) => (
                              <p key={`${item}-${index}`}>{item}</p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-400">ไม่พบข้อความที่อ่านได้ชัดเจนในภาพ</p>
                        )}
                      </div>
                    </div>
                    <div className="flex min-h-0 flex-col">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-medium text-slate-500">Corrections</p>
                        {spellCorrections.length > 4 && (
                          <button
                            type="button"
                            onClick={() => setShowAllSpellCorrections((current) => !current)}
                            className="text-xs font-semibold text-slate-700 underline-offset-4 hover:underline"
                          >
                            {showAllSpellCorrections ? "ย่อรายการ" : `ดูทั้งหมด ${spellCorrections.length} รายการ`}
                          </button>
                        )}
                      </div>
                      <div className="mt-2 flex flex-1 flex-col rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-800">
                        {spellCorrections.length > 0 ? (
                          <div className="grid gap-2 xl:grid-cols-2">
                            {visibleSpellCorrections.map((issue, index) => (
                              <div
                                key={`${issue.original_text}-${index}`}
                                className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                                    {issue.original_text || "-"}
                                  </span>
                                  <span className="text-xs font-semibold text-slate-400">→</span>
                                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                    {issue.suggested_text || "-"}
                                  </span>
                                </div>
                                <p className="mt-2 text-xs text-slate-500">
                                  {[issue.language, issue.issue].filter(Boolean).join(" • ")}
                                </p>
                                {issue.rationale && <p className="mt-1 text-xs leading-5 text-slate-600">{issue.rationale}</p>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-400">ยังไม่พบปัญหาการสะกดที่ชัดเจน</p>
                        )}
                        {!showAllSpellCorrections && spellCorrections.length > 4 && (
                          <p className="mt-3 text-center text-xs text-slate-500">
                            แสดง 4 รายการแรกจากทั้งหมด {spellCorrections.length} รายการ
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium text-slate-500">Recommendation</p>
                      <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-800">
                        {critique.spell_check?.corrected_text_recommendation || (
                          <span className="text-slate-400">ไม่มีคำแนะนำเพิ่มเติม</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500">Confidence</p>
                      <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-800">
                        {critique.spell_check?.confidence_note || (
                          <span className="text-slate-400">ไม่มีหมายเหตุเพิ่มเติม</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Fix First</p>
                  <p className="mt-1 text-sm text-slate-500">โชว์เฉพาะสิ่งที่ควรแก้ก่อนจริง ๆ จากมุม art direction</p>
                  <Textarea
                    value={critique.priority_fixes.join("\n")}
                    onChange={(event) => updateCritiqueList("priority_fixes", event.target.value)}
                    className="mt-3 min-h-[132px] border-slate-200 text-sm leading-6 text-slate-700"
                  />
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Generation Direction</p>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">ปรับภาพเดิม</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">คงโครงเดิม แก้คุณภาพ ความคม แสง และ artifact</p>
                      <Textarea
                        value={critique.preserve_focus.join("\n")}
                        onChange={(event) => updateCritiqueList("preserve_focus", event.target.value)}
                        className="mt-3 min-h-[120px] border-slate-200 bg-white text-sm leading-6 text-slate-700"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">คิดภาพใหม่</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">ยังยึดข้อมูลเดิม แต่เสนอ layout และ idea ใหม่</p>
                      <Textarea
                        value={critique.reimagine_brief}
                        onChange={(event) => updateCritiqueField("reimagine_brief", event.target.value)}
                        className="mt-3 min-h-[120px] border-slate-200 bg-white text-sm leading-6 text-slate-700"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Team Notes</p>
                  <Textarea
                    value={userNotes}
                    onChange={(event) => setUserNotes(event.target.value)}
                    placeholder="เช่น คงชื่อสินค้าและราคาไว้ทั้งหมด แต่จัด typography ใหม่ให้อ่านง่ายขึ้น"
                    className="mt-3 min-h-[92px] border-slate-200 bg-white text-sm leading-6 text-slate-800"
                  />
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="h-fit overflow-hidden rounded-[28px] border-slate-200 bg-white shadow-sm xl:sticky xl:top-4">
          <div className="border-b border-slate-100 px-5 py-4">
            <h4 className="text-base font-semibold text-slate-950">3. Generate</h4>
            <p className="mt-1 text-sm text-slate-500">เลือก output ที่ต้องการหลังตรวจเสร็จ</p>
          </div>

          <div className="space-y-4 p-5">
            <div className="grid gap-2">
              <Button
                type="button"
                onClick={() => void handleGenerate("preserve")}
                disabled={!critique || isGenerating}
                className={cn(
                  "h-12 rounded-full",
                  selectedMode === "preserve"
                    ? "bg-slate-950 text-white hover:bg-slate-800"
                    : "bg-slate-100 text-slate-900 hover:bg-slate-200",
                )}
              >
                {isGenerating && selectedMode === "preserve" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                ปรับภาพเดิม
              </Button>
              <Button
                type="button"
                onClick={() => void handleGenerate("reimagine")}
                disabled={!critique || isGenerating}
                className={cn(
                  "h-12 rounded-full",
                  selectedMode === "reimagine"
                    ? "bg-slate-950 text-white hover:bg-slate-800"
                    : "bg-slate-100 text-slate-900 hover:bg-slate-200",
                )}
              >
                {isGenerating && selectedMode === "reimagine" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                คิดภาพใหม่
              </Button>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-3">
              {isGenerating ? (
                <div className="flex min-h-[300px] items-center justify-center text-center">
                  <div className="space-y-3">
                    <Loader2 className="mx-auto h-7 w-7 animate-spin text-slate-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">กำลังสร้างภาพ...</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {selectedMode === "preserve" ? "ปรับภาพเดิมให้ดีขึ้น" : "คิดภาพใหม่จากข้อมูลเดิม"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : generatedResult ? (
                <button
                  type="button"
                  onClick={() => setIsGeneratedPreviewOpen(true)}
                  className="group block w-full text-left"
                >
                  <div className="overflow-hidden rounded-[20px] bg-white">
                    <img
                      src={generatedResult.imageUrl}
                      alt={generatedResult.mode === "preserve" ? "Preserve result" : "Reimagine result"}
                      className="h-auto max-h-[420px] w-full object-contain transition-transform group-hover:scale-[1.01]"
                    />
                  </div>
                  <p className="mt-3 text-center text-xs text-slate-500">คลิกเพื่อดูภาพเต็ม</p>
                </button>
              ) : (
                <div className="flex min-h-[300px] items-center justify-center text-center">
                  <div className="space-y-2">
                    <Wand2 className="mx-auto h-6 w-6 text-slate-400" />
                    <p className="text-sm font-medium text-slate-900">ยังไม่มีผลลัพธ์</p>
                    <p className="max-w-[240px] text-xs leading-5 text-slate-500">หลังจาก Run AI Check แล้ว เลือกปรับภาพเดิมหรือคิดภาพใหม่</p>
                  </div>
                </div>
              )}
            </div>

            {generatedResult && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-sm font-medium text-slate-900">
                    {generatedResult.mode === "preserve" ? "โหมด: ปรับภาพเดิม" : "โหมด: คิดภาพใหม่"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Generated with {generatedResult.model}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRemoveText}
                    disabled={isRemovingText}
                    className="rounded-full border-slate-200 text-slate-700"
                  >
                    {isRemovingText ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    ลบข้อความ
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDownloadGenerated}
                    className="rounded-full border-slate-200 text-slate-700"
                  >
                    ดาวน์โหลด
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Dialog open={isGeneratedPreviewOpen} onOpenChange={setIsGeneratedPreviewOpen}>
        <DialogContent className="h-[92vh] max-w-6xl border-slate-200 p-0">
          <DialogHeader className="border-b border-slate-200 px-6 py-4">
            <div className="flex flex-col gap-3 pr-10 lg:flex-row lg:items-center lg:justify-between">
              <DialogTitle className="text-base text-slate-950">
                {generatedResult?.mode === "preserve" ? "ภาพที่ปรับจากต้นฉบับ" : "ภาพแนวคิดใหม่"}
              </DialogTitle>
              {generatedResult && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRemoveText}
                    disabled={isRemovingText}
                    className="rounded-full border-slate-200 text-slate-700"
                  >
                    {isRemovingText ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Removing text...
                      </>
                    ) : (
                      "ลบข้อความ"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDownloadGenerated}
                    className="rounded-full border-slate-200 text-slate-700"
                  >
                    ดาวน์โหลดภาพ
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
          {generatedResult && (
            <div className="flex h-[calc(92vh-76px)] items-center justify-center bg-slate-50 p-6">
              <img
                src={generatedResult.imageUrl}
                alt={generatedResult.mode === "preserve" ? "Preserve result full preview" : "Reimagine result full preview"}
                className="max-h-full max-w-full rounded-[20px] border border-slate-200 bg-white object-contain shadow-sm"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
