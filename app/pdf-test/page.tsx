"use client"

import { useEffect, useRef, useState } from "react"
import html2canvas from "html2canvas"

import { IdeaExportCard } from "@/components/ideas/idea-export-card"
import type { IdeaRecommendation } from "@/lib/ideas/types"

const SCALE = 2
const SELECTION_STRIP_CSS_PX = 64
const CHECKBOX_SIZE_CSS_PX = 28
const SELECTION_LEFT_INSET_CSS_PX = 16

const mock = (i: number): IdeaRecommendation =>
  ({
    title: `Concept ${i}`,
    concept_idea: `Concept idea ${i}`,
    concept_type: "Proven Concept",
    competitiveGap: "เน้นผลลัพธ์คุณภาพจริงแทนการอวดสถิติจำนวนแชทราคาถูกแบบทั่วไป และสื่อสารตรงกลุ่ม",
    content_pillar: "Performance Marketing",
    description: "why this converts",
    visual_routes: [],
    copywriting: {
      headline: `แชทเยอะ แต่ไม่มีคนซื้อ ${i}`,
      sub_headline_1: "เหนื่อยตอบแชทผีที่ทักมาแล้วเงียบ? เปลี่ยนมาหาลูกค้าที่พร้อมจ่ายจริง",
      sub_headline_2: "",
      cta: "ขอรับคำปรึกษาเพื่อตั้งค่าระบบแอดคัดกรองแชทฟรีวันนี้",
    },
  }) as unknown as IdeaRecommendation

export default function PdfTestPage() {
  const cardsRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState("idle")

  async function run() {
    setStatus("capturing...")
    const cardEls = Array.from(cardsRef.current!.querySelectorAll<HTMLElement>("[data-card]"))
    const canvases = await Promise.all(
      cardEls.map((card) =>
        html2canvas(card, {
          scale: SCALE,
          backgroundColor: "#ffffff",
          onclone: (_d, c) => {
            const spacer = c.ownerDocument.createElement("div")
            spacer.style.height = `${SELECTION_STRIP_CSS_PX}px`
            c.appendChild(spacer)
          },
        }),
      ),
    )
    const out = canvasRef.current!
    const ctx = out.getContext("2d")!
    const dispW = 320 // displayed card width (mm-equivalent)
    const gap = 16
    const heights = canvases.map((cv) => (cv.height * dispW) / cv.width)
    out.width = (dispW + gap) * canvases.length
    out.height = Math.max(...heights) + 40
    ctx.fillStyle = "#f1f5f9"
    ctx.fillRect(0, 0, out.width, out.height)

    canvases.forEach((cv, i) => {
      const cardCssWidth = cv.width / SCALE
      const cssToPx = (css: number) => (css * dispW) / cardCssWidth
      const x = i * (dispW + gap)
      const h = heights[i]
      ctx.drawImage(cv, x, 10, dispW, h)
      // checkbox position (replicates addCardSelectionRow)
      const cardBottom = 10 + h
      const strip = cssToPx(SELECTION_STRIP_CSS_PX)
      const cb = cssToPx(CHECKBOX_SIZE_CSS_PX)
      const cx = x + cssToPx(SELECTION_LEFT_INSET_CSS_PX)
      const cy = cardBottom - strip + (strip - cb) / 2
      ctx.strokeStyle = "red"
      ctx.lineWidth = 2
      ctx.strokeRect(cx, cy, cb, cb)
      // draw strip top line (yellow) to see reserved area
      ctx.strokeStyle = "orange"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, cardBottom - strip)
      ctx.lineTo(x + dispW, cardBottom - strip)
      ctx.stroke()
    })
    setStatus("done")
  }

  useEffect(() => {
    ;(window as unknown as { __runTest: () => void }).__runTest = run
  })

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <button onClick={run} style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", borderRadius: 8 }}>
        Run capture test
      </button>
      <span style={{ marginLeft: 12 }}>{status}</span>

      <p style={{ marginTop: 16 }}>
        Red box = checkbox position. Orange line = top of reserved strip. The card border should
        extend below the orange line and enclose the red box.
      </p>
      <canvas ref={canvasRef} style={{ marginTop: 16, border: "1px solid #ccc", maxWidth: "100%" }} />

      {/* Offscreen real cards */}
      <div ref={cardsRef} style={{ position: "absolute", left: -9999, top: 0 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} data-card>
            <IdeaExportCard topic={mock(i)} index={i} />
          </div>
        ))}
      </div>
    </div>
  )
}
