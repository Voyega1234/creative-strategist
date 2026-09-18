import { requiredEnv } from "./env.mjs"

export function mapAspectRatioToSize(ratio) {
  const normalized = String(ratio || "3:4").trim()
  const map = {
    "1:1": "1024x1024",
    "4:5": "1024x1536",
    "5:4": "auto",
    "3:4": "1024x1536",
    "4:3": "1536x1024",
    "2:3": "1024x1536",
    "3:2": "1536x1024",
    "9:16": "1024x1536",
    "16:9": "1536x1024",
  }

  return map[normalized] || "auto"
}

export function normalizeImageUrls(body) {
  const referenceStyleEnabled = body.reference_style_enabled === true || body.referenceStyleEnabled === true
  const referenceUrls = referenceStyleEnabled
    ? Array.isArray(body.reference_image_urls)
      ? body.reference_image_urls
      : body.reference_image_url
        ? [body.reference_image_url]
        : []
    : []

  const materialUrls = Array.isArray(body.material_image_urls) ? body.material_image_urls : []

  return [
    ...materialUrls
      .filter((url) => typeof url === "string" && url.trim())
      .map((url) => ({ type: "material", url: url.trim() })),
    ...referenceUrls
      .filter((url) => typeof url === "string" && url.trim())
      .map((url) => ({ type: "reference", url: url.trim() })),
  ]
}

export async function downloadImage(image) {
  const response = await fetch(image.url)

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(`Failed to download ${image.type} image: ${response.status} ${text}`)
  }

  const contentType = response.headers.get("content-type") || "image/png"
  const arrayBuffer = await response.arrayBuffer()

  return {
    ...image,
    buffer: Buffer.from(arrayBuffer),
    contentType,
  }
}

export function buildFinalPrompt(visualThinkingText, body, images) {
  const requestedRatio = body.aspectRatio || body.aspect_ratio || "3:4"
  const aspectRatio = requestedRatio === "4:5" ? "3:4" : requestedRatio
  const referenceStyleEnabled = body.reference_style_enabled === true || body.referenceStyleEnabled === true
  const colorPalette = body.color_palette || body.colorPalette || ""
  const colorPaletteText = Array.isArray(colorPalette) ? colorPalette.join(",") : colorPalette
  const imageNotes = images.map((image, index) => {
    if (image.type === "material") {
      return `[IMAGE ${index + 1}: MATERIAL IMAGE] Use this as the source of truth for product, packaging, logo, brand asset, and physical details. Preserve identity accurately.`
    }

    if (image.type === "reference") {
      return `[IMAGE ${index + 1}: STYLE REFERENCE IMAGE] Study its visual system: composition logic, hierarchy, spacing, typography behavior, color relationships, lighting, texture, depth, and graphic treatment. Translate those principles to the supplied brand and concept. Do not copy its subject, text, logo, product, people, or distinctive objects.`
    }

    return `[IMAGE ${index + 1}: ${image.type.toUpperCase()}] Use this image as supporting visual context.`
  })

  return `
Create a high-quality promotional advertising image.

ภาพโปรโมทโฆษณา , พร้อมรายละเอียดอ่านง่าย ไม่รกดูแล้วสบายตา ไม่ดูแน่นไปหมด มีความ Cretive มีการใช้เทคนิคด้านกราฟิกให้เหมาะสม ให้เหมาะกับประเภทของธุรกิจ ดูเป็นงานที่ดูผ่านการคัดสรรมาอย่างดี, สไตล์ภาพเหมาะกับสมัยปัจจุบัน ไม่ cyberpunk, scifi ไม่ดู AI ดูสบายตาหยุดคนดูได้

Main brief:
${visualThinkingText}

Brand color palette:
${colorPaletteText || "Use colors that fit the brand and brief."}

Reference image instructions:
${imageNotes.length ? imageNotes.join("\n") : "No reference images supplied."}

Reference style mode:
${referenceStyleEnabled
  ? "ENABLED. The new image must feel informed by the reference visual system, but rebuilt for this brand and the received concept. Brand CI, brand colors, locked material assets, approved copy, and the selected idea are authoritative. The reference supplies design principles only."
  : "DISABLED. Develop the art direction directly from the brand, brief, and selected idea without borrowing a reference visual system."}

Creative direction:
- Make the design clean, readable, and not overcrowded.
- Use strong visual hierarchy.
- Make it suitable for a youth-oriented audience.
- Use graphic techniques that fit the business category.
- Avoid messy layouts, excessive text, and generic AI-looking visuals.
- Preserve product/brand identity from material images.
- When reference style mode is enabled, visibly apply the reference's reusable design principles while preserving the new brand and concept.
- Output aspect ratio target: ${aspectRatio}
`.trim()
}

function responseToImage(responseJson) {
  const image = responseJson?.data?.[0]
  if (!image?.b64_json) {
    throw new Error(`OpenRouter returned no image data: ${JSON.stringify(responseJson).slice(0, 1000)}`)
  }

  const format = (image.media_type?.split("/")[1] || image.output_format || "png").toLowerCase()
  const extension = format === "jpeg" ? "jpg" : format
  const contentType =
    format === "jpeg" || format === "jpg"
      ? "image/jpeg"
      : format === "webp"
        ? "image/webp"
        : "image/png"

  return {
    buffer: Buffer.from(image.b64_json, "base64"),
    extension,
    contentType,
    revisedPrompt: image.revised_prompt || null,
  }
}

export async function generateImage({ prompt, size, aspectRatio, images = [] }) {
  const apiKey = requiredEnv("OPENROUTER_API_KEY")
  const model = process.env.OPENROUTER_IMAGE_MODEL || "openai/gpt-image-2.5-flare"
  const aspectRatioBySize = {
    "1024x1024": "1:1",
    "1536x1024": "3:2",
    "1024x1536": "2:3",
  }
  const inputReferences = images.slice(0, 14).map((image) => ({
    type: "image_url",
    image_url: {
      url: `data:${image.contentType};base64,${image.buffer.toString("base64")}`,
    },
  }))
  const payload = {
    model,
    prompt,
    resolution: process.env.OPENROUTER_IMAGE_RESOLUTION || "2K",
    n: 1,
    ...(aspectRatio || aspectRatioBySize[size] ? { aspect_ratio: aspectRatio === "4:5" ? "3:4" : aspectRatio || aspectRatioBySize[size] } : {}),
    ...(inputReferences.length > 0 ? { input_references: inputReferences } : {}),
  }

  const response = await fetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost",
      "X-Title": process.env.OPENROUTER_APP_NAME || "Creative Compass Imagegen Code",
    },
    body: JSON.stringify(payload),
  })

  const responseJson = await response.json().catch(async () => ({ error: await response.text() }))

  if (!response.ok) {
    throw new Error(`OpenRouter image request failed: ${response.status} ${JSON.stringify(responseJson)}`)
  }

  return responseToImage(responseJson)
}
