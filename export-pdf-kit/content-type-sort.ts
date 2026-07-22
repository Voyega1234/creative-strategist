import type { IdeaRecommendation } from "./types"

const EXPORT_CONTENT_TYPE_ORDER = ["STATIC AD", "ALBUM AD", "UGC VIDEO", "SHORT VIDEO"] as const

export function normalizeContentTypeForSort(contentType?: string) {
  const normalized = (contentType || "").trim().toUpperCase()
  if (normalized === "STATIC") return "STATIC AD"
  if (normalized === "ALBUM") return "ALBUM AD"
  if (normalized === "UGC" || normalized === "VIDEO AD") return "UGC VIDEO"
  if (normalized === "MOTION" || normalized === "MOTION AD" || normalized === "SHORT VDO") return "SHORT VIDEO"
  return normalized
}

export function sortIdeasByContentType(ideasToSort: IdeaRecommendation[]) {
  return ideasToSort
    .map((idea, index) => ({ idea, index }))
    .sort((left, right) => {
      const leftRank = EXPORT_CONTENT_TYPE_ORDER.indexOf(
        normalizeContentTypeForSort(left.idea.content_type) as (typeof EXPORT_CONTENT_TYPE_ORDER)[number],
      )
      const rightRank = EXPORT_CONTENT_TYPE_ORDER.indexOf(
        normalizeContentTypeForSort(right.idea.content_type) as (typeof EXPORT_CONTENT_TYPE_ORDER)[number],
      )
      const leftSafeRank = leftRank === -1 ? EXPORT_CONTENT_TYPE_ORDER.length : leftRank
      const rightSafeRank = rightRank === -1 ? EXPORT_CONTENT_TYPE_ORDER.length : rightRank
      return leftSafeRank - rightSafeRank || left.index - right.index
    })
    .map(({ idea }) => idea)
}
