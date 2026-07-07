"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { downloadGeneratedAdImage, requestGeneratedAdImages } from "@/lib/images/generated-ads-client";
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
import { AlertCircle, Bookmark, Check, Download, FileText, Files, ImageIcon, Images, Loader2, Palette, Pencil, RectangleHorizontal, Sparkles, Upload, Wand2, X } from "lucide-react";
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

type BrandCiItem = {
  id: string;
  clientId: string;
  title: string;
  body: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  source: string;
  createdAt: string;
  updatedAt: string;
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
  const [referenceStyleEnabled, setReferenceStyleEnabled] = useState(true);
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
  const [brandCiItems, setBrandCiItems] = useState<BrandCiItem[]>([]);
  const [brandCiDraftTitle, setBrandCiDraftTitle] = useState("");
  const [brandCiDraftText, setBrandCiDraftText] = useState("");
  const [isLoadingBrandCi, setIsLoadingBrandCi] = useState(false);
  const [isSavingBrandCi, setIsSavingBrandCi] = useState(false);
  const [isReadingBrandCi, setIsReadingBrandCi] = useState(false);
  const [isBrandCiDialogOpen, setIsBrandCiDialogOpen] = useState(false);
  const [brandCiMessage, setBrandCiMessage] = useState("");
  const [requiredLogoUrl, setRequiredLogoUrl] = useState("");
  const [requiredLogoName, setRequiredLogoName] = useState("");
  const [isLoadingRequiredLogo, setIsLoadingRequiredLogo] = useState(false);
  const [logoRequiredMessage, setLogoRequiredMessage] = useState("");
  const [brandWebsiteUrl, setBrandWebsiteUrl] = useState("");
  const [isExtractingBrandAssets, setIsExtractingBrandAssets] = useState(false);
  const [brandAssetMessage, setBrandAssetMessage] = useState("");
  const [previewImage, setPreviewImage] = useState<GeneratedImage | null>(null);
  const [savingImageIds, setSavingImageIds] = useState<string[]>([]);
  const [savedImageIds, setSavedImageIds] = useState<string[]>([]);
  const referenceUploadInputRef = useRef<HTMLInputElement>(null);
  const brandCiInputRef = useRef<HTMLInputElement>(null);
  const requiredLogoInputRef = useRef<HTMLInputElement>(null);
  const brandAssetUploadInputRef = useRef<HTMLInputElement>(null);

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
    isUploadingMaterials,
    loadingMaterialImages,
    materialInputRef,
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
    uploadMaterials,
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
    loadAssets: isMaterialsMenuOpen || isBrandCiDialogOpen,
    loadReferences: isReferencesMenuOpen,
  });

  const visibleIdeas = savedTopics;
  const visibleMaterialImages = useMemo(() => materialImages.slice(0, 80), [materialImages]);
  const visibleReferenceImages = useMemo(() => referenceImages.slice(0, 80), [referenceImages]);
  const colorPickerValue = useMemo(() => {
    const draftColor = colorInput.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
    if (/^[0-9a-fA-F]{6}$/.test(draftColor)) {
      return `#${draftColor}`;
    }

    const firstSavedColor = (colorPalette[0] || "").replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
    return /^[0-9a-fA-F]{6}$/.test(firstSavedColor) ? `#${firstSavedColor}` : "#265484";
  }, [colorInput, colorPalette]);
  const canAddBrandColor = /^[0-9a-fA-F]{6}$/.test(colorInput.replace(/[^0-9a-fA-F]/g, ""));
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
  const activeBrandCiText = useMemo(
    () =>
      brandCiItems
        .filter((item) => item.body.trim())
        .map((item, index) => `Brand CI ${index + 1}: ${item.title}\n${item.body.trim()}`)
        .join("\n\n---\n\n"),
    [brandCiItems],
  );
  const activeBrandCiFileName = useMemo(() => {
    if (brandCiItems.length === 0) return "";
    if (brandCiItems.length === 1) return brandCiItems[0]?.fileName || brandCiItems[0]?.title || "Brand CI";
    return `${brandCiItems.length} Brand CI items`;
  }, [brandCiItems]);

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
    setReferenceStyleEnabled(true);
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
    setRequiredLogoUrl("");
    setRequiredLogoName("");
    setLogoRequiredMessage("");
    setPreviewImage(null);
    setSavingImageIds([]);
    setSavedImageIds([]);
    setPageReferenceUrl("");
    setPageReferenceImages([]);
    setPageReferenceMessage("");
  }, [selectedClientId]);

  useEffect(() => {
    let cancelled = false;

    async function loadRequiredLogo() {
      if (!selectedClientId) {
        setIsLoadingRequiredLogo(false);
        return;
      }
      setIsLoadingRequiredLogo(true);
      try {
        const response = await fetch(
          `/api/text-to-image/brand-logo?clientId=${encodeURIComponent(selectedClientId)}`,
        );
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload?.error || "Cannot load brand logo");
        }
        if (!cancelled && payload.logo?.url) {
          setRequiredLogoUrl(payload.logo.url);
          setRequiredLogoName(payload.logo.name || "Brand logo");
          selectMaterial(payload.logo.url);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[Text to Image] Failed to load saved logo:", error);
          setLogoRequiredMessage("โหลดโลโก้ที่บันทึกไว้ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        }
      } finally {
        if (!cancelled) setIsLoadingRequiredLogo(false);
      }
    }

    void loadRequiredLogo();
    return () => {
      cancelled = true;
    };
  }, [selectMaterial, selectedClientId]);

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

  const loadBrandCiItems = async (clientIdToLoad = selectedClientId) => {
    if (!clientIdToLoad) {
      setBrandCiItems([]);
      return;
    }

    setIsLoadingBrandCi(true);
    try {
      const response = await fetch(`/api/text-to-image/brand-ci?clientId=${encodeURIComponent(clientIdToLoad)}`);
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload?.error || "Cannot load Brand CI");
      }
      setBrandCiItems(Array.isArray(payload.items) ? payload.items : []);
    } catch (error) {
      console.error("[Text to Image] Failed to load Brand CI:", error);
      setBrandCiMessage(error instanceof Error ? error.message : "Cannot load Brand CI");
      setBrandCiItems([]);
    } finally {
      setIsLoadingBrandCi(false);
    }
  };

  useEffect(() => {
    setBrandCiMessage("");
    setBrandCiDraftTitle("");
    setBrandCiDraftText("");
    void loadBrandCiItems(selectedClientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  const saveBrandCiItem = async (item: {
    title?: string;
    body: string;
    fileName?: string;
    fileType?: string;
    fileUrl?: string;
    source?: string;
  }) => {
    if (!selectedClientId) {
      throw new Error("เลือก client ก่อนเซฟ Brand CI");
    }

    const body = item.body.trim();
    if (!body) {
      throw new Error("Brand CI text ว่างอยู่");
    }

    const response = await fetch("/api/text-to-image/brand-ci", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: selectedClientId,
        title: item.title?.trim() || item.fileName || "Brand CI",
        body,
        fileName: item.fileName || "",
        fileType: item.fileType || "",
        fileUrl: item.fileUrl || "",
        source: item.source || "manual",
      }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload?.error || "Cannot save Brand CI");
    }
    setBrandCiItems((current) => [payload.item, ...current]);
    return payload.item as BrandCiItem;
  };

  const updateBrandCiItem = async (item: BrandCiItem) => {
    if (!selectedClientId) return;
    setIsSavingBrandCi(true);
    setBrandCiMessage("");
    try {
      const response = await fetch("/api/text-to-image/brand-ci", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          clientId: selectedClientId,
          title: item.title,
          body: item.body,
          fileName: item.fileName,
          fileType: item.fileType,
          fileUrl: item.fileUrl,
          source: item.source,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload?.error || "Cannot update Brand CI");
      }
      setBrandCiItems((current) => current.map((currentItem) => currentItem.id === item.id ? payload.item : currentItem));
      setBrandCiMessage("อัปเดต Brand CI แล้ว");
    } catch (error) {
      setBrandCiMessage(error instanceof Error ? error.message : "Cannot update Brand CI");
    } finally {
      setIsSavingBrandCi(false);
    }
  };

  const deleteBrandCiItem = async (itemId: string) => {
    if (!selectedClientId || !itemId) return;
    setIsSavingBrandCi(true);
    setBrandCiMessage("");
    try {
      const response = await fetch(
        `/api/text-to-image/brand-ci?id=${encodeURIComponent(itemId)}&clientId=${encodeURIComponent(selectedClientId)}`,
        { method: "DELETE" },
      );
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload?.error || "Cannot delete Brand CI");
      }
      setBrandCiItems((current) => current.filter((item) => item.id !== itemId));
      setBrandCiMessage("ลบ Brand CI แล้ว");
    } catch (error) {
      setBrandCiMessage(error instanceof Error ? error.message : "Cannot delete Brand CI");
    } finally {
      setIsSavingBrandCi(false);
    }
  };

  const handleAddManualBrandCi = async () => {
    const body = brandCiDraftText.trim();
    if (!body || isSavingBrandCi) return;

    setIsSavingBrandCi(true);
    setBrandCiMessage("");
    try {
      await saveBrandCiItem({
        title: brandCiDraftTitle || "Manual Brand CI",
        body,
        source: "manual",
      });
      setBrandCiDraftTitle("");
      setBrandCiDraftText("");
      setBrandCiMessage("เพิ่ม Brand CI text แล้ว");
    } catch (error) {
      setBrandCiMessage(error instanceof Error ? error.message : "Cannot save Brand CI");
    } finally {
      setIsSavingBrandCi(false);
    }
  };

  const handleBrandCiUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    if (!selectedClientId) {
      alert("เลือก client ก่อนอัปโหลด Brand CI");
      return;
    }

    setIsReadingBrandCi(true);
    setBrandCiMessage("");
    let savedCount = 0;
    try {
      for (const file of files) {
        const extension = file.name.split(".").pop()?.toLowerCase();
        if (!["pdf", "txt", "png", "jpg", "jpeg"].includes(extension || "")) {
          throw new Error(`รองรับเฉพาะไฟล์ PDF, TXT, PNG และ JPG: ${file.name}`);
        }
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`ไฟล์ Brand CI ต้องมีขนาดไม่เกิน 10 MB: ${file.name}`);
        }

        let text = "";
        if (extension === "txt") {
          text = (await file.text()).trim();
        } else {
          const formData = new FormData();
          formData.append("file", file);
          const response = await fetch("/api/brand-ci/extract", { method: "POST", body: formData });
          const result = await response.json();
          if (!response.ok || !result.success) {
            throw new Error(result.error || `อ่าน Brand CI ไม่สำเร็จ: ${file.name}`);
          }
          text = String(result.text || "").trim();
        }

        if (!text) throw new Error(`ไฟล์นี้ไม่มีข้อความที่ใช้งานได้: ${file.name}`);

        let uploadedUrl = "";
        if (file.type.startsWith("image/")) {
          uploadedUrl = await uploadFileToImageStorage(file, `materials/${selectedClientId}`);
          selectMaterial(uploadedUrl);
        }

        await saveBrandCiItem({
          title: file.name.replace(/\.[^.]+$/, ""),
          body: text,
          fileName: file.name,
          fileType: file.type || extension || "",
          fileUrl: uploadedUrl,
          source: "file",
        });
        savedCount += 1;
      }
      await loadMaterialImages(selectedClientId);
      setBrandCiMessage(`อัปโหลดและเซฟ Brand CI แล้ว ${savedCount} ไฟล์`);
    } catch (error) {
      setBrandCiMessage(error instanceof Error ? error.message : "อ่าน Brand CI ไม่สำเร็จ");
    } finally {
      setIsReadingBrandCi(false);
    }
  };

  const handleRequiredLogoUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoRequiredMessage("กรุณาอัปโหลดไฟล์โลโก้เป็นรูปภาพเท่านั้น");
      return;
    }

    const uploadedUrls = await uploadMaterials(files);
    const logoUrl = Array.isArray(uploadedUrls) ? uploadedUrls[0] : "";
    if (logoUrl) {
      try {
        const response = await fetch("/api/text-to-image/brand-logo", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: selectedClientId, logoUrl, logoName: file.name }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload?.error || "Cannot save brand logo");
        }
        setRequiredLogoUrl(payload.logo?.url || logoUrl);
        setRequiredLogoName(payload.logo?.name || file.name);
        setLogoRequiredMessage("");
        setBrandCiMessage("อัปโหลดและบันทึกโลโก้แล้ว ระบบจะใช้โลโก้นี้กับ client นี้ต่อไป");
      } catch (error) {
        console.error("[Text to Image] Failed to save uploaded logo:", error);
        setLogoRequiredMessage("อัปโหลดไฟล์แล้ว แต่บันทึกโลโก้ลงฐานข้อมูลไม่สำเร็จ กรุณาลองใหม่");
      }
    }
  };

  const saveRequiredLogo = async (logoUrl: string, logoName: string) => {
    const response = await fetch("/api/text-to-image/brand-logo", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: selectedClientId, logoUrl, logoName }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload?.error || "Cannot save brand logo");
    }
    return payload.logo as { url: string; name: string };
  };

  const generateImages = async (message = "", files: File[] = []) => {
    if (generationInFlightRef.current) return;
    if (!selectedClientId || !selectedProductFocus || !clientName) {
      alert("กรุณาเลือก Client และ Product Focus ก่อน");
      return;
    }

    if (isLoadingRequiredLogo) {
      setLogoRequiredMessage("กำลังโหลดโลโก้ที่บันทึกไว้ กรุณารอสักครู่");
      return;
    }

    if (!requiredLogoUrl) {
      setLogoRequiredMessage("กรุณาอัปโหลดโลโก้ก่อน Generate Image");
      setIsBrandCiDialogOpen(true);
      return;
    }

    const normalizedMessage = message.trim();
    const usingIdea = briefSource === "idea" && selectedTopicData;
    const promptText = normalizedMessage;
    const attachedReferenceFiles = files.filter((file) => file.type.startsWith("image/"));
    const hasReferenceStyleSource =
      selectedReferenceImages.length > 0 ||
      uploadedReferenceFiles.length > 0 ||
      attachedReferenceFiles.length > 0 ||
      (selectedAdStyle === PAGE_REFERENCE_STYLE_VALUE && pageReferenceImages.length > 0);

    if (!usingIdea && !promptText) {
      alert("กรุณาเลือก saved idea หรือพิมพ์ brief ก่อน generate");
      return;
    }

    if (referenceStyleEnabled && !hasReferenceStyleSource) {
      alert("Reference style เปิดอยู่ กรุณาเลือกหรือแนบ reference image ก่อน Generate Image");
      setIsImageDialogOpen(true);
      return;
    }

    generationInFlightRef.current = true;
    setIsGenerating(true);
    setLastBrief(promptText);

    const requestIds = Array.from({ length: imageCount }, () => crypto.randomUUID());
    const topicTitle = usingIdea ? selectedTopicData.title : "Custom brief";
    const topicSummary = usingIdea ? selectedTopicSummary : promptText;

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
      const referenceFiles = referenceStyleEnabled ? [...uploadedReferenceFiles, ...attachedReferenceFiles] : [];
      const referenceImageUrls = await Promise.all(
        referenceFiles.map((file) => uploadFileToImageStorage(file, "generated/text-to-image-references")),
      );
      const pageStyleReferenceUrls =
        referenceStyleEnabled && selectedAdStyle === PAGE_REFERENCE_STYLE_VALUE && pageReferenceImages.length > 0
          ? pickRandomItems(pageReferenceImages.map((image) => image.url), 2, 3)
          : [];
      const allReferenceImageUrls = referenceStyleEnabled
        ? Array.from(new Set([
            ...selectedReferenceImages,
            ...referenceImageUrls,
            ...pageStyleReferenceUrls,
          ]))
        : [];
      const materialImageUrls = Array.from(new Set([requiredLogoUrl, ...selectedMaterials].filter(Boolean)));

      const payload = buildGeneratedAdRequestPayload({
        prompt: promptText,
        referenceImageUrls: allReferenceImageUrls,
        clientName,
        productFocus: selectedProductFocus,
        selectedTopicData: usingIdea ? selectedTopicData : null,
        selectedVisualRoute,
        colorPalette,
        materialImageUrls,
        adStyleLabel: selectedAdStyleOption?.label || null,
        userBrief: selectedAdStyleOption?.userBrief || "",
        referenceStyleEnabled,
        creativeFormat: selectedCreativeFormat.value,
        creativeFormatLabel: selectedCreativeFormat.label,
        aspectRatio,
        imageCount,
        brandCiText: activeBrandCiText,
        brandCiFileName: activeBrandCiFileName,
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
          productAssets: materialImageUrls.length,
          references: allReferenceImageUrls.length,
        },
        ...prev,
      ].slice(0, 8));

      const returnedImages = await requestGeneratedAdImages(payload);
      const returnedByRequestId = new Map(
        requestIds.map((requestId, index) => [requestId, returnedImages[index]]),
      );
      const extraReturnedImages = returnedImages.slice(requestIds.length);

      setGeneratedImages((prev) => {
        const updatedImages = prev.map((image) => {
          const returnedImage = returnedByRequestId.get(image.id);
          if (!requestIds.includes(image.id)) return image;
          if (!returnedImage) return { ...image, status: "error" as const };
          return {
            ...image,
            url: returnedImage.url,
            source: returnedImage.source,
            status: "completed" as const,
            reference_image: allReferenceImageUrls[0],
          };
        });
        const extraImages = extraReturnedImages.map((returnedImage) => ({
          id: crypto.randomUUID(),
          url: returnedImage.url,
          prompt: promptText,
          topicTitle,
          topicSummary,
          status: "completed" as const,
          created_at: new Date().toISOString(),
          aspectRatio,
          operation: "generate" as const,
          source: returnedImage.source,
          reference_image: allReferenceImageUrls[0],
        }));
        if (extraImages.length === 0) return updatedImages;

        const lastRequestIndex = updatedImages.reduce(
          (lastIndex, image, index) => (requestIds.includes(image.id) ? index : lastIndex),
          -1,
        );
        if (lastRequestIndex < 0) return [...extraImages, ...updatedImages];
        return [
          ...updatedImages.slice(0, lastRequestIndex + 1),
          ...extraImages,
          ...updatedImages.slice(lastRequestIndex + 1),
        ];
      });

      if (returnedImages.length < imageCount) {
        alert(`สร้างสำเร็จ ${returnedImages.length} จาก ${imageCount} รูป`);
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
        const savedLogo = await saveRequiredLogo(payload.logo_material_url, "OpenBrand logo");
        selectMaterial(payload.logo_material_url);
        setRequiredLogoUrl(savedLogo?.url || payload.logo_material_url);
        setRequiredLogoName(savedLogo?.name || "OpenBrand logo");
        setLogoRequiredMessage("");
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
                    const previewVisualRoute =
                      ideaVisualRoutes?.[
                        isSelected && selectedVisualRouteIndex !== null ? selectedVisualRouteIndex : 0
                      ];
                    const previewVisualDirection =
                      previewVisualRoute?.visual_idea ||
                      previewVisualRoute?.why_it_fits ||
                      "";

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

                          {(idea.copywriting?.cta || previewVisualDirection) && (
                            <div className="mt-3 grid gap-2 border-t border-black/5 pt-2.5">
                              {previewVisualDirection && (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#667085]">
                                    Visual direction
                                  </p>
                                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#475467]">
                                    {previewVisualDirection}
                                  </p>
                                </div>
                              )}
                              {idea.copywriting?.cta && (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#667085]">CTA</p>
                                  <p className="mt-1 line-clamp-1 text-xs font-medium leading-5 text-[#1f1f1f]">
                                    {idea.copywriting.cta}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
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
            preserveInputOnSend
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
                <input
                  ref={brandCiInputRef}
                  type="file"
                  accept=".pdf,.txt,.png,.jpg,.jpeg,application/pdf,text/plain,image/png,image/jpeg"
                  multiple
                  className="hidden"
                  onChange={handleBrandCiUpload}
                />
                <input
                  ref={requiredLogoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    void handleRequiredLogoUpload(event.target.files);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setIsBrandCiDialogOpen(true)}
                  disabled={isReadingBrandCi}
                  className={cn(
                    "flex h-8 items-center gap-1 rounded-full px-2 transition",
                    activeBrandCiText
                      ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100"
                      : "text-[#777] hover:bg-indigo-50 hover:text-indigo-700",
                  )}
                  aria-label="Upload Brand CI"
                  title={activeBrandCiFileName || "Preview or upload Brand CI"}
                >
                  {isReadingBrandCi ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  <span className="max-w-20 truncate text-xs font-medium">{activeBrandCiFileName || "Brand CI"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => requiredLogoInputRef.current?.click()}
                  disabled={isUploadingMaterials || isLoadingRequiredLogo}
                  className={cn(
                    "flex h-8 items-center gap-1 rounded-full px-2 transition",
                    requiredLogoUrl
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                      : "bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-100",
                  )}
                  aria-label="Upload required logo"
                  title={requiredLogoName || "Upload required logo"}
                >
                  {isUploadingMaterials || isLoadingRequiredLogo ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : requiredLogoUrl ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <span className="max-w-20 truncate text-xs font-medium">
                    {requiredLogoName || "Logo required"}
                  </span>
                </button>

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

                <label
                  className={cn(
                    "flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 transition",
                    referenceStyleEnabled
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                      : "border-black/10 bg-white text-[#667085] hover:bg-black/[0.03]",
                  )}
                  title="Learn the visual system from selected references, then adapt it to the brand and concept"
                >
                  <Switch
                    checked={referenceStyleEnabled}
                    onCheckedChange={setReferenceStyleEnabled}
                    className="scale-75 data-[state=checked]:bg-indigo-600"
                    aria-label="Reference style"
                  />
                  <span className="whitespace-nowrap text-xs font-medium">Reference style</span>
                </label>

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
                          onClick={() => {
                            setSelectedAdStyle(style.value);
                            if (style.value === PAGE_REFERENCE_STYLE_VALUE) setReferenceStyleEnabled(true);
                          }}
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

          {logoRequiredMessage && (
            <p className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {logoRequiredMessage}
            </p>
          )}

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

      <Dialog open={isBrandCiDialogOpen} onOpenChange={setIsBrandCiDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden rounded-[28px] border-black/10 bg-white p-0">
          <input
            ref={brandAssetUploadInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              void uploadMaterials(event.target.files);
              event.target.value = "";
            }}
          />
          <DialogHeader className="border-b border-black/10 px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-lg text-[#101828]">
              <FileText className="h-5 w-5 text-indigo-600" />
              Brand CI preview
            </DialogTitle>
            <p className="text-sm leading-relaxed text-[#667085]">
              {clientName
                ? `ข้อมูลนี้ผูกกับ ${clientName} และจะถูกใช้เป็น brand context ตอน generate`
                : "เลือก client ก่อนเพื่อเซฟ Brand CI และ assets ไว้ใช้ซ้ำ"}
            </p>
          </DialogHeader>

          <div className="grid max-h-[calc(90vh-92px)] overflow-y-auto lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4 border-b border-black/10 p-5 lg:border-b-0 lg:border-r">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="rounded-full bg-[#101828] text-white hover:bg-black"
                  onClick={() => brandCiInputRef.current?.click()}
                  disabled={isReadingBrandCi}
                >
                  {isReadingBrandCi ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {isReadingBrandCi ? "Reading CI..." : "Upload Brand CI files"}
                </Button>
                <Button
                  type="button"
                  variant={requiredLogoUrl ? "outline" : "default"}
                  className={cn(
                    "rounded-full",
                    requiredLogoUrl
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "bg-red-600 text-white hover:bg-red-700",
                  )}
                  onClick={() => requiredLogoInputRef.current?.click()}
                  disabled={!selectedClientId || isUploadingMaterials || isLoadingRequiredLogo}
                >
                  {isUploadingMaterials || isLoadingRequiredLogo ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : requiredLogoUrl ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : (
                    <AlertCircle className="mr-2 h-4 w-4" />
                  )}
                  {requiredLogoUrl ? "Logo uploaded" : "Upload required logo"}
                </Button>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-[#475467]">
                  {isLoadingBrandCi ? "Loading..." : `${brandCiItems.length} saved`}
                </span>
              </div>

              {logoRequiredMessage && (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {logoRequiredMessage}
                </p>
              )}

              {requiredLogoName && (
                <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  โลโก้ที่ใช้: {requiredLogoName}
                </p>
              )}

              {brandCiMessage && (
                <p className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700">
                  {brandCiMessage}
                </p>
              )}

              <div className="rounded-[22px] border border-black/10 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#101828]">Add Brand CI text</p>
                    <p className="mt-1 text-xs text-[#667085]">พิมพ์เองได้หลายอัน และเซฟลง database ให้ทีมเห็นร่วมกัน</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <Input
                    value={brandCiDraftTitle}
                    onChange={(event) => setBrandCiDraftTitle(event.target.value)}
                    placeholder="Title เช่น Logo usage, Tone of voice, Campaign CI"
                    className="rounded-2xl border-black/10 bg-white"
                    disabled={isSavingBrandCi}
                  />
                  <Textarea
                    value={brandCiDraftText}
                    onChange={(event) => setBrandCiDraftText(event.target.value)}
                    className="min-h-[120px] resize-y rounded-2xl border-black/10 bg-white text-sm leading-6 text-[#344054] focus-visible:ring-indigo-200"
                    placeholder="Paste or type Brand CI rules here..."
                    disabled={isSavingBrandCi}
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      className="rounded-full bg-[#101828] text-white hover:bg-black"
                      onClick={() => void handleAddManualBrandCi()}
                      disabled={!brandCiDraftText.trim() || isSavingBrandCi || !selectedClientId}
                    >
                      {isSavingBrandCi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                      Save text
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-[22px] border border-black/10 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#101828]">Saved Brand CI</p>
                    <p className="mt-1 text-xs text-[#667085]">แก้ไข ลบ หรือเพิ่มไฟล์ใหม่ได้ตลอด</p>
                  </div>
                </div>

                {isLoadingBrandCi ? (
                  <div className="flex h-40 items-center justify-center rounded-2xl bg-slate-50 text-sm text-[#667085]">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading Brand CI...
                  </div>
                ) : brandCiItems.length > 0 ? (
                  <div className="max-h-[430px] space-y-3 overflow-y-auto pr-1">
                    {brandCiItems.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-black/10 bg-slate-50 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <Input
                            value={item.title}
                            onChange={(event) =>
                              setBrandCiItems((current) =>
                                current.map((currentItem) =>
                                  currentItem.id === item.id ? { ...currentItem, title: event.target.value } : currentItem,
                                ),
                              )
                            }
                            className="h-9 rounded-xl border-black/10 bg-white text-sm font-semibold"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0 rounded-full border-black/10"
                            onClick={() => void updateBrandCiItem(item)}
                            disabled={isSavingBrandCi || !item.body.trim()}
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0 rounded-full border-rose-200 text-rose-600 hover:bg-rose-50"
                            onClick={() => void deleteBrandCiItem(item.id)}
                            disabled={isSavingBrandCi}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <Textarea
                          value={item.body}
                          onChange={(event) =>
                            setBrandCiItems((current) =>
                              current.map((currentItem) =>
                                currentItem.id === item.id ? { ...currentItem, body: event.target.value } : currentItem,
                              ),
                            )
                          }
                          className="min-h-[130px] resize-y rounded-xl border-black/10 bg-white text-sm leading-6 text-[#344054]"
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#667085]">
                          <span className="rounded-full bg-white px-2 py-1">{item.source}</span>
                          {item.fileName && <span className="truncate rounded-full bg-white px-2 py-1">{item.fileName}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-slate-50 px-6 text-center">
                    <FileText className="h-8 w-8 text-[#98a2b3]" />
                    <p className="mt-3 text-sm font-semibold text-[#101828]">No Brand CI yet</p>
                    <p className="mt-1 max-w-sm text-sm leading-6 text-[#667085]">
                      Upload multiple files or add manual text. Everything is saved per client in database.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 bg-[#fbfcfe] p-5">
              <div className="rounded-[22px] border border-black/10 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#101828]">Brand colors</p>
                    <p className="mt-1 text-xs text-[#667085]">เลือกจาก color picker หรือกรอก HEX แล้วบันทึกให้ client นี้</p>
                  </div>
                  <Palette className="h-4 w-4 text-[#667085]" />
                </div>

                <div className="mb-4 grid grid-cols-[44px_minmax(0,1fr)_auto] gap-2">
                  <input
                    type="color"
                    value={colorPickerValue}
                    onChange={(event) => setColorInput(event.target.value.toUpperCase())}
                    className="h-10 w-11 cursor-pointer rounded-xl border border-black/10 bg-white p-1"
                    aria-label="Choose brand color"
                    title="Choose brand color"
                  />
                  <Input
                    value={colorInput}
                    onChange={(event) => setColorInput(event.target.value.toUpperCase())}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && canAddBrandColor) {
                        event.preventDefault();
                        addColor();
                      }
                    }}
                    placeholder="#265484"
                    maxLength={7}
                    aria-label="Brand color HEX value"
                    className="h-10 rounded-xl border-black/10 bg-white font-mono uppercase focus-visible:ring-indigo-200"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addColor}
                    disabled={!canAddBrandColor}
                    className="h-10 rounded-xl border-black/10 bg-white px-4 text-sm font-semibold"
                  >
                    Add
                  </Button>
                </div>

                {colorPalette.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {colorPalette.slice(0, 12).map((color, index) => (
                      <div key={`${color}-${index}`} className="relative rounded-2xl border border-black/10 bg-white p-2">
                        <div
                          className="h-12 rounded-xl border border-black/10"
                          style={{ backgroundColor: `#${color.replace("#", "")}` }}
                        />
                        <p className="mt-1 truncate text-center text-[11px] font-medium text-[#667085]">
                          #{color.replace("#", "")}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeColor(index)}
                          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border border-black/10 bg-white text-[#667085] shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                          aria-label={`Remove #${color.replace("#", "")}`}
                          title={`Remove #${color.replace("#", "")}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-[#667085]">
                    ยังไม่มีสีของแบรนด์ เลือกสีด้านบนหรือกรอก HEX เพื่อเริ่มสร้าง palette
                  </p>
                )}

                <Button
                  type="button"
                  onClick={() => void savePalette()}
                  disabled={!selectedClientId || isSavingPalette}
                  className="mt-4 h-10 w-full rounded-xl bg-[#101828] text-sm font-semibold text-white hover:bg-black"
                >
                  {isSavingPalette ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Palette className="mr-2 h-4 w-4" />}
                  {isSavingPalette ? "Saving..." : "Save brand colors"}
                </Button>
              </div>

              <div className="rounded-[22px] border border-black/10 bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#101828]">Saved client assets</p>
                    <p className="mt-1 text-xs text-[#667085]">Logo/materials ที่เก็บไว้ กดเพื่อเลือกใช้ตอน generate</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full border-black/10"
                    onClick={() => brandAssetUploadInputRef.current?.click()}
                    disabled={!selectedClientId || isUploadingMaterials}
                  >
                    {isUploadingMaterials ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-2 h-3.5 w-3.5" />}
                    Add
                  </Button>
                </div>

                {loadingMaterialImages ? (
                  <div className="flex h-56 items-center justify-center rounded-2xl bg-slate-50 text-sm text-[#667085]">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading assets...
                  </div>
                ) : visibleMaterialImages.length > 0 ? (
                  <div className="grid max-h-[360px] grid-cols-3 gap-2 overflow-y-auto pr-1">
                    {visibleMaterialImages.slice(0, 30).map((asset) => {
                      const isSelected = selectedMaterials.includes(asset.url);
                      return (
                        <button
                          key={asset.url}
                          type="button"
                          onClick={() => toggleMaterial(asset.url)}
                          className={cn(
                            "group relative overflow-hidden rounded-2xl border bg-white transition",
                            isSelected ? "border-indigo-500 ring-2 ring-indigo-200" : "border-black/10 hover:border-indigo-200",
                          )}
                          title={asset.name}
                        >
                          <div className="relative aspect-square">
                            <Image
                              src={asset.url}
                              alt={asset.name}
                              fill
                              sizes="160px"
                              className="object-contain p-2"
                            />
                          </div>
                          {isSelected && (
                            <span className="absolute right-2 top-2 rounded-full bg-indigo-600 p-1 text-white shadow">
                              <Check className="h-3 w-3" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-slate-50 px-6 text-center">
                    <Images className="h-8 w-8 text-[#98a2b3]" />
                    <p className="mt-3 text-sm font-semibold text-[#101828]">No saved assets</p>
                    <p className="mt-1 text-sm leading-6 text-[#667085]">
                      Upload logo, product, model, or CI image once and reuse it later.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AddImagesDialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
        <DialogContent className="max-h-[88vh] max-w-5xl overflow-hidden rounded-[28px] border-black/10 bg-white p-0">
          <DialogHeader className="border-b border-black/10 px-6 py-5">
            <DialogTitle>Add images</DialogTitle>
          </DialogHeader>

          <input
            ref={materialInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              void uploadMaterials(event.target.files);
              event.target.value = "";
            }}
          />

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
                onClick={() => materialInputRef.current?.click()}
                disabled={isUploadingMaterials || !selectedClientId}
              >
                {isUploadingMaterials ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {isUploadingMaterials ? "Uploading..." : "Upload product asset"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-2xl border-black/10 bg-white text-[#1f1f1f]"
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
