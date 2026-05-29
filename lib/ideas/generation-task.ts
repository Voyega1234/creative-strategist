import { MODEL_OPTIONS } from "@/lib/ideas/generation-options"
import { normalizeIdea } from "@/lib/ideas/idea-normalization"
import type { IdeaRecommendation } from "@/lib/ideas/types"

export type IdeaGenerationMode = "initial" | "append"

export type IdeaGenerationTaskContext = {
  mode: IdeaGenerationMode
  finalInstructions: string
  selectedTemplate: string | null
  selectedModel: string
  existingConceptIdeas?: string[]
  clientName: string
  productFocus: string | null
}

export type EnqueueIdeaGenerationParams = {
  clientName: string
  productFocus: string
  service?: string
  instructions: string
  productDetails?: string
  negativePrompts?: string[]
  hasProductDetails: boolean
  model: string
  existingConceptIdeas?: string[]
}

export type EnqueueIdeaGenerationResult = {
  responseOk: boolean
  success: boolean
  taskId?: string
  error?: string
}

export function resolveIdeaGenerationModelId(selectedModel: string) {
  return MODEL_OPTIONS.find((model) => model.name === selectedModel)?.id || "gemini-2.5-pro"
}

export function getIdeasFromTaskResult(result: any): IdeaRecommendation[] {
  const rawIdeas: any[] = Array.isArray(result?.ideas)
    ? result.ideas
    : Array.isArray(result?.data?.ideas)
      ? result.data.ideas
      : []

  return rawIdeas.map(normalizeIdea)
}

export function mergeUniqueIdeas(
  existingIdeas: IdeaRecommendation[],
  incomingIdeas: IdeaRecommendation[]
) {
  const existingConcepts = new Set(
    existingIdeas.map((topic) => topic.concept_idea || topic.title || "")
  )

  const freshIdeas = incomingIdeas.filter((idea) => {
    const key = idea.concept_idea || idea.title || ""
    if (!key) return true
    if (existingConcepts.has(key)) {
      return false
    }
    existingConcepts.add(key)
    return true
  })

  return [...existingIdeas, ...freshIdeas]
}

export async function enqueueIdeaGenerationTask(
  params: EnqueueIdeaGenerationParams
): Promise<EnqueueIdeaGenerationResult> {
  const response = await fetch("/api/generate-ideas", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  })

  const data = await response.json()

  return {
    responseOk: response.ok,
    success: Boolean(data.success),
    taskId: data.taskId,
    error: data.error,
  }
}
