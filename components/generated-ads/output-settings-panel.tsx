"use client"

import { ImageIcon, Layers3 } from "lucide-react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ASPECT_RATIO_OPTIONS, IMAGE_COUNT_OPTIONS } from "@/lib/images/generated-ads-config"
import { cn } from "@/lib/utils"

interface OutputSettingsPanelProps {
  imageCount: number
  aspectRatio: string
  selectedStyleLabel: string
  onImageCountChange: (count: number) => void
  onAspectRatioChange: (ratio: string) => void
}

export function OutputSettingsPanel({
  imageCount,
  aspectRatio,
  selectedStyleLabel,
  onImageCountChange,
  onAspectRatioChange,
}: OutputSettingsPanelProps) {
  return (
    <div className="space-y-5 rounded-[28px] bg-slate-50/80 p-5">
      <div>
        <p className="text-sm font-medium text-slate-900">Output settings</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">ตั้งค่าพื้นฐานก่อน generate</p>
      </div>
      <div className="space-y-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <Layers3 className="h-4 w-4 text-slate-700" />
            จำนวนภาพ
          </div>
          <div className="grid grid-cols-5 gap-2">
            {IMAGE_COUNT_OPTIONS.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => onImageCountChange(count)}
                className={cn(
                  "rounded-xl border px-2 py-2 text-sm font-medium transition-colors",
                  imageCount === count
                    ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <ImageIcon className="h-4 w-4 text-slate-700" />
            อัตราส่วนภาพ
          </div>
          <Select value={aspectRatio} onValueChange={onAspectRatioChange}>
            <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white focus:border-slate-950 focus:ring-0">
              <SelectValue placeholder="เลือกอัตราส่วนภาพ" />
            </SelectTrigger>
            <SelectContent>
              {ASPECT_RATIO_OPTIONS.map((ratio) => (
                <SelectItem key={ratio} value={ratio}>
                  {ratio}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-[22px] bg-white px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Current setup</p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <div className="flex items-center justify-between gap-3">
              <span>Outputs</span>
              <span className="font-medium text-slate-900">{imageCount}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Aspect ratio</span>
              <span className="font-medium text-slate-900">{aspectRatio}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Style</span>
              <span className="font-medium text-slate-900">{selectedStyleLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
