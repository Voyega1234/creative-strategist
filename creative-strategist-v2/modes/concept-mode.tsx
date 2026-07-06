"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bookmark, BookmarkCheck, FileDown, Loader2, Minus, Plus, Sparkles } from "lucide-react";

import { FeedbackForm } from "@/components/feedback-form";
import { IdeaCard } from "@/components/ideas/idea-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { PromptInputBox } from "@/creative-strategist-v2/chat-model";
import { IDEA_GENERATION_FAILED_MESSAGE } from "@/lib/ideas/generation-response";
import { normalizeIdea } from "@/lib/ideas/idea-normalization";
import { getIdeaSelectionKey, VISUAL_ROUTES_BY_IDEA_STORAGE_KEY } from "@/lib/ideas/idea-storage";
import type { IdeaContentType, IdeaRecommendation, IdeaSelectionStatus } from "@/lib/ideas/types";
import { sessionManager } from "@/lib/session-manager";

// "Other options" (PDF page 2) is capped so CS proposes only a few backups beyond the quota.
const MAX_OTHER_OPTIONS = 3;
const CONTENT_TYPE_STORAGE_PREFIX = "cvc-idea-content-types";
const CONCEPT_BRIEF_DRAFT_STORAGE_KEY = "cvc-generate-concept-brief-draft";
const GENERATION_CONTENT_TYPES = ["STATIC AD", "UGC VIDEO", "SHORT VIDEO", "ALBUM AD"] as const;
const DEFAULT_CONTENT_TYPE_QUOTAS = {
  "STATIC AD": 0,
  "UGC VIDEO": 0,
  "SHORT VIDEO": 0,
  "ALBUM AD": 0,
} satisfies Record<GenerationContentType, number>;
const THAI_OUTPUT_INSTRUCTION =
  "[ข้อกำหนดภาษา] เขียนเนื้อหาที่ผู้ใช้อ่านทั้งหมดเป็นภาษาไทย รวมถึง Hook, Subheadline, Concept, Why, Content pillar, CTA และ Tags โดยคงชื่อแบรนด์หรือศัพท์เฉพาะที่จำเป็นไว้ได้";

type GenerationContentType = (typeof GENERATION_CONTENT_TYPES)[number];
type ContentTypeQuotas = Record<GenerationContentType, number>;

function getContentTypeStorageKey(clientName: string, productFocus: string) {
  return `${CONTENT_TYPE_STORAGE_PREFIX}:${clientName.trim().toLowerCase()}:${productFocus.trim().toLowerCase()}`;
}

function loadSavedContentTypes(clientName: string, productFocus: string) {
  if (typeof window === "undefined" || !clientName) return {} as Record<string, IdeaContentType>;
  try {
    const value = window.localStorage.getItem(getContentTypeStorageKey(clientName, productFocus));
    return value ? JSON.parse(value) as Record<string, IdeaContentType> : {};
  } catch {
    return {} as Record<string, IdeaContentType>;
  }
}

function applySavedContentTypes(
  ideas: IdeaRecommendation[],
  clientName: string,
  productFocus: string,
) {
  const savedTypes = loadSavedContentTypes(clientName, productFocus);
  return ideas.map((idea) => {
    const key = getIdeaSelectionKey(idea);
    return key && savedTypes[key]
      ? { ...idea, content_type: savedTypes[key] }
      : idea;
  });
}

function getContentTypeValidationKey(idea: IdeaRecommendation) {
  return getIdeaSelectionKey(idea) || idea.copywriting?.headline || idea.concept_idea || idea.title;
}

function getActiveContentTypeQuotas(quotas: ContentTypeQuotas) {
  return GENERATION_CONTENT_TYPES
    .map((type) => ({ type, count: Math.max(0, Math.floor(quotas[type] || 0)) }))
    .filter((item) => item.count > 0);
}

function buildContentTypeQuotaInstruction(quotas: ContentTypeQuotas) {
  const activeQuotas = getActiveContentTypeQuotas(quotas);
  if (!activeQuotas.length) return "";

  const total = activeQuotas.reduce((sum, item) => sum + item.count, 0);
  const quotaText = activeQuotas.map((item) => `${item.type}: ${item.count}`).join(", ");

  return `[ข้อกำหนดจำนวนและ Content Type] สร้างไอเดียรวม ${total} ไอเดียตามจำนวนนี้เท่านั้น: ${quotaText}. ใส่ field content_type ให้ตรงกับประเภทของแต่ละไอเดีย และห้ามสร้าง content type อื่นนอกเหนือจากรายการนี้.`;
}

function ContentTypeQuotaPicker({
  quotas,
  onChange,
}: {
  quotas: ContentTypeQuotas;
  onChange: (quotas: ContentTypeQuotas) => void;
}) {
  const activeQuotas = getActiveContentTypeQuotas(quotas);
  const total = activeQuotas.reduce((sum, item) => sum + item.count, 0);

  const updateQuota = (type: GenerationContentType, count: number) => {
    onChange({
      ...quotas,
      [type]: Math.max(0, Math.min(20, Math.floor(Number.isFinite(count) ? count : 0))),
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 text-xs font-semibold text-[#344054] transition-colors hover:bg-black/[0.03]"
        >
          <Plus className="h-3.5 w-3.5 text-[#1d4ed8]" />
          <span>Content types</span>
          {total > 0 && (
            <span className="rounded-full bg-[#eff6ff] px-1.5 py-0.5 text-[11px] font-bold text-[#1d4ed8]">
              {total}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-[330px] rounded-2xl border-[#e4e7ec] bg-white p-3 shadow-[0_18px_40px_rgba(16,24,40,0.16)]">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#101828]">Content type quota</p>
            <p className="mt-0.5 text-xs font-medium text-[#667085]">เลือกประเภทและจำนวนที่อยาก generate</p>
          </div>
          {total > 0 && (
            <button
              type="button"
              onClick={() => onChange({ ...DEFAULT_CONTENT_TYPE_QUOTAS })}
              className="rounded-full px-2 py-1 text-xs font-semibold text-[#667085] hover:bg-[#f2f4f7]"
            >
              Clear
            </button>
          )}
        </div>

        <div className="space-y-2">
          {GENERATION_CONTENT_TYPES.map((type) => {
            const count = quotas[type] || 0;
            const isActive = count > 0;

            return (
              <div
                key={type}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
                  isActive ? "border-[#bfdbfe] bg-[#eff6ff]" : "border-[#e4e7ec] bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => updateQuota(type, isActive ? 0 : 1)}
                  className={`min-w-0 flex-1 truncate text-left text-sm font-bold ${
                    isActive ? "text-[#1d4ed8]" : "text-[#344054]"
                  }`}
                >
                  {type}
                </button>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => updateQuota(type, count - 1)}
                    disabled={count <= 0}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-[#d0d5dd] bg-white text-[#475467] disabled:opacity-35"
                    aria-label={`Decrease ${type}`}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    value={count}
                    onChange={(event) => updateQuota(type, Number(event.target.value))}
                    className="h-7 w-12 rounded-lg px-1.5 text-center text-sm font-bold"
                    aria-label={`${type} count`}
                  />
                  <button
                    type="button"
                    onClick={() => updateQuota(type, count + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-[#bfdbfe] bg-white text-[#1d4ed8]"
                    aria-label={`Increase ${type}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {total > 0 && (
          <p className="mt-3 rounded-xl bg-[#f8fafc] px-3 py-2 text-xs font-semibold text-[#475467]">
            รวม {total} ไอเดีย: {activeQuotas.map((item) => `${item.type} ${item.count}`).join(" · ")}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Plays the app's notification sound when idea generation finishes. Uses the same asset and
// Web-Audio fallback as the other pages (new-client / renew). Never breaks the flow if blocked.
function playGenerationDoneSound() {
  try {
    const audio = new Audio("/new-notification-011-364050.mp3");
    audio.volume = 0.8;
    audio.play().catch(() => {
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.setValueAtTime(600, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(800, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      } catch {
        // Fallback unavailable — ignore.
      }
    });
  } catch {
    // Audio not available — ignore.
  }
}

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
  recommendations?: unknown[];
  n8nResponse?: unknown;
  data?: {
    ideas?: unknown[];
    recommendations?: unknown[];
  };
};

type NormalizedN8nIdeaExtra = {
  product_service_focus?: string;
  strategic_angle?: string;
  format_execution?: string;
  why_this_concept?: string;
  creative_direction?: {
    main_visual_or_scene?: string;
    layout_or_sequence?: string;
    production_notes?: string;
  };
};

type NormalizedIdea = IdeaRecommendation & NormalizedN8nIdeaExtra;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function extractRawIdeas(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload.flatMap((item) => extractRawIdeas(item));
  }

  if (!isRecord(payload)) return [];

  if (Array.isArray(payload.ideas)) return payload.ideas;
  if (Array.isArray(payload.recommendations)) return payload.recommendations;

  const dataIdeas = extractRawIdeas(payload.data);
  if (dataIdeas.length) return dataIdeas;

  return extractRawIdeas(payload.n8nResponse);
}

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

function getIdeaWhy(idea: IdeaRecommendation | null) {
  if (!idea) return "";
  const extendedIdea = idea as NormalizedIdea;
  if (extendedIdea.why_this_concept) return extendedIdea.why_this_concept;
  if (idea.competitiveGap) return idea.competitiveGap;

  const description = idea.description;
  if (Array.isArray(description)) {
    const priorityItem =
      description.find((item) => item.label === "Why this converts" || item.label === "Evidence/Counterpoint") ||
      null;
    if (priorityItem?.text) return priorityItem.text;
  }

  if (description && typeof description === "object" && !Array.isArray(description)) {
    const whySection = description.sections?.find((section) => section.group === "why_evidence");
    if (whySection?.bullets?.length) return whySection.bullets.join("\n");
  }

  return idea.visual_routes?.find((route) => route.why_it_fits)?.why_it_fits || "";
}

function getIdeaExtra(idea: IdeaRecommendation | null) {
  return (idea || {}) as NormalizedIdea;
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
  const [otherTitles, setOtherTitles] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [lastInstructions, setLastInstructions] = useState("");
  const [detailIdea, setDetailIdea] = useState<IdeaRecommendation | null>(null);
  const [feedbackIdea, setFeedbackIdea] = useState<IdeaRecommendation | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [selectedDetailRouteIndex, setSelectedDetailRouteIndex] = useState(0);
  const [isSavingDetailIdea, setIsSavingDetailIdea] = useState(false);
  const [isExportingNativePdf, setIsExportingNativePdf] = useState(false);
  const [isExportingReviewPdf, setIsExportingReviewPdf] = useState(false);
  const [isImportIdeasOpen, setIsImportIdeasOpen] = useState(false);
  const [importIdeasText, setImportIdeasText] = useState("");
  const [isImportingIdeas, setIsImportingIdeas] = useState(false);
  const [importIdeasError, setImportIdeasError] = useState("");
  const [contentTypeWarnings, setContentTypeWarnings] = useState<Set<string>>(new Set());
  const [contentTypeQuotas, setContentTypeQuotas] = useState<ContentTypeQuotas>({ ...DEFAULT_CONTENT_TYPE_QUOTAS });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState({ hook: "", subheadline: "", cta: "", concept: "", why: "" });

  const activeClientName = clientName || "";
  const activeProductFocus = productFocus || "";
  const hasIdeas = ideas.length > 0;
  const savedCount = ideas.filter((idea) => savedTitles.includes(idea.title)).length;
  const otherCount = ideas.filter((idea) => otherTitles.includes(idea.title)).length;

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
    setOtherTitles([]);
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
    const sourceIdeas = extractRawIdeas(session);

    if (sourceIdeas.length === 0) return false;

    const normalizedIdeas = applySavedContentTypes(
      sourceIdeas.map(normalizeIdea),
      activeClientName,
      activeProductFocus,
    );
    setIdeas(normalizedIdeas);
    ideasRef.current = normalizedIdeas;
    setLastInstructions(session.userInput || "");
    return true;
  }, [activeClientName, activeProductFocus]);

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
      const rawIdeas = extractRawIdeas(result);
      const normalizedIdeas = applySavedContentTypes(
        rawIdeas.map(normalizeIdea),
        activeClientName,
        activeProductFocus,
      );

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
      playGenerationDoneSound();
      void fetchSavedTitles();
    },
    [activeClientName, activeProductFocus, fetchSavedTitles, stopTaskPolling],
  );

  useEffect(() => {
    setIdeas([]);
    ideasRef.current = [];
    setOtherTitles([]);
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

  const isBriefDocumentFile = (file: File) => {
    if (file.type.startsWith("image/")) return false;
    const extension = file.name.split(".").pop()?.toLowerCase();
    return (
      file.type === "application/pdf" ||
      file.type === "text/plain" ||
      file.type === "text/csv" ||
      file.type === "application/csv" ||
      file.type === "application/vnd.ms-excel" ||
      extension === "pdf" ||
      extension === "txt" ||
      extension === "csv"
    );
  };

  const extractAttachedBriefFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/brief-file/extract", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    if (!response.ok || !data.success || !data.text) {
      throw new Error(data.error || "ไม่สามารถอ่านไฟล์ brief ที่แนบได้");
    }

    return data.text as string;
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
    const attachedBriefFile = files?.find(isBriefDocumentFile);
    const attachedContexts: string[] = [];

    if (attachedBriefFile) {
      try {
        const briefText = await extractAttachedBriefFile(attachedBriefFile);
        attachedContexts.push(
          `[ข้อมูลจากไฟล์ brief ที่ผู้ใช้แนบมา — ใช้เป็น input หลักประกอบการ generate]\n${briefText}`,
        );
      } catch (error) {
        console.error("[ConceptMode] Failed to extract attached brief file:", error);
        alert(error instanceof Error ? error.message : "ไม่สามารถอ่านไฟล์ brief ที่แนบได้ กรุณาลองใหม่");
        setIsGenerating(false);
        setIsLoadingMore(false);
        return;
      }
    }

    if (attachedImage) {
      try {
        const imageDescription = await describeAttachedImage(attachedImage);
        attachedContexts.push(
          `[คำอธิบายรูปภาพที่ผู้ใช้แนบมา — ใช้เป็นบริบทอ้างอิงประกอบ brief]\n${imageDescription}`,
        );
      } catch (error) {
        console.error("[ConceptMode] Failed to describe attached image:", error);
        alert(error instanceof Error ? error.message : "ไม่สามารถวิเคราะห์รูปที่แนบได้ กรุณาลองใหม่");
        setIsGenerating(false);
        setIsLoadingMore(false);
        return;
      }
    }

    if (attachedContexts.length > 0) {
      finalInstructions = [instructions.trim(), ...attachedContexts].filter(Boolean).join("\n\n");
    }

    const existingConceptIdeas =
      mode === "append" ? ideas.map((idea) => idea.concept_idea).filter(Boolean) : undefined;
    const contentTypeQuotaInstruction = buildContentTypeQuotaInstruction(contentTypeQuotas);
    const activeContentTypeQuotas = getActiveContentTypeQuotas(contentTypeQuotas);
    const requestedIdeaCount = activeContentTypeQuotas.reduce((sum, item) => sum + item.count, 0);
    const generationInstructions = [finalInstructions, contentTypeQuotaInstruction, THAI_OUTPUT_INSTRUCTION]
      .filter(Boolean)
      .join("\n\n");

    try {
      const response = await fetch("/api/generate-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: activeClientName,
          productFocus: activeProductFocus,
          service: "",
          instructions: generationInstructions,
          model: "gemini-2.5-pro",
          existingConceptIdeas,
          contentTypeQuotas: activeContentTypeQuotas,
          requestedIdeaCount: requestedIdeaCount || undefined,
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
    setContentTypeWarnings((current) => {
      const next = new Set(current);
      next.delete(getContentTypeValidationKey(idea));
      return next;
    });
    setSavedTitles((currentTitles) =>
      action === "save"
        ? [...currentTitles, idea.title]
        : currentTitles.filter((title) => title !== idea.title),
    );
    // An idea is either Recommended (saved) or an Other option, never both.
    if (action === "save") {
      setOtherTitles((currentTitles) => currentTitles.filter((title) => title !== idea.title));
    }

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

  const handleEditIdea = useCallback((idea: IdeaRecommendation, index: number) => {
    setEditDraft({
      hook: idea.copywriting?.headline || idea.title || idea.concept_idea || "",
      subheadline: idea.copywriting?.sub_headline_1 || idea.copywriting?.sub_headline_2 || "",
      cta: idea.copywriting?.cta || "",
      concept: idea.title || idea.concept_idea || "",
      why: idea.competitiveGap || getIdeaDescription(idea) || "",
    });
    setEditingIndex(index);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingIndex === null) return;
    setIdeas((current) => {
      // Write each field to the property the card/export reads first, so edits always show.
      const next = current.map((idea, i) =>
        i !== editingIndex
          ? idea
          : {
              ...idea,
              title: editDraft.concept,
              competitiveGap: editDraft.why,
              copywriting: {
                ...idea.copywriting,
                headline: editDraft.hook,
                sub_headline_1: editDraft.subheadline,
                cta: editDraft.cta,
              },
            },
      );
      ideasRef.current = next;
      return next;
    });
    setEditingIndex(null);
  }, [editingIndex, editDraft]);

  const handleContentTypeChange = useCallback((index: number, contentType: IdeaContentType) => {
    const idea = ideasRef.current[index];
    setIdeas((current) => {
      const next = current.map((idea, ideaIndex) =>
        ideaIndex === index ? { ...idea, content_type: contentType } : idea,
      );
      ideasRef.current = next;
      return next;
    });
    if (idea) {
      setContentTypeWarnings((current) => {
        const next = new Set(current);
        next.delete(getContentTypeValidationKey({ ...idea, content_type: contentType }));
        next.delete(getContentTypeValidationKey(idea));
        return next;
      });
    }

    if (idea && typeof window !== "undefined") {
      const ideaKey = getIdeaSelectionKey(idea);
      if (ideaKey) {
        const savedTypes = loadSavedContentTypes(activeClientName, activeProductFocus);
        savedTypes[ideaKey] = contentType;
        window.localStorage.setItem(
          getContentTypeStorageKey(activeClientName, activeProductFocus),
          JSON.stringify(savedTypes),
        );
      }

      if (selectedSessionId) {
        const sessionIdeaKey = idea.copywriting?.headline || idea.concept_idea || idea.title || "";
        fetch("/api/session-history/content-type", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: selectedSessionId, ideaKey: sessionIdeaKey, contentType }),
        }).then((response) => {
          if (!response.ok) console.warn("[ConceptMode] Could not persist content type to session");
        }).catch((error) => {
          console.warn("[ConceptMode] Content type session save failed:", error);
        });
      }
    }
  }, [activeClientName, activeProductFocus, selectedSessionId]);

  const handleImportIdeas = useCallback(async () => {
    const inputText = importIdeasText.trim();
    if (!inputText || isImportingIdeas) return;

    setIsImportingIdeas(true);
    setImportIdeasError("");
    try {
      const response = await fetch("/api/parse-custom-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputText,
          clientName: activeClientName,
          productFocus: activeProductFocus,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Could not extract ideas.");

      const rawIdeas = Array.isArray(result?.ideas) ? result.ideas : result?.idea ? [result.idea] : [];
      const extractedIdeas = applySavedContentTypes(
        rawIdeas.map(normalizeIdea),
        activeClientName,
        activeProductFocus,
      );
      if (extractedIdeas.length === 0) throw new Error("No ideas were found in the pasted text.");

      const existingKeys = new Set(
        ideasRef.current.map((idea) => idea.copywriting?.headline || idea.concept_idea || idea.title || ""),
      );
      const uniqueIdeas = extractedIdeas.filter((idea) => {
        const key = idea.copywriting?.headline || idea.concept_idea || idea.title || "";
        if (!key || existingKeys.has(key)) return false;
        existingKeys.add(key);
        return true;
      });

      if (uniqueIdeas.length === 0) throw new Error("These ideas are already in the current list.");

      const nextIdeas = [...ideasRef.current, ...uniqueIdeas];
      setIdeas(nextIdeas);
      ideasRef.current = nextIdeas;
      setLastInstructions(inputText);
      setImportIdeasText("");
      setIsImportIdeasOpen(false);
      playGenerationDoneSound();
    } catch (error) {
      setImportIdeasError(error instanceof Error ? error.message : "Could not extract ideas.");
    } finally {
      setIsImportingIdeas(false);
    }
  }, [activeClientName, activeProductFocus, importIdeasText, isImportingIdeas]);

  const handleSelectionStatusChange = useCallback((
    idea: IdeaRecommendation,
    index: number,
    status: IdeaSelectionStatus,
  ) => {
    const isSaved = savedTitlesRef.current.includes(idea.title);
    setContentTypeWarnings((current) => {
      const next = new Set(current);
      next.delete(getContentTypeValidationKey(idea));
      return next;
    });

    if (status === "recommended") {
      setOtherTitles((current) => current.filter((title) => title !== idea.title));
      if (!isSaved) handleSaveIdea(idea, index);
      return;
    }

    if (isSaved) handleSaveIdea(idea, index);
    setOtherTitles((current) => {
      const withoutIdea = current.filter((title) => title !== idea.title);
      if (status === "option" && withoutIdea.length < MAX_OTHER_OPTIONS) {
        return [...withoutIdea, idea.title];
      }
      return withoutIdea;
    });
  }, [handleSaveIdea]);

  const validateSelectedIdeasContentType = useCallback(() => {
    const selectedWithoutContentType = ideas.filter(
      (idea) => (savedTitles.includes(idea.title) || otherTitles.includes(idea.title)) && !idea.content_type,
    );
    if (selectedWithoutContentType.length === 0) {
      setContentTypeWarnings(new Set());
      return true;
    }

    setContentTypeWarnings(new Set(selectedWithoutContentType.map(getContentTypeValidationKey)));
    return false;
  }, [ideas, savedTitles, otherTitles]);

  const handleExportNativePdf = useCallback(async () => {
    if (!validateSelectedIdeasContentType()) return;
    const recommended = ideas.filter((idea) => savedTitles.includes(idea.title));
    const other = ideas.filter((idea) => otherTitles.includes(idea.title));
    if (recommended.length === 0) return;

    setIsExportingNativePdf(true);
    try {
      const { exportIdeasNativeNumberedPdf } = await import("@/lib/ideas/export-ideas-native-pdf");
      await exportIdeasNativeNumberedPdf(recommended, other, `${activeClientName || "ideas"}-native-deliverable.pdf`);
    } catch (error) {
      console.error("[ConceptMode] Failed to export native PDF:", error);
      alert("ไม่สามารถสร้าง Native PDF ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsExportingNativePdf(false);
    }
  }, [ideas, savedTitles, otherTitles, activeClientName, validateSelectedIdeasContentType]);

  const handleExportReviewPdf = useCallback(async () => {
    const recommended = ideas.filter((idea) => savedTitles.includes(idea.title));
    const other = ideas.filter((idea) => otherTitles.includes(idea.title));
    if (recommended.length === 0 && other.length === 0) {
      alert("เลือก Recommended หรือ Option อย่างน้อย 1 อันก่อนสร้าง Review PDF");
      return;
    }

    setIsExportingReviewPdf(true);
    try {
      const highlightItems = [
        ...recommended.map((idea, index) => ({
          id: `recommended:${index}`,
          hook: idea.copywriting?.headline || idea.title || idea.concept_idea || "",
          subheadline: idea.copywriting?.sub_headline_1 || idea.copywriting?.sub_headline_2 || "",
          concept: idea.concept_idea || "",
          cta: idea.copywriting?.cta || "",
          why: idea.competitiveGap || getIdeaWhy(idea),
          tags: idea.tags || [],
        })),
        ...other.map((idea, index) => ({
          id: `option:${index}`,
          hook: idea.copywriting?.headline || idea.title || idea.concept_idea || "",
          subheadline: idea.copywriting?.sub_headline_1 || idea.copywriting?.sub_headline_2 || "",
          concept: idea.concept_idea || "",
          cta: idea.copywriting?.cta || "",
          why: idea.competitiveGap || getIdeaWhy(idea),
          tags: idea.tags || [],
        })),
      ].filter((item) => item.subheadline);
      let highlightMap: Record<string, string[]> = {};

      if (highlightItems.length > 0) {
        try {
          const response = await fetch("/api/idea-highlight-keywords", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: highlightItems }),
          });
          const payload = await response.json().catch(() => null);
          if (response.ok && payload?.highlights && typeof payload.highlights === "object") {
            highlightMap = payload.highlights;
          } else {
            console.warn("[ConceptMode] Gemini highlight fallback:", payload?.error || response.status);
          }
        } catch (highlightError) {
          console.warn("[ConceptMode] Gemini highlight fallback:", highlightError);
        }
      }

      const { exportIdeasReviewPdf } = await import("@/lib/ideas/export-ideas-review-pdf");
      await exportIdeasReviewPdf(
        [
          { heading: "Recommended topics", group: "recommended", ideas: recommended },
          { heading: "Other options", group: "option", ideas: other },
        ],
        `${activeClientName || "ideas"}-idea-review.pdf`,
        highlightMap,
      );
    } catch (error) {
      console.error("[ConceptMode] Failed to export review PDF:", error);
      alert("ไม่สามารถสร้าง Review PDF ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsExportingReviewPdf(false);
    }
  }, [ideas, savedTitles, otherTitles, activeClientName]);

  return (
    <section className="mx-auto flex w-full max-w-none flex-col gap-4 pb-2">
      {!hasIdeas && (
        <div className="mx-auto w-full max-w-5xl">
          <PromptInputBox
            isLoading={isGenerating || isLoadingMore}
            onSend={(message, files) => void requestIdeaGeneration(message, "initial", files)}
            placeholder="พิมพ์โจทย์หรือ direction สำหรับ generate concept ideas..."
            showUtilityControls={false}
            fileMode="brief-document"
            uploadTooltip="Upload brief file"
            persistInputKey={CONCEPT_BRIEF_DRAFT_STORAGE_KEY}
            preserveInputOnSend
            leftActionsAddon={
              <ContentTypeQuotaPicker
                quotas={contentTypeQuotas}
                onChange={setContentTypeQuotas}
              />
            }
            primaryActionLabel="Generate Ideas"
            allowEmptySubmit
            className="flex min-h-[108px] flex-col justify-between !border-black/10 !bg-white !shadow-[0_16px_48px_rgba(15,23,42,0.10)] sm:min-h-[116px]"
          />
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsImportIdeasOpen(true)}
              className="rounded-full border-black/10 bg-white"
            >
              <Plus className="h-4 w-4" />
              Add existing ideas
            </Button>
          </div>
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
              <p className="mt-1 text-xs font-medium text-[#1d4ed8]">
                Recommended {savedCount} · Options {otherCount}/{MAX_OTHER_OPTIONS}
              </p>
              {lastInstructions && <p className="mt-1 line-clamp-1 text-xs text-[#667085]">{lastInstructions}</p>}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsImportIdeasOpen(true)}
                disabled={isImportingIdeas}
                className="rounded-full border-black/10 bg-white"
              >
                <Plus className="h-4 w-4" />
                Add ideas
              </Button>
              <Button
                type="button"
                onClick={() => void handleExportNativePdf()}
                disabled={isExportingNativePdf || savedCount === 0}
                title={savedCount === 0
                  ? "เลือก Recommended อย่างน้อย 1 อันก่อน"
                  : `Recommended ${savedCount} · Other options ${otherCount}/${MAX_OTHER_OPTIONS}`}
                className="rounded-full bg-[#1d4ed8] text-white hover:bg-[#1d4ed8]/90"
              >
                <FileDown className="h-4 w-4" />
                {isExportingNativePdf ? "Exporting..." : "Export PDF"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleExportReviewPdf()}
                disabled={isExportingReviewPdf || savedCount + otherCount === 0}
                title={savedCount + otherCount === 0
                  ? "เลือก Recommended หรือ Option อย่างน้อย 1 อันก่อน"
                  : "Export แนวนอนแบบ review deck พร้อมเลข Idea 1-10"}
                className="rounded-full border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8] hover:bg-[#dbeafe]"
              >
                <FileDown className="h-4 w-4" />
                {isExportingReviewPdf ? "Exporting..." : "Export Review"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void requestIdeaGeneration(lastInstructions, "append")}
                disabled={isGenerating || isLoadingMore}
                className="rounded-full border-black/10 bg-white"
              >
                {isLoadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isLoadingMore ? "Generating..." : "Generate More"}
              </Button>
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
          </div>

          <div className="grid auto-rows-fr gap-4 pb-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {ideas.map((idea, index) => (
              <div key={`${idea.title}-${index}`} className="h-full">
                <IdeaCard
                  topic={idea}
                  index={index}
                  isSaved={savedTitles.includes(idea.title)}
                  contentType={idea.content_type}
                  selectionStatus={savedTitles.includes(idea.title)
                    ? "recommended"
                    : otherTitles.includes(idea.title)
                      ? "option"
                      : "empty"}
                  isOptionDisabled={!otherTitles.includes(idea.title) && otherCount >= MAX_OTHER_OPTIONS}
                  contentTypeWarning={contentTypeWarnings.has(getContentTypeValidationKey(idea))}
                  onContentTypeChange={(value) => handleContentTypeChange(index, value)}
                  onSelectionStatusChange={(value) => handleSelectionStatusChange(idea, index, value)}
                  onDetailClick={setDetailIdea}
                  onSaveClick={handleSaveIdea}
                  onFeedback={handleFeedback}
                  onEdit={handleEditIdea}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={isImportIdeasOpen} onOpenChange={(open) => {
        if (isImportingIdeas) return;
        setIsImportIdeasOpen(open);
        if (!open) setImportIdeasError("");
      }}>
        <DialogContent className="max-w-3xl rounded-[24px] border-black/10 bg-white p-0 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
          <div className="border-b border-black/10 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-[#101828]">Add existing ideas</DialogTitle>
            </DialogHeader>
            <p className="mt-1 text-sm leading-relaxed text-[#667085]">
              Paste one or multiple ideas. AI will extract every Hook, Subheadline, CTA, Concept, Why, Product Focus, and Content type.
            </p>
          </div>

          <div className="space-y-4 px-6 py-5">
            <Textarea
              value={importIdeasText}
              onChange={(event) => {
                setImportIdeasText(event.target.value);
                if (importIdeasError) setImportIdeasError("");
              }}
              placeholder={'Static 1\nHook: ...\nSubheadline: ...\nCTA: ...\nConcept: ...\nWhy This Topic: ...\nProduct Focus: ...'}
              className="min-h-[360px] resize-y rounded-2xl border-[#d0d5dd] bg-[#fcfcfd] p-4 text-sm leading-relaxed focus-visible:ring-[#84adff]"
              disabled={isImportingIdeas}
            />

            {importIdeasError && (
              <p className="rounded-xl bg-[#fff1f3] px-4 py-3 text-sm font-medium text-[#c01048]">
                {importIdeasError}
              </p>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-[#667085]">The extracted ideas will be added to the current list.</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsImportIdeasOpen(false)}
                  disabled={isImportingIdeas}
                  className="rounded-full border-black/10"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleImportIdeas()}
                  disabled={!importIdeasText.trim() || isImportingIdeas}
                  className="rounded-full bg-[#101828] px-5 text-white hover:bg-[#1d2939]"
                >
                  {isImportingIdeas ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {isImportingIdeas ? "Extracting..." : "Extract ideas"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                    {detailIdea.content_type && (
                      <Badge variant="outline" className="rounded-full border-black/10 bg-white">
                        {detailIdea.content_type}
                      </Badge>
                    )}
                    {getIdeaExtra(detailIdea).strategic_angle && (
                      <Badge variant="outline" className="rounded-full border-black/10 bg-white">
                        {getIdeaExtra(detailIdea).strategic_angle}
                      </Badge>
                    )}
                  </div>
                  <DialogTitle className="text-2xl font-semibold leading-tight text-[#111827]">
                    {detailIdea.title || detailIdea.concept_idea || "Concept idea"}
                  </DialogTitle>
                </DialogHeader>
              </div>

              <div className="mt-6 space-y-5 text-sm text-[#475467]">
                {(getIdeaExtra(detailIdea).product_service_focus || detailIdea.product_focus) && (
                  <section>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#667085]">
                      Product / Service Focus
                    </p>
                    <p className="leading-relaxed">
                      {getIdeaExtra(detailIdea).product_service_focus || detailIdea.product_focus}
                    </p>
                  </section>
                )}

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
                      {getIdeaExtra(detailIdea).format_execution ? "Format Execution" : "Description"}
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

                {getIdeaWhy(detailIdea) && (
                  <section className="rounded-2xl bg-[#eef2ff] p-4 text-[#3730d8]">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
                      Why
                    </p>
                    <p className="whitespace-pre-line leading-relaxed">{getIdeaWhy(detailIdea)}</p>
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
                      {detailIdea.copywriting.bullets?.length > 0 && (
                        <div>
                          <p className="font-semibold text-[#111827]">Bullets:</p>
                          <ul className="mt-1 list-disc space-y-1 pl-5">
                            {detailIdea.copywriting.bullets.map((bullet) => (
                              <li key={bullet}>{bullet}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {detailIdea.copywriting.cta && (
                        <p><span className="font-semibold text-[#111827]">CTA:</span> {detailIdea.copywriting.cta}</p>
                      )}
                    </div>
                  </section>
                )}

                {getIdeaExtra(detailIdea).creative_direction && (
                  <section className="rounded-2xl border border-black/10 p-4">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#667085]">
                      Creative Direction
                    </p>
                    <div className="space-y-3">
                      {getIdeaExtra(detailIdea).creative_direction?.main_visual_or_scene && (
                        <p>
                          <span className="font-semibold text-[#111827]">Main visual / scene:</span>{" "}
                          {getIdeaExtra(detailIdea).creative_direction?.main_visual_or_scene}
                        </p>
                      )}
                      {getIdeaExtra(detailIdea).creative_direction?.layout_or_sequence && (
                        <p>
                          <span className="font-semibold text-[#111827]">Layout / sequence:</span>{" "}
                          {getIdeaExtra(detailIdea).creative_direction?.layout_or_sequence}
                        </p>
                      )}
                      {getIdeaExtra(detailIdea).creative_direction?.production_notes && (
                        <p>
                          <span className="font-semibold text-[#111827]">Production notes:</span>{" "}
                          {getIdeaExtra(detailIdea).creative_direction?.production_notes}
                        </p>
                      )}
                    </div>
                  </section>
                )}

                {detailIdea.tags?.length > 0 && (
                  <section>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#667085]">
                      Tags
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {detailIdea.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="rounded-full border-black/10">
                          {tag}
                        </Badge>
                      ))}
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

      <Dialog open={editingIndex !== null} onOpenChange={(open) => { if (!open) setEditingIndex(null); }}>
        <DialogContent className="max-h-[86vh] max-w-xl overflow-y-auto rounded-[24px] border-black/10 bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#111827]">แก้ไขไอเดีย</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-[#667085]">Hook</Label>
              <Textarea
                value={editDraft.hook}
                onChange={(e) => setEditDraft((d) => ({ ...d, hook: e.target.value }))}
                rows={2}
                className="border-black/10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-[#667085]">Subheadline</Label>
              <Textarea
                value={editDraft.subheadline}
                onChange={(e) => setEditDraft((d) => ({ ...d, subheadline: e.target.value }))}
                rows={2}
                className="border-black/10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-[#667085]">CTA</Label>
              <Input
                value={editDraft.cta}
                onChange={(e) => setEditDraft((d) => ({ ...d, cta: e.target.value }))}
                className="border-black/10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-[#667085]">Concept</Label>
              <Textarea
                value={editDraft.concept}
                onChange={(e) => setEditDraft((d) => ({ ...d, concept: e.target.value }))}
                rows={2}
                className="border-black/10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-[#667085]">Why</Label>
              <Textarea
                value={editDraft.why}
                onChange={(e) => setEditDraft((d) => ({ ...d, why: e.target.value }))}
                rows={3}
                className="border-black/10"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditingIndex(null)} className="rounded-full border-black/10 bg-white">
              ยกเลิก
            </Button>
            <Button type="button" onClick={handleSaveEdit} className="rounded-full bg-[#1f1f1f] text-white hover:bg-black">
              บันทึก
            </Button>
          </div>
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
