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
}

type GeneratedEnhanceResult = {
  mode: EnhanceMode
  imageUrl: string
  prompt: string
  model: string
}

function formatScore(score: number) {
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}

function linesToArray(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
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
  const [critique, setCritique] = useState<CritiquePayload | null>(null)
  const [selectedMode, setSelectedMode] = useState<EnhanceMode | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRemovingText, setIsRemovingText] = useState(false)
  const [generatedResult, setGeneratedResult] = useState<GeneratedEnhanceResult | null>(null)
  const [isGeneratedPreviewOpen, setIsGeneratedPreviewOpen] = useState(false)
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

  const handleFileSelect = (selectedFile: File) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    setFile(selectedFile)
    setPreviewUrl(URL.createObjectURL(selectedFile))
    setUploadedImageUrl(null)
    setCritique(null)
    setSelectedMode(null)
    setGeneratedResult(null)
    setUserNotes("")
    setError(null)
  }

  const updateCritiqueField = <K extends keyof CritiquePayload>(field: K, value: CritiquePayload[K]) => {
    setCritique((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  const updateCritiqueList = (
    field: "what_works" | "what_hurts_performance" | "priority_fixes" | "preserve_focus",
    value: string,
  ) => {
    setCritique((prev) => (prev ? { ...prev, [field]: linesToArray(value) } : prev))
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
          critique,
          user_notes: userNotes,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result.success || !result.image_data_url) {
        throw new Error(result?.error || "ไม่สามารถสร้างภาพใหม่ได้")
      }

      setGeneratedResult({
        mode,
        imageUrl: result.image_data_url,
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

    const link = document.createElement("a")
    link.href = generatedResult.imageUrl
    link.download = `enhance-${generatedResult.mode}-${Date.now()}.png`
    link.click()
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

  return (
    <div className="space-y-6">
      <Card className="rounded-[32px] border-slate-200/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(248,250,252,0.94)_100%)] p-7 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Enhance</p>
            <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.03em] text-slate-950">
              Critique first, then choose the right direction
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              อัปโหลดภาพเดิมให้ AI ช่วยวิจารณ์ก่อนว่าอะไรดี อะไรยังฉุด performance และควรไปทาง
              <span className="font-medium text-slate-900"> Preserve</span> หรือ
              <span className="font-medium text-slate-900"> Reimagine</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="rounded-full bg-slate-100 text-slate-700 hover:bg-slate-100">AI Critique</Badge>
            <Badge className="rounded-full bg-slate-100 text-slate-700 hover:bg-slate-100">Preserve / Reimagine</Badge>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="rounded-[24px] border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error}
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="border-b border-slate-200 bg-white px-6 py-5">
            <h4 className="text-lg font-semibold text-slate-950">Upload & Analyze</h4>
            <p className="mt-1 text-sm text-slate-600">เริ่มจากอัปโหลดภาพ แล้วให้ AI วิจารณ์ก่อนว่าควรซ่อมหรือควรทำใหม่</p>
          </div>

          <div className="space-y-5 p-6">
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
                "flex min-h-[220px] w-full items-center justify-center rounded-[24px] border border-dashed px-6 text-center transition-colors",
                previewUrl
                  ? "border-slate-200 bg-white hover:border-slate-300"
                  : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100",
              )}
            >
              {previewUrl ? (
                <div className="w-full space-y-4">
                  <div className="relative mx-auto aspect-[4/5] w-full max-w-[220px] overflow-hidden rounded-[24px] bg-slate-50 shadow-sm">
                    <Image src={previewUrl} alt={file?.name || "Preview"} fill className="object-contain" sizes="220px" />
                  </div>
                  <div className="space-y-1">
                    <p className="truncate text-sm font-medium text-slate-900" title={file?.name || undefined}>
                      {file?.name}
                    </p>
                    <p className="text-sm text-slate-500">{uploadHint}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Upload image for critique</p>
                    <p className="mt-1 text-xs text-slate-500">PNG, JPG, WEBP</p>
                  </div>
                </div>
              )}
            </button>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-sm font-medium text-slate-900">What this step does</p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <p>AI จะชมจุดที่ดีจริงของภาพ บอกจุดที่ฉุด performance และแนะนำว่าควรไปทางไหนต่อ</p>
                <p>ถ้าภาพแข็งแรงอยู่แล้ว จะถูกแนะนำไปทาง Preserve ถ้าโครงภาพยังอ่อน จะถูกแนะนำไปทาง Reimagine</p>
              </div>
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={!file || isAnalyzing}
              className="h-11 w-full rounded-full bg-slate-900 text-white hover:bg-slate-800"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing image...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Run AI Critique
                </>
              )}
            </Button>
          </div>
        </Card>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="border-b border-slate-200 bg-white px-6 py-5">
            <h4 className="text-lg font-semibold text-slate-950">AI Critique</h4>
            <p className="mt-1 text-sm text-slate-600">สรุปให้เห็นทั้งจุดแข็ง จุดอ่อน และ next step ที่ควรทำต่อ</p>
          </div>

          <div className="p-6">
            {!critique ? (
              <div className="rounded-[28px] border border-dashed border-slate-200 bg-[linear-gradient(135deg,_#f8fafc_0%,_#ffffff_100%)] px-6 py-16 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                  <Wand2 className="h-6 w-6" />
                </div>
                <h5 className="mt-5 text-lg font-semibold text-slate-950">No critique yet</h5>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                  อัปโหลดภาพก่อน แล้วกด Run AI Critique เพื่อให้ระบบช่วยบอกว่าควร Preserve หรือ Reimagine
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full bg-slate-900 text-white hover:bg-slate-900">
                    Score {formatScore(critique.overall_score)}/10
                  </Badge>
                  <Badge
                    className={cn(
                      "rounded-full hover:bg-transparent",
                      critique.recommended_mode === "preserve"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700",
                    )}
                  >
                    Recommended: {critique.recommended_mode === "preserve" ? "Preserve" : "Reimagine"}
                  </Badge>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[24px] border border-emerald-100 bg-emerald-50 px-5 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600">Top Strength</p>
                    <Textarea
                      value={critique.top_strength}
                      onChange={(event) => updateCritiqueField("top_strength", event.target.value)}
                      className="mt-2 min-h-[92px] border-emerald-200 bg-white text-sm leading-6 text-emerald-900"
                    />
                  </div>
                  <div className="rounded-[24px] border border-rose-100 bg-rose-50 px-5 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-600">Main Issue</p>
                    <Textarea
                      value={critique.main_issue}
                      onChange={(event) => updateCritiqueField("main_issue", event.target.value)}
                      className="mt-2 min-h-[92px] border-rose-200 bg-white text-sm leading-6 text-rose-900"
                    />
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">What Works</p>
                    <Textarea
                      value={critique.what_works.join("\n")}
                      onChange={(event) => updateCritiqueList("what_works", event.target.value)}
                      className="mt-3 min-h-[160px] border-slate-200 text-sm leading-6 text-slate-700"
                    />
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">What Hurts Performance</p>
                    <Textarea
                      value={critique.what_hurts_performance.join("\n")}
                      onChange={(event) => updateCritiqueList("what_hurts_performance", event.target.value)}
                      className="mt-3 min-h-[160px] border-slate-200 text-sm leading-6 text-slate-700"
                    />
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Priority Fixes</p>
                    <Textarea
                      value={critique.priority_fixes.join("\n")}
                      onChange={(event) => updateCritiqueList("priority_fixes", event.target.value)}
                      className="mt-3 min-h-[160px] border-slate-200 text-sm leading-6 text-slate-700"
                    />
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Recommended Next Move</p>
                      <Textarea
                        value={critique.rationale}
                        onChange={(event) => updateCritiqueField("rationale", event.target.value)}
                        className="mt-2 min-h-[92px] w-full border-slate-200 bg-white text-sm leading-6 text-slate-700"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={selectedMode === "preserve" ? "default" : "outline"}
                        onClick={() => void handleGenerate("preserve")}
                        disabled={isGenerating}
                        className={cn(
                          "rounded-full",
                          selectedMode === "preserve"
                            ? "bg-slate-900 text-white hover:bg-slate-800"
                            : "border-slate-200 text-slate-700",
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
                        variant={selectedMode === "reimagine" ? "default" : "outline"}
                        onClick={() => void handleGenerate("reimagine")}
                        disabled={isGenerating}
                        className={cn(
                          "rounded-full",
                          selectedMode === "reimagine"
                            ? "bg-slate-900 text-white hover:bg-slate-800"
                            : "border-slate-200 text-slate-700",
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
                  </div>
                </div>

                {selectedMode === "preserve" && (
                  <div className="rounded-[28px] border border-emerald-100 bg-emerald-50 px-5 py-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600">Preserve Plan</p>
                    <p className="mt-2 text-sm leading-6 text-emerald-900">
                      โหมดนี้เหมาะกับภาพที่โครงหลักดีอยู่แล้ว และควรแก้แค่ artifact, ความคม, lighting หรือความเนียนของงาน
                    </p>
                    <Textarea
                      value={critique.preserve_focus.join("\n")}
                      onChange={(event) => updateCritiqueList("preserve_focus", event.target.value)}
                      className="mt-4 min-h-[140px] border-emerald-200 bg-white text-sm leading-6 text-emerald-900"
                    />
                  </div>
                )}

                {selectedMode === "reimagine" && (
                  <div className="rounded-[28px] border border-amber-100 bg-amber-50 px-5 py-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-600">Reimagine Direction</p>
                    <p className="mt-2 text-sm leading-6 text-amber-900">
                      โหมดนี้เหมาะกับภาพที่ควรคิดใหม่ทั้ง framing, hierarchy หรือ selling idea มากกว่าซ่อมของเดิม
                    </p>
                    <Textarea
                      value={critique.reimagine_brief}
                      onChange={(event) => updateCritiqueField("reimagine_brief", event.target.value)}
                      className="mt-4 min-h-[140px] border-amber-200 bg-white text-sm leading-6 text-amber-950"
                    />
                  </div>
                )}

                <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 px-5 py-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Team Notes</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    เพิ่มคอมเมนต์จากทีมได้ตรงนี้ เช่น อยากคงข้อความบางส่วน อยากดัน mood ให้ luxury ขึ้น หรืออยากลดความรกของ layout
                  </p>
                  <Textarea
                    value={userNotes}
                    onChange={(event) => setUserNotes(event.target.value)}
                    placeholder="เช่น คงชื่อสินค้าและราคาไว้ทั้งหมด แต่จัด typography ใหม่ให้อ่านง่ายขึ้น"
                    className="mt-4 min-h-[120px] border-slate-200 bg-white text-sm leading-6 text-slate-800"
                  />
                  </div>

                <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Generated Result</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        กด <span className="font-medium text-slate-900">ปรับภาพเดิม</span> เพื่อทำเวอร์ชันที่ใกล้เคียงเดิม
                        หรือกด <span className="font-medium text-slate-900">คิดภาพใหม่</span> เพื่อให้ระบบเสนอ route ใหม่
                      </p>
                    </div>
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

                  <div className="mt-5">
                    {isGenerating ? (
                      <div className="flex min-h-[360px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 text-center">
                        <div className="space-y-3">
                          <Loader2 className="mx-auto h-7 w-7 animate-spin text-slate-500" />
                          <div>
                            <p className="text-sm font-medium text-slate-900">Generating new image...</p>
                            <p className="mt-1 text-sm text-slate-500">
                              {selectedMode === "preserve" ? "กำลังปรับภาพเดิม" : "กำลังคิดภาพใหม่"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : generatedResult ? (
                      <div className="space-y-4">
                        <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
                          <button
                            type="button"
                            onClick={() => setIsGeneratedPreviewOpen(true)}
                            className="group mx-auto block w-full max-w-[340px] p-4 text-left"
                          >
                            <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm transition-transform group-hover:scale-[1.01]">
                              <img
                                src={generatedResult.imageUrl}
                                alt={generatedResult.mode === "preserve" ? "Preserve result" : "Reimagine result"}
                                className="h-auto w-full object-contain"
                              />
                            </div>
                            <p className="mt-3 text-center text-sm text-slate-500">คลิกเพื่อดูภาพเต็ม</p>
                          </button>
                        </div>
                        <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 px-4 py-4">
                          <p className="text-sm font-medium text-slate-900">
                            {generatedResult.mode === "preserve" ? "โหมด: ปรับภาพเดิม" : "โหมด: คิดภาพใหม่"}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">Generated with {generatedResult.model}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-h-[280px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 text-center">
                        <div className="space-y-2">
                          <Wand2 className="mx-auto h-6 w-6 text-slate-400" />
                          <p className="text-sm font-medium text-slate-900">ยังไม่มีภาพที่สร้างใหม่</p>
                          <p className="text-sm text-slate-500">หลังจากได้ critique แล้ว กดหนึ่งในสองปุ่มด้านบนเพื่อเริ่มสร้างภาพ</p>
                        </div>
                      </div>
                    )}
                  </div>
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
