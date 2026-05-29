"use client"

import { useEffect } from "react"
import {
  getIdeaSelectionKey,
  VISUAL_ROUTES_BY_IDEA_STORAGE_KEY,
} from "@/lib/ideas/idea-storage"
import type { IdeaRecommendation, VisualRoute } from "@/lib/ideas/types"

export function usePersistVisualRoutes(topics: IdeaRecommendation[]) {
  useEffect(() => {
    const routeMap = topics.reduce<Record<string, VisualRoute[]>>((acc, topic) => {
      const key = getIdeaSelectionKey(topic)
      if (key && topic.visual_routes?.length) {
        acc[key] = topic.visual_routes
      }
      return acc
    }, {})

    try {
      window.sessionStorage.setItem(VISUAL_ROUTES_BY_IDEA_STORAGE_KEY, JSON.stringify(routeMap))
    } catch (error) {
      console.error("[visual-routes] Failed to persist visual routes:", error)
    }
  }, [topics])
}
