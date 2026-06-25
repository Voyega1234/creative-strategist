"use client"

import { memo } from "react"
import { Bookmark, BookmarkCheck, Pencil, Share2, ThumbsDown, ThumbsUp } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { IdeaRecommendation } from "@/lib/ideas/types"

interface IdeaCardProps {
  topic: IdeaRecommendation
  index: number
  isSaved: boolean
  showVisualRoutePreview?: boolean
  onDetailClick: (topic: IdeaRecommendation) => void
  onSaveClick: (topic: IdeaRecommendation, index: number) => void
  onFeedback: (topic: IdeaRecommendation, type: "good" | "bad") => void
  onShare?: (topic: IdeaRecommendation, index: number) => void
  onEdit?: (topic: IdeaRecommendation, index: number) => void
}

function getDescriptionSummary(description: IdeaRecommendation["description"]) {
  if (!description) return ""

  if (typeof description === "string") return description

  if (Array.isArray(description)) {
    const priorityItem =
      description.find((item) => item.label === "Why this converts" || item.label === "Evidence/Counterpoint") ||
      description[0]
    return priorityItem?.text || ""
  }

  const prioritySection =
    description.sections?.find((section) => section.group === "why_evidence") ||
    description.sections?.[0]
  return prioritySection?.bullets?.[0] || description.summary || ""
}

function getStableRouteIndex(seed: string, routeCount: number) {
  if (routeCount <= 0) return -1

  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }

  return hash % routeCount
}

export const IdeaCard = memo(function IdeaCard({
  topic,
  index,
  isSaved,
  showVisualRoutePreview = true,
  onDetailClick,
  onSaveClick,
  onFeedback,
  onShare,
  onEdit,
}: IdeaCardProps) {
  const visualRoutes = topic.visual_routes || []
  const previewRouteIndex = getStableRouteIndex(
    `${index}:${topic.title || ""}:${topic.concept_idea || ""}:${topic.copywriting?.headline || ""}`,
    visualRoutes.length,
  )
  const previewRoute = previewRouteIndex >= 0 ? visualRoutes[previewRouteIndex] : undefined
  const hook = topic.copywriting?.headline || topic.title || topic.concept_idea
  const concept = topic.title || topic.concept_idea || topic.description
  const subheadline = topic.copywriting?.sub_headline_1 || topic.copywriting?.sub_headline_2 || ""
  const whyItMightWork = topic.competitiveGap || getDescriptionSummary(topic.description) || previewRoute?.why_it_fits || ""
  const previewVisualRoute = [previewRoute?.route_name, previewRoute?.visual_idea]
    .filter(Boolean)
    .join(": ") || previewRoute?.why_it_fits || ""

  return (
    <Card className="bg-white border border-[#e4e7ec] rounded-xl p-6 hover:shadow-md hover:border-[#1d4ed8] transition-all duration-200 relative">
      {topic.concept_type && (
        <div className="mb-4">
          <Badge className={`text-white text-xs px-3 py-1 rounded-full ${
            topic.concept_type === "Proven Concept" ? "bg-blue-500" :
            topic.concept_type === "New Concept" ? "bg-purple-500" : "bg-gray-500"
          }`}>
            {topic.concept_type}
          </Badge>
        </div>
      )}

      <div className="absolute top-3 right-3 flex gap-1">
        {onEdit ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-blue-50 rounded-full bg-white/90 shadow-sm border border-gray-100"
            onClick={(event) => {
              event.stopPropagation()
              onEdit(topic, index)
            }}
            title="Edit idea"
          >
            <Pencil className="h-4 w-4 text-gray-400 hover:text-blue-600" />
          </Button>
        ) : onShare ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-purple-50 rounded-full bg-white/90 shadow-sm border border-gray-100"
            onClick={(event) => {
              event.stopPropagation()
              onShare(topic, index)
            }}
            title="Share idea"
          >
            <Share2 className="h-4 w-4 text-gray-400 hover:text-purple-600" />
          </Button>
        ) : null}

        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 hover:bg-blue-50 rounded-full bg-white/90 shadow-sm border border-gray-100"
          onClick={(event) => {
            event.stopPropagation()
            onSaveClick(topic, index)
          }}
          title={isSaved ? "Remove bookmark" : "Save idea"}
        >
          {isSaved ? (
            <BookmarkCheck className="h-4 w-4 text-yellow-500" />
          ) : (
            <Bookmark className="h-4 w-4 text-gray-400 hover:text-blue-600" />
          )}
        </Button>
      </div>

      <div className="space-y-4 cursor-pointer" onClick={() => onDetailClick(topic)}>
        <div>
          <Badge variant="outline" className="text-xs bg-gray-50 mb-3 border-[#e4e7ec]">
            {topic.content_pillar}
          </Badge>
          {hook && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#667085]">Hook</p>
              <h4 className="mt-1 text-xl font-bold leading-normal text-[#111827]">
                {hook}
              </h4>
            </div>
          )}
          {concept && (
            <p className="mt-2 line-clamp-2 text-sm leading-snug text-[#667085]">
              <span className="font-semibold text-[#667085]">Concept:</span>{" "}
              {typeof concept === "string" ? concept : getDescriptionSummary(concept)}
            </p>
          )}
          {subheadline && (
            <p className="text-[#525d7a] text-sm leading-snug mt-2">
              <span className="font-semibold text-[#1d4ed8] uppercase text-[11px] tracking-wide mr-2">
                Subheadline
              </span>
              {subheadline}
            </p>
          )}
          {(whyItMightWork || topic.copywriting?.cta || (showVisualRoutePreview && previewVisualRoute)) && (
            <div className="mt-5 space-y-2 border-t border-[#eef2f7] pt-4">
              {whyItMightWork && (
                <p className="text-[#1f2937] text-sm leading-snug">
                  <span className="block font-semibold text-[#667085] uppercase text-[11px] tracking-[0.18em]">
                    Why
                  </span>
                  {whyItMightWork}
                </p>
              )}
              {showVisualRoutePreview && previewVisualRoute && (
                <p className="text-[#1f2937] text-sm leading-snug">
                  <span className="block font-semibold text-[#667085] uppercase text-[11px] tracking-[0.18em]">
                    Visual Routes
                  </span>
                  {previewVisualRoute}
                </p>
              )}
              {topic.copywriting?.cta && (
                <p className="text-[#1f2937] text-sm leading-snug">
                  <span className="block font-semibold text-[#667085] uppercase text-[11px] tracking-[0.18em]">
                    CTA
                  </span>
                  {topic.copywriting.cta}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {(topic.tags || []).slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs border-[#e4e7ec]">
                {tag}
              </Badge>
            ))}
          </div>

          <div className="flex gap-1 ml-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 hover:bg-green-50 rounded-full"
              onClick={(event) => {
                event.stopPropagation()
                onFeedback(topic, "good")
              }}
              title="Good feedback"
            >
              <ThumbsUp className="h-3.5 w-3.5 text-gray-400 hover:text-green-600" />
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 hover:bg-red-50 rounded-full"
              onClick={(event) => {
                event.stopPropagation()
                onFeedback(topic, "bad")
              }}
              title="Bad feedback"
            >
              <ThumbsDown className="h-3.5 w-3.5 text-gray-400 hover:text-red-600" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
})
