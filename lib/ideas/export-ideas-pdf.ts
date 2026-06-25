import html2canvas from "html2canvas"
import jsPDF from "jspdf"

const MAX_IDEAS = 10
const SCALE = 2

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

// Capture a single card. `uniformHeightCssPx`, when set, forces the card box to that
// height so every card comes out the same length (border stretches, content stays top-aligned).
async function captureCard(card: HTMLElement, uniformHeightCssPx: number | undefined, options: ExportOptions) {
  const captureWidth = options.captureWidthPx
  return html2canvas(card, {
    scale: SCALE,
    backgroundColor: "#ffffff",
    width: captureWidth,
    windowWidth: captureWidth,
    onclone: (_doc, clonedCard) => {
      // A fixed, narrower width makes everything bigger once scaled to the PDF column.
      if (captureWidth) {
        clonedCard.style.width = `${captureWidth}px`
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
      if (uniformHeightCssPx) {
        clonedCard.style.minHeight = `${uniformHeightCssPx}px`
      }
    },
  })
}

async function buildPdf(allCardElements: HTMLElement[], filename: string, options: ExportOptions) {
  // Only the first 10 ideas are exported so everything stays readable on one page.
  const cardElements = allCardElements.slice(0, MAX_IDEAS)
  if (cardElements.length === 0) return

  const isLandscape = options.orientation === "landscape"
  const pageWidthMm = isLandscape ? 297 : 210
  const pageHeightMm = isLandscape ? 210 : 297

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: options.orientation })
  const usableWidth = pageWidthMm - options.marginMm * 2
  const usableHeight = pageHeightMm - options.marginMm * 2

  const columns = Math.min(options.columns, cardElements.length)
  const colWidthMm = (usableWidth - options.gapMm * (columns - 1)) / columns

  // Pass 1: capture every card at natural height to measure each one.
  const firstPass = await Promise.all(cardElements.map((card) => captureCard(card, undefined, options)))
  const canvasWidthPx = firstPass[0].width
  const naturalHeightsPx = firstPass.map((canvas) => canvas.height)

  // Each row's height = the tallest card in that row.
  const rowCount = Math.ceil(cardElements.length / columns)
  const rowMaxPx: number[] = []
  for (let row = 0; row < rowCount; row += 1) {
    const slice = naturalHeightsPx.slice(row * columns, row * columns + columns)
    rowMaxPx[row] = Math.max(...slice)
  }
  const rowHeightMm = rowMaxPx.map((px) => (px * colWidthMm) / canvasWidthPx)

  // Pass 2: stretch every card up to its own row's height so each row aligns.
  const images = await Promise.all(
    cardElements.map(async (card, index) => {
      const row = Math.floor(index / columns)
      const canvas = await captureCard(card, rowMaxPx[row] / SCALE, options)
      return canvas.toDataURL("image/jpeg", 0.9)
    }),
  )

  const totalHeight = rowHeightMm.reduce((sum, h) => sum + h, 0) + options.gapMm * (rowCount - 1)

  // Scale the whole grid down so it fits the page height (width already fits at scale 1).
  const scale = Math.min(1, usableHeight / totalHeight)
  const scaledColWidth = colWidthMm * scale
  const scaledGap = options.gapMm * scale
  const gridWidth = scaledColWidth * columns + scaledGap * (columns - 1)
  const gridHeight = totalHeight * scale

  // Center the grid on the page.
  const offsetX = (pageWidthMm - gridWidth) / 2
  let cursorY = (pageHeightMm - gridHeight) / 2

  for (let row = 0; row < rowCount; row += 1) {
    const scaledRowHeight = rowHeightMm[row] * scale
    const rowImages = images.slice(row * columns, row * columns + columns)
    rowImages.forEach((imageData, col) => {
      const x = offsetX + col * (scaledColWidth + scaledGap)
      pdf.addImage(imageData, "JPEG", x, cursorY, scaledColWidth, scaledRowHeight)
    })
    cursorY += scaledRowHeight + scaledGap
  }

  pdf.save(filename)
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
