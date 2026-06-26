import html2canvas from "html2canvas"
import jsPDF, { AcroFormCheckBox } from "jspdf"

const MAX_IDEAS = 10
const SCALE = 2
// The selection row lives INSIDE each card: capture reserves this much empty space at the
// bottom of the card so the checkbox never overlaps the CTA or other text. All selection
// sizes are in the card's own CSS px (490px wide) so they scale with the card content.
const SELECTION_STRIP_CSS_PX = 70
const CHECKBOX_SIZE_CSS_PX = 34
const CHECKBOX_LABEL_GAP_CSS_PX = 12
const SELECTION_LEFT_INSET_CSS_PX = 16
const SELECTION_LABEL_FONT_CSS_PX = 22
// Section headings ("1. Recommended topics" / "2. Other options") for the multi-page export.
const SECTION_HEADING_FONT_PT = 10.5
const SECTION_HEADING_TOP_MARGIN_MM = 4
const SECTION_HEADING_GAP_MM = 5
const PDF_TEXT_FONT_NAME = "SukhumvitSet"
const PDF_TEXT_FONT_FILE = "SukhumvitSet-Text.ttf"
const PDF_TEXT_FONT_URL = "/fonts/Sukhumvit_Set/SukhumvitSet-Text.ttf"
// Brand blue (#2563eb) used for the checkbox fill/border, as a PDF rgb triple.
const CHECKBOX_BLUE_RGB = "0.145 0.388 0.922"
// Visual proportions of the box, expressed as fractions of its side so they scale with layout.
const CHECKBOX_RADIUS_FRACTION = 0.24
const CHECKBOX_BORDER_FRACTION = 0.1
const CHECKBOX_CHECK_FRACTION = 0.14
const ROW_HEIGHT_SAFETY_CSS_PX = 2

type ExportOptions = {
  columns: number
  orientation: "landscape" | "portrait"
  enlargeHook: boolean
  // Page margin and gap between cards (mm). Smaller => wider columns => bigger text.
  marginMm: number
  gapMm: number
  // Fixed capture width (px). Narrower than the on-screen card => bigger text once it is
  // scaled to fill the PDF column. Keeps the result consistent regardless of screen size.
  captureWidthPx?: number
}

// jsPDF builds checkbox appearance lazily: appearanceStreamContent is { N: { On, Off }, ... }
// where each state is a factory (formObject) => AcroFormXObject, called at output time.
type AppearanceXObject = { BBox: number[]; stream: string }
type AppearanceFactory = (this: unknown, formObject: unknown) => AppearanceXObject
type CheckboxWithAppearance = AcroFormCheckBox & {
  appearanceStreamContent?: { N?: Record<string, AppearanceFactory>; [k: string]: unknown }
}

let pdfTextFontPromise: Promise<string> | null = null

function getExportCardBox(element: HTMLElement) {
  return element.firstElementChild instanceof HTMLElement ? element.firstElementChild : element
}

async function loadFontAsBase64(url: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load font ${url}: ${response.status}`)
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  const chunkSize = 0x8000
  let binary = ""
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

async function ensurePdfTextFont(pdf: jsPDF) {
  try {
    pdfTextFontPromise ??= loadFontAsBase64(PDF_TEXT_FONT_URL)
    const fontBase64 = await pdfTextFontPromise
    pdf.addFileToVFS(PDF_TEXT_FONT_FILE, fontBase64)
    pdf.addFont(PDF_TEXT_FONT_FILE, PDF_TEXT_FONT_NAME, "normal")
    return PDF_TEXT_FONT_NAME
  } catch (error) {
    console.warn("[PDF Export] Failed to load Sukhumvit Set, falling back to Helvetica:", error)
    return "helvetica"
  }
}

async function waitForDocumentFonts() {
  if (typeof document === "undefined" || !("fonts" in document)) return
  await document.fonts.ready
}

// Capture a single card. `targetHeightCssPx`, when set, forces the card box to that
// exact height so every card in the same row captures to the same canvas height.
async function captureCard(card: HTMLElement, targetHeightCssPx: number | undefined, options: ExportOptions) {
  const captureWidth = options.captureWidthPx
  return html2canvas(card, {
    scale: SCALE,
    backgroundColor: "#ffffff",
    height: targetHeightCssPx,
    width: captureWidth,
    windowWidth: captureWidth,
    onclone: (_doc, clonedCard) => {
      const clonedCardBox = getExportCardBox(clonedCard)
      // A fixed, narrower width makes everything bigger once scaled to the PDF column.
      if (captureWidth) {
        clonedCard.style.width = `${captureWidth}px`
        clonedCardBox.style.width = `${captureWidth}px`
      }
      // Show the full text instead of the on-screen 2-line clamp.
      clonedCard.querySelectorAll<HTMLElement>('[class*="line-clamp"]').forEach((el) => {
        el.style.webkitLineClamp = "unset"
        el.style.display = "block"
        el.style.overflow = "visible"
        el.style.maxHeight = "none"
      })
      // html2canvas can't vertically center text inside the pill badges, so hide them.
      clonedCard.querySelectorAll<HTMLElement>('div[class*="rounded-full"]').forEach((el) => {
        el.style.display = "none"
      })
      // The hook is the only <h4> in the card.
      if (options.enlargeHook) {
        clonedCard.querySelectorAll<HTMLElement>("h4").forEach((el) => {
          el.style.fontSize = "1.7rem"
        })
      }
      clonedCard.style.boxSizing = "border-box"
      clonedCardBox.style.boxSizing = "border-box"
      // Reserve empty space at the bottom of the card for the selection checkbox so it sits
      // inside the card border without overlapping the content above it.
      clonedCardBox.style.paddingBottom = `${SELECTION_STRIP_CSS_PX}px`
      if (targetHeightCssPx) {
        const height = `${targetHeightCssPx}px`
        clonedCard.style.height = height
        clonedCard.style.minHeight = height
        clonedCard.style.maxHeight = height
        clonedCardBox.style.height = height
        clonedCardBox.style.minHeight = height
        clonedCardBox.style.maxHeight = height
      }
    },
  })
}

async function buildPdf(allCardElements: HTMLElement[], filename: string, options: ExportOptions) {
  // Only the first 10 ideas are exported so everything stays readable on one page.
  const cardElements = allCardElements.slice(0, MAX_IDEAS)
  if (cardElements.length === 0) return
  await waitForDocumentFonts()

  const isLandscape = options.orientation === "landscape"
  const pageWidthMm = isLandscape ? 297 : 210
  const pageHeightMm = isLandscape ? 210 : 297

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: options.orientation })
  const pdfTextFont = await ensurePdfTextFont(pdf)
  const usableWidth = pageWidthMm - options.marginMm * 2
  const usableHeight = pageHeightMm - options.marginMm * 2

  const columns = Math.min(options.columns, cardElements.length)
  const colWidthMm = (usableWidth - options.gapMm * (columns - 1)) / columns

  // Pass 1: capture every card at natural height to measure each one.
  const firstPass = await Promise.all(cardElements.map((card) => captureCard(card, undefined, options)))
  const canvasWidthPx = firstPass[0].width
  const cardCssWidthPx = canvasWidthPx / SCALE
  const naturalHeightsPx = firstPass.map((canvas) => canvas.height)

  // Each row's height = the tallest card in that row.
  const rowCount = Math.ceil(cardElements.length / columns)
  const rowMaxPx: number[] = []
  for (let row = 0; row < rowCount; row += 1) {
    const slice = naturalHeightsPx.slice(row * columns, row * columns + columns)
    rowMaxPx[row] = Math.max(...slice)
  }
  const rowTargetHeightCssPx = rowMaxPx.map((px) => Math.ceil(px / SCALE) + ROW_HEIGHT_SAFETY_CSS_PX)
  const rowHeightMm = rowTargetHeightCssPx.map((px) => (px * colWidthMm) / cardCssWidthPx)

  // Pass 2: stretch every card up to its own row's height so each row aligns.
  const images = await Promise.all(
    cardElements.map(async (card, index) => {
      const row = Math.floor(index / columns)
      const canvas = await captureCard(card, rowTargetHeightCssPx[row], options)
      return canvas.toDataURL("image/jpeg", 0.9)
    }),
  )

  // The selection strip is part of each card image now (reserved via paddingBottom), so the
  // grid height is just the rows plus the gaps between them.
  const totalHeight = rowHeightMm.reduce((sum, h) => sum + h, 0) + options.gapMm * (rowCount - 1)

  // Scale the whole grid down so it fits the page height (width already fits at scale 1).
  const scale = Math.min(1, usableHeight / totalHeight)
  const scaledColWidth = colWidthMm * scale
  const scaledGap = options.gapMm * scale
  const gridWidth = scaledColWidth * columns + scaledGap * (columns - 1)
  const gridHeight = totalHeight * scale

  // Convert a card CSS px measurement to mm on the page. The drawn card is `scaledColWidth`
  // mm wide and represents a card that is `cardCssWidthPx` CSS px wide, so the two scale
  // together — selection sizes stay proportional to the card content at any layout scale.
  const cssToMm = (cssPx: number) => (cssPx * scaledColWidth) / cardCssWidthPx

  // Center the grid on the page.
  const offsetX = (pageWidthMm - gridWidth) / 2
  let cursorY = (pageHeightMm - gridHeight) / 2

  for (let row = 0; row < rowCount; row += 1) {
    const scaledRowHeight = rowHeightMm[row] * scale
    const rowImages = images.slice(row * columns, row * columns + columns)
    rowImages.forEach((imageData, col) => {
      const cardIndex = row * columns + col
      const x = offsetX + col * (scaledColWidth + scaledGap)
      pdf.addImage(imageData, "JPEG", x, cursorY, scaledColWidth, scaledRowHeight)
      addCardSelectionRow(pdf, cardIndex + 1, x, cursorY + scaledRowHeight, cssToMm, pdfTextFont)
    })
    cursorY += scaledRowHeight + scaledGap
  }

  savePdf(pdf, filename)
}

// Draws the checkbox + label inside the card's reserved bottom strip. `cardBottom` is the
// bottom edge of the drawn card; the strip occupies the last `SELECTION_STRIP_CSS_PX` of it.
function addCardSelectionRow(
  pdf: jsPDF,
  fieldId: number,
  cardX: number,
  cardBottom: number,
  cssToMm: (cssPx: number) => number,
  fontName: string,
) {
  const strip = cssToMm(SELECTION_STRIP_CSS_PX)
  const checkboxSize = cssToMm(CHECKBOX_SIZE_CSS_PX)
  const x = cardX + cssToMm(SELECTION_LEFT_INSET_CSS_PX)
  const y = cardBottom - strip + (strip - checkboxSize) / 2
  const labelX = x + checkboxSize + cssToMm(CHECKBOX_LABEL_GAP_CSS_PX)
  const labelBaselineY = y + checkboxSize / 2 + cssToMm(SELECTION_LABEL_FONT_CSS_PX) * 0.34

  pdf.setTextColor(128, 128, 136)
  pdf.setFont(fontName, "normal")
  pdf.setFontSize(Math.max(5, cssToMm(SELECTION_LABEL_FONT_CSS_PX) / 0.3528))
  pdf.text("Select this topic", labelX, labelBaselineY)

  const checkbox = new AcroFormCheckBox()
  checkbox.fieldName = `select_idea_${fieldId}`
  checkbox.x = x
  checkbox.y = y
  checkbox.width = checkboxSize
  checkbox.height = checkboxSize
  // Set so jsPDF's appearance factory (reused in applyCustomCheckboxAppearance) never reads an
  // undefined color; the value is irrelevant since we overwrite the drawing operators.
  checkbox.color = "#000000"
  checkbox.appearanceState = "Off"
  checkbox.value = "Off"
  checkbox.showWhenPrinted = true
  applyCustomCheckboxAppearance(checkbox)
  pdf.addField(checkbox)
}

// PDF path operators for a rounded rectangle in the appearance-stream coordinate space.
function roundedRectPath(x: number, y: number, w: number, h: number, r: number) {
  const k = 0.5523 // circle-to-Bezier constant
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

// Checked: solid blue rounded square with a white check mark.
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

// Unchecked: white rounded square with a blue border.
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

// Replace jsPDF's default ZapfDingbats appearance with custom vector Off/On states so the
// checkbox renders identically across viewers and matches the on-screen design.
function applyCustomCheckboxAppearance(checkbox: AcroFormCheckBox) {
  const checkboxWithAppearance = checkbox as CheckboxWithAppearance
  // Reuse jsPDF's own factory to produce a valid AcroFormXObject (correct BBox, scope,
  // putStream), then overwrite only its drawing operators.
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

// Export uses the dedicated print-only cards (IdeaExportCard): 3 columns (10 = 3,3,3,1),
// portrait, tight margins. Each row is sized to its tallest card.
export async function exportIdeaCardsToPdf(allCardElements: HTMLElement[], filename: string) {
  return buildPdf(allCardElements, filename, {
    columns: 3,
    orientation: "portrait",
    enlargeHook: false,
    marginMm: 4,
    gapMm: 3,
  })
}

// Draws a left-aligned section heading and returns the vertical space it consumes (mm).
function drawSectionHeading(pdf: jsPDF, text: string, x: number, topY: number, fontName: string) {
  pdf.setTextColor(17, 24, 39) // #111827
  pdf.setFont(fontName, "normal")
  pdf.setFontSize(SECTION_HEADING_FONT_PT)
  const ptToMm = 0.3528
  // text() positions by baseline; offset down by the cap height so topY is the visual top.
  pdf.text(text, x, topY + SECTION_HEADING_FONT_PT * ptToMm)
  return SECTION_HEADING_FONT_PT * ptToMm + 1.5
}

// Renders one titled section, flowing its cards across as many pages as needed (Recommended
// topics is unbounded). Cards are drawn at natural column width — no global shrink — so long
// lists paginate instead of becoming unreadable. Returns the next unused checkbox field id.
async function renderSection(
  pdf: jsPDF,
  heading: string,
  cardElements: HTMLElement[],
  options: ExportOptions,
  startOnNewPage: boolean,
  fieldIdStart: number,
): Promise<number> {
  if (cardElements.length === 0) return fieldIdStart
  await waitForDocumentFonts()

  const pageWidthMm = 210
  const pageHeightMm = 297
  const usableWidth = pageWidthMm - options.marginMm * 2
  const columns = Math.min(options.columns, cardElements.length)
  const colWidthMm = (usableWidth - options.gapMm * (columns - 1)) / columns

  // Pass 1: measure every card.
  const firstPass = await Promise.all(cardElements.map((card) => captureCard(card, undefined, options)))
  const canvasWidthPx = firstPass[0].width
  const cardCssWidthPx = canvasWidthPx / SCALE
  const naturalHeightsPx = firstPass.map((canvas) => canvas.height)

  const rowCount = Math.ceil(cardElements.length / columns)
  const rowMaxPx: number[] = []
  for (let row = 0; row < rowCount; row += 1) {
    const slice = naturalHeightsPx.slice(row * columns, row * columns + columns)
    rowMaxPx[row] = Math.max(...slice)
  }
  const rowTargetHeightCssPx = rowMaxPx.map((px) => Math.ceil(px / SCALE) + ROW_HEIGHT_SAFETY_CSS_PX)
  const rowHeightMm = rowTargetHeightCssPx.map((px) => (px * colWidthMm) / cardCssWidthPx)

  // Pass 2: re-capture each card at its row's target height so a row aligns.
  const images = await Promise.all(
    cardElements.map(async (card, index) => {
      const row = Math.floor(index / columns)
      const canvas = await captureCard(card, rowTargetHeightCssPx[row], options)
      return canvas.toDataURL("image/jpeg", 0.9)
    }),
  )

  const cssToMm = (cssPx: number) => (cssPx * colWidthMm) / cardCssWidthPx
  const gridWidth = colWidthMm * columns + options.gapMm * (columns - 1)
  const offsetX = (pageWidthMm - gridWidth) / 2
  const bottomLimit = pageHeightMm - options.marginMm
  const pdfTextFont = await ensurePdfTextFont(pdf)

  if (startOnNewPage) pdf.addPage()
  let cursorY = options.marginMm + SECTION_HEADING_TOP_MARGIN_MM
  cursorY += drawSectionHeading(pdf, heading, offsetX, cursorY, pdfTextFont) + SECTION_HEADING_GAP_MM

  let fieldId = fieldIdStart
  for (let row = 0; row < rowCount; row += 1) {
    const rowHeight = rowHeightMm[row]
    // Break to a new page when this row would run past the bottom margin.
    if (cursorY + rowHeight > bottomLimit) {
      pdf.addPage()
      cursorY = options.marginMm + SECTION_HEADING_TOP_MARGIN_MM
      cursorY +=
        drawSectionHeading(pdf, `${heading} (ต่อ)`, offsetX, cursorY, pdfTextFont) + SECTION_HEADING_GAP_MM
    }
    const rowImages = images.slice(row * columns, row * columns + columns)
    rowImages.forEach((imageData, col) => {
      const x = offsetX + col * (colWidthMm + options.gapMm)
      pdf.addImage(imageData, "JPEG", x, cursorY, colWidthMm, rowHeight)
      addCardSelectionRow(pdf, fieldId, x, cursorY + rowHeight, cssToMm, pdfTextFont)
      fieldId += 1
    })
    cursorY += rowHeight + options.gapMm
  }
  return fieldId
}

// Two-section client deliverable: page 1+ "Recommended topics" (what the team selected,
// unbounded), then a new page with "Other options" (the +3 backups). Each card keeps the
// interactive "Select this topic" checkbox so the client picks their topics in the PDF.
export async function exportIdeasWithSectionsToPdf(
  recommendedCards: HTMLElement[],
  otherCards: HTMLElement[],
  filename: string,
) {
  if (recommendedCards.length === 0) return
  const options: ExportOptions = {
    columns: 3,
    orientation: "portrait",
    enlargeHook: false,
    marginMm: 8,
    gapMm: 3,
  }
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" })
  const nextFieldId = await renderSection(pdf, "Recommended topics", recommendedCards, options, false, 1)
  if (otherCards.length > 0) {
    await renderSection(pdf, "Other options", otherCards, options, true, nextFieldId)
  }
  savePdf(pdf, filename)
}
