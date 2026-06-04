import { loadPrompt, renderPrompt } from "./prompt-loader.mjs"

function extractJsonObject(text) {
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("Agent returned no JSON object")
    return JSON.parse(match[0])
  }
}

function compactInput(body, context = {}, imageInputs = []) {
  return {
    client: body.client || body.client_name || "",
    product_focus: body.productFocus || body.product_focus || context.client?.productFocus || "",
    prompt: body.prompt || "",
    user_brief: body.userBrief || body.user_brief || "",
    core_concept: body.core_concept || "",
    topic_title: body.topic_title || "",
    topic_description: body.topic_description || "",
    content_pillar: body.content_pillar || "",
    ad_style: body.ad_style || "",
    image_count: body.image_count || body.imageCount || 1,
    copywriting: body.copywriting || null,
    saved_ideas: Array.isArray(body.saved_ideas) ? body.saved_ideas : [],
    saved_idea: Array.isArray(body.saved_ideas) ? body.saved_ideas[0] || null : null,
    selected_visual_route: body.selected_visual_route || body.selectedVisualRoute || null,
    color_palette: body.color_palette || body.colorPalette || [],
    aspect_ratio: body.aspect_ratio || body.aspectRatio || "4:5",
    client_context: context.client || null,
    market_context: context.market || null,
    image_inputs: imageInputs.map((image) => ({ type: image.type, url: image.url })),
    raw_request_keys: Object.keys(body).sort(),
  }
}

function getCopywriting(input) {
  return input.copywriting || input.saved_idea?.copywriting || null
}

function buildCopyContext(input) {
  const copy = getCopywriting(input)
  if (!copy) {
    return {
      headline: input.topic_title || input.core_concept || input.prompt || "",
      sub_headline_1: "",
      sub_headline_2: "",
      bullets: [],
      cta: "",
    }
  }

  return {
    headline: copy.headline || "",
    sub_headline_1: copy.sub_headline_1 || copy.subheadline || "",
    sub_headline_2: copy.sub_headline_2 || "",
    bullets: Array.isArray(copy.bullets) ? copy.bullets : [],
    cta: copy.cta || "",
  }
}

function buildProductionContext(input) {
  return {
    client: input.client,
    product_focus: input.product_focus,
    prompt: input.prompt,
    user_brief: input.user_brief,
    core_concept: input.core_concept,
    topic_title: input.topic_title,
    topic_description: input.topic_description,
    content_pillar: input.content_pillar,
    ad_style: input.ad_style,
    copywriting: buildCopyContext(input),
    saved_ideas: input.saved_ideas,
    selected_visual_route: input.selected_visual_route,
    color_palette: input.color_palette,
    aspect_ratio: input.aspect_ratio,
    requested_image_count: input.image_count,
    material_image_count: input.image_inputs.filter((image) => image.type === "material").length,
    reference_image_count: input.image_inputs.filter((image) => image.type === "reference").length,
    image_inputs: input.image_inputs,
    client_context: input.client_context,
    market_context: input.market_context,
    product_asset_rule:
      "If material/product assets are attached, use them as source of truth for product shape, labels, logo, color, texture, and physical details.",
    logo_rule:
      "Do not invent, redraw, distort, or render the brand logo/wordmark unless it is provided as an attached asset and explicitly requested.",
  }
}

async function callOpenRouter({ name, system, user, temperature = 0.5 }) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error(`Missing OPENROUTER_API_KEY for ${name}`)

  const model =
    process.env.OPENROUTER_CREATIVE_PIPELINE_MODEL ||
    process.env.OPENROUTER_CREATIVE_AGENT_MODEL ||
    process.env.OPENROUTER_MODEL ||
    "anthropic/claude-sonnet-4.6"

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost",
      "X-Title": process.env.OPENROUTER_APP_NAME || "Creative Compass Two-Agent Image Pipeline",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`${name} failed: ${response.status} ${text}`)
  }

  const json = await response.json()
  const text = json.choices?.[0]?.message?.content
  if (!text) throw new Error(`${name} returned no content`)
  return text
}

function fallbackArtDirection(input) {
  const copy = buildCopyContext(input)
  return `## REFERENCE STYLE SUMMARY
- Mood & tone: No usable reference provided; derive a premium, confident advertising tone from the brand/category.
- Signature style: Practical hero visual with strong graphic hierarchy and restrained brand palette.
- Layout logic: One hero idea first, copy reduced to one headline and one short support/CTA.
- Visual mechanics: Product/category proof interacts with the environment instead of sitting as a flat product layout.

## THE WINNING CONCEPT DIRECTION
### CREATIVE TERRITORY
Functional benefit dramatization with a practical visual metaphor.

### CONCEPT
Create one scroll-stopping hero visual that makes hidden protection visible without using a generic house poster or three proof cards.

### COPYWRITING (THAI)
Headline: ${copy.headline || input.topic_title || ""}
Support line: ${copy.sub_headline_1 || ""}
CTA: ${copy.cta || ""}

### ADVERTISING IDEA
The visual must show proof through the scene itself, not through a list of claims.

### DESIGN ELEVATION
Use stronger camera, cleaner hierarchy, limited color, and one typography-image relationship.

### TECHNIQUES USED
- visual metaphor
- type-image relationship
- limited palette
- practical material realism

### VISUAL DIRECTION FOR DESIGNER (PRACTICAL EXECUTION)
1. Layout Structure: One hero mechanism, one type area, one CTA area.
2. Layer & Depth System: Foreground product/proof, midground visual metaphor, background negative space.
3. Art Direction, Lighting & Material Craft: Photoreal materials, believable shadows, no plastic AI surfaces.`
}

function fallbackPromptEngineer(artDirection, input) {
  const copy = buildCopyContext(input)
  return {
    final_prompt: `Create a bold ${input.aspect_ratio || "1:1"} advertising image for ${input.client || "the brand"}, ${input.product_focus || "the product/service"}.

Use this art direction as the source of truth:
${artDirection}

Create one clear, scroll-stopping visual idea with strong composition, realistic materials, controlled lighting, and a limited brand-fit palette. Use the attached material/product asset as the source of truth if present. Keep the design uncluttered and avoid a generic product catalogue layout.

On-image copy must be minimal: headline "${copy.headline || input.topic_title || ""}"${copy.sub_headline_1 ? `, support line "${copy.sub_headline_1}"` : ""}${copy.cta ? `, short CTA "${copy.cta}"` : ""}. Do not render long bullet lists. Do not invent logos or extra marks. Avoid messy layout, dull colors, weak typography, unreadable Thai text, stock look, plastic AI surfaces, and excessive clutter.`,
  }
}

export function pipelinePlanToVisualThinking(plan) {
  return `## TWO-AGENT CREATIVE PIPELINE

### ART DIRECTOR
${plan.artDirectionText || ""}

### PROMPT ENGINEER
${plan.promptEngineering?.final_prompt || ""}`
}

export async function runSequentialCreativePipeline(body, context = {}, imageInputs = []) {
  const input = compactInput(body, context, imageInputs)
  const productionContext = buildProductionContext(input)

  if (!process.env.OPENROUTER_API_KEY || process.env.TEXT_TO_IMAGE_SEQUENTIAL_PIPELINE === "fallback") {
    const artDirectionText = fallbackArtDirection(input)
    const promptEngineering = fallbackPromptEngineer(artDirectionText, input)
    return {
      artDirection: { text: artDirectionText },
      artDirectionText,
      promptEngineering,
      productionContext,
      usedFallback: true,
    }
  }

  const artDirectionText = await callOpenRouter({
    name: "Art Director",
    system:
      "You are a senior Art Director and visual concept strategist. Follow the requested output format. Do not return JSON unless the user prompt asks for JSON.",
    user: renderPrompt(await loadPrompt("art-director"), {
      INPUT: JSON.stringify(productionContext, null, 2),
    }),
    temperature: 0.72,
  })

  const promptEngineeringText = await callOpenRouter({
    name: "Prompt Engineer",
    system: "You are a prompt engineer for gpt-image-2. Return only valid JSON.",
    user: renderPrompt(await loadPrompt("prompt-engineer"), {
      ART_DIRECTION_OUTPUT: artDirectionText,
      PRODUCTION_CONTEXT: JSON.stringify(productionContext, null, 2),
    }),
    temperature: 0.28,
  })
  const promptEngineering = extractJsonObject(promptEngineeringText)

  return {
    artDirection: { text: artDirectionText },
    artDirectionText,
    promptEngineering,
    productionContext,
    usedFallback: false,
  }
}
