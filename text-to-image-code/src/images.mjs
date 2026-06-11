import { requiredEnv } from "./env.mjs"

export function mapAspectRatioToSize(ratio) {
  const normalized = String(ratio || "4:5").trim()
  const map = {
    "1:1": "1024x1024",
    "4:5": "auto",
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
  const referenceUrls = Array.isArray(body.reference_image_urls)
    ? body.reference_image_urls
    : body.reference_image_url
      ? [body.reference_image_url]
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
  const aspectRatio = body.aspectRatio || body.aspect_ratio || "4:5"
  const colorPalette = body.color_palette || body.colorPalette || ""
  const imageNotes = images.map((image, index) => {
    if (image.type === "material") {
      return `[IMAGE ${index + 1}: MATERIAL IMAGE] Use this as the source of truth for product, packaging, logo, brand asset, and physical details. Preserve identity accurately.`
    }

    if (image.type === "reference") {
      return `[IMAGE ${index + 1}: STYLE REFERENCE IMAGE] Use this only for mood, layout, composition, graphic direction, and art direction. Do not copy literally.`
    }

    return `[IMAGE ${index + 1}: ${image.type.toUpperCase()}] Use this image as supporting visual context.`
  })

  const copy = body.copywriting || {}
  const copyLines = [
    copy.headline && `Headline: "${copy.headline}"`,
    (copy.sub_headline_1 || copy.sub_headline_2) &&
      `Sub-headline: "${copy.sub_headline_1 || copy.sub_headline_2}"`,
    copy.cta && `CTA: "${copy.cta}"`,
  ].filter(Boolean)
  const onImageTextSection = copyLines.length
    ? `On-image text — the creative direction may use some or all of these lines; any text that appears must match EXACTLY, spelled correctly and fully legible (Thai must be accurate). Do not translate, paraphrase, add, or invent any other text:\n${copyLines.join("\n")}`
    : `On-image text — only render copy that is explicitly defined in the brief. Do not invent headlines, labels, prices, or claims.`

  return `
Create a polished, production-ready commercial advertising key visual. The result must look like premium agency/brand campaign work — intentionally art-directed and rendered to a professional commercial standard, not an AI generation.

Main creative direction (authoritative — follow this concept):
${visualThinkingText}

${onImageTextSection}

Brand color palette:
${Array.isArray(colorPalette) ? colorPalette.join(", ") : colorPalette || "Use colors that fit the brand and brief."}

Reference image instructions:
${imageNotes.length ? imageNotes.join("\n") : "No reference images provided. Create from the brief only."}

Commercial quality bar:
- Professional commercial photography or high-end 3D/graphic art direction with believable, consistent single-source lighting, real material texture, accurate perspective, scale, and shadows.
- Clean, uncluttered layout with strong visual hierarchy and intentional negative space; the main message must read in one second.
- Typography integrated as a designed element with correct kerning and leading, fully legible at a glance.
- Preserve product, brand, and logo identity exactly from material images; use style references only for mood, composition, and art direction.
- Modern, on-trend look that fits the business category and brand. No cyberpunk, sci-fi, neon-futuristic, or vaporwave unless the brief explicitly requires it.

Avoid:
- Anything a real production crew could not physically BUILD (structures missing their real supports and mechanics), STAGE (weightless props without contact shadows), RIG (sourceless glow, sparkle-dust fields), PRINT (pseudo-letter mush on dials, labels, keyboards, fine print), or SHOOT (broken perspective, waxy skin, melted shapes, over-smooth render sheen).
- Misspelled, garbled, or duplicated text; do not add extra copy, fake badges, buttons, prices, icons, or watermarks beyond the specified on-image text.
- Cluttered, generic stock-photo layouts.

Output aspect ratio target: ${aspectRatio}
`.trim()
}

function responseToImage(responseJson) {
  const image = responseJson?.data?.[0]
  if (!image?.b64_json) {
    throw new Error(`OpenAI returned no image data: ${JSON.stringify(responseJson).slice(0, 1000)}`)
  }

  const format = (image.output_format || process.env.OPENAI_IMAGE_OUTPUT_FORMAT || "png").toLowerCase()
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

export async function generateImage({ prompt, size, images = [] }) {
  const apiKey = requiredEnv("OPENAI_API_KEY")
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2"
  const quality = process.env.OPENAI_IMAGE_QUALITY || "medium"
  const outputFormat = process.env.OPENAI_IMAGE_OUTPUT_FORMAT || "png"

  let response

  if (images.length > 0) {
    const form = new FormData()
    form.set("model", model)
    form.set("prompt", prompt)
    form.set("size", size)
    form.set("quality", quality)
    form.set("output_format", outputFormat)

    images.slice(0, 16).forEach((image, index) => {
      const extension = image.contentType.includes("jpeg")
        ? "jpg"
        : image.contentType.includes("webp")
          ? "webp"
          : "png"
      const blob = new Blob([image.buffer], { type: image.contentType })
      form.append("image[]", blob, `${image.type}_${index + 1}.${extension}`)
    })

    response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })
  } else {
    response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        size,
        quality,
        output_format: outputFormat,
      }),
    })
  }

  const responseJson = await response.json().catch(async () => ({ error: await response.text() }))

  if (!response.ok) {
    throw new Error(`OpenAI image request failed: ${response.status} ${JSON.stringify(responseJson)}`)
  }

  return responseToImage(responseJson)
}
