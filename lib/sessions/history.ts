import { sessionManager } from "@/lib/session-manager"
import { normalizeIdea } from "@/lib/ideas/idea-normalization"
import type { IdeaRecommendation } from "@/lib/ideas/types"

export type SessionHistoryOptions = {
  clientName?: string
  limit?: number
  offset?: number
}

export type SessionHistoryResult<TSession = any> = {
  success: boolean
  sessions?: TSession[]
  hasMore?: boolean
  error?: string
}

export async function fetchSessionHistory<TSession = any>(
  options: SessionHistoryOptions = {}
): Promise<SessionHistoryResult<TSession>> {
  return sessionManager.getHistory(options)
}

export async function fetchLatestSession<TSession = any>(clientName: string) {
  const result = await fetchSessionHistory<TSession>({
    clientName,
    limit: 1,
  })

  return result.success && result.sessions?.length ? result.sessions[0] : null
}

export type LoadedSessionIdeas = {
  ideas: IdeaRecommendation[]
  source: "n8nResponse" | "sessionIdeas"
  userInput: string
  selectedTemplate: string | null
}

export function getLoadedSessionIdeas(session: any): LoadedSessionIdeas | null {
  if (session.n8nResponse?.ideas && session.n8nResponse.ideas.length > 0) {
    return {
      ideas: session.n8nResponse.ideas.map(normalizeIdea),
      source: "n8nResponse",
      userInput: session.userInput || "",
      selectedTemplate: session.selectedTemplate || null,
    }
  }

  if (session.ideas && session.ideas.length > 0) {
    return {
      ideas: session.ideas.map(normalizeIdea),
      source: "sessionIdeas",
      userInput: session.userInput || "",
      selectedTemplate: session.selectedTemplate || null,
    }
  }

  return null
}
