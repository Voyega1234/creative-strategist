export const IDEA_GENERATION_FAILED_MESSAGE = "เจนไอเดียไม่สำเร็จ"

type ValidationResult =
  | { valid: true; ideas: Record<string, unknown>[] }
  | { valid: false; reason: string }

export function extractGeneratedIdeas(value: unknown): unknown[] {
  if (!value || typeof value !== "object") return []

  const record = value as Record<string, unknown>
  if (Array.isArray(record.ideas)) return record.ideas

  if (record.data && typeof record.data === "object") {
    const data = record.data as Record<string, unknown>
    if (Array.isArray(data.ideas)) return data.ideas
  }

  return []
}

export function validateIdeaGenerationResult(value: unknown): ValidationResult {
  const ideas = extractGeneratedIdeas(value)
  if (ideas.length === 0) {
    return { valid: false, reason: "Response does not contain a non-empty ideas array" }
  }

  const invalidIndex = ideas.findIndex((idea) => {
    if (!idea || typeof idea !== "object" || Array.isArray(idea)) return true
    const record = idea as Record<string, unknown>
    const hasConcept = typeof record.concept_idea === "string" && Boolean(record.concept_idea.trim())
    const hasTitle = typeof record.title === "string" && Boolean(record.title.trim())
    return !hasConcept && !hasTitle
  })

  if (invalidIndex >= 0) {
    return { valid: false, reason: `Idea at index ${invalidIndex} is missing concept_idea or title` }
  }

  return { valid: true, ideas: ideas as Record<string, unknown>[] }
}

export function getWebhookResponseError(value: unknown) {
  if (!value || typeof value !== "object") return ""
  const record = value as Record<string, unknown>
  const status = typeof record.status === "string" ? record.status.toLowerCase() : ""
  const success = record.success
  const error = typeof record.error === "string" ? record.error.trim() : ""
  const message = typeof record.message === "string" ? record.message.trim() : ""

  if (success === false || status === "error" || status === "failed" || error) {
    return error || message || "n8n returned an error response"
  }

  return ""
}
