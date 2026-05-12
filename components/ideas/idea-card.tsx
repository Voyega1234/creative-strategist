"use client"

import { memo, useState, type MouseEvent } from "react"
import { Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, Share2, ThumbsDown, ThumbsUp } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { IdeaRecommendation } from "@/lib/ideas/types"

interface IdeaCardProps {
  topic: IdeaRecommendation
  index: number
  isSaved: boolean
  onDetailClick: (topic: IdeaRecommendation) => void
  onSaveClick: (topic: IdeaRecommendation, index: number) => void
  onFeedback: (topic: IdeaRecommendation, type: "good" | "bad") => void
  onShare: (topic: IdeaRecommendation, index: number) => void
}

export const IdeaCard = memo(function IdeaCard({
  topic,
  index,
  isSaved,
  onDetailClick,
  onSaveClick,
  onFeedback,
  onShare,
}: IdeaCardProps) {
  const visualRoutes = topic.visual_routes || []
  const [activeRouteIndex, setActiveRouteIndex] = useState(0)
  const activeRoute = visualRoutes[activeRouteIndex]

  const goToRoute = (event: MouseEvent, direction: -1 | 1) => {
    event.stopPropagation()
    if (visualRoutes.length <= 1) return
    setActiveRouteIndex((prev) => (prev + direction + visualRoutes.length) % visualRoutes.length)
  }

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
            <BookmarkCheck className="h-4 w-4 text-blue-600" />
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
          <h4 className="text-lg font-bold text-[#000000] leading-tight mb-2">
            {topic.title || topic.concept_idea}
          </h4>
          {topic.copywriting?.headline && (
            <div className="mt-2 rounded-md border border-[#e4e7ec] bg-[#f9fbff] px-3 py-2">
              <span className="block text-[11px] uppercase tracking-wide text-[#64748b] mb-1">
                Headline
              </span>
              <p className="text-sm font-medium text-[#0f172a] leading-snug">
                {topic.copywriting.headline}
              </p>
            </div>
          )}
          {topic.copywriting?.sub_headline_1 && (
            <p className="text-[#525d7a] text-sm leading-snug mt-2">
              <span className="font-semibold text-[#1d4ed8] uppercase text-[11px] tracking-wide mr-2">
                Sub Headline 1
              </span>
              {topic.copywriting.sub_headline_1}
            </p>
          )}
          {topic.copywriting?.sub_headline_2 && (
            <p className="text-[#525d7a] text-sm leading-snug mt-1">
              <span className="font-semibold text-[#1d4ed8] uppercase text-[11px] tracking-wide mr-2">
                Sub Headline 2
              </span>
              {topic.copywriting.sub_headline_2}
            </p>
          )}
          {topic.title && topic.concept_idea && topic.concept_idea !== topic.title && (
            <p className="text-[#475569] text-sm mt-3 leading-snug">
              <span className="font-semibold text-[#1d4ed8] uppercase text-[11px] tracking-wide mr-2">
                Core Concept
              </span>
              {topic.concept_idea}
            </p>
          )}
          {activeRoute && (
            <div className="mt-4 rounded-xl border border-[#e4e7ec] bg-[#fbfcfe] p-3 transition-all">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#667085]">
                  Visual route preview
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 rounded-full p-0 text-[#667085] hover:bg-white hover:text-[#0f172a]"
                    onClick={(event) => goToRoute(event, -1)}
                    disabled={visualRoutes.length <= 1}
                    aria-label="Previous visual route"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Badge variant="outline" className="border-[#e4e7ec] bg-white text-[10px] text-[#667085]">
                    {activeRouteIndex + 1} / {visualRoutes.length}
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 rounded-full p-0 text-[#667085] hover:bg-white hover:text-[#0f172a]"
                    onClick={(event) => goToRoute(event, 1)}
                    disabled={visualRoutes.length <= 1}
                    aria-label="Next visual route"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="min-h-[142px] rounded-lg bg-white px-3 py-3 shadow-[inset_0_0_0_1px_rgba(228,231,236,0.85)]">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[#0f172a]">{activeRoute.route_name}</p>
                  {activeRoute.route_type && (
                    <span className="rounded-full bg-[#f2f4f7] px-2 py-0.5 text-[10px] font-medium text-[#475467]">
                      {activeRoute.route_type}
                    </span>
                  )}
                </div>
                {activeRoute.visual_idea && (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#475569]">{activeRoute.visual_idea}</p>
                )}
                {activeRoute.why_it_fits && (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#64748b]">
                    <span className="font-semibold text-[#1d4ed8]">Why:</span> {activeRoute.why_it_fits}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex gap-1">
                    {visualRoutes.map((_, dotIndex) => (
                      <button
                        key={dotIndex}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setActiveRouteIndex(dotIndex)
                        }}
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          activeRouteIndex === dotIndex ? "w-5 bg-[#0f172a]" : "w-1.5 bg-[#d0d5dd]",
                        )}
                        aria-label={`Show visual route ${dotIndex + 1}`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#98a2b3]">
                    เลือกตอนเจนรูป
                  </span>
                </div>
              </div>
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
