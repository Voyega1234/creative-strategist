"use client"

import { Card } from "@/components/ui/card"

interface MaterialToSceneHeaderProps {
  aspectRatio: string
}

export function MaterialToSceneHeader({ aspectRatio }: MaterialToSceneHeaderProps) {
  return (
    <Card className="rounded-[32px] border-slate-200/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(248,250,252,0.94)_100%)] p-7 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Material To Scene</p>
          <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.03em] text-slate-950">
            Turn material photos into full scenes
          </h2>
          <p className="mt-3 text-base leading-7 text-slate-600">
            อัปโหลด material หรือ product photo, เขียนบรีฟ scene ที่ต้องการ แล้วระบบจะสร้างภาพใหม่โดยพยายามรักษา texture,
            color และ surface ของ material เดิมให้มากที่สุด
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
