import { requiredEnv } from "./env.mjs"

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

export function buildVisualThinkingUserPrompt(body, context = {}) {
  return `User brief:
${body.prompt || ""}

Style:
${body.userBrief || ""}

Brand:
${body.client || ""}

Category Lens:
${context.client?.productFocus || ""}

Market research:
${context.market ? JSON.stringify(context.market, null, 2) : ""}

Brand identity:
Color palette / mood / tone:
${JSON.stringify(body.color_palette || body.colorPalette || [], null, 2)}

ratio:
${body.aspect_ratio || body.aspectRatio || "4:5"}

Core concept:
${body.core_concept || ""}

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
        { role: "system", content: visualThinkingSystemPrompt },
        { role: "user", content: buildVisualThinkingUserPrompt(body, context) },
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
