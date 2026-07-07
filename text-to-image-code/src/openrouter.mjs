import { readFile } from "node:fs/promises"
import { requiredEnv } from "./env.mjs"

const PROMPT_ENGINEER_PATH = new URL(
  "../prompts/complete-static-ads-master-prompt.md",
  import.meta.url,
)

// Source of truth is the generation-ready GPT Image 2 master prompt.
// The inline string below is only a fallback if that file can't be read at runtime.
async function loadVisualThinkingSystemPrompt() {
  try {
    const fileContent = (await readFile(PROMPT_ENGINEER_PATH, "utf8")).trim()
    const promptBlock = fileContent.match(/```text\s*([\s\S]*?)```/)
    if (promptBlock?.[1]?.trim()) return promptBlock[1].trim()
    if (fileContent) return fileContent
  } catch (error) {
    console.warn("[visual-thinking] Falling back to inline system prompt:", error.message)
  }
  return visualThinkingSystemPrompt
}

const visualThinkingSystemPrompt = `You are a Senior Art Director, Thai Advertising Designer, and GPT Image 2 Prompt Architect.
Study the campaign brief and supplied images, select the correct advertising system, and output one final generation-ready GPT Image 2 prompt.
The result must be a finished static advertisement with one immediate visual idea, intentional Thai typography, clear hierarchy, accurate assets, believable production, and no invented copy.
Output only the final prompt in English. Keep required Thai copy verbatim inside quotation marks.`

const MAX_REFERENCE_STYLE_IMAGES = 6

async function requestOpenRouter({ apiKey, model, messages, temperature = 1 }) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost",
      "X-Title": process.env.OPENROUTER_APP_NAME || "Creative Compass Imagegen Code",
    },
    body: JSON.stringify({ model, messages, temperature }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenRouter request failed: ${response.status} ${text}`)
  }

  const json = await response.json()
  const text = json.choices?.[0]?.message?.content
  if (!text) throw new Error("OpenRouter returned no text")
  return text
}

function formatBrandContext(client) {
  if (!client || typeof client !== "object") return "No additional client profile data supplied."

  const fields = [
    ["Website", client.clientWebsiteUrl],
    ["Market", client.market],
    ["Services", client.services],
    ["Pricing", client.pricing],
    ["USP", client.usp],
    ["Specialty", client.specialty],
    ["Strengths", client.strengths],
    ["Target audience", client.targetAudience],
    ["Brand tone", client.brandTone],
    ["Ad themes", client.adThemes],
    ["Additional information", client.additionalInfo],
    ["Competitor context", client.competitor_summary],
  ]
    .filter(([, value]) => value != null && String(value).trim())
    .map(([label, value]) => `${label}: ${String(value).trim()}`)

  return fields.join("\n") || "No additional client profile data supplied."
}

function collectReferenceStyleImageUrls(body) {
  if (body.reference_style_enabled !== true && body.referenceStyleEnabled !== true) return []

  const urls = Array.isArray(body.reference_image_urls)
    ? body.reference_image_urls
    : body.reference_image_url
      ? [body.reference_image_url]
      : []

  return urls
    .filter((url) => typeof url === "string" && /^https?:\/\//.test(url.trim()))
    .map((url) => url.trim())
    .slice(0, MAX_REFERENCE_STYLE_IMAGES)
}

function buildN8nSavedIdeaContext(body, context = {}) {
  const savedIdea = body.saved_ideas?.[0] || {}
  const extras = {}

  if (body.selected_visual_route || body.selectedVisualRoute) {
    extras.selected_visual_route = body.selected_visual_route || body.selectedVisualRoute
  }
  if (body.creative_format || body.creativeFormat) {
    extras.creative_format = body.creative_format || body.creativeFormat
  }
  if (body.creative_format_label || body.creativeFormatLabel) {
    extras.creative_format_label = body.creative_format_label || body.creativeFormatLabel
  }
  if (context.client) {
    extras.brand_profile_context = formatBrandContext(context.client)
  }

  return Object.keys(extras).length ? { ...savedIdea, _workflow_context: extras } : savedIdea
}

export function buildVisualThinkingUserPrompt(body, context = {}) {
  const savedIdeaContext = buildN8nSavedIdeaContext(body, context)
  const referenceStyleEnabled = body.reference_style_enabled === true || body.referenceStyleEnabled === true

  return `User brief: ${body.prompt || ""}

Style : ${body.userBrief || body.user_brief || ""}

Reference style mode: ${referenceStyleEnabled ? "ENABLED" : "DISABLED"}
${referenceStyleEnabled
  ? "Study the supplied reference images first. Extract their visual grammar, then adapt that grammar to this brand and the received concept. Preserve no reference-specific subject, copy, logo, product, person, or distinctive object. Brand CI, approved copy, product assets, and the selected idea always override the references."
  : "Create the direction from the brand and brief without using a reference visual system."}

Brand:
${body.client || ""}

Brand CI : ${body.brand_ci_text || body.brandCiText || ""}

Brand identity:
Color palette / mood / tone:
${JSON.stringify(body.color_palette || body.colorPalette || [])}


ratio : ${body.aspect_ratio || body.aspectRatio || "1:1"}

Saved idea:
${JSON.stringify(savedIdeaContext)}

`
}

export async function createVisualThinkingPlan(body, context = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY
  const enrichedContext = { ...context }

  if (!apiKey) {
    if (process.env.TEXT_TO_IMAGE_REQUIRE_VISUAL_THINKING === "true") {
      requiredEnv("OPENROUTER_API_KEY")
    }

    const fallbackText = `## THE WINNING CONCEPT DIRECTION
### CREATIVE TERRITORY
Advertising image generation from the user's direct brief.

### CONCEPT
Create a polished social advertising visual based on the provided brand, product/service, reference images, material images, copy, and constraints.

### SOURCE BRIEF
${buildVisualThinkingUserPrompt(body, enrichedContext)}`

    return {
      visualThinking: fallbackText,
    }
  }

  const model = process.env.TEXT_TO_IMAGE_OPENROUTER_MODEL || "anthropic/claude-sonnet-4.6"
  const systemPrompt = await loadVisualThinkingSystemPrompt()

  const userText = buildVisualThinkingUserPrompt(body, enrichedContext)
  const referenceImageUrls = collectReferenceStyleImageUrls(body)
  const userContent = referenceImageUrls.length
    ? [
        { type: "text", text: userText },
        {
          type: "text",
          text: "STYLE REFERENCES. Analyze these as a set before planning. Learn the transferable layout, hierarchy, typography behavior, palette relationships, lighting, texture, depth, and graphic treatment. Rebuild those principles for the supplied brand and concept instead of copying the original ad.",
        },
        ...referenceImageUrls.map((url) => ({ type: "image_url", image_url: { url } })),
      ]
    : userText

  const text = await requestOpenRouter({
    apiKey,
    model,
    temperature: 1,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  })

  return {
    visualThinking: text,
  }
}

export async function createVisualThinking(body, context = {}) {
  const plan = await createVisualThinkingPlan(body, context)
  return plan.visualThinking
}
