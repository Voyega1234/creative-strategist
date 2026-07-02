"use client"

import { memo } from "react"

import type { IdeaRecommendation } from "@/lib/ideas/types"

// A print-only card. Fixed width and tuned typography so it lays out predictably on A4 —
// no Tailwind line-clamp, no pill badges (those break html2canvas), no interactive controls.
interface IdeaExportCardProps {
  topic: IdeaRecommendation
  index: number
  width?: number
  selectionLabel?: string
  selectionChecked?: boolean
  // Optional content-format tag shown as a prominent badge (e.g. "UGC Video", "Static Ad").
  contentType?: string
}

function getDescriptionSummary(description: IdeaRecommendation["description"]) {
  if (!description) return ""
  if (typeof description === "string") return description
  if (Array.isArray(description)) {
    const priorityItem =
      description.find((item) => item.label === "Why this converts" || item.label === "Evidence/Counterpoint") ||
      description[0]
    return priorityItem?.text || ""
  }
  const prioritySection =
    description.sections?.find((section) => section.group === "why_evidence") || description.sections?.[0]
  return prioritySection?.bullets?.[0] || description.summary || ""
}

function getStableRouteIndex(seed: string, routeCount: number) {
  if (routeCount <= 0) return -1
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return hash % routeCount
}

function getContentTypeLabel(contentType?: string) {
  const labels: Record<string, string> = {
    STATIC: "STATIC",
    "STATIC AD": "STATIC AD",
    ALBUM: "ALBUM",
    "ALBUM AD": "ALBUM AD",
    MOTION: "MOTION",
    "MOTION AD": "MOTION AD",
    "UGC VIDEO": "UGC VIDEO",
    UGC: "UGC",
  }

  return contentType ? labels[contentType.toUpperCase()] || contentType : ""
}

const bodyStyle: React.CSSProperties = {
  fontSize: 18,
  lineHeight: 1.5,
  color: "#475467",
  margin: 0,
}

// 490px keeps even long-content cards within the A4 3-column cell aspect (~1.07 h/w),
// so the grid fills the page width with no side gaps and no distortion.
export const IdeaExportCard = memo(function IdeaExportCard({
  topic,
  index,
  width = 490,
  selectionLabel,
  selectionChecked = false,
  contentType,
}: IdeaExportCardProps) {
  const visualRoutes = topic.visual_routes || []
  const previewRouteIndex = getStableRouteIndex(
    `${index}:${topic.title || ""}:${topic.concept_idea || ""}:${topic.copywriting?.headline || ""}`,
    visualRoutes.length,
  )
  const previewRoute = previewRouteIndex >= 0 ? visualRoutes[previewRouteIndex] : undefined
  const hook = topic.copywriting?.headline || topic.title || topic.concept_idea || ""
  const subheadline = topic.copywriting?.sub_headline_1 || topic.copywriting?.sub_headline_2 || ""
  const cta = topic.copywriting?.cta || ""
  const whyItMightWork =
    topic.competitiveGap || getDescriptionSummary(topic.description) || previewRoute?.why_it_fits || ""
  const contentTypeLabel = getContentTypeLabel(contentType)
  const hookFontSize = hook.length > 90 ? 25 : hook.length > 55 ? 28 : 32
  const subheadlineFontSize = subheadline.length > 160 ? 16 : subheadline.length > 100 ? 18 : 20
  const whyFontSize = whyItMightWork.length > 170 ? 15 : whyItMightWork.length > 110 ? 16 : 18
  const ctaFontSize = cta.length > 130 ? 15 : cta.length > 80 ? 16 : 18

  return (
    <div
      style={{
        width,
        minHeight: 690,
        boxSizing: "border-box",
        border: "1px solid #dce3ec",
        borderRadius: 18,
        padding: "28px 26px 26px",
        background: "#ffffff",
        color: "#101828",
        fontFamily: "'Sukhumvit Set', Arial, Helvetica, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        {(contentTypeLabel || topic.content_pillar) && (
          <>
          {contentTypeLabel && (
            // Same html2canvas fix as the Why box: no fixed height, symmetric vertical padding
            // centres the label instead of flex `align-items` (which html2canvas ignores).
            <span
              style={{
                display: "inline-block",
                minWidth: 116,
                boxSizing: "border-box",
                borderRadius: 6,
                padding: "7px 12px",
                background: "#eef2ff",
                color: "#3730d8",
                fontSize: 14,
                fontWeight: 700,
                lineHeight: 1,
                textAlign: "center",
              }}
            >
              {contentTypeLabel}
            </span>
          )}
          {topic.content_pillar && (
            <span style={{ fontSize: 16, fontWeight: 500, color: "#667085" }}>{topic.content_pillar}</span>
          )}
          </>
        )}
      </div>

      <div
        style={{
          display: "grid",
          flex: 1,
          gridTemplateRows: "150px 110px 90px 100px 112px",
          padding: "18px 0 20px",
        }}
      >
        <div aria-hidden />

        <div>
          {hook && (
            <p
              style={{
                margin: 0,
                color: "#101828",
                fontSize: hookFontSize,
                fontWeight: 700,
                lineHeight: 1.28,
              }}
            >
              {hook}
            </p>
          )}
        </div>

        <div style={{ paddingTop: 14 }}>
          {subheadline && (
            <p style={{ margin: 0, color: "#344054", fontSize: subheadlineFontSize, fontWeight: 600, lineHeight: 1.45 }}>
              {subheadline}
            </p>
          )}
        </div>

        <div style={{ paddingTop: 10 }}>
          {cta && (
            <p style={{ ...bodyStyle, color: "#344054", fontSize: ctaFontSize }}>{cta}</p>
          )}
        </div>

        <div style={{ paddingTop: 12 }}>
          {whyItMightWork && (
            // No fixed height + symmetric vertical padding: html2canvas does not honour flex
            // `align-items: center`, so the text is centred by equal top/bottom padding instead.
            <div
              style={{
                display: "flex",
                boxSizing: "border-box",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 14,
                borderRadius: 10,
                padding: "18px 18px",
                background: "#eef2ff",
                color: "#3730d8",
              }}
            >
              <p style={{ margin: 0, fontSize: whyFontSize, fontWeight: 600, lineHeight: 1.4 }}>
                {whyItMightWork}
              </p>
              <span aria-hidden style={{ flexShrink: 0, color: "#101828", fontSize: 22, fontWeight: 700, lineHeight: 1 }}>→</span>
            </div>
          )}
        </div>
      </div>

      {selectionLabel && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 22,
            color: "#8a8f98",
            fontSize: 22,
            lineHeight: 1,
          }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              borderRadius: 9,
              border: "3px solid #2563eb",
              background: selectionChecked ? "#2563eb" : "#ffffff",
              color: "#ffffff",
              boxSizing: "border-box",
              fontSize: 24,
              fontWeight: 600,
            }}
          >
            {selectionChecked ? "✓" : ""}
          </span>
          <span>{selectionLabel}</span>
        </div>
      )}
    </div>
  )
})
