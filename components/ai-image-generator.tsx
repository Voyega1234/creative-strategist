"use client"

import { useState, useEffect, useRef, useMemo, type ComponentProps } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { 
  Sparkles, 
  Image as ImageIcon, 
  Wand2, 
  Download, 
  Copy, 
  RefreshCw,
  CheckCircle,
  Loader2,
  Lightbulb,
  Target,
  X,
  Palette,
  Upload,
  Edit,
  Images,
  Layers3,
  Library,
  SlidersHorizontal,
  ChevronDown,
  Check,
  ChevronsUpDown,
} from "lucide-react"
import Image from "next/image"
import { getStorageClient, getSupabase } from "@/lib/supabase/client"
import { EditableSavedIdeaModal } from "@/components/editable-saved-idea-modal"
import { cn } from "@/lib/utils"
import {
  buildCustomIdeaFallback,
  getTopicPreviewText,
  type ParsedCustomIdea,
} from "@/lib/custom-idea-parser"

const ASPECT_RATIO_OPTIONS = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
]

const DEFAULT_IMAGE_COUNT = 1
const IMAGE_COUNT_OPTIONS = [1, 2, 3, 4, 5]

const AD_STYLE_OPTIONS = [
  {
    value: "clean-product-focus",
    label: "Clean Product Focus",
    previewImage: "/style-previews/clean-product-focus.svg",
    hoverDescription:
      "โฟกัสที่สินค้าเป็นหลัก ภาพสะอาด ดูพรีเมียม และมีลำดับสายตาที่ชัดแบบ product-led commercial ad.",
    userBrief:
      "Create a clean, premium product-led ad with disciplined composition, strong hierarchy, clear product focus, minimal clutter, refined typography integration, and polished commercial lighting.",
  },
  {
    value: "bold-offer-graphic",
    label: "Bold Offer Graphic",
    previewImage: "/style-previews/bold-offer-graphic.svg",
    hoverDescription:
      "เหมาะกับ ads ที่ต้องการชูโปรโมชัน ข้อเสนอ หรือ CTA ให้เด่น อ่านเร็ว และหยุดสายตาได้ทันที.",
    userBrief:
      "Create a bold performance ad with strong offer visibility, graphic framing, assertive typography, fast commercial readability, high contrast, and a composition built for thumb-stop conversion.",
  },
  {
    value: "lifestyle-human-story",
    label: "Lifestyle Human Story",
    previewImage: "/style-previews/lifestyle-human-story.svg",
    hoverDescription:
      "ใช้คนเป็นตัวนำอารมณ์และความน่าเชื่อถือ เพื่อให้ภาพดูมีชีวิตและเชื่อมโยงกับผู้ชมมากขึ้น.",
    userBrief:
      "Create a premium lifestyle ad where human presence drives aspiration, trust, and emotional clarity, with believable realism, natural posing, authentic skin texture, and strong product-message integration.",
  },
  {
    value: "editorial-premium",
    label: "Editorial Premium",
    previewImage: "/style-previews/editorial-premium.svg",
    hoverDescription:
      "ลุค editorial ที่มี negative space และ art direction ชัด เหมาะกับแบรนด์ที่อยากดู refined และ elevated.",
    userBrief:
      "Create an editorial-inspired premium ad with art-directed negative space, elegant type placement, elevated styling, restrained luxury cues, and a composition that feels authored rather than templated.",
  },
  {
    value: "comparison-education",
    label: "Comparison / Education",
    previewImage: "/style-previews/comparison-education.svg",
    hoverDescription:
      "เหมาะกับงานเปรียบเทียบ before/after หรือสื่อสารความต่างของ value proposition ให้เข้าใจในครั้งเดียว.",
    userBrief:
      "Create a persuasive comparison-led ad using a clear visual contrast or modular system to explain the value proposition quickly, with disciplined hierarchy and immediate commercial understanding.",
  },
  {
    value: "mixed-media-campaign",
    label: "Mixed Media Campaign",
    previewImage: "/style-previews/mixed-media-campaign.svg",
    hoverDescription:
      "ผสมภาพถ่ายกับกราฟิกเลเยอร์เพื่อให้ได้ความรู้สึก campaign ที่มีพลังและมีเอกลักษณ์มากกว่า static ad ปกติ.",
    userBrief:
      "Create a premium mixed-media campaign ad that blends photography and graphic design intentionally, with layered framing, text integrated into the composition, and a distinctive brand-ownable visual system.",
  },
] as const

interface ReferenceImage {
  name: string
  url: string
  size: number
  created_at: string
}

interface GeneratedImage {
  id: string
  url: string
  prompt: string
  topicTitle?: string
  topicSummary?: string
  reference_image?: string
  status: 'generating' | 'completed' | 'error'
  created_at: string
  source?: string
  aspectRatio?: string
  resolution?: string
  operation?: 'generate' | 'upscale'
  sourceImageUrl?: string
  sourceImageId?: string
}

const GENERATED_IMAGES_STORAGE_PREFIX = "cvc_generated_images"
const GENERATED_IMAGES_STORAGE_TTL = 30 * 24 * 60 * 60 * 1000
const MAX_STORED_GENERATED_IMAGES = 60

interface ClientOption {
  id: string
  clientName: string
  productFocuses: Array<{
    productFocus: string
  }>
  colorPalette?: string[]
}

function getGeneratedImagesStorageKey(clientId: string, productFocus: string) {
  return `${GENERATED_IMAGES_STORAGE_PREFIX}_${clientId}_${productFocus}`
}

function loadGeneratedImagesFromStorage(storageKey: string): GeneratedImage[] {
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

function saveGeneratedImagesToStorage(storageKey: string, images: GeneratedImage[]) {
  if (typeof window === "undefined") return

  try {
    const persistedImages = images
      .filter((image) => image.status === "completed" && image.url)
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

interface SavedTopic {
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

interface AIImageGeneratorProps {
  activeClientId?: string | null
  activeProductFocus?: string | null  
  activeClientName?: string | null
}

type EditableIdeaType = NonNullable<ComponentProps<typeof EditableSavedIdeaModal>["idea"]>

export function AIImageGenerator({ 
  activeClientId, 
  activeProductFocus, 
  activeClientName 
}: AIImageGeneratorProps) {
  const [prompt, setPrompt] = useState('')
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  
  // Client and product focus selection
  const [clients, setClients] = useState<ClientOption[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [selectedProductFocus, setSelectedProductFocus] = useState<string>('')
  const [loadingClients, setLoadingClients] = useState(true)
  const [isClientPopoverOpen, setIsClientPopoverOpen] = useState(false)
  
  // Strategic insights and topics
  const [savedTopics, setSavedTopics] = useState<SavedTopic[]>([])
  const [selectedTopic, setSelectedTopic] = useState<string>('')
  const [customIdeaInput, setCustomIdeaInput] = useState("")
  const [isCustomIdeaDialogOpen, setIsCustomIdeaDialogOpen] = useState(false)
  const [isParsingCustomIdea, setIsParsingCustomIdea] = useState(false)
  const [deletingTopicId, setDeletingTopicId] = useState<string | null>(null)
  const [topicEditModalOpen, setTopicEditModalOpen] = useState(false)
  const [topicBeingEdited, setTopicBeingEdited] = useState<SavedTopic | null>(null)
  const [loadingTopics, setLoadingTopics] = useState(false)
  
  // Reference image selection
  const MAX_REFERENCE_SELECTION = 5
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([])
  const [selectedReferenceImages, setSelectedReferenceImages] = useState<string[]>([])
  const [loadingReferenceImages, setLoadingReferenceImages] = useState(false)
  const [isUploadingReferences, setIsUploadingReferences] = useState(false)
  const [isReferenceDropActive, setIsReferenceDropActive] = useState(false)
  const [materialImages, setMaterialImages] = useState<ReferenceImage[]>([])
  const [loadingMaterialImages, setLoadingMaterialImages] = useState(false)
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([])
  const [isUploadingMaterials, setIsUploadingMaterials] = useState(false)
  const [colorPalette, setColorPalette] = useState<string[]>([])
  const [colorInput, setColorInput] = useState("")
  const [isSavingPalette, setIsSavingPalette] = useState(false)
  const [selectedAdStyle, setSelectedAdStyle] = useState<string>("")
  const [aspectRatio, setAspectRatio] = useState<string>(ASPECT_RATIO_OPTIONS[0])
  const [imageCount, setImageCount] = useState<number>(DEFAULT_IMAGE_COUNT)
  const [showAllTopics, setShowAllTopics] = useState(false)
  const [isIdeasOpen, setIsIdeasOpen] = useState(false)
  const [isPaletteOpen, setIsPaletteOpen] = useState(false)
  const [isMaterialsOpen, setIsMaterialsOpen] = useState(false)
  const [isReferencesOpen, setIsReferencesOpen] = useState(false)
  
  // AI generation results pagination
  const [showAllResults, setShowAllResults] = useState(false)
  const [savingImageId, setSavingImageId] = useState<string | null>(null)
  const [upscalingImageIds, setUpscalingImageIds] = useState<string[]>([])
  
  // Image preview modal
  const [selectedImageForPreview, setSelectedImageForPreview] = useState<string | null>(null)
  const materialInputRef = useRef<HTMLInputElement | null>(null)
  const referenceInputRef = useRef<HTMLInputElement | null>(null)
  const hydratedGalleryKeyRef = useRef<string | null>(null)
  const currentClient = useMemo(() => {
    if (!selectedClientId) return null
    return clients.find((client) => client.id === selectedClientId) || null
  }, [clients, selectedClientId])
  const selectedAdStyleOption = useMemo(
    () => AD_STYLE_OPTIONS.find((style) => style.value === selectedAdStyle) || null,
    [selectedAdStyle],
  )
  const selectedTopicData = useMemo(
    () => savedTopics.find((topic) => topic.title === selectedTopic) || null,
    [savedTopics, selectedTopic],
  )
  const selectedTopicSummary = selectedTopicData ? getTopicPreviewText(selectedTopicData.description) : ""
  const completedImages = generatedImages.filter((image) => image.status === "completed")
  const generatingImages = generatedImages.filter((image) => image.status === "generating")
  const errorImages = generatedImages.filter((image) => image.status === "error")
  const visibleImages = showAllResults ? generatedImages : generatedImages.slice(0, 12)
  const visibleTopics = showAllTopics ? savedTopics : savedTopics.slice(0, 4)
  const generatedImagesStorageKey = useMemo(() => {
    if (!selectedClientId || !selectedProductFocus) return null
    return getGeneratedImagesStorageKey(selectedClientId, selectedProductFocus)
  }, [selectedClientId, selectedProductFocus])

  const getSourceLabel = (value?: string) => {
    if (!value) return null
    const normalized = value.toLowerCase()
    const map: Record<string, string> = {
      gemini: "Gemini",
      gemini_2k: "Gemini 2K",
      ideogram: "Ideogram",
      dalle: "DALL·E",
      stable_diffusion: "Stable Diffusion",
    }
    if (map[normalized]) return map[normalized]
    return value
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
  }

  useEffect(() => {
    loadClients()
  }, [])

  useEffect(() => {
    const selectedClient = clients.find((client) => client.id === selectedClientId)
    setColorPalette(selectedClient?.colorPalette || [])
  }, [selectedClientId, clients])

  useEffect(() => {
    if (!generatedImagesStorageKey) {
      hydratedGalleryKeyRef.current = null
      setGeneratedImages([])
      return
    }

    const storedImages = loadGeneratedImagesFromStorage(generatedImagesStorageKey)
    setGeneratedImages(storedImages)
    hydratedGalleryKeyRef.current = generatedImagesStorageKey
  }, [generatedImagesStorageKey])

  useEffect(() => {
    if (!generatedImagesStorageKey) return
    if (hydratedGalleryKeyRef.current !== generatedImagesStorageKey) return

    saveGeneratedImagesToStorage(generatedImagesStorageKey, generatedImages)
  }, [generatedImages, generatedImagesStorageKey])

  useEffect(() => {
    if (selectedTopicData) {
      setIsIdeasOpen(true)
    }
  }, [selectedTopicData])

  // Update selection when props change (from URL parameters)
  useEffect(() => {
    if (activeClientId && activeProductFocus && clients.length > 0) {
      console.log('[AI Image Generator] Props changed, updating selection:', {
        activeClientId,
        activeProductFocus
      })
      setSelectedClientId(activeClientId)
      setSelectedProductFocus(activeProductFocus)
    }
  }, [activeClientId, activeProductFocus, clients])


  const loadClients = async () => {
    try {
      setLoadingClients(true)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      const response = await fetch(`${baseUrl}/api/clients-with-product-focus`)
      const clients = await response.json()
      
      console.log('[AI Image Generator] Loaded clients:', clients)
      
      if (Array.isArray(clients)) {
        const normalizedClients = clients.map((client: any) => ({
          ...client,
          colorPalette: Array.isArray(client.colorPalette) ? client.colorPalette : [],
        }))
        setClients(normalizedClients)
        
        // Auto-select based on props (from URL params) or first available
        if (activeClientId && activeProductFocus) {
          console.log('[AI Image Generator] Auto-selecting from props:', {
            activeClientId,
            activeProductFocus,
            activeClientName
          })
          setSelectedClientId(activeClientId)
          setSelectedProductFocus(activeProductFocus)
        } else if (clients.length > 0) {
          // Fallback to first client if no props provided
          const firstClient = clients[0]
          setSelectedClientId(firstClient.id)
          if (firstClient.productFocuses.length > 0) {
            setSelectedProductFocus(firstClient.productFocuses[0].productFocus)
          }
        }
      } else {
        console.error('[AI Image Generator] Invalid clients response format:', clients)
      }
    } catch (error) {
      console.error('Error loading clients:', error)
    } finally {
      setLoadingClients(false)
    }
  }

  const loadSavedTopics = async () => {
    if (!selectedClientId || !selectedProductFocus) return
    
    try {
      setLoadingTopics(true)
      const selectedClient = currentClient
      if (!selectedClient) return

      console.log('[AI Image Generator] Direct Supabase query for:', {
        clientName: selectedClient.clientName,
        productFocus: selectedProductFocus,
        selectedClientId
      })

      const supabase = getSupabase()
      const startTime = performance.now()

      const { data, error } = await supabase
        .from('savedideas')
        .select(`
          id,
          clientname,
          productfocus,
          title,
          description,
          category,
          concept_type,
          competitivegap,
          tags,
          content_pillar,
          product_focus,
          concept_idea,
          copywriting_headline,
          copywriting_sub_headline_1,
          copywriting_sub_headline_2,
          copywriting_bullets,
          copywriting_cta,
          savedat
        `)
        .eq('clientname', selectedClient.clientName)
        .eq('productfocus', selectedProductFocus)
        .order('savedat', { ascending: false })
        .limit(50)

      const endTime = performance.now()
      console.log(`[AI Image Generator] Direct Supabase query completed in ${endTime - startTime}ms for ${data?.length || 0} items`)

      if (error) {
        console.error('[AI Image Generator] Supabase error:', error)
        return
      }

      // Transform data to match SavedTopic interface
      const savedTopics = data.map(item => {
        // Parse tags from JSON array format
        let tags = [];
        try {
          tags = item.tags ? JSON.parse(item.tags) : [];
        } catch (e) {
          // Fallback to comma-separated if not JSON
          tags = item.tags ? item.tags.split(',').map((tag: string) => tag.trim()) : [];
        }

        // Parse bullets from JSON array format  
        let bullets = [];
        try {
          bullets = item.copywriting_bullets ? JSON.parse(item.copywriting_bullets) : [];
        } catch (e) {
          // Fallback to newline-separated if not JSON
          bullets = item.copywriting_bullets ? item.copywriting_bullets.split('\n').filter((b: string) => b.trim()) : [];
        }

        return {
          id: item.id,
          clientname: item.clientname,
          productfocus: item.productfocus,
          title: item.title,
          description: item.description,
          category: item.category,
          concept_type: item.concept_type || '',
          competitiveGap: item.competitivegap,
          tags: tags,
          content_pillar: item.content_pillar,
          product_focus: item.product_focus,
          concept_idea: item.concept_idea,
          copywriting: {
            headline: item.copywriting_headline || '',
            sub_headline_1: item.copywriting_sub_headline_1 || '',
            sub_headline_2: item.copywriting_sub_headline_2 || '',
            bullets: bullets,
            cta: item.copywriting_cta || ''
          }
        };
      });

      setSavedTopics(savedTopics)
      console.log('[AI Image Generator] Loaded saved topics:', savedTopics.length)

    } catch (error) {
      console.error('[AI Image Generator] Error loading saved topics:', error)
    } finally {
      setLoadingTopics(false)
    }
  }

  const loadMaterialImages = async (clientId: string) => {
    try {
      console.log("[AI Image Generator] Loading material images for", clientId)
      setLoadingMaterialImages(true)
      const storageClient = getStorageClient()

      if (!storageClient) {
        console.error("Storage client not available")
        setMaterialImages([])
        return
      }

      const folderPath = `materials/${clientId}`
      const { data: files, error } = await storageClient.from("ads-creative-image").list(folderPath, {
        limit: 100,
        offset: 0,
        sortBy: { column: "name", order: "desc" },
      })

      if (error) {
        if (error.message?.toLowerCase().includes("not found")) {
          setMaterialImages([])
          setSelectedMaterials([])
          return
        }
        console.error("Error loading material images:", error)
        return
      }

      if (!files || files.length === 0) {
        setMaterialImages([])
        setSelectedMaterials([])
        return
      }

      const imagePromises = files.map(async (file) => {
        const { data: urlData } = storageClient
          .from("ads-creative-image")
          .getPublicUrl(`${folderPath}/${file.name}`)

        return {
          name: file.name,
          url: urlData.publicUrl,
          size: file.metadata?.size || 0,
          created_at: file.created_at || new Date().toISOString(),
        }
      })

      const imageList = await Promise.all(imagePromises)
      const sortedImages = imageList.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )

      setMaterialImages(sortedImages)
      setSelectedMaterials((prev) => prev.filter((url) => sortedImages.some((image) => image.url === url)))
    } catch (error) {
      console.error("Error loading material images:", error)
    } finally {
      setLoadingMaterialImages(false)
    }
  }

  const loadReferenceImages = async () => {
    try {
      console.log('🔄 Starting to load reference images...')
      setLoadingReferenceImages(true)
      const storageClient = getStorageClient()
      
      if (!storageClient) {
        console.error('❌ Storage client not available')
        return
      }
      
      console.log('🔍 Fetching files from Supabase storage...')
      // Get list of image files from the 'ads-creative-image' bucket, 'references' folder
      // First get all files with basic info
      const { data: files, error } = await storageClient
        .from('ads-creative-image')
        .list('references/', {
          limit: 100,
          offset: 0,
          sortBy: { column: 'name', order: 'desc' } // Sort by name in descending order (newest first)
        })

      console.log('📊 Supabase storage response:', { 
        filesCount: files?.length || 0,
        error: error?.message || 'No error',
        files: files?.map(f => ({
          name: f.name,
          size: f.metadata?.size,
          created_at: f.created_at
        })) || []
      })

      if (error) {
        console.error('Error loading reference images:', error)
        return
      }

      if (!files || files.length === 0) {
        console.log('No reference images found')
        setReferenceImages([])
        return
      }

      // Convert files to image objects with public URLs
      const imagePromises = files.map(async (file) => {
        const { data: urlData } = storageClient
          .from('ads-creative-image')
          .getPublicUrl(`references/${file.name}`)
        
        return {
          name: file.name,
          url: urlData.publicUrl,
          size: file.metadata?.size || 0,
          created_at: file.created_at || new Date().toISOString()
        }
      })

      const imageList = await Promise.all(imagePromises)
      
      // Sort by created date (newest first)
      const sortedImages = imageList.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      
      setReferenceImages(sortedImages)
      console.log('[AI Image Generator] Loaded', sortedImages.length, 'reference images')
    } catch (error) {
      console.error('Error loading reference images:', error)
    } finally {
      setLoadingReferenceImages(false)
    }
  }

  useEffect(() => {
    if (selectedClientId && selectedProductFocus) {
      setSelectedReferenceImages([])
      loadSavedTopics()
      loadReferenceImages()
      loadMaterialImages(selectedClientId)
    } else {
      setMaterialImages([])
      setSelectedMaterials([])
      setSelectedReferenceImages([])
    }
  }, [selectedClientId, selectedProductFocus])

  const generateImage = async () => {
    if (!selectedClientId || !selectedProductFocus) {
      alert('กรุณาเลือกลูกค้าและ Product Focus')
      return
    }

    if (!selectedTopic && !prompt.trim()) {
      alert('กรุณาเลือกไอเดียที่บันทึกไว้ หรือใส่ brief ก่อน generate')
      return
    }

    setIsGenerating(true)
    
    const selectedClient = currentClient
    const topicTitle = selectedTopicData?.title || selectedTopic || 'Custom brief'
    const topicSummary = selectedTopicData ? getTopicPreviewText(selectedTopicData.description) : prompt.trim()
    const requestIds = Array.from({ length: imageCount }, () => crypto.randomUUID())

    const pendingImages: GeneratedImage[] = requestIds.map((id) => ({
      id,
      url: '',
      prompt: prompt.trim(),
      topicTitle,
      topicSummary,
      reference_image: undefined,
      status: 'generating',
      created_at: new Date().toISOString(),
      source: undefined,
      aspectRatio: aspectRatio,
      resolution: undefined,
      operation: 'generate',
      sourceImageUrl: undefined,
      sourceImageId: undefined,
    }))

    setGeneratedImages(prev => [...pendingImages, ...prev])

    try {
      const normalizeImageEntries = (entry: any): Array<{ url: string; source?: string }> => {
        const entries: Array<{ url: string; source?: string }> = []
        if (!entry) return entries

        if (typeof entry === "string") {
          entries.push({ url: entry })
          return entries
        }

        if (typeof entry === "object") {
          const knownKeys = ["url", "image_url", "gemini", "ideogram", "stable_diffusion", "dalle"]
          let found = false
          if (entry.url || entry.image_url) {
            entries.push({
              url: entry.url || entry.image_url,
              source: entry.source || entry.provider,
            })
            found = true
          }
          knownKeys.forEach((key) => {
            if (key !== "url" && key !== "image_url" && entry[key]) {
              entries.push({ url: entry[key], source: key })
              found = true
            }
          })
          if (!found) {
            Object.keys(entry).forEach((key) => {
              if (typeof entry[key] === "string") {
                entries.push({ url: entry[key], source: key })
              }
            })
          }
          return entries
        }

        return entries
      }

      const requestPayload = {
        prompt: prompt.trim(),
        reference_image_url: selectedReferenceImages[0] || null,
        reference_image_urls: selectedReferenceImages,
        client_name: selectedClient?.clientName,
        product_focus: selectedProductFocus,
        selected_topics: selectedTopicData ? [selectedTopicData] : [],
        core_concept: selectedTopicData?.concept_idea || prompt.trim(),
        topic_title: selectedTopicData?.title || 'Custom brief',
        topic_description: selectedTopicData?.description || prompt.trim(),
        content_pillar: selectedTopicData?.content_pillar || '',
        copywriting: selectedTopicData?.copywriting || null,
        color_palette: colorPalette,
        material_image_urls: selectedMaterials,
        ad_style: selectedAdStyleOption?.label || null,
        user_brief: selectedAdStyleOption?.userBrief || null,
        aspect_ratio: aspectRatio,
        image_count: 1,
      }

      const generateSingleImage = async (imageId: string) => {
        const response = await fetch(`/api/generate-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestPayload),
        })

        const responseText = await response.text()
        let result: any = null
        try {
          result = responseText ? JSON.parse(responseText) : {}
        } catch (parseError) {
          console.error("Failed to parse generate-image response:", parseError, responseText)
          throw new Error("Invalid response from image generator")
        }

        if (!response.ok) {
          throw new Error(result?.error || `การสร้างรูปไม่สำเร็จ (${response.status})`)
        }

        let finalImage: { url: string; source?: string } | null = null

        if (result.success && result.image_url) {
          finalImage = {
            url: result.image_url,
            source: result.provider || result.model || 'gemini',
          }
        } else if (result.success && result.images && Array.isArray(result.images)) {
          const normalizedEntries = result.images.flatMap((img: any) => normalizeImageEntries(img))
          if (normalizedEntries.length > 0) {
            finalImage = normalizedEntries[0]
          }
        }

        if (!finalImage) {
          throw new Error(result?.error || "No valid image URL returned from generator")
        }

        setGeneratedImages(prev => prev.map(img =>
          img.id === imageId
            ? {
                ...img,
                url: finalImage!.url,
                topicTitle,
                topicSummary,
                status: 'completed',
                reference_image: selectedReferenceImages[0] || undefined,
                source: finalImage!.source,
                aspectRatio: aspectRatio,
                operation: 'generate',
                sourceImageId: undefined,
              }
            : img,
        ))
      }

      const concurrentGenerationLimit = 2
      let failedCount = 0
      let nextRequestIndex = 0

      const runGenerationWorker = async () => {
        while (true) {
          const currentIndex = nextRequestIndex
          nextRequestIndex += 1

          if (currentIndex >= requestIds.length) {
            return
          }

          const imageId = requestIds[currentIndex]

          try {
            await generateSingleImage(imageId)
          } catch (error) {
            failedCount += 1
            console.error('Error generating AI image:', error)
            setGeneratedImages(prev => prev.map(img =>
              img.id === imageId
                ? { ...img, status: 'error' }
                : img,
            ))
          }
        }
      }

      await Promise.all(
        Array.from(
          { length: Math.min(concurrentGenerationLimit, requestIds.length) },
          () => runGenerationWorker(),
        ),
      )

      if (failedCount > 0) {
        alert(`มี ${failedCount} รูปที่สร้างไม่สำเร็จ`)
      }
    } catch (error) {
      console.error('Error generating AI images:', error)
      alert('เกิดข้อผิดพลาดในการสร้างภาพด้วย AI')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownloadImage = async (imageUrl: string) => {
    try {
      console.log('🔄 Starting image download from:', imageUrl)
      
      // Try direct download first (for same-origin or CORS-enabled URLs)
      try {
        const response = await fetch(imageUrl, {
          mode: 'cors',
          headers: {
            'Accept': 'image/*'
          }
        })
        
        if (response.ok) {
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `ai-generated-${Date.now()}.png`
          link.style.display = 'none'
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          window.URL.revokeObjectURL(url)
          console.log('✅ Image downloaded successfully')
          return
        }
      } catch (corsError) {
        console.log('⚠️ CORS download failed, trying proxy method:', corsError)
      }

      // Fallback: Use proxy API to download the image
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      const proxyResponse = await fetch(`${baseUrl}/api/download-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: imageUrl
        }),
      })

      if (proxyResponse.ok) {
        const blob = await proxyResponse.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `ai-generated-${Date.now()}.png`
        link.style.display = 'none'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        console.log('✅ Image downloaded via proxy')
      } else {
        // Last fallback: Open in new tab
        console.log('⚠️ Proxy download failed, opening in new tab')
        window.open(imageUrl, '_blank')
        alert('ไม่สามารถดาวน์โหลดอัตโนมัติได้ กรุณาคลิกขวาที่รูปภาพแล้วเลือก "บันทึกรูปภาพ"')
      }
      
    } catch (error) {
      console.error('❌ Error downloading image:', error)
      
      // Ultimate fallback: Open image in new tab
      try {
        window.open(imageUrl, '_blank')
        alert('ไม่สามารถดาวน์โหลดอัตโนมัติได้ กรุณาคลิกขวาที่รูปภาพแล้วเลือก "บันทึกรูปภาพ"')
      } catch (openError) {
        console.error('❌ Cannot open image in new tab:', openError)
        alert('เกิดข้อผิดพลาดในการดาวน์โหลด กรุณาคัดลอก URL แล้วเปิดในแท็บใหม่')
      }
    }
  }

  const copyImageUrl = async (imageUrl: string) => {
    try {
      await navigator.clipboard.writeText(imageUrl)
      alert('URL ถูกคัดลอกแล้ว!')
    } catch (error) {
      console.error('Error copying URL:', error)
    }
  }

  const uploadGeneratedBlobToStorage = async (blob: Blob, mimeType: string) => {
    const storageClient = getStorageClient()
    if (!storageClient) {
      throw new Error("Storage client not available")
    }

    const extensionMap: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
    }

    const extension = extensionMap[mimeType] || "png"
    const path = `generated/${selectedClientId || "general"}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}-4k.${extension}`

    const { data, error } = await storageClient.from("ads-creative-image").upload(path, blob, {
      contentType: mimeType,
    })

    if (error) {
      throw new Error(error.message)
    }

    const { data: publicUrlData } = storageClient.from("ads-creative-image").getPublicUrl(data.path)
    return publicUrlData.publicUrl
  }

  const upscaleImageTo2K = async (image: GeneratedImage) => {
    if (image.status !== "completed" || !image.url) {
      return
    }

    const upscaleJobId = crypto.randomUUID()
    const targetAspectRatio = image.aspectRatio || aspectRatio

    const pendingUpscale: GeneratedImage = {
      id: upscaleJobId,
      url: "",
      prompt: image.prompt,
      topicTitle: image.topicTitle,
      topicSummary: image.topicSummary,
      reference_image: image.reference_image,
      status: "generating",
      created_at: new Date().toISOString(),
      source: "gemini_2k",
      aspectRatio: targetAspectRatio,
      resolution: "2K",
      operation: "upscale",
      sourceImageUrl: image.url,
      sourceImageId: image.id,
    }

    setUpscalingImageIds((prev) => [...prev, image.id])
    setGeneratedImages((prev) => [pendingUpscale, ...prev])

    try {
      const response = await fetch("/api/upscale-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url: image.url,
          prompt: image.prompt || image.topicSummary || "",
          aspect_ratio: targetAspectRatio,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result.success || !result.image_base64) {
        throw new Error(result?.error || "ไม่สามารถ upscale ภาพได้")
      }

      const byteCharacters = atob(result.image_base64)
      const byteArray = Uint8Array.from(byteCharacters, (char) => char.charCodeAt(0))
      const mimeType = result.mime_type || "image/png"
      const publicUrl = await uploadGeneratedBlobToStorage(
        new Blob([byteArray], { type: mimeType }),
        mimeType,
      )

      setGeneratedImages((prev) =>
        prev.map((item) =>
          item.id === upscaleJobId
            ? {
                ...item,
                url: publicUrl,
                status: "completed",
                source: "gemini_2k",
                aspectRatio: result.aspect_ratio || targetAspectRatio,
                resolution: "2K",
              }
            : item,
        ),
      )
    } catch (error) {
      console.error("Error upscaling image:", error)
      setGeneratedImages((prev) =>
        prev.map((item) =>
          item.id === upscaleJobId
            ? {
                ...item,
                status: "error",
              }
            : item,
        ),
      )
      alert(error instanceof Error ? error.message : "ไม่สามารถ upscale ภาพได้")
    } finally {
      setUpscalingImageIds((prev) => prev.filter((id) => id !== image.id))
    }
  }

  const saveImageToSupabase = async (imageUrl: string, imageId: string) => {
    try {
      setSavingImageId(imageId)
      
      const selectedClient = clients.find(c => c.id === selectedClientId)
      if (!selectedClient) {
        alert('ไม่พบข้อมูลลูกค้า')
        return
      }

      // Convert Pinterest URL to a filename
      const urlParts = imageUrl.split('/')
      const filename = urlParts[urlParts.length - 1] || `pinterest-${Date.now()}.jpg`
      
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      const response = await fetch(`${baseUrl}/api/save-pinterest-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: imageUrl,
          filename: filename,
          client_name: selectedClient.clientName,
          product_focus: selectedProductFocus,
          search_prompt: prompt.trim(),
          selected_topics: selectedTopic ? [selectedTopic] : []
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert('บันทึกรูปภาพเรียบร้อยแล้ว!')
      } else {
        alert(`เกิดข้อผิดพลาด: ${result.error || 'ไม่สามารถบันทึกรูปภาพได้'}`)
      }
    } catch (error) {
      console.error('Error saving image:', error)
      alert('เกิดข้อผิดพลาดในการบันทึกรูปภาพ')
    } finally {
      setSavingImageId(null)
    }
  }

  const retryGeneration = (imageId: string) => {
    const image = generatedImages.find(img => img.id === imageId)
    if (image) {
      if (image.operation === "upscale" && image.sourceImageUrl) {
        setGeneratedImages(prev => prev.filter(img => img.id !== imageId))
        void upscaleImageTo2K({
          ...image,
          id: image.sourceImageId || image.id,
          url: image.sourceImageUrl,
          status: "completed",
        })
        return
      }

      setPrompt(image.prompt)
      // Remove the failed image
      setGeneratedImages(prev => prev.filter(img => img.id !== imageId))
    }
  }

  const handleMaterialToggle = (url: string) => {
    setSelectedMaterials((prev) => {
      if (prev.includes(url)) {
        return prev.filter((item) => item !== url)
      }
      return [...prev, url]
    })
  }

  const handleReferenceUpload = async (files: FileList | null) => {
    if (!files) return

    const storageClient = getStorageClient()
    if (!storageClient) {
      alert("ไม่สามารถเชื่อมต่อที่จัดเก็บไฟล์ได้")
      return
    }

    setIsUploadingReferences(true)
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue
        const fileExt = file.name.split(".").pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`
        const fullPath = `references/${fileName}`
        const { error } = await storageClient.from("ads-creative-image").upload(fullPath, file)
        if (error) {
          console.error("Reference upload error:", error)
          throw error
        }
      }

      await loadReferenceImages()
    } catch (error) {
      console.error("Failed to upload references:", error)
      alert("เกิดข้อผิดพลาดในการอัปโหลดรูป reference")
    } finally {
      setIsUploadingReferences(false)
      setIsReferenceDropActive(false)
      if (referenceInputRef.current) {
        referenceInputRef.current.value = ""
      }
    }
  }

  const handleMaterialUpload = async (files: FileList | null) => {
    if (!files || !selectedClientId) {
      alert("กรุณาเลือกลูกค้าก่อนอัปโหลดวัสดุ")
      return
    }

    const storageClient = getStorageClient()
    if (!storageClient) {
      alert("ไม่สามารถเชื่อมต่อที่จัดเก็บไฟล์ได้")
      return
    }

    setIsUploadingMaterials(true)
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue
        const fileExt = file.name.split(".").pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`
        const fullPath = `materials/${selectedClientId}/${fileName}`
        const { error } = await storageClient.from("ads-creative-image").upload(fullPath, file)
        if (error) {
          console.error("Material upload error:", error)
          throw error
        }
      }

      await loadMaterialImages(selectedClientId)
      alert("อัปโหลดวัสดุเรียบร้อยแล้ว")
    } catch (error) {
      console.error("Failed to upload materials:", error)
      alert("เกิดข้อผิดพลาดในการอัปโหลดวัสดุ")
    } finally {
      setIsUploadingMaterials(false)
      if (materialInputRef.current) {
        materialInputRef.current.value = ""
      }
    }
  }

  const sanitizeColorValue = (value: string) => {
    return value.replace(/[^0-9a-fA-F]/g, "").substring(0, 6).toUpperCase()
  }

  const handleAddColor = () => {
    const sanitized = sanitizeColorValue(colorInput)
    if (!sanitized) {
      alert("กรุณากรอกโค้ดสีที่ถูกต้อง")
      return
    }
    if (colorPalette.includes(sanitized)) {
      setColorInput("")
      return
    }
    setColorPalette((prev) => [...prev, sanitized])
    setColorInput("")
  }

  const handleRemoveColor = (index: number) => {
    setColorPalette((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSavePalette = async () => {
    if (!selectedClientId) {
      alert("กรุณาเลือกลูกค้าก่อน")
      return
    }
    setIsSavingPalette(true)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ""
      const response = await fetch(`${baseUrl}/api/update-client-color`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId: selectedClientId,
          colorPalette,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        alert(result?.error || "ไม่สามารถบันทึกพาเลตสีได้")
        return
      }

      setClients((prev) =>
        prev.map((client) =>
          client.id === selectedClientId ? { ...client, colorPalette } : client,
        ),
      )
      alert("บันทึกพาเลตสีเรียบร้อยแล้ว")
    } catch (error) {
      console.error("Failed to save color palette:", error)
      alert("เกิดข้อผิดพลาดในการบันทึกพาเลตสี")
    } finally {
      setIsSavingPalette(false)
    }
  }

  const handleTopicSave = (updatedIdea: SavedTopic) => {
    setSavedTopics((prev) =>
      prev.map((topic) => {
        const matches = updatedIdea.id
          ? topic.id === updatedIdea.id
          : topic.title === topicBeingEdited?.title
        return matches ? { ...topic, ...updatedIdea } : topic
      }),
    )
    if (updatedIdea.title && selectedTopic === topicBeingEdited?.title) {
      setSelectedTopic(updatedIdea.title)
    }
  }

  const buildSavedTopicFromParsedIdea = (
    parsedIdea: ParsedCustomIdea,
    fallbackClientName: string | null,
    fallbackProductFocus: string | null,
  ): SavedTopic => ({
    id: `custom-${crypto.randomUUID()}`,
    clientname: fallbackClientName || "",
    productfocus: fallbackProductFocus || "",
    title: parsedIdea.title,
    description: parsedIdea.description,
    category: parsedIdea.category,
    concept_type: parsedIdea.concept_type,
    competitiveGap: parsedIdea.competitiveGap,
    tags: parsedIdea.tags,
    content_pillar: parsedIdea.content_pillar,
    product_focus: fallbackProductFocus || "",
    concept_idea: parsedIdea.concept_idea,
    copywriting: parsedIdea.copywriting,
  })

  const transformSavedIdeaRecordToTopic = (record: any): SavedTopic => {
    let tags: string[] = []
    try {
      tags = Array.isArray(record?.tags) ? record.tags : JSON.parse(record?.tags || "[]")
    } catch {
      tags = typeof record?.tags === "string" ? record.tags.split(",").map((tag: string) => tag.trim()).filter(Boolean) : []
    }

    let bullets: string[] = []
    try {
      bullets = Array.isArray(record?.copywriting_bullets)
        ? record.copywriting_bullets
        : JSON.parse(record?.copywriting_bullets || "[]")
    } catch {
      bullets =
        typeof record?.copywriting_bullets === "string"
          ? record.copywriting_bullets.split(",").map((bullet: string) => bullet.trim()).filter(Boolean)
          : []
    }

    return {
      id: record?.id,
      clientname: record?.clientname || currentClient?.clientName || activeClientName || "",
      productfocus: record?.productfocus || selectedProductFocus,
      title: record?.title || "Untitled Idea",
      description: record?.description || "",
      category: record?.category || "Educate",
      concept_type: record?.concept_type || "",
      competitiveGap: record?.competitivegap || record?.competitiveGap || "",
      tags,
      content_pillar: record?.content_pillar || "",
      product_focus: record?.product_focus || selectedProductFocus || "",
      concept_idea: record?.concept_idea || record?.description || "",
      copywriting: {
        headline: record?.copywriting_headline || record?.copywriting?.headline || "",
        sub_headline_1: record?.copywriting_sub_headline_1 || record?.copywriting?.sub_headline_1 || "",
        sub_headline_2: record?.copywriting_sub_headline_2 || record?.copywriting?.sub_headline_2 || "",
        bullets,
        cta: record?.copywriting_cta || record?.copywriting?.cta || "",
      },
    }
  }

  const handleAddCustomIdea = async () => {
    const normalizedInput = customIdeaInput.trim()

    if (!normalizedInput) {
      alert("กรุณาใส่ idea ก่อน")
      return
    }

    if (!selectedClientId || !selectedProductFocus) {
      alert("กรุณาเลือกลูกค้าและ Product Focus ก่อน")
      return
    }

    const fallbackClientName = currentClient?.clientName || activeClientName || null
    if (!fallbackClientName || fallbackClientName === "No Client Selected") {
      alert("ไม่พบชื่อลูกค้าที่ใช้บันทึกไอเดีย")
      return
    }

    let parsedIdea = buildCustomIdeaFallback(normalizedInput)

    try {
      setIsParsingCustomIdea(true)
      const response = await fetch("/api/parse-custom-idea", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputText: normalizedInput,
          clientName: fallbackClientName,
          productFocus: selectedProductFocus,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.idea) {
          parsedIdea = result.idea as ParsedCustomIdea
        }
      } else {
        console.error("[AI Image Generator] Failed to parse custom idea:", response.status)
      }
    } catch (error) {
      console.error("[AI Image Generator] Error parsing custom idea:", error)
    }

    const customTopic = buildSavedTopicFromParsedIdea(
      parsedIdea,
      fallbackClientName,
      selectedProductFocus,
    )

    try {
      const saveResponse = await fetch("/api/save-idea", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idea: customTopic,
          clientName: fallbackClientName,
          productFocus: selectedProductFocus,
          action: "save",
        }),
      })

      const saveResult = await saveResponse.json()

      if (!saveResponse.ok || !saveResult.success) {
        alert(saveResult?.error || "ไม่สามารถบันทึกไอเดียได้")
        return
      }

      const persistedTopic = transformSavedIdeaRecordToTopic(saveResult.savedIdea || customTopic)

      setSavedTopics((prev) => {
        const withoutDuplicateTitle = prev.filter((topic) => topic.title !== persistedTopic.title)
        return [persistedTopic, ...withoutDuplicateTitle]
      })
      setSelectedTopic(persistedTopic.title)
      setShowAllTopics(false)
      setCustomIdeaInput("")
      setIsCustomIdeaDialogOpen(false)
    } catch (error) {
      console.error("[AI Image Generator] Error saving custom idea:", error)
      alert("เกิดข้อผิดพลาดในการบันทึกไอเดีย")
    } finally {
      setIsParsingCustomIdea(false)
    }
  }

  const handleDeleteTopic = async (topic: SavedTopic) => {
    const topicKey = topic.id || topic.title
    const isCustomTopic = topic.id?.startsWith("custom-")
    const confirmed = window.confirm(`ลบไอเดีย "${topic.title}" ใช่หรือไม่?`)

    if (!confirmed) {
      return
    }

    try {
      setDeletingTopicId(topicKey)

      if (!isCustomTopic) {
        const supabase = getSupabase()
        const query = supabase.from("savedideas").delete()

        const { error } = topic.id
          ? await query.eq("id", topic.id)
          : await query
              .eq("clientname", topic.clientname || currentClient?.clientName || "")
              .eq("productfocus", topic.productfocus || selectedProductFocus)
              .eq("title", topic.title)

        if (error) {
          console.error("[AI Image Generator] Error deleting saved idea:", error)
          alert("เกิดข้อผิดพลาดในการลบไอเดีย")
          return
        }
      }

      const nextTopics = savedTopics.filter((item) => (item.id || item.title) !== topicKey)
      setSavedTopics(nextTopics)

      if (selectedTopic === topic.title) {
        setSelectedTopic(nextTopics[0]?.title || "")
      }
    } catch (error) {
      console.error("[AI Image Generator] Error deleting topic:", error)
      alert("เกิดข้อผิดพลาดในการลบไอเดีย")
    } finally {
      setDeletingTopicId(null)
    }
  }

  const convertTopicToEditableIdea = (
    topic: SavedTopic | null,
    fallbackClientName: string | null,
    fallbackProductFocus: string | null,
  ): EditableIdeaType | null => {
    if (!topic) return null

    const tags = Array.isArray(topic.tags) ? JSON.stringify(topic.tags) : topic.tags || "[]"
    const bullets =
      Array.isArray(topic.copywriting.bullets) || typeof topic.copywriting.bullets === "string"
        ? Array.isArray(topic.copywriting.bullets)
          ? JSON.stringify(topic.copywriting.bullets)
          : topic.copywriting.bullets
        : "[]"

    return {
      id: topic.id || "",
      clientname: topic.clientname || fallbackClientName || "",
      productfocus: topic.productfocus || fallbackProductFocus || "",
      title: topic.title,
      description: topic.description,
      category: topic.category,
      concept_type: topic.concept_type,
      impact: topic.concept_type,
      competitivegap: topic.competitiveGap,
      tags,
      content_pillar: topic.content_pillar,
      product_focus: topic.product_focus,
      concept_idea: topic.concept_idea,
      copywriting_headline: topic.copywriting.headline,
      copywriting_sub_headline_1: topic.copywriting.sub_headline_1,
      copywriting_sub_headline_2: topic.copywriting.sub_headline_2,
      copywriting_bullets: bullets,
      copywriting_cta: topic.copywriting.cta,
      savedat: new Date().toISOString(),
    }
  }

  const convertEditableIdeaToTopic = (idea: EditableIdeaType): SavedTopic => {
    const parseArray = (input: any) => {
      if (Array.isArray(input)) return input
      if (typeof input === "string") {
        try {
          return JSON.parse(input)
        } catch {
          return input.split(",").map((item) => item.trim()).filter(Boolean)
        }
      }
      return []
    }

    return {
      id: idea.id,
      clientname: idea.clientname,
      productfocus: idea.productfocus,
      title: idea.title,
      description: idea.description,
      category: idea.category,
      concept_type: idea.concept_type,
      competitiveGap: idea.competitivegap,
      tags: parseArray(idea.tags),
      content_pillar: idea.content_pillar,
      product_focus: idea.product_focus,
      concept_idea: idea.concept_idea,
      copywriting: {
        headline: idea.copywriting_headline,
        sub_headline_1: idea.copywriting_sub_headline_1,
        sub_headline_2: idea.copywriting_sub_headline_2,
        bullets: parseArray(idea.copywriting_bullets),
        cta: idea.copywriting_cta,
      },
    }
  }

  const selectedStyleLabel = selectedAdStyleOption?.label || "No style selected"
  const hasPrompt = prompt.trim().length > 0
  const hasIdeaOrBrief = Boolean(selectedTopic || hasPrompt)
  const hasOptionalDirection =
    !!selectedAdStyleOption ||
    selectedMaterials.length > 0 ||
    selectedReferenceImages.length > 0 ||
    colorPalette.length > 0 ||
    aspectRatio !== "4:5" ||
    imageCount > 1
  const canChooseIdea = Boolean(selectedClientId && selectedProductFocus)
  const canGenerate = Boolean(selectedClientId && selectedProductFocus && hasIdeaOrBrief)
  const setupStatusItems = [
    { label: "Client", done: Boolean(selectedClientId) },
    { label: "Brief", done: hasIdeaOrBrief },
    { label: "Optional", done: hasOptionalDirection },
  ]

  return (
    <div className="space-y-8">
      <div className="rounded-[32px] border border-slate-200/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(248,250,252,0.94)_100%)] px-7 py-7 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Generate Ads</p>
            <h3 className="mt-3 text-[32px] font-semibold tracking-[-0.03em] text-slate-950">Generate ads from a brief</h3>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
              เริ่มจาก brief ที่เขียนเองได้เลย หรือใช้ saved idea เป็น starting point จากนั้นค่อยเติม style,
              references และ assets เพิ่มเท่าที่จำเป็น
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {setupStatusItems.map((item, index) => (
              <div key={item.label} className="flex items-center gap-2 text-sm text-slate-500">
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    item.done ? "bg-slate-950" : "bg-slate-200",
                  )}
                />
                <span className={cn(item.done ? "text-slate-800" : "text-slate-400")}>
                  {index + 1}. {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Card className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_14px_32px_rgba(15,23,42,0.04)]">
        <div className="px-7 pt-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Step 1</p>
              <h4 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-slate-950">Choose client and product focus</h4>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                เลือก context ที่จะใช้ generate ก่อน แล้วค่อยไปเขียน brief ใน step ถัดไป
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-500">
              <div>
                <span className="text-slate-400">Client</span>
                <span className="ml-2 text-slate-700">{currentClient?.clientName || "Not selected"}</span>
              </div>
              <div>
                <span className="text-slate-400">Focus</span>
                <span className="ml-2 text-slate-700">{selectedProductFocus || "Not selected"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-7">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <Target className="h-4 w-4 text-blue-600" />
                Client
              </label>
              {loadingClients ? (
                <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  <span className="ml-2 text-sm text-slate-500">กำลังโหลด...</span>
                </div>
              ) : (
                <Popover open={isClientPopoverOpen} onOpenChange={setIsClientPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={isClientPopoverOpen}
                      className="h-12 w-full justify-between rounded-2xl border-slate-200 bg-white px-4 font-normal text-slate-900 hover:bg-white"
                    >
                      <span className="truncate">{currentClient?.clientName || "เลือกลูกค้า"}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-500" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[280px] rounded-2xl border-slate-200 p-0">
                    <Command>
                      <CommandInput placeholder="พิมพ์ค้นหาชื่อลูกค้า..." />
                      <CommandList>
                        <CommandEmpty>ไม่พบชื่อลูกค้า</CommandEmpty>
                        <CommandGroup>
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
                  </PopoverContent>
                </Popover>
              )}
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-900">Product Focus</label>
              {selectedClientId ? (
                <Select value={selectedProductFocus} onValueChange={setSelectedProductFocus}>
                  <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-white focus:border-slate-950 focus:ring-0">
                    <SelectValue placeholder="เลือก Product Focus" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients
                      .find((client) => client.id === selectedClientId)
                      ?.productFocuses.map((pf) => (
                        <SelectItem key={pf.productFocus} value={pf.productFocus}>
                          {pf.productFocus}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  เลือกลูกค้าก่อน
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_14px_32px_rgba(15,23,42,0.04)]">
        <div className="px-7 pt-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Step 2</p>
          <h4 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-slate-950">Write your brief</h4>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            เขียน brief เองได้ทันที หรือใช้ saved idea เป็น starting point แล้วค่อยเติม optional direction เพิ่มเมื่อจำเป็น
          </p>
        </div>

        <div className="space-y-7 p-7">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_280px]">
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-900">Creative brief</label>
                <Textarea
                  placeholder="เช่น: โปรโมตคอร์สหน้าใสสำหรับผู้หญิงวัยทำงาน โทน premium clean มี product shot เด่น ราคาอ่านง่าย และภาพดูเป็นแอดจริง"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={5}
                  className="min-h-[132px] resize-none rounded-2xl border-slate-200 bg-white text-slate-950 focus:border-slate-950 focus:ring-0"
                />
                <p className="text-xs leading-5 text-slate-500">
                  พิมพ์ brief เองได้เลย ถ้าอยากเริ่มเร็วขึ้นค่อยเลือก saved idea ด้านล่างเป็น starting point
                </p>
              </div>

              {selectedTopicData && (
                <div className="rounded-[24px] bg-slate-50 px-5 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Saved idea selected</p>
                      <h5 className="mt-2 text-lg font-semibold text-slate-950">{selectedTopicData.title}</h5>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{selectedTopicSummary}</p>
                    </div>
                    <CheckCircle className="h-5 w-5 flex-shrink-0 text-slate-900" />
                  </div>
                </div>
              )}

              <Collapsible
                open={isIdeasOpen}
                onOpenChange={setIsIdeasOpen}
                className="rounded-2xl border border-slate-200 bg-slate-50/70"
              >
                <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      <Library className="h-4 w-4 text-slate-700" />
                      Use saved idea
                      <span className="text-xs font-normal text-slate-500">optional</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      เลือก idea ที่มีอยู่เพื่อใช้เป็น starting point แทนการเริ่มจากศูนย์
                    </p>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", isIdeasOpen && "rotate-180")} />
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
                                  "rounded-[24px] border p-4 transition-all",
                                  isSelected
                                    ? "border-slate-950 bg-slate-50 shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
                                    : "border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-[0_10px_24px_rgba(15,23,42,0.05)]",
                                )}
                              >
                                <div className="flex items-start gap-4">
                                  <button
                                    type="button"
                                    className="flex-1 text-left"
                                    onClick={() =>
                                      setSelectedTopic((currentTopic) =>
                                        currentTopic === topic.title ? "" : topic.title,
                                      )
                                    }
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h5 className="text-base font-semibold text-slate-950">{topic.title}</h5>
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
                                  <div className="flex flex-col items-end gap-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                      disabled={isDeleting}
                                      onClick={() => {
                                        setTopicBeingEdited(topic)
                                        setTopicEditModalOpen(true)
                                      }}
                                    >
                                      <Edit className="mr-1 h-3.5 w-3.5" />
                                      แก้ไข
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                      disabled={isDeleting}
                                      onClick={() => handleDeleteTopic(topic)}
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
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsCustomIdeaDialogOpen(true)}
                            className="rounded-full border-slate-200"
                          >
                            <Wand2 className="mr-2 h-4 w-4" />
                            Add idea
                          </Button>
                          <div className="flex flex-wrap gap-2">
                            {selectedTopicData && (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setSelectedTopic("")}
                                className="rounded-full border-slate-200"
                              >
                                Clear selected idea
                              </Button>
                            )}
                            {savedTopics.length > 4 && (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowAllTopics((value) => !value)}
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

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label className="text-sm font-medium text-slate-900">Ad style</label>
                    <p className="mt-1 text-xs text-slate-500">optional: เลือก style เดียวเพื่อคุมภาพรวมของงาน</p>
                  </div>
                  {selectedAdStyleOption && <span className="text-xs text-slate-500">{selectedStyleLabel}</span>}
                </div>
                <div className="-mx-1 overflow-x-auto pb-1">
                  <div className="grid min-w-[760px] grid-cols-6 gap-3 px-1">
                    {AD_STYLE_OPTIONS.map((style) => {
                      const isSelected = selectedAdStyle === style.value

                      return (
                        <HoverCard key={style.value} openDelay={120} closeDelay={80}>
                          <HoverCardTrigger asChild>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedAdStyle((currentValue) =>
                                  currentValue === style.value ? "" : style.value,
                                )
                              }
                              className="text-left"
                            >
                              <div
                                className={cn(
                                  "overflow-hidden rounded-[22px] border bg-slate-50 transition-all",
                                  isSelected
                                    ? "border-slate-950 shadow-[0_12px_24px_rgba(15,23,42,0.08)]"
                                    : "border-slate-200/90 hover:border-slate-300 hover:bg-white",
                                )}
                              >
                                <div className="relative aspect-[4/5] overflow-hidden">
                                  <Image
                                    src={style.previewImage}
                                    alt={`${style.label} preview`}
                                    fill
                                    className="object-cover transition-transform duration-200 hover:scale-[1.02]"
                                    sizes="(max-width: 768px) 24vw, 110px"
                                  />
                                  {isSelected && (
                                    <div className="absolute right-2 top-2 rounded-full bg-white/95 p-1.5 text-slate-950 shadow-sm">
                                      <CheckCircle className="h-3 w-3" />
                                    </div>
                                  )}
                                </div>
                                <div className="px-2.5 py-2.5">
                                  <p className="text-[11px] font-medium leading-4 text-slate-700">{style.label}</p>
                                </div>
                              </div>
                            </button>
                          </HoverCardTrigger>
                          <HoverCardContent
                            align="start"
                            sideOffset={10}
                            className="w-56 rounded-2xl border-slate-200 p-3 text-sm leading-6 text-slate-600"
                          >
                            <p className="text-sm font-semibold text-slate-950">{style.label}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">{style.hoverDescription}</p>
                          </HoverCardContent>
                        </HoverCard>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-5 rounded-[28px] bg-slate-50/80 p-5">
              <div>
                <p className="text-sm font-medium text-slate-900">Output settings</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">ตั้งค่าพื้นฐานก่อน generate</p>
              </div>
              <div className="space-y-3">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <Layers3 className="h-4 w-4 text-slate-700" />
                    จำนวนภาพ
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {IMAGE_COUNT_OPTIONS.map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setImageCount(count)}
                        className={cn(
                          "rounded-xl border px-2 py-2 text-sm font-medium transition-colors",
                          imageCount === count
                            ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                        )}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <ImageIcon className="h-4 w-4 text-slate-700" />
                    อัตราส่วนภาพ
                  </div>
                  <Select value={aspectRatio} onValueChange={setAspectRatio}>
                    <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white focus:border-slate-950 focus:ring-0">
                      <SelectValue placeholder="เลือกอัตราส่วนภาพ" />
                    </SelectTrigger>
                    <SelectContent>
                      {ASPECT_RATIO_OPTIONS.map((ratio) => (
                        <SelectItem key={ratio} value={ratio}>
                          {ratio}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-[22px] bg-white px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Current setup</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-3">
                      <span>Outputs</span>
                      <span className="font-medium text-slate-900">{imageCount}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Aspect ratio</span>
                      <span className="font-medium text-slate-900">{aspectRatio}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Style</span>
                      <span className="font-medium text-slate-900">{selectedStyleLabel}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Collapsible open={isPaletteOpen} onOpenChange={setIsPaletteOpen} className="rounded-2xl border border-slate-200 bg-slate-50/70">
            <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <Palette className="h-4 w-4 text-slate-700" />
                  Brand palette
                </div>
                <p className="mt-1 text-xs text-slate-500">optional: ใช้เมื่ออยากคุมโทนสีให้ใกล้แบรนด์มากขึ้น</p>
              </div>
              <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", isPaletteOpen && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 px-4 pb-4">
              {selectedClientId ? (
                <>
                  {colorPalette.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {colorPalette.map((color, index) => (
                        <div key={`${color}-${index}`} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
                          <div
                            className="h-5 w-5 rounded-full border border-slate-200"
                            style={{ backgroundColor: `#${color}` }}
                            title={`#${color}`}
                          />
                          <span className="text-xs font-medium text-slate-900">#{color}</span>
                          <button
                            type="button"
                            className="text-xs text-rose-500 hover:text-rose-600"
                            onClick={() => handleRemoveColor(index)}
                          >
                            ลบ
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                      ยังไม่มีพาเลตสีที่บันทึกไว้
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        value={colorInput}
                        onChange={(event) => setColorInput(event.target.value)}
                        placeholder="ใส่โค้ดสี เช่น 265484 หรือ #265484"
                        className="h-11 rounded-2xl border-slate-200"
                      />
                      <Button variant="outline" onClick={handleAddColor} className="h-11 rounded-2xl border-slate-200">
                        เพิ่มสี
                      </Button>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <Button
                        onClick={handleSavePalette}
                        disabled={isSavingPalette}
                        className="h-11 rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
                      >
                        {isSavingPalette ? "กำลังบันทึก..." : "บันทึกพาเลตสี"}
                      </Button>
                      <Button variant="ghost" asChild className="justify-start rounded-2xl px-0 text-sm text-blue-700 hover:bg-transparent hover:text-blue-800">
                        <a href="https://coolors.co/image-picker" target="_blank" rel="noopener noreferrer">
                          เปิด Image Picker
                        </a>
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                  เลือกลูกค้าก่อนเพื่อจัดการพาเลตสี
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {canChooseIdea && (
            <div className="grid gap-4 xl:grid-cols-2">
              <Collapsible open={isMaterialsOpen} onOpenChange={setIsMaterialsOpen} className="rounded-2xl border border-slate-200 bg-slate-50/70">
                <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      <Upload className="h-4 w-4 text-slate-700" />
                      Product assets
                    </div>
                    <p className="mt-1 text-xs text-slate-500">optional: ใส่รูปสินค้าจริงหรือองค์ประกอบที่อยากให้ AI ใช้</p>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", isMaterialsOpen && "rotate-180")} />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 px-4 pb-4">
                  <div>
                    <input
                      ref={materialInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(event) => handleMaterialUpload(event.target.files)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => materialInputRef.current?.click()}
                      disabled={isUploadingMaterials}
                      className="rounded-full border-slate-200"
                    >
                      <Upload className="mr-1 h-4 w-4" />
                      {isUploadingMaterials ? "กำลังอัปโหลด..." : "อัปโหลด"}
                    </Button>
                  </div>

                  {loadingMaterialImages ? (
                    <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      <span className="ml-2 text-sm text-slate-500">กำลังโหลดวัสดุ...</span>
                    </div>
                  ) : materialImages.length > 0 ? (
                    <>
                      <div className="max-h-[24rem] overflow-y-auto pr-2">
                        <div className="grid grid-cols-3 gap-2">
                          {materialImages.map((image) => {
                            const isSelected = selectedMaterials.includes(image.url)
                            return (
                              <button
                                key={image.url}
                                type="button"
                                className={cn(
                                  "group overflow-hidden rounded-2xl border bg-white transition-all",
                                  isSelected
                                    ? "border-violet-400 ring-2 ring-violet-200"
                                    : "border-slate-200 hover:border-slate-300",
                                )}
                                onClick={() => handleMaterialToggle(image.url)}
                              >
                                <div className="relative aspect-square">
                                  <Image
                                    src={image.url}
                                    alt="Material image"
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 768px) 33vw, 120px"
                                  />
                                  {isSelected && (
                                    <div className="absolute inset-0 flex items-start justify-end p-2">
                                      <div className="rounded-full bg-violet-500 p-1 text-white">
                                        <CheckCircle className="h-3.5 w-3.5" />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">
                        มีทั้งหมด {materialImages.length} ภาพ, เลือกแล้ว {selectedMaterials.length} ภาพ
                      </p>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                      ยังไม่มีวัสดุที่อัปโหลด
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>

              <Collapsible open={isReferencesOpen} onOpenChange={setIsReferencesOpen} className="rounded-2xl border border-slate-200 bg-slate-50/70">
                <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      <ImageIcon className="h-4 w-4 text-slate-700" />
                      Reference images
                    </div>
                    <p className="mt-1 text-xs text-slate-500">optional: ใช้คุม mood, composition หรือ visual direction</p>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", isReferencesOpen && "rotate-180")} />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 px-4 pb-4">
                  <input
                    ref={referenceInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => handleReferenceUpload(event.target.files)}
                  />

                  <button
                    type="button"
                    onClick={() => referenceInputRef.current?.click()}
                    onDragOver={(event) => {
                      event.preventDefault()
                      setIsReferenceDropActive(true)
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault()
                      setIsReferenceDropActive(false)
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      setIsReferenceDropActive(false)
                      handleReferenceUpload(event.dataTransfer.files)
                    }}
                    className={cn(
                      "flex min-h-[84px] w-full items-center justify-center rounded-2xl border border-dashed px-4 text-center transition-colors",
                      isReferenceDropActive
                        ? "border-blue-400 bg-blue-50"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-700 shadow-sm">
                        <Upload className="h-4 w-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-slate-900">
                          {isUploadingReferences ? "กำลังอัปโหลดรูป..." : "Drop reference images here"}
                        </p>
                        <p className="text-xs text-slate-500">หรือคลิกเพื่ออัปโหลดเข้าคลัง reference</p>
                      </div>
                    </div>
                  </button>

                  {loadingReferenceImages ? (
                    <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      <span className="ml-2 text-sm text-slate-500">กำลังโหลดรูปภาพ...</span>
                    </div>
                  ) : referenceImages.length > 0 ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        {referenceImages.slice(0, 6).map((image) => {
                          const isSelected = selectedReferenceImages.includes(image.url)
                          const isLimitReached =
                            !isSelected && selectedReferenceImages.length >= MAX_REFERENCE_SELECTION
                          return (
                            <button
                              key={image.url}
                              type="button"
                              className={cn(
                                "group overflow-hidden rounded-2xl border bg-white transition-all",
                                isSelected
                                  ? "border-blue-400 ring-2 ring-blue-200"
                                  : "border-slate-200 hover:border-slate-300",
                                isLimitReached && "cursor-not-allowed opacity-60",
                              )}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedReferenceImages((prev) => prev.filter((url) => url !== image.url))
                                } else if (!isLimitReached) {
                                  setSelectedReferenceImages((prev) =>
                                    [...prev, image.url].slice(0, MAX_REFERENCE_SELECTION),
                                  )
                                } else {
                                  alert(`เลือกได้สูงสุด ${MAX_REFERENCE_SELECTION} รูป`)
                                }
                              }}
                            >
                              <div className="relative aspect-[4/3]">
                                <Image
                                  src={image.url}
                                  alt="Reference image"
                                  fill
                                  className="object-cover"
                                  sizes="(max-width: 768px) 50vw, 180px"
                                />
                                {isSelected && (
                                  <div className="absolute inset-0 flex items-start justify-end p-2">
                                    <div className="rounded-full bg-blue-500 p-1 text-white">
                                      <CheckCircle className="h-3.5 w-3.5" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                      <p className="text-xs text-slate-500">
                        เลือกแล้ว {selectedReferenceImages.length}/{MAX_REFERENCE_SELECTION} ภาพ
                      </p>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                      ยังไม่มีรูปภาพในคลัง
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_14px_32px_rgba(15,23,42,0.04)]">
        <div className="px-7 pt-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Step 3</p>
          <h4 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-slate-950">Generate and review</h4>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            ตรวจสอบสรุปด้านล่างก่อนกด generate เพื่อให้รู้ว่าระบบจะใช้ context อะไรในการสร้างภาพ
          </p>
        </div>

        <div className="grid gap-6 p-7 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
          <div className="space-y-4">
            <div className="grid gap-3 rounded-[28px] bg-slate-50 px-5 py-5 sm:grid-cols-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Client</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{currentClient?.clientName || "Not selected"}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Brief source</p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {selectedTopicData?.title || (hasPrompt ? "Custom brief" : "Write a brief or use a saved idea")}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Style</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{selectedStyleLabel}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
              <span>
                <span className="text-slate-400">Aspect ratio</span>
                <span className="ml-2 text-slate-800">{aspectRatio}</span>
              </span>
              <span>
                <span className="text-slate-400">Outputs</span>
                <span className="ml-2 text-slate-800">{imageCount}</span>
              </span>
              <span>
                <span className="text-slate-400">Materials</span>
                <span className="ml-2 text-slate-800">{selectedMaterials.length}</span>
              </span>
              <span>
                <span className="text-slate-400">References</span>
                <span className="ml-2 text-slate-800">{selectedReferenceImages.length}</span>
              </span>
              {hasOptionalDirection && <span className="text-slate-800">Optional direction added</span>}
            </div>
          </div>

          <div className="rounded-[28px] bg-slate-50 p-4">
            <Button
              onClick={generateImage}
              disabled={isGenerating || !canGenerate}
              className="h-12 w-full rounded-2xl bg-slate-950 text-base font-medium text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังสร้าง {imageCount} ภาพ...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate {imageCount} Static Ad{imageCount > 1 ? "s" : ""}
                </>
              )}
            </Button>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              {!canGenerate
                ? "ต้องเลือกลูกค้า Product Focus และใส่ brief หรือเลือก saved idea ก่อนจึงจะ generate ได้"
                : "พร้อมสร้างแล้ว ระบบจะใช้ brief หรือ saved idea ร่วมกับ direction ที่คุณเลือกไว้"}
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-6">
        <Card className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_14px_32px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-200 bg-white px-6 py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                    <Images className="h-4 w-4 text-blue-600" />
                    Results Gallery
                  </div>
                  <h4 className="mt-2 text-xl font-semibold text-slate-950">Generated static ads</h4>
                  <p className="mt-1 text-sm text-slate-600">
                    ผลลัพธ์ทั้งหมดจะแสดงแบบ gallery เพื่อคัดเลือกและบันทึก creative ได้เร็วขึ้น
                  </p>
                </div>
                {generatedImages.length > 12 && (
                  <Button
                    variant="outline"
                    onClick={() => setShowAllResults(!showAllResults)}
                    className="rounded-full border-slate-200"
                  >
                    {showAllResults ? "แสดงน้อยลง" : `ดูทั้งหมด (${generatedImages.length})`}
                  </Button>
                )}
              </div>
            </div>

            <div className="p-6">
              {generatedImages.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-slate-200 bg-[linear-gradient(135deg,_#f8fafc_0%,_#ffffff_100%)] px-6 py-16 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                    <Wand2 className="h-6 w-6" />
                  </div>
                  <h5 className="mt-5 text-lg font-semibold text-slate-950">Your gallery is empty</h5>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                    เขียน brief หรือเลือก saved idea จากนั้นค่อยเติม references หรือ assets เพิ่ม แล้วกด Generate เพื่อเริ่มสร้าง static ad gallery
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="rounded-full bg-slate-100 text-slate-700 hover:bg-slate-100">
                      ทั้งหมด {generatedImages.length} ภาพ
                    </Badge>
                    <Badge className="rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                      พร้อมใช้ {completedImages.length}
                    </Badge>
                    {generatingImages.length > 0 && (
                      <Badge className="rounded-full bg-amber-50 text-amber-700 hover:bg-amber-50">
                        กำลังสร้าง {generatingImages.length}
                      </Badge>
                    )}
                    {errorImages.length > 0 && (
                      <Badge className="rounded-full bg-rose-50 text-rose-700 hover:bg-rose-50">
                        ต้องลองใหม่ {errorImages.length}
                      </Badge>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                    {visibleImages.map((image) => (
                      <Card key={image.id} className="overflow-hidden rounded-[24px] border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                        <div className="relative aspect-[4/5] bg-slate-50">
                          {image.status === "generating" && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90">
                              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                              <p className="mt-3 text-sm font-medium text-slate-700">
                                {image.operation === "upscale" ? "Upscaling to 2K..." : "Generating creative..."}
                              </p>
                            </div>
                          )}

                          {image.status === "completed" && image.url && (
                            <button
                              type="button"
                              className="absolute inset-0"
                              onClick={() => setSelectedImageForPreview(image.url)}
                            >
                              <Image
                                src={image.url}
                                alt={image.prompt}
                                fill
                                className="object-contain p-3 transition-transform duration-200 hover:scale-[1.01]"
                                sizes="(max-width: 768px) 100vw, 50vw"
                              />
                            </button>
                          )}

                          {image.status === "error" && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-rose-50">
                              <div className="rounded-full bg-white p-3 text-rose-500 shadow-sm">
                                <X className="h-5 w-5" />
                              </div>
                              <p className="mt-3 text-sm font-medium text-rose-600">สร้างไม่สำเร็จ</p>
                            </div>
                          )}

                          <div className="absolute left-3 top-3 flex items-center gap-2">
                            <Badge className="rounded-full bg-black/75 text-white hover:bg-black/75">
                              {image.status === "completed"
                                ? "Ready"
                                : image.status === "generating"
                                  ? "Generating"
                                  : "Retry"}
                            </Badge>
                            {image.source && (
                              <Badge className="rounded-full bg-white/90 text-slate-700 hover:bg-white/90">
                                {getSourceLabel(image.source)}
                              </Badge>
                            )}
                            {image.resolution && (
                              <Badge className="rounded-full bg-blue-600 text-white hover:bg-blue-600">
                                {image.resolution}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="space-y-4 p-4">
                          <div>
                            <p className="text-sm font-medium text-slate-950">
                              {image.topicTitle || "Compass Idea"}
                            </p>
                            <p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-600">
                              {image.prompt || image.topicSummary || "Generated from selected idea, palette, references, and brand materials."}
                            </p>
                          </div>

                          {image.status === "completed" && image.url ? (
                            <div className="flex flex-wrap gap-2">
                              {image.resolution !== "2K" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => upscaleImageTo2K(image)}
                                  disabled={upscalingImageIds.includes(image.id)}
                                  className="rounded-full border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                                >
                                  {upscalingImageIds.includes(image.id) ? (
                                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Wand2 className="mr-1 h-3.5 w-3.5" />
                                  )}
                                  Upscale 2K
                                </Button>
                              )}
                              <Button
                                size="sm"
                                onClick={() => saveImageToSupabase(image.url, image.id)}
                                disabled={savingImageId === image.id}
                                className="rounded-full bg-slate-900 text-white hover:bg-slate-800"
                              >
                                {savingImageId === image.id ? (
                                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle className="mr-1 h-3.5 w-3.5" />
                                )}
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadImage(image.url)}
                                className="rounded-full border-slate-200"
                              >
                                <Download className="mr-1 h-3.5 w-3.5" />
                                Download
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyImageUrl(image.url)}
                                className="rounded-full border-slate-200"
                              >
                                <Copy className="mr-1 h-3.5 w-3.5" />
                                Copy URL
                              </Button>
                            </div>
                          ) : image.status === "error" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => retryGeneration(image.id)}
                              className="rounded-full border-slate-200"
                            >
                              <RefreshCw className="mr-1 h-3.5 w-3.5" />
                              ลองใหม่
                            </Button>
                          ) : (
                            <div className="text-sm text-slate-500">ระบบกำลังเพิ่มภาพเข้ากับ gallery</div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

        <Card className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_14px_32px_rgba(15,23,42,0.04)]">
          <div className="p-7">
            <div className="grid gap-4 lg:grid-cols-3">
              <p className="text-sm leading-6 text-slate-600">เริ่มจาก idea ให้ชัดก่อน แล้วค่อยเติม direction เพิ่มเท่าที่จำเป็น</p>
              <p className="text-sm leading-6 text-slate-600">ใช้ product assets เมื่ออยากให้สินค้าในภาพใกล้ของจริงมากขึ้น ส่วน reference ใช้เพื่อคุม mood และ composition</p>
              <p className="text-sm leading-6 text-slate-600">สร้าง 2-3 ภาพต่อรอบมักเปรียบเทียบได้ง่ายกว่า และไม่ทำให้ผลลัพธ์กระจายเกินไป</p>
            </div>
          </div>
        </Card>
      </div>

      <Dialog open={isCustomIdeaDialogOpen} onOpenChange={setIsCustomIdeaDialogOpen}>
        <DialogContent className="max-w-2xl rounded-[28px] border-slate-200 p-0">
          <DialogHeader className="border-b border-slate-200 px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-lg text-slate-950">
              <Wand2 className="h-5 w-5 text-blue-600" />
              Add custom idea
            </DialogTitle>
            <p className="text-sm leading-6 text-slate-500">
              พิมพ์แบบ freeform ได้เลย หรือใช้ label เช่น `Title:`, `Description:`, `Tags:`, `Concept Idea:`, `Headline:`, `Bullets:`, `CTA:` แล้วระบบจะช่วยแตกเป็น format idea ให้อัตโนมัติ
            </p>
          </DialogHeader>
          <div className="space-y-4 px-6 py-5">
            <Textarea
              value={customIdeaInput}
              onChange={(event) => setCustomIdeaInput(event.target.value)}
              placeholder={`Title: Hook เรื่องผลลัพธ์ที่วัดได้\nDescription: ชูเรื่องแพ็กเกจรวมทุกช่องทางแบบวัด ROI ได้\nTags: roi, social media, package\nConcept Idea: เปรียบเทียบการซื้อสื่อแบบกระจายกับการซื้อแบบรวมแพ็กเกจ`}
              rows={8}
              className="min-h-[220px] resize-none rounded-2xl border-slate-200 bg-white text-slate-950 focus:border-slate-950 focus:ring-0"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs leading-5 text-slate-500">
                ระบบจะใช้ Gemini parse ก่อน และ fallback เป็น parser ในระบบถ้า parse ไม่สำเร็จ
              </p>
              <Button
                type="button"
                onClick={handleAddCustomIdea}
                disabled={!customIdeaInput.trim() || isParsingCustomIdea}
                className="rounded-full bg-slate-950 text-white hover:bg-slate-800"
              >
                {isParsingCustomIdea ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังแตก idea
                  </>
                ) : (
                  "เพิ่มเข้า Ideas"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal */}
      <Dialog open={!!selectedImageForPreview} onOpenChange={() => setSelectedImageForPreview(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-blue-600" />
              ภาพที่สร้างด้วย AI
            </DialogTitle>
          </DialogHeader>
          
          {selectedImageForPreview && (
            <div className="relative">
              <div className="relative w-full" style={{ aspectRatio: '1/1', maxHeight: '70vh' }}>
                <Image
                  src={selectedImageForPreview}
                  alt="AI generated image preview"
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 80vw"
                />
              </div>
              
              {/* Action buttons */}
              <div className="p-6 pt-4 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const selectedClient = clients.find(c => c.id === selectedClientId)
                    if (selectedClient) {
                      const imageId = Math.random().toString(36).substring(2, 11)
                      saveImageToSupabase(selectedImageForPreview, imageId)
                    }
                  }}
                  disabled={!selectedClientId || savingImageId !== null}
                >
                  {savingImageId ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  บันทึกภาพที่สร้าง
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleDownloadImage(selectedImageForPreview)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  ดาวน์โหลด
                </Button>
                <Button
                  variant="outline"
                  onClick={() => copyImageUrl(selectedImageForPreview)}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  คัดลอก URL
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <EditableSavedIdeaModal
        isOpen={topicEditModalOpen}
        onClose={() => {
          setTopicEditModalOpen(false)
          setTopicBeingEdited(null)
        }}
        idea={convertTopicToEditableIdea(topicBeingEdited, currentClient?.clientName || activeClientName || null, selectedProductFocus)}
        onSave={(updatedIdea) => {
          handleTopicSave(convertEditableIdeaToTopic(updatedIdea))
          setTopicEditModalOpen(false)
        }}
      />
    </div>
  )
}
