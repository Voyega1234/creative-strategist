"use client"

import Image from "next/image"
import { CheckCircle } from "lucide-react"

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { AD_STYLE_OPTIONS } from "@/lib/images/generated-ads-config"
import { cn } from "@/lib/utils"

interface AdStyleSelectorProps {
  selectedAdStyle: string
  selectedStyleLabel: string
  onToggleStyle: (styleValue: string) => void
}

export function AdStyleSelector({
  selectedAdStyle,
  selectedStyleLabel,
  onToggleStyle,
}: AdStyleSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <label className="text-sm font-medium text-slate-900">Ad style</label>
          <p className="mt-1 text-xs text-slate-500">optional: เลือก style เดียวเพื่อคุมภาพรวมของงาน</p>
        </div>
        {selectedAdStyle && <span className="text-xs text-slate-500">{selectedStyleLabel}</span>}
      </div>
      <div className="-mx-1 overflow-x-auto pb-1">
        <div className="grid min-w-[760px] grid-cols-6 gap-3 px-1">
          {AD_STYLE_OPTIONS.map((style) => {
            const isSelected = selectedAdStyle === style.value

            return (
              <HoverCard key={style.value} openDelay={120} closeDelay={80}>
                <HoverCardTrigger asChild>
                  <button type="button" onClick={() => onToggleStyle(style.value)} className="text-left">
                    <div
                      className={cn(
                        "overflow-hidden rounded-[22px] border bg-slate-50 transition-all",
                        isSelected
                          ? "border-slate-950 shadow-[0_12px_24px_rgba(15,23,42,0.08)]"
                          : "border-slate-200/90 hover:border-slate-300 hover:bg-white",
                      )}
                    >
                      <div className="relative aspect-[4/5] overflow-hidden">
                        <Image
                          src={style.previewImage}
                          alt={`${style.label} preview`}
                          fill
                          className="object-cover transition-transform duration-200 hover:scale-[1.02]"
                          sizes="(max-width: 768px) 24vw, 110px"
                        />
                        {isSelected && (
                          <div className="absolute right-2 top-2 rounded-full bg-white/95 p-1.5 text-slate-950 shadow-sm">
                            <CheckCircle className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                      <div className="px-2.5 py-2.5">
                        <p className="text-[11px] font-medium leading-4 text-slate-700">{style.label}</p>
                      </div>
                    </div>
                  </button>
                </HoverCardTrigger>
                <HoverCardContent
                  align="start"
                  sideOffset={10}
                  className="w-56 rounded-2xl border-slate-200 p-3 text-sm leading-6 text-slate-600"
                >
                  <p className="text-sm font-semibold text-slate-950">{style.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{style.hoverDescription}</p>
                </HoverCardContent>
              </HoverCard>
            )
          })}
        </div>
      </div>
    </div>
  )
}
