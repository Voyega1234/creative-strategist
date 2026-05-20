"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowDownToLine,
  FileImage,
  Globe2,
  ImagePlus,
  Loader2,
  Maximize2,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  downloadBlob,
  uploadFileToImageStorage,
  uploadGeneratedImageBlob,
} from "@/lib/images/client"
import { cn } from "@/lib/utils"

type UploadedAsset = {
  file: File
  previewUrl: string
}

type SeoBlogBannerResult = {
  imageUrl: string
  sourceDataUrl: string
  provider: ImageModelProvider
  model: string
  prompt: string
  requestedSize: string
  targetMasterSize: string
  brandAssets: {
    brand_name?: string
    colors?: Array<{ hex?: string; usage?: string }>
    selected_logo_url?: string
    used_openbrand_logo_as_input?: boolean
  } | null
}

type ImageModelProvider = "gemini" | "openai"
type AdditionalSizeKey = "blog_card" | "featured_blog" | "social_share"

type AdditionalOutput = {
  id: string
  key: AdditionalSizeKey
  label: string
  width: number
  height: number
  imageUrl: string
  blob: Blob
  model: string
}

type CachedBrandAssets = {
  website: string
  brandName: string
  brandColorValues: string[]
  brandContext: string
  openBrandLogoUrl: string
  updatedAt: number
}

const MASTER_WIDTH = 1600
const MASTER_HEIGHT = 900
const MAX_INSERT_IMAGES = 4
const BRAND_ASSET_CACHE_KEY = "creative-compass:seo-blog-banner:brand-assets:v1"
const BRAND_ASSET_LAST_WEBSITE_KEY = "creative-compass:seo-blog-banner:last-website:v1"
const ADDITIONAL_SIZES: Array<{
  key: AdditionalSizeKey
  label: string
  description: string
  width: number
  height: number
}> = [
  {
    key: "blog_card",
    label: "Blog Card / Thumbnail",
    description: "For blog listing cards",
    width: 800,
    height: 450,
  },
  {
    key: "featured_blog",
    label: "Featured Blog Image",
    description: "For article hero embeds",
    width: 1200,
    height: 675,
  },
  {
    key: "social_share",
    label: "Social Share (OG)",
    description: "For Facebook, LINE, and link previews",
    width: 1200,
    height: 630,
  },
]

function revokeAsset(asset: UploadedAsset | null) {
  if (asset?.previewUrl) {
    URL.revokeObjectURL(asset.previewUrl)
  }
}

function createAsset(file: File): UploadedAsset {
  return {
    file,
    previewUrl: URL.createObjectURL(file),
  }
}

function extractHexColors(value: string) {
  return Array.from(new Set(value.match(/#[0-9a-fA-F]{3,8}\b/g) || []))
}

function normalizeHexColor(value: string) {
  const trimmed = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toUpperCase()
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed
      .slice(1)
      .split("")
      .map((char) => `${char}${char}`)
      .join("")}`.toUpperCase()
  }
  return "#111827"
}

function normalizeWebsiteCacheKey(value: string) {
  return value.trim().replace(/^https?:\/\//i, "").replace(/\/+$/g, "").toLowerCase()
}

function readBrandAssetCache() {
  if (typeof window === "undefined") return {}

  try {
    const raw = window.localStorage.getItem(BRAND_ASSET_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? (parsed as Record<string, CachedBrandAssets>) : {}
  } catch (error) {
    console.warn("Cannot read SEO banner brand asset cache:", error)
    return {}
  }
}

function writeBrandAssetCache(cache: Record<string, CachedBrandAssets>) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(BRAND_ASSET_CACHE_KEY, JSON.stringify(cache))
  } catch (error) {
    console.warn("Cannot write SEO banner brand asset cache:", error)
  }
}

async function normalizeToExactCanvas(dataUrl: string, targetWidth: number, targetHeight: number) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Cannot load generated banner image"))
    img.src = dataUrl
  })

  const canvas = document.createElement("canvas")
  canvas.width = targetWidth
  canvas.height = targetHeight

  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("Canvas is not available")
  }

  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, targetWidth, targetHeight)

  const scale = Math.min(targetWidth / image.naturalWidth, targetHeight / image.naturalHeight)
  const drawWidth = image.naturalWidth * scale
  const drawHeight = image.naturalHeight * scale
  const drawX = (targetWidth - drawWidth) / 2
  const drawY = (targetHeight - drawHeight) / 2

  // Fill the exact export canvas without cropping the generated image.
  context.save()
  context.filter = "blur(36px)"
  context.globalAlpha = 0.42
  context.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, -80, -80, targetWidth + 160, targetHeight + 160)
  context.restore()

  const gradient = context.createLinearGradient(0, 0, targetWidth, targetHeight)
  gradient.addColorStop(0, "rgba(255,255,255,0.72)")
  gradient.addColorStop(0.5, "rgba(255,255,255,0.38)")
  gradient.addColorStop(1, "rgba(255,255,255,0.72)")
  context.fillStyle = gradient
  context.fillRect(0, 0, targetWidth, targetHeight)

  context.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, drawX, drawY, drawWidth, drawHeight)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error(`Cannot export ${targetWidth}x${targetHeight} banner`))
        return
      }
      resolve(blob)
    }, "image/png")
  })
}

async function normalizeToMasterCanvas(dataUrl: string) {
  return normalizeToExactCanvas(dataUrl, MASTER_WIDTH, MASTER_HEIGHT)
}

function AssetUpload({
  label,
  description,
  asset,
  remotePreviewUrl,
  onSelect,
  onRemove,
  multiple = false,
}: {
  label: string
  description: string
  asset?: UploadedAsset | null
  remotePreviewUrl?: string
  onSelect: (files: FileList | null) => void
  onRemove?: () => void
  multiple?: boolean
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const previewUrl = asset?.previewUrl || remotePreviewUrl || ""

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">{label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
        {previewUrl && onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full bg-slate-950 p-1 text-white transition hover:bg-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "mt-4 flex min-h-[132px] w-full items-center justify-center overflow-hidden rounded-[20px] border border-dashed border-slate-300 bg-slate-50 text-left transition hover:border-slate-400 hover:bg-white",
          previewUrl && "border-solid bg-white",
        )}
      >
        {previewUrl ? (
          <img src={previewUrl} alt={label} className="h-full max-h-[180px] w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <UploadCloud className="h-6 w-6 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Upload image</span>
            <span className="text-xs text-slate-500">PNG, JPG, WEBP</span>
          </div>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        multiple={multiple}
        className="hidden"
        onChange={(event) => {
          onSelect(event.target.files)
          event.target.value = ""
        }}
      />
    </div>
  )
}

export function SeoBlogBannerPanel() {
  const [website, setWebsite] = useState("")
  const [facebookPage, setFacebookPage] = useState("")
  const [brandName, setBrandName] = useState("")
  const [brandColorValues, setBrandColorValues] = useState<string[]>([])
  const [brandContext, setBrandContext] = useState("")
  const [openBrandLogoUrl, setOpenBrandLogoUrl] = useState("")
  const [headline, setHeadline] = useState("")
  const [subHeadline, setSubHeadline] = useState("")
  const [userBrief, setUserBrief] = useState("")
  const [logoAsset, setLogoAsset] = useState<UploadedAsset | null>(null)
  const [referenceAsset, setReferenceAsset] = useState<UploadedAsset | null>(null)
  const [insertAssets, setInsertAssets] = useState<UploadedAsset[]>([])
  const [result, setResult] = useState<SeoBlogBannerResult | null>(null)
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)
  const [selectedAdditionalSize, setSelectedAdditionalSize] = useState<AdditionalSizeKey>("blog_card")
  const [additionalOutputs, setAdditionalOutputs] = useState<AdditionalOutput[]>([])
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isExtractingBrand, setIsExtractingBrand] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [brandHexInput, setBrandHexInput] = useState("")
  const [brandHexError, setBrandHexError] = useState("")
  const generationInFlightRef = useRef(false)
  const resizeInFlightRef = useRef(false)
  const logoAssetRef = useRef<UploadedAsset | null>(null)
  const referenceAssetRef = useRef<UploadedAsset | null>(null)
  const insertAssetsRef = useRef<UploadedAsset[]>([])
  const restoringBrandCacheRef = useRef(false)

  useEffect(() => {
    logoAssetRef.current = logoAsset
  }, [logoAsset])

  useEffect(() => {
    referenceAssetRef.current = referenceAsset
  }, [referenceAsset])

  useEffect(() => {
    insertAssetsRef.current = insertAssets
  }, [insertAssets])

  useEffect(() => {
    return () => {
      revokeAsset(logoAssetRef.current)
      revokeAsset(referenceAssetRef.current)
      insertAssetsRef.current.forEach((asset) => revokeAsset(asset))
    }
  }, [])

  useEffect(() => {
    const lastWebsite = window.localStorage.getItem(BRAND_ASSET_LAST_WEBSITE_KEY) || ""
    if (!lastWebsite) return

    const cache = readBrandAssetCache()
    const cached = cache[normalizeWebsiteCacheKey(lastWebsite)]
    if (!cached) return

    restoringBrandCacheRef.current = true
    setWebsite(cached.website)
    setBrandName(cached.brandName)
    setBrandColorValues(cached.brandColorValues)
    setBrandContext(cached.brandContext)
    setOpenBrandLogoUrl(cached.openBrandLogoUrl)
    window.setTimeout(() => {
      restoringBrandCacheRef.current = false
    }, 0)
  }, [])

  useEffect(() => {
    const cacheKey = normalizeWebsiteCacheKey(website)
    if (!cacheKey || restoringBrandCacheRef.current) return

    const cached = readBrandAssetCache()[cacheKey]
    if (!cached) return

    restoringBrandCacheRef.current = true
    setBrandName(cached.brandName)
    setBrandColorValues(cached.brandColorValues)
    setBrandContext(cached.brandContext)
    setOpenBrandLogoUrl(cached.openBrandLogoUrl)
    setResult(null)
    setAdditionalOutputs([])
    window.setTimeout(() => {
      restoringBrandCacheRef.current = false
    }, 0)
  }, [website])

  useEffect(() => {
    const cacheKey = normalizeWebsiteCacheKey(website)
    if (!cacheKey || restoringBrandCacheRef.current) return
    if (!brandName && brandColorValues.length === 0 && !brandContext && !openBrandLogoUrl) return

    const nextCache = readBrandAssetCache()
    nextCache[cacheKey] = {
      website: website.trim(),
      brandName,
      brandColorValues,
      brandContext,
      openBrandLogoUrl,
      updatedAt: Date.now(),
    }
    writeBrandAssetCache(nextCache)
    window.localStorage.setItem(BRAND_ASSET_LAST_WEBSITE_KEY, website.trim())
  }, [brandColorValues, brandContext, brandName, openBrandLogoUrl, website])

  const canGenerate = website.trim().length > 0 && headline.trim().length > 0
  const selectedAdditionalSizeConfig = ADDITIONAL_SIZES.find((size) => size.key === selectedAdditionalSize) || ADDITIONAL_SIZES[0]

  const insertHint = useMemo(() => {
    if (insertAssets.length === 0) return "Optional product, model, or visual material to insert into the banner."
    return `${insertAssets.length}/${MAX_INSERT_IMAGES} image${insertAssets.length > 1 ? "s" : ""} selected`
  }, [insertAssets.length])

  const addBrandColor = () => {
    setBrandColorValues((prev) => [...prev, "#111827"])
    setResult(null)
    setAdditionalOutputs([])
  }

  const addBrandHexColor = () => {
    const value = brandHexInput.trim()
    const normalized = normalizeHexColor(value.startsWith("#") ? value : `#${value}`)
    const isValidHex = /^#(?:[0-9A-F]{3}|[0-9A-F]{6})$/i.test(value.startsWith("#") ? value : `#${value}`)

    if (!isValidHex) {
      setBrandHexError("Enter a valid HEX color, e.g. #0F172A")
      return
    }

    setBrandColorValues((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]))
    setBrandHexInput("")
    setBrandHexError("")
    setResult(null)
    setAdditionalOutputs([])
  }

  const updateBrandColor = (indexToUpdate: number, value: string) => {
    setBrandColorValues((prev) => prev.map((color, index) => (index === indexToUpdate ? normalizeHexColor(value) : color)))
    setResult(null)
    setAdditionalOutputs([])
  }

  const removeBrandColor = (indexToRemove: number) => {
    setBrandColorValues((prev) => prev.filter((_, index) => index !== indexToRemove))
    setResult(null)
    setAdditionalOutputs([])
  }

  const handleLogoSelect = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    revokeAsset(logoAsset)
    setLogoAsset(createAsset(file))
    setResult(null)
    setAdditionalOutputs([])
  }

  const handleReferenceSelect = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    revokeAsset(referenceAsset)
    setReferenceAsset(createAsset(file))
    setResult(null)
    setAdditionalOutputs([])
  }

  const handleInsertSelect = (files: FileList | null) => {
    if (!files?.length) return
    const remainingSlots = Math.max(MAX_INSERT_IMAGES - insertAssets.length, 0)
    if (remainingSlots === 0) return

    const nextAssets = Array.from(files).slice(0, remainingSlots).map(createAsset)
    setInsertAssets((prev) => [...prev, ...nextAssets])
    setResult(null)
    setAdditionalOutputs([])
  }

  const removeInsertAsset = (indexToRemove: number) => {
    setInsertAssets((prev) => {
      const removed = prev[indexToRemove]
      revokeAsset(removed || null)
      return prev.filter((_, index) => index !== indexToRemove)
    })
    setResult(null)
    setAdditionalOutputs([])
  }

  const handleExtractBrandAssets = async () => {
    if (!website.trim()) {
      setError("Website is required before extracting brand assets.")
      return
    }

    setIsExtractingBrand(true)
    setError(null)

    try {
      const response = await fetch("/api/seo-blog-banner/brand-assets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ website: website.trim() }),
      })
      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload?.error || "Cannot extract brand assets")
      }

      setBrandName(payload.brand_name || "")
      setBrandColorValues(extractHexColors(payload.brand_colors || "").map(normalizeHexColor))
      setBrandContext(payload.brand_context || "")
      setOpenBrandLogoUrl(payload.selected_logo_url || "")
      setResult(null)
      setAdditionalOutputs([])
    } catch (err) {
      console.error("SEO blog banner brand extraction failed:", err)
      setError(err instanceof Error ? err.message : "Cannot extract brand assets")
    } finally {
      setIsExtractingBrand(false)
    }
  }

  const handleGenerate = async () => {
    if (generationInFlightRef.current) return
    if (!canGenerate) {
      setError("Website and headline are required.")
      return
    }

    generationInFlightRef.current = true
    setIsGenerating(true)
    setError(null)

    try {
      const [brandLogoUrl, referenceImageUrl, insertImageUrls] = await Promise.all([
        logoAsset ? uploadFileToImageStorage(logoAsset.file, "generated/seo-blog-banner-inputs/logo") : Promise.resolve(""),
        referenceAsset
          ? uploadFileToImageStorage(referenceAsset.file, "generated/seo-blog-banner-inputs/reference")
          : Promise.resolve(""),
        insertAssets.length > 0
          ? Promise.all(
              insertAssets.map((asset) => uploadFileToImageStorage(asset.file, "generated/seo-blog-banner-inputs/materials")),
            )
          : Promise.resolve([]),
      ])

      const response = await fetch("/api/seo-blog-banner", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model_provider: "openai",
          website: website.trim(),
          facebook_page: facebookPage.trim(),
          brand_name: brandName.trim(),
          brand_colors: brandColorValues.join(", "),
          brand_context: brandContext.trim(),
          brand_logo_url: brandLogoUrl,
          openbrand_logo_url: openBrandLogoUrl,
          reference_image_url: referenceImageUrl,
          insert_image_urls: insertImageUrls,
          headline: headline.trim(),
          sub_headline: subHeadline.trim(),
          user_brief: userBrief.trim(),
        }),
      })

      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload?.error || "Cannot generate SEO blog banner")
      }

      const masterBlob = await normalizeToMasterCanvas(payload.image_data_url)
      const publicUrl = await uploadGeneratedImageBlob(masterBlob, "generated/seo-blog-banner-outputs", "master-1600x900")

      setResultBlob(masterBlob)
      setAdditionalOutputs([])
      setResult({
        imageUrl: publicUrl,
        sourceDataUrl: payload.image_data_url,
        provider: payload.provider || "openai",
        model: payload.model || "gpt-image-2 -> gemini-3.1-flash-image-preview",
        prompt: payload.prompt || "",
        requestedSize: payload.requested_size || "2K",
        targetMasterSize: payload.target_master_size || "1600x900",
        brandAssets: payload.brand_assets || null,
      })
    } catch (err) {
      console.error("SEO blog banner generation failed:", err)
      setError(err instanceof Error ? err.message : "Cannot generate SEO blog banner")
    } finally {
      generationInFlightRef.current = false
      setIsGenerating(false)
    }
  }

  const handleDownload = () => {
    if (!resultBlob) return
    downloadBlob(resultBlob, "seo-blog-banner-master-1600x900.png")
  }

  const handleResizeAdditionalSize = async () => {
    if (resizeInFlightRef.current) return
    if (!result) {
      setError("Generate and approve the master banner first.")
      return
    }

    resizeInFlightRef.current = true
    setIsResizing(true)
    setError(null)

    try {
      const response = await fetch("/api/seo-blog-banner/resize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url: result.imageUrl,
          target_size: selectedAdditionalSize,
        }),
      })

      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload?.error || "Cannot resize SEO blog banner")
      }

      const targetWidth = Number(payload.target_width || selectedAdditionalSizeConfig.width)
      const targetHeight = Number(payload.target_height || selectedAdditionalSizeConfig.height)
      const targetKey = (payload.target_size || selectedAdditionalSize) as AdditionalSizeKey
      const targetLabel = payload.target_label || selectedAdditionalSizeConfig.label
      const resizedBlob = await normalizeToExactCanvas(payload.image_data_url, targetWidth, targetHeight)
      const publicUrl = await uploadGeneratedImageBlob(
        resizedBlob,
        "generated/seo-blog-banner-outputs",
        `${targetKey}-${targetWidth}x${targetHeight}`,
      )

      setAdditionalOutputs((prev) => [
        {
          id: `${targetKey}-${Date.now()}`,
          key: targetKey,
          label: targetLabel,
          width: targetWidth,
          height: targetHeight,
          imageUrl: publicUrl,
          blob: resizedBlob,
          model: payload.model || "gemini-3.1-flash-image-preview",
        },
        ...prev.filter((output) => output.key !== targetKey),
      ])
    } catch (err) {
      console.error("SEO blog banner resize failed:", err)
      setError(err instanceof Error ? err.message : "Cannot resize SEO blog banner")
    } finally {
      resizeInFlightRef.current = false
      setIsResizing(false)
    }
  }

  const handleDownloadAdditional = (output: AdditionalOutput) => {
    downloadBlob(output.blob, `seo-blog-banner-${output.key}-${output.width}x${output.height}.png`)
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(360px,520px)_1fr]">
      <section className="space-y-4">
        <Card className="overflow-hidden rounded-[32px] border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <Globe2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-950">SEO Blog Banner</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Generate the master blog header first. Additional sizes can be generated later after the master is approved.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-6">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="seo-website">Website *</Label>
                <div className="flex gap-2">
                  <Input
                    id="seo-website"
                    value={website}
                    onChange={(event) => {
                      setWebsite(event.target.value)
                      setResult(null)
                    }}
                    placeholder="https://brand.com"
                    className="h-12 rounded-2xl"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleExtractBrandAssets}
                    disabled={!website.trim() || isExtractingBrand}
                    className="h-12 shrink-0 rounded-2xl px-4"
                  >
                    {isExtractingBrand ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Extract
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo-facebook">Facebook page</Label>
                <Input
                  id="seo-facebook"
                  value={facebookPage}
                  onChange={(event) => setFacebookPage(event.target.value)}
                  placeholder="https://facebook.com/brand"
                  className="h-12 rounded-2xl"
                />
              </div>
            </div>

            <div className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Brand Details</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Extract from OpenBrand first, then edit before generating.
                  </p>
                </div>
                {openBrandLogoUrl ? (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Logo detected
                  </span>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo-brand-name">Brand name</Label>
                <Input
                  id="seo-brand-name"
                  value={brandName}
                  onChange={(event) => {
                    setBrandName(event.target.value)
                    setResult(null)
                  }}
                  placeholder="Auto-filled from OpenBrand"
                  className="h-11 rounded-2xl bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label>Brand colors</Label>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  {brandColorValues.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {brandColorValues.map((color, index) => (
                        <div key={`brand-color-${index}`} className="group relative">
                          <input
                            type="color"
                            value={color}
                            onChange={(event) => updateBrandColor(index, event.target.value)}
                            className="h-14 w-full cursor-pointer appearance-none rounded-2xl border border-slate-200 bg-transparent p-0 shadow-sm ring-offset-2 transition group-hover:ring-2 group-hover:ring-slate-300 [&::-moz-color-swatch]:rounded-2xl [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-2xl [&::-webkit-color-swatch]:border-0"
                            aria-label={`Brand color ${index + 1}`}
                          />
                          <button
                            type="button"
                            onClick={() => removeBrandColor(index)}
                            className="absolute -right-1 -top-1 rounded-full bg-slate-950 p-1 text-white opacity-0 transition group-hover:opacity-100"
                            aria-label="Remove brand color"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-[64px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
                      No colors extracted yet
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addBrandColor}
                    className="mt-3 w-full rounded-full"
                  >
                    Add color
                  </Button>
                  <div className="mt-3 flex gap-2">
                    <Input
                      value={brandHexInput}
                      onChange={(event) => {
                        setBrandHexInput(event.target.value)
                        setBrandHexError("")
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault()
                          addBrandHexColor()
                        }
                      }}
                      placeholder="#0F172A"
                      className="h-10 rounded-full bg-white font-mono text-sm"
                    />
                    <Button type="button" onClick={addBrandHexColor} className="h-10 rounded-full bg-slate-950 px-4 text-white hover:bg-slate-800">
                      Add HEX
                    </Button>
                  </div>
                  {brandHexError ? <p className="mt-2 text-xs text-red-600">{brandHexError}</p> : null}
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Click any color to edit it, or paste a HEX code manually.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo-brand-context">Brand context</Label>
                <Textarea
                  id="seo-brand-context"
                  value={brandContext}
                  onChange={(event) => {
                    setBrandContext(event.target.value)
                    setResult(null)
                  }}
                  placeholder="Website description and brand cues extracted from the site"
                  className="min-h-[120px] resize-y rounded-2xl bg-white"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <AssetUpload
                label="Brand Logo"
                description={openBrandLogoUrl ? "Detected from OpenBrand. Upload to override." : "Used as brand identity if provided."}
                asset={logoAsset}
                remotePreviewUrl={openBrandLogoUrl}
                onSelect={handleLogoSelect}
                onRemove={() => {
                  revokeAsset(logoAsset)
                  setLogoAsset(null)
                  setOpenBrandLogoUrl("")
                  setResult(null)
                }}
              />
              <AssetUpload
                label="Reference Image"
                description="Optional visual direction."
                asset={referenceAsset}
                onSelect={handleReferenceSelect}
                onRemove={() => {
                  revokeAsset(referenceAsset)
                  setReferenceAsset(null)
                  setResult(null)
                }}
              />
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Insert Images</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{insertHint}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => document.getElementById("seo-insert-assets")?.click()}
                  disabled={insertAssets.length >= MAX_INSERT_IMAGES}
                >
                  <ImagePlus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>

              {insertAssets.length > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {insertAssets.map((asset, index) => (
                    <div key={asset.previewUrl} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      <img src={asset.previewUrl} alt={`Insert image ${index + 1}`} className="h-28 w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeInsertAsset(index)}
                        className="absolute right-2 top-2 rounded-full bg-slate-950 p-1 text-white opacity-90 transition hover:bg-slate-700"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 flex min-h-[112px] items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-slate-50 text-center">
                  <div>
                    <FileImage className="mx-auto h-6 w-6 text-slate-400" />
                    <p className="mt-2 text-sm font-medium text-slate-700">No insert images</p>
                    <p className="text-xs text-slate-500">Product, model, or material images are optional.</p>
                  </div>
                </div>
              )}

              <input
                id="seo-insert-assets"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                multiple
                className="hidden"
                onChange={(event) => {
                  handleInsertSelect(event.target.files)
                  event.target.value = ""
                }}
              />
            </div>

            <div className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="space-y-2">
                <Label htmlFor="seo-headline">Headline *</Label>
                <Textarea
                  id="seo-headline"
                  value={headline}
                  onChange={(event) => setHeadline(event.target.value)}
                  placeholder="เช่น 5 วิธีเพิ่มยอดขายจาก SEO Content"
                  className="min-h-[84px] resize-none rounded-2xl bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo-subheadline">Sub-headline</Label>
                <Textarea
                  id="seo-subheadline"
                  value={subHeadline}
                  onChange={(event) => setSubHeadline(event.target.value)}
                  placeholder="ข้อความรองที่อยากให้ปรากฏบน banner"
                  className="min-h-[84px] resize-none rounded-2xl bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo-user-brief">Optional brief</Label>
                <Textarea
                  id="seo-user-brief"
                  value={userBrief}
                  onChange={(event) => {
                    setUserBrief(event.target.value)
                    setResult(null)
                  }}
                  placeholder="เช่น อยากได้ mood ที่ดู editorial, ใช้ reference เป็น layout หลัก, มีคนได้แต่ต้องเหมือนภาพถ่ายจริง"
                  className="min-h-[112px] resize-y rounded-2xl bg-white"
                />
                <p className="text-xs leading-5 text-slate-500">
                  This brief is sent as a must-follow instruction for image generation.
                </p>
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}

            <Button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating}
              className="h-14 w-full rounded-full bg-slate-950 text-base font-semibold text-white hover:bg-slate-800"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating master 16:9...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Generate Master Banner
                </>
              )}
            </Button>
          </div>
        </Card>
      </section>

      <section className="min-w-0">
        <Card className="min-h-[640px] overflow-hidden rounded-[32px] border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 p-6">
            <div>
              <p className="text-lg font-semibold text-slate-950">Master Output</p>
              <p className="mt-1 text-sm text-slate-500">Target: 1600 × 900 px, 16:9</p>
            </div>
            {result ? (
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="rounded-full" onClick={() => setIsPreviewOpen(true)}>
                  <Maximize2 className="mr-2 h-4 w-4" />
                  Preview
                </Button>
                <Button type="button" className="rounded-full bg-slate-950 text-white hover:bg-slate-800" onClick={handleDownload}>
                  <ArrowDownToLine className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
            ) : null}
          </div>

          <div className="p-6">
            {result ? (
              <div className="space-y-5">
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  className="group block w-full overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100 shadow-sm"
                >
                  <div className="aspect-video w-full">
                    <img
                      src={result.imageUrl}
                      alt="SEO blog banner master"
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.01]"
                    />
                  </div>
                </button>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Master size</p>
                    <p className="mt-1 font-semibold text-slate-950">{result.targetMasterSize}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Model</p>
                    <p className="mt-1 font-semibold text-slate-950">{result.model}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">GPT render size</p>
                    <p className="mt-1 font-semibold text-slate-950">{result.requestedSize}</p>
                  </div>
                </div>

                {result.brandAssets ? (
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">OpenBrand Assets</p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">
                          {result.brandAssets.brand_name || "Brand detected"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {result.brandAssets.used_openbrand_logo_as_input
                            ? "Auto logo was used because no logo was uploaded."
                            : "Colors are used as brand guidance in the prompt."}
                        </p>
                      </div>
                      {result.brandAssets.colors?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {result.brandAssets.colors.slice(0, 6).map((color, index) => (
                            <div
                              key={`${color.hex || "color"}-${index}`}
                              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2"
                            >
                              <span
                                className="h-4 w-4 rounded-full border border-slate-200"
                                style={{ backgroundColor: color.hex || "#ffffff" }}
                              />
                              <span className="text-xs font-medium text-slate-700">{color.hex}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Additional sizes</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Use Nano Banana 2 to adapt the approved master. The export is normalized to exact pixels.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={handleResizeAdditionalSize}
                      disabled={isResizing || !result}
                      className="rounded-full bg-slate-950 text-white hover:bg-slate-800"
                    >
                      {isResizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      Resize selected
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    {ADDITIONAL_SIZES.map((size) => (
                      <button
                        key={size.key}
                        type="button"
                        onClick={() => setSelectedAdditionalSize(size.key)}
                        className={cn(
                          "rounded-2xl border p-4 text-left transition",
                          selectedAdditionalSize === size.key
                            ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white",
                        )}
                      >
                        <span className="block text-sm font-semibold">{size.label}</span>
                        <span
                          className={cn(
                            "mt-1 block text-xs",
                            selectedAdditionalSize === size.key ? "text-slate-300" : "text-slate-500",
                          )}
                        >
                          {size.width} × {size.height} px
                        </span>
                        <span
                          className={cn(
                            "mt-2 block text-xs leading-5",
                            selectedAdditionalSize === size.key ? "text-slate-300" : "text-slate-500",
                          )}
                        >
                          {size.description}
                        </span>
                      </button>
                    ))}
                  </div>

                  {additionalOutputs.length > 0 ? (
                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      {additionalOutputs.map((output) => (
                        <div key={output.id} className="overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50">
                          <div className="bg-white p-3">
                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                              <img src={output.imageUrl} alt={output.label} className="aspect-video h-auto w-full object-cover" />
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-4">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-950">{output.label}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {output.width} × {output.height} px · {output.model}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="shrink-0 rounded-full"
                              onClick={() => handleDownloadAdditional(output)}
                            >
                              <ArrowDownToLine className="mr-2 h-4 w-4" />
                              Download
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex min-h-[520px] items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-slate-50">
                <div className="max-w-sm text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <p className="mt-4 text-base font-semibold text-slate-950">No banner generated yet</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Fill in website and topic, then generate the master SEO blog banner first.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </section>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-[96vw] rounded-[28px] border-slate-200 bg-white p-4">
          <DialogHeader>
            <DialogTitle>SEO Blog Banner Master</DialogTitle>
          </DialogHeader>
          {result ? (
            <div className="flex max-h-[82vh] items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
              <img src={result.imageUrl} alt="SEO blog banner preview" className="max-h-[82vh] w-auto max-w-full object-contain" />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
