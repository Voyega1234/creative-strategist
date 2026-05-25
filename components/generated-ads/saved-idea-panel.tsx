"use client"

import { CheckCircle, ChevronDown, Edit, Library, Loader2, Wand2, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { getTopicPreviewText } from "@/lib/custom-idea-parser"
import type { SavedTopic } from "@/lib/images/generated-ads"
import { cn } from "@/lib/utils"
import type { VisualRoute } from "@/lib/ideas/types"

interface SavedIdeaPanelProps {
  selectedTopicData: SavedTopic | null
  selectedTopicSummary: string
  availableVisualRoutes: VisualRoute[] | null
  selectedVisualRouteIndex: number | null
  isIdeasOpen: boolean
  canChooseIdea: boolean
  loadingTopics: boolean
  savedTopics: SavedTopic[]
  visibleTopics: SavedTopic[]
  selectedTopic: string
  deletingTopicId: string | null
  showAllTopics: boolean
  onIdeasOpenChange: (open: boolean) => void
  onVisualRouteSelect: (routeIndex: number) => void
  onClearVisualRoute: () => void
  onTopicSelect: (topicTitle: string) => void
  onEditTopic: (topic: SavedTopic) => void
  onDeleteTopic: (topic: SavedTopic) => void
  onAddIdea: () => void
  onClearSelectedIdea: () => void
  onToggleShowAllTopics: () => void
}

export function SavedIdeaPanel({
  selectedTopicData,
  selectedTopicSummary,
  availableVisualRoutes,
  selectedVisualRouteIndex,
  isIdeasOpen,
  canChooseIdea,
  loadingTopics,
  savedTopics,
  visibleTopics,
  selectedTopic,
  deletingTopicId,
  showAllTopics,
  onIdeasOpenChange,
  onVisualRouteSelect,
  onClearVisualRoute,
  onTopicSelect,
  onEditTopic,
  onDeleteTopic,
  onAddIdea,
  onClearSelectedIdea,
  onToggleShowAllTopics,
}: SavedIdeaPanelProps) {
  return (
    <>
      {selectedTopicData && (
        <div className="min-w-0 rounded-[24px] bg-slate-50 px-4 py-5 sm:px-5">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Saved idea selected
              </p>
              <h5 className="mt-2 text-lg font-semibold text-slate-950">{selectedTopicData.title}</h5>
              <p className="mt-2 text-sm leading-6 text-slate-600">{selectedTopicSummary}</p>
            </div>
            <CheckCircle className="h-5 w-5 flex-shrink-0 text-slate-900" />
          </div>
          {availableVisualRoutes && availableVisualRoutes.length > 0 && (
            <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Visual direction
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    เลือกภาพทางหลักที่จะให้ AI ใช้ตอนเจนรูป หรือปล่อยว่างไว้ถ้าต้องการ freestyle
                  </p>
                </div>
                {selectedVisualRouteIndex !== null && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 rounded-full px-3 text-xs text-slate-500 hover:bg-slate-100"
                    onClick={onClearVisualRoute}
                  >
                    Clear route
                  </Button>
                )}
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {availableVisualRoutes.map((route, routeIndex) => {
                  const isSelected = selectedVisualRouteIndex === routeIndex
                  return (
                    <button
                      key={`${route.route_name}-${routeIndex}`}
                      type="button"
                      onClick={() => onVisualRouteSelect(routeIndex)}
                      className={cn(
                        "min-h-[172px] rounded-[20px] border p-4 text-left transition-all",
                        isSelected
                          ? "border-slate-950 bg-slate-950 text-white shadow-[0_16px_30px_rgba(15,23,42,0.16)]"
                          : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_14px_28px_rgba(15,23,42,0.06)]",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {route.route_type && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium",
                              isSelected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600",
                            )}
                          >
                            {route.route_type}
                          </span>
                        )}
                        {isSelected && (
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-950">
                            Selected
                          </span>
                        )}
                      </div>
                      <h6 className={cn("mt-3 text-base font-semibold", isSelected ? "text-white" : "text-slate-950")}>
                        {route.route_name}
                      </h6>
                      {route.visual_idea && (
                        <p className={cn("mt-2 line-clamp-3 text-sm leading-6", isSelected ? "text-slate-200" : "text-slate-600")}>
                          {route.visual_idea}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <Collapsible
        open={isIdeasOpen}
        onOpenChange={onIdeasOpenChange}
        className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70"
      >
        <CollapsibleTrigger className="flex w-full min-w-0 items-center justify-between gap-3 px-4 py-3 text-left">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <Library className="h-4 w-4 text-slate-700" />
              Use saved idea
              <span className="text-xs font-normal text-slate-500">optional</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              เลือก idea ที่มีอยู่เพื่อใช้เป็น starting point แทนการเริ่มจากศูนย์
            </p>
          </div>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-500 transition-transform", isIdeasOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 px-4 pb-4">
          {canChooseIdea ? (
            loadingTopics ? (
              <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                <span className="ml-2 text-sm text-slate-500">กำลังโหลดไอเดีย...</span>
              </div>
            ) : savedTopics.length > 0 ? (
              <>
                <div
                  className={cn(
                    "grid gap-4 lg:grid-cols-2",
                    showAllTopics && "max-h-[34rem] overflow-y-auto pr-2",
                  )}
                >
                  {visibleTopics.map((topic) => {
                    const isSelected = selectedTopic === topic.title
                    const topicKey = topic.id || topic.title
                    const isDeleting = deletingTopicId === topicKey
                    return (
                      <div
                        key={topicKey}
                        className={cn(
                          "min-w-0 rounded-[24px] border p-4 transition-all",
                          isSelected
                            ? "border-slate-950 bg-slate-50 shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
                            : "border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-[0_10px_24px_rgba(15,23,42,0.05)]",
                        )}
                      >
                        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onTopicSelect(topic.title)}>
                            <div className="flex flex-wrap items-center gap-2">
                              <h5 className="break-words text-base font-semibold text-slate-950">{topic.title}</h5>
                              <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-600">
                                {topic.category}
                              </Badge>
                              {topic.id?.startsWith("custom-") && (
                                <Badge variant="outline" className="rounded-full border-slate-200 bg-white text-slate-600">
                                  Custom
                                </Badge>
                              )}
                            </div>
                            <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                              {getTopicPreviewText(topic.description)}
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {Array.isArray(topic.tags) &&
                                topic.tags.slice(0, 3).map((tag) => (
                                  <Badge key={tag} variant="outline" className="rounded-full border-slate-200 text-xs text-slate-600">
                                    {tag}
                                  </Badge>
                                ))}
                            </div>
                          </button>
                          <div className="flex shrink-0 flex-row flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                              disabled={isDeleting}
                              onClick={() => onEditTopic(topic)}
                            >
                              <Edit className="mr-1 h-3.5 w-3.5" />
                              แก้ไข
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                              disabled={isDeleting}
                              onClick={() => onDeleteTopic(topic)}
                            >
                              {isDeleting ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <X className="mr-1 h-3.5 w-3.5" />
                              )}
                              ลบ
                            </Button>
                            {isSelected && <CheckCircle className="h-5 w-5 text-slate-900" />}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button type="button" variant="outline" onClick={onAddIdea} className="rounded-full border-slate-200">
                    <Wand2 className="mr-2 h-4 w-4" />
                    Add idea
                  </Button>
                  <div className="flex flex-wrap gap-2">
                    {selectedTopicData && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={onClearSelectedIdea}
                        className="rounded-full border-slate-200"
                      >
                        Clear selected idea
                      </Button>
                    )}
                    {savedTopics.length > 4 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={onToggleShowAllTopics}
                        className="rounded-full border-slate-200"
                      >
                        {showAllTopics ? "Show fewer ideas" : `See more ideas (${savedTopics.length - 4})`}
                      </Button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                ยังไม่มี saved idea สำหรับลูกค้าและ Product Focus นี้
              </div>
            )
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
              เลือกลูกค้าและ Product Focus ก่อนเพื่อดู saved ideas
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </>
  )
}
