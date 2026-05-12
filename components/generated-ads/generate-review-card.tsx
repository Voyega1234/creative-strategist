"use client"

import { Loader2, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"

type GenerateReviewCardProps = {
  clientName?: string | null
  briefSource: string
  styleLabel: string
  aspectRatio: string
  imageCount: number
  materialCount: number
  referenceCount: number
  hasOptionalDirection: boolean
  canGenerate: boolean
  isGenerating: boolean
  onGenerate: () => void
}

export function GenerateReviewCard({
  clientName,
  briefSource,
  styleLabel,
  aspectRatio,
  imageCount,
  materialCount,
  referenceCount,
  hasOptionalDirection,
  canGenerate,
  isGenerating,
  onGenerate,
}: GenerateReviewCardProps) {
  return (
    <div className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_14px_32px_rgba(15,23,42,0.04)]">
      <div className="px-7 pt-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Step 3</p>
        <h4 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-slate-950">Generate and review</h4>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          ตรวจสอบสรุปด้านล่างก่อนกด generate เพื่อให้รู้ว่าระบบจะใช้ context อะไรในการสร้างภาพ
        </p>
      </div>

      <div className="grid gap-6 p-7 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
        <div className="space-y-4">
          <div className="grid gap-3 rounded-[28px] bg-slate-50 px-5 py-5 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Client</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{clientName || "Not selected"}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Brief source</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{briefSource}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Style</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{styleLabel}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
            <span>
              <span className="text-slate-400">Aspect ratio</span>
              <span className="ml-2 text-slate-800">{aspectRatio}</span>
            </span>
            <span>
              <span className="text-slate-400">Outputs</span>
              <span className="ml-2 text-slate-800">{imageCount}</span>
            </span>
            <span>
              <span className="text-slate-400">Materials</span>
              <span className="ml-2 text-slate-800">{materialCount}</span>
            </span>
            <span>
              <span className="text-slate-400">References</span>
              <span className="ml-2 text-slate-800">{referenceCount}</span>
            </span>
            {hasOptionalDirection && <span className="text-slate-800">Optional direction added</span>}
          </div>
        </div>

        <div className="rounded-[28px] bg-slate-50 p-4">
          <Button
            onClick={onGenerate}
            disabled={isGenerating || !canGenerate}
            className="h-12 w-full rounded-2xl bg-slate-950 text-base font-medium text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                กำลังสร้าง {imageCount} ภาพ...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate {imageCount} Static Ad{imageCount > 1 ? "s" : ""}
              </>
            )}
          </Button>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            {!canGenerate
              ? "ต้องเลือกลูกค้า Product Focus และใส่ brief หรือเลือก saved idea ก่อนจึงจะ generate ได้"
              : "พร้อมสร้างแล้ว ระบบจะใช้ brief หรือ saved idea ร่วมกับ direction ที่คุณเลือกไว้"}
          </p>
        </div>
      </div>
    </div>
  )
}
