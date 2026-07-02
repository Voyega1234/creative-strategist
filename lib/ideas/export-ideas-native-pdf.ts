import jsPDF, { AcroFormCheckBox } from "jspdf"

import type { IdeaRecommendation } from "@/lib/ideas/types"

const MAX_IDEAS = 10
const PAGE_WIDTH_MM = 210
const PAGE_HEIGHT_MM = 297
const MARGIN_MM = 8
const GAP_MM = 3
const COLUMNS = 3
const CARD_HEIGHT_MM = 88.5
const SELECTION_STRIP_MM = 10.8
const CHECKBOX_SIZE_MM = 4.8
const SECTION_HEADING_FONT_PT = 10.5
const SECTION_HEADING_TOP_MARGIN_MM = 4
const SECTION_HEADING_GAP_MM = 5
const PT_TO_MM = 0.3528
const FONT_NAME = "SukhumvitNative"
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

const CHECKBOX_BLUE_RGB = "0.145 0.388 0.922"
const CHECKBOX_RADIUS_FRACTION = 0.24
const CHECKBOX_BORDER_FRACTION = 0.1
const CHECKBOX_CHECK_FRACTION = 0.14

type FontStyle = keyof typeof FONT_FILES
type AppearanceXObject = { BBox: number[]; stream: string }
type AppearanceFactory = (this: unknown, formObject: unknown) => AppearanceXObject
type CheckboxWithAppearance = AcroFormCheckBox & {
  appearanceStreamContent?: { N?: Record<string, AppearanceFactory>; [k: string]: unknown }
}
type CardData = ReturnType<typeof getCardData>
type CardLayout = {
  data: CardData
  hookFontSize: number
  subFontSize: number
  ctaFontSize: number
  whyFontSize: number
  hookLines: string[]
  subLines: string[]
  ctaLines: string[]
  whyLines: string[]
  hookLineHeight: number
  subLineHeight: number
  ctaLineHeight: number
  whyLineHeight: number
  hookY: number
  subY: number
  ctaY: number
  whyBoxY: number
  whyBoxHeight: number
  cardHeight: number
}
type RowLayout = {
  items: Array<{ layout: CardLayout; index: number }>
  height: number
}

const fontBase64Promises = new Map<string, Promise<string>>()

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
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
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
    console.warn("[Native PDF Export] Failed to load Sukhumvit Set, falling back to Helvetica:", error)
    return false
  }
}

function setFont(pdf: jsPDF, style: FontStyle, sizePt: number, hasThaiFont: boolean) {
  pdf.setFont(hasThaiFont ? FONT_NAME : "helvetica", hasThaiFont ? style : style === "normal" ? "normal" : "bold")
  pdf.setFontSize(sizePt)
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

function tokenizeForPdfWrap(text: string) {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const Segmenter = Intl.Segmenter
    const segmenter = new Segmenter("th", { granularity: "word" })
    return Array.from(segmenter.segment(text))
      .map((segment) => segment.segment)
      .filter((segment) => segment.length > 0)
  }

  return text.split(/(\s+)/).filter(Boolean)
}

function wrapText(pdf: jsPDF, text: string, maxWidthMm: number, maxLines: number) {
  const cleanText = text.replace(/\s+/g, " ").trim()
  if (!cleanText) return []
  const lines: string[] = []
  const tokens = tokenizeForPdfWrap(cleanText)
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
  if (lines.length > maxLines) return lines.slice(0, maxLines)
  return lines
}

function drawTextBlock(
  pdf: jsPDF,
  lines: string[],
  x: number,
  y: number,
  lineHeightMm: number,
  options?: { maxLines?: number },
) {
  const visibleLines = options?.maxLines ? lines.slice(0, options.maxLines) : lines
  visibleLines.forEach((line, index) => {
    pdf.text(line, x, y + index * lineHeightMm, { baseline: "top" })
  })
}

function drawCenteredTextBlock(
  pdf: jsPDF,
  lines: string[],
  x: number,
  y: number,
  boxHeight: number,
  lineHeightMm: number,
) {
  const blockHeight = lines.length * lineHeightMm
  const textY = y + Math.max(0, (boxHeight - blockHeight) / 2)
  drawTextBlock(pdf, lines, x, textY, lineHeightMm)
}

function drawSectionHeading(pdf: jsPDF, text: string, x: number, topY: number, hasThaiFont: boolean) {
  pdf.setTextColor(17, 24, 39)
  setFont(pdf, "normal", SECTION_HEADING_FONT_PT, hasThaiFont)
  pdf.text(text, x, topY, { baseline: "top" })
  return SECTION_HEADING_FONT_PT * PT_TO_MM + 1.5
}

function getCardData(topic: IdeaRecommendation, index: number) {
  const visualRoutes = topic.visual_routes || []
  const previewRouteIndex = getStableRouteIndex(
    `${index}:${topic.title || ""}:${topic.concept_idea || ""}:${topic.copywriting?.headline || ""}`,
    visualRoutes.length,
  )
  const previewRoute = previewRouteIndex >= 0 ? visualRoutes[previewRouteIndex] : undefined
  const hook = topic.copywriting?.headline || topic.title || topic.concept_idea || ""
  const subheadline = topic.copywriting?.sub_headline_1 || topic.copywriting?.sub_headline_2 || ""
  const cta = topic.copywriting?.cta || ""
  const why = topic.competitiveGap || getDescriptionSummary(topic.description) || previewRoute?.why_it_fits || ""

  return {
    hook,
    subheadline,
    cta,
    why,
    contentType: getContentTypeLabel(topic.content_type),
    pillar: topic.content_pillar || "",
  }
}

function buildCardLayout(
  pdf: jsPDF,
  topic: IdeaRecommendation,
  index: number,
  width: number,
  hasThaiFont: boolean,
): CardLayout {
  const data = getCardData(topic, index)
  const padX = 4.8
  const contentWidth = width - padX * 2
  const hookFontSize = data.hook.length > 90 ? 8.8 : data.hook.length > 55 ? 9.6 : 10.8
  const subFontSize = data.subheadline.length > 160 ? 7.0 : data.subheadline.length > 100 ? 7.35 : 7.85
  const ctaFontSize = data.cta.length > 130 ? 6.65 : data.cta.length > 80 ? 6.95 : 7.35
  const whyFontSize = data.why.length > 170 ? 6.55 : data.why.length > 110 ? 6.85 : 7.25
  const hookLineHeight = hookFontSize * PT_TO_MM * 1.25
  const subLineHeight = subFontSize * PT_TO_MM * 1.42
  const ctaLineHeight = ctaFontSize * PT_TO_MM * 1.35
  const whyLineHeight = whyFontSize * PT_TO_MM * 1.24

  setFont(pdf, "bold", hookFontSize, hasThaiFont)
  const hookLines = wrapText(pdf, data.hook, contentWidth, 3)
  setFont(pdf, "semibold", subFontSize, hasThaiFont)
  const subLines = wrapText(pdf, data.subheadline, contentWidth, 4)
  setFont(pdf, "normal", ctaFontSize, hasThaiFont)
  const ctaLines = wrapText(pdf, data.cta, contentWidth, 2)
  setFont(pdf, "semibold", whyFontSize, hasThaiFont)
  const whyLines = wrapText(pdf, data.why, contentWidth - 14.5, 12)

  const hookY = 30.5
  const hookHeight = Math.max(hookLineHeight, hookLines.length * hookLineHeight)
  const subY = hookY + hookHeight + 9
  const subHeight = subLines.length * subLineHeight
  const ctaY = subY + Math.max(subLineHeight, subHeight) + 6
  const ctaHeight = ctaLines.length * ctaLineHeight
  const whyBoxY = ctaY + Math.max(ctaLineHeight, ctaHeight) + 5.2
  const whyBoxHeight = Math.max(13.6, whyLines.length * whyLineHeight + 5.2)
  const contentHeight = whyBoxY + whyBoxHeight + 2.8
  const cardHeight = Math.max(CARD_HEIGHT_MM, contentHeight + SELECTION_STRIP_MM)

  return {
    data,
    hookFontSize,
    subFontSize,
    ctaFontSize,
    whyFontSize,
    hookLines,
    subLines,
    ctaLines,
    whyLines,
    hookLineHeight,
    subLineHeight,
    ctaLineHeight,
    whyLineHeight,
    hookY,
    subY,
    ctaY,
    whyBoxY,
    whyBoxHeight,
    cardHeight,
  }
}

function alignLayoutsByRow(layouts: CardLayout[]) {
  const rows: RowLayout[] = []

  for (let row = 0; row < Math.ceil(layouts.length / COLUMNS); row += 1) {
    const items = layouts
      .slice(row * COLUMNS, row * COLUMNS + COLUMNS)
      .map((layout, index) => ({ layout, index: row * COLUMNS + index }))
    if (items.length === 0) continue

    const hookY = 30.5
    const hookZoneHeight = Math.max(
      ...items.map(({ layout }) => Math.max(layout.hookLineHeight, layout.hookLines.length * layout.hookLineHeight)),
    )
    const subY = hookY + hookZoneHeight + 9
    const subZoneHeight = Math.max(
      ...items.map(({ layout }) => Math.max(layout.subLineHeight, layout.subLines.length * layout.subLineHeight)),
    )
    const ctaY = subY + subZoneHeight + 2.8
    const ctaZoneHeight = Math.max(
      ...items.map(({ layout }) => Math.max(layout.ctaLineHeight, layout.ctaLines.length * layout.ctaLineHeight)),
    )
    const whyBoxY = ctaY + ctaZoneHeight + 6.8
    const whyBoxHeight = Math.max(
      13.6,
      ...items.map(({ layout }) => layout.whyLines.length * layout.whyLineHeight + 5.2),
    )
    const rowHeight = Math.max(CARD_HEIGHT_MM, whyBoxY + whyBoxHeight + 2.8 + SELECTION_STRIP_MM)

    const alignedItems = items.map(({ layout, index }) => ({
      index,
      layout: {
        ...layout,
        hookY,
        subY,
        ctaY,
        whyBoxY,
        whyBoxHeight,
        cardHeight: rowHeight,
      },
    }))

    rows.push({ items: alignedItems, height: rowHeight })
  }

  return rows
}

function drawCard(
  pdf: jsPDF,
  layout: CardLayout,
  x: number,
  y: number,
  width: number,
  height: number,
  hasThaiFont: boolean,
) {
  const data = layout.data
  const padX = 4.8
  const contentX = x + padX
  const contentWidth = width - padX * 2

  pdf.setDrawColor(220, 227, 236)
  pdf.setFillColor(255, 255, 255)
  pdf.roundedRect(x, y, width, height, 2.8, 2.8, "FD")

  const badgeY = y + 6
  const badgeHeight = 5.4
  if (data.contentType) {
    const badgeWidth = Math.min(22, Math.max(17, pdf.getTextWidth(data.contentType) + 6.5))
    pdf.setFillColor(238, 242, 255)
    pdf.roundedRect(contentX, badgeY, badgeWidth, badgeHeight, 1.2, 1.2, "F")
    pdf.setTextColor(55, 48, 216)
    setFont(pdf, "bold", 7.2, hasThaiFont)
    const textWidth = pdf.getTextWidth(data.contentType)
    pdf.text(data.contentType, contentX + (badgeWidth - textWidth) / 2, badgeY + badgeHeight / 2, {
      baseline: "middle",
    })

    if (data.pillar) {
      pdf.setTextColor(102, 112, 133)
      setFont(pdf, "medium", 7.4, hasThaiFont)
      const pillarLines = wrapText(pdf, data.pillar, contentWidth - badgeWidth - 4, 1)
      pdf.text(pillarLines[0] || "", contentX + badgeWidth + 3, badgeY + badgeHeight / 2, { baseline: "middle" })
    }
  } else if (data.pillar) {
    pdf.setTextColor(102, 112, 133)
    setFont(pdf, "medium", 7.4, hasThaiFont)
    const pillarLines = wrapText(pdf, data.pillar, contentWidth, 1)
    pdf.text(pillarLines[0] || "", contentX, badgeY + badgeHeight / 2, { baseline: "middle" })
  }

  pdf.setTextColor(16, 24, 40)
  setFont(pdf, "bold", layout.hookFontSize, hasThaiFont)
  drawTextBlock(pdf, layout.hookLines, contentX, y + layout.hookY, layout.hookLineHeight)

  pdf.setTextColor(52, 64, 84)
  setFont(pdf, "semibold", layout.subFontSize, hasThaiFont)
  drawTextBlock(pdf, layout.subLines, contentX, y + layout.subY, layout.subLineHeight)

  pdf.setTextColor(52, 64, 84)
  setFont(pdf, "normal", layout.ctaFontSize, hasThaiFont)
  drawTextBlock(pdf, layout.ctaLines, contentX, y + layout.ctaY, layout.ctaLineHeight)

  const whyBoxY = y + layout.whyBoxY
  pdf.setFillColor(238, 242, 255)
  pdf.roundedRect(contentX, whyBoxY, contentWidth, layout.whyBoxHeight, 1.8, 1.8, "F")
  pdf.setTextColor(55, 48, 216)
  setFont(pdf, "semibold", layout.whyFontSize, hasThaiFont)
  drawCenteredTextBlock(pdf, layout.whyLines, contentX + 3.2, whyBoxY, layout.whyBoxHeight, layout.whyLineHeight)
  pdf.setTextColor(16, 24, 40)
  setFont(pdf, "bold", 10, hasThaiFont)
  pdf.text("→", contentX + contentWidth - 5, whyBoxY + layout.whyBoxHeight / 2, { baseline: "middle" })
}

function addCardSelectionRow(
  pdf: jsPDF,
  fieldId: number,
  cardX: number,
  cardY: number,
  cardWidth: number,
  cardHeight: number,
  hasThaiFont: boolean,
) {
  const checkboxSize = CHECKBOX_SIZE_MM
  const x = cardX + 4.8
  const y = cardY + cardHeight - SELECTION_STRIP_MM + (SELECTION_STRIP_MM - checkboxSize) / 2
  const labelX = x + checkboxSize + 3

  pdf.setTextColor(128, 128, 136)
  setFont(pdf, "normal", 7.8, hasThaiFont)
  pdf.text("Select this topic", labelX, y + checkboxSize / 2, { baseline: "middle" })

  const checkbox = new AcroFormCheckBox()
  checkbox.fieldName = `native_select_idea_${fieldId}`
  checkbox.x = x
  checkbox.y = y
  checkbox.width = checkboxSize
  checkbox.height = checkboxSize
  checkbox.color = "#000000"
  checkbox.appearanceState = "Off"
  checkbox.value = "Off"
  checkbox.showWhenPrinted = true
  applyCustomCheckboxAppearance(checkbox)
  pdf.addField(checkbox)

  // Keep the card width parameter intentionally used in this function signature. It mirrors the
  // DOM exporter geometry and makes future x-position tweaks explicit.
  void cardWidth
}

function roundedRectPath(x: number, y: number, w: number, h: number, r: number) {
  const k = 0.5523
  const f = (n: number) => n.toFixed(3)
  const x1 = x + w
  const y1 = y + h
  const o = r * k
  return [
    `${f(x + r)} ${f(y)} m`,
    `${f(x1 - r)} ${f(y)} l`,
    `${f(x1 - r + o)} ${f(y)} ${f(x1)} ${f(y + r - o)} ${f(x1)} ${f(y + r)} c`,
    `${f(x1)} ${f(y1 - r)} l`,
    `${f(x1)} ${f(y1 - r + o)} ${f(x1 - r + o)} ${f(y1)} ${f(x1 - r)} ${f(y1)} c`,
    `${f(x + r)} ${f(y1)} l`,
    `${f(x + r - o)} ${f(y1)} ${f(x)} ${f(y1 - r + o)} ${f(x)} ${f(y1 - r)} c`,
    `${f(x)} ${f(y + r)} l`,
    `${f(x)} ${f(y + r - o)} ${f(x + r - o)} ${f(y)} ${f(x + r)} ${f(y)} c`,
    "h",
  ].join("\n")
}

function buildCheckedStream(w: number, h: number) {
  const f = (n: number) => n.toFixed(3)
  const side = Math.min(w, h)
  return [
    "q",
    `${CHECKBOX_BLUE_RGB} rg`,
    roundedRectPath(0, 0, w, h, side * CHECKBOX_RADIUS_FRACTION),
    "f",
    "1 1 1 RG",
    `${f(side * CHECKBOX_CHECK_FRACTION)} w`,
    "1 J",
    "1 j",
    `${f(w * 0.26)} ${f(h * 0.5)} m`,
    `${f(w * 0.43)} ${f(h * 0.33)} l`,
    `${f(w * 0.75)} ${f(h * 0.71)} l`,
    "S",
    "Q",
  ].join("\n")
}

function buildUncheckedStream(w: number, h: number) {
  const f = (n: number) => n.toFixed(3)
  const side = Math.min(w, h)
  const border = side * CHECKBOX_BORDER_FRACTION
  const inset = border / 2
  const radius = side * CHECKBOX_RADIUS_FRACTION
  return [
    "q",
    "1 1 1 rg",
    roundedRectPath(0, 0, w, h, radius),
    "f",
    `${CHECKBOX_BLUE_RGB} RG`,
    `${f(border)} w`,
    roundedRectPath(inset, inset, w - border, h - border, Math.max(0.1, radius - inset)),
    "S",
    "Q",
  ].join("\n")
}

function applyCustomCheckboxAppearance(checkbox: AcroFormCheckBox) {
  const checkboxWithAppearance = checkbox as CheckboxWithAppearance
  const factory = checkboxWithAppearance.appearanceStreamContent?.N?.On
  if (!factory) return
  const withStream = (build: (w: number, h: number) => string): AppearanceFactory =>
    function (this: unknown, formObject: unknown) {
      const xobj = factory.call(this, formObject)
      xobj.stream = build(xobj.BBox[2], xobj.BBox[3])
      return xobj
    }
  checkboxWithAppearance.appearanceStreamContent = {
    N: {
      On: withStream(buildCheckedStream),
      Off: withStream(buildUncheckedStream),
    },
  }
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

async function renderSection(
  pdf: jsPDF,
  heading: string,
  ideas: IdeaRecommendation[],
  startOnNewPage: boolean,
  fieldIdStart: number,
  hasThaiFont: boolean,
) {
  if (ideas.length === 0) return fieldIdStart
  if (startOnNewPage) pdf.addPage()

  const usableWidth = PAGE_WIDTH_MM - MARGIN_MM * 2
  const colWidth = (usableWidth - GAP_MM * (COLUMNS - 1)) / COLUMNS
  const gridWidth = colWidth * COLUMNS + GAP_MM * (COLUMNS - 1)
  const offsetX = (PAGE_WIDTH_MM - gridWidth) / 2
  const bottomLimit = PAGE_HEIGHT_MM - MARGIN_MM

  let cursorY = MARGIN_MM + SECTION_HEADING_TOP_MARGIN_MM
  cursorY += drawSectionHeading(pdf, heading, offsetX, cursorY, hasThaiFont) + SECTION_HEADING_GAP_MM

  const ideasToRender = ideas.slice(0, MAX_IDEAS)
  const layouts = ideasToRender.map((idea, index) => buildCardLayout(pdf, idea, index, colWidth, hasThaiFont))
  const rows = alignLayoutsByRow(layouts)

  let fieldId = fieldIdStart
  rows.forEach((row, rowIndex) => {
    if (rowIndex > 0 && cursorY + row.height > bottomLimit) {
      pdf.addPage()
      cursorY = MARGIN_MM + SECTION_HEADING_TOP_MARGIN_MM
      cursorY += drawSectionHeading(pdf, `${heading} (continued)`, offsetX, cursorY, hasThaiFont) + SECTION_HEADING_GAP_MM
    }

    row.items.forEach(({ layout, index }) => {
      const col = index % COLUMNS
      const x = offsetX + col * (colWidth + GAP_MM)
      drawCard(pdf, layout, x, cursorY, colWidth, row.height, hasThaiFont)
      addCardSelectionRow(pdf, fieldId, x, cursorY, colWidth, row.height, hasThaiFont)
      fieldId += 1
    })

    cursorY += row.height + GAP_MM
  })

  return fieldId
}

export async function exportIdeasNativePdf(
  recommendedIdeas: IdeaRecommendation[],
  otherIdeas: IdeaRecommendation[],
  filename: string,
) {
  if (recommendedIdeas.length === 0) return
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" })
  const hasThaiFont = await ensureFonts(pdf)
  const nextFieldId = await renderSection(pdf, "Recommended topics", recommendedIdeas, false, 1, hasThaiFont)
  if (otherIdeas.length > 0) {
    await renderSection(pdf, "Other options", otherIdeas, true, nextFieldId, hasThaiFont)
  }
  savePdf(pdf, filename)
}
