"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getStorageClient } from "@/lib/supabase/client"
import {
  Upload,
  Loader2,
  Image as ImageIcon,
  Sparkles,
  Trash2,
  Download,
  Copy,
  CheckCircle,
  Palette,
} from "lucide-react"

const ASPECT_RATIO_OPTIONS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]
const IMAGE_COUNT_OPTIONS = [1, 2, 3, 4, 5]

type ReferenceImage = {
  file?: File
  previewUrl: string
  uploadedUrl?: string
  name?: string
  size?: number
  created_at?: string
  url?: string
}

type GeneratedImage = {
  id: string
  url: string
  source?: string
}

type ClientProfileSummary = {
  clientName?: string | null
  productFocus?: string | null
  services?: string | null
  usp?: string | null
  specialty?: string | null
  strengths?: string | null
  weaknesses?: string | null
  pricing?: string | null
}

type ReferenceRemixPanelProps = {
  activeClientId?: string | null
  activeClientName?: string | null
  activeProductFocus?: string | null
}

type ClientOption = {
  id: string
  clientName: string
  productFocuses: Array<{
    id: string
    productFocus: string
  }>
  colorPalette?: string[]
}

export function ReferenceRemixPanel({
  activeClientId,
  activeClientName,
  activeProductFocus,
}: ReferenceRemixPanelProps) {
  const MAX_REFERENCE_SELECTION = 5
  const [selectedReferences, setSelectedReferences] = useState<string[]>([])
  const [brief, setBrief] = useState("")
  const [brandProfile, setBrandProfile] = useState<ClientProfileSummary | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dropzoneRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientSearchTerm, setClientSearchTerm] = useState("")
  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [selectedProductFocus, setSelectedProductFocus] = useState<string>("")
  const [loadingClients, setLoadingClients] = useState(false)
  const [materialImages, setMaterialImages] = useState<ReferenceImage[]>([])
  const [loadingMaterialImages, setLoadingMaterialImages] = useState(false)
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([])
  const [isUploadingMaterials, setIsUploadingMaterials] = useState(false)
  const materialInputRef = useRef<HTMLInputElement | null>(null)
  const [colorPalette, setColorPalette] = useState<string[]>([])
  const [colorInput, setColorInput] = useState("")
  const [isSavingPalette, setIsSavingPalette] = useState(false)
  const [aspectRatio, setAspectRatio] = useState<string>(ASPECT_RATIO_OPTIONS[0])
  const [imageCount, setImageCount] = useState<number>(1)
  const [referenceLibrary, setReferenceLibrary] = useState<ReferenceImage[]>([])
  const [loadingReferenceLibrary, setLoadingReferenceLibrary] = useState(false)
  const [isUploadingReferences, setIsUploadingReferences] = useState(false)
  const referenceLibraryInputRef = useRef<HTMLInputElement | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [referencePanelTab, setReferencePanelTab] = useState<"upload" | "library">("upload")

  const REMIX_WEBHOOK_URL =
    "https://n8n.srv934175.hstgr.cloud/webhook-test/44bffd94-9280-441a-a166-cdad46ab7981"

  const selectedClient = useMemo(() => {
    if (!selectedClientId) return null
    return clients.find((client) => client.id === selectedClientId) || null
  }, [clients, selectedClientId])

  const filteredClients = useMemo(() => {
    if (!clientSearchTerm.trim()) return clients
    const query = clientSearchTerm.toLowerCase()
    return clients.filter((client) => client.clientName.toLowerCase().includes(query))
  }, [clients, clientSearchTerm])

  const resolvedClientName =
    selectedClient?.clientName || activeClientName || "No Client Selected"

  const resolvedProductFocus =
    selectedProductFocus || activeProductFocus || selectedClient?.productFocuses[0]?.productFocus || ""
  const availableProductFocuses = selectedClient?.productFocuses || []

  // Load client profile whenever the selection changes
  useEffect(() => {
    let isCancelled = false

    const fetchProfile = async () => {
      if (!selectedClientId) {
        setBrandProfile(null)
        return
      }

      try {
        setIsLoadingProfile(true)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ""
        const response = await fetch(
          `${baseUrl}/api/client-profile?clientId=${encodeURIComponent(selectedClientId)}`,
        )

        if (!response.ok) {
          throw new Error("โหลดข้อมูลแบรนด์ไม่สำเร็จ")
        }

        const data = await response.json()
        if (!isCancelled) {
          setBrandProfile(data?.client || null)
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Failed to fetch client profile:", error)
          setBrandProfile(null)
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingProfile(false)
        }
      }
    }

    fetchProfile()

    return () => {
      isCancelled = true
    }
  }, [selectedClientId])

  useEffect(() => {
    const loadClients = async () => {
      try {
        setLoadingClients(true)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ""
        const response = await fetch(`${baseUrl}/api/clients-with-product-focus`)
        const data = await response.json()
        if (Array.isArray(data)) {
          setClients(data)

          if (!selectedClientId && data.length > 0) {
            const targetClient =
              data.find((client) => client.id === activeClientId) || data[0]
            setSelectedClientId(targetClient.id)

            const preferredProductFocus =
              targetClient.productFocuses.find(
                (pf) => pf.productFocus === activeProductFocus,
              )?.productFocus || targetClient.productFocuses[0]?.productFocus || ""
            setSelectedProductFocus(preferredProductFocus)
          }
        }
      } catch (error) {
        console.error("Failed to load clients:", error)
      } finally {
        setLoadingClients(false)
      }
    }

    loadClients()
  }, [activeClientId, activeProductFocus])

  useEffect(() => {
    if (!clients.length || !activeClientId) return
    const targetClient = clients.find((client) => client.id === activeClientId)
    if (targetClient) {
      setSelectedClientId(targetClient.id)
      const preferredProduct =
        targetClient.productFocuses.find((pf) => pf.productFocus === activeProductFocus)?.productFocus ||
        targetClient.productFocuses[0]?.productFocus ||
        ""
      setSelectedProductFocus(preferredProduct)
    }
  }, [clients, activeClientId, activeProductFocus])

  const handleClientSelection = useCallback(
    (value: string) => {
      setSelectedClientId(value)
      setClientSearchTerm("")
      const targetClient = clients.find((client) => client.id === value)
      const firstProductFocus = targetClient?.productFocuses[0]?.productFocus || ""
      setSelectedProductFocus(firstProductFocus)
    },
    [clients],
  )

  const handleProductFocusSelection = useCallback((value: string) => {
    setSelectedProductFocus(value)
  }, [])

  const loadMaterialImages = useCallback(async (clientId: string) => {
    try {
      setLoadingMaterialImages(true)
      const storageClient = getStorageClient()
      if (!storageClient) {
        console.error("Storage client not available")
        setMaterialImages([])
        setSelectedMaterials([])
        return
      }

      const folderPath = `materials/${clientId}`
      const { data: files, error } = await storageClient.from("ads-creative-image").list(folderPath, {
        limit: 60,
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
          previewUrl: urlData.publicUrl,
          uploadedUrl: urlData.publicUrl,
          url: urlData.publicUrl,
          size: file.metadata?.size || 0,
          created_at: file.created_at || new Date().toISOString(),
        } satisfies ReferenceImage
      })

      const imageList = await Promise.all(imagePromises)
      const sortedImages = imageList.sort(
        (a, b) => new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime(),
      )

      setMaterialImages(sortedImages)
      setSelectedMaterials((prev) =>
        prev.filter((url) => sortedImages.some((image) => (image.url || image.uploadedUrl) === url)),
      )
    } catch (error) {
      console.error("Failed to load material images:", error)
    } finally {
      setLoadingMaterialImages(false)
    }
  }, [])


  useEffect(() => {
    if (selectedClientId) {
      loadMaterialImages(selectedClientId)
    } else {
      setMaterialImages([])
      setSelectedMaterials([])
    }
  }, [selectedClientId, loadMaterialImages])

  useEffect(() => {
    setSelectedReferences([])
  }, [selectedClientId, selectedProductFocus])

  useEffect(() => {
    const selectedClient = clients.find((client) => client.id === selectedClientId)
    setColorPalette(selectedClient?.colorPalette || [])
  }, [selectedClientId, clients])

  const handleMaterialToggle = useCallback((url: string) => {
    setSelectedMaterials((prev) => (prev.includes(url) ? prev.filter((item) => item !== url) : [...prev, url]))
  }, [])

  const handleMaterialUpload = useCallback(
    async (files: FileList | null) => {
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
    },
    [loadMaterialImages, selectedClientId],
  )

  const addReferencesToSelection = useCallback(
    (urls: string[]) => {
      setSelectedReferences((prev) => {
        const next = [...prev]
        urls.forEach((url) => {
          if (url && !next.includes(url) && next.length < MAX_REFERENCE_SELECTION) {
            next.push(url)
          }
        })
        return next
      })
    },
    [MAX_REFERENCE_SELECTION],
  )

  const toggleReferenceSelection = useCallback(
    (url: string) => {
      setSelectedReferences((prev) => {
        if (prev.includes(url)) {
          return prev.filter((item) => item !== url)
        }
        if (prev.length >= MAX_REFERENCE_SELECTION) {
          alert(`เลือกได้สูงสุด ${MAX_REFERENCE_SELECTION} รูป`)
          return prev
        }
        return [...prev, url]
      })
    },
    [MAX_REFERENCE_SELECTION],
  )

  const brandHighlights = useMemo(() => {
    if (!brandProfile) return []

    const highlights: Array<{ label: string; value: string }> = []

    if (brandProfile.productFocus) {
      highlights.push({ label: "Product Focus", value: brandProfile.productFocus })
    }
    if (brandProfile.usp) {
      highlights.push({ label: "USP", value: brandProfile.usp })
    }
    if (brandProfile.specialty) {
      highlights.push({ label: "Specialty", value: brandProfile.specialty })
    }
    if (brandProfile.services) {
      highlights.push({
        label: "Services",
        value: brandProfile.services
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .join(", "),
      })
    }
    if (brandProfile.strengths) {
      highlights.push({ label: "Strengths", value: brandProfile.strengths })
    }
    if (brandProfile.weaknesses) {
      highlights.push({ label: "Weaknesses", value: brandProfile.weaknesses })
    }
    if (brandProfile.pricing) {
      highlights.push({ label: "Pricing", value: brandProfile.pricing })
    }

    return highlights
  }, [brandProfile])

  const buildPrompt = () => {
    const contextParts = [
      resolvedClientName ? `แบรนด์: ${resolvedClientName}` : null,
      resolvedProductFocus ? `สินค้า/บริการ: ${resolvedProductFocus}` : null,
      brandProfile?.usp ? `USP: ${brandProfile.usp}` : null,
      brandProfile?.specialty ? `Specialty: ${brandProfile.specialty}` : null,
      brandProfile?.strengths ? `Strengths: ${brandProfile.strengths}` : null,
    ].filter(Boolean)

    return [
      "สร้างรูปภาพโฆษณาตามรูปแบบและองค์ประกอบของรูปอ้างอิงที่ให้ไว้",
      contextParts.length ? `ข้อมูลแบรนด์:\n${contextParts.join("\n")}` : null,
      brief ? `บรีฟเพิ่มเติม: ${brief.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n\n")
  }

  const normalizeImageEntries = (entry: any): Array<{ url: string; source?: string }> => {
    const entries: Array<{ url: string; source?: string }> = []
    if (!entry) return entries

    if (typeof entry === "string") {
      entries.push({ url: entry })
      return entries
    }

    if (typeof entry === "object") {
      if (entry.url || entry.image_url) {
        entries.push({ url: entry.url || entry.image_url, source: entry.source || entry.provider })
      }
      const altKeys = ["gemini", "ideogram", "dalle", "stable_diffusion"]
      altKeys.forEach((key) => {
        if (entry[key]) {
          entries.push({ url: entry[key], source: key })
        }
      })
      if (!entries.length) {
        Object.keys(entry).forEach((key) => {
          if (typeof entry[key] === "string") {
            entries.push({ url: entry[key], source: key })
          }
        })
      }
    }

    return entries
  }

  const handleGenerate = async () => {
    if (!selectedClientId || !resolvedProductFocus || !resolvedClientName) {
      setErrorMessage("กรุณาเลือกลูกค้าและ Product Focus ก่อน")
      return
    }

    if (selectedReferences.length === 0) {
      setErrorMessage("กรุณาเลือกรูป Reference อย่างน้อย 1 รูป")
      return
    }

    setErrorMessage(null)
    setIsGenerating(true)

    try {
      const prompt = buildPrompt()
      const normalizedImageCount = Math.min(5, Math.max(1, Number(imageCount) || 1))
      const payload = {
        prompt,
        reference_image_url: selectedReferences[0] || null,
        reference_image_urls: selectedReferences,
        client_name: resolvedClientName,
        product_focus: resolvedProductFocus,
        selected_topics: [],
        core_concept: "",
        topic_title: "",
        topic_description: "",
        content_pillar: "",
        copywriting: null,
        color_palette: colorPalette,
        material_image_urls: selectedMaterials,
        client_id: selectedClientId,
        product_focus_name: resolvedProductFocus,
        brief_text: brief.trim(),
        brand_profile_snapshot: brandProfile,
        aspect_ratio: aspectRatio,
        aspectRatio,
        image_count: normalizedImageCount,
        imageCount: normalizedImageCount,
      }

      const response = await fetch(REMIX_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const rawText = await response.text()
      let result: any = {}
      try {
        result = rawText ? JSON.parse(rawText) : {}
      } catch (parseError) {
        console.error("Failed to parse generate response:", parseError, rawText)
        throw new Error("ผลการสร้างภาพไม่ถูกต้อง")
      }

      if (!response.ok) {
        throw new Error(result?.error || "สร้างภาพไม่สำเร็จ")
      }

      const rawEntries: any[] = Array.isArray(result)
        ? result
        : Array.isArray(result.images)
          ? result.images
          : result.image_url
            ? [{ url: result.image_url, source: result.provider || result.model }]
            : [result]

      const images = rawEntries.flatMap((entry) => normalizeImageEntries(entry))

      if (!images.length) {
        throw new Error("ไม่พบรูปภาพที่สร้างกลับมา")
      }

      const stamped = images.map((img, index) => ({
        id: `${Date.now()}-${index}`,
        url: img.url,
        source: img.source,
      }))

      setGeneratedImages((prev) => [...stamped, ...prev])
    } catch (error: any) {
      console.error("Reference remix failed:", error)
      setErrorMessage(error?.message || "เกิดข้อผิดพลาดในการสร้างภาพ")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownloadImage = async (url: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = `remix-${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error("Download failed:", error)
      setErrorMessage("ดาวน์โหลดรูปไม่สำเร็จ")
    }
  }

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
    } catch (error) {
      console.error("Copy failed:", error)
    }
  }

  const sanitizeColorValue = (value: string) => value.replace(/[^0-9a-fA-F]/g, "").substring(0, 6).toUpperCase()

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
        headers: { "Content-Type": "application/json" },
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
        prev.map((client) => (client.id === selectedClientId ? { ...client, colorPalette } : client)),
      )
      alert("บันทึกพาเลตสีเรียบร้อยแล้ว")
    } catch (error) {
      console.error("Failed to save color palette:", error)
      alert("เกิดข้อผิดพลาดในการบันทึกพาเลตสี")
    } finally {
      setIsSavingPalette(false)
    }
  }

  const brandInfoReady = Boolean(brandProfile) && !isLoadingProfile
  const loadReferenceLibrary = useCallback(async () => {
    try {
      setLoadingReferenceLibrary(true)
      const storageClient = getStorageClient()
      if (!storageClient) return

      const { data: files, error } = await storageClient.from("ads-creative-image").list("references/", {
        limit: 60,
        offset: 0,
        sortBy: { column: "name", order: "desc" },
      })

      if (error) {
        console.error("Error loading reference library:", error)
        return
      }

      if (!files?.length) {
        setReferenceLibrary([])
        return
      }

      const imagePromises = files.map(async (file) => {
        const { data: urlData } = storageClient.from("ads-creative-image").getPublicUrl(`references/${file.name}`)
        return {
          name: file.name,
          previewUrl: urlData.publicUrl,
          uploadedUrl: urlData.publicUrl,
          url: urlData.publicUrl,
          size: file.metadata?.size || 0,
          created_at: file.created_at || new Date().toISOString(),
        } satisfies ReferenceImage
      })

      const imageList = await Promise.all(imagePromises)
      setReferenceLibrary(
        imageList.sort((a, b) => new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime()),
      )
    } catch (error) {
      console.error("Failed to load reference library:", error)
    } finally {
      setLoadingReferenceLibrary(false)
    }
  }, [])

  useEffect(() => {
    loadReferenceLibrary()
  }, [loadReferenceLibrary])

  const handleReferenceLibraryUpload = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return
      const storageClient = getStorageClient()
      if (!storageClient) return
      setIsUploadingReferences(true)
      try {
        const uploads = await Promise.all(
          Array.from(files)
            .filter((file) => file.type.startsWith("image/"))
            .map(async (file) => {
              const fileExt = file.name.split(".").pop()
              const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`
              const fullPath = `references/${fileName}`
              const { error } = await storageClient.from("ads-creative-image").upload(fullPath, file)
              if (error) throw error
              const { data: urlData } = storageClient.from("ads-creative-image").getPublicUrl(fullPath)
              return {
                name: file.name,
                previewUrl: urlData.publicUrl,
                uploadedUrl: urlData.publicUrl,
                url: urlData.publicUrl,
                size: file.size,
                created_at: new Date().toISOString(),
              } satisfies ReferenceImage
            }),
        )

        if (uploads.length > 0) {
          setReferenceLibrary((prev) => [...uploads, ...prev])
          addReferencesToSelection(uploads.map((item) => item.url || ""))
        }
      } catch (error) {
        console.error("Failed to upload reference images:", error)
        alert("เกิดข้อผิดพลาดในการอัปโหลดรูปอ้างอิง")
      } finally {
        setIsUploadingReferences(false)
        if (referenceLibraryInputRef.current) {
          referenceLibraryInputRef.current.value = ""
        }
      }
    },
    [addReferencesToSelection],
  )

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setIsDragging(false)
      if (event.dataTransfer?.files?.length) {
        handleReferenceLibraryUpload(event.dataTransfer.files)
      }
    },
    [handleReferenceLibraryUpload],
  )

  const handlePasteEvent = useCallback(
    (event: ClipboardEvent) => {
      if (!dropzoneRef.current) return
      const target = event.target as Node | null
      if (target && !dropzoneRef.current.contains(target)) return
      if (event.clipboardData?.files?.length) {
        const imageList = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"))
        if (imageList.length) {
          event.preventDefault()
          const dataTransfer = new DataTransfer()
          imageList.forEach((file) => dataTransfer.items.add(file))
          handleReferenceLibraryUpload(dataTransfer.files)
        }
      }
    },
    [handleReferenceLibraryUpload],
  )

  useEffect(() => {
    window.addEventListener("paste", handlePasteEvent)
    return () => window.removeEventListener("paste", handlePasteEvent)
  }, [handlePasteEvent])

  const resolveReferenceSrc = useCallback(
    (url: string) => {
      const matched = referenceLibrary.find(
        (img) => img.url === url || img.uploadedUrl === url || img.previewUrl === url,
      )
      return matched?.previewUrl || url
    },
    [referenceLibrary],
  )

  const handleSelectReferenceFromLibrary = useCallback(
    (image: ReferenceImage) => {
      const url = image.url || image.uploadedUrl || image.previewUrl
      if (!url) return
      toggleReferenceSelection(url)
      setErrorMessage(null)
    },
    [toggleReferenceSelection],
  )

  return (
    <div className="space-y-6">
      <Card className="p-6 border-2 border-[#d1d1d6] shadow-sm bg-white space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center shadow">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-black">Remix ตาม Reference โดยตรง</h2>
              <p className="text-sm text-[#8e8e93]">ลาก/วาง หรือกด Ctrl + V เพื่อใส่รูปอ้างอิง แล้วเขียนบรีฟสั้น ๆ ให้ระบบทำภาพให้ตามนั้น</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-[#1d4ed8]">Beta</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-black mb-2">เลือกลูกค้า</p>
            <Select value={selectedClientId || undefined} onValueChange={handleClientSelection} disabled={loadingClients || clients.length === 0}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder={loadingClients ? "กำลังโหลด..." : "เลือก Client"} />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <div className="px-2 py-1 sticky top-0 bg-white z-10 border-b border-gray-100">
                  <Input
                    value={clientSearchTerm}
                    placeholder="ค้นหาชื่อลูกค้า..."
                    className="h-8 text-sm"
                    onChange={(event) => setClientSearchTerm(event.target.value)}
                    onKeyDown={(event) => event.stopPropagation()}
                  />
                </div>
                {filteredClients.length === 0 ? (
                  <SelectItem value="none" disabled>ไม่พบลูกค้า</SelectItem>
                ) : (
                  filteredClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.clientName}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-sm font-medium text-black mb-2">เลือก Product Focus</p>
            <Select
              value={selectedProductFocus || undefined}
              onValueChange={handleProductFocusSelection}
              disabled={!selectedClientId || availableProductFocuses.length === 0}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder={selectedClientId ? "เลือก Product Focus" : "กรุณาเลือกลูกค้าก่อน"} />
              </SelectTrigger>
              <SelectContent>
                {availableProductFocuses.length === 0 ? (
                  <SelectItem value="none" disabled>
                    ไม่มี Product Focus
                  </SelectItem>
                ) : (
                  availableProductFocuses.map((pf: { id: string; productFocus: string }) => (
                    <SelectItem key={pf.id || pf.productFocus} value={pf.productFocus}>
                      {pf.productFocus}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Card className="p-4 md:p-6 border border-[#e5e7eb] bg-white space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#8e8e93]">Step 1</p>
                <h3 className="text-lg font-semibold text-black">เพิ่มรูป Reference</h3>
                <p className="text-sm text-[#6c6c70]">ลากวาง, กด Ctrl+V หรือกดปุ่มเพื่ออัปโหลดไฟล์ JPG/PNG/WebP</p>
              </div>
              <Button variant="outline" size="sm" className="border-dashed" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                เพิ่มรูปภาพ
              </Button>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-[#f4f4f5] p-1 w-fit">
              {[
                { key: "upload", label: "อัปโหลดใหม่" },
                { key: "library", label: "เลือกจากคลัง" },
              ].map((tab) => {
                const isActive = referencePanelTab === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setReferencePanelTab(tab.key as "upload" | "library")}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      isActive ? "bg-white shadow text-black" : "text-[#8e8e93]"
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {referencePanelTab === "upload" ? (
            <div
              ref={dropzoneRef}
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={(event) => {
                const nextTarget = event.relatedTarget as Node | null
                if (!nextTarget || !dropzoneRef.current?.contains(nextTarget)) {
                  setIsDragging(false)
                }
              }}
              onDrop={handleDrop}
              className={`relative rounded-2xl border-2 border-dashed transition-colors p-6 text-center flex flex-col justify-center items-center min-h-[240px] ${
                isDragging ? "border-blue-500 bg-blue-50" : "border-[#d1d1d6] bg-[#f8f8fa]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => handleReferenceLibraryUpload(event.target.files)}
              />
              <div className="flex flex-col items-center gap-3 text-[#6c6c70]">
                <div className="w-16 h-16 rounded-2xl bg-white shadow flex items-center justify-center">
                  <ImageIcon className="w-7 h-7 text-[#1d4ed8]" />
                </div>
                <p className="text-base font-semibold text-black">ลากและวาง หรือกด Ctrl + V เพื่อวาง</p>
                <p className="text-sm max-w-xs">รูปภาพจะถูกเพิ่มเข้า “คลัง Reference” เพื่อเลือกใช้สูงสุด {MAX_REFERENCE_SELECTION} รูป</p>
                <Button variant="outline" className="border-[#1d4ed8] text-[#1d4ed8]" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  เลือกรูปภาพ
                </Button>
              </div>
              {isUploadingReferences && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              )}
            </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-black flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-blue-500" />
                      เลือกจากคลัง Reference
                    </p>
                    <p className="text-xs text-[#8e8e93]">แตะรูปเพื่อเลือกเป็น Reference สูงสุด {MAX_REFERENCE_SELECTION} รูป</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={referenceLibraryInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(event) => handleReferenceLibraryUpload(event.target.files)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => referenceLibraryInputRef.current?.click()}
                      disabled={isUploadingReferences}
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      {isUploadingReferences ? "กำลังอัปโหลด..." : "อัปโหลดภาพ"}
                    </Button>
                  </div>
                </div>
                {loadingReferenceLibrary ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  </div>
                ) : referenceLibrary.length > 0 ? (
                  <div className="max-h-96 overflow-y-auto pr-1">
                    <div className="grid grid-cols-3 gap-2">
                        {referenceLibrary.map((image: ReferenceImage) => {
                          const imageUrl = image.url || image.uploadedUrl || image.previewUrl
                          const isSelected = !!imageUrl && selectedReferences.includes(imageUrl)
                          const isDisabled = !isSelected && selectedReferences.length >= MAX_REFERENCE_SELECTION
                          return (
                            <button
                              key={imageUrl || image.name}
                              type="button"
                              disabled={isDisabled}
                              onClick={() => handleSelectReferenceFromLibrary(image)}
                              className={`relative h-20 w-full overflow-hidden rounded-lg border transition ${
                                isSelected ? "border-blue-500 ring-2 ring-blue-200" : "border-transparent"
                              } ${isDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
                            >
                              <Image src={image.previewUrl} alt={image.name || "Reference"} fill sizes="120px" className="object-cover" />
                              <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition" />
                              {isSelected && (
                                <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                  <div className="bg-blue-500 rounded-full p-2">
                                    <CheckCircle className="w-4 h-4 text-white" />
                                  </div>
                                </div>
                              )}
                            </button>
                          )
                        })}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 border border-dashed border-gray-300 rounded-lg text-center text-sm text-[#9ca3af]">
                    ยังไม่มีรูปในคลัง สามารถอัปโหลดจากแท็บด้านบน
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
              <p className="text-xs text-[#8e8e93] text-center">
                เลือกแล้ว {selectedReferences.length}/{MAX_REFERENCE_SELECTION} รูป
              </p>
                {selectedReferences.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {selectedReferences.map((url) => (
                      <div
                        key={url}
                        className="relative h-20 w-full overflow-hidden rounded-lg border border-blue-500 ring-2 ring-blue-200"
                      >
                        <Image src={resolveReferenceSrc(url)} alt="Selected reference" fill sizes="120px" className="object-cover" />
                        <button
                          type="button"
                          onClick={() => toggleReferenceSelection(url)}
                          className="absolute top-1 right-1 bg-white/80 rounded-full px-2 py-0.5 text-[10px] text-blue-600 hover:bg-white"
                        >
                          นำออก
                        </button>
                      </div>
                    ))}
                  </div>
                )}
            </div>

          </Card>

          <Card className="p-4 md:p-6 border border-[#e5e7eb] bg-white space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-[#8e8e93]">Step 2</p>
              <h3 className="text-lg font-semibold text-black">บรีฟ + ข้อมูลแบรนด์ (ไม่บังคับ)</h3>
              <p className="text-sm text-[#6c6c70] mb-3">อยากเน้นอะไรเพิ่มเติมก็พิมพ์ไว้ตรงนี้ หรือปล่อยว่างให้ระบบใช้ข้อมูลแบรนด์ก็ได้</p>
              <Textarea value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="บอก mood & tone, องค์ประกอบ, ข้อความ หรือสิ่งที่ต้องการ" className="min-h-[160px] bg-[#fdfdfd]" />
            </div>
            <div className="rounded-xl border border-[#e5e7f1] bg-[#f7f8fc] p-4 space-y-3">
              <p className="text-xs uppercase tracking-wide text-[#8e8e93]">Brand context</p>
              <p className="text-sm font-semibold text-black">ข้อมูลแบรนด์ล่าสุด</p>
              <p className="text-xs text-[#8e8e93]">{isLoadingProfile ? "กำลังโหลดข้อมูล..." : brandInfoReady ? "ใช้ข้อมูลอัตโนมัติจาก Business Profile" : "ยังไม่มีข้อมูลเพิ่มเติมสำหรับแบรนด์นี้"}</p>
              {brandInfoReady && (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {brandHighlights.map((highlight) => (
                    <div key={highlight.label} className="rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
                      <p className="text-[11px] uppercase tracking-wide text-[#9ca3af]">{highlight.label}</p>
                      <p className="text-[#111827]">{highlight.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        <Card className="p-4 md:p-6 border border-[#e5e7eb] bg-white space-y-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold text-black flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              ตั้งค่าการสร้างภาพ
            </h3>
            <p className="text-xs text-[#8e8e93]">
              เลือกอัตราส่วนและจำนวนภาพที่จะให้ระบบสร้างก่อนกดปุ่ม “สร้างภาพตามรีเฟอเรนซ์”
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#6c6c70] uppercase tracking-wide">อัตราส่วนภาพ</p>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger className="bg-white border-[#d1d1d6] focus:border-black focus:ring-0">
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
              <p className="text-[11px] text-[#a0a0a6]">ค่าเริ่มต้นคือ 1:1</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#6c6c70] uppercase tracking-wide">จำนวนภาพ</p>
              <Select value={String(imageCount)} onValueChange={(value) => setImageCount(Number(value))}>
                <SelectTrigger className="bg-white border-[#d1d1d6] focus:border-black focus:ring-0">
                  <SelectValue placeholder="เลือกจำนวนภาพ" />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_COUNT_OPTIONS.map((count) => (
                    <SelectItem key={count} value={String(count)}>
                      {count} ภาพ
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-[#a0a0a6]">สูงสุด 5 ภาพต่อครั้ง</p>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">

          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-black flex items-center gap-2">
                  <Upload className="w-4 h-4 text-purple-500" />วัสดุ / ภาพสินค้า
                </p>
                <p className="text-xs text-[#8e8e93]">อัปโหลดภาพสินค้า/โลโก้แล้วเลือกเพื่อนำไปใช้เป็นวัสดุ</p>
              </div>
              <div className="flex items-center gap-2">
                <input ref={materialInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => handleMaterialUpload(event.target.files)} />
                <Button variant="outline" size="sm" onClick={() => materialInputRef.current?.click()} disabled={isUploadingMaterials}>
                  <Upload className="w-4 h-4 mr-1" />{isUploadingMaterials ? "กำลังอัปโหลด..." : "อัปโหลดวัสดุ"}
                </Button>
              </div>
            </div>
            {loadingMaterialImages ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                <span className="ml-2 text-sm text-[#8e8e93]">กำลังโหลดวัสดุ...</span>
              </div>
            ) : materialImages.length > 0 ? (
              <div className="max-h-72 overflow-y-auto pr-1">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {materialImages.map((image: ReferenceImage) => {
                    const imageUrl = image.url || image.uploadedUrl || image.previewUrl
                    const isSelected = !!imageUrl && selectedMaterials.includes(imageUrl)
                    return (
                      <Card
                        key={imageUrl || image.name}
                        className={`group overflow-hidden cursor-pointer transition-all ${isSelected ? "ring-2 ring-purple-500 shadow-lg" : "hover:shadow-lg"}`}
                        onClick={() => imageUrl && handleMaterialToggle(imageUrl)}
                      >
                        <div className="relative aspect-square">
                          <Image src={image.previewUrl} alt={image.name || "Material"} fill sizes="150px" className="object-cover" />
                          {isSelected && (
                            <div className="absolute inset-0 bg-purple-500/30 flex items-center justify-center">
                              <div className="bg-purple-500 rounded-full p-2">
                                <CheckCircle className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="p-4 border border-dashed border-gray-300 rounded-lg text-center text-sm text-[#9ca3af]">ยังไม่มีวัสดุที่อัปโหลด เลือกไฟล์เพื่อเพิ่มภาพสินค้า</div>
            )}
            <div className="text-xs text-[#6d28d9]">
              {selectedMaterials.length > 0 ? `เลือกวัสดุแล้ว ${selectedMaterials.length} ภาพ` : "ยังไม่ได้เลือกวัสดุ (เลือกหรือไม่เลือกก็ได้)"}
            </div>
          </Card>

          {selectedClientId && (
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-black flex items-center gap-2">
                    <Palette className="w-4 h-4 text-purple-500" />พาเลตสีสำหรับแบรนด์
                  </p>
                  <p className="text-xs text-[#8e8e93]">เพิ่มสีที่ต้องการหรือบันทึกเป็นโทนหลักของลูกค้าคนนี้</p>
                </div>
              </div>
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
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleRemoveColor(index)}>
                        ลบ
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-[#8e8e93]">ยังไม่มีพาเลตสีที่บันทึกไว้</div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Input value={colorInput} onChange={(event) => setColorInput(event.target.value)} placeholder="ใส่โค้ดสี เช่น 265484 หรือ #265484" className="max-w-xs" />
                <Button variant="outline" onClick={handleAddColor}>เพิ่มสี</Button>
                <Button variant="ghost" asChild className="text-xs text-[#1d4ed8] hover:text-[#063def]">
                  <a href="https://coolors.co/image-picker" target="_blank" rel="noopener noreferrer">เปิด Image Picker</a>
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleSavePalette} disabled={isSavingPalette}>
                  {isSavingPalette ? "กำลังบันทึก..." : "บันทึกพาเลตสี"}
                </Button>
                <p className="text-xs text-[#8e8e93]">ระบบจะนำสีชุดนี้มาใช้แนะนำตอนสร้างภาพในครั้งต่อไป</p>
              </div>
            </Card>
          )}
        </div>
        {errorMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {errorMessage}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-[#6c6c70]">
            ระบบจะใช้ข้อมูลของ {resolvedClientName || "ลูกค้า"}{resolvedProductFocus ? ` - ${resolvedProductFocus}` : ""} ในการคุมโทน
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || selectedReferences.length === 0}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังสร้าง...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                สร้างภาพตามรีเฟอเรนซ์
              </>
            )}
          </Button>
        </div>

        {generatedImages.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-black">ผลลัพธ์ล่าสุด</h3>
              <span className="text-xs text-[#8e8e93]">คลิกเพื่อดูภาพเต็ม</span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {generatedImages.map((image: GeneratedImage) => (
                <Card key={image.id} className="overflow-hidden border-[#e5e7eb] bg-[#fdfdfd]">
                  <button
                    type="button"
                    className="relative w-full pb-[75%] bg-[#f3f4f6] cursor-pointer"
                    onClick={() => setPreviewImage(image.url)}
                  >
                    <Image src={image.url} alt="Generated result" fill sizes="200px" className="object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition">
                      <span className="text-white text-xs opacity-0 hover:opacity-100 transition">คลิกเพื่อขยาย</span>
                    </div>
                  </button>
                  <div className="flex items-center justify-between px-3 py-2">
                    <Badge variant="outline">{image.source ? image.source : "AI"}</Badge>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleDownloadImage(image.url)}>
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleCopyUrl(image.url)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </Card>
      <Dialog open={!!previewImage} onOpenChange={(open) => (!open ? setPreviewImage(null) : undefined)}>
        <DialogContent className="max-w-4xl w-[90vw]">
          <DialogHeader>
            <DialogTitle>ดูภาพเต็ม</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="relative w-full h-[70vh] bg-[#f3f4f6] rounded-xl overflow-hidden">
              <Image src={previewImage} alt="Full preview" fill sizes="100vw" className="object-contain bg-[#111]" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
