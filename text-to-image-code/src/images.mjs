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

function extractCreativePlanFromText(text) {
  const section = (name) => {
    const pattern = new RegExp(`### ${name}\\n([\\s\\S]*?)(?=\\n### |$)`, "i")
    return text.match(pattern)?.[1]?.trim() || ""
  }

  return {
    strategy: section("STRATEGY"),
    brandDirector: section("BRAND DIRECTOR"),
    creativeDirector: section("CREATIVE DIRECTOR"),
    copywriter: section("COPYWRITER"),
    artDirector: section("ART DIRECTOR"),
    productionDesigner: section("PRODUCTION DESIGNER"),
    qaCritic: section("QA CRITIC"),
  }
}

export function buildFinalPrompt(visualThinkingText, body, images) {
  const aspectRatio = body.aspectRatio || body.aspect_ratio || "4:5"
  const colorPalette = body.color_palette || body.colorPalette || ""
  const materialCount = images.filter((image) => image.type === "material").length
  const referenceCount = images.filter((image) => image.type === "reference").length
  const extractedPlan = extractCreativePlanFromText(visualThinkingText)
  const imageNotes = images.map((image, index) => {
    if (image.type === "material") {
      return `[IMAGE ${index + 1}: MATERIAL IMAGE] Use this as the source of truth for product, packaging, logo, brand asset, and physical details. Preserve identity accurately.`
    }

    if (image.type === "reference") {
      return `[IMAGE ${index + 1}: STYLE REFERENCE IMAGE] Use this only for mood, layout, composition, graphic direction, and art direction. Do not copy literally.`
    }

    return `[IMAGE ${index + 1}: ${image.type.toUpperCase()}] Use this image as supporting visual context.`
  })

  const paletteText = Array.isArray(colorPalette)
    ? colorPalette.join(", ")
    : colorPalette || "Use a limited palette that fits the brand and brief."
  const selectedIdea = Array.isArray(body.saved_ideas) ? body.saved_ideas[0] : null
  const copywriting = body.copywriting || selectedIdea?.copywriting || {}
  const thaiText = [
    copywriting.headline || body.topic_title || "",
    copywriting.sub_headline_1 || copywriting.sub_headline_2 || body.topic_description || "",
    copywriting.cta || "",
  ]
    .filter(Boolean)
    .join(" / ")

  return `
Create a ${aspectRatio} social ad, concept-driven design. Bold and clean, NOT busy — restraint over clutter.

Lead with typography and ONE clear idea. Keep it clean and uncluttered.
Use only elements defined in the concept. Pick at most 2 typographic devices.
Philosophy: one sharp idea + typography as the lead element + clean but scroll-stopping. Subtract until it almost breaks.

ART DIRECTOR OUTPUT TO TRANSLATE:
${visualThinkingText}

Big idea / metaphor:
${extractedPlan.creativeDirector || extractedPlan.strategy || "One clear advertising idea that can be understood in one second."}

Composition & layout:
${extractedPlan.artDirector || "Create a disciplined editorial composition with one focal point, active negative space, clear grid, and intentional hierarchy."}
The eye flow must be: Hook -> hero/product or visual mechanism -> one key proof/benefit -> CTA.
Use negative space as an active design tool, not empty space to fill.
Choose central axis or asymmetric balance only if it serves the idea.
Do not build the layout around three separate proof boxes, three numbered callouts, or three badges. If the brief contains three reasons, compress them into one short proof line or integrate them invisibly into the concept.

Typography (LEAD element):
${extractedPlan.copywriter || "Use one strong headline and one supporting line at most."}
Thai copy to reserve/layout for: ${thaiText || "Use only the strongest Thai headline/supporting line from the creative plan."}
Typography must lead the design, not sit as a label pasted over the image.
Do not render every bullet/proof point as separate text modules. One headline plus one support/proof line is preferred.
Choose at most 1-2 professional typographic devices:
- extreme scale contrast
- type + image occlusion
- image-in-type
- type as architecture
- perspective / wrap type
- negative-space lockup
- accent word
- editorial anchoring
For Thai text that must be exact, reserve a deliberately designed blank/type area so final type can be set in Figma or Illustrator. If rendering Thai directly, keep it short, large, and simple.
The layout must be built around typography from the start.

Main subject:
${
  materialCount > 0
    ? `Use the attached product/material asset as the mandatory main subject or proof object. The first material image is the primary hero asset. Preserve distinctive product shape, packaging, color, labels, logos, texture, and physical details. Do not replace it with a generic lookalike.`
    : "Use one main subject only. It must interact with the idea and typography, not just sit in the center. For termite/home protection work, avoid making a generic luxury house facade the hero unless the concept specifically transforms it through a cutaway, silhouette, blueprint, protection perimeter, or other mechanism."
}
The subject must have believable physics, scale, lighting, and contact shadows. One hero only, no clutter.

Color:
Use a limited palette: ${paletteText}.
Use 2-3 main colors plus 1 accent max. Apply 60-30-10 logic or another disciplined color relationship. Let color tell the story.

Camera & angle:
${extractedPlan.creativeDirector || ""}
Use a deliberate angle that serves the idea: flat-lay graphic, low hero angle, dead-on editorial, cutaway, or controlled product perspective. Avoid default product-render camera choices.

Art direction & finish:
${extractedPlan.brandDirector}
${extractedPlan.productionDesigner}
Keep the finish clean and premium. Use honest materials, realistic shadows, slight intentional grain/texture if useful, and avoid plastic AI surfaces.

Reference and material rules:
Total attached images: ${images.length}
Material/product asset images: ${materialCount}
Style reference images: ${referenceCount}
${imageNotes.length ? imageNotes.join("\n") : "No reference images provided. Create from the concept only."}
Use reference images for visual DNA only: mood, layout, composition, lighting logic, color behavior, typography relationship, and art direction. Do not copy literally.

Repetition breaker:
- If the image starts to become "luxury house + headline + 3 boxes/callouts", reject that direction.
- Do not create three separate reason cards, three numbered boxes, three proof badges, or a real-estate brochure composition.
- Use one visual mechanism instead: cutaway reveal, invisible protection perimeter, product-world interaction, typography-as-architecture, image-in-type, or a single strong metaphor.
- The house can be context, but the idea must be the hero.

Avoid:
busy collage, too many elements, heavy effects, random lens flare, decorative noise, oversaturation, plastic AI surfaces, generic stock look, more than one focal point, garbled text, generic minimalist poster, product catalogue layout, brochure/listicle/card stack, three callout boxes, numbered proof cards, random icons, malformed logos, fake UI, unreadable Thai text, floating objects without physical logic.
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
