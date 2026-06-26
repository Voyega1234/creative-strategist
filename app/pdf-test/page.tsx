"use client"

import { useEffect, useRef, useState } from "react"

import { IdeaExportCard } from "@/components/ideas/idea-export-card"
import type { IdeaRecommendation } from "@/lib/ideas/types"

const mock = (i: number, label: string): IdeaRecommendation =>
  ({
    title: `${label} ${i}`,
    concept_idea: `Concept idea ${i}`,
    concept_type: "Proven Concept",
    competitiveGap:
      "เน้นผลลัพธ์คุณภาพจริงแทนการอวดสถิติจำนวนแชทราคาถูกแบบทั่วไป และสื่อสารตรงกลุ่มเป้าหมายที่พร้อมจ่าย",
    content_pillar: "Performance Marketing",
    description: "why this converts",
    visual_routes: [],
    copywriting: {
      headline: `${label} ${i} แชทเยอะ แต่ไม่มีคนซื้อ`,
      sub_headline_1: "เหนื่อยตอบแชทผีที่ทักมาแล้วเงียบ? เปลี่ยนมาหาลูกค้าที่พร้อมจ่ายจริง",
      sub_headline_2: "",
      cta: "ขอรับคำปรึกษาเพื่อตั้งค่าระบบแอดคัดกรองแชทฟรีวันนี้",
    },
  }) as unknown as IdeaRecommendation

const REC = [1, 2, 3]
const OTHER = [1, 2, 3]

export default function PdfTestPage() {
  const recRef = useRef<HTMLDivElement>(null)
  const otherRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState("idle")

  async function run() {
    setStatus("running")
    const recEls = Array.from(recRef.current!.querySelectorAll<HTMLElement>("[data-card]"))
    const otherEls = Array.from(otherRef.current!.querySelectorAll<HTMLElement>("[data-card]"))
    const origCreate = URL.createObjectURL
    let captured: Blob | null = null
    URL.createObjectURL = (b: Blob) => {
      captured = b
      return "blob:dummy"
    }
    URL.revokeObjectURL = () => {}
    try {
      const { exportIdeasWithSectionsToPdf } = await import("@/lib/ideas/export-ideas-pdf")
      await exportIdeasWithSectionsToPdf(recEls, otherEls, "test.pdf")
    } finally {
      URL.createObjectURL = origCreate
    }
    if (captured) {
      const b64: string = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.readAsDataURL(captured!)
      })
      ;(window as unknown as { __pdf: string }).__pdf = b64
    }
    setStatus("done")
  }

  useEffect(() => {
    ;(window as unknown as { __runTest: () => void }).__runTest = run
  })

  return (
    <div style={{ padding: 24 }}>
      <button onClick={run}>Run</button>
      <span style={{ marginLeft: 12 }}>{status}</span>
      <div ref={recRef} style={{ position: "fixed", left: -99999, top: 0 }}>
        {REC.map((i) => (
          <div key={i} data-card>
            <IdeaExportCard topic={mock(i, "Rec")} index={i} />
          </div>
        ))}
      </div>
      <div ref={otherRef} style={{ position: "fixed", left: -99999, top: 0 }}>
        {OTHER.map((i) => (
          <div key={i} data-card>
            <IdeaExportCard topic={mock(i, "Other")} index={i + 100} />
          </div>
        ))}
      </div>
    </div>
  )
}
