"use client"

import { memo } from "react"

import type { IdeaRecommendation } from "@/lib/ideas/types"

// A print-only card. Fixed width and tuned typography so it lays out predictably on A4 —
// no Tailwind line-clamp, no pill badges (those break html2canvas), no interactive controls.
interface IdeaExportCardProps {
  topic: IdeaRecommendation
  index: number
  width?: number
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

// All headers share the same size; Hook and Concept are blue, the rest are gray.
const labelBase: React.CSSProperties = {
  display: "block",
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  marginBottom: 4,
}
const labelBlue: React.CSSProperties = { ...labelBase, color: "#2563eb" }
const labelGray: React.CSSProperties = { ...labelBase, color: "#667085" }

const bodyStyle: React.CSSProperties = {
  fontSize: 20,
  lineHeight: 1.45,
  color: "#1f2937",
  margin: 0,
}

// Space between sections so headers do not crowd the text above them.
const sectionStyle: React.CSSProperties = { marginTop: 12 }

// 490px keeps even long-content cards within the A4 3-column cell aspect (~1.07 h/w),
// so the grid fills the page width with no side gaps and no distortion.
export const IdeaExportCard = memo(function IdeaExportCard({ topic, index, width = 490 }: IdeaExportCardProps) {
  const visualRoutes = topic.visual_routes || []
  const previewRouteIndex = getStableRouteIndex(
    `${index}:${topic.title || ""}:${topic.concept_idea || ""}:${topic.copywriting?.headline || ""}`,
    visualRoutes.length,
  )
  const previewRoute = previewRouteIndex >= 0 ? visualRoutes[previewRouteIndex] : undefined
  const hook = topic.copywriting?.headline || topic.title || topic.concept_idea || ""
  const concept = topic.title || topic.concept_idea || ""
  const conceptText = typeof concept === "string" ? concept : getDescriptionSummary(concept)
  const subheadline = topic.copywriting?.sub_headline_1 || topic.copywriting?.sub_headline_2 || ""
  const whyItMightWork =
    topic.competitiveGap || getDescriptionSummary(topic.description) || previewRoute?.why_it_fits || ""
  const cta = topic.copywriting?.cta || ""

  return (
    <div
      style={{
        width,
        boxSizing: "border-box",
        border: "1px solid #e4e7ec",
        borderRadius: 12,
        padding: 16,
        background: "#ffffff",
        color: "#1f2937",
      }}
    >
      {topic.content_pillar && (
        <p style={{ ...bodyStyle, fontSize: 13, fontWeight: 700, color: "#6D9EEB", margin: 0 }}>
          {topic.content_pillar}
        </p>
      )}

      {hook && (
        <div style={sectionStyle}>
          <span style={labelBlue}>Hook</span>
          <p style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.3, color: "#111827", margin: 0 }}>{hook}</p>
        </div>
      )}

      {subheadline && (
        <div style={sectionStyle}>
          <span style={labelGray}>Subheadline</span>
          <p style={bodyStyle}>{subheadline}</p>
        </div>
      )}

      {cta && (
        <div style={sectionStyle}>
          <span style={labelGray}>CTA</span>
          <p style={bodyStyle}>{cta}</p>
        </div>
      )}

      {conceptText && (
        <div style={sectionStyle}>
          <span style={labelBlue}>Concept</span>
          <p style={bodyStyle}>{conceptText}</p>
        </div>
      )}

      {whyItMightWork && (
        <div style={sectionStyle}>
          <span style={labelGray}>Why</span>
          <p style={bodyStyle}>{whyItMightWork}</p>
        </div>
      )}
    </div>
  )
})
