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
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Switch } from "@/components/ui/switch"
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
  ArrowUp,
  ArrowDown,
} from "lucide-react"

// ─── Types ───────────────────────────────────────────────

type PmaxImageSet = {
  Version1: string | null
  Version2: string | null
}

type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image"; url: string; isSelection?: boolean }
  | { type: "pmax-collection"; images: PmaxImageSet[]; aspectRatios: string[] }

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

// Performance Max required aspect ratios based on Google Ads specs
const PMAX_ASPECT_RATIOS = ["1:1", "4:5", "16:9", "9:16"]

const SUGGESTED_PROMPTS = [
  "สร้างภาพโฆษณาสินค้า minimal style บนพื้นหลังสีพาสเทล",
  "สร้างภาพโฆษณา lifestyle สดใส สว่าง บรรยากาศธรรมชาติ",
  "สร้างภาพโฆษณาสินค้า modern luxury style",
  "ทำภาพโฆษณา flat lay composition แบบมินิมอล",
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
  const [referenceExpanded, setReferenceExpanded] = useState(true)
  const [materialsExpanded, setMaterialsExpanded] = useState(true)

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
  const [useBrandIdentity, setUseBrandIdentity] = useState(true)

  // PMAX toggle
  const [isPmaxEnabled, setIsPmaxEnabled] = useState(false)
  const [upscalingUrls, setUpscalingUrls] = useState<string[]>([])

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
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const wasHiddenRef = useRef<boolean>(false)
  const mainContainerRef = useRef<HTMLDivElement | null>(null)

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
          // Don't auto-select - let user choose manually
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

  // ─── Session Storage: Save & Restore Chat State ────────────

  // Generate unique session key based on client and product focus
  const getSessionKey = useCallback(() => {
    // Freestyle mode uses default key
    if (!selectedClientId || selectedClientId === "") {
      return 'remix-chat-freestyle'
    }
    // Client mode uses client-specific key
    const productKey = resolvedProductFocus ? resolvedProductFocus.replace(/\s+/g, '-') : 'default'
    return `remix-chat-${selectedClientId}-${productKey}`
  }, [selectedClientId, resolvedProductFocus])

  // Save state to sessionStorage (debounced)
  const saveSessionState = useCallback(() => {
    const sessionKey = getSessionKey()
    if (!sessionKey) return

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Debounce save operation (500ms)
    saveTimeoutRef.current = setTimeout(() => {
      try {
        const stateToSave = {
          messages,
          inputText,
          pendingImages,
          selectedImageForEditing,
          selectedMaterials,
          colorPalette,
          aspectRatio,
          useBrandIdentity,
          isPmaxEnabled,
          referenceExpanded,
          materialsExpanded,
          phase,
          isGenerating, // Save generating state to detect interruptions
          timestamp: Date.now(),
        }
        sessionStorage.setItem(sessionKey, JSON.stringify(stateToSave))
        console.log('💾 Chat state saved to session:', sessionKey)
      } catch (err) {
        console.error('Failed to save session state:', err)
      }
    }, 500)
  }, [
    messages,
    inputText,
    pendingImages,
    selectedImageForEditing,
    selectedMaterials,
    colorPalette,
    aspectRatio,
    useBrandIdentity,
    isPmaxEnabled,
    referenceExpanded,
    materialsExpanded,
    phase,
    isGenerating,
    getSessionKey,
  ])

  // Restore state from sessionStorage on mount
  useEffect(() => {
    const sessionKey = getSessionKey()
    if (!sessionKey) return

    try {
      const savedState = sessionStorage.getItem(sessionKey)
      if (savedState) {
        const parsed = JSON.parse(savedState)

        // Only restore if saved within last 24 hours
        const ageInHours = (Date.now() - parsed.timestamp) / (1000 * 60 * 60)
        if (ageInHours < 24) {
          console.log('📂 Restoring chat state from session:', sessionKey)

          let restoredMessages = parsed.messages || []

          // Check if generation was interrupted (was generating when navigated away)
          if (parsed.isGenerating && restoredMessages.length > 0) {
            const lastMsg = restoredMessages[restoredMessages.length - 1]

            // If last message was from user, add an interruption notice
            if (lastMsg.role === "user") {
              console.log('⚠️ Generation was interrupted, adding notice message')
              restoredMessages = [
                ...restoredMessages,
                {
                  id: `interrupted-${Date.now()}`,
                  role: "model" as const,
                  parts: [{
                    type: "text" as const,
                    text: "⚠️ การสร้างภาพถูกขัดจังหวะเนื่องจากคุณออกจากหน้านี้ไประหว่างที่กำลังสร้างภาพ กรุณากด Enter เพื่อส่งคำขอใหม่อีกครั้ง"
                  }],
                  timestamp: Date.now()
                }
              ]
            }
          }

          setMessages(restoredMessages)
          setInputText(parsed.inputText || "")
          setPendingImages(parsed.pendingImages || [])
          setSelectedImageForEditing(parsed.selectedImageForEditing || "")
          setSelectedMaterials(parsed.selectedMaterials || [])
          setColorPalette(parsed.colorPalette || [])
          setAspectRatio(parsed.aspectRatio || ASPECT_RATIO_OPTIONS[0])
          setUseBrandIdentity(parsed.useBrandIdentity ?? true)
          setIsPmaxEnabled(parsed.isPmaxEnabled || false)
          setReferenceExpanded(parsed.referenceExpanded !== undefined ? parsed.referenceExpanded : true)
          setMaterialsExpanded(parsed.materialsExpanded !== undefined ? parsed.materialsExpanded : true)
          setPhase(parsed.phase || "chat")
          setIsGenerating(false) // Always clear generating state on restore
        } else {
          // Clear old session data
          sessionStorage.removeItem(sessionKey)
        }
      }
    } catch (err) {
      console.error('Failed to restore session state:', err)
    }
    // Only run once when client/product focus is determined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getSessionKey])

  // Auto-save state whenever it changes
  useEffect(() => {
    // Always save state (freestyle mode will use default key)
    saveSessionState()
  }, [saveSessionState])

  // Clear session storage on New Chat
  const clearSessionState = useCallback(() => {
    const sessionKey = getSessionKey()
    if (sessionKey) {
      sessionStorage.removeItem(sessionKey)
      console.log('🗑️ Cleared session state:', sessionKey)
    }
  }, [getSessionKey])

  // ─── Visibility Detection: Handle Tab Switching During Generation ────

  useEffect(() => {
    const container = mainContainerRef.current
    if (!container) return

    // Create Intersection Observer to detect when component becomes visible/hidden
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const isVisible = entry.isIntersecting

          // Component became visible after being hidden
          if (isVisible && wasHiddenRef.current && isGenerating) {
            console.log('⚠️ Component became visible while generation was in progress')

            // Cancel the orphaned generation state
            setIsGenerating(false)

            // Add interruption message if last message was from user
            if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
              const interruptionMessage: ChatMessage = {
                id: `interrupted-${Date.now()}`,
                role: "model",
                parts: [{
                  type: "text",
                  text: "⚠️ การสร้างภาพถูกขัดจังหวะเนื่องจากคุณเปลี่ยน tab กรุณากด Enter เพื่อส่งคำขอใหม่อีกครั้ง"
                }],
                timestamp: Date.now()
              }
              setMessages((prev) => [...prev, interruptionMessage])
            }
          }

          // Update hidden state
          wasHiddenRef.current = !isVisible
        })
      },
      {
        threshold: 0.1, // Trigger when at least 10% of component is visible
      }
    )

    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [isGenerating, messages])

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
    if (!files) { return }

    setIsUploadingMaterials(true)
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue

        if (!selectedClientId || selectedClientId === "" || selectedClientId === "general") {
          // Freestyle/Session mode - store in local state
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

  const buildPrompt = (briefText: string, hasReferences: boolean = true) => {
    const parts = [
      resolvedClientName ? `แบรนด์: ${resolvedClientName}` : null,
      resolvedProductFocus ? `สินค้า/บริการ: ${resolvedProductFocus}` : null,
      brandProfile?.usp ? `USP: ${brandProfile.usp}` : null,
      brandProfile?.specialty ? `Specialty: ${brandProfile.specialty}` : null,
      brandProfile?.strengths ? `Strengths: ${brandProfile.strengths}` : null,
    ].filter(Boolean)

    // For freestyle mode (no references), use user's prompt directly
    // For reference-based mode, add instruction to follow reference
    const baseInstruction = hasReferences
      ? "สร้างรูปภาพโฆษณาตามรูปแบบและองค์ประกอบของรูปอ้างอิงที่ให้ไว้"
      : briefText ? null : "สร้างรูปภาพโฆษณา"

    return [
      baseInstruction,
      parts.length ? `ข้อมูลแบรนด์:\n${parts.join("\n")}` : null,
      briefText ? (hasReferences ? `บรีฟเพิ่มเติม: ${briefText.trim()}` : briefText.trim()) : null,
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

  const callRemixWebhook = async (referenceUrls: string[], briefText: string, isEdit: boolean = false, isPmaxFromHover: boolean = false): Promise<string[] | { isPmaxCollection: true; data: any[]; aspectRatios: string[] }> => {
    const hasReferences = referenceUrls.length > 0
    const prompt = buildPrompt(briefText, hasReferences)

    // Determine request type based on mode, PMAX toggle, and edit status
    let requestType = undefined
    if (isEdit) {
      requestType = "edit image"
    } else if (isPmaxEnabled) {
      requestType = "pmax image"
    } else if (isPmaxFromHover) {
      requestType = "pmax optimize"
    } else if (!selectedClientId || selectedClientId === "") {
      requestType = "freestyle"
    }

    // For PMAX generation, send multiple aspect ratios; for editing or normal generation, send single selected ratio
    const aspectRatiosToSend = (isEdit || (!isPmaxEnabled && !isPmaxFromHover)) ? [aspectRatio] : PMAX_ASPECT_RATIOS

    const payload = {
      prompt,
      reference_image_url: referenceUrls[0] || "",
      reference_image_urls: referenceUrls.length > 0 ? referenceUrls : [""],
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
      use_brand_identity: useBrandIdentity,
      aspect_ratio: (isEdit || (!isPmaxEnabled && !isPmaxFromHover)) ? aspectRatio : PMAX_ASPECT_RATIOS[0], // Primary aspect ratio
      aspectRatio: (isEdit || (!isPmaxEnabled && !isPmaxFromHover)) ? aspectRatio : PMAX_ASPECT_RATIOS[0],
      aspect_ratios: aspectRatiosToSend, // Array of all aspect ratios to generate
      image_count: DEFAULT_IMAGE_COUNT,
      imageCount: DEFAULT_IMAGE_COUNT,
      pmax_enabled: isPmaxEnabled,
      ...(requestType && { request_type: requestType })
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

    // Debug logging
    console.log('🔍 PMAX Debug:', {
      isPmaxEnabled,
      isPmaxFromHover,
      isArray: Array.isArray(result),
      hasData: result[0]?.data,
      hasDirectData: result?.data,
      result: JSON.stringify(result).substring(0, 200)
    })

    // Check if response is PMAX format: direct data property
    if ((isPmaxEnabled || isPmaxFromHover) && result?.data && Array.isArray(result.data)) {
      console.log('🎯 Found PMAX format with direct data property')
      const pmaxData = result.data
      if (pmaxData.length > 0 &&
          pmaxData.every((item: any) => 'Version1' in item || 'Version2' in item)) {
        console.log('✅ PMAX data validation passed, returning collection')
        // Return PMAX collection wrapped in special format
        return { isPmaxCollection: true, data: pmaxData, aspectRatios: PMAX_ASPECT_RATIOS } as any
      }
    }

    // Check if response is PMAX format: array with data property (backup)
    if ((isPmaxEnabled || isPmaxFromHover) && Array.isArray(result) && result.length > 0 && result[0]?.data) {
      console.log('🎯 Found PMAX format with data property in array')
      const pmaxData = result[0].data
      if (Array.isArray(pmaxData) && pmaxData.length > 0 &&
          pmaxData.every((item: any) => 'Version1' in item || 'Version2' in item)) {
        console.log('✅ PMAX data validation passed, returning collection')
        // Return PMAX collection wrapped in special format
        return { isPmaxCollection: true, data: pmaxData, aspectRatios: PMAX_ASPECT_RATIOS } as any
      }
    }

    // Also handle direct array format (Version1/Version2 objects)
    if ((isPmaxEnabled || isPmaxFromHover) && Array.isArray(result) && result.length > 0 &&
        result.every((item: any) => 'Version1' in item || 'Version2' in item)) {
      console.log('✅ Found direct PMAX format, returning collection')
      // Return PMAX collection wrapped in special format
      return { isPmaxCollection: true, data: result, aspectRatios: PMAX_ASPECT_RATIOS } as any
    }

    console.log('❌ No PMAX format detected, using normal flow')

    // Normal flow for non-PMAX responses
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


  // ─── Unified send handler (handles both initial generation and edits) ───

  const handleChatSend = async () => {
    const text = inputText.trim()
    const images = [...pendingImages]
    const isInitialGeneration = filteredMessages.length === 0

    // For initial generation, require at least text or images (freestyle mode allows text-only)
    if (isInitialGeneration && images.length === 0 && !text) {
      return
    }

    // For edits, require at least text or new images
    if (!isInitialGeneration && !text && images.length === 0) {
      return
    }

    // For edits (not initial generation), require image selection or new images
    if (!isInitialGeneration && !selectedImageForEditing && images.length === 0) {
      addModelMessage([{ type: "text", text: "กรุณาเลือกรูปภาพที่ต้องการแก้ไขก่อนส่งข้อความ หรืออัปโหลดรูปใหม่" }])
      return
    }

    // Determine references for webhook (allow empty for freestyle generation)
    const webhookRefs = images.length > 0
      ? images
      : isInitialGeneration
        ? [] // Freestyle mode: no references needed
        : [selectedImageForEditing]

    // Build user message
    const userParts: ChatContentPart[] = []
    if (images.length > 0) {
      images.forEach((url) => userParts.push({ type: "image", url }))
    }
    if (text) userParts.push({ type: "text", text })

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      parts: userParts,
      timestamp: Date.now(),
    }

    // For initial generation, replace messages; for edits, append
    if (isInitialGeneration) {
      setMessages([userMsg])
      setPhase("chat")
    } else {
      setMessages((prev) => [...prev, userMsg])
    }

    setInputText("")
    setPendingImages([])
    setIsGenerating(true)

    try {
      console.log('🚀 Starting webhook call:', { 
        isPmaxEnabled, 
        isInitialGeneration, 
        webhookRefsLength: webhookRefs.length,
        text: text.substring(0, 50)
      })
      
      const result = await callRemixWebhook(webhookRefs, text, !isInitialGeneration)
      
      console.log('📥 Webhook result type:', typeof result)
      console.log('📥 Webhook result:', result)

      // Check if result is PMAX collection
      if (typeof result === 'object' && (result as any).isPmaxCollection) {
        console.log('✅ Detected PMAX collection, processing...')
        const pmaxData = result as any
        const modelParts: ChatContentPart[] = [{
          type: "pmax-collection" as const,
          images: pmaxData.data,
          aspectRatios: pmaxData.aspectRatios
        }]
        addModelMessage(modelParts)

        // Set first available image for editing
        const firstImage = pmaxData.data[0]?.Version1 || pmaxData.data[0]?.Version2
        if (firstImage) {
          setSelectedImageForEditing(firstImage)
        }
      } else {
        console.log('📷 Processing normal image array...')
        // Normal image array response
        const generatedUrls = result as string[]
        const modelParts: ChatContentPart[] = generatedUrls.map((url) => ({
          type: "image" as const,
          url,
        }))
        addModelMessage(modelParts)

        // Automatically set the first generated image as the reference for editing
        if (generatedUrls.length > 0) {
          setSelectedImageForEditing(generatedUrls[0])
        }
      }

      // Collapse reference and materials sections after first generation
      if (isInitialGeneration) {
        setReferenceExpanded(false)
        setMaterialsExpanded(false)
      }
    } catch (err: any) {
      console.error(isInitialGeneration ? "Generate failed:" : "Edit failed:", err)
      addModelMessage([{ type: "text", text: err?.message || "เกิดข้อผิดพลาดในการสร้างภาพ" }])
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

  const handleDownloadAll = async (images: PmaxImageSet[]) => {
    try {
      for (let i = 0; i < images.length; i++) {
        const set = images[i]
        if (set.Version1) {
          await handleDownload(set.Version1)
          // Small delay between downloads
          await new Promise(resolve => setTimeout(resolve, 500))
        }
        if (set.Version2) {
          await handleDownload(set.Version2)
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
    } catch (err) {
      console.error("Download all failed:", err)
    }
  }

  const handleCopyUrl = async (url: string) => {
    try { await navigator.clipboard.writeText(url) } catch {}
  }

  const uploadUpscaledBlobToStorage = useCallback(
    async (blob: Blob, mimeType: string) => {
      const storage = getStorageClient()
      if (!storage) {
        throw new Error("Storage client not available")
      }

      const extensionMap: Record<string, string> = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
      }

      const extension = extensionMap[mimeType] || "png"
      const path = `generated/${selectedClientId || "remix"}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}-2k.${extension}`
      const { error } = await storage.from("ads-creative-image").upload(path, blob, {
        contentType: mimeType,
      })

      if (error) {
        throw new Error(error.message)
      }

      const { data } = storage.from("ads-creative-image").getPublicUrl(path)
      return data.publicUrl
    },
    [selectedClientId],
  )

  const handleUpscaleImage = useCallback(
    async (url: string) => {
      try {
        setUpscalingUrls((prev) => [...prev, url])

        const response = await fetch("/api/upscale-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image_url: url,
            prompt: "Upscale this Compass Creator result while preserving the same image and composition.",
          }),
        })

        const result = await response.json()
        if (!response.ok || !result.success || !result.image_base64) {
          throw new Error(result?.error || "ไม่สามารถ upscale ภาพได้")
        }

        const binary = atob(result.image_base64)
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
        const mimeType = result.mime_type || "image/png"
        const publicUrl = await uploadUpscaledBlobToStorage(new Blob([bytes], { type: mimeType }), mimeType)

        addModelMessage([
          { type: "image", url: publicUrl },
          { type: "text", text: "Upscaled to 2K" },
        ])
        setSelectedImageForEditing(publicUrl)
      } catch (error) {
        console.error("Upscale failed:", error)
        addModelMessage([{ type: "text", text: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการ upscale ภาพ" }])
      } finally {
        setUpscalingUrls((prev) => prev.filter((item) => item !== url))
      }
    },
    [uploadUpscaledBlobToStorage],
  )

  const handlePmaxGenerate = async (imageUrl: string) => {
    // Create user message for PMAX generation
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      parts: [
        { type: "image", url: imageUrl },
        { type: "text", text: "Generate PMAX variations of this image" }
      ],
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, userMsg])
    setIsGenerating(true)

    try {
      console.log('🚀 Starting PMAX generation for image:', imageUrl)
      
      // Call webhook with PMAX from hover enabled
      const result = await callRemixWebhook([imageUrl], "Generate PMAX variations of this image", false, true)
      
      console.log('📥 PMAX generation result:', result)

      // Check if result is PMAX collection
      if (typeof result === 'object' && (result as any).isPmaxCollection) {
        console.log('✅ PMAX collection generated successfully')
        const pmaxData = result as any
        const modelParts: ChatContentPart[] = [{
          type: "pmax-collection" as const,
          images: pmaxData.data,
          aspectRatios: pmaxData.aspectRatios
        }]
        addModelMessage(modelParts)

        // Set first available image for editing
        const firstImage = pmaxData.data[0]?.Version1 || pmaxData.data[0]?.Version2
        if (firstImage) {
          setSelectedImageForEditing(firstImage)
        }
      } else {
        console.log('📷 Processing unexpected response format...')
        // Handle unexpected response format
        addModelMessage([{ type: "text", text: "PMAX generation completed but received unexpected format" }])
      }
    } catch (err: any) {
      console.error("PMAX generation failed:", err)
      addModelMessage([{ type: "text", text: err?.message || "เกิดข้อผิดพลาดในการสร้างภาพ PMAX" }])
    } finally {
      setIsGenerating(false)
    }
  }

  // ─── New Chat ──────────────────────────────────────────────

  const handleNewChat = () => {
    // Clear session storage for this client/product focus
    clearSessionState()

    setMessages([])
    setInputText("")
    setPendingImages([])
    setIsGenerating(false)
    setPhase("chat")
    setSettingsOpen(false)
    setSelectedImageForEditing("")
    setReferenceExpanded(true)
    setMaterialsExpanded(true)
    setIsPmaxEnabled(false)
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
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-gray-700">Use Brand Identity</p>
                    <HoverCard openDelay={150} closeDelay={100}>
                      <HoverCardTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-400 transition-colors hover:text-gray-700"
                          aria-label="Brand identity details"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent align="start" className="w-72 rounded-2xl border-gray-200 p-3 text-sm leading-6 text-gray-600">
                        Brand identity จะอ้างอิงจากรูปภาพ ads account ที่กำลังรันอยู่ และส่งเป็น flag ไปให้ workflow ตัดสินใจใช้ต่อเอง
                      </HoverCardContent>
                    </HoverCard>
                  </div>
                </div>
                <Switch checked={useBrandIdentity} onCheckedChange={setUseBrandIdentity} />
              </div>
            </div>
          </div>
        </div>


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
                    {selectedClientId && selectedClientId !== "" && selectedClientId !== "general" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-sm border-pink-200 text-pink-600 hover:bg-pink-50"
                        onClick={handleSavePalette}
                        disabled={isSavingPalette}
                      >
                        {isSavingPalette ? "กำลัง..." : "บันทึก"}
                      </Button>
                    )}
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
                    {selectedClientId && selectedClientId !== "" && selectedClientId !== "general" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-sm border-pink-200 text-pink-600 hover:bg-pink-50"
                        onClick={handleSavePalette}
                        disabled={isSavingPalette}
                      >
                        {isSavingPalette ? "กำลัง..." : "บันทึก"}
                      </Button>
                    )}
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
    <div ref={mainContainerRef} className="flex flex-col h-full bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
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

      {/* Client Selection Info Notification */}
      {(!selectedClientId || selectedClientId === "") && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
              <Info className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900">Freestyle Mode</p>
              <p className="text-xs text-blue-700 mt-0.5">You can generate images freely with just a prompt. Select a client for brand-specific features (colors, materials, brand info).</p>
            </div>
          </div>
        </div>
      )}

      {/* Main area */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 relative">
        {/* Navigation Buttons */}
        <div className="fixed right-8 top-1/2 transform -translate-y-1/2 flex flex-col gap-2 z-50">
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-10 p-0 bg-white shadow-lg hover:shadow-xl transition-all border-gray-200"
            onClick={() => {
              const chatContainer = chatContainerRef.current
              if (chatContainer) {
                chatContainer.scrollTop = 0
              }
            }}
            title="Go to oldest message"
          >
            <ArrowUp className="w-5 h-5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-10 p-0 bg-white shadow-lg hover:shadow-xl transition-all border-gray-200"
            onClick={() => {
              const chatContainer = chatContainerRef.current
              if (chatContainer) {
                chatContainer.scrollTop = chatContainer.scrollHeight
              }
            }}
            title="Go to newest message"
          >
            <ArrowDown className="w-5 h-5" />
          </Button>
        </div>
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
            </div>
          )}

          {/* Two-column layout for Reference Images and Brand Materials */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Reference Images Section - Always visible but collapsible after first generation */}
            <div className="rounded-2xl border border-[#e5e7eb] bg-[#fafafa] overflow-hidden">
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-[#f5f5f5] transition-colors"
                onClick={() => setReferenceExpanded(!referenceExpanded)}
              >
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-sm font-semibold text-[#1c1c1e]">Reference Images</p>
                    <p className="text-[10px] text-[#9ca3af]">รูปโฆษณา/สไตล์ที่ต้องการให้ AI เลียนแบบ</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {pendingImages.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {pendingImages.length} รูป
                    </Badge>
                  )}
                  {referenceExpanded ? (
                    <ChevronUp className="w-4 h-4 text-[#8e8e93]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#8e8e93]" />
                  )}
                </div>
              </div>

              {referenceExpanded && (
              <div className="p-4 pt-0 space-y-3">
                <div className="flex items-center justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    อัปโหลดรูป
                  </Button>
                </div>
                <div
                  className="rounded-xl border border-dashed border-[#d1d1d6] bg-white px-4 py-6 text-center transition-colors"
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    e.currentTarget.classList.add('border-blue-300', 'bg-blue-50')
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    e.currentTarget.classList.remove('border-blue-300', 'bg-blue-50')
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    e.currentTarget.classList.remove('border-blue-300', 'bg-blue-50')
                    handleReferenceUpload(e.dataTransfer.files)
                  }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <ImageIcon className="w-8 h-8 text-blue-400" />
                    <div>
                      <p className="text-sm text-[#8e8e93]">Drag and drop images</p>
                      <p className="text-xs text-[#c7c7cc] mt-1">หรือกดอัปโหลดด้านบน</p>
                    </div>
                  </div>
                </div>
              {loadingReferenceLibrary ? (
                <div className="flex items-center gap-2 py-1 text-xs text-[#8e8e93]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                  กำลังโหลดคลังรูป...
                </div>
              ) : referenceLibrary.length > 0 ? (
                <div>
                  <p className="text-[11px] text-[#8e8e93] mb-2">หรือเลือกจากคลัง:</p>
                  <div className="grid grid-cols-3 gap-4 max-h-[240px] overflow-y-auto">
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
              </div>
            )}
            </div>

            {/* Brand Materials Section - Collapsible */}
            {selectedClientId && selectedClientId !== "" && (
              <div className="rounded-2xl border border-[#e5e7eb] bg-[#fafafa] overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-[#f5f5f5] transition-colors"
                  onClick={() => setMaterialsExpanded(!materialsExpanded)}
                >
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-orange-500" />
                    <div>
                      <p className="text-sm font-semibold text-[#1c1c1e]">Brand Materials</p>
                      <p className="text-[10px] text-[#9ca3af]">ภาพสินค้า/โลโก้/วัสดุของแบรนด์ที่จะใช้ในภาพ</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedMaterials.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {selectedMaterials.length} ภาพ
                      </Badge>
                    )}
                    {materialsExpanded ? (
                      <ChevronUp className="w-4 h-4 text-[#8e8e93]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#8e8e93]" />
                    )}
                  </div>
                </div>

              {materialsExpanded && (
                <div className="p-4 pt-0 space-y-3">
                  <div className="flex items-center justify-end">
                    <input ref={materialInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleMaterialUpload(e.target.files)} />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        materialInputRef.current?.click()
                      }}
                      disabled={isUploadingMaterials}
                    >
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                      {isUploadingMaterials ? "กำลัง..." : "อัปโหลด"}
                    </Button>
                  </div>

                  {/* Drag and Drop Area */}
                  <div
                    className="rounded-xl border border-dashed border-[#d1d1d6] bg-white px-4 py-6 text-center transition-colors"
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      e.currentTarget.classList.add('border-orange-300', 'bg-orange-50')
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      e.currentTarget.classList.remove('border-orange-300', 'bg-orange-50')
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      e.currentTarget.classList.remove('border-orange-300', 'bg-orange-50')
                      handleMaterialUpload(e.dataTransfer.files)
                    }}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Package className="w-8 h-8 text-orange-400" />
                      <div>
                        <p className="text-sm text-[#8e8e93]">Drag and drop images</p>
                        <p className="text-xs text-[#c7c7cc] mt-1">หรือกดอัปโหลดด้านบน</p>
                      </div>
                    </div>
                  </div>

                  {!selectedClientId || selectedClientId === "" || selectedClientId === "general" ? (
                    // Freestyle/General mode - show session materials
                    sessionMaterials.length > 0 ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-4">
                          {sessionMaterials.map((img) => {
                            const url = img.url || img.uploadedUrl || img.previewUrl
                            const selected = !!url && selectedMaterials.includes(url)
                            return (
                              <button
                                key={url || img.name}
                                type="button"
                                onClick={() => url && handleMaterialToggle(url)}
                                className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                                  selected ? "border-orange-500 ring-1 ring-orange-200" : "border-transparent hover:border-[#d1d1d6]"
                                }`}
                              >
                                <Image src={img.previewUrl} alt={img.name || "Material"} fill sizes="80px" className="object-cover" />
                                {selected && (
                                  <div className="absolute inset-0 bg-orange-500/30 flex items-center justify-center">
                                    <CheckCircle className="w-4 h-4 text-white" />
                                  </div>
                                )}
                              </button>
                            )
                          })}
                        </div>
                        {selectedMaterials.length > 0 && (
                          <p className="text-xs text-orange-600">เลือกแล้ว {selectedMaterials.length} ภาพ</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-[#9ca3af]">ยังไม่มีวัสดุ อัปโหลดเพื่อเริ่มใช้งาน</p>
                    )
                  ) : (
                    // Client mode - show database materials
                    loadingMaterialImages ? (
                      <div className="flex items-center gap-2 py-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
                        <span className="text-xs text-[#8e8e93]">กำลังโหลดวัสดุ...</span>
                      </div>
                    ) : materialImages.length > 0 ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-4">
                          {materialImages.map((img) => {
                            const url = img.url || img.uploadedUrl || img.previewUrl
                            const selected = !!url && selectedMaterials.includes(url)
                            return (
                              <button
                                key={url || img.name}
                                type="button"
                                onClick={() => url && handleMaterialToggle(url)}
                                className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                                  selected ? "border-orange-500 ring-1 ring-orange-200" : "border-transparent hover:border-[#d1d1d6]"
                                }`}
                              >
                                <Image src={img.previewUrl} alt={img.name || "Material"} fill sizes="80px" className="object-cover" />
                                {selected && (
                                  <div className="absolute inset-0 bg-orange-500/30 flex items-center justify-center">
                                    <CheckCircle className="w-4 h-4 text-white" />
                                  </div>
                                )}
                              </button>
                            )
                          })}
                        </div>
                        {selectedMaterials.length > 0 && (
                          <p className="text-xs text-orange-600">เลือกแล้ว {selectedMaterials.length} ภาพ</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-[#9ca3af]">ยังไม่มีวัสดุ อัปโหลดเพื่อเริ่มใช้งาน</p>
                    )
                  )}
                </div>
              )}
            </div>
            )}
          </div>
          {/* End two-column layout */}

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
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-7 px-2 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50" 
                                      onClick={() => handlePmaxGenerate(part.url)}
                                    >
                                      <Sparkles className="w-3.5 h-3.5 mr-1" />
                                      PMAX
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      disabled={upscalingUrls.includes(part.url)}
                                      onClick={() => handleUpscaleImage(part.url)}
                                    >
                                      {upscalingUrls.includes(part.url) ? (
                                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                      ) : (
                                        <ArrowUp className="w-3.5 h-3.5 mr-1" />
                                      )}
                                      Upscale 2K
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
                          if (part.type === "pmax-collection") {
                            return (
                              <div key={pi} className="space-y-3 mt-2">
                                {/* Collection Header */}
                                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                                      <Sparkles className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-purple-900">Performance Max Collection</p>
                                      <p className="text-xs text-purple-600">{part.images.length} aspect ratios • {part.images.filter(i => i.Version1 || i.Version2).length * 2} images total</p>
                                    </div>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs border-purple-300 text-purple-700 hover:bg-purple-50"
                                    onClick={() => handleDownloadAll(part.images)}
                                  >
                                    <Download className="w-3.5 h-3.5 mr-1.5" />
                                    Download All
                                  </Button>
                                </div>

                                {/* Image Grid */}
                                <div className="grid grid-cols-2 gap-3">
                                  {part.images.map((imageSet, idx) => {
                                    const aspectRatio = part.aspectRatios[idx] || `Ratio ${idx + 1}`
                                    return (
                                      <div key={idx} className="space-y-2">
                                        <p className="text-xs font-semibold text-[#6c6c70] uppercase tracking-wide flex items-center gap-1">
                                          <span className="w-5 h-5 rounded bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-bold">
                                            {aspectRatio}
                                          </span>
                                          Aspect {aspectRatio}
                                        </p>
                                        <div className="space-y-2">
                                          {imageSet.Version1 && (
                                            <div className="relative group">
                                              <div className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                                                selectedImageForEditing === imageSet.Version1
                                                  ? "border-green-500 ring-2 ring-green-200"
                                                  : "border-[#e5e7eb]"
                                              }`}>
                                                <button
                                                  type="button"
                                                  className="block w-full"
                                                  onClick={() => setPreviewImage(imageSet.Version1)}
                                                >
                                                  <Image src={imageSet.Version1} alt={`${aspectRatio} V1`} width={300} height={300} className="w-full h-auto object-cover" />
                                                </button>
                                                {selectedImageForEditing === imageSet.Version1 && (
                                                  <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                                    <Check className="w-3 h-3" />
                                                    Editing
                                                  </div>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-6 px-2 text-xs text-[#8e8e93] hover:text-black"
                                                  onClick={() => {
                                                    setSelectedImageForEditing(imageSet.Version1!)
                                                    setTimeout(() => {
                                                      const chatContainer = chatContainerRef.current
                                                      if (chatContainer) {
                                                        chatContainer.scrollTop = chatContainer.scrollHeight
                                                      }
                                                    }, 100)
                                                  }}
                                                >
                                                  <Settings className="w-3 h-3 mr-1" />
                                                  Edit
                                                </Button>
                                                <Button 
                                                  variant="ghost" 
                                                  size="sm" 
                                                  className="h-6 px-2 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50" 
                                                  onClick={() => handlePmaxGenerate(imageSet.Version1!)}
                                                >
                                                  <Sparkles className="w-3 h-3 mr-1" />
                                                  PMAX
                                                </Button>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                  disabled={upscalingUrls.includes(imageSet.Version1!)}
                                                  onClick={() => handleUpscaleImage(imageSet.Version1!)}
                                                >
                                                  {upscalingUrls.includes(imageSet.Version1!) ? (
                                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                  ) : (
                                                    <ArrowUp className="w-3 h-3 mr-1" />
                                                  )}
                                                  2K
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-[#8e8e93] hover:text-black" onClick={() => handleDownload(imageSet.Version1!)}>
                                                  <Download className="w-3 h-3 mr-1" />
                                                  DL
                                                </Button>
                                              </div>
                                              <p className="text-[10px] text-[#9ca3af] mt-1">Version 1</p>
                                            </div>
                                          )}
                                          {imageSet.Version2 && (
                                            <div className="relative group">
                                              <div className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                                                selectedImageForEditing === imageSet.Version2
                                                  ? "border-green-500 ring-2 ring-green-200"
                                                  : "border-[#e5e7eb]"
                                              }`}>
                                                <button
                                                  type="button"
                                                  className="block w-full"
                                                  onClick={() => setPreviewImage(imageSet.Version2)}
                                                >
                                                  <Image src={imageSet.Version2} alt={`${aspectRatio} V2`} width={300} height={300} className="w-full h-auto object-cover" />
                                                </button>
                                                {selectedImageForEditing === imageSet.Version2 && (
                                                  <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                                    <Check className="w-3 h-3" />
                                                    Editing
                                                  </div>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-6 px-2 text-xs text-[#8e8e93] hover:text-black"
                                                  onClick={() => {
                                                    setSelectedImageForEditing(imageSet.Version2!)
                                                    setTimeout(() => {
                                                      const chatContainer = chatContainerRef.current
                                                      if (chatContainer) {
                                                        chatContainer.scrollTop = chatContainer.scrollHeight
                                                      }
                                                    }, 100)
                                                  }}
                                                >
                                                  <Settings className="w-3 h-3 mr-1" />
                                                  Edit
                                                </Button>
                                                <Button 
                                                  variant="ghost" 
                                                  size="sm" 
                                                  className="h-6 px-2 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50" 
                                                  onClick={() => handlePmaxGenerate(imageSet.Version2!)}
                                                >
                                                  <Sparkles className="w-3 h-3 mr-1" />
                                                  PMAX
                                                </Button>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                  disabled={upscalingUrls.includes(imageSet.Version2!)}
                                                  onClick={() => handleUpscaleImage(imageSet.Version2!)}
                                                >
                                                  {upscalingUrls.includes(imageSet.Version2!) ? (
                                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                  ) : (
                                                    <ArrowUp className="w-3 h-3 mr-1" />
                                                  )}
                                                  2K
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-[#8e8e93] hover:text-black" onClick={() => handleDownload(imageSet.Version2!)}>
                                                  <Download className="w-3 h-3 mr-1" />
                                                  DL
                                                </Button>
                                              </div>
                                              <p className="text-[10px] text-[#9ca3af] mt-1">Version 2</p>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
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

                {/* PMAX Toggle */}
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => setIsPmaxEnabled(!isPmaxEnabled)}
                    className={`flex-shrink-0 px-3 h-8 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-all ${
                      isPmaxEnabled
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm"
                        : "bg-white border border-[#d1d1d6] text-[#8e8e93] hover:border-purple-300 hover:text-purple-600"
                    }`}
                    title="สร้างชุดรูปภาพสำหรับ Performance Max"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>PMAX</span>
                  </button>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
                      สร้างชุดรูปภาพสำหรับ Performance Max
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    filteredMessages.length === 0
                      ? "อธิบายภาพที่ต้องการสร้าง หรือแนบรูปอ้างอิง..."
                      : "พิมพ์คำสั่งแก้ไขภาพ เช่น เปลี่ยนสีให้สดใสขึ้น..."
                  }
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
                {!selectedClientId || selectedClientId === "" ? (
                  <p className="text-[11px] text-[#9ca3af]">
                    {pendingImages.length > 0
                      ? `แนบรูปใหม่ ${pendingImages.length}/${MAX_REFERENCE_SELECTION}`
                      : "💡 Freestyle Mode: อธิบายภาพที่ต้องการ หรือแนบรูปอ้างอิง • เลือกลูกค้าเพื่อใช้ข้อมูลแบรนด์"
                    }
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] text-[#c7c7cc]">
                      {pendingImages.length > 0
                        ? `แนบรูปใหม่ ${pendingImages.length}/${MAX_REFERENCE_SELECTION}`
                        : "จะใช้ภาพที่สร้างล่าสุดเป็น Reference • กด 📷 แนบรูปใหม่ หรือ Ctrl+V วาง"
                      }
                    </p>
                    <p className="text-[11px] text-[#c7c7cc]">
                      {aspectRatio} • {resolvedClientName}
                    </p>
                  </>
                )}
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
