"use client";

import { ImageEnhancePanel } from "@/components/image-enhance-panel";

export function EnhanceMode() {
  return (
    <section className="rounded-[28px] border border-black/10 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
      <div className="border-b border-black/10 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
          Creative Revision
        </p>
        <h2 className="mt-1 text-xl font-semibold text-[#1f1f1f]">Enhance Image</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[#667085]">
          ให้ AI ตรวจคุณภาพงาน ภาษาบนภาพ และ art direction ก่อนเลือกปรับภาพเดิมหรือสร้างแนวทางใหม่
        </p>
      </div>

      <div className="p-4">
        <ImageEnhancePanel variant="workspace" />
      </div>
    </section>
  );
}
