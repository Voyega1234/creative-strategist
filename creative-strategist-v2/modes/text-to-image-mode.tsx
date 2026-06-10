"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGeneratedAdAssets } from "@/components/generated-ads/use-generated-ad-assets";
import { useGeneratedAdIdeas } from "@/components/generated-ads/use-generated-ad-ideas";
import { PromptInputBox } from "@/creative-strategist-v2/chat-model";
import {
  ImageCountSummary,
  ImagePickerSection,
  SelectedImageStrip,
  SelectedUploadedFileStrip,
} from "@/creative-strategist-v2/modes/text-to-image-media-picker";
import { AddImagesDialog } from "@/components/add-images-dialog";
import { EditableSavedIdeaModal } from "@/components/editable-saved-idea-modal";
import { downloadGeneratedAdImage, requestGeneratedAdImage, runConcurrentImageJobs } from "@/lib/images/generated-ads-client";
import {
  buildGeneratedAdRequestPayload,
  getGeneratedImagesStorageKey,
  loadGeneratedImagesFromStorage,
  saveGeneratedImagesToStorage,
  type GeneratedImage,
  type SavedTopic,
} from "@/lib/images/generated-ads";
import { uploadFileToImageStorage } from "@/lib/images/client";
import { AD_STYLE_OPTIONS, PAGE_REFERENCE_STYLE_VALUE } from "@/lib/images/generated-ads-config";
import type { IdeaRecommendation } from "@/lib/ideas/types";
import { cn } from "@/lib/utils";
import { Bookmark, Check, Download, Files, ImageIcon, Images, Loader2, Palette, Pencil, RectangleHorizontal, Sparkles, Upload, Wand2 } from "lucide-react";
import type { TextToImageIdeaHandoff, TextToImageReferenceHandoff } from "./types";

const ASPECT_RATIOS = ["1:1", "4:5", "9:16", "16:9"] as const;
const IMAGE_COUNTS = [1, 2, 3] as const;
const CREATIVE_FORMATS = [
  {
    value: "single-post",
    label: "Single Post",
    instruction: "Create one self-contained social media ad image with one clear message and one visual focal point.",
  },
  {
    value: "album-post",
    label: "Album Post",
    instruction: "Create an ad image that can work as part of a multi-image album post, with a modular campaign feel and room for follow-up visuals.",
  },
  {
    value: "carousel",
    label: "Carousel",
    instruction: "Create a carousel-ready ad image with a strong first-slide hook, clear hierarchy, and composition that can extend into a swipeable sequence.",
  },
] as const;

type TextToImageModeProps = {
  clientId?: string | null;
  clientName?: string;
  productFocus?: string | null;
  colorPalette?: string[];
  onNeedsScrollChange?: (needsScroll: boolean) => void;
  ideaHandoff?: TextToImageIdeaHandoff | null;
  referenceHandoff?: TextToImageReferenceHandoff | null;
};

type BriefSource = "brief" | "idea";

type GenerationLogEntry = {
  id: string;
  createdAt: string;
  prompt: string;
  format: string;
  ratio: string;
  count: number;
  style: string;
  source: BriefSource;
  productAssets: number;
  references: number;
};

export function TextToImageMode({
  clientId,
  clientName,
  productFocus,
  colorPalette: clientColorPalette,
  onNeedsScrollChange,
  ideaHandoff,
  referenceHandoff,
}: TextToImageModeProps) {
  const generationInFlightRef = useRef(false);
  // Storage key whose persisted images are currently loaded into state. Guards the save effect
  // from writing stale images under a freshly-switched client's key.
  const hydratedStorageKeyRef = useRef<string | null>(null);
  const [briefSource, setBriefSource] = useState<BriefSource>("brief");
  const [creativeFormat, setCreativeFormat] = useState<(typeof CREATIVE_FORMATS)[number]["value"]>("single-post");
  const [aspectRatio, setAspectRatio] = useState<(typeof ASPECT_RATIOS)[number]>("1:1");
  const [imageCount, setImageCount] = useState<(typeof IMAGE_COUNTS)[number]>(1);
  const [selectedAdStyle, setSelectedAdStyle] = useState("");
  // "Match Page Style": scraped Facebook page posts used as references.
  const [pageReferenceUrl, setPageReferenceUrl] = useState("");
  const [pageReferenceImages, setPageReferenceImages] = useState<Array<{ name: string; url: string }>>([]);
  const [isScrapingPageReferences, setIsScrapingPageReferences] = useState(false);
  const [pageReferenceMessage, setPageReferenceMessage] = useState("");
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [isMaterialsMenuOpen, setIsMaterialsMenuOpen] = useState(false);
  const [isReferencesMenuOpen, setIsReferencesMenuOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastBrief, setLastBrief] = useState("");
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  // Ids of images whose URL failed to load (e.g. expired / truncated persisted data URLs).
  // These are hidden so the gallery only shows images that actually render.
  const [brokenImageIds, setBrokenImageIds] = useState<string[]>([]);
  const [resultsVisibleCount, setResultsVisibleCount] = useState(20);
  const [generationLogs, setGenerationLogs] = useState<GenerationLogEntry[]>([]);
  const [uploadedReferenceFiles, setUploadedReferenceFiles] = useState<File[]>([]);
  const [brandWebsiteUrl, setBrandWebsiteUrl] = useState("");
  const [isExtractingBrandAssets, setIsExtractingBrandAssets] = useState(false);
  const [brandAssetMessage, setBrandAssetMessage] = useState("");
  const [previewImage, setPreviewImage] = useState<GeneratedImage | null>(null);
  const [savingImageIds, setSavingImageIds] = useState<string[]>([]);
  const [savedImageIds, setSavedImageIds] = useState<string[]>([]);
  const referenceUploadInputRef = useRef<HTMLInputElement>(null);

  const selectedClientId = clientId || "";
  const selectedProductFocus = productFocus || "";
  const {
    loadingTopics,
    savedTopics,
    selectedTopic,
    selectedTopicData,
    selectedTopicSummary,
    availableVisualRoutes,
    selectedVisualRoute,
    selectedVisualRouteIndex,
    topicEditModalOpen,
    editableIdea,
    setSelectedTopic,
    setSelectedVisualRouteIndex,
    selectProvidedTopic,
    openTopicEdit,
    closeTopicEdit,
    saveEditableIdea,
  } = useGeneratedAdIdeas({
    selectedClientId,
    selectedProductFocus,
    currentClientName: clientName,
    activeClientName: clientName,
  });
  const {
    materialImages,
    selectedMaterials,
    loadingMaterialImages,
    referenceImages,
    selectedReferenceImages,
    loadingReferenceImages,
    colorPalette,
    colorInput,
    isSavingPalette,
    maxReferenceSelection,
    setColorInput,
    setColorPalette,
    toggleMaterial,
    selectMaterial,
    selectReference,
    toggleReference,
    uploadReferences,
    isUploadingReferences,
    loadMaterialImages,
    addColor,
    removeColor,
    savePalette,
  } = useGeneratedAdAssets({
    selectedClientId,
    selectedProductFocus,
    clientColorPalette,
    onClientColorPaletteSaved: () => {},
    loadAssets: isMaterialsMenuOpen,
    loadReferences: isReferencesMenuOpen,
  });

  const visibleIdeas = savedTopics;
  const visibleMaterialImages = useMemo(() => materialImages.slice(0, 80), [materialImages]);
  const visibleReferenceImages = useMemo(() => referenceImages.slice(0, 80), [referenceImages]);
  const selectedAdStyleOption = useMemo(
    () => AD_STYLE_OPTIONS.find((style) => style.value === selectedAdStyle) || null,
    [selectedAdStyle],
  );
  const selectedCreativeFormat = useMemo(
    () => CREATIVE_FORMATS.find((format) => format.value === creativeFormat) || CREATIVE_FORMATS[0],
    [creativeFormat],
  );
  const visibleGeneratedImages = useMemo(
    () => generatedImages.filter((image) => !brokenImageIds.includes(image.id)),
    [generatedImages, brokenImageIds],
  );
  const hasResults = visibleGeneratedImages.length > 0;
  const hasSelectedImages = selectedMaterials.length > 0 || selectedReferenceImages.length > 0 || uploadedReferenceFiles.length > 0;
  const needsScrollLayout = hasResults || briefSource === "idea" || hasSelectedImages;
  const latestCompletedImage = visibleGeneratedImages.find((image) => image.status === "completed");
  const uploadedReferencePreviews = useMemo(
    () => uploadedReferenceFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [uploadedReferenceFiles],
  );

  useEffect(() => {
    onNeedsScrollChange?.(needsScrollLayout);
  }, [needsScrollLayout, onNeedsScrollChange]);

  useEffect(() => {
    if (!ideaHandoff) return;

    setBriefSource("idea");
    selectProvidedTopic(
      mapIdeaToSavedTopic(ideaHandoff.idea, clientName, selectedProductFocus),
      ideaHandoff.selectedVisualRouteIndex,
    );
  }, [
    clientName,
    ideaHandoff,
    selectProvidedTopic,
    selectedProductFocus,
  ]);

  useEffect(() => {
    if (!referenceHandoff) return;
    selectReference(referenceHandoff.imageUrl);
  }, [referenceHandoff, selectReference]);

  useEffect(() => {
    if (!isImageDialogOpen) return;
    setIsMaterialsMenuOpen(true);
    setIsReferencesMenuOpen(true);
  }, [isImageDialogOpen]);

  useEffect(() => {
    setBrandWebsiteUrl("");
    setBrandAssetMessage("");
    setPreviewImage(null);
    setSavingImageIds([]);
    setSavedImageIds([]);
    setPageReferenceUrl("");
    setPageReferenceImages([]);
    setPageReferenceMessage("");
  }, [selectedClientId]);

  // When the "Match Page Style" style is active, prefill the page URL from the client profile and
  // load any references already scraped for this client (no Apify call on load).
  useEffect(() => {
    if (selectedAdStyle !== PAGE_REFERENCE_STYLE_VALUE || !selectedClientId) return;

    let cancelled = false;

    async function loadPageReferences() {
      try {
        const profileResponse = await fetch(`/api/client-profile?clientId=${encodeURIComponent(selectedClientId)}`);
        const profile = await profileResponse.json();
        const facebookUrl =
          typeof profile?.client?.clientFacebookUrl === "string" ? profile.client.clientFacebookUrl : "";
        if (!cancelled && facebookUrl) {
          setPageReferenceUrl((current) => (current.trim() ? current : facebookUrl));
        }
      } catch (error) {
        console.warn("[Text to Image] Could not load client Facebook URL:", error);
      }

      try {
        const response = await fetch(
          `/api/text-to-image/style-references?clientId=${encodeURIComponent(selectedClientId)}`,
        );
        const data = await response.json();
        if (!cancelled && data?.success) {
          setPageReferenceImages(Array.isArray(data.images) ? data.images : []);
        }
      } catch (error) {
        console.warn("[Text to Image] Could not load page references:", error);
      }
    }

    void loadPageReferences();

    return () => {
      cancelled = true;
    };
  }, [selectedAdStyle, selectedClientId]);

  // Load this client's previously generated images so the gallery survives page reloads.
  useEffect(() => {
    setBrokenImageIds([]);
    setResultsVisibleCount(20);
    if (!selectedClientId || !selectedProductFocus) {
      hydratedStorageKeyRef.current = null;
      setGeneratedImages([]);
      return;
    }
    const key = getGeneratedImagesStorageKey(selectedClientId, selectedProductFocus);
    setGeneratedImages(loadGeneratedImagesFromStorage(key));
    hydratedStorageKeyRef.current = key;
  }, [selectedClientId, selectedProductFocus]);

  // Persist completed, non-broken images for the currently hydrated client. Keyed on
  // visibleGeneratedImages (derived from generatedImages + brokenImageIds) so broken images get
  // dropped from storage once detected, and so it never fires on the render where the client just
  // changed (state still holds the old images, so the memoized reference is unchanged).
  useEffect(() => {
    const key = hydratedStorageKeyRef.current;
    if (!key) return;
    saveGeneratedImagesToStorage(key, visibleGeneratedImages);
  }, [visibleGeneratedImages]);

  useEffect(() => {
    if (!isImageDialogOpen || !selectedClientId) return;

    let isCurrent = true;

    async function loadClientWebsite() {
      try {
        const response = await fetch(`/api/client-profile?clientId=${encodeURIComponent(selectedClientId)}`);
        const payload = await response.json();
        const website = typeof payload?.client?.clientWebsiteUrl === "string" ? payload.client.clientWebsiteUrl : "";
        if (isCurrent && website) {
          setBrandWebsiteUrl((current) => (current.trim() ? current : website));
        }
      } catch (error) {
        console.warn("[Text to Image] Could not load client website:", error);
      }
    }

    void loadClientWebsite();

    return () => {
      isCurrent = false;
    };
  }, [isImageDialogOpen, selectedClientId]);

  useEffect(() => {
    return () => {
      uploadedReferencePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [uploadedReferencePreviews]);

  const generateImages = async (message = "", files: File[] = []) => {
    if (generationInFlightRef.current) return;
    if (!selectedClientId || !selectedProductFocus || !clientName) {
      alert("กรุณาเลือก Client และ Product Focus ก่อน");
      return;
    }

    const normalizedMessage = message.trim();
    const usingIdea = briefSource === "idea" && selectedTopicData;
    const promptText =
      normalizedMessage ||
      selectedTopicData?.concept_idea ||
      selectedTopicData?.description ||
      "";

    if (!usingIdea && !promptText) {
      alert("พิมพ์ brief หรือเลือก saved idea ก่อน generate");
      return;
    }

    generationInFlightRef.current = true;
    setIsGenerating(true);
    setLastBrief(promptText);

    const requestIds = Array.from({ length: imageCount }, () => crypto.randomUUID());
    const topicTitle = selectedTopicData?.title || "Custom brief";
    const topicSummary = selectedTopicData ? selectedTopicSummary : promptText;

    setGeneratedImages((prev) => [
      ...requestIds.map((id) => ({
        id,
        url: "",
        prompt: promptText,
        topicTitle,
        topicSummary,
        status: "generating" as const,
        created_at: new Date().toISOString(),
        aspectRatio,
        operation: "generate" as const,
      })),
      ...prev,
    ]);

    try {
      const referenceFiles = [...uploadedReferenceFiles, ...files.filter((file) => file.type.startsWith("image/"))];
      const referenceImageUrls = await Promise.all(
        referenceFiles.map((file) => uploadFileToImageStorage(file, "generated/text-to-image-references")),
      );
      const pageStyleReferenceUrls =
        selectedAdStyle === PAGE_REFERENCE_STYLE_VALUE && pageReferenceImages.length > 0
          ? pickRandomItems(pageReferenceImages.map((image) => image.url), 2, 3)
          : [];
      const allReferenceImageUrls = [
        ...selectedReferenceImages,
        ...referenceImageUrls,
        ...pageStyleReferenceUrls,
      ];

      const payload = buildGeneratedAdRequestPayload({
        prompt: promptText,
        referenceImageUrls: allReferenceImageUrls,
        clientName,
        productFocus: selectedProductFocus,
        selectedTopicData: usingIdea ? selectedTopicData : null,
        selectedVisualRoute,
        colorPalette,
        materialImageUrls: selectedMaterials,
        adStyleLabel: selectedAdStyleOption?.label || null,
        userBrief: [
          `Creative format: ${selectedCreativeFormat.label}. ${selectedCreativeFormat.instruction}`,
          selectedAdStyleOption?.userBrief || "",
        ].filter(Boolean).join("\n"),
        creativeFormat: selectedCreativeFormat.value,
        creativeFormatLabel: selectedCreativeFormat.label,
        aspectRatio,
      });

      setGenerationLogs((prev) => [
        {
          id: requestIds[0],
          createdAt: new Date().toISOString(),
          prompt: promptText,
          format: selectedCreativeFormat.label,
          ratio: aspectRatio,
          count: imageCount,
          style: selectedAdStyleOption?.label || "Auto style",
          source: briefSource,
          productAssets: selectedMaterials.length,
          references: allReferenceImageUrls.length,
        },
        ...prev,
      ].slice(0, 8));

      const { failedCount } = await runConcurrentImageJobs({
        items: requestIds,
        concurrency: 2,
        run: async (imageId) => {
          const finalImage = await requestGeneratedAdImage(payload);
          setGeneratedImages((prev) =>
            prev.map((image) =>
              image.id === imageId
                ? {
                    ...image,
                    url: finalImage.url,
                    source: finalImage.source,
                    status: "completed",
                    reference_image: allReferenceImageUrls[0],
                  }
                : image,
            ),
          );
        },
        onError: (imageId, error) => {
          console.error("[Text to Image] generation failed:", error);
          setGeneratedImages((prev) =>
            prev.map((image) => (image.id === imageId ? { ...image, status: "error" } : image)),
          );
        },
      });

      if (failedCount > 0) {
        alert(`มี ${failedCount} รูปที่สร้างไม่สำเร็จ`);
      }
    } catch (error) {
      console.error("[Text to Image] generation failed:", error);
      alert(error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการสร้างภาพ");
      setGeneratedImages((prev) =>
        prev.map((image) => (requestIds.includes(image.id) ? { ...image, status: "error" } : image)),
      );
    } finally {
      generationInFlightRef.current = false;
      setIsGenerating(false);
    }
  };

  const fetchPageReferences = async () => {
    if (!selectedClientId) {
      setPageReferenceMessage("เลือก Client ก่อน");
      return;
    }
    const url = pageReferenceUrl.trim();
    if (!url) {
      setPageReferenceMessage("ใส่ Facebook page URL ก่อน");
      return;
    }

    setIsScrapingPageReferences(true);
    setPageReferenceMessage("");
    try {
      const response = await fetch("/api/text-to-image/style-references", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: selectedClientId, facebookUrl: url, limit: 20 }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setPageReferenceMessage(data.error || "ดึงรูปไม่สำเร็จ");
        return;
      }
      setPageReferenceImages(Array.isArray(data.images) ? data.images : []);
      setPageReferenceMessage(`ดึงมา ${data.images?.length || 0} รูป`);
    } catch (error) {
      console.error("[Text to Image] page reference scrape failed:", error);
      setPageReferenceMessage("เกิดข้อผิดพลาดในการดึงรูป");
    } finally {
      setIsScrapingPageReferences(false);
    }
  };

  const extractBrandAssets = async () => {
    if (!brandWebsiteUrl.trim()) {
      setBrandAssetMessage("ใส่ website URL ก่อน");
      return;
    }
    if (!selectedClientId) {
      setBrandAssetMessage("เลือก client ก่อน");
      return;
    }

    setIsExtractingBrandAssets(true);
    setBrandAssetMessage("");

    try {
      const response = await fetch("/api/text-to-image/brand-assets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          website: brandWebsiteUrl.trim(),
          clientId: selectedClientId,
          currentColorPalette: colorPalette,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload?.error || "Cannot extract brand assets");
      }

      if (Array.isArray(payload.color_palette)) {
        setColorPalette(payload.color_palette);
      }

      if (payload.logo_material_url) {
        selectMaterial(payload.logo_material_url);
        await loadMaterialImages(selectedClientId);
      }

      setBrandWebsiteUrl(payload.website || brandWebsiteUrl);
      setBrandAssetMessage(
        [
          payload.logo_material_url ? "เพิ่ม logo เข้า Product assets แล้ว" : "",
          Array.isArray(payload.extracted_colors) && payload.extracted_colors.length > 0
            ? `เพิ่มสี ${payload.extracted_colors.length} สี`
            : "",
        ]
          .filter(Boolean)
          .join(" · ") || "ดึงข้อมูลแบรนด์เรียบร้อยแล้ว",
      );
    } catch (error) {
      console.error("[Text to Image] Brand asset extraction failed:", error);
      setBrandAssetMessage(error instanceof Error ? error.message : "Cannot extract brand assets");
    } finally {
      setIsExtractingBrandAssets(false);
    }
  };

  const saveGeneratedImageToReferences = async (image: GeneratedImage) => {
    if (!selectedClientId) {
      alert("กรุณาเลือก Client ก่อนบันทึกภาพ");
      return;
    }
    if (!image.url || savingImageIds.includes(image.id) || savedImageIds.includes(image.id)) return;

    setSavingImageIds((current) => [...current, image.id]);
    try {
      const response = await fetch("/api/reference-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: image.url,
          client_id: selectedClientId,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "ไม่สามารถบันทึกภาพได้");
      }

      setSavedImageIds((current) => (current.includes(image.id) ? current : [...current, image.id]));
      window.dispatchEvent(
        new CustomEvent("reference-library-updated", {
          detail: { clientId: selectedClientId },
        }),
      );
    } catch (error) {
      console.error("[Text to Image] Failed to save reference:", error);
      alert(error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการบันทึกภาพ");
    } finally {
      setSavingImageIds((current) => current.filter((id) => id !== image.id));
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div className="rounded-[28px] border border-black/10 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.12)]">
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap justify-end gap-2">
            {(["brief", "idea"] as const).map((source) => (
              <button
                key={source}
                type="button"
                onClick={() => setBriefSource(source)}
                className={cn(
                  "h-9 rounded-full border px-4 text-sm font-medium transition",
                  briefSource === source
                    ? "border-[#1f1f1f] bg-[#1f1f1f] text-white"
                    : "border-black/10 bg-white text-[#667085] hover:bg-black/5 hover:text-[#1f1f1f]",
                )}
              >
                {source === "brief" ? "Write brief" : "Use saved idea"}
              </button>
            ))}
          </div>

          {briefSource === "idea" && (
            <div className="rounded-[22px] border border-black/10 bg-slate-50 p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#1f1f1f]">Saved ideas</p>
                <p className="text-xs text-[#667085]">
                  {loadingTopics ? "Loading..." : `${savedTopics.length} available`}
                </p>
              </div>
              {visibleIdeas.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-black/10 bg-white px-4 py-6 text-sm text-[#667085]">
                  ยังไม่มี saved idea สำหรับ client/product นี้ แต่ยังพิมพ์ brief เองเพื่อเริ่ม generate ได้
                </div>
              ) : (
                <div className="max-h-[320px] overflow-y-auto pr-1">
                  <div className="grid gap-2 sm:grid-cols-2">
                  {visibleIdeas.map((idea) => {
                    const isSelected = selectedTopic === idea.title;
                    const ideaVisualRoutes = isSelected ? availableVisualRoutes : idea.visual_routes;

                    return (
                      <div
                        key={idea.id || idea.title}
                        className={cn(
                          "relative rounded-2xl border p-3 text-left transition",
                          isSelected
                            ? "border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/15"
                            : "border-black/10 bg-white/70 hover:border-black/20 hover:bg-white",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedTopic(isSelected ? "" : idea.title)}
                          className="block w-full text-left"
                        >
                          <div className="pr-8">
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#667085]">Headline</p>
                              <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-[#1f1f1f]">
                                {idea.copywriting?.headline || idea.title}
                              </p>
                            </div>
                          </div>

                          {(idea.copywriting?.sub_headline_1 || idea.copywriting?.sub_headline_2) && (
                            <div className="mt-3 border-t border-black/5 pt-2.5">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#667085]">Subheadline</p>
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#475467]">
                                {idea.copywriting.sub_headline_1 || idea.copywriting.sub_headline_2}
                              </p>
                            </div>
                          )}

                          <div className="mt-3 border-t border-black/5 pt-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#667085]">Concept</p>
                              {ideaVisualRoutes && ideaVisualRoutes.length > 0 && (
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                                  {ideaVisualRoutes.length} visual routes
                                </span>
                              )}
                            </div>
                            <p className="mt-1 line-clamp-3 text-xs leading-5 text-[#667085]">
                              {idea.concept_idea || idea.description}
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => openTopicEdit(idea)}
                          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-[#667085] transition hover:border-black/20 hover:bg-black/5 hover:text-[#1f1f1f]"
                          aria-label={`Edit ${idea.title}`}
                          title="Edit saved idea"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>

                        {isSelected && ideaVisualRoutes && ideaVisualRoutes.length > 0 && (
                          <div className="mt-3 border-t border-blue-200/70 pt-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-700">
                                Visual direction
                              </p>
                              {selectedVisualRouteIndex !== null && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedVisualRouteIndex(null)}
                                  className="text-[11px] font-medium text-[#667085] hover:text-[#1f1f1f]"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                            <div className="space-y-2">
                              {ideaVisualRoutes.map((route, index) => {
                                const routeSelected = selectedVisualRouteIndex === index;
                                return (
                                  <button
                                    key={`${route.route_name}-${index}`}
                                    type="button"
                                    onClick={() => setSelectedVisualRouteIndex(routeSelected ? null : index)}
                                    className={cn(
                                      "w-full rounded-xl border px-3 py-2.5 text-left transition",
                                      routeSelected
                                        ? "border-blue-500 bg-white ring-2 ring-blue-500/10"
                                        : "border-black/10 bg-white/80 hover:border-black/20",
                                    )}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="line-clamp-1 text-xs font-semibold text-[#1f1f1f]">
                                        {route.route_name || `Route ${index + 1}`}
                                      </p>
                                      {routeSelected && <Check className="h-3.5 w-3.5 shrink-0 text-blue-600" />}
                                    </div>
                                    {route.visual_idea && (
                                      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#667085]">{route.visual_idea}</p>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedAdStyle === PAGE_REFERENCE_STYLE_VALUE && (
            <div className="rounded-[22px] border border-black/10 bg-slate-50 p-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#1f1f1f]">Match Page Style</p>
                  <p className="mt-0.5 text-xs leading-5 text-[#667085]">
                    ดึงโฆษณาแบบรูปภาพจาก Facebook Ads Library ของเพจมาเก็บไว้ แล้วสุ่ม 2-3 รูปเป็น reference ตอนเจน
                  </p>
                </div>
                {pageReferenceImages.length > 0 && (
                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[#1f1f1f] ring-1 ring-black/10">
                    {pageReferenceImages.length} รูป
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="url"
                  value={pageReferenceUrl}
                  onChange={(event) => setPageReferenceUrl(event.target.value)}
                  placeholder="https://www.facebook.com/yourpage"
                  className="h-9 flex-1 rounded-xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#1f1f1f]"
                />
                <Button
                  type="button"
                  onClick={() => void fetchPageReferences()}
                  disabled={isScrapingPageReferences}
                  className="h-9 shrink-0 rounded-xl bg-[#1f1f1f] px-4 text-sm text-white hover:bg-black"
                >
                  {isScrapingPageReferences ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> กำลังดึง...
                    </>
                  ) : pageReferenceImages.length > 0 ? (
                    "ดึงใหม่"
                  ) : (
                    "ดึงรูปจากเพจ"
                  )}
                </Button>
              </div>

              {pageReferenceMessage && <p className="mt-2 text-xs text-[#667085]">{pageReferenceMessage}</p>}

              {pageReferenceImages.length > 0 && (
                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {pageReferenceImages.map((image) => (
                    <div
                      key={image.url}
                      className="relative aspect-square overflow-hidden rounded-lg border border-black/10 bg-white"
                    >
                      <Image src={image.url} alt={image.name} fill sizes="80px" className="object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <PromptInputBox
            isLoading={isGenerating}
            onSend={(message, files) => void generateImages(message, files)}
            onUploadClick={() => setIsImageDialogOpen(true)}
            placeholder={
              briefSource === "idea"
                ? "Add extra direction for the selected idea, or attach a reference image..."
                : "Describe the ad image you want to generate..."
            }
            showUtilityControls={false}
            primaryActionLabel="Generate Image"
            primaryActionEnabled={briefSource === "idea" && Boolean(selectedTopicData)}
            leftActionsAddon={
              <div className="flex items-center gap-1 border-l border-black/10 pl-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-8 items-center gap-1 rounded-full px-2 text-[#777] transition hover:bg-black/5 hover:text-[#1f1f1f]"
                      aria-label="Select creative format"
                    >
                      <Files className="h-4 w-4" />
                      <span className="max-w-20 truncate text-xs font-medium">{selectedCreativeFormat.label}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 rounded-2xl border-black/10 bg-white">
                    <DropdownMenuLabel className="text-xs text-[#667085]">Creative format</DropdownMenuLabel>
                    {CREATIVE_FORMATS.map((format) => {
                      const isComingSoon = format.value === "album-post" || format.value === "carousel";
                      return (
                        <DropdownMenuItem
                          key={format.value}
                          disabled={isComingSoon}
                          onClick={isComingSoon ? undefined : () => setCreativeFormat(format.value)}
                          className={cn(
                            "rounded-xl text-sm",
                            creativeFormat === format.value && "font-semibold text-[#1f1f1f]",
                            isComingSoon && "cursor-not-allowed opacity-50",
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <span>{format.label}</span>
                            {isComingSoon && (
                              <span className="shrink-0 rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-medium text-[#667085]">
                                เร็วๆ นี้
                              </span>
                            )}
                          </span>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-8 items-center gap-1 rounded-full px-2 text-[#777] transition hover:bg-black/5 hover:text-[#1f1f1f]"
                      aria-label="Select image ratio"
                    >
                      <RectangleHorizontal className="h-4 w-4" />
                      <span className="text-xs font-medium">{aspectRatio}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-32 rounded-2xl border-black/10 bg-white">
                    <DropdownMenuLabel className="text-xs text-[#667085]">Ratio</DropdownMenuLabel>
                    {ASPECT_RATIOS.map((ratio) => (
                      <DropdownMenuItem
                        key={ratio}
                        onClick={() => setAspectRatio(ratio)}
                        className={cn("rounded-xl text-sm", aspectRatio === ratio && "font-semibold text-[#1f1f1f]")}
                      >
                        {ratio}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-8 items-center gap-1 rounded-full px-2 text-[#777] transition hover:bg-black/5 hover:text-[#1f1f1f]"
                      aria-label="Select image count"
                    >
                      <Images className="h-4 w-4" />
                      <span className="text-xs font-medium">{imageCount}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-32 rounded-2xl border-black/10 bg-white">
                    <DropdownMenuLabel className="text-xs text-[#667085]">Images</DropdownMenuLabel>
                    {IMAGE_COUNTS.map((count) => (
                      <DropdownMenuItem
                        key={count}
                        onClick={() => setImageCount(count)}
                        className={cn("rounded-xl text-sm", imageCount === count && "font-semibold text-[#1f1f1f]")}
                      >
                        {count} image{count === 1 ? "" : "s"}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-8 items-center gap-1.5 rounded-full border border-[#1f1f1f]/15 bg-[#1f1f1f]/[0.04] px-3 text-[#1f1f1f] transition hover:border-[#1f1f1f]/30 hover:bg-[#1f1f1f]/[0.08]"
                      aria-label="Select ad style"
                    >
                      <Wand2 className="h-4 w-4" />
                      <span className="whitespace-nowrap text-xs font-medium">
                        {selectedAdStyleOption ? selectedAdStyleOption.label : "Auto Style"}
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-72 rounded-2xl border-black/10 bg-white">
                    <DropdownMenuLabel className="text-xs text-[#667085]">Style</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => setSelectedAdStyle("")}
                      className={cn("rounded-xl text-sm", !selectedAdStyle && "font-semibold text-[#1f1f1f]")}
                    >
                      Auto style
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {AD_STYLE_OPTIONS.map((style) => {
                      const isRecommended = style.value === PAGE_REFERENCE_STYLE_VALUE;
                      return (
                        <DropdownMenuItem
                          key={style.value}
                          onClick={() => setSelectedAdStyle(style.value)}
                          className={cn(
                            "rounded-xl text-sm",
                            selectedAdStyle === style.value && "font-semibold text-[#1f1f1f]",
                            isRecommended && "bg-blue-50/70 ring-1 ring-blue-200 focus:bg-blue-50",
                          )}
                        >
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="block truncate">{style.label}</span>
                              {isRecommended && (
                                <span className="shrink-0 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                  แนะนำ
                                </span>
                              )}
                            </span>
                            <span className="block truncate text-xs text-[#667085]">{style.hoverDescription}</span>
                          </span>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-8 items-center gap-1 rounded-full px-2 text-[#777] transition hover:bg-black/5 hover:text-[#1f1f1f]"
                      aria-label="Brand colors"
                    >
                      <Palette className="h-4 w-4" />
                      <span className="text-xs font-medium">{colorPalette.length || 0}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-72 rounded-2xl border-black/10 bg-white">
                    <DropdownMenuLabel className="text-xs text-[#667085]">Brand colors</DropdownMenuLabel>
                    {colorPalette.length > 0 ? (
                      <div className="flex flex-wrap gap-2 p-2">
                        {colorPalette.map((color, index) => (
                          <div
                            key={`${color}-${index}`}
                            className="flex items-center gap-1 rounded-full border border-black/10 bg-white px-2 py-1"
                          >
                            <span
                              className="h-5 w-5 rounded-full border border-black/10"
                              title={`#${color}`}
                              style={{ backgroundColor: `#${color}` }}
                            />
                            <span className="text-xs font-medium text-[#475467]">#{color}</span>
                            <button
                              type="button"
                              onClick={() => removeColor(index)}
                              className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-xs text-[#98a2b3] transition hover:bg-black/5 hover:text-rose-500"
                              aria-label={`Remove #${color}`}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="px-2 py-3 text-sm text-[#667085]">No saved brand colors.</div>
                    )}
                    <DropdownMenuSeparator />
                    <div className="space-y-2 p-2">
                      <div className="flex gap-2">
                        <Input
                          value={colorInput}
                          onChange={(event) => setColorInput(event.target.value)}
                          onKeyDown={(event) => {
                            event.stopPropagation();
                            if (event.key === "Enter") {
                              event.preventDefault();
                              addColor();
                            }
                          }}
                          placeholder="#265484"
                          className="h-9 rounded-full border-black/10 text-sm focus-visible:ring-0"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={addColor}
                          className="h-9 shrink-0 rounded-full border-black/10 bg-white px-3 text-xs"
                        >
                          Add
                        </Button>
                      </div>
                      <Button
                        type="button"
                        onClick={() => void savePalette()}
                        disabled={!selectedClientId || isSavingPalette}
                        className="h-9 w-full rounded-full bg-[#1f1f1f] text-xs text-white hover:bg-black"
                      >
                        {isSavingPalette ? "Saving..." : "Save brand colors"}
                      </Button>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

              </div>
            }
            className="flex min-h-[108px] flex-col justify-between !border-black/10 !bg-white !shadow-none sm:min-h-[116px]"
          />

          {hasSelectedImages && (
            <div className="rounded-[22px] border border-black/10 bg-slate-50 p-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                {selectedMaterials.length > 0 && (
                  <SelectedImageStrip
                    label="Product assets"
                    urls={selectedMaterials}
                    onRemove={toggleMaterial}
                  />
                )}
                {selectedReferenceImages.length > 0 && (
                  <SelectedImageStrip
                    label="References"
                    urls={selectedReferenceImages}
                    onRemove={toggleReference}
                  />
                )}
                {uploadedReferencePreviews.length > 0 && (
                  <SelectedUploadedFileStrip
                    label="Uploaded references"
                    previews={uploadedReferencePreviews}
                    onRemove={(file) => setUploadedReferenceFiles((current) => current.filter((item) => item !== file))}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <EditableSavedIdeaModal
        isOpen={topicEditModalOpen}
        onClose={closeTopicEdit}
        idea={editableIdea}
        onSave={saveEditableIdea}
      />

      {(hasResults || lastBrief) && (
        <div className="rounded-[28px] border border-black/10 bg-white p-4 shadow-[0_18px_56px_rgba(15,23,42,0.10)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#1f1f1f]">Generated results</p>
              <p className="mt-0.5 line-clamp-1 text-xs text-[#667085]">{lastBrief || "Waiting for image generation"}</p>
            </div>
            {latestCompletedImage && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-full border-black/10 bg-white"
                onClick={() => void downloadGeneratedAdImage(latestCompletedImage.url)}
              >
                <Download className="h-4 w-4" />
                Download latest
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visibleGeneratedImages.slice(0, resultsVisibleCount).map((image) => (
              <div key={image.id} className="relative aspect-square overflow-hidden rounded-[22px] border border-black/10 bg-slate-50">
                {image.status === "generating" && (
                  <div className="flex h-full flex-col items-center justify-center text-sm text-[#667085]">
                    <Loader2 className="mb-2 h-5 w-5 animate-spin" />
                    Generating
                  </div>
                )}
                {image.status === "error" && (
                  <div className="flex h-full flex-col items-center justify-center px-4 text-center text-sm text-[#b42318]">
                    Generation failed
                  </div>
                )}
                {image.status === "completed" && image.url && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPreviewImage(image)}
                      className="absolute inset-0"
                      aria-label={`Preview ${image.topicTitle || "generated image"}`}
                    >
                      <Image
                        src={image.url}
                        alt={image.topicTitle || "Generated ad"}
                        fill
                        className="object-cover transition duration-300 hover:scale-[1.02]"
                        sizes="33vw"
                        onError={() =>
                          setBrokenImageIds((current) =>
                            current.includes(image.id) ? current : [...current, image.id],
                          )
                        }
                      />
                    </button>
                    <div className="absolute left-3 top-3 z-10 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-[#1f1f1f]">
                      {image.source || "generated"}
                    </div>
                    <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void downloadGeneratedAdImage(image.url)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-[#1f1f1f] shadow-sm ring-1 ring-black/10 transition hover:bg-white"
                        aria-label="Download image"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveGeneratedImageToReferences(image)}
                        disabled={savingImageIds.includes(image.id) || savedImageIds.includes(image.id)}
                        className="flex h-9 items-center justify-center gap-1.5 rounded-full bg-[#1f1f1f] px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-black disabled:bg-emerald-600"
                        aria-label={savedImageIds.includes(image.id) ? "Saved to references" : "Save to references"}
                      >
                        {savingImageIds.includes(image.id) ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : savedImageIds.includes(image.id) ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Bookmark className="h-3.5 w-3.5" />
                        )}
                        {savedImageIds.includes(image.id) ? "Saved" : "Save"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {visibleGeneratedImages.length === 0 && (
              <div className="flex aspect-square flex-col items-center justify-center rounded-[22px] border border-dashed border-black/10 bg-slate-50 text-center text-sm text-[#667085]">
                <ImageIcon className="mb-2 h-5 w-5" />
                Results will appear here.
              </div>
            )}
          </div>

          {visibleGeneratedImages.length > resultsVisibleCount && (
            <div className="mt-4 flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => setResultsVisibleCount((current) => current + 20)}
                className="rounded-full border-black/10 bg-white"
              >
                See more ({visibleGeneratedImages.length - resultsVisibleCount})
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={Boolean(previewImage)} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col overflow-hidden border-black/10 bg-white p-0">
          <DialogHeader className="border-b border-black/10 px-6 py-4">
            <DialogTitle className="pr-8 text-base text-[#1f1f1f]">
              {previewImage?.topicTitle || "Generated image"}
            </DialogTitle>
          </DialogHeader>
          {previewImage?.url && (
            <>
              <div className="relative min-h-0 flex-1 bg-[#f2f4f7]">
                <div className="relative h-[68vh] w-full">
                  <Image
                    src={previewImage.url}
                    alt={previewImage.topicTitle || "Generated image preview"}
                    fill
                    sizes="90vw"
                    className="object-contain p-4"
                    priority
                  />
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-black/10 px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-black/10"
                  onClick={() => void downloadGeneratedAdImage(previewImage.url)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
                <Button
                  type="button"
                  className="rounded-full bg-[#1f1f1f] text-white hover:bg-black disabled:bg-emerald-600"
                  onClick={() => void saveGeneratedImageToReferences(previewImage)}
                  disabled={
                    savingImageIds.includes(previewImage.id) ||
                    savedImageIds.includes(previewImage.id)
                  }
                >
                  {savingImageIds.includes(previewImage.id) ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : savedImageIds.includes(previewImage.id) ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : (
                    <Bookmark className="mr-2 h-4 w-4" />
                  )}
                  {savedImageIds.includes(previewImage.id) ? "Saved to References" : "Save to References"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {generationLogs.length > 0 && (
        <div className="rounded-[24px] border border-black/10 bg-white/90 p-4 shadow-[0_12px_36px_rgba(15,23,42,0.08)]">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#1f1f1f]">Generation log</p>
            <p className="text-xs text-[#667085]">Latest {generationLogs.length}</p>
          </div>
          <div className="space-y-2">
            {generationLogs.slice(0, 3).map((log) => (
              <div key={log.id} className="rounded-2xl border border-black/10 bg-slate-50 px-3 py-2">
                <div className="flex flex-wrap gap-2 text-[11px] text-[#667085]">
                  <span className="font-semibold text-[#1f1f1f]">{log.format}</span>
                  <span>{log.ratio}</span>
                  <span>{log.count} image{log.count === 1 ? "" : "s"}</span>
                  <span>{log.style}</span>
                  <span>{log.productAssets} assets</span>
                  <span>{log.references} refs</span>
                </div>
                <p className="mt-1 line-clamp-1 text-xs text-[#475467]">{log.prompt}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <AddImagesDialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
        <DialogContent className="max-h-[88vh] max-w-5xl overflow-hidden rounded-[28px] border-black/10 bg-white p-0">
          <DialogHeader className="border-b border-black/10 px-6 py-5">
            <DialogTitle>Add images</DialogTitle>
          </DialogHeader>

          <input
            ref={referenceUploadInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              void uploadReferences(event.target.files);
              event.target.value = "";
            }}
          />

          <div className="grid max-h-[calc(88vh-84px)] overflow-y-auto lg:grid-cols-[280px_1fr]">
            <div className="space-y-3 border-b border-black/10 bg-slate-50 p-5 lg:border-b-0 lg:border-r">
              <Button
                type="button"
                className="w-full rounded-2xl bg-[#1f1f1f] text-white hover:bg-black"
                onClick={() => referenceUploadInputRef.current?.click()}
                disabled={isUploadingReferences || !selectedClientId}
              >
                {isUploadingReferences ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {isUploadingReferences ? "Uploading..." : "Upload reference"}
              </Button>
              <div className="rounded-2xl border border-black/10 bg-white p-3">
                <p className="text-sm font-semibold text-[#1f1f1f]">Website assets</p>
                <p className="mt-1 text-xs leading-5 text-[#667085]">
                  ใช้ OpenBrand เพื่อดึง logo และ brand colors แล้วเซฟไว้กับ client นี้
                </p>
                <div className="mt-3 space-y-2">
                  <Input
                    value={brandWebsiteUrl}
                    onChange={(event) => {
                      setBrandWebsiteUrl(event.target.value);
                      setBrandAssetMessage("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void extractBrandAssets();
                      }
                    }}
                    placeholder="https://brand.com"
                    className="h-10 rounded-full border-black/10 bg-white text-sm focus-visible:ring-0"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void extractBrandAssets()}
                    disabled={!brandWebsiteUrl.trim() || !selectedClientId || isExtractingBrandAssets}
                    className="h-10 w-full rounded-full border-black/10 bg-white text-sm"
                  >
                    {isExtractingBrandAssets ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Extract brand assets
                  </Button>
                </div>
                {brandAssetMessage && (
                  <p className="mt-2 text-xs leading-5 text-[#667085]">{brandAssetMessage}</p>
                )}
              </div>
              <div className="rounded-2xl border border-black/10 bg-white p-3 text-xs leading-5 text-[#667085]">
                Product assets preserve the actual product. References guide mood, composition, and visual style.
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ImageCountSummary label="Product assets" count={selectedMaterials.length} />
                <ImageCountSummary
                  label="References"
                  count={selectedReferenceImages.length + uploadedReferenceFiles.length}
                />
              </div>
            </div>

            <div className="space-y-5 p-5">
              <ImagePickerSection
                title="Product assets"
                loading={loadingMaterialImages}
                emptyText="No saved product assets."
                columns="grid-cols-4 sm:grid-cols-5"
              >
                {visibleMaterialImages.map((asset) => {
                  const isSelected = selectedMaterials.includes(asset.url);
                  return (
                    <button
                      key={asset.url}
                      type="button"
                      onClick={() => toggleMaterial(asset.url)}
                      className={cn(
                        "relative aspect-square overflow-hidden rounded-xl border bg-slate-50 transition",
                        isSelected ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20" : "border-black/10 hover:border-black/25",
                      )}
                    >
                      <img src={asset.url} alt="Product asset" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      {isSelected && (
                        <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
                          <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </ImagePickerSection>

              <ImagePickerSection
                title={`Reference images ${selectedReferenceImages.length}/${maxReferenceSelection}`}
                loading={loadingReferenceImages}
                emptyText="No saved reference images."
                columns="grid-cols-3 sm:grid-cols-4"
              >
                {visibleReferenceImages.map((reference) => {
                  const isSelected = selectedReferenceImages.includes(reference.url);
                  return (
                    <button
                      key={reference.url}
                      type="button"
                      onClick={() => toggleReference(reference.url)}
                      className={cn(
                        "relative aspect-[4/3] overflow-hidden rounded-xl border bg-slate-50 transition",
                        isSelected ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20" : "border-black/10 hover:border-black/25",
                      )}
                    >
                      <img src={reference.url} alt="Reference" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      {isSelected && (
                        <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
                          <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </ImagePickerSection>

              {uploadedReferencePreviews.length > 0 && (
                <ImagePickerSection title="Uploaded references" loading={false} emptyText="" columns="grid-cols-3 sm:grid-cols-4">
                  {uploadedReferencePreviews.map((preview) => (
                    <div
                      key={`${preview.file.name}-${preview.file.lastModified}`}
                      className="relative aspect-[4/3] overflow-hidden rounded-xl border border-black/10 bg-slate-50"
                    >
                      <img src={preview.url} alt={preview.file.name} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setUploadedReferenceFiles((current) => current.filter((file) => file !== preview.file))}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-xs font-semibold text-[#475467] shadow-sm ring-1 ring-black/10 transition hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove uploaded reference"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </ImagePickerSection>
              )}
            </div>
          </div>
        </DialogContent>
      </AddImagesDialog>
    </section>
  );
}

// Randomly pick between min and max items from a list (used to vary page-style references per run).
function pickRandomItems<T>(items: T[], min: number, max: number): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const target = Math.min(items.length, min + Math.floor(Math.random() * (max - min + 1)));
  return shuffled.slice(0, target);
}

function mapIdeaToSavedTopic(
  idea: IdeaRecommendation,
  clientName: string | undefined,
  productFocus: string,
): SavedTopic {
  const description =
    typeof idea.description === "string"
      ? idea.description
      : Array.isArray(idea.description)
        ? idea.description.map((item) => item.text).filter(Boolean).join("\n")
        : idea.description?.summary || "";

  return {
    ...idea,
    description,
    clientname: clientName || "",
    productfocus: productFocus,
  };
}
