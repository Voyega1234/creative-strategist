"use client"

import { Loader2, Wand2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

interface CustomIdeaDialogProps {
  isOpen: boolean
  value: string
  isParsing: boolean
  onOpenChange: (open: boolean) => void
  onValueChange: (value: string) => void
  onSubmit: () => void
}

export function CustomIdeaDialog({
  isOpen,
  value,
  isParsing,
  onOpenChange,
  onValueChange,
  onSubmit,
}: CustomIdeaDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-[28px] border-slate-200 p-0">
        <DialogHeader className="border-b border-slate-200 px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-lg text-slate-950">
            <Wand2 className="h-5 w-5 text-blue-600" />
            Add custom idea
          </DialogTitle>
          <p className="text-sm leading-6 text-slate-500">
            พิมพ์แบบ freeform ได้เลย หรือใช้ label เช่น `Title:`, `Description:`, `Tags:`, `Concept Idea:`, `Headline:`, `Bullets:`, `CTA:` แล้วระบบจะช่วยแตกเป็น format idea ให้อัตโนมัติ
          </p>
        </DialogHeader>
        <div className="space-y-4 px-6 py-5">
          <Textarea
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder={`Title: Hook เรื่องผลลัพธ์ที่วัดได้\nDescription: ชูเรื่องแพ็กเกจรวมทุกช่องทางแบบวัด ROI ได้\nTags: roi, social media, package\nConcept Idea: เปรียบเทียบการซื้อสื่อแบบกระจายกับการซื้อแบบรวมแพ็กเกจ`}
            rows={8}
            className="min-h-[220px] resize-none rounded-2xl border-slate-200 bg-white text-slate-950 focus:border-slate-950 focus:ring-0"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs leading-5 text-slate-500">
              ระบบจะใช้ Gemini parse ก่อน และ fallback เป็น parser ในระบบถ้า parse ไม่สำเร็จ
            </p>
            <Button
              type="button"
              onClick={onSubmit}
              disabled={!value.trim() || isParsing}
              className="rounded-full bg-slate-950 text-white hover:bg-slate-800"
            >
              {isParsing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังแตก idea
                </>
              ) : (
                "เพิ่มเข้า Ideas"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
