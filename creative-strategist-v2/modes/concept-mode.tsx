"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bookmark, BookmarkCheck, Loader2, Plus, Sparkles } from "lucide-react";

import { FeedbackForm } from "@/components/feedback-form";
import { IdeaCard } from "@/components/ideas/idea-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PromptInputBox } from "@/creative-strategist-v2/chat-model";
import { IDEA_GENERATION_FAILED_MESSAGE } from "@/lib/ideas/generation-response";
import { normalizeIdea } from "@/lib/ideas/idea-normalization";
import { getIdeaSelectionKey, VISUAL_ROUTES_BY_IDEA_STORAGE_KEY } from "@/lib/ideas/idea-storage";
import type { IdeaRecommendation } from "@/lib/ideas/types";
import { sessionManager } from "@/lib/session-manager";

// Cache the visual routes of the currently displayed concept ideas so that selecting the same idea
// later from the "Use saved idea" list in Text to Image (which loads from a table without routes)
// can recover them by key.
function cacheVisualRoutesForIdeas(ideas: IdeaRecommendation[]) {
  if (typeof window === "undefined") return;
  try {
    const stored = window.sessionStorage.getItem(VISUAL_ROUTES_BY_IDEA_STORAGE_KEY);
    const map = stored ? (JSON.parse(stored) as Record<string, unknown>) : {};
    let changed = false;
    for (const idea of ideas) {
      const key = getIdeaSelectionKey(idea);
      if (key && idea.visual_routes?.length) {
        map[key] = idea.visual_routes;
        changed = true;
      }
    }
    if (changed) {
      window.sessionStorage.setItem(VISUAL_ROUTES_BY_IDEA_STORAGE_KEY, JSON.stringify(map));
      window.dispatchEvent(new Event("cvc-visual-routes-updated"));
    }
  } catch (error) {
    console.warn("[ConceptMode] Failed to cache visual routes:", error);
  }
}

type ConceptModeProps = {
  clientName?: string;
  productFocus?: string | null;
  selectedSessionId?: string | null;
  startNewSession?: boolean;
  onHasIdeasChange?: (hasIdeas: boolean) => void;
  onUseIdeaForImage?: (
    idea: IdeaRecommendation,
    selectedVisualRouteIndex: number | null,
  ) => void;
};

type TaskContext = {
  mode: "initial" | "append";
  instructions: string;
  clientName: string;
  productFocus: string;
  existingConceptIdeas?: string[];
};

type SessionHistoryRecord = {
  n8nResponse?: {
    ideas?: unknown[];
  };
  ideas?: unknown[];
  userInput?: string;
};

type TaskResultPayload = {
  ideas?: unknown[];
  data?: {
    ideas?: unknown[];
  };
};

function getIdeaDescription(idea: IdeaRecommendation | null) {
  const description = idea?.description;
  if (!description) return "";
  if (typeof description === "string") return description;
  if (Array.isArray(description)) {
    return description
      .map((item) => (typeof item === "string" ? item : item?.text || item?.summary || ""))
      .filter(Boolean)
      .join("\n");
  }
  if (typeof description === "object") {
    const value = description as { summary?: string };
    return value.summary || "";
  }
  return "";
}

export function ConceptMode({
  clientName,
  productFocus,
  selectedSessionId,
  startNewSession = false,
  onHasIdeasChange,
  onUseIdeaForImage,
}: ConceptModeProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const taskTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taskContextRef = useRef<TaskContext | null>(null);
  const ideasRef = useRef<IdeaRecommendation[]>([]);
  const savedTitlesRef = useRef<string[]>([]);

  const [ideas, setIdeas] = useState<IdeaRecommendation[]>([]);
  const [savedTitles, setSavedTitles] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [lastInstructions, setLastInstructions] = useState("");
  const [detailIdea, setDetailIdea] = useState<IdeaRecommendation | null>(null);
  const [feedbackIdea, setFeedbackIdea] = useState<IdeaRecommendation | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [selectedDetailRouteIndex, setSelectedDetailRouteIndex] = useState(0);
  const [isSavingDetailIdea, setIsSavingDetailIdea] = useState(false);

  const activeClientName = clientName || "";
  const activeProductFocus = productFocus || "";
  const hasIdeas = ideas.length > 0;

  useEffect(() => {
    ideasRef.current = ideas;
    cacheVisualRoutesForIdeas(ideas);
  }, [ideas]);

  useEffect(() => {
    savedTitlesRef.current = savedTitles;
  }, [savedTitles]);

  useEffect(() => {
    onHasIdeasChange?.(hasIdeas);
  }, [hasIdeas, onHasIdeasChange]);

  useEffect(() => {
    setSelectedDetailRouteIndex(0);
  }, [detailIdea]);

  const stopTaskPolling = useCallback(() => {
    if (taskPollingRef.current) {
      clearInterval(taskPollingRef.current);
      taskPollingRef.current = null;
    }
    if (taskTimeoutRef.current) {
      clearTimeout(taskTimeoutRef.current);
      taskTimeoutRef.current = null;
    }
  }, []);

  const handleNewSession = useCallback(() => {
    stopTaskPolling();
    taskContextRef.current = null;
    setCurrentTaskId(null);
    setIsGenerating(false);
    setIsLoadingMore(false);
    setDetailIdea(null);
    setFeedbackIdea(null);
    setIsFeedbackOpen(false);
    setIdeas([]);
    ideasRef.current = [];
    setLastInstructions("");

    const params = new URLSearchParams(searchParams.toString());
    params.delete("ideaSessionId");
    params.set("newSession", "1");
    if (activeClientName && activeClientName !== "No Client Selected") {
      params.set("clientName", activeClientName);
    }
    if (activeProductFocus) {
      params.set("productFocus", activeProductFocus);
    }

    router.push(`/?${params.toString()}`);
  }, [activeClientName, activeProductFocus, router, searchParams, stopTaskPolling]);

  const fetchSavedTitles = useCallback(async () => {
    if (!activeClientName || !activeProductFocus) return;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(
        `/api/save-idea?clientName=${encodeURIComponent(activeClientName)}&productFocus=${encodeURIComponent(activeProductFocus)}`,
        {
          cache: "no-store",
          signal: controller.signal,
        },
      );
      if (!response.ok) return;
      const data = await response.json();
      setSavedTitles(Array.isArray(data.savedTitles) ? data.savedTitles : []);
    } catch {
      setSavedTitles([]);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, [activeClientName, activeProductFocus]);

  const loadSessionIdeas = useCallback((session: SessionHistoryRecord) => {
    const sourceIdeas = Array.isArray(session?.n8nResponse?.ideas)
      ? session.n8nResponse.ideas
      : Array.isArray(session?.ideas)
        ? session.ideas
        : [];

    if (sourceIdeas.length === 0) return false;

    const normalizedIdeas = sourceIdeas.map(normalizeIdea);
    setIdeas(normalizedIdeas);
    ideasRef.current = normalizedIdeas;
    setLastInstructions(session.userInput || "");
    return true;
  }, []);

  const loadSelectedSessionIdeas = useCallback(async () => {
    if (!selectedSessionId) return false;

    const params = new URLSearchParams({
      ideaSessionId: selectedSessionId,
      limit: "1",
      offset: "0",
      _ts: String(Date.now()),
    });
    const response = await fetch(`/api/session-history?${params.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) return false;
    const result = await response.json();
    const session = result?.success && Array.isArray(result.sessions) ? result.sessions[0] : null;
    return session ? loadSessionIdeas(session) : false;
  }, [loadSessionIdeas, selectedSessionId]);

  const processTaskResult = useCallback(
    (result: TaskResultPayload, context: TaskContext) => {
      const rawIdeas: unknown[] = Array.isArray(result?.ideas)
        ? result.ideas
        : Array.isArray(result?.data?.ideas)
          ? result.data.ideas
          : [];
      const normalizedIdeas = rawIdeas.map(normalizeIdea);

      if (normalizedIdeas.length === 0) {
        alert(IDEA_GENERATION_FAILED_MESSAGE);
        setIsGenerating(false);
        setIsLoadingMore(false);
        setCurrentTaskId(null);
        taskContextRef.current = null;
        stopTaskPolling();
        return;
      }

      const nextIdeas =
        context.mode === "append"
          ? (() => {
              const existing = new Set(ideasRef.current.map((idea) => idea.concept_idea || idea.title || ""));
              const freshIdeas = normalizedIdeas.filter((idea) => {
                const key = idea.concept_idea || idea.title || "";
                if (!key || existing.has(key)) return false;
                existing.add(key);
                return true;
              });
              return [...ideasRef.current, ...freshIdeas];
            })()
          : normalizedIdeas;

      setIdeas(nextIdeas);
      ideasRef.current = nextIdeas;

      if (context.clientName && context.productFocus && nextIdeas.length > 0) {
        sessionManager.saveSession({
          clientName: context.clientName,
          productFocus: context.productFocus,
          n8nResponse: result?.n8nResponse || { ideas: nextIdeas },
          userInput: context.instructions,
          modelUsed: "gemini-2.5-pro",
        }).catch((error) => {
          console.warn("[ConceptMode] Failed to save idea session:", error);
        });
      }

      setLastInstructions(context.instructions);
      setIsGenerating(false);
      setIsLoadingMore(false);
      setCurrentTaskId(null);
      taskContextRef.current = null;
      stopTaskPolling();
      void fetchSavedTitles();
    },
    [fetchSavedTitles, stopTaskPolling],
  );

  useEffect(() => {
    setIdeas([]);
    ideasRef.current = [];
    setLastInstructions("");
    stopTaskPolling();
    taskContextRef.current = null;
    setCurrentTaskId(null);
    setIsGenerating(false);
    setIsLoadingMore(false);
    void fetchSavedTitles();
    // Default view is the generate-ideas chat. Past ideas only load when the user explicitly
    // opens a session from the history sidebar (ideaSessionId in the URL).
    if (selectedSessionId && !startNewSession) {
      void loadSelectedSessionIdeas();
    }
  }, [
    activeClientName,
    activeProductFocus,
    fetchSavedTitles,
    loadSelectedSessionIdeas,
    selectedSessionId,
    startNewSession,
    stopTaskPolling,
  ]);

  useEffect(() => stopTaskPolling, [stopTaskPolling]);

  const startTaskPolling = useCallback(
    (taskId: string) => {
      stopTaskPolling();

      const poll = async () => {
        try {
          const response = await fetch(`/api/generate-ideas/status?taskId=${taskId}`);
          const data = await response.json();

          if (!data.success) {
            throw new Error(data.error || "Failed to fetch task status");
          }

          if (data.status === "completed") {
            const context = taskContextRef.current;
            if (context) {
              processTaskResult(data.result, context);
            }
            return;
          }

          if (data.status === "failed") {
            alert(data.error || IDEA_GENERATION_FAILED_MESSAGE);
            setIsGenerating(false);
            setIsLoadingMore(false);
            setCurrentTaskId(null);
            taskContextRef.current = null;
            stopTaskPolling();
          }
        } catch (error) {
          console.error("[ConceptMode] Polling failed:", error);
        }
      };

      void poll();
      taskPollingRef.current = setInterval(poll, 4000);
      taskTimeoutRef.current = setTimeout(() => {
        alert("เจนไอเดียไม่สำเร็จ: ใช้เวลาเกิน 10 นาที กรุณาลองใหม่อีกครั้ง");
        setIsGenerating(false);
        setIsLoadingMore(false);
        setCurrentTaskId(null);
        taskContextRef.current = null;
        stopTaskPolling();
      }, 10 * 60 * 1000);
    },
    [processTaskResult, stopTaskPolling],
  );

  // The idea-generation webhook is text-only, so an attached image goes through a
  // vision model first and its description is merged into the user brief.
  const describeAttachedImage = async (file: File) => {
    const imageDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
      reader.readAsDataURL(file);
    });

    const response = await fetch("/api/describe-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl }),
    });
    const data = await response.json();

    if (!response.ok || !data.success || !data.description) {
      throw new Error(data.error || "ไม่สามารถวิเคราะห์รูปที่แนบได้");
    }

    return data.description as string;
  };

  const requestIdeaGeneration = async (
    instructions: string,
    mode: "initial" | "append",
    files?: File[],
  ) => {
    if (!activeClientName || activeClientName === "No Client Selected") {
      alert("กรุณาเลือกลูกค้าก่อน");
      return;
    }
    if (!activeProductFocus) {
      alert("กรุณาเลือก Product Focus ก่อน");
      return;
    }

    setIsGenerating(mode === "initial");
    setIsLoadingMore(true);
    stopTaskPolling();

    let finalInstructions = instructions.trim() || " ";
    const attachedImage = files?.find((file) => file.type.startsWith("image/"));
    if (attachedImage) {
      try {
        const imageDescription = await describeAttachedImage(attachedImage);
        finalInstructions = [
          instructions.trim(),
          `[คำอธิบายรูปภาพที่ผู้ใช้แนบมา — ใช้เป็นบริบทอ้างอิงประกอบ brief]\n${imageDescription}`,
        ]
          .filter(Boolean)
          .join("\n\n");
      } catch (error) {
        console.error("[ConceptMode] Failed to describe attached image:", error);
        alert(error instanceof Error ? error.message : "ไม่สามารถวิเคราะห์รูปที่แนบได้ กรุณาลองใหม่");
        setIsGenerating(false);
        setIsLoadingMore(false);
        return;
      }
    }

    const existingConceptIdeas =
      mode === "append" ? ideas.map((idea) => idea.concept_idea).filter(Boolean) : undefined;

    try {
      const response = await fetch("/api/generate-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: activeClientName,
          productFocus: activeProductFocus,
          service: "",
          instructions: finalInstructions,
          model: "gemini-2.5-pro",
          existingConceptIdeas,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success || !data.taskId) {
        alert(data.error || "เกิดข้อผิดพลาดในการเริ่มการสร้างไอเดีย");
        setIsGenerating(false);
        setIsLoadingMore(false);
        return;
      }

      taskContextRef.current = {
        mode,
        instructions: finalInstructions,
        clientName: activeClientName,
        productFocus: activeProductFocus,
        existingConceptIdeas,
      };
      setCurrentTaskId(data.taskId);
      startTaskPolling(data.taskId);
    } catch (error) {
      console.error("[ConceptMode] Failed to start idea generation:", error);
      alert("เกิดข้อผิดพลาดในการสร้างไอเดีย กรุณาลองใหม่อีกครั้ง");
      setIsGenerating(false);
      setIsLoadingMore(false);
    }
  };

  const handleSaveIdea = useCallback((idea: IdeaRecommendation, index: number) => {
    if (!activeClientName || !activeProductFocus) return;

    const isSaved = savedTitlesRef.current.includes(idea.title);
    const action = isSaved ? "unsave" : "save";
    setSavedTitles((currentTitles) =>
      action === "save"
        ? [...currentTitles, idea.title]
        : currentTitles.filter((title) => title !== idea.title),
    );

    fetch("/api/save-idea", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idea,
        clientName: activeClientName,
        productFocus: activeProductFocus,
        action,
      }),
    }).catch((error) => {
      console.error("[ConceptMode] Background save failed:", error, index);
    });
  }, [activeClientName, activeProductFocus]);

  const ensureIdeaSaved = async (idea: IdeaRecommendation) => {
    if (savedTitles.includes(idea.title)) return;
    if (!activeClientName || !activeProductFocus) {
      throw new Error("กรุณาเลือกลูกค้าและ Product Focus ก่อน");
    }

    const response = await fetch("/api/save-idea", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idea,
        clientName: activeClientName,
        productFocus: activeProductFocus,
        action: "save",
      }),
    });
    const result = await response.json();

    if (!response.ok || result?.success === false) {
      throw new Error(result?.error || "ไม่สามารถบันทึกไอเดียได้");
    }

    setSavedTitles((currentTitles) =>
      currentTitles.includes(idea.title) ? currentTitles : [...currentTitles, idea.title],
    );
  };

  const handleSaveDetailIdea = async () => {
    if (!detailIdea || savedTitles.includes(detailIdea.title)) return;

    setIsSavingDetailIdea(true);
    try {
      await ensureIdeaSaved(detailIdea);
    } catch (error) {
      console.error("[ConceptMode] Save idea failed:", error);
      alert(error instanceof Error ? error.message : "ไม่สามารถบันทึกไอเดียได้");
    } finally {
      setIsSavingDetailIdea(false);
    }
  };

  const handleUseDetailIdeaForImage = async () => {
    if (!detailIdea) return;

    setIsSavingDetailIdea(true);
    try {
      await ensureIdeaSaved(detailIdea);
      const idea = detailIdea;
      const visualRouteIndex = idea.visual_routes?.length ? selectedDetailRouteIndex : null;
      setDetailIdea(null);
      onUseIdeaForImage?.(idea, visualRouteIndex);
    } catch (error) {
      console.error("[ConceptMode] Use idea for image failed:", error);
      alert(error instanceof Error ? error.message : "ไม่สามารถส่งไอเดียไปสร้างภาพได้");
    } finally {
      setIsSavingDetailIdea(false);
    }
  };

  const handleFeedback = useCallback((idea: IdeaRecommendation) => {
    setFeedbackIdea(idea);
    setIsFeedbackOpen(true);
  }, []);

  const handleShareIdea = useCallback(async (idea: IdeaRecommendation) => {
    if (!activeClientName || !activeProductFocus) {
      alert("กรุณาเลือกลูกค้าและ Product Focus ก่อนแชร์");
      return;
    }

    try {
      const response = await fetch("/api/share-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideas: [idea],
          clientName: activeClientName,
          productFocus: activeProductFocus,
          instructions: `Individual idea: ${idea.title}`,
          model: "gemini-2.5-pro",
        }),
      });
      const data = await response.json();
      if (!data.success) {
        alert(data.error || "เกิดข้อผิดพลาดในการสร้างลิงก์แชร์");
        return;
      }
      await navigator.clipboard.writeText(data.shareUrl);
      alert("คัดลอกลิงก์แชร์แล้ว");
    } catch (error) {
      console.error("[ConceptMode] Share failed:", error);
      alert("เกิดข้อผิดพลาดในการสร้างลิงก์แชร์");
    }
  }, [activeClientName, activeProductFocus]);

  return (
    <section className="mx-auto flex w-full max-w-none flex-col gap-4 pb-2">
      {!hasIdeas && (
        <div className="mx-auto w-full max-w-5xl">
          <PromptInputBox
            isLoading={isGenerating || isLoadingMore}
            onSend={(message, files) => void requestIdeaGeneration(message, "initial", files)}
            placeholder="พิมพ์โจทย์หรือ direction สำหรับ generate concept ideas..."
            showUtilityControls={false}
            primaryActionLabel="Generate Ideas"
            allowEmptySubmit
            className="flex min-h-[108px] flex-col justify-between !border-black/10 !bg-white !shadow-[0_16px_48px_rgba(15,23,42,0.10)] sm:min-h-[116px]"
          />
        </div>
      )}

      {(isGenerating || isLoadingMore || currentTaskId) && (
        <div className="mx-auto flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[#667085] shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          AI กำลังคิดและสร้างไอเดียให้คุณ อาจใช้เวลาสักครู่...
        </div>
      )}

      {hasIdeas && (
        <div className="space-y-4">
          <div className="sticky top-0 z-10 flex flex-col gap-3 rounded-[22px] border border-black/10 bg-white/95 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1f1f1f]">{ideas.length} concept ideas</p>
              {lastInstructions && <p className="mt-1 line-clamp-1 text-xs text-[#667085]">{lastInstructions}</p>}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleNewSession}
              disabled={isGenerating || isLoadingMore}
              className="rounded-full border-black/10 bg-white"
            >
              <Plus className="h-4 w-4" />
              New Session
            </Button>
          </div>

          <div className="grid gap-4 pb-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {ideas.map((idea, index) => (
              <IdeaCard
                key={`${idea.title}-${index}`}
                topic={idea}
                index={index}
                isSaved={savedTitles.includes(idea.title)}
                showVisualRoutePreview={false}
                onDetailClick={setDetailIdea}
                onSaveClick={handleSaveIdea}
                onFeedback={handleFeedback}
                onShare={handleShareIdea}
              />
            ))}
          </div>
        </div>
      )}

      <Dialog open={Boolean(detailIdea)} onOpenChange={(open) => {
        if (!open) setDetailIdea(null);
      }}>
        <DialogContent className="max-h-[86vh] max-w-3xl overflow-y-auto rounded-[24px] border-black/10 bg-white p-0 shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
          {detailIdea && (
            <div className="p-6">
              <div className="sticky top-0 z-10 -mx-6 -mt-6 mb-6 border-b border-black/10 bg-white/95 px-6 py-5 backdrop-blur">
                <DialogHeader className="pr-10">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {detailIdea.concept_type && (
                      <Badge className="rounded-full bg-[#1f1f1f] text-white">{detailIdea.concept_type}</Badge>
                    )}
                    {detailIdea.content_pillar && (
                      <Badge variant="outline" className="rounded-full border-black/10 bg-white">
                        {detailIdea.content_pillar}
                      </Badge>
                    )}
                  </div>
                  <DialogTitle className="text-2xl font-semibold leading-tight text-[#111827]">
                    {detailIdea.title || detailIdea.concept_idea || "Concept idea"}
                  </DialogTitle>
                </DialogHeader>
              </div>

              <div className="mt-6 space-y-5 text-sm text-[#475467]">
                {detailIdea.copywriting?.headline && (
                  <section className="rounded-2xl border border-black/10 bg-[#f8fafc] p-4">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#667085]">
                      Headline
                    </p>
                    <p className="text-base font-semibold leading-relaxed text-[#111827]">
                      {detailIdea.copywriting.headline}
                    </p>
                  </section>
                )}

                {getIdeaDescription(detailIdea) && (
                  <section>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#667085]">
                      Description
                    </p>
                    <p className="whitespace-pre-line leading-relaxed">{getIdeaDescription(detailIdea)}</p>
                  </section>
                )}

                {detailIdea.concept_idea && (
                  <section>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#667085]">
                      Core Concept
                    </p>
                    <p className="leading-relaxed">{detailIdea.concept_idea}</p>
                  </section>
                )}

                {detailIdea.copywriting && (
                  <section className="rounded-2xl border border-black/10 p-4">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#667085]">
                      Copywriting
                    </p>
                    <div className="space-y-2">
                      {detailIdea.copywriting.sub_headline_1 && (
                        <p><span className="font-semibold text-[#111827]">Sub headline 1:</span> {detailIdea.copywriting.sub_headline_1}</p>
                      )}
                      {detailIdea.copywriting.sub_headline_2 && (
                        <p><span className="font-semibold text-[#111827]">Sub headline 2:</span> {detailIdea.copywriting.sub_headline_2}</p>
                      )}
                      {detailIdea.copywriting.cta && (
                        <p><span className="font-semibold text-[#111827]">CTA:</span> {detailIdea.copywriting.cta}</p>
                      )}
                    </div>
                  </section>
                )}

                {detailIdea.visual_routes && detailIdea.visual_routes.length > 0 && (
                  <section>
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#667085]">
                      Visual Routes
                    </p>
                    <div className="grid gap-3">
                      {detailIdea.visual_routes.map((route, index) => (
                        <button
                          key={`${route.route_name || "route"}-${index}`}
                          type="button"
                          onClick={() => setSelectedDetailRouteIndex(index)}
                          className={[
                            "rounded-2xl border bg-white p-4 text-left transition",
                            selectedDetailRouteIndex === index
                              ? "border-blue-500 ring-2 ring-blue-500/15"
                              : "border-black/10 hover:border-black/20",
                          ].join(" ")}
                        >
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-[#111827]">{route.route_name || `Route ${index + 1}`}</p>
                            {route.route_type && (
                              <Badge variant="outline" className="rounded-full border-black/10">
                                {route.route_type}
                              </Badge>
                            )}
                            {selectedDetailRouteIndex === index && (
                              <Badge className="rounded-full bg-blue-600 text-white">Selected</Badge>
                            )}
                          </div>
                          {route.visual_idea && <p className="leading-relaxed">{route.visual_idea}</p>}
                          {route.why_it_fits && (
                            <p className="mt-2 leading-relaxed text-[#667085]">
                              <span className="font-semibold text-[#111827]">Why:</span> {route.why_it_fits}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <div className="sticky bottom-0 z-10 -mx-6 -mb-6 mt-6 border-t border-black/10 bg-white/95 px-6 py-4 backdrop-blur">
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleSaveDetailIdea()}
                    disabled={isSavingDetailIdea || savedTitles.includes(detailIdea.title)}
                    className="rounded-full border-black/10 bg-white"
                  >
                    {isSavingDetailIdea ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : savedTitles.includes(detailIdea.title) ? (
                      <BookmarkCheck className="h-4 w-4" />
                    ) : (
                      <Bookmark className="h-4 w-4" />
                    )}
                    {savedTitles.includes(detailIdea.title) ? "Saved" : "Save Idea"}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleUseDetailIdeaForImage()}
                    disabled={isSavingDetailIdea}
                    className="rounded-full bg-[#1f1f1f] text-white hover:bg-black"
                  >
                    {isSavingDetailIdea ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Use to Generate Image
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <FeedbackForm
        isOpen={isFeedbackOpen}
        onClose={() => {
          setIsFeedbackOpen(false);
          setFeedbackIdea(null);
        }}
        idea={feedbackIdea}
        clientName={activeClientName}
        productFocus={activeProductFocus}
      />
    </section>
  );
}
