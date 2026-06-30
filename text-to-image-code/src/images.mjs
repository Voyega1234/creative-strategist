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
  const imageNotes = images.map((image, index) => {
    if (image.type === "material") {
      return `[IMAGE ${index + 1}: LOCKED MATERIAL ASSET] Preserve its product silhouette, proportions, packaging structure, logo, label layout, and brand colors.`
    }

    if (image.type === "reference") {
      return `[IMAGE ${index + 1}: STYLE REFERENCE] Extract mood, composition, typography behavior, lighting, and graphic principles. Do not copy its subject literally.`
    }

    return `[IMAGE ${index + 1}: ${image.type.toUpperCase()}] Use this image as supporting visual context.`
  })

  return `
${visualThinkingText}

ATTACHED IMAGE MAP — images are attached in this exact order:
${imageNotes.length ? imageNotes.join("\n") : "No images attached."}

Technical execution:
- Render at ${aspectRatio}; protect safe margins and preserve the hierarchy described above.
- Produce one complete, finished advertisement and follow the text instructions exactly.
- Treat attached material assets as identity-locked. Never let a style reference override product or logo fidelity.
- Do not add text, logos, prices, dates, claims, badges, certifications, interfaces, products, or people that the prompt does not authorize.
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
