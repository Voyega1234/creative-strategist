import jsPDF from "jspdf"

import type { IdeaRecommendation } from "@/lib/ideas/types"

const MAX_IDEAS = 10
const PAGE_WIDTH_MM = 297
const PAGE_HEIGHT_MM = 210
const HORIZONTAL_MARGIN_MM = 16
const VERTICAL_MARGIN_MM = 20
const GAP_MM = 8
const COLUMNS = 3
const CARD_HEIGHT_MM = 170
const FONT_NAME = "SukhumvitReview"
const PT_TO_MM = 0.3528
const FONT_FILES = {
  normal: {
    filename: "SukhumvitSet-Text.ttf",
    url: "/fonts/Sukhumvit_Set/SukhumvitSet-Text.ttf",
  },
  medium: {
    filename: "SukhumvitSet-Medium.ttf",
    url: "/fonts/Sukhumvit_Set/SukhumvitSet-Medium.ttf",
  },
  semibold: {
    filename: "SukhumvitSet-SemiBold.ttf",
    url: "/fonts/Sukhumvit_Set/SukhumvitSet-SemiBold.ttf",
  },
  bold: {
    filename: "SukhumvitSet-Bold.ttf",
    url: "/fonts/Sukhumvit_Set/SukhumvitSet-Bold.ttf",
  },
} as const

type FontStyle = keyof typeof FONT_FILES

const fontBase64Promises = new Map<string, Promise<string>>()
const STOP_WORDS = new Set([
  "และ",
  "ด้วย",
  "ให้",
  "เพื่อ",
  "ของ",
  "ที่",
  "ใน",
  "จาก",
  "เป็น",
  "ไม่",
  "ได้",
  "นี้",
  "แบบ",
  "อย่าง",
  "กับ",
  "หรือ",
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "your",
])

type TextRun = {
  text: string
  highlight: boolean
}
export type ReviewIdeaGroup = "recommended" | "option"
export type ReviewIdeaSection = {
  heading: string
  group: ReviewIdeaGroup
  ideas: IdeaRecommendation[]
}
export type ReviewHighlightMap = Record<string, string[]>

async function loadFontAsBase64(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to load font ${url}: ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const chunkSize = 0x8000
  let binary = ""
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

async function ensureFonts(pdf: jsPDF) {
  try {
    for (const [style, file] of Object.entries(FONT_FILES) as Array<[FontStyle, (typeof FONT_FILES)[FontStyle]]>) {
      if (!fontBase64Promises.has(file.url)) {
        fontBase64Promises.set(file.url, loadFontAsBase64(file.url))
      }
      const fontBase64 = await fontBase64Promises.get(file.url)
      if (!fontBase64) throw new Error(`Missing font data for ${file.url}`)
      pdf.addFileToVFS(file.filename, fontBase64)
      pdf.addFont(file.filename, FONT_NAME, style)
    }
    return true
  } catch (error) {
    console.warn("[Review PDF Export] Failed to load Sukhumvit Set, falling back to Helvetica:", error)
    return false
  }
}

function setFont(pdf: jsPDF, style: FontStyle, sizePt: number, hasThaiFont: boolean) {
  pdf.setFont(hasThaiFont ? FONT_NAME : "helvetica", hasThaiFont ? style : style === "normal" ? "normal" : "bold")
  pdf.setFontSize(sizePt)
}

function tokenize(text: string) {
  const cleanText = text.replace(/\s+/g, " ").trim()
  if (!cleanText) return []

  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const Segmenter = Intl.Segmenter
    const segmenter = new Segmenter("th", { granularity: "word" })
    return Array.from(segmenter.segment(cleanText))
      .map((segment) => segment.segment)
      .filter(Boolean)
  }

  return cleanText.split(/(\s+)/).filter(Boolean)
}

function normalizeToken(token: string) {
  return token.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")
}

function pickSubheadlineHighlights(subheadline: string, idea: IdeaRecommendation) {
  const directTerms = [
    ...(idea.tags || []),
    idea.content_pillar,
    idea.product_focus,
    idea.concept_idea,
    idea.copywriting?.cta,
  ]
    .filter(Boolean)
    .map((term) => normalizeToken(term))
    .filter((term) => term.length >= 4)

  const tokens = tokenize(subheadline)
  const highlights = new Set<string>()

  for (const token of tokens) {
    const normalized = normalizeToken(token)
    if (!normalized || STOP_WORDS.has(normalized)) continue
    if (directTerms.some((term) => term.includes(normalized) || normalized.includes(term))) {
      highlights.add(normalized)
    }
    if (highlights.size >= 2) return highlights
  }

  for (const token of tokens) {
    const normalized = normalizeToken(token)
    if (!normalized || STOP_WORDS.has(normalized)) continue
    if (normalized.length >= 5 || /[A-Za-z0-9]/.test(normalized)) {
      highlights.add(normalized)
    }
    if (highlights.size >= 2) break
  }

  return highlights
}

function getReviewHighlightKey(group: ReviewIdeaGroup, index: number) {
  return `${group}:${index}`
}

function makeHighlightedRuns(text: string, idea: IdeaRecommendation, highlightTerms?: string[]) {
  const highlights = highlightTerms?.length
    ? new Set(highlightTerms.map((term) => normalizeToken(term)).filter((term) => term.length >= 2))
    : pickSubheadlineHighlights(text, idea)
  return tokenize(text).map((token) => {
    const normalized = normalizeToken(token)
    const isHighlighted =
      Boolean(normalized) &&
      Array.from(highlights).some((term) => term === normalized || term.includes(normalized) || normalized.includes(term))
    return {
      text: token,
      highlight: isHighlighted,
    }
  })
}

function getTextRunWidth(pdf: jsPDF, run: TextRun, normalStyle: FontStyle, highlightStyle: FontStyle, sizePt: number, hasThaiFont: boolean) {
  setFont(pdf, run.highlight ? highlightStyle : normalStyle, sizePt, hasThaiFont)
  return pdf.getTextWidth(run.text)
}

function wrapRuns(
  pdf: jsPDF,
  runs: TextRun[],
  maxWidthMm: number,
  maxLines: number,
  normalStyle: FontStyle,
  highlightStyle: FontStyle,
  sizePt: number,
  hasThaiFont: boolean,
) {
  const lines: TextRun[][] = []
  let line: TextRun[] = []
  let lineWidth = 0

  for (const run of runs) {
    const runWidth = getTextRunWidth(pdf, run, normalStyle, highlightStyle, sizePt, hasThaiFont)
    if (line.length > 0 && lineWidth + runWidth > maxWidthMm) {
      lines.push(line)
      if (lines.length >= maxLines) return lines
      line = []
      lineWidth = 0
    }

    line.push(run)
    lineWidth += runWidth
  }

  if (line.length > 0 && lines.length < maxLines) lines.push(line)
  return lines
}

function drawHighlightedText(
  pdf: jsPDF,
  runs: TextRun[],
  x: number,
  y: number,
  maxWidthMm: number,
  maxLines: number,
  lineHeightMm: number,
  sizePt: number,
  hasThaiFont: boolean,
) {
  const lines = wrapRuns(pdf, runs, maxWidthMm, maxLines, "medium", "bold", sizePt, hasThaiFont)

  lines.forEach((line, lineIndex) => {
    let cursorX = x
    line.forEach((run) => {
      pdf.setTextColor(run.highlight ? 29 : 52, run.highlight ? 78 : 64, run.highlight ? 216 : 84)
      setFont(pdf, run.highlight ? "bold" : "medium", sizePt, hasThaiFont)
      pdf.text(run.text, cursorX, y + lineIndex * lineHeightMm, { baseline: "top" })
      cursorX += pdf.getTextWidth(run.text)
    })
  })

  return lines.length * lineHeightMm
}

function wrapLongToken(pdf: jsPDF, token: string, maxWidthMm: number) {
  const chunks: string[] = []
  let current = ""
  for (const char of Array.from(token)) {
    const next = current + char
    if (current && pdf.getTextWidth(next) > maxWidthMm) {
      chunks.push(current)
      current = char
    } else {
      current = next
    }
  }
  if (current) chunks.push(current)
  return chunks
}

function wrapText(pdf: jsPDF, text: string, maxWidthMm: number, maxLines: number) {
  const tokens = tokenize(text)
  const lines: string[] = []
  let current = ""

  for (const token of tokens) {
    if (!current && /^\s+$/.test(token)) continue
    const next = current + token
    if (pdf.getTextWidth(next) <= maxWidthMm) {
      current = next
      continue
    }

    if (current) {
      lines.push(current.trimEnd())
      current = ""
      if (lines.length >= maxLines) break
    }

    const nextToken = token.trimStart()
    if (pdf.getTextWidth(nextToken) <= maxWidthMm) {
      current = nextToken
    } else {
      const chunks = wrapLongToken(pdf, nextToken, maxWidthMm)
      for (const chunk of chunks) {
        lines.push(chunk)
        if (lines.length >= maxLines) break
      }
    }
    if (lines.length >= maxLines) break
  }

  if (current && lines.length < maxLines) lines.push(current.trimEnd())
  return lines
}

function drawTextBlock(pdf: jsPDF, lines: string[], x: number, y: number, lineHeightMm: number) {
  lines.forEach((line, index) => {
    pdf.text(line, x, y + index * lineHeightMm, { baseline: "top" })
  })
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

function getContentTypeLabel(contentType?: string) {
  const labels: Record<string, string> = {
    STATIC: "STATIC AD",
    "STATIC AD": "STATIC AD",
    ALBUM: "ALBUM AD",
    "ALBUM AD": "ALBUM AD",
    MOTION: "SHORT VDO",
    "MOTION AD": "SHORT VDO",
    "SHORT VDO": "SHORT VDO",
    "SHORT VIDEO": "SHORT VDO",
    UGC: "UGC VIDEO",
    "UGC VIDEO": "UGC VIDEO",
  }

  return contentType ? labels[contentType.toUpperCase()] || contentType : ""
}

function getCardData(idea: IdeaRecommendation) {
  const metaTags = [...(idea.tags || []), idea.content_pillar, idea.product_focus]
    .filter(Boolean)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 2)

  return {
    hook: idea.copywriting?.headline || idea.title || idea.concept_idea || "",
    subheadline: idea.copywriting?.sub_headline_1 || idea.copywriting?.sub_headline_2 || "",
    cta: idea.copywriting?.cta || "",
    why: idea.competitiveGap || getDescriptionSummary(idea.description),
    metaTags,
    contentType: getContentTypeLabel(idea.content_type),
  }
}

function drawIdeaCard(
  pdf: jsPDF,
  idea: IdeaRecommendation,
  ideaNumber: number,
  group: ReviewIdeaGroup,
  highlightTerms: string[] | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
  hasThaiFont: boolean,
) {
  const data = getCardData(idea)
  const padX = 6.5
  const contentX = x + padX
  const contentWidth = width - padX * 2
  const bodyFontSize = 11.6
  const bodyLineHeight = bodyFontSize * PT_TO_MM * 1.42

  pdf.setDrawColor(220, 227, 236)
  pdf.setFillColor(255, 255, 255)
  pdf.roundedRect(x, y, width, height, 3.2, 3.2, "FD")

  pdf.setFillColor(238, 242, 255)
  pdf.roundedRect(contentX, y + 7, 21, 6.2, 1.6, 1.6, "F")
  pdf.setTextColor(37, 99, 235)
  setFont(pdf, "bold", 9.7, hasThaiFont)
  pdf.text(`Idea ${ideaNumber}`, contentX + 10.5, y + 10.1, { align: "center", baseline: "middle" })

  let nextBadgeX = contentX + 24
  if (data.contentType) {
    const badgeX = nextBadgeX
    setFont(pdf, "bold", 9.5, hasThaiFont)
    const badgeWidth = Math.min(29, Math.max(21, pdf.getTextWidth(data.contentType) + 7))
    pdf.setFillColor(244, 247, 255)
    pdf.roundedRect(badgeX, y + 7, badgeWidth, 6.2, 1.6, 1.6, "F")
    pdf.setTextColor(29, 78, 216)
    pdf.text(data.contentType, badgeX + badgeWidth / 2, y + 10.1, { align: "center", baseline: "middle" })
    nextBadgeX = badgeX + badgeWidth + 3
  }

  const groupLabel = group === "recommended" ? "REC" : "OPT"
  const groupBadgeWidth = group === "recommended" ? 15 : 15.5
  pdf.setFillColor(group === "recommended" ? 219 : 245, group === "recommended" ? 234 : 245, group === "recommended" ? 254 : 245)
  pdf.roundedRect(nextBadgeX, y + 7, groupBadgeWidth, 6.2, 1.6, 1.6, "F")
  pdf.setTextColor(group === "recommended" ? 29 : 102, group === "recommended" ? 78 : 112, group === "recommended" ? 216 : 133)
  setFont(pdf, "bold", 8.6, hasThaiFont)
  pdf.text(groupLabel, nextBadgeX + groupBadgeWidth / 2, y + 10.1, { align: "center", baseline: "middle" })

  if (data.metaTags.length > 0) {
    pdf.setTextColor(102, 112, 133)
    setFont(pdf, "medium", 9.0, hasThaiFont)
    const metaText = data.metaTags.join(" · ")
    const metaLines = wrapText(pdf, metaText, contentWidth, 1)
    pdf.text(metaLines[0] || "", contentX, y + 18.5, { baseline: "top" })
  }

  const hookFontSize = data.hook.length > 92 ? 16.8 : data.hook.length > 58 ? 18.4 : 19.8
  const hookLineHeight = hookFontSize * PT_TO_MM * 1.18
  pdf.setTextColor(16, 24, 40)
  setFont(pdf, "bold", hookFontSize, hasThaiFont)
  const hookLines = wrapText(pdf, data.hook, contentWidth, 3)
  drawTextBlock(pdf, hookLines, contentX, y + 57, hookLineHeight)

  if (data.subheadline) {
    const subY = y + 84
    drawHighlightedText(
      pdf,
      makeHighlightedRuns(data.subheadline, idea, highlightTerms),
      contentX,
      subY,
      contentWidth,
      3,
      bodyLineHeight,
      bodyFontSize,
      hasThaiFont,
    )
  }

  if (data.cta) {
    const ctaTextY = y + 112
    pdf.setTextColor(102, 112, 133)
    setFont(pdf, "semibold", 9.1, hasThaiFont)
    pdf.text("CTA", contentX, ctaTextY, { baseline: "top" })

    pdf.setTextColor(71, 84, 103)
    setFont(pdf, "medium", bodyFontSize, hasThaiFont)
    const ctaLines = wrapText(pdf, data.cta, contentWidth, 2)
    drawTextBlock(pdf, ctaLines, contentX, ctaTextY + 6.5, bodyLineHeight)
  }

  if (data.why) {
    const whyBoxY = y + height - 35
    pdf.setFillColor(238, 242, 255)
    pdf.roundedRect(contentX, whyBoxY, contentWidth, 30, 2.2, 2.2, "F")
    pdf.setTextColor(29, 78, 216)
    setFont(pdf, "bold", 8.8, hasThaiFont)
    pdf.text("เหตุผลที่แนวคิดนี้น่าสนใจ", contentX + 4, whyBoxY + 4.2, { baseline: "top" })
    setFont(pdf, "bold", bodyFontSize, hasThaiFont)
    const whyLines = wrapText(pdf, data.why, contentWidth - 17, 3)
    drawTextBlock(pdf, whyLines, contentX + 4, whyBoxY + 9.5, bodyLineHeight)
    pdf.setTextColor(16, 24, 40)
    setFont(pdf, "bold", 11, hasThaiFont)
    pdf.text("→", contentX + contentWidth - 6, whyBoxY + 15, { baseline: "middle" })
  }
}

function drawSectionHeading(pdf: jsPDF, heading: string, x: number, y: number, hasThaiFont: boolean) {
  pdf.setTextColor(16, 24, 40)
  setFont(pdf, "bold", 13.5, hasThaiFont)
  pdf.text(heading, x, y, { baseline: "top" })
}

function savePdf(pdf: jsPDF, filename: string) {
  const bytes = Uint8Array.from(pdf.output(), (char) => char.charCodeAt(0) & 0xff)
  const blob = new Blob([bytes], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export async function exportIdeasReviewPdf(
  sections: ReviewIdeaSection[],
  filename: string,
  highlightMap: ReviewHighlightMap = {},
) {
  const sectionsToRender = sections
    .map((section) => ({ ...section, ideas: section.ideas.slice(0, MAX_IDEAS) }))
    .filter((section) => section.ideas.length > 0)
  if (sectionsToRender.length === 0) return

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" })
  const hasThaiFont = await ensureFonts(pdf)
  const usableWidth = PAGE_WIDTH_MM - HORIZONTAL_MARGIN_MM * 2
  const cardWidth = (usableWidth - GAP_MM * (COLUMNS - 1)) / COLUMNS
  const cardHeight = CARD_HEIGHT_MM
  const cardY = VERTICAL_MARGIN_MM + Math.max(0, PAGE_HEIGHT_MM - VERTICAL_MARGIN_MM * 2 - cardHeight) / 2
  let ideaNumber = 1

  sectionsToRender.forEach((section, sectionIndex) => {
    if (sectionIndex > 0) pdf.addPage()

    section.ideas.forEach((idea, index) => {
      if (index > 0 && index % COLUMNS === 0) pdf.addPage()
      if (index % COLUMNS === 0) {
        drawSectionHeading(pdf, section.heading, HORIZONTAL_MARGIN_MM, 8, hasThaiFont)
      }

      const col = index % COLUMNS
      const x = HORIZONTAL_MARGIN_MM + col * (cardWidth + GAP_MM)
      drawIdeaCard(
        pdf,
        idea,
        ideaNumber,
        section.group,
        highlightMap[getReviewHighlightKey(section.group, index)],
        x,
        cardY,
        cardWidth,
        cardHeight,
        hasThaiFont,
      )
      ideaNumber += 1
    })
  })

  savePdf(pdf, filename)
}
