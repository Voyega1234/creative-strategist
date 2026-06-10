import type { VisualRoute } from "@/lib/ideas/types"

export interface ReferenceImage {
  name: string
  url: string
  size: number
  created_at: string
}

export interface GeneratedImage {
  id: string
  url: string
  prompt: string
  topicTitle?: string
  topicSummary?: string
  reference_image?: string
  status: "generating" | "completed" | "error"
  created_at: string
  source?: string
  aspectRatio?: string
  resolution?: string
  operation?: "generate" | "upscale" | "remove_text"
  sourceImageUrl?: string
  sourceImageId?: string
}

export interface SavedTopic {
  title: string
  description: string
  category: string
  concept_type: string
  impact?: string
  competitiveGap: string
  tags: string[]
  content_pillar: string
  product_focus: string
  concept_idea: string
  visual_routes?: VisualRoute[]
  copywriting: {
    headline: string
    sub_headline_1: string
    sub_headline_2: string
    bullets: string[]
    cta: string
  }
  id?: string
  clientname?: string
  productfocus?: string
}

export type ImageEntry = {
  url: string
  source?: string
}

export type GeneratedAdRequestParams = {
  prompt: string
  referenceImageUrls: string[]
  clientName?: string
  productFocus: string
  selectedTopicData?: SavedTopic | null
  selectedVisualRoute?: VisualRoute | null
  colorPalette: string[]
  materialImageUrls: string[]
  adStyleLabel?: string | null
  userBrief?: string | null
  aspectRatio: string
  creativeFormat?: string
  creativeFormatLabel?: string
}

const GENERATED_IMAGES_STORAGE_PREFIX = "cvc_generated_images"
const GENERATED_IMAGES_STORAGE_TTL = 30 * 24 * 60 * 60 * 1000
const MAX_STORED_GENERATED_IMAGES = 60

export function getGeneratedImagesStorageKey(clientId: string, productFocus: string) {
  return `${GENERATED_IMAGES_STORAGE_PREFIX}_${clientId}_${productFocus}`
}

export function loadGeneratedImagesFromStorage(storageKey: string): GeneratedImage[] {
  if (typeof window === "undefined") return []

  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    const timestamp = typeof parsed?.timestamp === "number" ? parsed.timestamp : 0
    const images: unknown[] = Array.isArray(parsed?.images) ? parsed.images : []

    if (!timestamp || Date.now() - timestamp > GENERATED_IMAGES_STORAGE_TTL) {
      localStorage.removeItem(storageKey)
      return []
    }

    return images
      .filter(
        (image): image is GeneratedImage =>
          typeof image === "object" &&
          image !== null &&
          "url" in image &&
          typeof image.url === "string",
      )
      .map((image) => ({
        ...image,
        status: "completed",
      }))
  } catch (error) {
    console.error("[AI Image Generator] Error loading generated images from storage:", error)
    return []
  }
}

export function saveGeneratedImagesToStorage(storageKey: string, images: GeneratedImage[]) {
  if (typeof window === "undefined") return

  try {
    const persistedImages = images
      // Only persist remote (http/https) URLs. Never store data:/blob: URLs — base64 images blow
      // the localStorage quota and don't survive a reload anyway.
      .filter(
        (image) =>
          image.status === "completed" &&
          typeof image.url === "string" &&
          /^https?:\/\//.test(image.url),
      )
      .slice(0, MAX_STORED_GENERATED_IMAGES)

    if (persistedImages.length === 0) {
      localStorage.removeItem(storageKey)
      return
    }

    localStorage.setItem(
      storageKey,
      JSON.stringify({
        timestamp: Date.now(),
        images: persistedImages,
      }),
    )
  } catch (error) {
    console.error("[AI Image Generator] Error saving generated images to storage:", error)
  }
}

export function getTopicSelectionKey(topic: Pick<SavedTopic, "title" | "concept_idea">) {
  return (topic.title || topic.concept_idea || "").trim()
}

export function buildPendingGeneratedImages(params: {
  requestIds: string[]
  prompt: string
  topicTitle: string
  topicSummary: string
  aspectRatio: string
}): GeneratedImage[] {
  const createdAt = new Date().toISOString()

  return params.requestIds.map((id) => ({
    id,
    url: "",
    prompt: params.prompt,
    topicTitle: params.topicTitle,
    topicSummary: params.topicSummary,
    reference_image: undefined,
    status: "generating",
    created_at: createdAt,
    source: undefined,
    aspectRatio: params.aspectRatio,
    resolution: undefined,
    operation: "generate",
    sourceImageUrl: undefined,
    sourceImageId: undefined,
  }))
}

export function buildGeneratedAdRequestPayload(params: GeneratedAdRequestParams) {
  const prompt = params.prompt.trim()
  const selectedTopicData = params.selectedTopicData || null

  return {
    prompt,
    reference_image_url: params.referenceImageUrls[0] || null,
    reference_image_urls: params.referenceImageUrls,
    client_name: params.clientName,
    product_focus: params.productFocus,
    selected_topics: selectedTopicData ? [selectedTopicData] : [],
    core_concept: selectedTopicData?.concept_idea || prompt,
    topic_title: selectedTopicData?.title || "Custom brief",
    topic_description: selectedTopicData?.description || prompt,
    content_pillar: selectedTopicData?.content_pillar || "",
    copywriting: selectedTopicData?.copywriting || null,
    selected_visual_route: params.selectedVisualRoute || null,
    color_palette: params.colorPalette,
    material_image_urls: params.materialImageUrls,
    ad_style: params.adStyleLabel || null,
    user_brief: params.userBrief || null,
    creative_format: params.creativeFormat || null,
    creative_format_label: params.creativeFormatLabel || null,
    aspect_ratio: params.aspectRatio,
    image_count: 1,
  }
}

export function buildPendingUpscaleImage(params: {
  id: string
  sourceImage: GeneratedImage
  targetAspectRatio: string
}): GeneratedImage {
  return {
    id: params.id,
    url: "",
    prompt: params.sourceImage.prompt,
    topicTitle: params.sourceImage.topicTitle,
    topicSummary: params.sourceImage.topicSummary,
    reference_image: params.sourceImage.reference_image,
    status: "generating",
    created_at: new Date().toISOString(),
    source: "gemini_2k",
    aspectRatio: params.targetAspectRatio,
    resolution: "2K",
    operation: "upscale",
    sourceImageUrl: params.sourceImage.url,
    sourceImageId: params.sourceImage.id,
  }
}

export function buildPendingRemoveTextImage(params: {
  id: string
  sourceImage: GeneratedImage
  sourceAspectRatio: string
}): GeneratedImage {
  return {
    id: params.id,
    url: "",
    prompt: params.sourceImage.prompt,
    topicTitle: params.sourceImage.topicTitle,
    topicSummary: params.sourceImage.topicSummary,
    reference_image: params.sourceImage.reference_image,
    status: "generating",
    created_at: new Date().toISOString(),
    source: "gemini_text_removed",
    aspectRatio: params.sourceAspectRatio,
    resolution: params.sourceImage.resolution,
    operation: "remove_text",
    sourceImageUrl: params.sourceImage.url,
    sourceImageId: params.sourceImage.id,
  }
}

export function normalizeGeneratedImageEntries(entry: unknown): ImageEntry[] {
  const entries: ImageEntry[] = []
  if (!entry) return entries

  if (typeof entry === "string") {
    entries.push({ url: entry })
    return entries
  }

  if (typeof entry !== "object") {
    return entries
  }

  const record = entry as Record<string, unknown>
  const knownKeys = ["url", "image_url", "gemini", "ideogram", "stable_diffusion", "dalle"]
  let found = false

  if (typeof record.url === "string" || typeof record.image_url === "string") {
    entries.push({
      url: (record.url || record.image_url) as string,
      source: typeof record.source === "string" ? record.source : typeof record.provider === "string" ? record.provider : undefined,
    })
    found = true
  }

  knownKeys.forEach((key) => {
    if (key !== "url" && key !== "image_url" && typeof record[key] === "string") {
      entries.push({ url: record[key] as string, source: key })
      found = true
    }
  })

  if (!found) {
    Object.keys(record).forEach((key) => {
      if (typeof record[key] === "string") {
        entries.push({ url: record[key] as string, source: key })
      }
    })
  }

  return entries
}

export function getFirstGeneratedImageFromResponse(result: unknown): ImageEntry | null {
  const response = result as {
    success?: boolean
    image_url?: string
    provider?: string
    model?: string
    images?: unknown[]
    error?: string
  }

  if (response?.success && response.image_url) {
    return {
      url: response.image_url,
      source: response.provider || response.model || "gemini",
    }
  }

  if (response?.success && Array.isArray(response.images)) {
    return response.images.flatMap((image) => normalizeGeneratedImageEntries(image))[0] || null
  }

  return null
}
