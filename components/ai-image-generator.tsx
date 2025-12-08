"use client"

import { useState, useEffect, useRef, useMemo, type ComponentProps } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
} from "lucide-react"
import Image from "next/image"
import { getStorageClient, getSupabase } from "@/lib/supabase/client"
import { EditableSavedIdeaModal } from "@/components/editable-saved-idea-modal"

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
  reference_image?: string
  status: 'generating' | 'completed' | 'error'
  created_at: string
  source?: string
}

interface ClientOption {
  id: string
  clientName: string
  productFocuses: Array<{
    productFocus: string
  }>
  colorPalette?: string[]
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
  
  // Strategic insights and topics
  const [savedTopics, setSavedTopics] = useState<SavedTopic[]>([])
  const [selectedTopic, setSelectedTopic] = useState<string>('')
  const [topicEditModalOpen, setTopicEditModalOpen] = useState(false)
  const [topicBeingEdited, setTopicBeingEdited] = useState<SavedTopic | null>(null)
  const [loadingTopics, setLoadingTopics] = useState(false)
  
  // Reference image selection
  const MAX_REFERENCE_SELECTION = 5
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([])
  const [selectedReferenceImages, setSelectedReferenceImages] = useState<string[]>([])
  const [loadingReferenceImages, setLoadingReferenceImages] = useState(false)
  const [materialImages, setMaterialImages] = useState<ReferenceImage[]>([])
  const [loadingMaterialImages, setLoadingMaterialImages] = useState(false)
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([])
  const [isUploadingMaterials, setIsUploadingMaterials] = useState(false)
  const [colorPalette, setColorPalette] = useState<string[]>([])
  const [colorInput, setColorInput] = useState("")
  const [isSavingPalette, setIsSavingPalette] = useState(false)
  const [aspectRatio, setAspectRatio] = useState<string>(ASPECT_RATIO_OPTIONS[0])
  
  // AI generation results pagination
  const [showAllResults, setShowAllResults] = useState(false)
  const [savingImageId, setSavingImageId] = useState<string | null>(null)
  
  // Image preview modal
  const [selectedImageForPreview, setSelectedImageForPreview] = useState<string | null>(null)
  const materialInputRef = useRef<HTMLInputElement | null>(null)
  const currentClient = useMemo(() => {
    if (!selectedClientId) return null
    return clients.find((client) => client.id === selectedClientId) || null
  }, [clients, selectedClientId])

  const getSourceLabel = (value?: string) => {
    if (!value) return null
    const normalized = value.toLowerCase()
    const map: Record<string, string> = {
      gemini: "Gemini",
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
          concept_type: item.concept_type || item.impact || '',
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

    if (!selectedTopic) {
      alert('กรุณาเลือกไอเดียที่บันทึกไว้')
      return
    }

    setIsGenerating(true)
    
    const selectedClient = currentClient
    const selectedTopicData = savedTopics.find(topic => topic.title === selectedTopic)
    
    const newImageId = Math.random().toString(36).substring(2, 11)
    const newImage: GeneratedImage = {
      id: newImageId,
      url: '',
      prompt: prompt.trim(),
      reference_image: undefined,
      status: 'generating',
      created_at: new Date().toISOString(),
      source: undefined,
    }

    setGeneratedImages(prev => [newImage, ...prev])

    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      const response = await fetch(`${baseUrl}/api/generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          reference_image_url: selectedReferenceImages[0] || null,
          reference_image_urls: selectedReferenceImages,
          client_name: selectedClient?.clientName,
          product_focus: selectedProductFocus,
          selected_topics: selectedTopicData ? [selectedTopicData] : [],
          core_concept: selectedTopicData?.concept_idea || '',
          topic_title: selectedTopicData?.title || '',
          topic_description: selectedTopicData?.description || '',
          content_pillar: selectedTopicData?.content_pillar || '',
          copywriting: selectedTopicData?.copywriting || null,
          color_palette: colorPalette,
          material_image_urls: selectedMaterials,
          aspect_ratio: aspectRatio,
          image_count: DEFAULT_IMAGE_COUNT,
        }),
      })

      const responseText = await response.text()
      let result: any = null
      try {
        result = responseText ? JSON.parse(responseText) : {}
      } catch (parseError) {
        console.error("Failed to parse generate-image response:", parseError, responseText)
        throw new Error("Invalid response from image generator")
      }

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

      if (!response.ok) {
        throw new Error(result?.error || `การสร้างรูปไม่สำเร็จ (${response.status})`)
      }

      if (result.success && result.image_url) {
        // Update the loading image with the generated result
        setGeneratedImages(prev => prev.map(img => 
          img.id === newImageId 
            ? { 
                ...img, 
                url: result.image_url, 
                status: 'completed',
                reference_image: selectedReferenceImages[0] || undefined,
                source: result.provider || result.model || 'gemini'
              }
            : img
        ))
        console.log(`Generated AI image: ${result.image_url}`)
      } else if (result.success && result.images && Array.isArray(result.images)) {
        // Handle multiple images if the N8N returns an array
        setGeneratedImages(prev => prev.filter(img => img.id !== newImageId))
        
        const normalizedEntries = result.images.flatMap((img: any) => normalizeImageEntries(img))

        const aiImages = normalizedEntries.map((img, index) => ({
          id: `${newImageId}-${index}`,
          url: img.url,
          prompt: prompt.trim(),
          reference_image: selectedReferenceImages[0] || undefined,
          status: 'completed' as const,
          created_at: new Date().toISOString(),
          source: img.source,
        }))

        if (aiImages.length === 0) {
          throw new Error("No valid image URLs returned from generator")
        }
        
        setGeneratedImages(prev => [...aiImages, ...prev])
        console.log(`Generated ${result.images.length} AI images`)
      } else {
        // Mark as error
        setGeneratedImages(prev => prev.map(img => 
          img.id === newImageId 
            ? { ...img, status: 'error' }
            : img
        ))
        alert(`เกิดข้อผิดพลาด: ${result.error || 'ไม่สามารถสร้างภาพได้'}`)
      }
    } catch (error) {
      console.error('Error generating AI images:', error)
      setGeneratedImages(prev => prev.map(img => 
        img.id === newImageId 
          ? { ...img, status: 'error' }
          : img
      ))
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

  return (
    <div className="space-y-6">
      {/* Generation Controls */}
      <Card className="p-6">
        <div className="space-y-6">
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-xl font-bold text-black mb-2 flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Wand2 className="w-5 h-5 text-white" />
              </div>
              สร้างภาพด้วย AI
            </h3>
            <p className="text-[#8e8e93] text-sm">สร้างภาพโฆษณาใหม่ด้วยเทคโนโลยี AI ที่เข้ากับไอเดียและแนวคิดของคุณ</p>
          </div>

          {/* Client and Product Focus Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-black flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-600" />
                เลือกลูกค้า
              </label>
              {loadingClients ? (
                <div className="flex items-center justify-center p-3 border rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-500 text-sm">กำลังโหลด...</span>
                </div>
              ) : (
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="border-[#d1d1d6] focus:border-black focus:ring-0 bg-white">
                    <SelectValue placeholder="เลือกลูกค้า" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.clientName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-black">
                Product Focus
              </label>
              {selectedClientId ? (
                <Select value={selectedProductFocus} onValueChange={setSelectedProductFocus}>
                  <SelectTrigger className="border-[#d1d1d6] focus:border-black focus:ring-0 bg-white">
                    <SelectValue placeholder="เลือก Product Focus" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients
                      .find(c => c.id === selectedClientId)
                      ?.productFocuses.map((pf) => (
                        <SelectItem key={pf.productFocus} value={pf.productFocus}>
                          {pf.productFocus}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-3 border border-[#d1d1d6] rounded-lg bg-[#f2f2f7] text-[#8e8e93] text-sm">
                  เลือกลูกค้าก่อน
                </div>
              )}
            </div>
          </div>

          {/* Saved Topics Selection */}
          {selectedClientId && selectedProductFocus && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-black flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                ไอเดียที่บันทึกไว้ <span className="text-red-500">*</span>
                <span className="text-xs text-gray-500">(จำเป็นต้องเลือก)</span>
              </label>
              
              {loadingTopics ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-500 text-sm">กำลังโหลดไอเดีย...</span>
                </div>
              ) : savedTopics.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {savedTopics.map((topic) => {
                    const isSelected = selectedTopic === topic.title
                    return (
                      <div
                        key={topic.id || topic.title}
                        className={`p-3 border-2 rounded-lg transition-colors ${
                          isSelected ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200' : 'border-gray-200 hover:border-amber-300 hover:bg-amber-25'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            className="flex-1 text-left"
                            onClick={() => setSelectedTopic(topic.title)}
                          >
                            <h4 className="font-medium text-sm text-black">{topic.title}</h4>
                            <div className="text-xs text-[#8e8e93] mt-1 line-clamp-2">
                              {(() => {
                                try {
                                  const parsed = JSON.parse(topic.description)
                                  if (parsed && typeof parsed === 'object' && parsed.summary && parsed.sections) {
                                    return parsed.summary
                                  }
                                  if (Array.isArray(parsed)) {
                                    return parsed.length > 0 ? parsed[0].text : 'No description available'
                                  }
                                } catch {
                                  return topic.description
                                }
                                return topic.description
                              })()}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="secondary" className="text-xs">{topic.category}</Badge>
                              {Array.isArray(topic.tags) && topic.tags.slice(0, 2).map(tag => (
                                <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                              ))}
                            </div>
                          </button>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => {
                                setTopicBeingEdited(topic)
                                setTopicEditModalOpen(true)
                              }}
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              แก้ไข
                            </Button>
                            {isSelected && (
                              <CheckCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-4 border border-[#d1d1d6] rounded-lg bg-[#f2f2f7] text-center">
                  <p className="text-[#8e8e93] text-sm">ยังไม่มีไอเดียที่บันทึกไว้สำหรับลูกค้าและ Product Focus นี้</p>
                  <p className="text-[#8e8e93] text-xs mt-1 opacity-70">ลองสร้างไอเดียใหม่ในหน้าหลักก่อน</p>
                </div>
              )}
              
              {selectedTopic ? (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border-2 border-amber-300">
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-medium">เลือกแล้ว: {selectedTopic}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 p-3 rounded-lg border-2 border-red-200">
                  <X className="w-4 h-4" />
                  <span className="font-medium">กรุณาเลือกไอเดียก่อนสร้างภาพ</span>
                </div>
              )}
            </div>
          )}

          {/* Material & Reference Image Selection */}
          {selectedClientId && selectedProductFocus && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-black flex items-center gap-2">
                      <Upload className="w-4 h-4 text-purple-500" />
                      วัสดุ / ภาพสินค้า (เลือกได้หลายไฟล์)
                    </p>
                    <p className="text-xs text-[#8e8e93]">
                      รองรับ JPG/PNG สามารถอัปโหลดได้หลายรูป เพื่อใช้เป็นวัสดุประกอบการสร้างภาพ
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
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
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      {isUploadingMaterials ? "กำลังอัปโหลด..." : "อัปโหลดวัสดุ"}
                    </Button>
                  </div>
                </div>
                {loadingMaterialImages ? (
                  <div className="flex items-center justify-center p-6">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    <span className="ml-2 text-gray-500 text-sm">กำลังโหลดวัสดุ...</span>
                  </div>
                ) : materialImages.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-64 overflow-y-auto pr-1">
                      {materialImages.map((image) => {
                        const isSelected = selectedMaterials.includes(image.url)
                        return (
                          <Card
                            key={image.url}
                            className={`group overflow-hidden cursor-pointer transition-all ${
                              isSelected ? "ring-2 ring-purple-500 shadow-lg" : "hover:shadow-lg"
                            }`}
                            onClick={() => handleMaterialToggle(image.url)}
                          >
                            <div className="relative aspect-square">
                              <Image
                                src={image.url}
                                alt="Material image"
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 100vw, 33vw"
                              />
                              {isSelected && (
                                <div className="absolute inset-0 bg-purple-500/30 flex items-center justify-center">
                                  <div className="bg-purple-500 rounded-full p-2">
                                    <CheckCircle className="w-4 h-4 text-white" />
                                  </div>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </Card>
                        )
                      })}
                    </div>
                    {materialImages.length > 0 && (
                      <div className="text-center text-xs text-[#8e8e93]">เลื่อนเพื่อดูวัสดุทั้งหมด</div>
                    )}
                  </>
                ) : (
                  <div className="p-4 border border-dashed border-gray-300 rounded-lg text-center">
                    <p className="text-sm text-[#8e8e93]">ยังไม่มีวัสดุที่อัปโหลด</p>
                    <p className="text-xs text-[#8e8e93] mt-1">อัปโหลดภาพสินค้าเพื่อใช้เป็น Material ในการสร้างภาพ</p>
                  </div>
                )}
                <div className="text-xs text-[#6d28d9]">
                  {selectedMaterials.length > 0
                    ? `เลือกวัสดุแล้ว ${selectedMaterials.length} ภาพ`
                    : "ยังไม่ได้เลือกวัสดุ (เลือกหรือไม่เลือกก็ได้)"}
                </div>
              </Card>

              <Card className="p-4 space-y-3">
                <label className="text-sm font-medium text-black flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-blue-500" />
                  รูปภาพอ้างอิง (เลือกจากคลัง)
                </label>

                {loadingReferenceImages ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    <span className="ml-2 text-gray-500">กำลังโหลดรูปภาพ...</span>
                  </div>
                ) : referenceImages.length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                      {referenceImages.map((image) => {
                        const isSelected = selectedReferenceImages.includes(image.url)
                        const isLimitReached =
                          !isSelected && selectedReferenceImages.length >= MAX_REFERENCE_SELECTION
                        return (
                          <Card
                            key={image.url}
                            className={`group overflow-hidden cursor-pointer transition-all ${
                              isSelected ? "ring-2 ring-blue-500 shadow-lg" : "hover:shadow-lg"
                            } ${isLimitReached ? "opacity-60 cursor-not-allowed" : ""}`}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedReferenceImages((prev) => prev.filter((url) => url !== image.url))
                              } else if (!isLimitReached) {
                                setSelectedReferenceImages((prev) => [...prev, image.url].slice(0, MAX_REFERENCE_SELECTION))
                              } else {
                                alert(`เลือกได้สูงสุด ${MAX_REFERENCE_SELECTION} รูป`)
                              }
                            }}
                          >
                            <div className="relative aspect-video">
                              <Image
                                src={image.url}
                                alt="Reference image"
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 100vw, 50vw"
                              />
                              {isSelected && (
                                <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                  <div className="bg-blue-500 rounded-full p-2">
                                    <CheckCircle className="w-4 h-4 text-white" />
                                  </div>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </Card>
                        )
                      })}
                    </div>

                    <div className="text-xs text-[#2563eb] text-center">
                      เลือกแล้ว {selectedReferenceImages.length}/{MAX_REFERENCE_SELECTION} รูป
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <ImageIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">ยังไม่มีรูปภาพในคลัง</p>
                    <p className="text-xs mt-1">ลองอัปโหลดรูปภาพในแท็บ "อัปโหลดรูปภาพ" ก่อน</p>
                  </div>
                )}

                <div className="text-xs text-[#2563eb]">
                  {selectedReferenceImages.length > 0
                    ? `เลือกรูปภาพอ้างอิงแล้ว ${selectedReferenceImages.length}/${MAX_REFERENCE_SELECTION}`
                    : `ยังไม่ได้เลือกรูปภาพอ้างอิง (เลือกได้สูงสุด ${MAX_REFERENCE_SELECTION} รูป)`}
                </div>
              </Card>
            </div>
          )}

          {/* Color Palette Selection */}
          {selectedClientId && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-black flex items-center gap-2">
                <Palette className="w-4 h-4 text-purple-500" />
                พาเลตสีสำหรับแบรนด์
              </label>
              {colorPalette.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {colorPalette.map((color, index) => (
                    <div key={`${color}-${index}`} className="flex items-center gap-2">
                      <div
                        className="w-10 h-10 rounded-md border border-gray-200"
                        style={{ backgroundColor: `#${color}` }}
                        title={`#${color}`}
                      />
                      <div className="text-sm font-medium text-[#000000]">#{color}</div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleRemoveColor(index)}
                      >
                        ลบ
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-[#8e8e93]">ยังไม่มีพาเลตสีที่บันทึกไว้</div>
              )}
              <div className="flex items-center gap-2">
                <Input
                  value={colorInput}
                  onChange={(event) => setColorInput(event.target.value)}
                  placeholder="ใส่โค้ดสี เช่น 265484 หรือ #265484"
                  className="max-w-xs"
                />
                <Button variant="outline" onClick={handleAddColor}>
                  เพิ่มสี
                </Button>
                <Button variant="ghost" asChild className="text-xs text-[#1d4ed8] hover:text-[#063def]">
                  <a href="https://coolors.co/image-picker" target="_blank" rel="noopener noreferrer">
                    เปิด Image Picker
                  </a>
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleSavePalette} disabled={isSavingPalette}>
                  {isSavingPalette ? "กำลังบันทึก..." : "บันทึกพาเลตสี"}
                </Button>
                <p className="text-xs text-[#8e8e93]">
                  ระบบจะส่งพาเลตสีนี้ไปยัง AI ทุกครั้งที่สร้างภาพใหม่
                </p>
              </div>
            </div>
          )}

          {/* AI Prompt Input */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-black">
              คำอธิบายภาพที่ต้องการสร้าง (ไม่บังคับ)
            </label>
            <Textarea
              placeholder="เช่น: professional advertisement for solar panels on house roof, bright sunlight, modern house, photorealistic, high quality"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="resize-none border-[#d1d1d6] focus:border-black focus:ring-0 bg-white text-black"
            />
            <p className="text-xs text-[#8e8e93]">
              อธิบายภาพที่ต้องการให้ AI สร้าง หรือใช้เฉพาะไอเดียและรูปภาพอ้างอิงก็ได้
            </p>
          </div>

          {/* Aspect ratio */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-black">
              อัตราส่วนภาพ (Aspect ratio)
            </label>
            <Select value={aspectRatio} onValueChange={setAspectRatio}>
              <SelectTrigger className="border-[#d1d1d6] focus:border-black focus:ring-0 bg-white">
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
            <p className="text-xs text-[#8e8e93]">
              เลือกอัตราส่วนภาพที่ต้องการ ค่าเริ่มต้นคือ 1:1
            </p>
          </div>


          {/* Generate Button */}
          <Button 
            onClick={generateImage}
            disabled={isGenerating || !selectedTopic}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium shadow-lg transition-all duration-200 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังสร้างภาพ...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                สร้างภาพด้วย AI
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Generated Images */}
      {generatedImages.length > 0 && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-xl font-bold text-black flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-white" />
                </div>
                ภาพที่สร้างด้วย AI
              </h3>
              <Badge variant="secondary" className="bg-[#f2f2f7] text-black border-0">
                {generatedImages.length} รูป
              </Badge>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {(showAllResults ? generatedImages : generatedImages.slice(0, 20)).map((image) => (
                <Card key={image.id} className="overflow-hidden border-[#d1d1d6] hover:border-black transition-all duration-200 hover:shadow-lg group">
                  <div className="aspect-square relative bg-gray-100">
                    {image.status === 'generating' && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">กำลังสร้าง...</p>
                        </div>
                      </div>
                    )}
                    
                    {image.status === 'completed' && image.url && (
                      <div 
                        className="cursor-pointer group"
                        onClick={() => setSelectedImageForPreview(image.url)}
                      >
                        <Image
                          src={image.url}
                          alt={image.prompt}
                          fill
                          className="object-cover transition-transform group-hover:scale-105"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                        {image.source && (
                          <span className="absolute top-2 left-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide">
                            {getSourceLabel(image.source)}
                          </span>
                        )}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <div className="w-8 h-8 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-gray-700" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {image.status === 'error' && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                            <span className="text-red-600 text-xl">✕</span>
                          </div>
                          <p className="text-sm text-red-600">สร้างไม่สำเร็จ</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-3">
                    <p className="text-xs text-[#8e8e93] mb-3 line-clamp-2">
                      {image.prompt}
                    </p>
                    
                    <div className="flex items-center gap-1">
                      {image.status === 'completed' && image.url && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => saveImageToSupabase(image.url, image.id)}
                            disabled={savingImageId === image.id}
                            className="border-[#d1d1d6] hover:border-black hover:bg-black hover:text-white transition-all duration-200"
                          >
                            {savingImageId === image.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3 h-3" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadImage(image.url)}
                            className="border-[#d1d1d6] hover:border-black hover:bg-black hover:text-white transition-all duration-200"
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyImageUrl(image.url)}
                            className="border-[#d1d1d6] hover:border-black hover:bg-black hover:text-white transition-all duration-200"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                      
                      {image.status === 'error' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => retryGeneration(image.id)}
                          className="border-[#d1d1d6] hover:border-black hover:bg-black hover:text-white transition-all duration-200"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          ลองใหม่
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
                ))}
              </div>

              {/* Show More/Less Button */}
              {generatedImages.length > 20 && (
                <div className="flex justify-center pt-6">
                  <Button
                    variant="outline"
                    onClick={() => setShowAllResults(!showAllResults)}
                    className="border-[#d1d1d6] hover:border-black hover:bg-black hover:text-white transition-all duration-200"
                  >
                    {showAllResults ? (
                      <>
                        แสดงน้อยลง
                        <div className="ml-2 transform rotate-180">▼</div>
                      </>
                    ) : (
                      <>
                        ดูรูปภาพทั้งหมด ({generatedImages.length - 20} รูปเพิ่มเติม)
                        <div className="ml-2">▼</div>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Tips */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-100">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-black mb-3 text-lg">เคล็ดลับการสร้างภาพด้วย AI</h4>
            <ul className="text-sm text-[#8e8e93] space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-pink-500 font-boldตัว">•</span>
                <span>เลือกไอเดียที่บันทึกไว้เพื่อให้ AI เข้าใจแนวคิดของคุณ</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-500 font-bold">•</span>
                <span>ใช้คำอธิบายภาษาอังกฤษจะได้ผลลัพธ์ที่ดีกว่า</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-500 font-bold">•</span>
                <span>เพิ่มรายละเอียดเฉพาะ เช่น <code className="bg-white px-1 rounded text-xs">"photorealistic"</code>, <code className="bg-white px-1 rounded text-xs">"high quality"</code>, <code className="bg-white px-1 rounded text-xs">"professional"</code></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-500 font-bold">•</span>
                <span>ลองสร้างหลายครั้งด้วยคำอธิบายที่แตกต่างกันเพื่อได้ผลลัพธ์ที่หลากหลาย</span>
              </li>
            </ul>
          </div>
        </div>
      </Card>

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
