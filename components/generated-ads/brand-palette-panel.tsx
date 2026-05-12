"use client"

import { ChevronDown, Palette } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface BrandPalettePanelProps {
  isOpen: boolean
  selectedClientId: string
  colorPalette: string[]
  colorInput: string
  isSavingPalette: boolean
  onOpenChange: (open: boolean) => void
  onColorInputChange: (value: string) => void
  onAddColor: () => void
  onRemoveColor: (index: number) => void
  onSavePalette: () => void
}

export function BrandPalettePanel({
  isOpen,
  selectedClientId,
  colorPalette,
  colorInput,
  isSavingPalette,
  onOpenChange,
  onColorInputChange,
  onAddColor,
  onRemoveColor,
  onSavePalette,
}: BrandPalettePanelProps) {
  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange} className="rounded-2xl border border-slate-200 bg-slate-50/70">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <Palette className="h-4 w-4 text-slate-700" />
            Brand palette
          </div>
          <p className="mt-1 text-xs text-slate-500">optional: ใช้เมื่ออยากคุมโทนสีให้ใกล้แบรนด์มากขึ้น</p>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", isOpen && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 px-4 pb-4">
        {selectedClientId ? (
          <>
            {colorPalette.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {colorPalette.map((color, index) => (
                  <div key={`${color}-${index}`} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
                    <div
                      className="h-5 w-5 rounded-full border border-slate-200"
                      style={{ backgroundColor: `#${color}` }}
                      title={`#${color}`}
                    />
                    <span className="text-xs font-medium text-slate-900">#{color}</span>
                    <button
                      type="button"
                      className="text-xs text-rose-500 hover:text-rose-600"
                      onClick={() => onRemoveColor(index)}
                    >
                      ลบ
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                ยังไม่มีพาเลตสีที่บันทึกไว้
              </div>
            )}

            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={colorInput}
                  onChange={(event) => onColorInputChange(event.target.value)}
                  placeholder="ใส่โค้ดสี เช่น 265484 หรือ #265484"
                  className="h-11 rounded-2xl border-slate-200"
                />
                <Button variant="outline" onClick={onAddColor} className="h-11 rounded-2xl border-slate-200">
                  เพิ่มสี
                </Button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  onClick={onSavePalette}
                  disabled={isSavingPalette}
                  className="h-11 rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
                >
                  {isSavingPalette ? "กำลังบันทึก..." : "บันทึกพาเลตสี"}
                </Button>
                <Button variant="ghost" asChild className="justify-start rounded-2xl px-0 text-sm text-blue-700 hover:bg-transparent hover:text-blue-800">
                  <a href="https://coolors.co/image-picker" target="_blank" rel="noopener noreferrer">
                    เปิด Image Picker
                  </a>
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
            เลือกลูกค้าก่อนเพื่อจัดการพาเลตสี
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
