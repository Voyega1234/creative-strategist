import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { requiredEnv } from "./env.mjs"

const PROMPT_ENGINEER_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../prompts/prompt-engineer.md",
)
const DESIGN_EXAMPLES_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../prompts/design-examples.md",
)
const DESIGN_EXAMPLES_PER_CALL = 3

// Few-shot corpus: prompts reverse-engineered from the team's real ads (AW-Boon).
// We sample a few per call so the model sees concrete examples of the expected design
// thinking without converging on a single style.
async function loadSampledDesignExamples(count = DESIGN_EXAMPLES_PER_CALL) {
  try {
    const raw = await readFile(DESIGN_EXAMPLES_PATH, "utf8")
    const blocks = raw
      .split(/\n---\n/)
      .map((block) => block.trim())
      .filter(Boolean)
      .slice(1) // drop the intro header before the first separator
    for (let i = blocks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[blocks[i], blocks[j]] = [blocks[j], blocks[i]]
    }
    return blocks.slice(0, count)
  } catch (error) {
    console.warn("[visual-thinking] No design examples loaded:", error.message)
    return []
  }
}

// Source of truth for the concept system prompt is prompts/prompt-engineer.md (editable).
// The inline string below is only a fallback if that file can't be read at runtime.
async function loadVisualThinkingSystemPrompt() {
  try {
    const fileContent = (await readFile(PROMPT_ENGINEER_PATH, "utf8")).trim()
    if (fileContent) return fileContent
  } catch (error) {
    console.warn("[visual-thinking] Falling back to inline system prompt:", error.message)
  }
  return visualThinkingSystemPrompt
}

const visualThinkingSystemPrompt = `You are a senior Art Director and visual concept strategist.
Deliver one strong advertising visual concept for social media.

Create a direction based on the provided brand, product/service, copy, reference style, and user constraints.
Extract the reference's visual DNA, translate it into the new brand context, and elevate it into a stronger advertising idea.

Rules:
- Output only the single best concept direction.
- Do not use fixed formulas, fixed props, or generic catalogue layouts.
- Every major visual element must come from the reference, user brief, brand context, product/service category, core message, or a clear creative reason.
- The concept must feel practical, physically believable, uncluttered, scroll-stopping, and advertising-driven.
- The main subject must remain the hero and interact meaningfully with the scene, typography, or idea.
- On-image copy must be short, readable, and natural.

Output language:
- All rationale and art direction must be in English.
- Actual copywriting text such as headline, subheadline, and CTA must be strictly in Thai.

Output format:
## REFERENCE STYLE SUMMARY
- Mood & tone
- Signature style
- Layout logic
- Visual mechanics

## THE WINNING CONCEPT DIRECTION
### CREATIVE TERRITORY
### CONCEPT
### COPYWRITING (THAI)
### ADVERTISING IDEA
### DESIGN ELEVATION
Cover camera angle, composition, color, visual hook, and typography-image relationship.
### TECHNIQUES USED
Use 4-5 bullets only.
### VISUAL DIRECTION FOR DESIGNER (PRACTICAL EXECUTION)
1. Layout Structure
2. Layer & Depth System
3. Art Direction, Lighting & Material Craft`

const MAX_VISUAL_THINKING_IMAGES = 6

// Material images = the real product/packaging/brand assets. Feeding them to the concept LLM lets
// it plan a visual that actually matches what the product looks like from the start.
function collectMaterialImageUrls(body) {
  const urls = Array.isArray(body.material_image_urls) ? body.material_image_urls : []
  return urls
    .filter((url) => typeof url === "string" && /^https?:\/\//.test(url.trim()))
    .map((url) => url.trim())
    .slice(0, MAX_VISUAL_THINKING_IMAGES)
}

// Reference images = the desired visual style/mood (brand ads, attached references). Feeding them
// to the concept LLM lets it extract their visual DNA and match the mood from the start.
function collectReferenceImageUrls(body) {
  const urls = Array.isArray(body.reference_image_urls)
    ? body.reference_image_urls
    : body.reference_image_url
      ? [body.reference_image_url]
      : []
  return urls
    .filter((url) => typeof url === "string" && /^https?:\/\//.test(url.trim()))
    .map((url) => url.trim())
    .slice(0, MAX_VISUAL_THINKING_IMAGES)
}

// The visual route the user explicitly picked for this idea — the concept must follow it.
function formatChosenVisualRoute(route) {
  if (!route || typeof route !== "object") return ""
  const parts = []
  const name = route.route_name || route.routeName
  const type = route.route_type || route.routeType
  if (name) parts.push(type ? `${name} (${type})` : name)
  if (route.visual_idea) parts.push(route.visual_idea)
  if (route.why_it_fits) parts.push(`Why it fits: ${route.why_it_fits}`)
  return parts.join("\n")
}

export function buildVisualThinkingUserPrompt(body, context = {}) {
  const chosenVisualRoute = formatChosenVisualRoute(body.selected_visual_route || body.selectedVisualRoute)
  const copy = body.copywriting || {}
  const onImageCopy = [
    copy.headline && `Headline: "${copy.headline}"`,
    (copy.sub_headline_1 || copy.sub_headline_2) &&
      `Sub-headline: "${copy.sub_headline_1 || copy.sub_headline_2}"`,
    copy.cta && `CTA: "${copy.cta}"`,
  ]
    .filter(Boolean)
    .join("\n")

  return `User brief:
${body.prompt || ""}

On-image copy (use these EXACT texts verbatim as the only on-image text — do not rewrite them):
${onImageCopy || "No fixed copy provided — keep on-image text minimal and derived from the brief."}

Style:
${body.userBrief || ""}

Brand:
${body.client || ""}

Category Lens:
${context.client?.productFocus || ""}

Brand identity:
Color palette / mood / tone:
${JSON.stringify(body.color_palette || body.colorPalette || [], null, 2)}

ratio:
${body.aspect_ratio || body.aspectRatio || "4:5"}

Core concept:
${body.core_concept || ""}

Chosen visual route (the user explicitly picked this direction — build the concept around it and do not contradict it):
${chosenVisualRoute || "None specified — choose the strongest direction for the brief."}

Saved idea:
${JSON.stringify(body.saved_ideas?.[0] || {}, null, 2)}`
}

export async function createVisualThinking(body, context = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    if (process.env.TEXT_TO_IMAGE_REQUIRE_VISUAL_THINKING === "true") {
      requiredEnv("OPENROUTER_API_KEY")
    }

    return `## THE WINNING CONCEPT DIRECTION
### CREATIVE TERRITORY
Advertising image generation from the user's direct brief.

### CONCEPT
Create a polished social advertising visual based on the provided brand, product/service, reference images, material images, copy, and constraints.

### SOURCE BRIEF
${buildVisualThinkingUserPrompt(body, context)}`
  }

  const model = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4.6"
  const baseSystemPrompt = await loadVisualThinkingSystemPrompt()
  const designExamples = await loadSampledDesignExamples()
  const systemPrompt = designExamples.length
    ? `${baseSystemPrompt}

# REFERENCE EXAMPLES — finished prompts at the expected level (reverse-engineered from this team's real award-level ads)
Study how each one constructs the frame: the headline lockup with per-word treatments, the one-hue color
system with a single accent, the staging/depth layers, named effects, and calm spacing. Learn the DESIGN
THINKING — do NOT copy their subjects, metaphors, or styles.

${designExamples.join("\n\n---\n\n")}`
    : baseSystemPrompt

  const userText = buildVisualThinkingUserPrompt(body, context)
  const materialImageUrls = collectMaterialImageUrls(body)
  const referenceImageUrls = collectReferenceImageUrls(body)

  // Send a multimodal message so the LLM can actually see the product (materials) and the desired
  // style (references) and plan a coherent, on-style concept. Falls back to plain text if none.
  const imageParts = []
  if (materialImageUrls.length) {
    imageParts.push({
      type: "text",
      text: "MATERIAL IMAGES (the actual product, packaging, or brand asset). Treat them as the real hero subject and keep the concept faithful to how they actually look — shape, color, logo, proportions.",
    })
    materialImageUrls.forEach((url) => imageParts.push({ type: "image_url", image_url: { url } }))
  }
  if (referenceImageUrls.length) {
    imageParts.push({
      type: "text",
      text: "STYLE REFERENCE IMAGES (existing brand ads / chosen references). Extract their visual DNA — mood, color treatment, lighting, composition, typography feel, and art direction — and make the new concept clearly match this style. Do NOT copy their exact content or subject.",
    })
    referenceImageUrls.forEach((url) => imageParts.push({ type: "image_url", image_url: { url } }))
  }

  const userContent = imageParts.length ? [{ type: "text", text: userText }, ...imageParts] : userText

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost",
      "X-Title": process.env.OPENROUTER_APP_NAME || "Creative Compass Imagegen Code",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenRouter request failed: ${response.status} ${text}`)
  }

  const json = await response.json()
  const text = json.choices?.[0]?.message?.content

  if (!text) throw new Error("OpenRouter returned no visual-thinking text")

  return text
}
