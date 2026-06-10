"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowDownToLine,
  Brush,
  Check,
  ChevronsUpDown,
  FileImage,
  ImagePlus,
  Link2,
  Loader2,
  Maximize2,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AddImagesDialog } from "@/components/add-images-dialog"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PromptBox } from "@/components/ui/chatgpt-prompt-input"
import { Switch } from "@/components/ui/switch"
import {
  dataUrlToBlob,
  downloadBlob,
  uploadFileToImageStorage,
  uploadGeneratedImageBlob,
} from "@/lib/images/client"
import { getGoogleDriveFileId, normalizeExternalImageUrl } from "@/lib/images/external-url"
import {
  loadClientReferenceImages,
  uploadClientReferenceFiles,
} from "@/lib/images/reference-library"
import { getStorageClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  imageUrl?: string
}

type MaskBounds = {
  left: number
  top: number
  right: number
  bottom: number
}

type UploadedAsset = {
  id: string
  file?: File
  url?: string
  name: string
  previewUrl: string
}

type ImageEditChatPanelProps = {
  clients?: ClientOption[]
  activeClientId?: string | null
  activeProductFocus?: string | null
  variant?: "classic" | "workspace"
}

type ClientOption = {
  id: string
  clientName: string
  productFocuses: Array<{
    id: string
    productFocus: string
  }>
}

type StoredImageAsset = {
  name: string
  url: string
  createdAt: string
}

type BatchResult = {
  aspectRatio: PmaxAspectRatio
  status: "queued" | "generating" | "retrying" | "completed" | "failed"
  attempts: number
  publicUrl?: string
  outputBlob?: Blob
  dimensions?: { width: number; height: number }
  error?: string
}

const PMAX_ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"] as const
const DEFAULT_PMAX_ASPECT_RATIOS = ["1:1", "4:5", "16:9", "9:16"] as const
type PmaxAspectRatio = (typeof PMAX_ASPECT_RATIOS)[number]

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

async function getBlobDimensions(blob: Blob) {
  const bitmap = await createImageBitmap(blob)
  const dimensions = { width: bitmap.width, height: bitmap.height }
  bitmap.close()
  return dimensions
}

function matchesAspectRatio(dimensions: { width: number; height: number }, aspectRatio: PmaxAspectRatio) {
  const [width, height] = aspectRatio.split(":").map(Number)
  return Math.abs(dimensions.width / dimensions.height - width / height) <= 0.04
}

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let nextIndex = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex]
        nextIndex += 1
        await worker(item)
      }
    }),
  )
}

export function ImageEditChatPanel({
  clients = [],
  activeClientId = null,
  activeProductFocus = null,
  variant = "classic",
}: ImageEditChatPanelProps) {
  const imageRef = useRef<HTMLImageElement | null>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const maskDataCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const referenceInputRef = useRef<HTMLInputElement | null>(null)
  const materialInputRef = useRef<HTMLInputElement | null>(null)
  const sourceUploadInputRef = useRef<HTMLInputElement | null>(null)
  const referenceAssetsRef = useRef<UploadedAsset[]>([])
  const materialAssetsRef = useRef<UploadedAsset[]>([])
  const retryBatchRatioRef = useRef<((aspectRatio: PmaxAspectRatio) => Promise<void>) | null>(null)
  const isPaintingRef = useRef(false)
  const lastPaintPointRef = useRef<{ x: number; y: number } | null>(null)
  const [currentImageUrl, setCurrentImageUrl] = useState("")
  const [currentImageBlob, setCurrentImageBlob] = useState<Blob | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [isBrushMode, setIsBrushMode] = useState(false)
  const [brushSize, setBrushSize] = useState(48)
  const [hasMaskPaint, setHasMaskPaint] = useState(false)
  const [error, setError] = useState("")
  const [previewUrl, setPreviewUrl] = useState("")
  const [referenceAssets, setReferenceAssets] = useState<UploadedAsset[]>([])
  const [materialAssets, setMaterialAssets] = useState<UploadedAsset[]>([])
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false)
  const [assetDialogOpen, setAssetDialogOpen] = useState(false)
  const [selectedMaterialClientId, setSelectedMaterialClientId] = useState(activeClientId || "general")
  const [referenceLibrary, setReferenceLibrary] = useState<StoredImageAsset[]>([])
  const [materialLibrary, setMaterialLibrary] = useState<StoredImageAsset[]>([])
  const [isLoadingReferences, setIsLoadingReferences] = useState(false)
  const [isUploadingReferences, setIsUploadingReferences] = useState(false)
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false)
  const [isMaterialClientPopoverOpen, setIsMaterialClientPopoverOpen] = useState(false)
  const [referenceVisibleCount, setReferenceVisibleCount] = useState(10)
  const [sourceImageLink, setSourceImageLink] = useState("")
  const [isPmaxEnabled, setIsPmaxEnabled] = useState(false)
  const [selectedPmaxRatios, setSelectedPmaxRatios] = useState<PmaxAspectRatio[]>([...DEFAULT_PMAX_ASPECT_RATIOS])
  const [batchResults, setBatchResults] = useState<BatchResult[]>([])

  const hasImage = Boolean(currentImageUrl)
  const isProcessing = isEditing
  const selectedMaterialClient = clients.find(
    (client) =>
      client.id === selectedMaterialClientId ||
      client.productFocuses.some((productFocus) => productFocus.id === selectedMaterialClientId),
  )
  const visibleReferenceLibrary = referenceLibrary.slice(0, referenceVisibleCount)
  const isWorkspace = variant === "workspace"

  useEffect(() => {
    setHasMaskPaint(false)
    setIsBrushMode(false)
  }, [currentImageUrl])

  useEffect(() => {
    setSelectedMaterialClientId(activeClientId || "general")
    setReferenceAssets((previous) => {
      previous.forEach((asset) => {
        if (asset.file) URL.revokeObjectURL(asset.previewUrl)
      })
      return []
    })
  }, [activeClientId])

  useEffect(() => {
    referenceAssetsRef.current = referenceAssets
  }, [referenceAssets])

  useEffect(() => {
    materialAssetsRef.current = materialAssets
  }, [materialAssets])

  useEffect(() => {
    return () => {
      referenceAssetsRef.current.forEach((asset) => URL.revokeObjectURL(asset.previewUrl))
      materialAssetsRef.current.forEach((asset) => URL.revokeObjectURL(asset.previewUrl))
    }
  }, [])

  const syncMaskCanvas = () => {
    const image = imageRef.current
    const canvas = maskCanvasRef.current
    if (!image || !canvas) return

    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const dataCanvas = document.createElement("canvas")
    dataCanvas.width = image.naturalWidth
    dataCanvas.height = image.naturalHeight
    maskDataCanvasRef.current = dataCanvas
    const context = canvas.getContext("2d")
    context?.clearRect(0, 0, canvas.width, canvas.height)
    setHasMaskPaint(false)
  }

  const renderVisibleMask = () => {
    const canvas = maskCanvasRef.current
    const dataCanvas = maskDataCanvasRef.current
    const context = canvas?.getContext("2d")
    if (!canvas || !dataCanvas || !context) return

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.save()
    context.globalAlpha = 0.28
    context.drawImage(dataCanvas, 0, 0)
    context.restore()
  }

  const clearMask = () => {
    const canvas = maskCanvasRef.current
    const dataCanvas = maskDataCanvasRef.current
    const context = canvas?.getContext("2d")
    const dataContext = dataCanvas?.getContext("2d")
    if (!canvas || !context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    if (dataCanvas && dataContext) {
      dataContext.clearRect(0, 0, dataCanvas.width, dataCanvas.height)
    }
    setHasMaskPaint(false)
  }

  const addAssets = (files: FileList | null, kind: "reference" | "material") => {
    if (!files) return
    const nextAssets = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, 6)
      .map((file) => ({
        id: createId(),
        file,
        name: file.name,
        previewUrl: URL.createObjectURL(file),
      }))

    if (nextAssets.length === 0) return

    if (kind === "reference") {
      setReferenceAssets((prev) => {
        const availableSlots = Math.max(0, 6 - prev.length)
        const acceptedAssets = nextAssets.slice(0, availableSlots)
        nextAssets.slice(availableSlots).forEach((asset) => URL.revokeObjectURL(asset.previewUrl))
        return [...prev, ...acceptedAssets]
      })
      return
    }

    setMaterialAssets((prev) => {
      const availableSlots = Math.max(0, 6 - prev.length)
      const acceptedAssets = nextAssets.slice(0, availableSlots)
      nextAssets.slice(availableSlots).forEach((asset) => URL.revokeObjectURL(asset.previewUrl))
      return [...prev, ...acceptedAssets]
    })
  }

  const addStoredAsset = (asset: StoredImageAsset, kind: "reference" | "material") => {
    const uploadedAsset: UploadedAsset = {
      id: createId(),
      name: asset.name,
      url: asset.url,
      previewUrl: asset.url,
    }

    if (kind === "reference") {
      setReferenceAssets((prev) => {
        if (prev.some((item) => item.url === asset.url)) return prev
        return [...prev, uploadedAsset].slice(0, 6)
      })
      return
    }

    setMaterialAssets((prev) => {
      if (prev.some((item) => item.url === asset.url)) return prev
      return [...prev, uploadedAsset].slice(0, 6)
    })
  }

  const removeAsset = (assetId: string, kind: "reference" | "material") => {
    const update = (assets: UploadedAsset[]) => {
      const target = assets.find((asset) => asset.id === assetId)
      if (target?.file) URL.revokeObjectURL(target.previewUrl)
      return assets.filter((asset) => asset.id !== assetId)
    }

    if (kind === "reference") {
      setReferenceAssets(update)
      return
    }

    setMaterialAssets(update)
  }

  const uploadAssets = async (assets: UploadedAsset[], folderPath: string) => {
    return Promise.all(
      assets.map((asset) => {
        if (asset.url) return asset.url
        if (!asset.file) throw new Error("Missing image asset file")
        return uploadFileToImageStorage(asset.file, folderPath)
      }),
    )
  }

  const loadReferenceLibrary = useCallback(async () => {
    try {
      setIsLoadingReferences(true)
      const { images } = await loadClientReferenceImages(activeClientId || "", 80)
      setReferenceLibrary(images)
    } catch (error) {
      console.error("Failed to load reference library:", error)
      setReferenceLibrary([])
    } finally {
      setIsLoadingReferences(false)
    }
  }, [activeClientId])

  const uploadReferenceAssets = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return
      if (!activeClientId) {
        alert("กรุณาเลือกลูกค้าก่อนอัปโหลด Reference")
        return
      }

      setIsUploadingReferences(true)
      try {
        const uploaded = await uploadClientReferenceFiles(activeClientId, Array.from(files))
        const nextAssets = uploaded.map((image) => ({
          id: createId(),
          name: image.name,
          url: image.url,
          previewUrl: image.url,
        }))

        setReferenceAssets((previous) => {
          const unique = nextAssets.filter(
            (image) => !previous.some((existing) => existing.url === image.url),
          )
          return [...previous, ...unique].slice(0, 6)
        })
        await loadReferenceLibrary()
      } catch (error) {
        console.error("Failed to upload reference images:", error)
        alert("เกิดข้อผิดพลาดในการอัปโหลดรูปอ้างอิง")
      } finally {
        setIsUploadingReferences(false)
        if (referenceInputRef.current) referenceInputRef.current.value = ""
      }
    },
    [activeClientId, loadReferenceLibrary],
  )

  const loadMaterialLibrary = useCallback(async (clientId: string) => {
    if (!clientId || clientId === "general") {
      setMaterialLibrary([])
      return
    }

    try {
      setIsLoadingMaterials(true)
      const storage = getStorageClient()
      if (!storage) {
        setMaterialLibrary([])
        return
      }

      const folderPath = `materials/${clientId}`
      const { data: files, error } = await storage.from("ads-creative-image").list(folderPath, {
        limit: 80,
        offset: 0,
        sortBy: { column: "name", order: "desc" },
      })

      if (error || !files?.length) {
        setMaterialLibrary([])
        return
      }

      const images = files.map((file) => {
        const { data } = storage.from("ads-creative-image").getPublicUrl(`${folderPath}/${file.name}`)
        return {
          name: file.name,
          url: data.publicUrl,
          createdAt: file.created_at || new Date().toISOString(),
        }
      })

      setMaterialLibrary(images.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    } catch (error) {
      console.error("Failed to load material library:", error)
      setMaterialLibrary([])
    } finally {
      setIsLoadingMaterials(false)
    }
  }, [])

  useEffect(() => {
    if (!assetDialogOpen) return
    setReferenceVisibleCount(10)
    void loadReferenceLibrary()
  }, [assetDialogOpen, loadReferenceLibrary])

  useEffect(() => {
    if (!assetDialogOpen) return
    void loadMaterialLibrary(selectedMaterialClientId)
  }, [assetDialogOpen, selectedMaterialClientId, loadMaterialLibrary])

  const applyOutputImage = async (imageDataUrl: string, messageText: string, filenameSuffix: string) => {
    const outputBlob = dataUrlToBlob(imageDataUrl)
    const publicUrl = await uploadGeneratedImageBlob(outputBlob, "generated/edit-image-chat-outputs", filenameSuffix)

    setCurrentImageUrl(publicUrl)
    setCurrentImageBlob(outputBlob)
    clearMask()
    setMessages((prev) => [
      ...prev,
      {
        id: createId(),
        role: "assistant",
        text: messageText,
        imageUrl: publicUrl,
      },
    ])
  }

  const uploadOutputImage = async (imageDataUrl: string, filenameSuffix: string) => {
    const outputBlob = dataUrlToBlob(imageDataUrl)
    const publicUrl = await uploadGeneratedImageBlob(outputBlob, "generated/edit-image-chat-outputs", filenameSuffix)
    return { outputBlob, publicUrl }
  }

  const updateBatchResult = (aspectRatio: PmaxAspectRatio, patch: Partial<BatchResult>) => {
    setBatchResults((current) =>
      current.map((result) => (result.aspectRatio === aspectRatio ? { ...result, ...patch } : result)),
    )
  }

  const useBatchResultAsCurrent = (result: BatchResult) => {
    if (!result.publicUrl || !result.outputBlob) return
    setCurrentImageUrl(result.publicUrl)
    setCurrentImageBlob(result.outputBlob)
    clearMask()
  }

  const downloadAllBatchResults = () => {
    batchResults
      .filter((result) => result.status === "completed" && result.outputBlob)
      .forEach((result, index) => {
        window.setTimeout(() => {
          downloadBlob(result.outputBlob!, `edit-image-${result.aspectRatio.replace(":", "x")}.png`)
        }, index * 300)
      })
  }

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = maskCanvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
      scale: (canvas.width / rect.width + canvas.height / rect.height) / 2,
    }
  }

  const paintAt = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const dataCanvas = maskDataCanvasRef.current
    const context = dataCanvas?.getContext("2d")
    const point = getCanvasPoint(event)
    if (!dataCanvas || !context || !point) return

    context.lineCap = "round"
    context.lineJoin = "round"
    context.strokeStyle = "rgb(239, 68, 68)"
    context.fillStyle = "rgb(239, 68, 68)"
    context.lineWidth = brushSize * point.scale

    context.beginPath()
    if (lastPaintPointRef.current) {
      context.moveTo(lastPaintPointRef.current.x, lastPaintPointRef.current.y)
      context.lineTo(point.x, point.y)
      context.stroke()
    } else {
      context.arc(point.x, point.y, (brushSize * point.scale) / 2, 0, Math.PI * 2)
      context.fill()
    }

    lastPaintPointRef.current = { x: point.x, y: point.y }
    renderVisibleMask()
    setHasMaskPaint(true)
  }

  const createMaskBounds = (): MaskBounds | null => {
    const sourceCanvas = maskDataCanvasRef.current
    if (!sourceCanvas || !hasMaskPaint) return null

    const sourceContext = sourceCanvas.getContext("2d")
    if (!sourceContext) return null

    const imageData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)
    const data = imageData.data
    let minX = sourceCanvas.width
    let minY = sourceCanvas.height
    let maxX = 0
    let maxY = 0
    let hasPixel = false

    for (let y = 0; y < sourceCanvas.height; y += 1) {
      for (let x = 0; x < sourceCanvas.width; x += 1) {
        const alpha = data[(y * sourceCanvas.width + x) * 4 + 3]
        if (alpha > 0) {
          hasPixel = true
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
        }
      }
    }

    if (!hasPixel) return null

    const padding = Math.max(12, brushSize)
    return {
      left: Math.max(0, minX - padding) / sourceCanvas.width,
      top: Math.max(0, minY - padding) / sourceCanvas.height,
      right: Math.min(sourceCanvas.width, maxX + padding) / sourceCanvas.width,
      bottom: Math.min(sourceCanvas.height, maxY + padding) / sourceCanvas.height,
    }
  }

  const togglePmaxRatio = (aspectRatio: PmaxAspectRatio) => {
    setSelectedPmaxRatios((current) =>
      current.includes(aspectRatio) ? current.filter((ratio) => ratio !== aspectRatio) : [...current, aspectRatio],
    )
  }

  const handleSubmit = async ({ message, imageFile }: { message: string; imageFile: File | null }) => {
    if (isProcessing) return
    if (!message.trim()) {
      setError("Please describe what you want to edit.")
      return
    }

    if (!imageFile && !currentImageUrl) {
      setError("Upload an image first, then describe the edit.")
      return
    }

    if (isPmaxEnabled && selectedPmaxRatios.length === 0) {
      setError("Select at least one PMax size.")
      return
    }

    setIsEditing(true)
    setError("")

    const userMessageId = createId()
    const attachedPreviewUrl = imageFile ? URL.createObjectURL(imageFile) : ""
    setMessages((prev) => [
      ...prev,
      {
        id: userMessageId,
        role: "user",
        text: message.trim(),
        imageUrl: attachedPreviewUrl || undefined,
      },
    ])

    try {
      const maskBounds = !imageFile ? createMaskBounds() : null
      const sourceImageUrl = imageFile
        ? await uploadFileToImageStorage(imageFile, "generated/edit-image-chat-inputs")
        : currentImageUrl

      if (imageFile) {
        setCurrentImageUrl(sourceImageUrl)
        setCurrentImageBlob(imageFile)
      }

      const [referenceUrls, materialUrls] = await Promise.all([
        uploadAssets(
          referenceAssets,
          activeClientId ? `references/${activeClientId}` : "generated/edit-image-chat-references",
        ),
        uploadAssets(materialAssets, "generated/edit-image-chat-materials"),
      ])

      const requestEdit = async (aspectRatio?: PmaxAspectRatio) => {
        const response = await fetch("/api/edit-image-chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image_url: sourceImageUrl,
            instruction: message.trim(),
            operation: aspectRatio ? "resize" : undefined,
            output_aspect_ratio: aspectRatio,
            output_image_size: "2K",
            mask_bounds: aspectRatio ? null : maskBounds,
            reference_image_urls: referenceUrls,
            material_image_urls: materialUrls,
            product_focus: activeProductFocus,
          }),
        })
        const payload = await response.json()

        if (!response.ok || !payload.success) {
          throw new Error(payload?.error || `Cannot generate ${aspectRatio || "edited image"}`)
        }
        return payload
      }

      if (isPmaxEnabled) {
        setBatchResults(
          selectedPmaxRatios.map((aspectRatio) => ({ aspectRatio, status: "queued", attempts: 0 })),
        )

        const generateRatio = async (aspectRatio: PmaxAspectRatio) => {
          let lastError: unknown = null
          for (let attempt = 1; attempt <= 2; attempt += 1) {
            updateBatchResult(aspectRatio, {
              status: attempt === 1 ? "generating" : "retrying",
              attempts: attempt,
              error: undefined,
            })
            try {
              const payload = await requestEdit(aspectRatio)
              const outputBlob = dataUrlToBlob(payload.image_data_url)
              const dimensions = await getBlobDimensions(outputBlob)
              if (!matchesAspectRatio(dimensions, aspectRatio)) {
                throw new Error(`Output ratio ${dimensions.width}:${dimensions.height} does not match ${aspectRatio}`)
              }
              const publicUrl = await uploadGeneratedImageBlob(
                outputBlob,
                "generated/edit-image-chat-outputs",
                `pmax-${aspectRatio.replace(":", "x")}`,
              )
              updateBatchResult(aspectRatio, { status: "completed", publicUrl, outputBlob, dimensions })
              return
            } catch (error) {
              lastError = error
            }
          }
          updateBatchResult(aspectRatio, {
            status: "failed",
            error: lastError instanceof Error ? lastError.message : "Generation failed",
          })
        }
        retryBatchRatioRef.current = generateRatio
        await runWithConcurrency(selectedPmaxRatios, 2, generateRatio)

      } else {
        const payload = await requestEdit()
        await applyOutputImage(payload.image_data_url, "Edited image", "edited")
      }
    } catch (err) {
      console.error("Edit image chat failed:", err)
      setError(err instanceof Error ? err.message : "Cannot edit image")
    } finally {
      setIsEditing(false)
    }
  }

  const handleDownload = () => {
    if (!currentImageBlob) return
    downloadBlob(currentImageBlob, "edited-image.png")
  }

  const handleInitialImageUpload = async (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return

    setIsEditing(true)
    setError("")

    try {
      const publicUrl = await uploadFileToImageStorage(file, "generated/edit-image-chat-inputs")
      setCurrentImageUrl(publicUrl)
      setCurrentImageBlob(file)
      setSourceDialogOpen(false)
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "user",
          text: "Uploaded image",
          imageUrl: publicUrl,
        },
      ])
    } catch (err) {
      console.error("Initial image upload failed:", err)
      setError(err instanceof Error ? err.message : "Cannot upload image")
    } finally {
      setIsEditing(false)
    }
  }

  const handleInitialImageLink = async () => {
    const imageUrl = normalizeExternalImageUrl(sourceImageLink)
    if (!imageUrl) {
      setError("Enter a valid Google Drive or public image link.")
      return
    }

    setIsEditing(true)
    setError("")

    try {
      let resolvedImageUrl = imageUrl
      let resolvedImageBlob: Blob | null = null

      if (getGoogleDriveFileId(sourceImageLink)) {
        const response = await fetch("/api/google-drive-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: sourceImageLink }),
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error || "Unable to import Google Drive image")
        }

        resolvedImageBlob = await response.blob()
        const extension = resolvedImageBlob.type.split("/")[1]?.replace("jpeg", "jpg") || "png"
        const file = new File([resolvedImageBlob], `google-drive-image.${extension}`, { type: resolvedImageBlob.type })
        resolvedImageUrl = await uploadFileToImageStorage(file, "generated/edit-image-chat-inputs")
      }

      setCurrentImageUrl(resolvedImageUrl)
      setCurrentImageBlob(resolvedImageBlob)
      setSourceImageLink("")
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "user",
          text: "Added image from link",
          imageUrl: resolvedImageUrl,
        },
      ])
      setSourceDialogOpen(false)
    } catch (err) {
      console.error("Image link import failed:", err)
      setError(err instanceof Error ? err.message : "Unable to import image link")
    } finally {
      setIsEditing(false)
    }
  }

  const reset = () => {
    setCurrentImageUrl("")
    setCurrentImageBlob(null)
    setMessages([])
    setBatchResults([])
    retryBatchRatioRef.current = null
    setError("")
    setReferenceAssets((prev) => {
      prev.forEach((asset) => {
        if (asset.file) URL.revokeObjectURL(asset.previewUrl)
      })
      return []
    })
    setMaterialAssets((prev) => {
      prev.forEach((asset) => {
        if (asset.file) URL.revokeObjectURL(asset.previewUrl)
      })
      return []
    })
  }

  return (
    <div
      className={cn(
        "grid h-full gap-4",
        isWorkspace
          ? "min-h-0 xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]"
          : "min-h-[680px] xl:grid-cols-[minmax(420px,1fr)_minmax(380px,520px)]",
      )}
    >
      <Card
        className={cn(
          "flex min-h-0 flex-col overflow-hidden rounded-[28px] border-slate-200 bg-white shadow-sm",
          isWorkspace && "order-2 xl:sticky xl:top-0 xl:h-full",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-base font-semibold text-slate-950">Source Image</p>
              <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                Required
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">This is the main image AI will edit.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {hasImage ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  onClick={() => setSourceDialogOpen(true)}
                  title="Replace source image"
                >
                  <ImagePlus className="h-4 w-4" />
                  <span className="sr-only">Replace source image</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  onClick={() => setPreviewUrl(currentImageUrl)}
                  title="Preview source image"
                >
                  <Maximize2 className="h-4 w-4" />
                  <span className="sr-only">Preview source image</span>
                </Button>
                <Button
                  type="button"
                  variant={isBrushMode ? "default" : "outline"}
                  size="icon"
                  className="rounded-full"
                  onClick={() => setIsBrushMode((value) => !value)}
                  title="Brush edit area"
                >
                  <Brush className="h-4 w-4" />
                  <span className="sr-only">Brush edit area</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  onClick={handleDownload}
                  disabled={!currentImageBlob}
                  title="Download image"
                >
                  <ArrowDownToLine className="h-4 w-4" />
                  <span className="sr-only">Download image</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-full text-red-600 hover:text-red-700"
                  onClick={reset}
                  title="Reset edit session"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span className="sr-only">Reset edit session</span>
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {hasImage && isBrushMode ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-white px-5 py-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Brush className="h-4 w-4" />
              <span>{hasMaskPaint ? "Mask active: AI will edit only painted area." : "Brush an area to limit the edit."}</span>
            </div>
            <label className="ml-auto flex items-center gap-2 text-xs font-medium text-slate-500">
              Brush size
              <input
                type="range"
                min="12"
                max="120"
                value={brushSize}
                onChange={(event) => setBrushSize(Number(event.target.value))}
                className="w-28 accent-slate-950"
              />
              <span className="w-8 text-right">{brushSize}</span>
            </label>
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={clearMask} disabled={!hasMaskPaint}>
              <Trash2 className="mr-2 h-4 w-4" />
              Clear mask
            </Button>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-50 p-5">
          {hasImage ? (
            <div className="group flex h-full max-h-[68vh] w-full items-center justify-center overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="relative inline-flex max-h-full max-w-full">
                <img
                  ref={imageRef}
                  src={currentImageUrl}
                  alt="Current editable image"
                  onLoad={syncMaskCanvas}
                  className="max-h-[68vh] max-w-full object-contain transition duration-300 group-hover:scale-[1.01]"
                />
                <canvas
                  ref={maskCanvasRef}
                  className={cn(
                    "absolute inset-0 h-full w-full touch-none",
                    isBrushMode ? "cursor-crosshair" : "pointer-events-none",
                  )}
                  onPointerDown={(event) => {
                    if (!isBrushMode) return
                    isPaintingRef.current = true
                    lastPaintPointRef.current = null
                    paintAt(event)
                    event.currentTarget.setPointerCapture(event.pointerId)
                  }}
                  onPointerMove={(event) => {
                    if (!isBrushMode || !isPaintingRef.current) return
                    paintAt(event)
                  }}
                  onPointerUp={(event) => {
                    isPaintingRef.current = false
                    lastPaintPointRef.current = null
                    event.currentTarget.releasePointerCapture(event.pointerId)
                  }}
                  onPointerCancel={() => {
                    isPaintingRef.current = false
                    lastPaintPointRef.current = null
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex min-h-[260px] w-full max-w-xl flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white p-7 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-950 text-white">
                <ImagePlus className="h-7 w-7" />
              </div>
              <p className="mt-5 text-lg font-semibold text-slate-950">Start with an image</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                Add the image you want to edit, then describe each change in the chat.
              </p>
              <Button
                type="button"
                className="mt-5 rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800"
                onClick={() => setSourceDialogOpen(true)}
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                Choose source image
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card
        className={cn(
          "flex min-h-0 flex-col overflow-hidden rounded-[28px] border-slate-200 bg-white shadow-sm",
          isWorkspace && "order-1",
        )}
      >
        <div className="border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-950">Edit Image</p>
              <p className="mt-1 text-sm text-slate-500">Describe the change and continue refining the result.</p>
            </div>
          </div>
        </div>

        {referenceAssets.length > 0 || materialAssets.length > 0 ? (
          <div className="border-b border-slate-100 bg-white px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-medium text-slate-500">
                Using {referenceAssets.length} reference{referenceAssets.length === 1 ? "" : "s"}
                {" • "}
                {materialAssets.length} material{materialAssets.length === 1 ? "" : "s"}
              </div>
              <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setAssetDialogOpen(true)}>
                Manage supporting images
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                ...referenceAssets.map((asset) => ({ ...asset, kind: "Reference" as const })),
                ...materialAssets.map((asset) => ({ ...asset, kind: "Material" as const })),
              ].map((asset) => (
                <button
                  key={`${asset.kind}-${asset.id}`}
                  type="button"
                  title={`${asset.kind}: ${asset.name}`}
                  onClick={() => setAssetDialogOpen(true)}
                  className="group relative h-12 w-12 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition hover:border-slate-400"
                >
                  <img src={asset.previewUrl} alt={`${asset.kind}: ${asset.name}`} className="h-full w-full object-cover" />
                  <span
                    className={cn(
                      "absolute inset-x-0 bottom-0 truncate px-1 py-0.5 text-[8px] font-semibold text-white",
                      asset.kind === "Reference" ? "bg-indigo-600/90" : "bg-emerald-600/90",
                    )}
                  >
                    {asset.kind}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-5">
          {messages.length === 0 ? (
            <div className="flex h-full min-h-[180px] flex-col justify-center">
              <p className="text-center text-sm font-medium text-slate-500">Try an edit</p>
              <div className="mt-3 grid gap-2">
                {[
                  "Remove the text and keep the product unchanged.",
                  "Change the background to a clean studio scene.",
                  "Make the lighting more premium and realistic.",
                ].map((example) => (
                  <div
                    key={example}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-5 text-slate-600"
                  >
                    {example}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "rounded-[24px] border p-4",
                  message.role === "user" ? "border-slate-200 bg-white" : "border-emerald-100 bg-emerald-50",
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {message.role === "user" ? "You" : "AI"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{message.text}</p>
                {message.imageUrl ? (
                  <button
                    type="button"
                    onClick={() => setPreviewUrl(message.imageUrl || "")}
                    className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white"
                  >
                    <img src={message.imageUrl} alt={message.text} className="h-auto max-h-52 w-full object-contain" />
                  </button>
                ) : null}
              </div>
            ))
          )}

          {isProcessing ? (
            <div className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-white p-4 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Editing image...
            </div>
          ) : null}

          {batchResults.length > 0 ? (
            <div className="rounded-[24px] border border-indigo-200 bg-indigo-50/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-indigo-950">Multi-size results</p>
                  <p className="mt-1 text-xs text-indigo-700">Maximum 2 sizes generate at once. Incorrect ratios retry automatically.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={downloadAllBatchResults}
                  disabled={!batchResults.some((result) => result.status === "completed")}
                >
                  <ArrowDownToLine className="mr-2 h-4 w-4" />
                  Download all
                </Button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {batchResults.map((result) => (
                  <div key={result.aspectRatio} className="overflow-hidden rounded-2xl border border-indigo-100 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">{result.aspectRatio}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{result.status}</span>
                    </div>
                    {result.publicUrl ? (
                      <button type="button" className="mt-2 block w-full" onClick={() => setPreviewUrl(result.publicUrl || "")}>
                        <img src={result.publicUrl} alt={`Generated ${result.aspectRatio}`} className="max-h-44 w-full rounded-xl object-contain" />
                      </button>
                    ) : (
                      <div className="mt-2 flex h-28 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-500">
                        {result.status === "failed" ? result.error || "Generation failed" : <Loader2 className="h-5 w-5 animate-spin" />}
                      </div>
                    )}
                    <div className="mt-2 flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 flex-1 rounded-full text-xs"
                        onClick={() => useBatchResultAsCurrent(result)}
                        disabled={result.status !== "completed"}
                      >
                        Use for edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => void retryBatchRatioRef.current?.(result.aspectRatio)}
                        disabled={isProcessing || result.status !== "failed"}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span className="sr-only">Retry {result.aspectRatio}</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-slate-100 bg-white p-4">
          {error ? <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-slate-700">Generate multiple sizes</p>
              <Switch checked={isPmaxEnabled} onCheckedChange={setIsPmaxEnabled} disabled={isProcessing || !hasImage} />
            </div>
            {isPmaxEnabled ? (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                {PMAX_ASPECT_RATIOS.map((aspectRatio) => {
                  const selected = selectedPmaxRatios.includes(aspectRatio)
                  return (
                    <button
                      key={aspectRatio}
                      type="button"
                      onClick={() => togglePmaxRatio(aspectRatio)}
                      disabled={isProcessing}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                        selected
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-300 bg-white text-slate-600 hover:border-slate-500",
                      )}
                    >
                      {aspectRatio}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setSelectedPmaxRatios([...DEFAULT_PMAX_ASPECT_RATIOS])}
                  disabled={isProcessing}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-500"
                >
                  PMax defaults
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPmaxRatios([...PMAX_ASPECT_RATIOS])}
                  disabled={isProcessing}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-500"
                >
                  Select all
                </button>
                <span className="self-center text-xs text-slate-500">
                  {selectedPmaxRatios.length} size{selectedPmaxRatios.length === 1 ? "" : "s"} selected
                </span>
              </div>
            ) : null}
          </div>
          <PromptBox
            disabled={!hasImage}
            isLoading={isProcessing}
            placeholder={hasImage ? "Tell AI what to edit..." : "Choose a source image before writing an edit..."}
            onAttachClick={() => setAssetDialogOpen(true)}
            onSubmit={handleSubmit}
          />
        </div>
      </Card>

      <Dialog open={sourceDialogOpen} onOpenChange={setSourceDialogOpen}>
        <DialogContent className="max-w-xl rounded-[28px] border-slate-200 bg-white p-0">
          <DialogHeader className="border-b border-slate-100 px-6 py-5">
            <DialogTitle>{hasImage ? "Replace source image" : "Choose source image"}</DialogTitle>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Select the main image you want AI to edit. References and materials can be added after this step.
            </p>
          </DialogHeader>

          <input
            ref={sourceUploadInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              void handleInitialImageUpload(event.target.files?.[0] || null)
              event.target.value = ""
            }}
          />

          <div className="space-y-4 p-6">
            <Button
              type="button"
              className="h-12 w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800"
              onClick={() => sourceUploadInputRef.current?.click()}
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
              Upload source image
            </Button>

            <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              Or use a link
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <Input
                type="url"
                value={sourceImageLink}
                onChange={(event) => setSourceImageLink(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleInitialImageLink()
                }}
                placeholder="Google Drive or public image URL"
                className="h-11 rounded-xl bg-white"
                disabled={isProcessing}
              />
              <Button
                type="button"
                variant="outline"
                className="mt-2 h-11 w-full rounded-xl bg-white"
                onClick={handleInitialImageLink}
                disabled={isProcessing || !sourceImageLink.trim()}
              >
                <Link2 className="mr-2 h-4 w-4" />
                Use image link
              </Button>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Google Drive access must be set to anyone with the link.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AddImagesDialog open={assetDialogOpen} onOpenChange={setAssetDialogOpen}>
        <DialogContent className="max-h-[88vh] max-w-5xl overflow-hidden rounded-[28px] border-slate-200 bg-white p-0">
          <DialogHeader className="border-b border-slate-100 px-6 py-5">
            <DialogTitle>Add supporting images</DialogTitle>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Optional references guide the look. Materials provide products, logos, models, or objects to use in the edit.
            </p>
          </DialogHeader>

          <input
            ref={referenceInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              void uploadReferenceAssets(event.target.files)
            }}
          />
          <input
            ref={materialInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              addAssets(event.target.files, "material")
              event.target.value = ""
            }}
          />

          <div className="grid max-h-[calc(88vh-84px)] gap-0 overflow-y-auto lg:grid-cols-[280px_1fr]">
            <div className="space-y-3 border-b border-slate-100 bg-slate-50 p-5 lg:border-b-0 lg:border-r">
              <Button
                type="button"
                className="w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800"
                onClick={() => referenceInputRef.current?.click()}
                disabled={isUploadingReferences || !activeClientId}
              >
                {isUploadingReferences ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileImage className="mr-2 h-4 w-4" />
                )}
                {isUploadingReferences ? "Uploading..." : "Upload reference"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-2xl"
                onClick={() => materialInputRef.current?.click()}
              >
                <FileImage className="mr-2 h-4 w-4" />
                Upload material
              </Button>

              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Material client</p>
                <Popover open={isMaterialClientPopoverOpen} onOpenChange={setIsMaterialClientPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={isMaterialClientPopoverOpen}
                      className="mt-2 h-10 w-full justify-between rounded-xl border-slate-200 bg-white px-3 font-normal text-slate-900 hover:bg-white"
                    >
                      <span className="truncate">{selectedMaterialClient?.clientName || "Default mode"}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-500" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-[var(--radix-popover-trigger-width)] min-w-[240px] rounded-2xl border-slate-200 p-0"
                  >
                    <Command>
                      <CommandInput placeholder="Type to search client..." />
                      <CommandList>
                        <CommandEmpty>No client found</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="Default mode"
                            onSelect={() => {
                              setSelectedMaterialClientId("general")
                              setIsMaterialClientPopoverOpen(false)
                            }}
                            className="flex items-center justify-between px-3 py-2"
                          >
                            <span>Default mode</span>
                            <Check
                              className={cn(
                                "h-4 w-4 text-slate-900",
                                selectedMaterialClientId === "general" ? "opacity-100" : "opacity-0",
                              )}
                            />
                          </CommandItem>
                          {clients.map((client) => (
                            <CommandItem
                              key={client.id}
                              value={client.clientName}
                              onSelect={() => {
                                setSelectedMaterialClientId(client.id)
                                setIsMaterialClientPopoverOpen(false)
                              }}
                              className="flex items-center justify-between px-3 py-2"
                            >
                              <span>{client.clientName}</span>
                              <Check
                                className={cn(
                                  "h-4 w-4 text-slate-900",
                                  selectedMaterialClientId === client.id ? "opacity-100" : "opacity-0",
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
                        onClick={() => setIsMaterialClientPopoverOpen(false)}
                        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        <Plus className="h-4 w-4" />
                        Add new client
                      </Link>
                    </div>
                  </PopoverContent>
                </Popover>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {selectedMaterialClient
                    ? `Showing saved materials for ${selectedMaterialClient.clientName}.`
                    : "Choose a client to load saved materials."}
                </p>
              </div>

              {referenceAssets.length > 0 || materialAssets.length > 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Selected</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[...referenceAssets.map((asset) => ({ ...asset, kind: "reference" as const })), ...materialAssets.map((asset) => ({ ...asset, kind: "material" as const }))].map((asset) => (
                      <div key={`${asset.kind}-${asset.id}`} className="relative h-14 w-14 overflow-hidden rounded-xl border border-slate-200">
                        <img src={asset.previewUrl} alt={asset.name} className="h-full w-full object-cover" />
                        <span
                          className={cn(
                            "absolute inset-x-0 bottom-0 truncate px-1 py-0.5 text-center text-[8px] font-semibold text-white",
                            asset.kind === "reference" ? "bg-indigo-600/90" : "bg-emerald-600/90",
                          )}
                        >
                          {asset.kind === "reference" ? "Reference" : "Material"}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAsset(asset.id, asset.kind)}
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-6 p-5">
              <section>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Reference gallery</p>
                    <p className="mt-1 text-xs text-slate-500">Use saved images as style, layout, mood, or composition reference.</p>
                  </div>
                  {isLoadingReferences ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
                </div>

                {referenceLibrary.length > 0 ? (
                  <>
                    <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-5">
                      {visibleReferenceLibrary.map((asset) => {
                        const selected = referenceAssets.some((item) => item.url === asset.url)
                        return (
                          <button
                            key={asset.url}
                            type="button"
                            onClick={() => (selected ? undefined : addStoredAsset(asset, "reference"))}
                            className={cn(
                              "group relative aspect-square overflow-hidden rounded-2xl border bg-slate-100",
                              selected ? "border-slate-950 ring-2 ring-slate-950/10" : "border-slate-200 hover:border-slate-400",
                            )}
                          >
                            <img src={asset.url} alt={asset.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                            {selected ? (
                              <span className="absolute right-2 top-2 rounded-full bg-slate-950 px-2 py-1 text-[10px] font-semibold text-white">
                                Selected
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                    {referenceVisibleCount < referenceLibrary.length ? (
                      <div className="mt-4 flex justify-center">
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => setReferenceVisibleCount((count) => Math.min(count + 10, referenceLibrary.length))}
                        >
                          See more
                        </Button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                    No saved reference images yet. Upload a reference image to use it now.
                  </div>
                )}
              </section>

              <section>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Client materials</p>
                    <p className="mt-1 text-xs text-slate-500">Choose product, model, logo, or object assets saved under the selected client.</p>
                  </div>
                  {isLoadingMaterials ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
                </div>

                {materialLibrary.length > 0 ? (
                  <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-5">
                    {materialLibrary.map((asset) => {
                      const selected = materialAssets.some((item) => item.url === asset.url)
                      return (
                        <button
                          key={asset.url}
                          type="button"
                          onClick={() => (selected ? undefined : addStoredAsset(asset, "material"))}
                          className={cn(
                            "group relative aspect-square overflow-hidden rounded-2xl border bg-slate-100",
                            selected ? "border-slate-950 ring-2 ring-slate-950/10" : "border-slate-200 hover:border-slate-400",
                          )}
                        >
                          <img src={asset.url} alt={asset.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                          {selected ? (
                            <span className="absolute right-2 top-2 rounded-full bg-slate-950 px-2 py-1 text-[10px] font-semibold text-white">
                              Selected
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                    {selectedMaterialClientId === "general"
                      ? "Select a client to see saved materials, or upload material images for this session."
                      : "No saved materials found for this client. Upload material images to use them now."}
                  </div>
                )}
              </section>
            </div>
          </div>
        </DialogContent>
      </AddImagesDialog>

      <Dialog open={Boolean(previewUrl)} onOpenChange={(open) => !open && setPreviewUrl("")}>
        <DialogContent className="max-w-[96vw] rounded-[28px] border-slate-200 bg-white p-4">
          <DialogHeader>
            <DialogTitle>Edit Image Preview</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[82vh] items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
            {previewUrl ? <img src={previewUrl} alt="Preview" className="max-h-[82vh] w-auto max-w-full object-contain" /> : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
