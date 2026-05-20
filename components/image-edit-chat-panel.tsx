"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ArrowDownToLine,
  Brush,
  FileImage,
  ImagePlus,
  Loader2,
  Maximize2,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PromptBox } from "@/components/ui/chatgpt-prompt-input"
import {
  dataUrlToBlob,
  downloadBlob,
  uploadFileToImageStorage,
  uploadGeneratedImageBlob,
} from "@/lib/images/client"
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

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function ImageEditChatPanel({
  clients = [],
  activeClientId = null,
  activeProductFocus = null,
}: ImageEditChatPanelProps) {
  const imageRef = useRef<HTMLImageElement | null>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const maskDataCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const emptyUploadInputRef = useRef<HTMLInputElement | null>(null)
  const referenceInputRef = useRef<HTMLInputElement | null>(null)
  const materialInputRef = useRef<HTMLInputElement | null>(null)
  const sourceUploadInputRef = useRef<HTMLInputElement | null>(null)
  const referenceAssetsRef = useRef<UploadedAsset[]>([])
  const materialAssetsRef = useRef<UploadedAsset[]>([])
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
  const [assetDialogOpen, setAssetDialogOpen] = useState(false)
  const [selectedMaterialClientId, setSelectedMaterialClientId] = useState(activeClientId || "general")
  const [referenceLibrary, setReferenceLibrary] = useState<StoredImageAsset[]>([])
  const [materialLibrary, setMaterialLibrary] = useState<StoredImageAsset[]>([])
  const [isLoadingReferences, setIsLoadingReferences] = useState(false)
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false)
  const [clientSearchTerm, setClientSearchTerm] = useState("")
  const [referenceVisibleCount, setReferenceVisibleCount] = useState(10)

  const hasImage = Boolean(currentImageUrl)
  const isProcessing = isEditing
  const selectedMaterialClient = clients.find((client) => client.id === selectedMaterialClientId)
  const filteredMaterialClients = clients.filter((client) =>
    client.clientName.toLowerCase().includes(clientSearchTerm.trim().toLowerCase()),
  )
  const visibleReferenceLibrary = referenceLibrary.slice(0, referenceVisibleCount)

  useEffect(() => {
    setHasMaskPaint(false)
    setIsBrushMode(false)
  }, [currentImageUrl])

  useEffect(() => {
    setSelectedMaterialClientId(activeClientId || "general")
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
      const storage = getStorageClient()
      if (!storage) {
        setReferenceLibrary([])
        return
      }

      const { data: files, error } = await storage.from("ads-creative-image").list("references/", {
        limit: 80,
        offset: 0,
        sortBy: { column: "name", order: "desc" },
      })

      if (error || !files?.length) {
        setReferenceLibrary([])
        return
      }

      const images = files.map((file) => {
        const { data } = storage.from("ads-creative-image").getPublicUrl(`references/${file.name}`)
        return {
          name: file.name,
          url: data.publicUrl,
          createdAt: file.created_at || new Date().toISOString(),
        }
      })

      setReferenceLibrary(images.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    } catch (error) {
      console.error("Failed to load reference library:", error)
      setReferenceLibrary([])
    } finally {
      setIsLoadingReferences(false)
    }
  }, [])

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
        uploadAssets(referenceAssets, "generated/edit-image-chat-references"),
        uploadAssets(materialAssets, "generated/edit-image-chat-materials"),
      ])

      const response = await fetch("/api/edit-image-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url: sourceImageUrl,
          instruction: message.trim(),
          mask_bounds: maskBounds,
          reference_image_urls: referenceUrls,
          material_image_urls: materialUrls,
          product_focus: activeProductFocus,
        }),
      })
      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload?.error || "Cannot edit image")
      }

      await applyOutputImage(payload.image_data_url, "Edited image", "edited")
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

  const reset = () => {
    setCurrentImageUrl("")
    setCurrentImageBlob(null)
    setMessages([])
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
    <div className="grid h-full min-h-[680px] gap-5 xl:grid-cols-[minmax(420px,1fr)_minmax(380px,520px)]">
      <Card className="flex min-h-0 flex-col overflow-hidden rounded-[32px] border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <p className="text-base font-semibold text-slate-950">Current Image</p>
            <p className="mt-1 text-sm text-slate-500">Upload once, then keep editing through chat.</p>
          </div>
          <div className="flex gap-2">
            {hasImage ? (
              <>
                <Button type="button" variant="outline" className="rounded-full" onClick={() => setPreviewUrl(currentImageUrl)}>
                  <Maximize2 className="mr-2 h-4 w-4" />
                  Preview
                </Button>
                <Button
                  type="button"
                  variant={isBrushMode ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => setIsBrushMode((value) => !value)}
                >
                  <Brush className="mr-2 h-4 w-4" />
                  Brush
                </Button>
                <Button type="button" variant="outline" className="rounded-full" onClick={handleDownload} disabled={!currentImageBlob}>
                  <ArrowDownToLine className="mr-2 h-4 w-4" />
                  Download
                </Button>
                <Button type="button" variant="outline" className="rounded-full text-red-600 hover:text-red-700" onClick={reset}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {hasImage ? (
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
            <div className="flex min-h-[420px] w-full max-w-xl flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-center">
              <input
                ref={emptyUploadInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  void handleInitialImageUpload(event.target.files?.[0] || null)
                  event.target.value = ""
                }}
              />
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-950 text-white">
                <ImagePlus className="h-7 w-7" />
              </div>
              <p className="mt-5 text-lg font-semibold text-slate-950">Start with an image</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                Attach an image in the chat box and tell AI what to edit. The result becomes the next editable image.
              </p>
              <Button
                type="button"
                className="mt-5 rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800"
                onClick={() => emptyUploadInputRef.current?.click()}
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                Upload image
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card className="flex min-h-0 flex-col overflow-hidden rounded-[32px] border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-950">Edit Chat</p>
              <p className="mt-1 text-sm text-slate-500">Powered by Gemini image editing, no n8n flow.</p>
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
                Manage images
              </Button>
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-5">
          {messages.length === 0 ? (
            <div className="rounded-[24px] border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-950">Examples</p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <p>• Remove the text and keep only the background and product.</p>
                <p>• Change the background to a clean studio scene, keep the product unchanged.</p>
                <p>• Make the lighting more premium and realistic without changing composition.</p>
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
        </div>

        <div className="border-t border-slate-100 bg-white p-4">
          {error ? <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          <PromptBox
            isLoading={isProcessing}
            placeholder={hasImage ? "Tell AI what to edit..." : "Attach an image and describe the first edit..."}
            onAttachClick={() => setAssetDialogOpen(true)}
            onSubmit={handleSubmit}
          />
        </div>
      </Card>

      <Dialog open={assetDialogOpen} onOpenChange={setAssetDialogOpen}>
        <DialogContent className="max-h-[88vh] max-w-5xl overflow-hidden rounded-[28px] border-slate-200 bg-white p-0">
          <DialogHeader className="border-b border-slate-100 px-6 py-5">
            <DialogTitle>Add images</DialogTitle>
          </DialogHeader>

          <input
            ref={sourceUploadInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              void handleInitialImageUpload(event.target.files?.[0] || null)
              event.target.value = ""
              setAssetDialogOpen(false)
            }}
          />
          <input
            ref={referenceInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              addAssets(event.target.files, "reference")
              event.target.value = ""
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
                onClick={() => sourceUploadInputRef.current?.click()}
                disabled={isProcessing}
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                Upload image to edit
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-2xl"
                onClick={() => referenceInputRef.current?.click()}
              >
                <FileImage className="mr-2 h-4 w-4" />
                Upload reference
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
                <input
                  type="search"
                  value={clientSearchTerm}
                  onChange={(event) => setClientSearchTerm(event.target.value)}
                  placeholder="Search client"
                  className="mt-2 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400"
                />
                <div className="mt-2">
                  <Select value={selectedMaterialClientId} onValueChange={setSelectedMaterialClientId}>
                    <SelectTrigger className="h-10 rounded-xl border-slate-200 text-sm">
                      <SelectValue placeholder="Default mode" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="general">Default mode</SelectItem>
                      {filteredMaterialClients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.clientName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
      </Dialog>

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
