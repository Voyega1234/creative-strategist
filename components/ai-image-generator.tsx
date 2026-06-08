"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { EditableSavedIdeaModal } from "@/components/editable-saved-idea-modal"
import { AdStyleSelector } from "@/components/generated-ads/ad-style-selector"
import { AssetReferencePanel } from "@/components/generated-ads/asset-reference-panel"
import { BrandPalettePanel } from "@/components/generated-ads/brand-palette-panel"
import { ClientProductCard } from "@/components/generated-ads/client-product-card"
import { CustomIdeaDialog } from "@/components/generated-ads/custom-idea-dialog"
import { GenerateReviewCard } from "@/components/generated-ads/generate-review-card"
import { GeneratedAdsGallery } from "@/components/generated-ads/generated-ads-gallery"
import { ImagePreviewDialog } from "@/components/generated-ads/image-preview-dialog"
import { OutputSettingsPanel } from "@/components/generated-ads/output-settings-panel"
import { SavedIdeaPanel } from "@/components/generated-ads/saved-idea-panel"
import { useGeneratedAdAssets } from "@/components/generated-ads/use-generated-ad-assets"
import { useGeneratedAdIdeas } from "@/components/generated-ads/use-generated-ad-ideas"
import { uploadGeneratedImageBlob } from "@/lib/images/client"
import {
  downloadGeneratedAdImage,
  requestGeneratedAdImage,
  requestTextRemovedImage,
  requestUpscaledImage,
  runConcurrentImageJobs,
} from "@/lib/images/generated-ads-client"
import {
  buildGeneratedAdRequestPayload,
  buildPendingGeneratedImages,
  buildPendingRemoveTextImage,
  buildPendingUpscaleImage,
  getGeneratedImagesStorageKey,
  loadGeneratedImagesFromStorage,
  saveGeneratedImagesToStorage,
  type GeneratedImage,
} from "@/lib/images/generated-ads"
import { AD_STYLE_OPTIONS, ASPECT_RATIO_OPTIONS, DEFAULT_IMAGE_COUNT } from "@/lib/images/generated-ads-config"
import { cn } from "@/lib/utils"

interface ClientOption {
  id: string
  clientName: string
  productFocuses: Array<{
    productFocus: string
  }>
  colorPalette?: string[]
}

interface AIImageGeneratorProps {
  activeClientId?: string | null
  activeProductFocus?: string | null  
  activeClientName?: string | null
}

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
  
  const [selectedAdStyle, setSelectedAdStyle] = useState<string>("")
  const [aspectRatio, setAspectRatio] = useState<string>(ASPECT_RATIO_OPTIONS[0])
  const [imageCount, setImageCount] = useState<number>(DEFAULT_IMAGE_COUNT)
  const [isPaletteOpen, setIsPaletteOpen] = useState(false)
  const [isMaterialsOpen, setIsMaterialsOpen] = useState(false)
  const [isReferencesOpen, setIsReferencesOpen] = useState(false)
  
  // AI generation results pagination
  const [showAllResults, setShowAllResults] = useState(false)
  const [savingImageId, setSavingImageId] = useState<string | null>(null)
  const [upscalingImageIds, setUpscalingImageIds] = useState<string[]>([])
  const [removingTextImageIds, setRemovingTextImageIds] = useState<string[]>([])
  
  // Image preview modal
  const [selectedImageForPreview, setSelectedImageForPreview] = useState<string | null>(null)
  const hydratedGalleryKeyRef = useRef<string | null>(null)
  const generationInFlightRef = useRef(false)
  const currentClient = useMemo(() => {
    if (!selectedClientId) return null
    return clients.find((client) => client.id === selectedClientId) || null
  }, [clients, selectedClientId])
  const {
    materialInputRef,
    referenceInputRef,
    referenceImages,
    selectedReferenceImages,
    loadingReferenceImages,
    isUploadingReferences,
    isReferenceDropActive,
    materialImages,
    loadingMaterialImages,
    selectedMaterials,
    isUploadingMaterials,
    colorPalette,
    colorInput,
    isSavingPalette,
    maxReferenceSelection,
    setColorInput,
    setIsReferenceDropActive,
    toggleMaterial,
    toggleReference,
    uploadReferences,
    uploadMaterials,
    addColor,
    removeColor,
    savePalette,
  } = useGeneratedAdAssets({
    selectedClientId,
    selectedProductFocus,
    clientColorPalette: currentClient?.colorPalette,
    onClientColorPaletteSaved: (clientId, nextColorPalette) => {
      setClients((prev) =>
        prev.map((client) =>
          client.id === clientId ? { ...client, colorPalette: nextColorPalette } : client,
        ),
      )
    },
  })
  const selectedAdStyleOption = useMemo(
    () => AD_STYLE_OPTIONS.find((style) => style.value === selectedAdStyle) || null,
    [selectedAdStyle],
  )
  const {
    savedTopics,
    selectedTopic,
    selectedTopicData,
    selectedTopicSummary,
    availableVisualRoutes,
    selectedVisualRoute,
    selectedVisualRouteIndex,
    customIdeaInput,
    isCustomIdeaDialogOpen,
    isParsingCustomIdea,
    deletingTopicId,
    topicEditModalOpen,
    editableIdea,
    loadingTopics,
    showAllTopics,
    visibleTopics,
    isIdeasOpen,
    setSelectedTopic,
    setSelectedVisualRouteIndex,
    setCustomIdeaInput,
    setIsCustomIdeaDialogOpen,
    setShowAllTopics,
    setIsIdeasOpen,
    addCustomIdea,
    deleteTopic,
    openTopicEdit,
    closeTopicEdit,
    saveEditableIdea,
  } = useGeneratedAdIdeas({
    selectedClientId,
    selectedProductFocus,
    currentClientName: currentClient?.clientName,
    activeClientName,
  })
  const selectedPreviewImageData = useMemo(
    () => generatedImages.find((image) => image.url === selectedImageForPreview) || null,
    [generatedImages, selectedImageForPreview],
  )
  const completedImages = generatedImages.filter((image) => image.status === "completed")
  const generatingImages = generatedImages.filter((image) => image.status === "generating")
  const errorImages = generatedImages.filter((image) => image.status === "error")
  const visibleImages = showAllResults ? generatedImages : generatedImages.slice(0, 12)
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
      gemini_text_removed: "Text Removed",
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
        } else if (normalizedClients.length > 0) {
          // Fallback to first client if no props provided
          const firstClient = normalizedClients.find((client: any) => client.existsInSystem !== false && client.productFocuses.length > 0)
            || normalizedClients[0]
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

  const generateImage = async () => {
    if (generationInFlightRef.current) return

    if (!selectedClientId || !selectedProductFocus) {
      alert('กรุณาเลือกลูกค้าและ Product Focus')
      return
    }

    if (!selectedTopic && !prompt.trim()) {
      alert('กรุณาเลือกไอเดียที่บันทึกไว้ หรือใส่ brief ก่อน generate')
      return
    }

    generationInFlightRef.current = true
    setIsGenerating(true)
    
    const selectedClient = currentClient
    const topicTitle = selectedTopicData?.title || selectedTopic || 'Custom brief'
    const topicSummary = selectedTopicData ? selectedTopicSummary : prompt.trim()
    const requestIds = Array.from({ length: imageCount }, () => crypto.randomUUID())

    const pendingImages = buildPendingGeneratedImages({
      requestIds,
      prompt: prompt.trim(),
      topicTitle,
      topicSummary,
      aspectRatio,
    })

    setGeneratedImages(prev => [...pendingImages, ...prev])

    try {
      const requestPayload = buildGeneratedAdRequestPayload({
        prompt,
        referenceImageUrls: selectedReferenceImages,
        clientName: selectedClient?.clientName,
        productFocus: selectedProductFocus,
        selectedTopicData,
        selectedVisualRoute,
        colorPalette,
        materialImageUrls: selectedMaterials,
        adStyleLabel: selectedAdStyleOption?.label || null,
        userBrief: selectedAdStyleOption?.userBrief || null,
        aspectRatio,
      })

      const generateSingleImage = async (imageId: string) => {
        const finalImage = await requestGeneratedAdImage(requestPayload)

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

      const { failedCount } = await runConcurrentImageJobs({
        items: requestIds,
        concurrency: 2,
        run: generateSingleImage,
        onError: (imageId, error) => {
          console.error('Error generating AI image:', error)
          setGeneratedImages(prev => prev.map(img =>
            img.id === imageId
              ? { ...img, status: 'error' }
              : img,
          ))
        },
      })

      if (failedCount > 0) {
        alert(`มี ${failedCount} รูปที่สร้างไม่สำเร็จ`)
      }
    } catch (error) {
      console.error('Error generating AI images:', error)
      alert('เกิดข้อผิดพลาดในการสร้างภาพด้วย AI')
    } finally {
      generationInFlightRef.current = false
      setIsGenerating(false)
    }
  }

  const handleDownloadImage = async (imageUrl: string) => {
    try {
      await downloadGeneratedAdImage(imageUrl)
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
    return uploadGeneratedImageBlob(new Blob([blob], { type: mimeType }), `generated/${selectedClientId || "general"}`, "4k")
  }

  const upscaleImageTo2K = async (image: GeneratedImage) => {
    if (image.status !== "completed" || !image.url) {
      return
    }

    const upscaleJobId = crypto.randomUUID()
    const targetAspectRatio = image.aspectRatio || aspectRatio

    const pendingUpscale = buildPendingUpscaleImage({
      id: upscaleJobId,
      sourceImage: image,
      targetAspectRatio,
    })

    setUpscalingImageIds((prev) => [...prev, image.id])
    setGeneratedImages((prev) => [pendingUpscale, ...prev])

    try {
      const result = await requestUpscaledImage(image.url)
      const publicUrl = await uploadGeneratedBlobToStorage(result.blob, result.mimeType)

      setGeneratedImages((prev) =>
        prev.map((item) =>
          item.id === upscaleJobId
            ? {
                ...item,
                url: publicUrl,
                status: "completed",
                source: "gemini_2k",
                aspectRatio: result.aspectRatio || targetAspectRatio,
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

  const removeTextFromImage = async (image: GeneratedImage) => {
    if (image.status !== "completed" || !image.url) {
      return
    }

    const removeTextJobId = crypto.randomUUID()
    const sourceAspectRatio = image.aspectRatio || aspectRatio

    const pendingRemoveText = buildPendingRemoveTextImage({
      id: removeTextJobId,
      sourceImage: image,
      sourceAspectRatio,
    })

    setRemovingTextImageIds((prev) => [...prev, image.id])
    setGeneratedImages((prev) => [pendingRemoveText, ...prev])

    try {
      const result = await requestTextRemovedImage({
        imageUrl: image.url,
        sourceAspectRatio,
        targetSize: image.resolution || "1K",
      })
      const publicUrl = await uploadGeneratedBlobToStorage(result.blob, result.mimeType)

      setGeneratedImages((prev) =>
        prev.map((item) =>
          item.id === removeTextJobId
            ? {
                ...item,
                url: publicUrl,
                status: "completed",
                source: "gemini_text_removed",
                aspectRatio: result.aspectRatio || sourceAspectRatio,
                resolution: image.resolution,
              }
            : item,
        ),
      )
    } catch (error) {
      console.error("Error removing text from image:", error)
      setGeneratedImages((prev) =>
        prev.map((item) =>
          item.id === removeTextJobId
            ? {
                ...item,
                status: "error",
              }
            : item,
        ),
      )
      alert(error instanceof Error ? error.message : "ไม่สามารถลบข้อความออกจากภาพได้")
    } finally {
      setRemovingTextImageIds((prev) => prev.filter((id) => id !== image.id))
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
  const clearClientSelection = () => {
    setSelectedClientId("")
    setSelectedProductFocus("")
    setIsClientPopoverOpen(false)
  }
  const clearProductFocusSelection = () => {
    setSelectedProductFocus("")
  }
  const setupStatusItems = [
    { label: "Client", done: Boolean(selectedClientId) },
    { label: "Brief", done: hasIdeaOrBrief },
    { label: "Optional", done: hasOptionalDirection },
  ]

  return (
    <div className="min-w-0 space-y-6 lg:space-y-8">
      <div className="rounded-[20px] border border-slate-200/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(248,250,252,0.94)_100%)] px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)] sm:rounded-[24px] sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Generate Ads</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-950 sm:text-xl">Generate ads from a brief</h3>
            <p className="mt-2 max-w-xl text-xs leading-5 text-slate-600">
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

      <ClientProductCard
        clients={clients}
        currentClient={currentClient}
        selectedClientId={selectedClientId}
        selectedProductFocus={selectedProductFocus}
        loadingClients={loadingClients}
        isClientPopoverOpen={isClientPopoverOpen}
        onClientPopoverOpenChange={setIsClientPopoverOpen}
        onClientChange={(clientId) => {
          setSelectedClientId((currentId) => {
            const nextId = currentId === clientId ? "" : clientId
            if (!nextId) {
              setSelectedProductFocus("")
            }
            return nextId
          })
          setIsClientPopoverOpen(false)
        }}
        onProductFocusChange={setSelectedProductFocus}
        onClearClient={clearClientSelection}
        onClearProductFocus={clearProductFocusSelection}
      />

      <Card className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_14px_32px_rgba(15,23,42,0.04)] sm:rounded-[32px]">
        <div className="px-4 pt-5 sm:px-7 sm:pt-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Step 2</p>
          <h4 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-slate-950">Write your brief</h4>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            เขียน brief เองได้ทันที หรือใช้ saved idea เป็น starting point แล้วค่อยเติม optional direction เพิ่มเมื่อจำเป็น
          </p>
        </div>

        <div className="space-y-6 p-4 sm:space-y-7 sm:p-7">
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

              <SavedIdeaPanel
                selectedTopicData={selectedTopicData}
                selectedTopicSummary={selectedTopicSummary}
                availableVisualRoutes={availableVisualRoutes}
                selectedVisualRouteIndex={selectedVisualRouteIndex}
                isIdeasOpen={isIdeasOpen}
                canChooseIdea={canChooseIdea}
                loadingTopics={loadingTopics}
                savedTopics={savedTopics}
                visibleTopics={visibleTopics}
                selectedTopic={selectedTopic}
                deletingTopicId={deletingTopicId}
                showAllTopics={showAllTopics}
                onIdeasOpenChange={setIsIdeasOpen}
                onVisualRouteSelect={setSelectedVisualRouteIndex}
                onClearVisualRoute={() => setSelectedVisualRouteIndex(null)}
                onTopicSelect={(topicTitle) =>
                  setSelectedTopic((currentTopic) => (currentTopic === topicTitle ? "" : topicTitle))
                }
                onEditTopic={openTopicEdit}
                onDeleteTopic={deleteTopic}
                onAddIdea={() => setIsCustomIdeaDialogOpen(true)}
                onClearSelectedIdea={() => setSelectedTopic("")}
                onToggleShowAllTopics={() => setShowAllTopics((value) => !value)}
              />

              <AdStyleSelector
                selectedAdStyle={selectedAdStyle}
                selectedStyleLabel={selectedStyleLabel}
                onToggleStyle={(styleValue) =>
                  setSelectedAdStyle((currentValue) => (currentValue === styleValue ? "" : styleValue))
                }
              />
            </div>

            <OutputSettingsPanel
              imageCount={imageCount}
              aspectRatio={aspectRatio}
              selectedStyleLabel={selectedStyleLabel}
              onImageCountChange={setImageCount}
              onAspectRatioChange={setAspectRatio}
            />
          </div>

          <BrandPalettePanel
            isOpen={isPaletteOpen}
            selectedClientId={selectedClientId}
            colorPalette={colorPalette}
            colorInput={colorInput}
            isSavingPalette={isSavingPalette}
            onOpenChange={setIsPaletteOpen}
            onColorInputChange={setColorInput}
            onAddColor={addColor}
            onRemoveColor={removeColor}
            onSavePalette={savePalette}
          />

          <AssetReferencePanel
            canShow={canChooseIdea}
            isMaterialsOpen={isMaterialsOpen}
            isReferencesOpen={isReferencesOpen}
            materialInputRef={materialInputRef}
            referenceInputRef={referenceInputRef}
            isUploadingMaterials={isUploadingMaterials}
            isUploadingReferences={isUploadingReferences}
            loadingMaterialImages={loadingMaterialImages}
            loadingReferenceImages={loadingReferenceImages}
            materialImages={materialImages}
            referenceImages={referenceImages}
            selectedMaterials={selectedMaterials}
            selectedReferenceImages={selectedReferenceImages}
            maxReferenceSelection={maxReferenceSelection}
            isReferenceDropActive={isReferenceDropActive}
            onMaterialsOpenChange={setIsMaterialsOpen}
            onReferencesOpenChange={setIsReferencesOpen}
            onMaterialUpload={uploadMaterials}
            onReferenceUpload={uploadReferences}
            onMaterialToggle={toggleMaterial}
            onReferenceToggle={toggleReference}
            onReferenceDropActiveChange={setIsReferenceDropActive}
          />
        </div>
      </Card>

      <GenerateReviewCard
        clientName={currentClient?.clientName}
        briefSource={selectedTopicData?.title || (hasPrompt ? "Custom brief" : "Write a brief or use a saved idea")}
        styleLabel={selectedStyleLabel}
        aspectRatio={aspectRatio}
        imageCount={imageCount}
        materialCount={selectedMaterials.length}
        referenceCount={selectedReferenceImages.length}
        hasOptionalDirection={hasOptionalDirection}
        canGenerate={canGenerate}
        isGenerating={isGenerating}
        onGenerate={generateImage}
      />

      <div className="space-y-6">
        <GeneratedAdsGallery
          images={generatedImages}
          visibleImages={visibleImages}
          completedCount={completedImages.length}
          generatingCount={generatingImages.length}
          errorCount={errorImages.length}
          showAllResults={showAllResults}
          upscalingImageIds={upscalingImageIds}
          removingTextImageIds={removingTextImageIds}
          savingImageId={savingImageId}
          getSourceLabel={getSourceLabel}
          onToggleShowAll={() => setShowAllResults(!showAllResults)}
          onPreview={setSelectedImageForPreview}
          onUpscale={upscaleImageTo2K}
          onRemoveText={removeTextFromImage}
          onSave={saveImageToSupabase}
          onDownload={handleDownloadImage}
          onCopyUrl={copyImageUrl}
          onRetry={retryGeneration}
        />

        <Card className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_14px_32px_rgba(15,23,42,0.04)] sm:rounded-[32px]">
          <div className="p-4 sm:p-7">
            <div className="grid gap-4 lg:grid-cols-3">
              <p className="text-sm leading-6 text-slate-600">เริ่มจาก idea ให้ชัดก่อน แล้วค่อยเติม direction เพิ่มเท่าที่จำเป็น</p>
              <p className="text-sm leading-6 text-slate-600">ใช้ product assets เมื่ออยากให้สินค้าในภาพใกล้ของจริงมากขึ้น ส่วน reference ใช้เพื่อคุม mood และ composition</p>
              <p className="text-sm leading-6 text-slate-600">สร้าง 2-3 ภาพต่อรอบมักเปรียบเทียบได้ง่ายกว่า และไม่ทำให้ผลลัพธ์กระจายเกินไป</p>
            </div>
          </div>
        </Card>
      </div>

      <CustomIdeaDialog
        isOpen={isCustomIdeaDialogOpen}
        value={customIdeaInput}
        isParsing={isParsingCustomIdea}
        onOpenChange={setIsCustomIdeaDialogOpen}
        onValueChange={setCustomIdeaInput}
        onSubmit={addCustomIdea}
      />

      <ImagePreviewDialog
        imageUrl={selectedImageForPreview}
        imageData={selectedPreviewImageData}
        canSave={Boolean(selectedClientId)}
        isSaving={savingImageId !== null}
        isRemovingText={Boolean(
          selectedPreviewImageData && removingTextImageIds.includes(selectedPreviewImageData.id),
        )}
        onClose={() => setSelectedImageForPreview(null)}
        onRemoveText={removeTextFromImage}
        onSave={(imageUrl) => {
          const selectedClient = clients.find((client) => client.id === selectedClientId)
          if (selectedClient) {
            const imageId = Math.random().toString(36).substring(2, 11)
            saveImageToSupabase(imageUrl, imageId)
          }
        }}
        onDownload={handleDownloadImage}
        onCopyUrl={copyImageUrl}
      />

      <EditableSavedIdeaModal
        isOpen={topicEditModalOpen}
        onClose={closeTopicEdit}
        idea={editableIdea}
        onSave={saveEditableIdea}
      />
    </div>
  )
}
