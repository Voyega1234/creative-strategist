"use client"

import { Card } from "@/components/ui/card"

interface MaterialToSceneHeaderProps {
  aspectRatio: string
}

export function MaterialToSceneHeader({ aspectRatio }: MaterialToSceneHeaderProps) {
  return (
    <Card className="rounded-[20px] border-slate-200/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(248,250,252,0.94)_100%)] px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)] sm:rounded-[24px] sm:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Photostock</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950 sm:text-xl">
            Build campaign-ready scenes from product assets
          </h2>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            อัปโหลดภาพสินค้า วัสดุ หรือ texture แล้วระบุฉากที่ต้องการ ระบบจะสร้างภาพใหม่โดยรักษารูปทรง สี และพื้นผิวของต้นฉบับ
            ให้มากที่สุด
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-slate-500">
          <div>
            <span className="text-slate-400">Aspect</span>
            <span className="ml-2 text-slate-700">{aspectRatio}</span>
          </div>
        </div>
      </div>
    </Card>
  )
}
