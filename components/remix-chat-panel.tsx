"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
  Download,
  Copy,
  CheckCircle,
  Check,
  Palette,
  Settings,
  Send,
  X,
  ChevronDown,
  ChevronUp,
  Plus,
  RotateCcw,
  User,
  Users,
  Building2,
  Globe,
  Target,
  Package,
  Info,
} from "lucide-react"

// ─── Types ───────────────────────────────────────────────

type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image"; url: string; isSelection?: boolean }

type ChatMessage = {
  id: string
  role: "user" | "model"
  parts: ChatContentPart[]
  timestamp: number
}

type ReferenceImage = {
  file?: File
  previewUrl: string
  uploadedUrl?: string
  name?: string
  size?: number
  created_at?: string
  url?: string
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

type ClientOption = {
  id: string
  clientName: string
  productFocuses: Array<{ id: string; productFocus: string }>
  colorPalette?: string[]
}

type RemixChatPanelProps = {
  activeClientId?: string | null
  activeClientName?: string | null
  activeProductFocus?: string | null
}

// ─── Constants ───────────────────────────────────────────────

const ASPECT_RATIO_OPTIONS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]
const DEFAULT_IMAGE_COUNT = 1
const MAX_REFERENCE_SELECTION = 5
const REMIX_WEBHOOK_URL =
  "https://n8n.srv934175.hstgr.cloud/webhook/44bffd94-9280-441a-a166-cdad46ab7981"

const SUGGESTED_PROMPTS = [
  "สร้างภาพโฆษณาตาม Reference ที่อัปโหลด",
  "รีมิกซ์ภาพนี้ให้เป็น mood ที่สดใส สว่าง",
  "ทำภาพโฆษณา style minimal ตามแบรนด์",
  "เปลี่ยนสีและ mood ตามพาเลตแบรนด์",
]

// ─── Helpers ────────────────────────────────────────────────

function getLastGeneratedImageUrl(msgs: ChatMessage[]): string | null {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === "model") {
      const imgPart = msgs[i].parts.find((p) => p.type === "image")
      if (imgPart && imgPart.type === "image") return imgPart.url
    }
  }
  return null
}

function getAllGeneratedImageUrls(msgs: ChatMessage[]): string[] {
  const urls: string[] = []
  for (const msg of msgs) {
    if (msg.role === "model") {
      msg.parts.forEach((part) => {
        if (part.type === "image") urls.push(part.url)
      })
    }
  }
  return urls
}

// Handle image selection for editing
function handleImageSelection(url: string, messages: ChatMessage[], setMessages: (msgs: ChatMessage[]) => void, setSelectedImage: (url: string) => void) {
  setSelectedImage(url)
  
  // Replace selection message with selected image
  const updatedMessages = messages.map(msg => {
    if (msg.id.startsWith('selection-')) {
      return {
        ...msg,
        parts: [
          { type: "text" as const, text: "เลือกรูปภาพนี้สำหรับแก้ไข:" },
          { type: "image" as const, url }
        ]
      }
    }
    return msg
  })
  setMessages(updatedMessages)
}

// ─── Component ───────────────────────────────────────────────

export function RemixChatPanel({
  activeClientId,
  activeClientName,
  activeProductFocus,
}: RemixChatPanelProps) {
  // Settings notification state
  const [showSettingsTooltip, setShowSettingsTooltip] = useState(true)
  const [settingsTooltipDismissed, setSettingsTooltipDismissed] = useState(false)

  // Auto-hide settings tooltip after 10 seconds
  useEffect(() => {
    if (showSettingsTooltip && !settingsTooltipDismissed) {
      const timer = setTimeout(() => {
        setShowSettingsTooltip(false)
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [showSettingsTooltip, settingsTooltipDismissed])

  // Get current settings summary for tooltip
  const getCurrentSettingsSummary = () => {
    const client = selectedClient || (activeClientId ? clients.find(c => c.id === activeClientId) : null)
    
    if (client) {
      return client.clientName
    }
    
    return 'No client selected'
  }

  // Phase state: "generate" = initial form, "chat" = editing via chat
  const [phase, setPhase] = useState<"generate" | "chat">("chat")

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState("")
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false)
  const [selectedImageForEditing, setSelectedImageForEditing] = useState<string>("")

  // Client / product state
  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientSearchTerm, setClientSearchTerm] = useState("")
  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [selectedProductFocus, setSelectedProductFocus] = useState<string>("")
  const [loadingClients, setLoadingClients] = useState(false)

  // Session state for general mode
  const [sessionMaterials, setSessionMaterials] = useState<ReferenceImage[]>([])
  const [sessionColors, setSessionColors] = useState<string[]>([])

  // Brand profile
  const [brandProfile, setBrandProfile] = useState<ClientProfileSummary | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)

  // Materials
  const [materialImages, setMaterialImages] = useState<ReferenceImage[]>([])
  const [loadingMaterialImages, setLoadingMaterialImages] = useState(false)
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([])
  const [isUploadingMaterials, setIsUploadingMaterials] = useState(false)
  const materialInputRef = useRef<HTMLInputElement | null>(null)

  // Colors
  const [colorPalette, setColorPalette] = useState<string[]>([])
  const [colorInput, setColorInput] = useState("")
  const [isSavingPalette, setIsSavingPalette] = useState(false)

  // Aspect ratio
  const [aspectRatio, setAspectRatio] = useState<string>(ASPECT_RATIO_OPTIONS[0])

  // Reference library
  const [referenceLibrary, setReferenceLibrary] = useState<ReferenceImage[]>([])
  const [loadingReferenceLibrary, setLoadingReferenceLibrary] = useState(false)
  const [isUploadingReferences, setIsUploadingReferences] = useState(false)

  // Preview dialog
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // Refs
  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const chatContainerRef = useRef<HTMLDivElement | null>(null)

  // ─── Derived state ─────────────────────────────────────────

  const selectedClient = useMemo(() => {
    if (!selectedClientId) return null
    if (selectedClientId === "general") return { id: "general", clientName: "โหมดทั่วไป" } as any
    return clients.find((c) => c.id === selectedClientId) || null
  }, [clients, selectedClientId])

  const filteredClients = useMemo(() => {
    if (!clientSearchTerm.trim()) return clients
    const q = clientSearchTerm.toLowerCase()
    return clients.filter((c) => c.clientName.toLowerCase().includes(q))
  }, [clients, clientSearchTerm])

  const resolvedClientName =
    selectedClient?.clientName || activeClientName || "No Client Selected"
  const resolvedProductFocus =
    selectedProductFocus || activeProductFocus || selectedClient?.productFocuses[0]?.productFocus || ""
  const availableProductFocuses = selectedClient?.productFocuses || []

  const brandHighlights = useMemo(() => {
    if (!brandProfile) return []
    const highlights: Array<{ label: string; value: string }> = []
    if (brandProfile.productFocus) highlights.push({ label: "Product Focus", value: brandProfile.productFocus })
    if (brandProfile.usp) highlights.push({ label: "USP", value: brandProfile.usp })
    if (brandProfile.specialty) highlights.push({ label: "Specialty", value: brandProfile.specialty })
    if (brandProfile.services) {
      highlights.push({
        label: "Services",
        value: brandProfile.services.split(",").map((s) => s.trim()).filter(Boolean).join(", "),
      })
    }
    if (brandProfile.strengths) highlights.push({ label: "Strengths", value: brandProfile.strengths })
    if (brandProfile.weaknesses) highlights.push({ label: "Weaknesses", value: brandProfile.weaknesses })
    if (brandProfile.pricing) highlights.push({ label: "Pricing", value: brandProfile.pricing })
    return highlights
  }, [brandProfile])

  const brandInfoReady = Boolean(brandProfile) && !isLoadingProfile

  const filteredMessages = useMemo(
    () =>
      messages.filter(
        (msg) =>
          !(
            msg.role === "model" &&
            msg.parts.some(
              (part) => part.type === "text" && part.text === "สวัสดีครับ! ยินดีต้อนรับเข้าสู่ Remix Chat",
            )
          ),
      ),
    [messages],
  )

  // ─── Load clients ──────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingClients(true)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ""
        const res = await fetch(`${baseUrl}/api/clients-with-product-focus`)
        const data = await res.json()
        if (Array.isArray(data)) {
          setClients(data)
          if (!selectedClientId && data.length > 0) {
            const target = data.find((c: ClientOption) => c.id === activeClientId) || data[0]
            setSelectedClientId(target.id)
            const pf =
              target.productFocuses.find((p: { productFocus: string }) => p.productFocus === activeProductFocus)?.productFocus ||
              target.productFocuses[0]?.productFocus || ""
            setSelectedProductFocus(pf)
          }
        }
      } catch (err) {
        console.error("Failed to load clients:", err)
      } finally {
        setLoadingClients(false)
      }
    }
    load()
  }, [activeClientId, activeProductFocus])

  // Start in chat mode by default
  useEffect(() => {
    setPhase("chat")
  }, [])

  // Sync from parent props
  useEffect(() => {
    if (!clients.length || !activeClientId) return
    const target = clients.find((c) => c.id === activeClientId)
    if (target) {
      setSelectedClientId(target.id)
      const pf =
        target.productFocuses.find((p) => p.productFocus === activeProductFocus)?.productFocus ||
        target.productFocuses[0]?.productFocus || ""
      setSelectedProductFocus(pf)
    }
  }, [clients, activeClientId, activeProductFocus])

  // ─── Load brand profile ────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    const fetch_ = async () => {
      if (!selectedClientId) { setBrandProfile(null); return }
      try {
        setIsLoadingProfile(true)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ""
        const res = await fetch(`${baseUrl}/api/client-profile?clientId=${encodeURIComponent(selectedClientId)}`)
        if (!res.ok) throw new Error("Failed")
        const data = await res.json()
        if (!cancelled) setBrandProfile(data?.client || null)
      } catch {
        if (!cancelled) setBrandProfile(null)
      } finally {
        if (!cancelled) setIsLoadingProfile(false)
      }
    }
    fetch_()
    return () => { cancelled = true }
  }, [selectedClientId])

  // ─── Load materials ────────────────────────────────────────

  const loadMaterialImages = useCallback(async (clientId: string) => {
    try {
      setLoadingMaterialImages(true)
      const storage = getStorageClient()
      if (!storage) { setMaterialImages([]); setSelectedMaterials([]); return }
      const { data: files, error } = await storage.from("ads-creative-image").list(`materials/${clientId}`, {
        limit: 60, offset: 0, sortBy: { column: "name", order: "desc" },
      })
      if (error) {
        if (error.message?.toLowerCase().includes("not found")) { setMaterialImages([]); setSelectedMaterials([]); return }
        return
      }
      if (!files?.length) { setMaterialImages([]); setSelectedMaterials([]); return }
      const images = await Promise.all(
        files.map(async (f) => {
          const { data: u } = storage.from("ads-creative-image").getPublicUrl(`materials/${clientId}/${f.name}`)
          return { name: f.name, previewUrl: u.publicUrl, uploadedUrl: u.publicUrl, url: u.publicUrl, size: f.metadata?.size || 0, created_at: f.created_at || new Date().toISOString() } satisfies ReferenceImage
        }),
      )
      const sorted = images.sort((a, b) => new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime())
      setMaterialImages(sorted)
      setSelectedMaterials((prev) => prev.filter((url) => sorted.some((img) => (img.url || img.uploadedUrl) === url)))
    } catch (err) {
      console.error("Failed to load materials:", err)
    } finally {
      setLoadingMaterialImages(false)
    }
  }, [])

  useEffect(() => {
    if (selectedClientId) loadMaterialImages(selectedClientId)
    else { setMaterialImages([]); setSelectedMaterials([]) }
  }, [selectedClientId, loadMaterialImages])

  // ─── Load color palette from client ────────────────────────

  useEffect(() => {
    const c = clients.find((cl) => cl.id === selectedClientId)
    setColorPalette(c?.colorPalette || [])
  }, [selectedClientId, clients])

  // ─── Load reference library ────────────────────────────────

  const loadReferenceLibrary = useCallback(async () => {
    try {
      setLoadingReferenceLibrary(true)
      const storage = getStorageClient()
      if (!storage) return
      const { data: files, error } = await storage.from("ads-creative-image").list("references/", {
        limit: 60, offset: 0, sortBy: { column: "name", order: "desc" },
      })
      if (error || !files?.length) { setReferenceLibrary([]); return }
      const images = await Promise.all(
        files.map(async (f) => {
          const { data: u } = storage.from("ads-creative-image").getPublicUrl(`references/${f.name}`)
          return { name: f.name, previewUrl: u.publicUrl, uploadedUrl: u.publicUrl, url: u.publicUrl, size: f.metadata?.size || 0, created_at: f.created_at || new Date().toISOString() } satisfies ReferenceImage
        }),
      )
      setReferenceLibrary(images.sort((a, b) => new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime()))
    } catch (err) {
      console.error("Failed to load reference library:", err)
    } finally {
      setLoadingReferenceLibrary(false)
    }
  }, [])

  useEffect(() => { loadReferenceLibrary() }, [loadReferenceLibrary])

  // ─── Scroll to bottom ──────────────────────────────────────

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isGenerating])

  // ─── Auto-resize textarea ──────────────────────────────────

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 120) + "px"
  }, [inputText])

  // ─── Client selection handlers ─────────────────────────────

  const handleClientSelection = useCallback((value: string) => {
    setSelectedClientId(value)
    setClientSearchTerm("")
    if (value === "general") {
      setSelectedProductFocus("")
    } else {
      const target = clients.find((c) => c.id === value)
      setSelectedProductFocus(target?.productFocuses[0]?.productFocus || "")
    }
    setClientDropdownOpen(false)
  }, [clients])

  const handleProductFocusSelection = useCallback((value: string) => {
    setSelectedProductFocus(value)
  }, [])

  // ─── Material handlers ─────────────────────────────────────

  const handleMaterialToggle = useCallback((url: string) => {
    setSelectedMaterials((prev) => prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url])
  }, [])

  const handleMaterialUpload = useCallback(async (files: FileList | null) => {
    if (!files || !selectedClientId) { alert("กรุณาเลือกโหมดก่อนอัปโหลดวัสดุ"); return }
    
    setIsUploadingMaterials(true)
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue
        
        if (selectedClientId === "general") {
          // Session mode - store in local state
          const reader = new FileReader()
          reader.onload = (e) => {
            const newMaterial: ReferenceImage = {
              name: file.name,
              previewUrl: e.target?.result as string,
              uploadedUrl: e.target?.result as string,
              url: e.target?.result as string,
              size: file.size,
              created_at: new Date().toISOString()
            }
            setSessionMaterials(prev => [...prev, newMaterial])
          }
          reader.readAsDataURL(file)
        } else {
          // Database mode - store in Supabase
          const storage = getStorageClient()
          if (!storage) { alert("ไม่สามารถเชื่อมต่อที่จัดเก็บไฟล์ได้"); return }
          const ext = file.name.split(".").pop()
          const name = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`
          const { error } = await storage.from("ads-creative-image").upload(`materials/${selectedClientId}/${name}`, file)
          if (error) throw error
          await loadMaterialImages(selectedClientId)
        }
      }
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการอัปโหลดวัสดุ")
    } finally {
      setIsUploadingMaterials(false)
      if (materialInputRef.current) materialInputRef.current.value = ""
    }
  }, [loadMaterialImages, selectedClientId])

  // ─── Color palette handlers ────────────────────────────────

  const sanitizeColor = (v: string) => v.replace(/[^0-9a-fA-F]/g, "").substring(0, 6).toUpperCase()

  const handleAddColor = () => {
    const s = sanitizeColor(colorInput)
    if (!s) { alert("กรุณากรอกโค้ดสีที่ถูกต้อง"); return }
    if (!colorPalette.includes(s)) setColorPalette((prev) => [...prev, s])
    setColorInput("")
  }

  const handleRemoveColor = (index: number) => {
    setColorPalette((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSavePalette = async () => {
    if (!selectedClientId) { alert("กรุณาเลือกลูกค้าก่อน"); return }
    setIsSavingPalette(true)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ""
      const res = await fetch(`${baseUrl}/api/update-client-color`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: selectedClientId, colorPalette }),
      })
      const result = await res.json()
      if (!res.ok || !result.success) { alert(result?.error || "ไม่สามารถบันทึกพาเลตสีได้"); return }
      setClients((prev) => prev.map((c) => c.id === selectedClientId ? { ...c, colorPalette } : c))
      alert("บันทึกพาเลตสีเรียบร้อยแล้ว")
    } catch {
      alert("เกิดข้อผิดพลาดในการบันทึกพาเลตสี")
    } finally {
      setIsSavingPalette(false)
    }
  }

  // ─── Reference upload ──────────────────────────────────────

  const handleReferenceUpload = useCallback(async (files: FileList | null) => {
    if (!files?.length) return
    const storage = getStorageClient()
    if (!storage) return
    setIsUploadingReferences(true)
    try {
      const uploads = await Promise.all(
        Array.from(files).filter((f) => f.type.startsWith("image/")).map(async (file) => {
          const ext = file.name.split(".").pop()
          const name = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`
          const path = `references/${name}`
          const { error } = await storage.from("ads-creative-image").upload(path, file)
          if (error) throw error
          const { data: u } = storage.from("ads-creative-image").getPublicUrl(path)
          return u.publicUrl
        }),
      )
      if (uploads.length) {
        setPendingImages((prev) => {
          const next = [...prev]
          uploads.forEach((url) => {
            if (url && !next.includes(url) && next.length < MAX_REFERENCE_SELECTION) next.push(url)
          })
          return next
        })
        loadReferenceLibrary()
      }
    } catch {
      alert("เกิดข้อผิดพลาดในการอัปโหลดรูปอ้างอิง")
    } finally {
      setIsUploadingReferences(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }, [loadReferenceLibrary])

  const removePendingImage = useCallback((url: string) => {
    setPendingImages((prev) => prev.filter((u) => u !== url))
  }, [])

  // ─── Library reference toggle (for generation form) ────────

  const handleLibraryRefToggle = useCallback((url: string) => {
    setPendingImages((prev) =>
      prev.includes(url)
        ? prev.filter((u) => u !== url)
        : prev.length < MAX_REFERENCE_SELECTION
          ? [...prev, url]
          : prev
    )
  }, [])

  // ─── Paste handler ─────────────────────────────────────────

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (!e.clipboardData?.files?.length) return
      const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"))
      if (imgs.length) {
        e.preventDefault()
        const dt = new DataTransfer()
        imgs.forEach((f) => dt.items.add(f))
        handleReferenceUpload(dt.files)
      }
    }
    window.addEventListener("paste", handler)
    return () => window.removeEventListener("paste", handler)
  }, [handleReferenceUpload])

  // ─── Prompt builder ────────────────────────────────────────

  const buildPrompt = (briefText: string) => {
    const parts = [
      resolvedClientName ? `แบรนด์: ${resolvedClientName}` : null,
      resolvedProductFocus ? `สินค้า/บริการ: ${resolvedProductFocus}` : null,
      brandProfile?.usp ? `USP: ${brandProfile.usp}` : null,
      brandProfile?.specialty ? `Specialty: ${brandProfile.specialty}` : null,
      brandProfile?.strengths ? `Strengths: ${brandProfile.strengths}` : null,
    ].filter(Boolean)

    return [
      "สร้างรูปภาพโฆษณาตามรูปแบบและองค์ประกอบของรูปอ้างอิงที่ให้ไว้",
      parts.length ? `ข้อมูลแบรนด์:\n${parts.join("\n")}` : null,
      briefText ? `บรีฟเพิ่มเติม: ${briefText.trim()}` : null,
    ].filter(Boolean).join("\n\n")
  }

  // ─── Image extraction helpers ──────────────────────────────

  const isPlainObject = (v: any): v is Record<string, any> =>
    Boolean(v) && typeof v === "object" && !Array.isArray(v)

  const extractDirectPairs = (v: any): Array<{ url: string; source?: string }> => {
    if (!isPlainObject(v)) return []
    return Object.entries(v)
      .filter(([, val]) => typeof val === "string")
      .map(([key, url]) => ({ url: url as string, source: key }))
  }

  const extractImageEntries = (payload: any): Array<{ url: string; source?: string }> => {
    const entries: Array<{ url: string; source?: string }> = []
    const seen = new Set<string>()
    const add = (url?: string, source?: string) => {
      if (!url || seen.has(url) || !url.trim()) return
      seen.add(url)
      entries.push({ url, source })
    }
    const visit = (value: any, hint?: string) => {
      if (!value) return
      if (typeof value === "string") { add(value, hint); return }
      if (Array.isArray(value)) { value.forEach((item, i) => visit(item, typeof item === "string" ? hint ?? `Image ${i + 1}` : undefined)); return }
      if (typeof value === "object") {
        const src = typeof value.source === "string" ? value.source : typeof value.provider === "string" ? value.provider : undefined
        visit(value.url || value.image_url, src ?? hint)
        Object.entries(value).forEach(([k, v]) => {
          if (["url", "image_url", "source", "provider"].includes(k)) return
          visit(v, typeof v === "string" ? k : hint)
        })
      }
    }
    visit(payload)
    return entries
  }

  // ─── Core webhook call ─────────────────────────────────────

  const callRemixWebhook = async (referenceUrls: string[], briefText: string, isEdit: boolean = false): Promise<string[]> => {
    const prompt = buildPrompt(briefText)
    const payload = {
      prompt,
      reference_image_url: referenceUrls[0] || null,
      reference_image_urls: referenceUrls,
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
      brief_text: briefText,
      brand_profile_snapshot: brandProfile,
      aspect_ratio: aspectRatio,
      aspectRatio,
      image_count: DEFAULT_IMAGE_COUNT,
      imageCount: DEFAULT_IMAGE_COUNT,
      // Add edit flag to payload
      ...(isEdit && { request_type: "edit image" })
    }

    const res = await fetch(REMIX_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const rawText = await res.text()
    let result: any = {}
    try { result = rawText ? JSON.parse(rawText) : {} } catch {
      throw new Error("ผลการสร้างภาพไม่ถูกต้อง")
    }

    if (!res.ok) throw new Error(result?.error || "สร้างภาพไม่สำเร็จ")

    const directCandidate = Array.isArray(result)
      ? result
      : Array.isArray(result?.images) ? result.images : null

    const directImages =
      directCandidate && directCandidate.every((e: any) => isPlainObject(e))
        ? directCandidate.flatMap((entry: any, i: number) => {
            const pairs = extractDirectPairs(entry)
            if (pairs.length) return pairs
            const fb = typeof entry === "string" ? entry : null
            return fb ? [{ url: fb, source: `Version ${i + 1}` }] : []
          })
        : []

    const extracted = directImages.length > 0 ? directImages : extractImageEntries(result)

    if (!extracted.length) throw new Error("ไม่พบรูปภาพที่สร้างกลับมา")

    return extracted.map((img: { url: string }) => img.url)
  }

  // ─── Add model message helper ──────────────────────────────

  const addModelMessage = (parts: ChatContentPart[]) => {
    const msg: ChatMessage = {
      id: `model-${Date.now()}`,
      role: "model",
      parts,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, msg])
  }

  // ─── Phase 1: Initial generate ─────────────────────────────

  const handleGenerate = async () => {
    const text = inputText.trim()
    const images = [...pendingImages]

    if (!selectedClientId || !resolvedProductFocus || !resolvedClientName || resolvedClientName === "No Client Selected") {
      alert("⚠️ Please select a client and product focus above before generating images")
      return
    }

    if (images.length === 0) {
      alert("กรุณาเลือกรูป Reference อย่างน้อย 1 รูป")
      return
    }

    // Text is optional - user can generate images with just reference images

    // Build user message
    const userParts: ChatContentPart[] = []
    images.forEach((url) => userParts.push({ type: "image", url }))
    if (text) userParts.push({ type: "text", text })

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      parts: userParts,
      timestamp: Date.now(),
    }

    // Transition to chat phase immediately
    setMessages([userMsg])
    setPhase("chat")
    setInputText("")
    setPendingImages([])
    setIsGenerating(true)

    try {
      const generatedUrls = await callRemixWebhook(images, text)
      
      // Add generated images directly to chat
      if (generatedUrls.length > 0) {
        const modelParts: ChatContentPart[] = generatedUrls.map((url) => ({
          type: "image" as const,
          url,
        }))
        addModelMessage(modelParts)
        
        // Automatically set the first generated image as the reference for editing
        setSelectedImageForEditing(generatedUrls[0])
      }
    } catch (err: any) {
      console.error("Generate failed:", err)
      addModelMessage([{ type: "text", text: err?.message || "เกิดข้อผิดพลาดในการสร้างภาพ" }])
    } finally {
      setIsGenerating(false)
    }
  }

  // ─── Phase 2: Chat edit send ───────────────────────────────

  const handleChatSend = async () => {
    const text = inputText.trim()
    if (!text && pendingImages.length === 0) return

    if (!selectedClientId || !resolvedProductFocus || !resolvedClientName || resolvedClientName === "No Client Selected") {
      addModelMessage([{ type: "text", text: "⚠️ Please select a client and product focus above before sending messages" }])
      return
    }

    // Require image selection before allowing chat editing
    if (!selectedImageForEditing) {
      addModelMessage([{ type: "text", text: "กรุณาเลือกรูปภาพที่ต้องการแก้ไขก่อนส่งข้อความ" }])
      return
    }

    // Determine references for webhook:
    // Always use the selected image for editing
    const webhookRefs = pendingImages.length > 0 
      ? [...pendingImages] 
      : [selectedImageForEditing]

    if (webhookRefs.length === 0) {
      addModelMessage([{ type: "text", text: "ไม่พบรูปภาพอ้างอิง กรุณาแนบรูปใหม่หรือเริ่มแชทใหม่" }])
      return
    }

    // Build user message (only show explicitly attached images + text)
    const userParts: ChatContentPart[] = []
    if (pendingImages.length > 0) {
      pendingImages.forEach((url) => userParts.push({ type: "image", url }))
    }
    if (text) userParts.push({ type: "text", text })

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      parts: userParts,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, userMsg])

    setInputText("")
    setPendingImages([])
    setIsGenerating(true)

    try {
      const generatedUrls = await callRemixWebhook(webhookRefs, text, true)
      const modelParts: ChatContentPart[] = generatedUrls.map((url) => ({
        type: "image" as const,
        url,
      }))
      addModelMessage(modelParts)
      
      // Automatically set the first generated image as the new reference for continuous editing
      if (generatedUrls.length > 0) {
        setSelectedImageForEditing(generatedUrls[0])
      }
    } catch (err: any) {
      console.error("Edit failed:", err)
      addModelMessage([{ type: "text", text: err?.message || "เกิดข้อผิดพลาดในการแก้ไขภาพ" }])
    } finally {
      setIsGenerating(false)
    }
  }

  // ─── Download / Copy helpers ───────────────────────────────

  const handleDownload = async (url: string) => {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const dl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = dl
      a.download = `remix-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(dl)
    } catch {
      console.error("Download failed")
    }
  }

  const handleCopyUrl = async (url: string) => {
    try { await navigator.clipboard.writeText(url) } catch {}
  }

  // ─── New Chat ──────────────────────────────────────────────

  const handleNewChat = () => {
    setMessages([])
    setInputText("")
    setPendingImages([])
    setIsGenerating(false)
    setPhase("generate")
    setSettingsOpen(false)
  }

  // ─── Keyboard handler ─────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (!isGenerating && phase === "chat") handleChatSend()
    }
  }

  // ─── Render helpers ────────────────────────────────────────

  const hasModelResponse = messages.some((m) => m.role === "model" && m.parts.some((p) => p.type === "image"))
  const loadingText = hasModelResponse ? "กำลังแก้ไขภาพ..." : "กำลังสร้างภาพ..."

  // ─── Settings section (shared between inline form & drawer) ─

  const renderSettings = () => {
    return (
      <div className="space-y-6">
        {/* Client Selection Section */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#1c1c1e]">ลูกค้า</h3>
                <p className="text-xs text-[#6b7280]">ไม่จำเป็น • เลือกเพื่อจัดระเบียบ</p>
              </div>
            </div>
            {selectedClientId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedClientId("")
                  setSelectedProductFocus("")
                  setClientSearchTerm("")
                } }
                className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <X className="w-3 h-3 mr-1" />
                ล้าง
              </Button>
            )}
          </div>

          <div className="relative">
            <Input
              value={selectedClient?.clientName || ""}
              placeholder="เลือกลูกค้าหรือใช้โหมดทั่วไป"
              className="w-full h-9 text-sm bg-white border-blue-200 focus:border-blue-400"
              onFocus={() => setClientDropdownOpen(true)}
              onChange={(e) => {
                setClientSearchTerm(e.target.value)
                setClientDropdownOpen(true)
              } }
              onKeyDown={(e) => {
                if (e.key === "Escape") setClientDropdownOpen(false)
              } } />
            {clientDropdownOpen && (
              <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white border border-blue-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                <div className="px-3 py-2 sticky top-0 bg-white z-10 border-b border-blue-100">
                  <Input
                    value={clientSearchTerm}
                    placeholder="ค้นหาลูกค้า..."
                    className="h-8 text-sm"
                    onChange={(e) => setClientSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setClientDropdownOpen(false)
                    } } />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClientId("general")
                    setSelectedProductFocus("")
                    setClientSearchTerm("")
                    setClientDropdownOpen(false)
                  } }
                  className="w-full px-4 py-3 text-left text-sm hover:bg-blue-50 transition-colors border-b border-blue-100 flex items-center gap-2"
                >
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                    <Globe className="w-3 h-3 text-gray-600" />
                  </div>
                  <div>
                    <div className="font-medium">โหมดทั่วไป</div>
                    <div className="text-xs text-gray-500">ใช้ session ปัจจุบัน</div>
                  </div>
                </button>
                {filteredClients.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">ไม่พบลูกค้า</div>
                ) : (
                  filteredClients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleClientSelection(c.id)}
                      className="w-full px-4 py-3 text-left text-sm hover:bg-blue-50 transition-colors flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{c.clientName}</div>
                        <div className="text-xs text-gray-500">{c.productFocuses.length} products</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Product Focus - only show if client selected and not general mode */}
        {selectedClientId && selectedClientId !== "" && selectedClientId !== "general" && (
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
                <Target className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#1c1c1e]">Product Focus</h3>
                <p className="text-xs text-[#6b7280]">เลือกประเภทสินค้า</p>
              </div>
            </div>
            <Select value={selectedProductFocus || undefined} onValueChange={handleProductFocusSelection}>
              <SelectTrigger className="w-full h-9 text-sm bg-white border-gray-200 focus:border-purple-400">
                <SelectValue placeholder="เลือก Product Focus" />
              </SelectTrigger>
              <SelectContent>
                {availableProductFocuses.length === 0 ? (
                  <SelectItem value="none" disabled>ไม่มี Product Focus</SelectItem>
                ) : (
                  availableProductFocuses.map((pf: any) => (
                    <SelectItem key={pf.id || pf.productFocus} value={pf.productFocus}>{pf.productFocus}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Image Settings */}
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#1c1c1e]">การตั้งค่าภาพ</h3>
              <p className="text-xs text-[#6b7280]">อัตราส่วนและขนาด</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">อัตราส่วนภาพ</label>
              <div className="grid grid-cols-3 gap-2">
                {ASPECT_RATIO_OPTIONS.map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setAspectRatio(ratio)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${aspectRatio === ratio
                        ? "bg-green-500 text-white border-green-500 shadow-sm"
                        : "bg-white text-gray-700 border-gray-200 hover:border-green-300 hover:bg-green-50"}`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Materials - show for any selected client including general mode */}
        {selectedClientId && selectedClientId !== "" && (
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
                  <Package className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#1c1c1e]">วัสดุอ้างอิง</h3>
                  <p className="text-xs text-[#6b7280]">ภาพสินค้าและวัสดุ</p>
                </div>
              </div>
              <input ref={materialInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleMaterialUpload(e.target.files)} />
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-orange-200 text-orange-600 hover:bg-orange-50"
                onClick={() => materialInputRef.current?.click()}
                disabled={isUploadingMaterials}
              >
                <Upload className="w-3 h-3 mr-1" />
                {isUploadingMaterials ? "กำลัง..." : "อัปโหลด"}
              </Button>
            </div>

            {selectedClientId === "general" ? (
              // General mode - show session materials
              sessionMaterials.length > 0 ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto p-2 bg-gray-50 rounded-lg">
                    {sessionMaterials.map((img) => {
                      const url = img.url || img.uploadedUrl || img.previewUrl
                      const selected = !!url && selectedMaterials.includes(url)
                      return (
                        <button
                          key={url || img.name}
                          type="button"
                          onClick={() => url && handleMaterialToggle(url)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${selected ? "border-orange-500 ring-2 ring-orange-200 shadow-sm" : "border-gray-200 hover:border-orange-300"}`}
                        >
                          <Image src={img.previewUrl} alt={img.name || "Material"} fill sizes="80px" className="object-cover" />
                          {selected && (
                            <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-center">
                              <CheckCircle className="w-5 h-5 text-orange-500" />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  {selectedMaterials.length > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-orange-600 font-medium">เลือกแล้ว {selectedMaterials.length} ภาพ</span>
                      <button
                        onClick={() => setSelectedMaterials([])}
                        className="text-gray-500 hover:text-red-500"
                      >
                        ล้างทั้งหมด
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
                  <Package className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">ยังไม่มีวัสดุ</p>
                  <p className="text-xs text-gray-400 mt-1">อัปโหลดภาพสินค้าเพื่อเริ่มใช้งาน</p>
                </div>
              )
            ) : (
              // Client mode - show database materials
              loadingMaterialImages ? (
                <div className="flex items-center justify-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
                  <Loader2 className="w-5 h-5 animate-spin text-orange-500 mr-2" />
                  <span className="text-sm text-gray-500">กำลังโหลดวัสดุ...</span>
                </div>
              ) : materialImages.length > 0 ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto p-2 bg-gray-50 rounded-lg">
                    {materialImages.map((img) => {
                      const url = img.url || img.uploadedUrl || img.previewUrl
                      const selected = !!url && selectedMaterials.includes(url)
                      return (
                        <button
                          key={url || img.name}
                          type="button"
                          onClick={() => url && handleMaterialToggle(url)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${selected ? "border-orange-500 ring-2 ring-orange-200 shadow-sm" : "border-gray-200 hover:border-orange-300"}`}
                        >
                          <Image src={img.previewUrl} alt={img.name || "Material"} fill sizes="80px" className="object-cover" />
                          {selected && (
                            <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-center">
                              <CheckCircle className="w-5 h-5 text-orange-500" />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  {selectedMaterials.length > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-orange-600 font-medium">เลือกแล้ว {selectedMaterials.length} ภาพ</span>
                      <button
                        onClick={() => setSelectedMaterials([])}
                        className="text-gray-500 hover:text-red-500"
                      >
                        ล้างทั้งหมด
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
                  <Package className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">ยังไม่มีวัสดุ</p>
                  <p className="text-xs text-gray-400 mt-1">อัปโหลดภาพสินค้าเพื่อเริ่มใช้งาน</p>
                </div>
              ))}
          </div>
        )}

        {/* Color palette - show for any selected client including general mode */}
        {selectedClientId && selectedClientId !== "" && (
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-pink-500 flex items-center justify-center">
                <Palette className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#1c1c1e]">พาเลตสี</h3>
                <p className="text-xs text-[#6b7280]">สีของแบรนด์</p>
              </div>
            </div>
            {selectedClientId === "general" ? (
              // General mode - show session colors
              sessionColors.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {sessionColors.map((color: string, i: number) => (
                      <div key={`${color}-${i}`} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                        <div className="w-6 h-6 rounded-md border-2 border-gray-300" style={{ backgroundColor: `#${color}` }} />
                        <span className="text-sm font-medium text-gray-700">#{color}</span>
                        <button
                          type="button"
                          onClick={() => setSessionColors(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <Input
                      value={colorInput}
                      onChange={(e) => setColorInput(e.target.value)}
                      placeholder="เช่น FF5733"
                      className="h-8 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const sanitized = colorInput.replace(/[^0-9a-fA-F]/g, "").substring(0, 6).toUpperCase()
                          if (sanitized) setSessionColors(prev => [...prev, sanitized])
                          setColorInput("")
                        }
                      } } />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-sm border-pink-200 text-pink-600 hover:bg-pink-50"
                      onClick={() => {
                        const sanitized = colorInput.replace(/[^0-9a-fA-F]/g, "").substring(0, 6).toUpperCase()
                        if (sanitized) setSessionColors(prev => [...prev, sanitized])
                        setColorInput("")
                      } }
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      เพิ่ม
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-center py-4 border-2 border-dashed border-gray-200 rounded-lg">
                    <Palette className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">ยังไม่มีสี</p>
                    <p className="text-xs text-gray-400 mt-1">เพิ่มสีสำหรับ session นี้</p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <Input
                      value={colorInput}
                      onChange={(e) => setColorInput(e.target.value)}
                      placeholder="เช่น FF5733"
                      className="h-8 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const sanitized = colorInput.replace(/[^0-9a-fA-F]/g, "").substring(0, 6).toUpperCase()
                          if (sanitized) setSessionColors(prev => [...prev, sanitized])
                          setColorInput("")
                        }
                      } } />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-sm border-pink-200 text-pink-600 hover:bg-pink-50"
                      onClick={() => {
                        const sanitized = colorInput.replace(/[^0-9a-fA-F]/g, "").substring(0, 6).toUpperCase()
                        if (sanitized) setSessionColors(prev => [...prev, sanitized])
                        setColorInput("")
                      } }
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      เพิ่ม
                    </Button>
                  </div>
                </div>
              )
            ) : (
              // Client mode - show database colors
              colorPalette.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {colorPalette.map((color: string, i: number) => (
                      <div key={`${color}-${i}`} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                        <div className="w-6 h-6 rounded-md border-2 border-gray-300" style={{ backgroundColor: `#${color}` }} />
                        <span className="text-sm font-medium text-gray-700">#{color}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveColor(i)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <Input
                      value={colorInput}
                      onChange={(e) => setColorInput(e.target.value)}
                      placeholder="เช่น FF5733"
                      className="h-8 text-sm"
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddColor() } } />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-sm border-pink-200 text-pink-600 hover:bg-pink-50"
                      onClick={handleAddColor}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      เพิ่ม
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-sm border-pink-200 text-pink-600 hover:bg-pink-50"
                      onClick={handleSavePalette}
                      disabled={isSavingPalette}
                    >
                      {isSavingPalette ? "กำลัง..." : "บันทึก"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-center py-4 border-2 border-dashed border-gray-200 rounded-lg">
                    <Palette className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">ยังไม่มีสี</p>
                    <p className="text-xs text-gray-400 mt-1">เพิ่มสีของแบรนด์</p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <Input
                      value={colorInput}
                      onChange={(e) => setColorInput(e.target.value)}
                      placeholder="เช่น FF5733"
                      className="h-8 text-sm"
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddColor() } } />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-sm border-pink-200 text-pink-600 hover:bg-pink-50"
                      onClick={handleAddColor}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      เพิ่ม
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-sm border-pink-200 text-pink-600 hover:bg-pink-50"
                      onClick={handleSavePalette}
                      disabled={isSavingPalette}
                    >
                      {isSavingPalette ? "กำลัง..." : "บันทึก"}
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* Brand context - only show for real clients, not general mode */}
        {selectedClientId && selectedClientId !== "" && selectedClientId !== "general" && brandInfoReady && brandHighlights.length > 0 && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
                <Info className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#1c1c1e]">ข้อมูลแบรนด์</h3>
                <p className="text-xs text-[#6b7280]">รายละเอียดสำคัญ</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {brandHighlights.map((h) => (
                <div key={h.label} className="bg-white rounded-lg p-3 border border-purple-100">
                  <p className="text-[10px] uppercase text-purple-600 font-medium mb-1">{h.label}</p>
                  <p className="text-xs text-gray-700 line-clamp-2">{h.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#e5e7eb] bg-white flex-shrink-0">
        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
          <img
            src="/SCR-20250730-myam-Photoroom.png"
            alt="Compass Creator Logo"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1">
          <h1 className="text-sm font-medium text-[#1c1c1e]">Compass Creator</h1>
          <p className="text-xs text-[#8e8e93]">Upload reference images and generate remixes</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleNewChat} className="text-xs text-[#8e8e93] hover:text-black">
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          New Chat
        </Button>
      </div>

      {/* Main area */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto">
          {false && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col items-center pt-8 pb-2">
                <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg mb-5">
                  <img
                    src="/SCR-20250730-myam-Photoroom.png"
                    alt="Compass Creator Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
                <h2 className="text-xl font-bold text-black mb-2">Compass Creator</h2>
                <p className="text-sm text-[#8e8e93] text-center max-w-md">
                  อัปโหลดรูป Reference แล้วเขียนบรีฟเพื่อสร้างภาพ หลังจากนั้นสามารถแชทแก้ไขต่อได้
                </p>
              </div>

              {/* Client Selection - Required for generation */}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[#1c1c1e]">Client & Product</h3>
                      <p className="text-xs text-[#6b7280">Required for generation</p>
                    </div>
                  </div>
                </div>
                
                <div className="relative">
                  <div className="flex items-center gap-3 bg-white rounded-lg border border-blue-300 px-3 py-2">
                    {selectedClient ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center">
                          <Building2 className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">{selectedClient.clientName}</span>
                        {selectedProductFocus && (
                          <span className="text-xs text-gray-500">• {selectedProductFocus}</span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-500">
                        <div className="w-6 h-6 rounded-lg bg-gray-200 flex items-center justify-center">
                          <Globe className="w-3.5 h-3.5 text-gray-600" />
                        </div>
                        <span className="text-sm">Select Client</span>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setClientDropdownOpen(!clientDropdownOpen)}
                      className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                    {selectedClient && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedClientId("")
                          setSelectedProductFocus("")
                        }}
                        className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  
                  {clientDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white border border-blue-300 rounded-xl shadow-xl">
                      <div className="p-3 border-b border-blue-100">
                        <Input
                          value={clientSearchTerm}
                          placeholder="Search clients..."
                          className="h-8 text-sm"
                          onChange={(e) => setClientSearchTerm(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setClientDropdownOpen(false)
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClientId("general")
                          setSelectedProductFocus("")
                          setClientDropdownOpen(false)
                        }}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-blue-50 transition-colors border-b border-blue-100 flex items-center gap-3"
                      >
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                          <Globe className="w-3 h-3 text-gray-600" />
                        </div>
                        <div>
                          <div className="font-medium">General Mode</div>
                          <div className="text-xs text-gray-500">Use session materials</div>
                        </div>
                      </button>
                      <div className="max-h-64 overflow-y-auto">
                        {filteredClients.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-500">No clients found</div>
                        ) : (
                          filteredClients.map((client) => (
                            <button
                              key={client.id}
                              type="button"
                              onClick={() => {
                                setSelectedClientId(client.id)
                                setSelectedProductFocus(client.productFocuses[0]?.productFocus || "")
                                setClientDropdownOpen(false)
                              }}
                              className="w-full px-4 py-3 text-left text-sm hover:bg-blue-50 transition-colors flex items-center gap-3"
                            >
                              <div className="w-6 h-6 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center">
                                <Building2 className="w-3 h-3 text-white" />
                              </div>
                              <div className="flex-1">
                                <div className="font-medium">{client.clientName}</div>
                                <div className="text-xs text-gray-500">{client.productFocuses.length} products</div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Reference Images */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-[#6c6c70] uppercase tracking-wide flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                  รูป Reference
                </p>

                {/* Selected references */}
                {pendingImages.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {pendingImages.map((url) => (
                      <div key={url} className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-blue-500 group">
                        <Image src={url} alt="Selected reference" fill sizes="80px" className="object-cover" />
                        <button
                          type="button"
                          onClick={() => removePendingImage(url)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                        <div className="absolute bottom-0 inset-x-0 bg-blue-500/80 py-0.5">
                          <CheckCircle className="w-3 h-3 text-white mx-auto" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload button */}
                <div className="flex items-center gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleReferenceUpload(e.target.files)} />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingReferences}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    {isUploadingReferences ? "กำลังอัปโหลด..." : "อัปโหลดรูป Reference"}
                  </Button>
                  <span className="text-[11px] text-[#8e8e93]">
                    {pendingImages.length}/{MAX_REFERENCE_SELECTION} รูป
                  </span>
                </div>

                {/* Library grid */}
                {loadingReferenceLibrary ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    <span className="text-xs text-[#8e8e93]">กำลังโหลดคลังรูป...</span>
                  </div>
                ) : referenceLibrary.length > 0 ? (
                  <div>
                    <p className="text-[11px] text-[#8e8e93] mb-2">หรือเลือกจากคลัง:</p>
                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-[160px] overflow-y-auto">
                      {referenceLibrary.map((img) => {
                        const url = img.url || img.uploadedUrl || img.previewUrl
                        const isSelected = !!url && pendingImages.includes(url)
                        return (
                          <button
                            key={url || img.name}
                            type="button"
                            onClick={() => url && handleLibraryRefToggle(url)}
                            className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                              isSelected ? "border-blue-500 ring-1 ring-blue-200" : "border-transparent hover:border-[#d1d1d6]"
                            }`}
                          >
                            <Image src={img.previewUrl} alt={img.name || "Reference"} fill sizes="80px" className="object-cover" />
                            {isSelected && (
                              <div className="absolute inset-0 bg-blue-500/30 flex items-center justify-center">
                                <CheckCircle className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Brief textarea */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#6c6c70] uppercase tracking-wide">บรีฟ</p>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="เขียนบรีฟสำหรับภาพที่ต้องการ เช่น สร้างภาพโฆษณาตาม Reference ที่อัปโหลด..."
                  rows={3}
                  className="w-full rounded-xl border border-[#d1d1d6] bg-white px-4 py-3 text-sm text-[#1c1c1e] placeholder:text-[#c7c7cc] focus:outline-none focus:border-[#1d4ed8] transition-colors resize-none"
                />
                {/* Suggested prompts */}
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setInputText(prompt)}
                      className="text-[11px] px-3 py-1.5 rounded-full border border-[#e5e7eb] text-[#8e8e93] hover:border-[#1d4ed8] hover:text-[#1d4ed8] hover:bg-blue-50/50 transition-all"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Inline settings */}
              <div className="bg-[#fafafa] rounded-xl border border-[#e5e7eb] p-4">
                {renderSettings()}
              </div>

              {/* Generate button */}
              <div className="flex justify-center pt-2 pb-4">
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || pendingImages.length === 0}
                  className="h-11 px-8 text-sm font-medium bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <img
                        src="/SCR-20250730-myam-Photoroom.png"
                        alt="Generate"
                        className="w-4 h-4 mr-2"
                      />
                      Generate Image
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {filteredMessages.length === 0 && (
            <div className="mb-6 rounded-2xl border border-[#e5e7eb] bg-[#fafafa] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#6c6c70] uppercase tracking-wide flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                  Reference & Brief
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  อัปโหลดรูป
                </Button>
              </div>
              <div
                className="rounded-xl border border-dashed border-[#d1d1d6] bg-white px-4 py-4 text-xs text-[#8e8e93] text-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  handleReferenceUpload(e.dataTransfer.files)
                }}
              >
                ลากรูปมาใส่ที่นี่ หรือกดอัปโหลดเพื่อเลือก Reference
              </div>
              {loadingReferenceLibrary ? (
                <div className="flex items-center gap-2 py-1 text-xs text-[#8e8e93]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                  กำลังโหลดคลังรูป...
                </div>
              ) : referenceLibrary.length > 0 ? (
                <div>
                  <p className="text-[11px] text-[#8e8e93] mb-2">หรือเลือกจากคลัง:</p>
                  <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-[160px] overflow-y-auto">
                    {referenceLibrary.map((img) => {
                      const url = img.url || img.uploadedUrl || img.previewUrl
                      const isSelected = !!url && pendingImages.includes(url)
                      return (
                        <button
                          key={url || img.name}
                          type="button"
                          onClick={() => url && handleLibraryRefToggle(url)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                            isSelected ? "border-blue-500 ring-1 ring-blue-200" : "border-transparent hover:border-[#d1d1d6]"
                          }`}
                        >
                          <Image src={img.previewUrl} alt={img.name || "Reference"} fill sizes="80px" className="object-cover" />
                          {isSelected && (
                            <div className="absolute inset-0 bg-blue-500/30 flex items-center justify-center">
                              <CheckCircle className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
              {pendingImages.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {pendingImages.map((url) => (
                    <div key={url} className="relative w-16 h-16 rounded-xl overflow-hidden border border-[#e5e7eb]">
                      <Image src={url} alt="Selected reference" fill sizes="64px" className="object-cover" />
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-center pt-1">
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || pendingImages.length === 0}
                  className="h-10 px-6 text-sm font-medium bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <img
                        src="/SCR-20250730-myam-Photoroom.png"
                        alt="Generate"
                        className="w-4 h-4 mr-2"
                      />
                      Generate Image
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ─── Phase 2: Chat Messages ───────────────────── */}
          {/* Current Editing Status */}
          {selectedImageForEditing && (
            <div data-editing-status className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">Currently Editing</p>
                <p className="text-xs text-green-600">This image will be used as reference for your edits</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedImageForEditing("")}
                className="h-7 px-2 text-xs border-green-300 text-green-700 hover:bg-green-50"
              >
                <X className="w-3 h-3 mr-1" />
                Change
              </Button>
            </div>
          )}
          
          <div className="space-y-6">
              {filteredMessages.map((msg) => (
                <div key={msg.id} className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
                  <div className={`flex max-w-[90%] sm:max-w-[80%] gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    {/* Avatar */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      msg.role === "user" ? "bg-[#e5e7eb]" : "bg-gradient-to-r from-blue-500 to-indigo-500"
                    }`}>
                      {msg.role === "user" ? (
                        <User className="w-4 h-4 text-[#6c6c70]" />
                      ) : (
                        <div className="w-4 h-4 rounded overflow-hidden">
                          <img
                            src="/SCR-20250730-myam-Photoroom.png"
                            alt="Compass Creator"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className={`space-y-2 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                      <p className="text-[11px] text-[#8e8e93] font-medium">
                        {msg.role === "user" ? "You" : "Compass Creator"}
                      </p>
                      <div className={`rounded-2xl ${
                        msg.role === "user"
                          ? "bg-[#f2f2f7] px-4 py-3 rounded-tr-sm"
                          : ""
                      }`}>
                        {msg.parts.map((part, pi) => {
                          if (part.type === "text") {
                            return (
                              <p key={pi} className="text-sm text-[#1c1c1e] leading-relaxed whitespace-pre-wrap">
                                {part.text}
                              </p>
                            )
                          }
                          if (part.type === "image") {
                            const isCurrentlyEditing = selectedImageForEditing === part.url
                            
                            return (
                              <div key={pi} className={`${msg.role === "user" ? "inline-block" : "relative group"} mt-1`}>
                                <div className={`relative overflow-hidden rounded-xl border ${
                                  msg.role === "user" ? "h-20 w-20" : "max-w-sm"
                                } ${
                                  isCurrentlyEditing ? "border-green-500 ring-2 ring-green-200" : "border-[#e5e7eb]"
                                }`}>
                                  {msg.role === "user" ? (
                                    <Image src={part.url} alt="Reference" fill sizes="80px" className="object-cover" />
                                  ) : (
                                    <button 
                                      type="button" 
                                      className="block w-full" 
                                      onClick={() => setPreviewImage(part.url)}
                                    >
                                      <Image src={part.url} alt="Generated" width={400} height={400} className="w-full h-auto object-cover" />
                                      {isCurrentlyEditing && (
                                        <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                          <Check className="w-3 h-3" />
                                          Editing
                                        </div>
                                      )}
                                    </button>
                                  )}
                                </div>
                                {msg.role === "model" && (
                                  <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-7 px-2 text-xs text-[#8e8e93] hover:text-black" 
                                      onClick={() => {
                                        setSelectedImageForEditing(part.url)
                                        // Scroll to bottom (latest message)
                                        setTimeout(() => {
                                          const chatContainer = chatContainerRef.current
                                          if (chatContainer) {
                                            chatContainer.scrollTop = chatContainer.scrollHeight
                                          }
                                        }, 100)
                                      }}
                                    >
                                      <Settings className="w-3.5 h-3.5 mr-1" />
                                      Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-[#8e8e93] hover:text-black" onClick={() => handleDownload(part.url)}>
                                      <Download className="w-3.5 h-3.5 mr-1" />
                                      Download
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-[#8e8e93] hover:text-black" onClick={() => handleCopyUrl(part.url)}>
                                      <Copy className="w-3.5 h-3.5 mr-1" />
                                      Copy URL
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )
                          }
                          return null
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {isGenerating && (
                <div className="flex items-start gap-3 animate-fade-in">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center overflow-hidden">
                    <img
                      src="/SCR-20250730-myam-Photoroom.png"
                      alt="Compass Creator"
                      className="w-6 h-6 object-cover animate-pulse"
                    />
                  </div>
                  <div className="space-y-1 pt-1">
                    <p className="text-[11px] text-[#8e8e93] font-medium">Compass Creator</p>
                    <div className="flex items-center gap-2 text-sm text-[#8e8e93]">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{loadingText}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

          <div ref={chatEndRef} className="h-4" />
        </div>
      </div>

      {/* Settings drawer (chat phase only) */}
      {phase === "chat" && settingsOpen && (
        <div className="border-t border-[#e5e7eb] bg-[#fafafa] px-4 py-4 max-h-[40vh] overflow-y-auto flex-shrink-0 animate-slide-up">
          <div className="max-w-3xl mx-auto">
            {renderSettings()}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="border-t border-[#e5e7eb] bg-white px-4 py-3 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          {phase === "generate" ? (
            /* Disabled input bar */
            <div className="flex items-center justify-center rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3.5">
              <p className="text-sm text-[#c7c7cc]">สร้างภาพก่อนเพื่อเริ่มแชทแก้ไข</p>
            </div>
          ) : (
            /* Active input bar */
            <>
              {/* Pending image previews */}
              {pendingImages.length > 0 && (
                <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
                  {pendingImages.map((url) => (
                    <div key={url} className="relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-[#e5e7eb] group">
                      <Image src={url} alt="Pending reference" fill sizes="56px" className="object-cover" />
                      <button
                        type="button"
                        onClick={() => removePendingImage(url)}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload loading */}
              {isUploadingReferences && (
                <div className="flex items-center gap-2 mb-2 text-xs text-[#8e8e93]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  กำลังอัปโหลดรูป...
                </div>
              )}

              <div className="flex items-end gap-2 rounded-2xl border border-[#d1d1d6] bg-white focus-within:border-[#1d4ed8] transition-colors px-3 py-2">
                {/* Image upload button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleReferenceUpload(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[#8e8e93] hover:text-[#1d4ed8] hover:bg-blue-50 transition-colors"
                  title="แนบรูป Reference ใหม่"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>

                {/* Settings toggle */}
                <div className="relative">
                  {showSettingsTooltip && !settingsTooltipDismissed && (
                    <div className="absolute bottom-full right-0 mb-2 z-50 animate-bounce">
                      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap border border-blue-500">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-yellow-300 rounded-full animate-pulse"></div>
                            <span className="font-semibold">Check your material first!</span>
                          </div>
                          <div className="text-xs opacity-90">
                            {getCurrentSettingsSummary()}
                          </div>
                        </div>
                        <div className="absolute bottom-full right-3 w-0 h-0 border-l-3 border-l-transparent border-r-3 border-r-transparent border-b-3 border-b-blue-600"></div>
                      </div>
                      <button
                        onClick={() => setSettingsTooltipDismissed(true)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full text-blue-600 text-xs hover:bg-gray-100 flex items-center justify-center shadow-md"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsOpen(!settingsOpen)
                      // Hide tooltip when settings is clicked
                      if (showSettingsTooltip) {
                        setShowSettingsTooltip(false)
                        setSettingsTooltipDismissed(true)
                      }
                    }}
                    className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                      settingsOpen ? "text-[#1d4ed8] bg-blue-50" : "text-[#8e8e93] hover:text-[#1d4ed8] hover:bg-blue-50"
                    } ${
                      showSettingsTooltip && !settingsTooltipDismissed ? "ring-2 ring-blue-400 ring-offset-2 animate-pulse" : ""
                    }`}
                    title="แก้ไขภาพและวัสดุ: เลือกวัสดุอ้างอิง, ปรับสี และอัตราส่วนภาพ"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </div>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="พิมพ์คำสั่งแก้ไขภาพ เช่น เปลี่ยนสีให้สดใสขึ้น..."
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-sm text-[#1c1c1e] placeholder:text-[#c7c7cc] focus:outline-none py-1.5 max-h-[120px] overflow-y-auto"
                />

                {/* Send button */}
                <button
                  type="button"
                  onClick={() => handleChatSend()}
                  disabled={isGenerating || (!inputText.trim() && pendingImages.length === 0)}
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    isGenerating || (!inputText.trim() && pendingImages.length === 0)
                      ? "bg-[#e5e7eb] text-[#c7c7cc] cursor-not-allowed"
                      : "bg-[#1d4ed8] text-white hover:bg-[#1847c2] shadow-sm"
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {/* Status line */}
              <div className="flex items-center justify-between mt-1.5 px-1">
                <p className="text-[11px] text-[#c7c7cc]">
                  {pendingImages.length > 0
                    ? `แนบรูปใหม่ ${pendingImages.length}/${MAX_REFERENCE_SELECTION}`
                    : "จะใช้ภาพที่สร้างล่าสุดเป็น Reference • กด 📷 แนบรูปใหม่ หรือ Ctrl+V วาง"
                  }
                </p>
                <p className="text-[11px] text-[#c7c7cc]">
                  {aspectRatio} • {resolvedClientName !== "No Client Selected" ? resolvedClientName : "ยังไม่เลือกลูกค้า"}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Preview dialog */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-4xl w-[90vw]">
          <DialogHeader>
            <DialogTitle>ดูภาพเต็ม</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="relative w-full h-[70vh] bg-[#f3f4f6] rounded-xl overflow-hidden">
              <Image src={previewImage} alt="Full preview" fill sizes="100vw" className="object-contain bg-[#111]" />
            </div>
          )}
          {previewImage && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => handleDownload(previewImage)}>
                <Download className="w-4 h-4 mr-1" />
                ดาวน์โหลด
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleCopyUrl(previewImage)}>
                <Copy className="w-4 h-4 mr-1" />
                คัดลอก URL
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
