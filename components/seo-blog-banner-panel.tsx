"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowDownToLine,
  Check,
  ChevronsUpDown,
  FileImage,
  Globe2,
  ImagePlus,
  Loader2,
  Plus,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import {
  downloadBlob,
  downloadImageFromUrl,
  uploadFileToImageStorage,
  uploadGeneratedImageBlob,
} from "@/lib/images/client"
import { getStorageClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  GeneratedImageGallery,
  type ImageGenerationSession,
} from "@/components/generated-image-gallery"

type UploadedAsset = {
  file?: File
  url?: string
  name: string
  previewUrl: string
}

type ClientOption = {
  id: string
  clientName: string
  productFocuses: Array<{
    id: string
    productFocus: string
  }>
}

type StoredAsset = {
  name: string
  url: string
  createdAt: string
}

type BrandColorRole = "Primary" | "Secondary" | "Accent" | "Background" | "Text"

type SeoBlogBannerResult = {
  imageUrl: string
  sourceDataUrl: string
  lockedLogoUrl: string
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
  clientId?: string
  website: string
  brandName: string
  brandColorValues: string[]
  brandColorRoles?: BrandColorRole[]
  brandContext: string
  openBrandLogoUrl: string
  updatedAt: number
}

const MASTER_WIDTH = 1600
const MASTER_HEIGHT = 900
const MAX_INSERT_IMAGES = 4
const BRAND_ASSET_CACHE_KEY = "creative-compass:seo-blog-banner:brand-assets:v1"
const CLIENT_BRAND_ASSET_CACHE_KEY = "creative-compass:seo-blog-banner:client-brand-assets:v1"
const BRAND_ASSET_LAST_WEBSITE_KEY = "creative-compass:seo-blog-banner:last-website:v1"
const COLOR_ROLE_OPTIONS: BrandColorRole[] = ["Primary", "Secondary", "Accent", "Background", "Text"]
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
  if (asset?.file && asset.previewUrl) {
    URL.revokeObjectURL(asset.previewUrl)
  }
}

function createAsset(file: File): UploadedAsset {
  return {
    file,
    name: file.name,
    previewUrl: URL.createObjectURL(file),
  }
}

function createStoredAsset(asset: StoredAsset): UploadedAsset {
  return {
    name: asset.name,
    url: asset.url,
    previewUrl: asset.url,
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

function parseBrandContext(value: string) {
  const lines = value.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  const getValue = (label: string) => {
    const line = lines.find((item) => item.toLowerCase().startsWith(`${label.toLowerCase()}:`))
    return line ? line.slice(label.length + 1).trim() : ""
  }
  const knownLabels = ["Site name", "Page title", "Meta description", "Visible website text sample"]
  const notes = lines.filter((line) => !knownLabels.some((label) => line.toLowerCase().startsWith(`${label.toLowerCase()}:`)))

  return {
    siteName: getValue("Site name"),
    pageTitle: getValue("Page title"),
    metaDescription: getValue("Meta description"),
    notes: [getValue("Visible website text sample"), ...notes].filter(Boolean).join("\n"),
  }
}

function composeBrandContext({
  siteName,
  pageTitle,
  metaDescription,
  notes,
}: {
  siteName: string
  pageTitle: string
  metaDescription: string
  notes: string
}) {
  return [
    siteName.trim() ? `Site name: ${siteName.trim()}` : "",
    pageTitle.trim() ? `Page title: ${pageTitle.trim()}` : "",
    metaDescription.trim() ? `Meta description: ${metaDescription.trim()}` : "",
    notes.trim() ? `Visible website text sample: ${notes.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n")
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

function readClientBrandAssetCache() {
  if (typeof window === "undefined") return {}

  try {
    const raw = window.localStorage.getItem(CLIENT_BRAND_ASSET_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? (parsed as Record<string, CachedBrandAssets>) : {}
  } catch (error) {
    console.warn("Cannot read SEO banner client brand cache:", error)
    return {}
  }
}

function writeClientBrandAssetCache(cache: Record<string, CachedBrandAssets>) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(CLIENT_BRAND_ASSET_CACHE_KEY, JSON.stringify(cache))
  } catch (error) {
    console.warn("Cannot write SEO banner client brand cache:", error)
  }
}

async function loadCanvasImage(source: string) {
  let imageSource = source
  let objectUrl = ""

  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source)
    if (!response.ok) throw new Error(`Cannot load image (${response.status})`)
    objectUrl = URL.createObjectURL(await response.blob())
    imageSource = objectUrl
  }

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error("Cannot load image for export"))
      img.src = imageSource
    })
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}

async function normalizeToExactCanvas(
  dataUrl: string,
  targetWidth: number,
  targetHeight: number,
  lockedLogoSource?: string,
) {
  const image = await loadCanvasImage(dataUrl)

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

  if (lockedLogoSource) {
    const lockedLogo = await loadCanvasImage(lockedLogoSource)
    const maxLogoWidth = targetWidth * 0.18
    const maxLogoHeight = targetHeight * 0.12
    const logoScale = Math.min(maxLogoWidth / lockedLogo.naturalWidth, maxLogoHeight / lockedLogo.naturalHeight)
    const logoWidth = lockedLogo.naturalWidth * logoScale
    const logoHeight = lockedLogo.naturalHeight * logoScale
    const logoX = targetWidth * 0.04
    const logoY = targetHeight * 0.05

    context.drawImage(
      lockedLogo,
      0,
      0,
      lockedLogo.naturalWidth,
      lockedLogo.naturalHeight,
      logoX,
      logoY,
      logoWidth,
      logoHeight,
    )
  }

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

async function normalizeToMasterCanvas(dataUrl: string, lockedLogoSource?: string) {
  return normalizeToExactCanvas(dataUrl, MASTER_WIDTH, MASTER_HEIGHT, lockedLogoSource)
}

function AssetUpload({
  label,
  description,
  asset,
  remotePreviewUrl,
  onSelect,
  onRemove,
  multiple = false,
  compact = false,
  className,
}: {
  label: string
  description: string
  asset?: UploadedAsset | null
  remotePreviewUrl?: string
  onSelect: (files: FileList | null) => void
  onRemove?: () => void
  multiple?: boolean
  compact?: boolean
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const previewUrl = asset?.previewUrl || remotePreviewUrl || ""

  return (
    <div className={cn("flex flex-col rounded-[24px] border border-slate-200 bg-white p-4", compact && "border-0 bg-transparent p-0", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">{label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
        {previewUrl && onRemove && !compact ? (
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
          "mt-4 flex w-full items-center justify-center overflow-hidden rounded-[20px] border border-dashed border-slate-300 bg-slate-50 text-left transition hover:border-slate-400 hover:bg-white",
          compact ? "min-h-[128px]" : "min-h-[132px] flex-1",
          previewUrl && "border-solid bg-white",
        )}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={label}
            className={cn("h-full w-full object-contain", compact ? "max-h-[120px] p-3" : "max-h-[180px]")}
          />
        ) : (
          <div className={cn("flex flex-col items-center gap-2 px-4 text-center", compact ? "py-5" : "py-8")}>
            <UploadCloud className="h-6 w-6 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Upload image</span>
            <span className="text-xs text-slate-500">PNG, JPG, WEBP</span>
          </div>
        )}
      </button>

      {previewUrl ? (
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            className="h-9 flex-1 rounded-full"
          >
            Upload logo
          </Button>
          {onRemove ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRemove}
              className="h-9 rounded-full border-red-100 px-3 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              Remove
            </Button>
          ) : null}
        </div>
      ) : null}

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

type SeoBlogBannerPanelProps = {
  clients?: ClientOption[]
  activeClientId?: string | null
  variant?: "classic" | "v2"
}

export function SeoBlogBannerPanel({
  clients = [],
  activeClientId = null,
  variant = "classic",
}: SeoBlogBannerPanelProps) {
  const [website, setWebsite] = useState("")
  const [brandName, setBrandName] = useState("")
  const [brandColorValues, setBrandColorValues] = useState<string[]>([])
  const [brandColorRoles, setBrandColorRoles] = useState<BrandColorRole[]>([])
  const [brandSiteName, setBrandSiteName] = useState("")
  const [brandPageTitle, setBrandPageTitle] = useState("")
  const [brandMetaDescription, setBrandMetaDescription] = useState("")
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
  const [editPrompt, setEditPrompt] = useState("")
  const [editAsset, setEditAsset] = useState<UploadedAsset | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [brandHexInput, setBrandHexInput] = useState("")
  const [brandHexError, setBrandHexError] = useState("")
  const [selectedClientId, setSelectedClientId] = useState(activeClientId || "")
  const [isClientPopoverOpen, setIsClientPopoverOpen] = useState(false)
  const [savedLogos, setSavedLogos] = useState<StoredAsset[]>([])
  const [savedMaterials, setSavedMaterials] = useState<StoredAsset[]>([])
  const [isLoadingClientAssets, setIsLoadingClientAssets] = useState(false)
  const [galleryRefreshKey, setGalleryRefreshKey] = useState(0)
  const [selectedGallerySessionId, setSelectedGallerySessionId] = useState<string | null>(null)
  const generationInFlightRef = useRef(false)
  const resizeInFlightRef = useRef(false)
  const editInFlightRef = useRef(false)
  const logoAssetRef = useRef<UploadedAsset | null>(null)
  const referenceAssetRef = useRef<UploadedAsset | null>(null)
  const insertAssetsRef = useRef<UploadedAsset[]>([])
  const editAssetRef = useRef<UploadedAsset | null>(null)
  const restoringBrandCacheRef = useRef(false)
  const selectedClient = clients.find(
    (client) =>
      client.id === selectedClientId ||
      client.productFocuses.some((productFocus) => productFocus.id === selectedClientId),
  )
  const selectedProductFocus =
    selectedClient?.productFocuses.find((productFocus) => productFocus.id === selectedClientId)?.productFocus ||
    selectedClient?.productFocuses[0]?.productFocus ||
    null
  const composedBrandContext = useMemo(
    () =>
      composeBrandContext({
        siteName: brandSiteName,
        pageTitle: brandPageTitle,
        metaDescription: brandMetaDescription,
        notes: brandContext,
      }),
    [brandContext, brandMetaDescription, brandPageTitle, brandSiteName],
  )

  const applyBrandContext = (value: string) => {
    const parsed = parseBrandContext(value)
    setBrandSiteName(parsed.siteName)
    setBrandPageTitle(parsed.pageTitle)
    setBrandMetaDescription(parsed.metaDescription)
    setBrandContext(parsed.notes)
  }

  useEffect(() => {
    setSelectedClientId(activeClientId || "")
  }, [activeClientId])

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
    editAssetRef.current = editAsset
  }, [editAsset])

  useEffect(() => {
    return () => {
      revokeAsset(logoAssetRef.current)
      revokeAsset(referenceAssetRef.current)
      insertAssetsRef.current.forEach((asset) => revokeAsset(asset))
      revokeAsset(editAssetRef.current)
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
    setBrandColorRoles(cached.brandColorRoles || cached.brandColorValues.map((_, index) => COLOR_ROLE_OPTIONS[index] || "Accent"))
    applyBrandContext(cached.brandContext)
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
    setBrandColorRoles(cached.brandColorRoles || cached.brandColorValues.map((_, index) => COLOR_ROLE_OPTIONS[index] || "Accent"))
    applyBrandContext(cached.brandContext)
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
    if (!brandName && brandColorValues.length === 0 && !composedBrandContext && !openBrandLogoUrl) return

    const nextCache = readBrandAssetCache()
    nextCache[cacheKey] = {
      website: website.trim(),
      brandName,
      brandColorValues,
      brandColorRoles,
      brandContext: composedBrandContext,
      openBrandLogoUrl,
      updatedAt: Date.now(),
    }
    writeBrandAssetCache(nextCache)
    window.localStorage.setItem(BRAND_ASSET_LAST_WEBSITE_KEY, website.trim())
  }, [brandColorRoles, brandColorValues, brandName, composedBrandContext, openBrandLogoUrl, website])

  useEffect(() => {
    if (!selectedClientId || restoringBrandCacheRef.current) return

    const cached = readClientBrandAssetCache()[selectedClientId]
    if (!cached) return

    restoringBrandCacheRef.current = true
    setWebsite(cached.website)
    setBrandName(cached.brandName)
    setBrandColorValues(cached.brandColorValues)
    setBrandColorRoles(cached.brandColorRoles || cached.brandColorValues.map((_, index) => COLOR_ROLE_OPTIONS[index] || "Accent"))
    applyBrandContext(cached.brandContext)
    setOpenBrandLogoUrl(cached.openBrandLogoUrl)
    setResult(null)
    setAdditionalOutputs([])
    window.setTimeout(() => {
      restoringBrandCacheRef.current = false
    }, 0)
  }, [selectedClientId])

  useEffect(() => {
    if (!selectedClientId || restoringBrandCacheRef.current) return
    if (!website && !brandName && brandColorValues.length === 0 && !composedBrandContext && !openBrandLogoUrl) return

    const nextCache = readClientBrandAssetCache()
    nextCache[selectedClientId] = {
      clientId: selectedClientId,
      website: website.trim(),
      brandName,
      brandColorValues,
      brandColorRoles,
      brandContext: composedBrandContext,
      openBrandLogoUrl,
      updatedAt: Date.now(),
    }
    writeClientBrandAssetCache(nextCache)
  }, [brandColorRoles, brandColorValues, brandName, composedBrandContext, openBrandLogoUrl, selectedClientId, website])

  const canGenerate = website.trim().length > 0 && headline.trim().length > 0 && Boolean(logoAsset)
  const selectedAdditionalSizeConfig = ADDITIONAL_SIZES.find((size) => size.key === selectedAdditionalSize) || ADDITIONAL_SIZES[0]

  const insertHint = useMemo(() => {
    if (insertAssets.length === 0) return "Optional product, model, or visual material to insert into the banner."
    return `${insertAssets.length}/${MAX_INSERT_IMAGES} image${insertAssets.length > 1 ? "s" : ""} selected`
  }, [insertAssets.length])

  const loadClientAssets = async (clientId: string) => {
    if (!clientId) {
      setSavedLogos([])
      setSavedMaterials([])
      return
    }

    setIsLoadingClientAssets(true)
    try {
      const storage = getStorageClient()
      if (!storage) {
        setSavedLogos([])
        setSavedMaterials([])
        return
      }

      const loadFolder = async (folderPath: string) => {
        const { data: files, error } = await storage.from("ads-creative-image").list(folderPath, {
          limit: 60,
          offset: 0,
          sortBy: { column: "name", order: "desc" },
        })

        if (error || !files?.length) return []

        return files.map((file) => {
          const { data } = storage.from("ads-creative-image").getPublicUrl(`${folderPath}/${file.name}`)
          return {
            name: file.name,
            url: data.publicUrl,
            createdAt: file.created_at || new Date().toISOString(),
          }
        })
      }

      const [logos, sharedMaterials, seoMaterials] = await Promise.all([
        loadFolder(`seo-blog-banner/${clientId}/logos`),
        loadFolder(`materials/${clientId}`),
        loadFolder(`seo-blog-banner/${clientId}/materials`),
      ])

      const sortAssets = (assets: StoredAsset[]) =>
        assets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      const uniqueAssets = (assets: StoredAsset[]) =>
        Array.from(new Map(assets.map((asset) => [asset.url, asset])).values())

      setSavedLogos(sortAssets(logos))
      setSavedMaterials(sortAssets(uniqueAssets([...sharedMaterials, ...seoMaterials])))
    } catch (error) {
      console.error("Failed to load SEO banner client assets:", error)
      setSavedLogos([])
      setSavedMaterials([])
    } finally {
      setIsLoadingClientAssets(false)
    }
  }

  useEffect(() => {
    void loadClientAssets(selectedClientId)
  }, [selectedClientId])

  const addBrandHexColor = () => {
    const value = brandHexInput.trim()
    const normalized = normalizeHexColor(value.startsWith("#") ? value : `#${value}`)
    const isValidHex = /^#(?:[0-9A-F]{3}|[0-9A-F]{6})$/i.test(value.startsWith("#") ? value : `#${value}`)

    if (!isValidHex) {
      setBrandHexError("Enter a valid HEX color, e.g. #0F172A")
      return
    }

    if (!brandColorValues.includes(normalized)) {
      const nextRole = COLOR_ROLE_OPTIONS[brandColorValues.length] || "Accent"
      setBrandColorValues((prev) => [...prev, normalized])
      setBrandColorRoles((prev) => [...prev, nextRole])
    }
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

  const updateBrandColorRole = (indexToUpdate: number, role: BrandColorRole) => {
    setBrandColorRoles((prev) => {
      const next = [...prev]
      next[indexToUpdate] = role
      return next
    })
    setResult(null)
    setAdditionalOutputs([])
  }

  const removeBrandColor = (indexToRemove: number) => {
    setBrandColorValues((prev) => prev.filter((_, index) => index !== indexToRemove))
    setBrandColorRoles((prev) => prev.filter((_, index) => index !== indexToRemove))
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

  const uploadAssetForGeneration = async (asset: UploadedAsset | null, fallbackFolder: string, clientFolder?: string) => {
    if (!asset) return ""
    if (asset.url) return asset.url
    if (!asset.file) return ""
    const folder =
      selectedClientId && clientFolder === "materials"
        ? `materials/${selectedClientId}`
        : selectedClientId && clientFolder
          ? `seo-blog-banner/${selectedClientId}/${clientFolder}`
          : fallbackFolder
    return uploadFileToImageStorage(asset.file, folder)
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
      const extractedColors = extractHexColors(payload.brand_colors || "").map(normalizeHexColor)
      setBrandColorValues(extractedColors)
      setBrandColorRoles(extractedColors.map((_, index) => COLOR_ROLE_OPTIONS[index] || "Accent"))
      applyBrandContext(payload.brand_context || "")
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
      setError("Website, headline, and a selected brand logo are required.")
      return
    }

    generationInFlightRef.current = true
    setIsGenerating(true)
    setError(null)

    try {
      const [brandLogoUrl, referenceImageUrl, insertImageUrls] = await Promise.all([
        uploadAssetForGeneration(logoAsset, "generated/seo-blog-banner-inputs/logo", "logos"),
        uploadAssetForGeneration(referenceAsset, "generated/seo-blog-banner-inputs/reference", "references"),
        insertAssets.length > 0
          ? Promise.all(
              insertAssets.map((asset) => uploadAssetForGeneration(asset, "generated/seo-blog-banner-inputs/materials", "materials")),
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
          brand_name: brandName.trim(),
          brand_colors: brandColorValues
            .map((color, index) => `${brandColorRoles[index] || "Accent"}: ${color}`)
            .join(", "),
          brand_context: composedBrandContext,
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

      const masterBlob = await normalizeToMasterCanvas(payload.image_data_url, logoAsset?.previewUrl)
      const publicUrl = await uploadGeneratedImageBlob(masterBlob, "generated/seo-blog-banner-outputs", "master-1600x900")

      setResultBlob(masterBlob)
      setAdditionalOutputs([])
      setResult({
        imageUrl: publicUrl,
        sourceDataUrl: payload.image_data_url,
        lockedLogoUrl: brandLogoUrl,
        provider: payload.provider || "openai",
        model: payload.model || "gpt-image-2 -> gemini-3.1-flash-image-preview",
        prompt: payload.prompt || "",
        requestedSize: payload.requested_size || "2K",
        targetMasterSize: payload.target_master_size || "1600x900",
        brandAssets: payload.brand_assets || null,
      })
      setSelectedGallerySessionId(null)

      void fetch("/api/image-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          featureType: "seo-banner",
          clientName: selectedClient?.clientName,
          productFocus: selectedProductFocus,
          title: headline.trim(),
          prompt: userBrief.trim() || headline.trim(),
          model: payload.model || "gpt-image-2",
          outputUrls: [publicUrl],
          inputUrls: [brandLogoUrl, referenceImageUrl, ...insertImageUrls].filter(Boolean),
          metadata: {
            website: website.trim(),
            brandName: brandName.trim(),
            headline: headline.trim(),
            subHeadline: subHeadline.trim(),
            targetMasterSize: payload.target_master_size || "1600x900",
            requestedSize: payload.requested_size || "2K",
            lockedLogoUrl: brandLogoUrl,
            brandAssets: payload.brand_assets || null,
          },
        }),
      })
        .then((saveResponse) => {
          if (saveResponse.ok) setGalleryRefreshKey((value) => value + 1)
        })
        .catch((saveError) => console.error("Failed to save SEO Banner gallery item:", saveError))

      if (selectedClientId) {
        void loadClientAssets(selectedClientId)
      }
    } catch (err) {
      console.error("SEO blog banner generation failed:", err)
      setError(err instanceof Error ? err.message : "Cannot generate SEO blog banner")
    } finally {
      generationInFlightRef.current = false
      setIsGenerating(false)
    }
  }

  const handleDownload = async () => {
    if (resultBlob) {
      await downloadBlob(resultBlob, "seo-blog-banner-master-1600x900.jpg")
      return
    }
    if (result?.imageUrl) {
      await downloadImageFromUrl(result.imageUrl, "seo-blog-banner-master-1600x900.jpg")
    }
  }

  const handleGalleryImageSelect = (session: ImageGenerationSession, imageIndex: number) => {
    const imageUrl = session.outputUrls[imageIndex]
    if (!imageUrl) return

    const metadata = session.metadata
    const savedHeadline = typeof metadata.headline === "string" ? metadata.headline : session.title
    const savedSubHeadline = typeof metadata.subHeadline === "string" ? metadata.subHeadline : ""
    const savedWebsite = typeof metadata.website === "string" ? metadata.website : ""
    const savedBrandName = typeof metadata.brandName === "string" ? metadata.brandName : ""
    const savedLockedLogoUrl =
      typeof metadata.lockedLogoUrl === "string" ? metadata.lockedLogoUrl : session.inputUrls[0] || ""

    if (savedHeadline) setHeadline(savedHeadline)
    if (savedSubHeadline) setSubHeadline(savedSubHeadline)
    if (savedWebsite) setWebsite(savedWebsite)
    if (savedBrandName) setBrandName(savedBrandName)

    setResultBlob(null)
    setAdditionalOutputs([])
    setResult({
      imageUrl,
      sourceDataUrl: imageUrl,
      lockedLogoUrl: savedLockedLogoUrl,
      provider: "openai",
      model: session.model || "image-generation",
      prompt: session.prompt,
      requestedSize: typeof metadata.requestedSize === "string" ? metadata.requestedSize : "2K",
      targetMasterSize: typeof metadata.targetMasterSize === "string" ? metadata.targetMasterSize : "1600x900",
      brandAssets:
        metadata.brandAssets && typeof metadata.brandAssets === "object"
          ? (metadata.brandAssets as SeoBlogBannerResult["brandAssets"])
          : null,
    })
    setSelectedGallerySessionId(session.id)
    setEditPrompt("")
    setEditError(null)
    setError(null)
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
          locked_logo_url: result.lockedLogoUrl,
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
      const resizedBlob = await normalizeToExactCanvas(
        payload.image_data_url,
        targetWidth,
        targetHeight,
        result.lockedLogoUrl,
      )
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

  const handleDownloadAdditional = async (output: AdditionalOutput) => {
    await downloadBlob(output.blob, `seo-blog-banner-${output.key}-${output.width}x${output.height}.jpg`)
  }

  const handleEditSelectedImage = async () => {
    if (editInFlightRef.current) return
    if (!result) {
      setEditError("Select or generate a banner first.")
      return
    }
    if (!editPrompt.trim()) {
      setEditError("Describe the change you want to make.")
      return
    }
    if (!result.lockedLogoUrl) {
      setEditError("This banner has no locked logo reference. Select a logo and generate a new master first.")
      return
    }

    editInFlightRef.current = true
    setIsEditing(true)
    setEditError(null)

    const sourceImageUrl = result.imageUrl
    const instruction = editPrompt.trim()

    try {
      const editMaterialUrl = await uploadAssetForGeneration(
        editAsset,
        "generated/seo-blog-banner-edit-inputs",
      )
      const response = await fetch("/api/edit-image-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: sourceImageUrl,
          locked_logo_url: result.lockedLogoUrl,
          seo_banner_mode: true,
          instruction,
          output_aspect_ratio: "16:9",
          output_image_size: "2K",
          material_image_urls: editMaterialUrl ? [editMaterialUrl] : [],
          client_name: selectedClient?.clientName,
          product_focus: selectedProductFocus,
        }),
      })
      const payload = await response.json()

      if (!response.ok || !payload.success || !payload.image_url) {
        throw new Error(payload?.error || "Cannot edit SEO banner")
      }

      const editedBlob = await normalizeToMasterCanvas(payload.image_url as string, result.lockedLogoUrl)
      const editedImageUrl = await uploadGeneratedImageBlob(
        editedBlob,
        "generated/seo-blog-banner-outputs",
        "edited-master-1600x900",
      )
      setResult((current) =>
        current
          ? {
              ...current,
              imageUrl: editedImageUrl,
              sourceDataUrl: editedImageUrl,
              model: payload.model || current.model,
              prompt: payload.prompt || instruction,
            }
          : current,
      )
      setResultBlob(editedBlob)
      setAdditionalOutputs([])
      setSelectedGallerySessionId(null)
      setEditPrompt("")

      void fetch("/api/image-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          featureType: "seo-banner",
          clientName: selectedClient?.clientName,
          productFocus: selectedProductFocus,
          title: headline.trim() || "Edited SEO Banner",
          prompt: instruction,
          model: payload.model || "gemini-image-edit",
          outputUrls: [editedImageUrl],
          inputUrls: [sourceImageUrl, result.lockedLogoUrl, editMaterialUrl].filter(Boolean),
          metadata: {
            website: website.trim(),
            brandName: brandName.trim(),
            headline: headline.trim(),
            subHeadline: subHeadline.trim(),
            lockedLogoUrl: result.lockedLogoUrl,
            parentImageUrl: sourceImageUrl,
            editInstruction: instruction,
            editMaterialUrl,
            targetMasterSize: "1600x900",
            requestedSize: "2K",
            brandAssets: result.brandAssets,
          },
        }),
      })
        .then((saveResponse) => {
          if (saveResponse.ok) setGalleryRefreshKey((value) => value + 1)
        })
        .catch((saveError) => console.error("Failed to save edited SEO Banner gallery item:", saveError))
    } catch (err) {
      console.error("SEO blog banner edit failed:", err)
      setEditError(err instanceof Error ? err.message : "Cannot edit SEO banner")
    } finally {
      editInFlightRef.current = false
      setIsEditing(false)
    }
  }

  const editPanel = result ? (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
      <div>
        <p className="text-sm font-semibold text-slate-950">Edit selected banner</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          The current image stays as the source. Only the requested change is applied, and the selected logo remains locked.
        </p>
      </div>
      <Label htmlFor="seo-banner-edit-prompt" className="mt-4 block">
        Edit instruction
      </Label>
      <Textarea
        id="seo-banner-edit-prompt"
        value={editPrompt}
        onChange={(event) => {
          setEditPrompt(event.target.value)
          setEditError(null)
        }}
        placeholder="เช่น เปลี่ยนพื้นหลังให้สว่างขึ้น และคงองค์ประกอบอื่นทั้งหมดไว้เหมือนเดิม"
        className="mt-2 min-h-[88px] resize-y rounded-2xl bg-white"
        disabled={isEditing}
      />
      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-900">Optional image for this edit</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Upload a product, person, object, or visual reference and describe how to use it in the edit prompt.
            </p>
          </div>
          {editAsset ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                revokeAsset(editAsset)
                setEditAsset(null)
              }}
              disabled={isEditing}
              className="h-8 shrink-0 rounded-full border-red-100 px-3 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Remove
            </Button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => document.getElementById("seo-banner-edit-image")?.click()}
          disabled={isEditing}
          className="mt-3 flex min-h-[96px] w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 transition hover:border-slate-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {editAsset ? (
            <img
              src={editAsset.previewUrl}
              alt="Optional image for banner edit"
              className="max-h-36 w-full object-contain p-2"
            />
          ) : (
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <ImagePlus className="h-4 w-4 text-slate-500" />
              Upload optional image
            </span>
          )}
        </button>
        <input
          id="seo-banner-edit-image"
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) {
              revokeAsset(editAsset)
              setEditAsset(createAsset(file))
              setEditError(null)
            }
            event.target.value = ""
          }}
        />
      </div>
      {editError ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {editError}
        </p>
      ) : null}
      {!result.lockedLogoUrl ? (
        <p className="mt-2 text-sm text-amber-700" role="status">
          This older banner has no locked logo reference. Select a logo and generate a new master before editing.
        </p>
      ) : null}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">Logo shape, color, proportions, and spelling cannot be edited.</p>
        <Button
          type="button"
          onClick={handleEditSelectedImage}
          disabled={isEditing || !editPrompt.trim() || !result.lockedLogoUrl}
          className="shrink-0 rounded-full bg-slate-950 text-white hover:bg-slate-800"
        >
          {isEditing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {isEditing ? "Editing..." : "Edit image"}
        </Button>
      </div>
    </div>
  ) : null

  const isV2 = variant === "v2"
  const v2LogoPreviewUrl = logoAsset?.previewUrl

  if (isV2) {
    return (
      <div className="grid gap-4 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
        <section className="min-w-0 space-y-4">
          <Card className="overflow-hidden rounded-[26px] border-black/10 bg-white shadow-[0_16px_44px_rgba(15,23,42,0.07)] ring-1 ring-black/[0.02]">
            <div className="border-b border-black/5 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <Globe2 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-slate-950">SEO Banner</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-600">
                    Generate a 16:9 master, then resize after approval.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 p-4">
              <div className="space-y-2">
                <Label>Client</Label>
                <Popover open={isClientPopoverOpen} onOpenChange={setIsClientPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={isClientPopoverOpen}
                      className="h-10 w-full justify-between rounded-2xl border-black/10 bg-white px-3 font-normal text-slate-900 hover:bg-white"
                    >
                      <span className="truncate">{selectedClient?.clientName || "Default mode / no client"}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-500" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-[var(--radix-popover-trigger-width)] min-w-[280px] rounded-2xl border-slate-200 p-0"
                  >
                    <Command>
                      <CommandInput placeholder="Type to search client..." />
                      <CommandList>
                        <CommandEmpty>No client found</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="Default mode / no client"
                            onSelect={() => {
                              setSelectedClientId("")
                              setIsClientPopoverOpen(false)
                            }}
                            className="flex items-center justify-between px-3 py-2"
                          >
                            <span>Default mode / no client</span>
                            <Check className={cn("h-4 w-4 text-slate-900", selectedClientId ? "opacity-0" : "opacity-100")} />
                          </CommandItem>
                          {clients.map((client) => (
                            <CommandItem
                              key={client.id}
                              value={client.clientName}
                              onSelect={() => {
                                setSelectedClientId(client.id)
                                setIsClientPopoverOpen(false)
                              }}
                              className="flex items-center justify-between px-3 py-2"
                            >
                              <span>{client.clientName}</span>
                              <Check
                                className={cn(
                                  "h-4 w-4 text-slate-900",
                                  selectedClientId === client.id ? "opacity-100" : "opacity-0",
                                )}
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                    <div className="border-t border-slate-100 p-2">
                      <Link
                        href="/new-client"
                        onClick={() => setIsClientPopoverOpen(false)}
                        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        <Plus className="h-4 w-4" />
                        Add new client
                      </Link>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo-website">Website *</Label>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <Input
                    id="seo-website"
                    value={website}
                    onChange={(event) => {
                      setWebsite(event.target.value)
                      setResult(null)
                    }}
                    placeholder="https://brand.com"
                    className="h-10 rounded-2xl"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleExtractBrandAssets}
                    disabled={!website.trim() || isExtractingBrand}
                    className="h-10 rounded-2xl px-3"
                  >
                    {isExtractingBrand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    <span className="ml-2 hidden sm:inline">Extract</span>
                  </Button>
                </div>
              </div>

              <div className="rounded-[22px] border border-black/10 bg-white p-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => document.getElementById("seo-logo-upload-v2")?.click()}
                    className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-slate-400 transition hover:border-slate-400"
                    aria-label="Upload logo"
                  >
                    {v2LogoPreviewUrl ? (
                      <img src={v2LogoPreviewUrl} alt="Brand logo" className="h-full w-full object-contain p-1.5" />
                    ) : (
                      <UploadCloud className="h-4 w-4" />
                    )}
                  </button>
                  <input
                    id="seo-logo-upload-v2"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      handleLogoSelect(event.target.files)
                      event.target.value = ""
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <Input
                      id="seo-brand-name"
                      value={brandName}
                      onChange={(event) => {
                        setBrandName(event.target.value)
                        setResult(null)
                      }}
                      placeholder="Brand name"
                      className="h-9 rounded-xl bg-white text-sm"
                    />
                    <div className="mt-2 flex items-center gap-1.5">
                      {brandColorValues.length > 0 ? (
                        brandColorValues.slice(0, 6).map((color, index) => (
                          <input
                            key={`brand-color-v2-compact-${index}`}
                            type="color"
                            value={color}
                            onChange={(event) => updateBrandColor(index, event.target.value)}
                            className="h-5 w-5 cursor-pointer appearance-none rounded-full border border-slate-200 bg-transparent p-0 [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0"
                            aria-label={`Brand color ${index + 1}`}
                          />
                        ))
                      ) : (
                        <span className="text-xs text-slate-500">No colors</span>
                      )}
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
                        placeholder="#HEX"
                        className="ml-auto h-7 max-w-[82px] rounded-full bg-white px-2 font-mono text-[11px]"
                      />
                      <Button type="button" variant="outline" onClick={addBrandHexColor} className="h-7 rounded-full px-2 text-[11px]">
                        Add
                      </Button>
                    </div>
                    {brandHexError ? <p className="mt-1 text-xs text-red-600">{brandHexError}</p> : null}
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                  {logoAsset
                    ? "Logo locked. Generation and edits must preserve this selected asset."
                    : "Logo required. Upload or choose a saved logo before generating."}
                </div>

                <details className="mt-2">
                  <summary className="cursor-pointer list-none text-xs font-semibold text-slate-500 hover:text-slate-800">
                    Brand context
                  </summary>
                  <Textarea
                    value={composedBrandContext}
                    onChange={(event) => {
                      applyBrandContext(event.target.value)
                      setResult(null)
                    }}
                    placeholder="Site name, page title, meta description, and useful website context"
                    className="mt-2 min-h-[80px] resize-y rounded-2xl bg-white"
                  />
                </details>
              </div>

              <div className="space-y-2 rounded-[22px] border border-black/10 bg-slate-50/80 p-3">
                <Label>Copy</Label>
                <Textarea
                  id="seo-headline"
                  value={headline}
                  onChange={(event) => setHeadline(event.target.value)}
                  placeholder="Headline * เช่น 5 วิธีเพิ่มยอดขายจาก SEO Content"
                  className="min-h-[58px] resize-none rounded-2xl bg-white"
                />
                <Textarea
                  id="seo-subheadline"
                  value={subHeadline}
                  onChange={(event) => setSubHeadline(event.target.value)}
                  placeholder="Subheadline"
                  className="min-h-[44px] resize-none rounded-2xl bg-white"
                />
                <Textarea
                  id="seo-user-brief"
                  value={userBrief}
                  onChange={(event) => {
                    setUserBrief(event.target.value)
                    setResult(null)
                  }}
                  placeholder="Creative direction เช่น editorial, clean, premium"
                  className="min-h-[52px] resize-none rounded-2xl bg-white"
                />
              </div>

              <details className="rounded-[22px] border border-black/10 bg-white p-4">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">References & materials</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {[
                        referenceAsset ? "reference selected" : "",
                        insertAssets.length ? `${insertAssets.length} material${insertAssets.length > 1 ? "s" : ""}` : "",
                        savedMaterials.length ? `${savedMaterials.length} saved` : "",
                      ].filter(Boolean).join(" • ") || "Optional image direction and inserts."}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-black/10">
                    Manage
                  </span>
                </summary>

                <div className="mt-4 space-y-4">
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

                  <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">Saved client assets</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {selectedClientId ? "Reuse saved materials or upload insert images." : "Choose a client to see saved materials."}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {isLoadingClientAssets ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          onClick={() => document.getElementById("seo-insert-assets-v2")?.click()}
                          disabled={insertAssets.length >= MAX_INSERT_IMAGES}
                        >
                          <ImagePlus className="mr-2 h-4 w-4" />
                          Upload
                        </Button>
                      </div>
                    </div>

                    {selectedClientId && savedLogos.length > 0 ? (
                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Saved logos</p>
                        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                          {savedLogos.slice(0, 8).map((asset) => (
                            <button
                              key={asset.url}
                              type="button"
                              onClick={() => {
                                revokeAsset(logoAsset)
                                setLogoAsset(createStoredAsset(asset))
                                setOpenBrandLogoUrl("")
                                setResult(null)
                              }}
                              className="h-14 w-14 flex-none overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 transition hover:border-slate-500"
                            >
                              <img src={asset.url} alt={asset.name} className="h-full w-full object-contain p-1" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {selectedClientId && savedMaterials.length > 0 ? (
                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Saved materials</p>
                        <div className="mt-2 grid grid-cols-4 gap-2">
                          {savedMaterials.slice(0, 8).map((asset) => {
                            const selected = insertAssets.some((item) => item.url === asset.url)
                            return (
                              <button
                                key={asset.url}
                                type="button"
                                disabled={selected || insertAssets.length >= MAX_INSERT_IMAGES}
                                onClick={() => {
                                  setInsertAssets((prev) => [...prev, createStoredAsset(asset)].slice(0, MAX_INSERT_IMAGES))
                                  setResult(null)
                                }}
                                className={cn(
                                  "relative aspect-square overflow-hidden rounded-2xl border bg-slate-50 transition",
                                  selected ? "border-slate-950 opacity-80" : "border-slate-200 hover:border-slate-500",
                                )}
                              >
                                <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" />
                                {selected ? (
                                  <span className="absolute inset-x-1 bottom-1 rounded-full bg-slate-950 px-2 py-1 text-[10px] font-semibold text-white">
                                    Selected
                                  </span>
                                ) : null}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}

                    {insertAssets.length > 0 ? (
                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Selected insert images</p>
                        <div className="mt-2 grid grid-cols-2 gap-3">
                          {insertAssets.map((asset, index) => (
                            <div key={asset.previewUrl} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                              <img src={asset.previewUrl} alt={`Insert image ${index + 1}`} className="h-24 w-full object-cover" />
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
                      </div>
                    ) : null}

                    <input
                      id="seo-insert-assets-v2"
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
                </div>
              </details>

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
                    Generating master...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generate SEO Banner
                  </>
                )}
              </Button>
            </div>
          </Card>
        </section>

        <section className="min-w-0 space-y-4">
          <Card className="overflow-hidden rounded-[26px] border-black/10 bg-white shadow-[0_16px_44px_rgba(15,23,42,0.07)] ring-1 ring-black/[0.02]">
            <div className="flex items-center justify-between gap-4 border-b border-black/5 px-5 py-4">
              <div>
                <p className="text-lg font-semibold text-slate-950">Master Output</p>
                <p className="mt-1 text-sm text-slate-500">1600 × 900 px · 16:9 master</p>
              </div>
              {result ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={handleGenerate}
                    disabled={!canGenerate || isGenerating}
                  >
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Generate
                  </Button>
                  <Button type="button" className="rounded-full bg-slate-950 text-white hover:bg-slate-800" onClick={handleDownload}>
                    <ArrowDownToLine className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="p-5">
              {result ? (
                <div className="space-y-5">
                  <button
                    type="button"
                    onClick={() => setIsPreviewOpen(true)}
                    className="group block w-full overflow-hidden rounded-[24px] border border-slate-200 bg-slate-100 shadow-sm"
                  >
                    <div className="aspect-video w-full">
                      <img
                        src={result.imageUrl}
                        alt="SEO blog banner master"
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.01]"
                      />
                    </div>
                  </button>

                  {editPanel}

                  <div className="rounded-[22px] border border-black/10 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">Resize exports</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Adapt the approved master into the selected SEO placement.
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
                          <span className={cn("mt-1 block text-xs", selectedAdditionalSize === size.key ? "text-slate-300" : "text-slate-500")}>
                            {size.width} × {size.height} px
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
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-4">
                  <div className="flex aspect-video w-full items-center justify-center rounded-[20px] bg-white shadow-inner">
                    <div className="max-w-sm text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-500 shadow-sm">
                        <Sparkles className="h-6 w-6" />
                      </div>
                      <p className="mt-4 text-base font-semibold text-slate-950">No banner generated yet</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Add website and headline, then generate the 16:9 master.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <GeneratedImageGallery
            featureType="seo-banner"
            clientName={selectedClient?.clientName}
            productFocus={selectedProductFocus}
            refreshKey={galleryRefreshKey}
            selectedSessionId={selectedGallerySessionId}
            onSelect={handleGalleryImageSelect}
          />
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

  const shellClassName = "grid gap-6 xl:grid-cols-[minmax(400px,580px)_1fr]"
  const cardClassName = "overflow-hidden rounded-[32px] border-slate-200 bg-white shadow-sm"
  const cardHeaderClassName = "border-b border-slate-100 p-6"
  const cardBodyClassName = "space-y-5 p-6"
  const fieldPanelClassName = "rounded-[24px] border border-slate-200 bg-slate-50 p-4"
  const nestedPanelClassName = "rounded-[24px] border border-slate-200 bg-white p-4"

  return (
    <div className={shellClassName}>
      <div className="xl:col-span-2">
        <GeneratedImageGallery
          featureType="seo-banner"
          clientName={selectedClient?.clientName}
          productFocus={selectedProductFocus}
          refreshKey={galleryRefreshKey}
          selectedSessionId={selectedGallerySessionId}
          onSelect={handleGalleryImageSelect}
        />
      </div>

      <section className="space-y-4">
        <Card className={cardClassName}>
          <div className={cardHeaderClassName}>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <Globe2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-semibold text-slate-950">SEO Blog Banner</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Generate the master blog header first. Additional sizes can be generated later after the master is approved.
                </p>
              </div>
            </div>
          </div>

          <div className={cardBodyClassName}>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Client connection</Label>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <Popover open={isClientPopoverOpen} onOpenChange={setIsClientPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={isClientPopoverOpen}
                        className="h-12 w-full justify-between rounded-2xl border-slate-200 bg-white px-4 font-normal text-slate-900 hover:bg-white"
                      >
                        <span className="truncate">{selectedClient?.clientName || "Default mode / no client"}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-500" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-[var(--radix-popover-trigger-width)] min-w-[280px] rounded-2xl border-slate-200 p-0"
                    >
                      <Command>
                        <CommandInput placeholder="Type to search client..." />
                        <CommandList>
                          <CommandEmpty>No client found</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="Default mode / no client"
                              onSelect={() => {
                                setSelectedClientId("")
                                setIsClientPopoverOpen(false)
                              }}
                              className="flex items-center justify-between px-3 py-2"
                            >
                              <span>Default mode / no client</span>
                              <Check
                                className={cn(
                                  "h-4 w-4 text-slate-900",
                                  selectedClientId ? "opacity-0" : "opacity-100",
                                )}
                              />
                            </CommandItem>
                            {clients.map((client) => (
                              <CommandItem
                                key={client.id}
                                value={client.clientName}
                                onSelect={() => {
                                  setSelectedClientId(client.id)
                                  setIsClientPopoverOpen(false)
                                }}
                                className="flex items-center justify-between px-3 py-2"
                              >
                                <span>{client.clientName}</span>
                                <Check
                                  className={cn(
                                    "h-4 w-4 text-slate-900",
                                    selectedClientId === client.id ? "opacity-100" : "opacity-0",
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                      <div className="border-t border-slate-100 p-2">
                        <Link
                          href="/new-client"
                          onClick={() => setIsClientPopoverOpen(false)}
                          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          <Plus className="h-4 w-4" />
                          Add new client
                        </Link>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {selectedClient
                      ? `Connected to ${selectedClient.clientName}. Uploaded logo/materials will be saved for reuse.`
                      : "Choose a client if you want to reuse saved SEO banner assets later."}
                  </p>
                </div>
              </div>

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

            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.2fr)] lg:items-stretch">
              <div className={cn(fieldPanelClassName, "flex h-full flex-col space-y-4")}>
                <AssetUpload
                  label="Brand Logo *"
                  description="Upload or choose the exact logo to lock for generation and every edit."
                  asset={logoAsset}
                  onSelect={handleLogoSelect}
                  onRemove={() => {
                    revokeAsset(logoAsset)
                    setLogoAsset(null)
                    setOpenBrandLogoUrl("")
                    setResult(null)
                  }}
                  compact
                />

                <div className="flex flex-1 flex-col space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Brand context</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Website context used by AI. Edit only if extraction is wrong.
                    </p>
                  </div>
                  <Textarea
                    value={composedBrandContext}
                    onChange={(event) => {
                      applyBrandContext(event.target.value)
                      setResult(null)
                    }}
                    placeholder="Site name, page title, meta description, and useful website context"
                    className="min-h-[178px] flex-1 resize-y rounded-2xl bg-white"
                  />
                </div>
              </div>

              <div className={cn(fieldPanelClassName, "h-full space-y-4")}>
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
                      <div className="grid gap-3">
                        {brandColorValues.map((color, index) => (
                          <div key={`brand-color-${index}`} className="group relative grid grid-cols-[72px_1fr] gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
                            <input
                              type="color"
                              value={color}
                              onChange={(event) => updateBrandColor(index, event.target.value)}
                              className="h-14 w-full cursor-pointer appearance-none rounded-2xl border border-slate-200 bg-transparent p-0 shadow-sm ring-offset-2 transition group-hover:ring-2 group-hover:ring-slate-300 [&::-moz-color-swatch]:rounded-2xl [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-2xl [&::-webkit-color-swatch]:border-0"
                              aria-label={`Brand color ${index + 1}`}
                            />
                            <div className="space-y-1">
                              <select
                                value={brandColorRoles[index] || "Accent"}
                                onChange={(event) => updateBrandColorRole(index, event.target.value as BrandColorRole)}
                                className="h-8 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 outline-none focus:border-slate-400"
                              >
                                {COLOR_ROLE_OPTIONS.map((role) => (
                                  <option key={role} value={role}>
                                    {role}
                                  </option>
                                ))}
                              </select>
                              <p className="px-1 font-mono text-xs text-slate-500">{color}</p>
                            </div>
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
                        className="h-10 rounded-full bg-white font-mono text-xs placeholder:text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addBrandHexColor}
                        className="h-10 shrink-0 rounded-full px-4"
                      >
                        Add color
                      </Button>
                    </div>
                    {brandHexError ? <p className="mt-2 text-xs text-red-600">{brandHexError}</p> : null}
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Click any color to edit it, or paste a HEX code manually.
                    </p>
                  </div>
                </div>

              </div>
            </div>

            <div className={cn(fieldPanelClassName, "space-y-3")}>
              <div className="space-y-2">
                <Label htmlFor="seo-headline">Headline *</Label>
                <Textarea
                  id="seo-headline"
                  value={headline}
                  onChange={(event) => setHeadline(event.target.value)}
                  placeholder="เช่น 5 วิธีเพิ่มยอดขายจาก SEO Content"
                  className="min-h-[74px] resize-none rounded-2xl bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo-subheadline">Sub-headline</Label>
                <Textarea
                  id="seo-subheadline"
                  value={subHeadline}
                  onChange={(event) => setSubHeadline(event.target.value)}
                  placeholder="ข้อความรองที่อยากให้ปรากฏบน banner"
                  className="min-h-[68px] resize-none rounded-2xl bg-white"
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
                  className="min-h-[92px] resize-y rounded-2xl bg-white"
                />
                <p className="text-xs leading-5 text-slate-500">
                  This brief is sent as a must-follow instruction for image generation.
                </p>
              </div>
            </div>

            <details className={nestedPanelClassName}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Reference and materials</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {[
                      referenceAsset ? "reference selected" : "",
                      insertAssets.length ? `${insertAssets.length} material${insertAssets.length > 1 ? "s" : ""}` : "",
                      savedMaterials.length ? `${savedMaterials.length} saved` : "",
                    ].filter(Boolean).join(" • ") || "Optional. Open only when you need to upload or reuse assets."}
                  </p>
                </div>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                  Manage
                </span>
              </summary>

              <div className="mt-4 space-y-4">
            <div className="grid gap-4">
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

            <div className={nestedPanelClassName}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Saved client assets</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {selectedClientId
                      ? "Choose saved materials or upload new insert images here. New uploads are saved to this client when generating."
                      : "Choose a client to see saved materials, or upload insert images for this generation only."}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isLoadingClientAssets ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => document.getElementById("seo-insert-assets")?.click()}
                    disabled={insertAssets.length >= MAX_INSERT_IMAGES}
                  >
                    <ImagePlus className="mr-2 h-4 w-4" />
                    Upload
                  </Button>
                </div>
              </div>

              {selectedClientId && savedLogos.length > 0 ? (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Saved logos</p>
                  <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                    {savedLogos.slice(0, 8).map((asset) => (
                      <button
                        key={asset.url}
                        type="button"
                        onClick={() => {
                          revokeAsset(logoAsset)
                          setLogoAsset(createStoredAsset(asset))
                          setOpenBrandLogoUrl("")
                          setResult(null)
                        }}
                        className="h-16 w-16 flex-none overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 transition hover:border-slate-500"
                      >
                        <img src={asset.url} alt={asset.name} className="h-full w-full object-contain p-1" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedClientId && savedMaterials.length > 0 ? (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Saved materials</p>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {savedMaterials.slice(0, 8).map((asset) => {
                      const selected = insertAssets.some((item) => item.url === asset.url)
                      return (
                        <button
                          key={asset.url}
                          type="button"
                          disabled={selected || insertAssets.length >= MAX_INSERT_IMAGES}
                          onClick={() => {
                            setInsertAssets((prev) => [...prev, createStoredAsset(asset)].slice(0, MAX_INSERT_IMAGES))
                            setResult(null)
                          }}
                          className={cn(
                            "relative aspect-square overflow-hidden rounded-2xl border bg-slate-50 transition",
                            selected ? "border-slate-950 opacity-80" : "border-slate-200 hover:border-slate-500",
                          )}
                        >
                          <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" />
                          {selected ? (
                            <span className="absolute inset-x-1 bottom-1 rounded-full bg-slate-950 px-2 py-1 text-[10px] font-semibold text-white">
                              Selected
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {!isLoadingClientAssets && selectedClientId && savedLogos.length === 0 && savedMaterials.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No saved assets for this client yet. Upload insert images here and generate once to save them.
                </div>
              ) : null}

              {insertAssets.length > 0 ? (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Selected insert images</p>
                  <div className="mt-2 grid grid-cols-2 gap-3">
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
                </div>
              ) : (
                <div className="mt-4 flex min-h-[96px] items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-slate-50 text-center">
                  <div>
                    <FileImage className="mx-auto h-6 w-6 text-slate-400" />
                    <p className="mt-2 text-sm font-medium text-slate-700">No insert images selected</p>
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
              </div>
            </details>

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
        <Card className={cn(cardClassName, "min-h-[640px]")}>
          <div className={cn("flex items-center justify-between gap-4", cardHeaderClassName)}>
            <div>
              <p className="text-lg font-semibold text-slate-950">Master Output</p>
              <p className="mt-1 text-sm text-slate-500">Target: 1600 × 900 px, 16:9</p>
            </div>
            {result ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={handleGenerate}
                  disabled={!canGenerate || isGenerating}
                >
                  {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Generate
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

                {editPanel}

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
                            : "The selected logo asset is locked and composited unchanged on every output."}
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

                <div className={nestedPanelClassName}>
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
              <div
                className={cn(
                  "flex items-center justify-center border border-dashed border-slate-300 bg-slate-50",
                  "min-h-[520px] rounded-[28px]",
                )}
              >
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
