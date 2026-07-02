"use client"

import { memo } from "react"
import { Bookmark, BookmarkCheck, Pencil, Share2, ThumbsDown, ThumbsUp } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { IdeaContentType, IdeaRecommendation, IdeaSelectionStatus } from "@/lib/ideas/types"

interface IdeaCardProps {
  topic: IdeaRecommendation
  index: number
  isSaved: boolean
  onDetailClick: (topic: IdeaRecommendation) => void
  onSaveClick: (topic: IdeaRecommendation, index: number) => void
  onFeedback: (topic: IdeaRecommendation, type: "good" | "bad") => void
  onShare?: (topic: IdeaRecommendation, index: number) => void
  onEdit?: (topic: IdeaRecommendation, index: number) => void
  contentType?: IdeaContentType
  selectionStatus?: IdeaSelectionStatus
  isOptionDisabled?: boolean
  contentTypeWarning?: boolean
  onContentTypeChange?: (value: IdeaContentType) => void
  onSelectionStatusChange?: (value: IdeaSelectionStatus) => void
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
  onDetailClick,
  onSaveClick,
  onFeedback,
  onShare,
  onEdit,
  contentType,
  selectionStatus = "empty",
  isOptionDisabled = false,
  contentTypeWarning = false,
  onContentTypeChange,
  onSelectionStatusChange,
}: IdeaCardProps) {
  const visualRoutes = topic.visual_routes || []
  const previewRouteIndex = getStableRouteIndex(
    `${index}:${topic.title || ""}:${topic.concept_idea || ""}:${topic.copywriting?.headline || ""}`,
    visualRoutes.length,
  )
  const previewRoute = previewRouteIndex >= 0 ? visualRoutes[previewRouteIndex] : undefined
  const hook = topic.copywriting?.headline || topic.title || topic.concept_idea
  const subheadline = topic.copywriting?.sub_headline_1 || topic.copywriting?.sub_headline_2 || ""
  const hookTextSize = hook.length > 90 ? "text-[15px]" : hook.length > 55 ? "text-[17px]" : "text-[20px]"
  const subheadlineTextSize =
    subheadline.length > 160 ? "text-[12px]" : subheadline.length > 100 ? "text-[13px]" : "text-sm"
  const selectionStatusStyle =
    selectionStatus === "recommended"
      ? "border-[#c7d7fe] bg-[#eef4ff] text-[#194185] hover:bg-[#e0eaff]"
      : selectionStatus === "option"
        ? "border-[#fedf89] bg-[#fffaeb] text-[#93370d] hover:bg-[#fef0c7]"
        : "border-[#e4e7ec] bg-[#f8fafc] text-[#475467] hover:bg-[#f2f4f7]"
  const whyItMightWork = topic.competitiveGap || getDescriptionSummary(topic.description) || previewRoute?.why_it_fits || ""
  const cta = topic.copywriting?.cta || ""

  return (
    <Card className={`relative flex h-full flex-col rounded-xl border bg-white p-6 transition-all duration-200 hover:border-[#1d4ed8] hover:shadow-md ${contentTypeWarning ? "border-[#f04438] shadow-[0_0_0_3px_rgba(240,68,56,0.10)]" : "border-[#dce3ec]"}`}>
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
          title={isSaved ? "Remove bookmark" : "Save idea (Recommended)"}
        >
          {isSaved ? (
            <BookmarkCheck className="h-4 w-4 text-yellow-500" />
          ) : (
            <Bookmark className="h-4 w-4 text-gray-400 hover:text-blue-600" />
          )}
        </Button>
      </div>

      <div className="flex h-10 items-center gap-2 overflow-hidden pr-20">
        {contentType && (
          <Badge className="flex-shrink-0 rounded-md border-0 bg-[#eef2ff] px-3 py-1 text-xs font-bold text-[#3730d8] hover:bg-[#eef2ff]">
            {contentType}
          </Badge>
        )}
        {topic.content_pillar && (
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#667085]">{topic.content_pillar}</span>
        )}
      </div>

      <div
        className="flex flex-1 cursor-pointer flex-col pt-6"
        onClick={() => onDetailClick(topic)}
      >
        <div className="flex flex-1 flex-col">
          <div className="min-h-16">
            {hook && (
              <h4 className={`${hookTextSize} break-words font-bold leading-[1.28] text-[#101828]`}>
                {hook}
              </h4>
            )}
          </div>

          <div className="min-h-[90px] pt-3">
            {subheadline && (
              <div>
                <p className="mb-1 text-xs font-semibold text-[#667085]">Subheadline</p>
                <p className={`${subheadlineTextSize} break-words font-semibold leading-relaxed text-[#344054]`}>
                  {subheadline}
                </p>
              </div>
            )}
          </div>

          <div className="h-[72px] overflow-hidden pt-2">
            {cta && (
              <div>
                <p className="mb-1 text-xs font-semibold text-[#667085]">CTA</p>
                <p className="line-clamp-2 text-sm leading-relaxed text-[#475467]">{cta}</p>
              </div>
            )}
          </div>

          <div className="h-[102px] overflow-hidden pt-2">
            {whyItMightWork && (
              <div className="rounded-lg bg-[#eef2ff] px-4 py-3 text-[#3730d8]">
                <p className="mb-1 text-xs font-semibold">เหตุผลที่แนวคิดนี้น่าสนใจ</p>
                <p className="line-clamp-3 text-sm font-semibold leading-relaxed">{whyItMightWork}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-1 flex h-12 items-start justify-between overflow-hidden">
          <div className="flex max-h-12 flex-wrap gap-2 overflow-hidden">
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

      {(onContentTypeChange || onSelectionStatusChange) && (
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#eef2f7] pt-4">
          {onContentTypeChange && (
            <Select value={contentType} onValueChange={(value) => onContentTypeChange(value as IdeaContentType)}>
              <SelectTrigger
                aria-label="Content type"
                className="h-10 rounded-lg border-[#dfe3e8] bg-white text-sm font-medium text-[#344054]"
              >
                <SelectValue placeholder="Content type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STATIC AD">STATIC AD</SelectItem>
                <SelectItem value="UGC VIDEO">UGC VIDEO</SelectItem>
                <SelectItem value="ALBUM AD">ALBUM AD</SelectItem>
                <SelectItem value="MOTION AD">MOTION AD</SelectItem>
              </SelectContent>
            </Select>
          )}

          {onSelectionStatusChange && (
            <Select
              value={selectionStatus}
              onValueChange={(value) => onSelectionStatusChange(value as IdeaSelectionStatus)}
            >
              <SelectTrigger
                aria-label="Selection status"
                className={`h-10 rounded-xl px-3.5 text-sm font-semibold shadow-none transition-colors duration-200 focus:ring-2 focus:ring-[#84adff]/40 focus:ring-offset-1 ${selectionStatusStyle}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-[#e4e7ec] p-1 shadow-[0_12px_32px_rgba(16,24,40,0.12)]">
                <SelectItem className="rounded-lg py-2.5 font-medium" value="recommended">Recommended</SelectItem>
                <SelectItem className="rounded-lg py-2.5 font-medium" value="option" disabled={isOptionDisabled}>Option</SelectItem>
                <SelectItem className="rounded-lg py-2.5 font-medium" value="empty">Not selected</SelectItem>
              </SelectContent>
            </Select>
          )}

          {contentTypeWarning && (
            <p className="col-span-2 rounded-lg bg-[#fff1f3] px-3 py-2 text-xs font-semibold text-[#d92d20]">
              Please choose a content type before exporting this selected idea.
            </p>
          )}
        </div>
      )}
    </Card>
  )
})
