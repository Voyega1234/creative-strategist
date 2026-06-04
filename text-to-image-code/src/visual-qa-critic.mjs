function extractTextFromGemini(payload) {
  const parts = payload?.candidates?.flatMap((candidate) => candidate?.content?.parts || []) || []
  return parts
    .filter((part) => typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim()
}

function extractJsonObject(text) {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i)
  const raw = fencedMatch?.[1]?.trim() || text.trim()
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Visual QA critic did not return JSON")
  }

  return JSON.parse(raw.slice(start, end + 1))
}

function normalizeNumber(value, fallback = 0) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value) : Number.NaN
  if (!Number.isFinite(number)) return fallback
  return Math.round(Math.min(10, Math.max(0, number)) * 10) / 10
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : []
}

function normalizeCritique(value) {
  return {
    likely_origin:
      typeof value?.likely_origin === "string" ? value.likely_origin.trim() : "unknown",
    verdict:
      typeof value?.verdict === "string" ? value.verdict.trim() : "",
    human_made_likelihood: normalizeNumber(value?.human_made_likelihood),
    ai_artifact_score: normalizeNumber(value?.ai_artifact_score),
    agency_finish_score: normalizeNumber(value?.agency_finish_score),
    brand_fit_score: normalizeNumber(value?.brand_fit_score),
    composition_score: normalizeNumber(value?.composition_score),
    typography_score: normalizeNumber(value?.typography_score),
    product_integration_score: normalizeNumber(value?.product_integration_score),
    what_feels_ai: normalizeStringArray(value?.what_feels_ai),
    what_feels_human_designed: normalizeStringArray(value?.what_feels_human_designed),
    must_fix_next_generation: normalizeStringArray(value?.must_fix_next_generation),
    prompt_patch:
      typeof value?.prompt_patch === "string" ? value.prompt_patch.trim() : "",
  }
}

function buildVisualQaPrompt({ prompt, creativePlan }) {
  return `You are a senior visual QA critic for a creative digital marketing agency.

Analyze the uploaded generated ad image and judge whether it feels:
- human-designed,
- AI-assisted but professionally art-directed,
- or raw/generic AI output.

You are strict. Do not be polite. The goal is to improve the next image generation.

Evaluate the image like a human creative director reviewing final artwork:
1. Does the product/material feel physically integrated into the scene?
2. Do lighting, shadow, reflection, depth, scale, and camera perspective feel believable?
3. Does typography feel designed by a graphic designer or randomly rendered by AI?
4. Is there a real graphic design mechanism, or only product + background + text?
5. Does the mood/tone/style fit the brand/category/audience?
6. Does the image look like an agency finished it, or like an AI render with text added?
7. Are there Thai/English copy errors, unnatural phrases, or unreadable text?

Return JSON only. No markdown.

JSON schema:
{
  "likely_origin": "human-made | AI-assisted | raw-AI | uncertain",
  "verdict": "1-2 sentence direct critique",
  "human_made_likelihood": 0-10,
  "ai_artifact_score": 0-10,
  "agency_finish_score": 0-10,
  "brand_fit_score": 0-10,
  "composition_score": 0-10,
  "typography_score": 0-10,
  "product_integration_score": 0-10,
  "what_feels_ai": ["specific issue"],
  "what_feels_human_designed": ["specific strength"],
  "must_fix_next_generation": ["specific correction for next generation"],
  "prompt_patch": "A concise prompt patch for the next generation. It must directly address the AI-looking issues and improve craft."
}

Original final image prompt:
${prompt}

Creative plan:
${creativePlan ? JSON.stringify(creativePlan, null, 2) : ""}`
}

export function shouldRunVisualQa() {
  return process.env.TEXT_TO_IMAGE_VISUAL_QA !== "off"
}

export function shouldRegenerateFromVisualQa(critique) {
  if (process.env.TEXT_TO_IMAGE_VISUAL_QA_REGENERATE === "false") return false

  const threshold = Number.parseFloat(process.env.TEXT_TO_IMAGE_VISUAL_QA_THRESHOLD || "7.5")
  const agencyScore = normalizeNumber(critique?.agency_finish_score)
  const artifactScore = normalizeNumber(critique?.ai_artifact_score)
  const productScore = normalizeNumber(critique?.product_integration_score)

  return agencyScore < threshold || artifactScore >= 5 || productScore < 7
}

export function applyVisualQaPromptPatch(prompt, critique) {
  const fixes = normalizeStringArray(critique?.must_fix_next_generation)
  const patch = typeof critique?.prompt_patch === "string" ? critique.prompt_patch.trim() : ""

  return `${prompt}

VISUAL QA CRITIC FEEDBACK FROM THE PREVIOUS GENERATED IMAGE:
- Likely origin judged by critic: ${critique?.likely_origin || "unknown"}
- Agency finish score: ${critique?.agency_finish_score ?? "n/a"}/10
- AI artifact score: ${critique?.ai_artifact_score ?? "n/a"}/10
- Product integration score: ${critique?.product_integration_score ?? "n/a"}/10

Specific issues that made the previous image look AI-assisted:
${normalizeStringArray(critique?.what_feels_ai).map((item) => `- ${item}`).join("\n") || "- None reported"}

Must fix in the next generation:
${fixes.map((item) => `- ${item}`).join("\n") || "- Improve physical integration, lighting, typography, and craft."}

Prompt patch:
${patch || "Make the image feel more human-designed and professionally finished. Improve physical integration, shadows, lighting consistency, typography, and the graphic design mechanism."}

Generate a new improved image. Do not copy the previous flaws.`.trim()
}

export async function critiqueGeneratedImage({ imageBuffer, mimeType, prompt, creativePlan }) {
  if (!shouldRunVisualQa()) return null

  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY
  if (!apiKey) {
    console.warn("[visual-qa] Missing GEMINI_API_KEY; skipping visual QA")
    return null
  }

  const model = process.env.TEXT_TO_IMAGE_VISUAL_QA_MODEL || "gemini-3.5-flash"
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: buildVisualQaPrompt({ prompt, creativePlan }) },
            {
              inlineData: {
                data: imageBuffer.toString("base64"),
                mimeType: mimeType || "image/png",
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    }),
  })

  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = null
  }

  if (!response.ok) {
    const errorMessage = payload?.error?.message || text || `Gemini visual QA failed (${response.status})`
    throw new Error(errorMessage)
  }

  const content = extractTextFromGemini(payload)
  if (!content) throw new Error("Gemini visual QA returned no critique text")

  return normalizeCritique(extractJsonObject(content))
}
