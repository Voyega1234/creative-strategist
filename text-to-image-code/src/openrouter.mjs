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

const MAX_VISUAL_THINKING_IMAGES = 6

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

function formatReferenceRoles(materialImageUrls, referenceImageUrls) {
  const roles = []
  materialImageUrls.forEach((url, index) => {
    roles.push(
      `Image ${index + 1}: product / logo / brand material reference — locked identity asset — ${url}`,
    )
  })
  referenceImageUrls.forEach((url, index) => {
    roles.push(
      `Image ${materialImageUrls.length + index + 1}: style / mood / layout reference — extract principles, do not copy literally — ${url}`,
    )
  })
  return roles.join("\n") || "None supplied."
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

export function buildVisualThinkingUserPrompt(body, context = {}) {
  const chosenVisualRoute = formatChosenVisualRoute(body.selected_visual_route || body.selectedVisualRoute)
  const copy = body.copywriting || {}
  const savedIdea = body.saved_ideas?.[0] || {}
  const materialImageUrls = collectMaterialImageUrls(body)
  const referenceImageUrls = collectReferenceImageUrls(body)
  const supportingLine = copy.sub_headline_1 || copy.sub_headline_2 || ""
  const creativeSeed = context.creativeSeed || body.creative_seed || body.creativeSeed || "not-supplied"
  const explicitPeoplePolicy = body.people_allowed || body.peopleAllowed
  const peoplePolicyLine = explicitPeoplePolicy
    ? `PEOPLE CONSTRAINT: ${explicitPeoplePolicy}`
    : ""

  return `CAMPAIGN BRIEF

BRAND: ${body.client || "Not supplied"}
PRODUCT / SERVICE: ${body.productFocus || body.product_focus || context.client?.productFocus || "Not supplied"}
CAMPAIGN OBJECTIVE: ${body.campaign_objective || body.campaignObjective || "Create a high-performing static social advertisement that communicates the main idea within one second."}
TARGET AUDIENCE: ${body.target_audience || body.targetAudience || context.client?.targetAudience || "Infer from the brand, category, selected idea, and supplied references."}
CORE PROBLEM OR DESIRE: ${body.topic_description || savedIdea.description || body.prompt || "Not supplied"}
MAIN BENEFIT: ${body.main_benefit || body.mainBenefit || body.core_concept || savedIdea.concept_idea || body.prompt || "Not supplied"}
REASON TO BELIEVE: ${body.reason_to_believe || body.reasonToBelieve || savedIdea.competitiveGap || context.client?.usp || context.client?.strengths || "Use only evidence explicitly present in the brief or supplied assets."}
OFFER / PRICE / DATE: ${body.offer_price_date || body.offerPriceDate || "None supplied. Do not invent one."}
HEADLINE (VERBATIM): ${copy.headline ? `"${copy.headline}"` : "None supplied."}
SUPPORTING LINE (VERBATIM): ${supportingLine ? `"${supportingLine}"` : "None supplied."}
CTA (VERBATIM): ${copy.cta ? `"${copy.cta}"` : "None supplied."}
PLATFORM: ${body.platform || "Paid social media"}
CREATIVE FORMAT: ${body.creative_format_label || body.creativeFormatLabel || body.creative_format || body.creativeFormat || "Single static post"}
ASPECT RATIO: ${body.aspect_ratio || body.aspectRatio || "4:5"}
REQUESTED STYLE: ${body.ad_style || body.adStyle || "Auto — choose the best-fit advertising system."}
CREATIVE VARIATION SEED: ${creativeSeed}
${peoplePolicyLine}
MANDATORY ASSETS: ${materialImageUrls.length ? `${materialImageUrls.length} locked material image(s). Preserve identity exactly.` : "None supplied. Do not invent a logo or detailed package label."}
MANDATORY COLORS: ${JSON.stringify(body.color_palette || body.colorPalette || [])}
PROHIBITED CLAIMS OR ELEMENTS: ${body.prohibited_elements || body.prohibitedElements || "No invented claims, prices, dates, awards, certifications, logos, product variants, or extra copy."}
ADDITIONAL NOTES: ${body.userBrief || body.user_brief || "None."}

BRAND PROFILE CONTEXT
${formatBrandContext(context.client)}

CHOSEN VISUAL ROUTE
${chosenVisualRoute || "None specified. Select the strongest advertising system and proposition-specific visual mechanism."}

SAVED IDEA CONTEXT
${JSON.stringify(savedIdea, null, 2)}

REFERENCE IMAGES
${formatReferenceRoles(materialImageUrls, referenceImageUrls)}

Return only one final generation-ready GPT Image 2 prompt. Do not return analysis, rationale, options, or a creative-direction document.`
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
