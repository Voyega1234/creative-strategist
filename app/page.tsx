"use client"

import Image from "next/image"
import Link from "next/link"
import { useState, useEffect, Suspense, memo, useCallback, useMemo, useRef } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
// Optimize imports - only import what we need
import {
  ChevronUp,
  Plus,
  User,
  Bookmark,
  Settings,
  History,
  Sparkles,
  RefreshCcw,
  Share2,
  ThumbsUp,
  ThumbsDown,
  BookmarkCheck,
  Images,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  Link2,
  Copy,
  Check,
  X,
  Home,
} from "lucide-react"
import { FeedbackForm } from "@/components/feedback-form"
import { IdeaDetailModal } from "@/components/idea-detail-modal"
import { SessionHistory } from "@/components/session-history"
import { SavedIdeas } from "@/components/saved-ideas"
import { AITypingAnimation } from "@/components/ai-typing-animation"
import { LoadingPopup } from "@/components/loading-popup"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { sessionManager } from "@/lib/session-manager"

// Types for ideas
export interface IdeaRecommendation {
  title: string;
  description: {
    summary: string;
    sections: Array<{
      group: 'pain' | 'insight_solution' | 'why_evidence';
      bullets: string[];
    }>;
  } | Array<{
    label: 'Pain' | 'Insight' | 'Solution/Product fit' | 'Why this converts' | 'Evidence/Counterpoint';
    text: string;
  }> | string; // Support old, intermediate, and new formats
  category: string;
  concept_type: 'Proven Concept' | 'New Concept';
  impact?: 'Proven Concept' | 'New Concept';
  competitiveGap: string;
  tags: string[];
  content_pillar: string;
  product_focus: string;
  concept_idea: string;
  copywriting: {
    headline: string;
    sub_headline_1: string;
    sub_headline_2: string;
    bullets: string[];
    cta: string;
  };
}

const normalizeIdea = (idea: any): IdeaRecommendation => {
  const conceptType = idea?.concept_type || idea?.impact || 'Proven Concept';
  return {
    ...idea,
    concept_type: conceptType,
    impact: conceptType,
  } as IdeaRecommendation;
};

type ClientWithProductFocus = {
  id: string
  clientName: string
  productFocuses: Array<{
    id: string
    productFocus: string
  }>
}

// Memoized IdeaCard component for better performance
const IdeaCard = memo(({ topic, index, isSaved, onDetailClick, onSaveClick, onFeedback, onShare }: {
  topic: IdeaRecommendation;
  index: number;
  isSaved: boolean;
  onDetailClick: (topic: IdeaRecommendation) => void;
  onSaveClick: (topic: IdeaRecommendation, index: number) => void;
  onFeedback: (topic: IdeaRecommendation, type: 'good' | 'bad') => void;
  onShare: (topic: IdeaRecommendation, index: number) => void;
}) => {
  return (
    <Card className="bg-white border border-[#e4e7ec] rounded-xl p-6 hover:shadow-md hover:border-[#1d4ed8] transition-all duration-200 relative">
        {/* Concept Type Badge */}
        {topic.concept_type && (
          <div className="mb-4">
            <Badge className={`text-white text-xs px-3 py-1 rounded-full ${
              topic.concept_type === 'Proven Concept' ? 'bg-blue-500' :
              topic.concept_type === 'New Concept' ? 'bg-purple-500' : 'bg-gray-500'
            }`}>
              {topic.concept_type}
            </Badge>
          </div>
        )}

        {/* Action Buttons - Top Right */}
        <div className="absolute top-3 right-3 flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-purple-50 rounded-full bg-white/90 shadow-sm border border-gray-100"
            onClick={(e) => {
              e.stopPropagation()
              onShare(topic, index)
            }}
            title="Share idea"
          >
            <Share2 className="h-4 w-4 text-gray-400 hover:text-purple-600" />
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-blue-50 rounded-full bg-white/90 shadow-sm border border-gray-100"
            onClick={(e) => {
              e.stopPropagation()
              onSaveClick(topic, index)
            }}
            title={isSaved ? "Remove bookmark" : "Save idea"}
          >
            {isSaved ? (
              <BookmarkCheck className="h-4 w-4 text-blue-600" />
            ) : (
              <Bookmark className="h-4 w-4 text-gray-400 hover:text-blue-600" />
            )}
          </Button>
      </div>

      {/* Content - clickable area */}
      <div 
        className="space-y-4 cursor-pointer"
        onClick={() => onDetailClick(topic)}
      >
        <div>
          <Badge variant="outline" className="text-xs bg-gray-50 mb-3 border-[#e4e7ec]">
            {topic.content_pillar}
          </Badge>
          <h4 className="text-lg font-bold text-[#000000] leading-tight mb-2">
            {topic.title || topic.concept_idea}
          </h4>
          {topic.copywriting?.headline && (
            <div className="mt-2 rounded-md border border-[#e4e7ec] bg-[#f9fbff] px-3 py-2">
              <span className="block text-[11px] uppercase tracking-wide text-[#64748b] mb-1">
                Headline
              </span>
              <p className="text-sm font-medium text-[#0f172a] leading-snug">
                {topic.copywriting.headline}
              </p>
            </div>
          )}
          {topic.copywriting?.sub_headline_1 && (
            <p className="text-[#525d7a] text-sm leading-snug mt-2">
              <span className="font-semibold text-[#1d4ed8] uppercase text-[11px] tracking-wide mr-2">
                Sub Headline 1
              </span>
              {topic.copywriting.sub_headline_1}
            </p>
          )}
          {topic.copywriting?.sub_headline_2 && (
            <p className="text-[#525d7a] text-sm leading-snug mt-1">
              <span className="font-semibold text-[#1d4ed8] uppercase text-[11px] tracking-wide mr-2">
                Sub Headline 2
              </span>
              {topic.copywriting.sub_headline_2}
            </p>
          )}
          {topic.title && topic.concept_idea && topic.concept_idea !== topic.title && (
            <p className="text-[#475569] text-sm mt-3 leading-snug">
              <span className="font-semibold text-[#1d4ed8] uppercase text-[11px] tracking-wide mr-2">
                Core Concept
              </span>
              {topic.concept_idea}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {(topic.tags || []).slice(0, 3).map(tag => (
              <Badge key={tag} variant="outline" className="text-xs border-[#e4e7ec]">
                {tag}
              </Badge>
            ))}
          </div>
          
          {/* Feedback Buttons - Bottom Right */}
          <div className="flex gap-1 ml-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 hover:bg-green-50 rounded-full"
              onClick={(e) => {
                e.stopPropagation()
                onFeedback(topic, 'good')
              }}
              title="Good feedback"
            >
              <ThumbsUp className="h-3.5 w-3.5 text-gray-400 hover:text-green-600" />
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 hover:bg-red-50 rounded-full"
              onClick={(e) => {
                e.stopPropagation()
                onFeedback(topic, 'bad')
              }}
              title="Bad feedback"
            >
              <ThumbsDown className="h-3.5 w-3.5 text-gray-400 hover:text-red-600" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
})

IdeaCard.displayName = 'IdeaCard'

// Client component that uses useSearchParams
function MainContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [topics, setTopics] = useState<IdeaRecommendation[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [instructions, setInstructions] = useState("")
  const [clients, setClients] = useState<ClientWithProductFocus[]>([])
  const [isLoadingClients, setIsLoadingClients] = useState(false)
  const [feedbackFormOpen, setFeedbackFormOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedDetailIdea, setSelectedDetailIdea] = useState<IdeaRecommendation | null>(null)
  const [selectedFeedbackIdea, setSelectedFeedbackIdea] = useState<IdeaRecommendation | null>(null)
  const [savedTitles, setSavedTitles] = useState<string[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [selectedModel] = useState<string>("Gemini 2.5 Pro")
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')
  const [isSharing, setIsSharing] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [savedIdeasModalOpen, setSavedIdeasModalOpen] = useState(false)
  const [isBrandOpen, setIsBrandOpen] = useState(true)
  const [isHistoryOpen, setIsHistoryOpen] = useState(true)
  const [showResults, setShowResults] = useState(false)
  const [sidebarHistory, setSidebarHistory] = useState<any[]>([])
  const [isLoadingSidebarHistory, setIsLoadingSidebarHistory] = useState(false)
  const [isNavigatingToConfigure, setIsNavigatingToConfigure] = useState(false)
  const [isNavigatingToNewClient, setIsNavigatingToNewClient] = useState(false)
  const [isNavigatingToImages, setIsNavigatingToImages] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isImprovingPrompt, setIsImprovingPrompt] = useState(false)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [shareSuccess, setShareSuccess] = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const taskPollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const taskTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const taskContextRef = useRef<{
    mode: 'initial' | 'append'
    finalInstructions: string
    selectedTemplate: string | null
    selectedModel: string
    existingConceptIdeas?: string[]
    clientName: string
    productFocus: string | null
  } | null>(null)

  const [clientServices, setClientServices] = useState<string[]>([])
  const [isLoadingServices, setIsLoadingServices] = useState(false)
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [newServiceName, setNewServiceName] = useState("")
  const [isAddingService, setIsAddingService] = useState(false)
  const [serviceError, setServiceError] = useState<string | null>(null)
  const [clientSearch, setClientSearch] = useState("")
  
  // Individual idea share state
  const [individualShareDialogOpen, setIndividualShareDialogOpen] = useState(false)
  const [individualShareSuccess, setIndividualShareSuccess] = useState(false)
  const [selectedShareIdea, setSelectedShareIdea] = useState<IdeaRecommendation | null>(null)
  const [isIndividualSharing, setIsIndividualSharing] = useState(false)
  const [currentShareUrl, setCurrentShareUrl] = useState<string | null>(null)
  
  // Product details state
  const [showProductDetails, setShowProductDetails] = useState(false)
  const [productDetails, setProductDetails] = useState("")
  
  // Negative prompts state
  const [negativePrompts, setNegativePrompts] = useState<string[]>([])
  const [negativePromptInput, setNegativePromptInput] = useState("")
  
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  
  // Get URL parameters
  const urlProductFocus = searchParams.get('productFocus') || null
  const urlClientName = searchParams.get('clientName') || null
  const urlClientId = searchParams.get('clientId') || null
  
  // State to track resolved client info
  const [resolvedClientInfo, setResolvedClientInfo] = useState<{
    clientName: string;
    productFocus: string | null;
    clientId: string | null;
    adAccount: string | null;
  }>({
    clientName: "No Client Selected",
    productFocus: null,
    clientId: null,
    adAccount: null
  })

  // Derive active values from resolved info
  const activeClientName = resolvedClientInfo.clientName
  const activeProductFocus = resolvedClientInfo.productFocus
  const activeClientId = resolvedClientInfo.clientId
  const activeAdAccount = resolvedClientInfo.adAccount
  const normalizedClientSearch = clientSearch.trim().toLowerCase()
  const filteredClients = useMemo(() => {
    if (!normalizedClientSearch) {
      return clients
    }
    return clients.filter((client) => client.clientName.toLowerCase().includes(normalizedClientSearch))
  }, [clients, normalizedClientSearch])
  const orderedClients = useMemo(() => {
    const activeClient = filteredClients.find((client) => client.clientName === activeClientName)
    const otherClients = filteredClients.filter((client) => client.clientName !== activeClientName)
    return activeClient ? [activeClient, ...otherClients] : filteredClients
  }, [filteredClients, activeClientName])
  const selectedServicesLabel = useMemo(() => {
    if (selectedServices.length === 0) {
      return "All Services"
    }
    if (selectedServices.length === 1) {
      return selectedServices[0]
    }
    if (selectedServices.length === 2) {
      return selectedServices.join(", ")
    }
    return `${selectedServices.length} services selected`
  }, [selectedServices])
  const selectedServicesText = useMemo(() => {
    if (selectedServices.length === 0) {
      return undefined
    }
    return selectedServices.join(", ")
  }, [selectedServices])
  
  const pathname = usePathname()

  const activeClientRecord = useMemo(() => {
    if (!activeClientName || activeClientName === "No Client Selected") {
      return null
    }
    return clients.find(client => client.clientName === activeClientName) || null
  }, [clients, activeClientName])

  const activeProductFocusEntry = useMemo(() => {
    if (!activeClientRecord) {
      return null
    }
    if (activeProductFocus) {
      const matched = activeClientRecord.productFocuses.find(pf => pf.productFocus === activeProductFocus)
      if (matched) {
        return matched
      }
    }
    return activeClientRecord.productFocuses[0] || null
  }, [activeClientRecord, activeProductFocus])

  const configureUrl = useMemo(() => {
    if (!activeClientName || activeClientName === "No Client Selected") {
      return "/configure"
    }
    const params = new URLSearchParams()
    const effectiveClientId = activeClientId || activeProductFocusEntry?.id || activeClientRecord?.id
    if (effectiveClientId) {
      params.set("clientId", String(effectiveClientId))
    }
    params.set("clientName", activeClientName)
    if (activeProductFocusEntry?.productFocus) {
      params.set("productFocus", activeProductFocusEntry.productFocus)
    }
    const query = params.toString()
    return query ? `/configure?${query}` : "/configure"
  }, [activeClientName, activeClientId, activeProductFocusEntry, activeClientRecord])

  const imagesUrl = useMemo(() => {
    if (!activeClientName || activeClientName === "No Client Selected") {
      return "/images"
    }
    const params = new URLSearchParams()
    const productFocusId = activeProductFocusEntry?.id || activeClientRecord?.id
    if (productFocusId) {
      params.set("clientId", String(productFocusId))
    }
    params.set("clientName", activeClientName)
    if (activeProductFocusEntry?.productFocus) {
      params.set("productFocus", activeProductFocusEntry.productFocus)
    }
    const query = params.toString()
    return query ? `/images?${query}` : "/images"
  }, [activeClientName, activeProductFocusEntry, activeClientRecord])

  // Model options and templates
  const modelOptions = [
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    { id: "gpt-4o", name: "GPT-4o" }
  ]
  
  const briefTemplates = [
    {
      id: "pain-point",
      title: "เขียนคอนเทนต์โปรโมชั่น เพื่อกระตุ้นยอดขายแบบเพลิดเพลิน",
      content: "I want you to generate ideas that directly address a key pain point of our target customers, and clearly show how our product or service uniquely solves this problem."
    },
    {
      id: "brand-engagement",
      title: "คิดไอเดียคอนเทนต์เพื่อสร้างการตอบรับแบรนด์",
      content: "Please create ideas that leverage real or hypothetical testimonials—showing authentic customer voices and how their lives improved after using our product or service."
    },
    {
      id: "content-planning",
      title: "ช่วยวางแผนคอนเทนต์รายสัปดาห์ / อีสีลีพอด 5 วัน สำหรับสินค้าของ",
      content: "Develop ideas that use 'before and after' scenarios, direct comparisons, or transformation stories to vividly illustrate the difference our product or service makes."
    },
    {
      id: "tiktok-ideas",
      title: "คิดไอเดียสมุด TikTok โปรโมชันแบรนด์สินค้า",
      content: "I want you to come up with ideas that highlight unusual, overlooked, or unexpected ways our product or service can be used, providing fresh perspectives that competitors aren't talking about."
    }
  ]

  // Check authentication on mount
  useEffect(() => {
    const checkAuthStatus = () => {
      try {
        const authData = localStorage.getItem('creative_strategist_auth')
        if (authData) {
          const { timestamp, authenticated } = JSON.parse(authData)
          const now = Date.now()
          const oneWeek = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
          
          // Check if authentication is still valid (within 7 days)
          if (authenticated && (now - timestamp) < oneWeek) {
            setIsAuthenticated(true)
          } else {
            // Remove expired auth
            localStorage.removeItem('creative_strategist_auth')
          }
        }
      } catch (error) {
        console.error('Error checking auth status:', error)
        localStorage.removeItem('creative_strategist_auth')
      }
      setIsCheckingAuth(false)
    }
    
    checkAuthStatus()
  }, [])

  // Function to load clients - simplified to match configure-sidebar exactly
  const loadClients = async () => {
    try {
      setIsLoadingClients(true)
      console.log('[main-page] Loading clients...')
      
      const response = await fetch('/api/clients-with-product-focus')
      if (response.ok) {
        const clientsData = await response.json()
        console.log(`[main-page] Loaded ${clientsData.length} clients:`, clientsData.map((c: any) => c.clientName))
        setClients(clientsData)
      } else {
        console.error('[main-page] Failed to load clients:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('[main-page] Error loading clients:', error)
    } finally {
      setIsLoadingClients(false)
    }
  }

  // Load clients on mount
  useEffect(() => {
    loadClients()
  }, [])

  useEffect(() => {
    if (!activeClientId) {
      setClientServices([])
      setSelectedServices([])
      return
    }

    let isCancelled = false
    const controller = new AbortController()

    const fetchServices = async () => {
      try {
        setIsLoadingServices(true)
        const response = await fetch(`/api/client-services?clientId=${encodeURIComponent(activeClientId)}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch services: ${response.status}`)
        }

        const data = await response.json()
        if (isCancelled) return

        const services = Array.isArray(data.services) ? data.services.slice().sort((a: string, b: string) => a.localeCompare(b, "th")) : []
        setClientServices(services)
        setSelectedServices((prev) => prev.filter((service) => services.includes(service)))
      } catch (error) {
        if (isCancelled) return
        console.error("Error loading services:", error)
        setClientServices([])
        setSelectedServices([])
      } finally {
        if (!isCancelled) {
          setIsLoadingServices(false)
        }
      }
    }

    fetchServices()

    return () => {
      isCancelled = true
      controller.abort()
    }
  }, [activeClientId, activeProductFocusEntry?.id])

  // Removed automatic refresh on visibility change to prevent excessive API calls
  // The 1-minute cache will handle data freshness

  // Resolve client info from URL parameters and clients list
  useEffect(() => {
    if (clients.length === 0) return

    console.log('[main-page] Resolving client info from URL:', {
      urlClientId,
      urlClientName,
      urlProductFocus
    })

    let resolvedInfo = {
      clientName: "No Client Selected",
      productFocus: null as string | null,
      clientId: null as string | null,
      adAccount: null as string | null
    }

    if (urlClientId) {
      // Find client by clientId (could be client.id or productFocus.id)
      const clientByMainId = clients.find(client => client.id === urlClientId)
      if (clientByMainId) {
        resolvedInfo = {
          clientName: clientByMainId.clientName,
          productFocus: urlProductFocus || (clientByMainId.productFocuses[0]?.productFocus || null),
          clientId: urlClientId,
          adAccount: null
        }
      } else {
        // Check if it's a productFocus id
        for (const client of clients) {
          const productFocus = client.productFocuses.find(pf => pf.id === urlClientId)
          if (productFocus) {
            resolvedInfo = {
              clientName: client.clientName,
              productFocus: productFocus.productFocus,
              clientId: urlClientId,
              adAccount: null
            }
            break
          }
        }
      }
    } else if (urlClientName) {
      // Find client by name
      const clientByName = clients.find(client => client.clientName === urlClientName)
      if (clientByName) {
        const productFocus = urlProductFocus ? 
          clientByName.productFocuses.find(pf => pf.productFocus === urlProductFocus) :
          clientByName.productFocuses[0]
        
        resolvedInfo = {
          clientName: clientByName.clientName,
          productFocus: productFocus?.productFocus || null,
          clientId: productFocus?.id || clientByName.id,
          adAccount: null
        }
      }
    }

    console.log('[main-page] Resolved client info:', resolvedInfo)
    setResolvedClientInfo(resolvedInfo)

    // Fetch ad account if we have a clientId
    if (resolvedInfo.clientId && resolvedInfo.clientName !== "No Client Selected") {
      fetchClientAdAccount(resolvedInfo.clientId)
    }

    // If we couldn't resolve the client, try refreshing once
    if (urlClientId && resolvedInfo.clientName === "No Client Selected" && !isLoadingClients) {
      console.log(`[main-page] ClientId ${urlClientId} not found in current clients, refreshing once...`)
      console.log('[main-page] Current client IDs:', clients.map(c => `${c.clientName}:${c.id}`))
      loadClients()
    }
  }, [clients, urlClientId, urlClientName, urlProductFocus])


  // Load ideas from localStorage when component mounts or client/product focus changes
  useEffect(() => {
    if (activeClientName && activeProductFocus && activeClientName !== 'No Client Selected') {
      const storedIdeas = loadIdeasFromStorage(activeClientName, activeProductFocus)
      if (storedIdeas.length > 0) {
        setTopics(storedIdeas)
        console.log(`Loaded ${storedIdeas.length} ideas from localStorage for ${activeClientName} - ${activeProductFocus}`)
      } else {
        setTopics([])
      }
    } else {
      setTopics([])
    }
  }, [activeClientName, activeProductFocus])

  // Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission)
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          setNotificationPermission(permission)
        })
      }
    }
  }, [])

  // Auto-load session history and latest ideas when client changes
  useEffect(() => {
    setSidebarHistory([])
    setIsHistoryOpen(true)
    setShowResults(false)
    setTopics([])

    // Automatically load session history for the new client
    if (activeClientName && activeClientName !== "No Client Selected") {
      console.log(`🔄 Auto-loading session history and latest ideas for client: ${activeClientName}`)
      loadSidebarHistory()
      
      // Also automatically load the latest session ideas
      loadLatestSessionIdeas()
    }
  }, [activeClientName])

  // Lazy load saved titles - only fetch when results are shown
  useEffect(() => {
    if (showResults && topics.length > 0 && activeClientName && activeProductFocus) {
      fetchSavedTitles()
    }
  }, [showResults, topics.length, activeClientName, activeProductFocus])

  // Enhanced notification sound with background tab support
  const [pendingNotification, setPendingNotification] = useState<boolean>(false)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null)
  
  // Initialize Web Audio API for reliable background audio
  useEffect(() => {
    const initAudio = async () => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        setAudioContext(ctx)
        
        // Preload audio buffer
        const response = await fetch('/new-notification-011-364050.mp3')
        const arrayBuffer = await response.arrayBuffer()
        const buffer = await ctx.decodeAudioData(arrayBuffer)
        setAudioBuffer(buffer)
        
        console.log('✅ Audio system initialized')
      } catch (error) {
        console.error('❌ Failed to initialize audio:', error)
      }
    }
    
    initAudio()
  }, [])

  // Handle page visibility change for pending notifications
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && pendingNotification) {
        console.log('🔔 Tab is now visible, clearing pending notification visual indicator')
        // Audio was already played, just clear the visual notification
        setPendingNotification(false)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [pendingNotification])

  // Update page title when notification is pending
  useEffect(() => {
    const originalTitle = document.title
    
    if (pendingNotification) {
      document.title = '🔔 ไอเดียสร้างเสร็จแล้ว! - Creative Compass'
      
      // Flash title for attention
      const flashInterval = setInterval(() => {
        document.title = document.title.startsWith('🔔') 
          ? 'Creative Compass' 
          : '🔔 ไอเดียสร้างเสร็จแล้ว! - Creative Compass'
      }, 1000)
      
      return () => {
        clearInterval(flashInterval)
        document.title = originalTitle
      }
    } else {
      document.title = originalTitle
    }
  }, [pendingNotification])

  function getStorageKey(clientName: string, productFocus: string) {
    return `ideas_${clientName}_${productFocus}`
  }

  function saveIdeasToStorage(ideas: IdeaRecommendation[], clientName: string, productFocus: string) {
    try {
      const key = getStorageKey(clientName, productFocus)
      const normalized = ideas.map(normalizeIdea)
      localStorage.setItem(key, JSON.stringify({
        ideas: normalized,
        timestamp: Date.now(),
        clientName,
        productFocus
      }))
    } catch (error) {
      console.error('Error saving ideas to localStorage:', error)
    }
  }

  function loadIdeasFromStorage(clientName: string, productFocus: string): IdeaRecommendation[] {
    try {
      const key = getStorageKey(clientName, productFocus)
      const stored = localStorage.getItem(key)
      if (stored) {
        const data = JSON.parse(stored)
        const now = Date.now()
        const timeDiff = now - data.timestamp
        if (timeDiff < 24 * 60 * 60 * 1000) {
          return (data.ideas || []).map(normalizeIdea)
        }
      }
    } catch (error) {
      console.error('Error loading ideas from localStorage:', error)
    }
    return []
  }

  // Immediate audio playback function
  const playNotificationSoundImmediate = async () => {
    try {
      // Method 1: Web Audio API (works better in background)
      if (audioContext && audioBuffer) {
        // Resume audio context if suspended (required by browsers)
        if (audioContext.state === 'suspended') {
          await audioContext.resume()
          console.log('📢 Audio context resumed')
        }
        
        const source = audioContext.createBufferSource()
        const gainNode = audioContext.createGain()
        
        source.buffer = audioBuffer
        gainNode.gain.value = 0.5
        
        source.connect(gainNode)
        gainNode.connect(audioContext.destination)
        
        source.start(0)
        console.log('🔊 Notification sound played via Web Audio API')
        return
      }
      
      // Method 2: HTML5 Audio fallback
      const audio = new Audio('/new-notification-011-364050.mp3')
      audio.volume = 0.5
      audio.play().then(() => {
        console.log('🔊 Notification sound played via HTML5 Audio')
      }).catch(error => {
        console.error('❌ Could not play notification sound:', error)
      })
      
    } catch (error) {
      console.error('❌ Could not initialize notification sound:', error)
    }
  }

  // Smart notification function that handles background tabs
  const playNotificationSound = async () => {
    console.log('🔔 Notification triggered, tab hidden:', document.hidden)
    
    // Always play sound immediately, regardless of tab visibility
    await playNotificationSoundImmediate()
    
    if (document.hidden) {
      // Tab is in background, also set pending notification for visual feedback
      setPendingNotification(true)
      console.log('📝 Audio played immediately, pending notification set for visual feedback')
    } else {
      console.log('🔊 Audio played immediately on visible tab')
    }
  }

  // Function to show browser notification
  const showNotification = (title: string, message: string, ideaCount: number) => {
    if (notificationPermission === 'granted') {
      const notification = new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'idea-generation',
        requireInteraction: true,
        data: { ideaCount }
      })

      notification.onclick = () => {
        window.focus()
        notification.close()
        // Clear pending notification when user clicks
        setPendingNotification(false)
      }

      setTimeout(() => notification.close(), 10000)
    }
  }

  const stopTaskPolling = useCallback(() => {
    if (taskPollingRef.current) {
      clearInterval(taskPollingRef.current)
      taskPollingRef.current = null
    }
    if (taskTimeoutRef.current) {
      clearTimeout(taskTimeoutRef.current)
      taskTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      stopTaskPolling()
    }
  }, [stopTaskPolling])

  const processTaskResult = useCallback(
    (result: any, context: NonNullable<typeof taskContextRef.current>) => {
      const rawIdeas: any[] = Array.isArray(result?.ideas)
        ? result.ideas
        : Array.isArray(result?.data?.ideas)
          ? result.data.ideas
          : []

      const ideas: IdeaRecommendation[] = rawIdeas.map(normalizeIdea)

      if (!ideas || ideas.length === 0) {
        setIsGenerating(false)
        setIsLoadingMore(false)
        alert('No ideas returned from generator. Please try again.')
        return
      }

      const clientName = context.clientName
      const productFocus = context.productFocus

      if (context.mode === 'append') {
        let mergedIdeas: IdeaRecommendation[] = []
        setTopics(prevTopics => {
          const existingConcepts = new Set(
            prevTopics.map(topic => topic.concept_idea || topic.title || '')
          )

          const freshIdeas = ideas.filter(idea => {
            const key = idea.concept_idea || idea.title || ''
            if (!key) return true
            if (existingConcepts.has(key)) {
              return false
            }
            existingConcepts.add(key)
            return true
          })

          mergedIdeas = [...prevTopics, ...freshIdeas]
          return mergedIdeas
        })

        if (clientName && productFocus && mergedIdeas.length > 0) {
          saveIdeasToStorage(mergedIdeas, clientName, productFocus)

          sessionManager.saveSession({
            clientName,
            productFocus,
            n8nResponse: result?.n8nResponse || { ideas: mergedIdeas },
            userInput: context.finalInstructions,
            selectedTemplate: context.selectedTemplate || undefined,
            modelUsed: context.selectedModel,
          }).then(success => {
            console.log(success ? '✅ Appended session saved' : '❌ Failed to save appended session')
          }).catch(error => {
            console.warn('⚠️ Failed to save combined ideas session (non-critical):', error)
          })
        }

        const addedCount = ideas.length
        const totalAfterAppend = mergedIdeas.length
        playNotificationSound()
        showNotification(
          '🎉 เพิ่มไอเดียใหม่แล้ว!',
          `เพิ่มไอเดียอีก ${addedCount} ข้อ • รวมทั้งหมด ${totalAfterAppend} ข้อ`,
          addedCount
        )
      } else {
        setTopics(ideas)
        if (clientName && productFocus) {
          saveIdeasToStorage(ideas, clientName, productFocus)

          sessionManager.saveSession({
            clientName,
            productFocus,
            n8nResponse: result?.n8nResponse || { ideas },
            userInput: context.finalInstructions,
            selectedTemplate: context.selectedTemplate || undefined,
            modelUsed: context.selectedModel,
          }).then(success => {
            console.log(success ? '✅ Session save initiated successfully' : '❌ Session save failed')
          }).catch(error => {
            console.error('❌ Session save failed (non-critical):', error)
          })
        }

        playNotificationSound()
        showNotification(
          '🎉 ไอเดียสร้างเสร็จแล้ว!',
          `สร้างไอเดีย ${ideas.length} ข้อสำเร็จแล้วสำหรับ ${clientName}`,
          ideas.length
        )
      }

      setShowResults(true)
      setIsGenerating(false)
      setIsLoadingMore(false)
      setCurrentTaskId(null)
      stopTaskPolling()
      taskContextRef.current = null
    },
    [saveIdeasToStorage, setTopics, sessionManager, setShowResults, stopTaskPolling, playNotificationSound, showNotification]
  )

  const startTaskPolling = useCallback(
    (taskId: string) => {
      stopTaskPolling()

      const poll = async () => {
        try {
          const response = await fetch(`/api/generate-ideas/status?taskId=${taskId}`)
          const data = await response.json()

          if (!data.success) {
            throw new Error(data.error || 'Failed to fetch task status')
          }

          if (data.status === 'completed') {
                const context = taskContextRef.current
                if (context) {
                  processTaskResult(data.result, context)
                } else {
                  setIsGenerating(false)
                  setIsLoadingMore(false)
                }
                return
          }

          if (data.status === 'failed') {
            stopTaskPolling()
            setCurrentTaskId(null)
            setIsGenerating(false)
            setIsLoadingMore(false)
            taskContextRef.current = null
            alert(data.error || 'Idea generation failed. Please try again.')
            return
          }
        } catch (error) {
          console.error('Error polling task status:', error)
        }
      }

      poll()
      taskPollingRef.current = setInterval(poll, 4000)
      if (taskTimeoutRef.current) {
        clearTimeout(taskTimeoutRef.current)
      }
      taskTimeoutRef.current = setTimeout(() => {
        stopTaskPolling()
        setCurrentTaskId(null)
        setIsGenerating(false)
        setIsLoadingMore(false)
        taskContextRef.current = null
        alert('การสร้างไอเดียใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง')
      }, 15 * 60 * 1000) // Changed from 10 to 15 minutes
    },
    [processTaskResult, stopTaskPolling]
  )

  const handleGenerateTopics = async () => {
    if (!activeClientName || activeClientName === "No Client Selected") {
      alert('กรุณาเลือกลูกค้าก่อน')
      return
    }
    
    if (!activeProductFocus) {
      alert('กรุณาเลือก Product Focus ก่อน')
      return
    }

    setIsGenerating(true)
    setIsLoadingMore(true)
    stopTaskPolling()

    try {
      const finalInstructions = instructions.trim() || " "
      const modelId = modelOptions.find(m => m.name === selectedModel)?.id || "gemini-2.5-pro"

      const response = await fetch('/api/generate-ideas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientName: activeClientName,
          productFocus: activeProductFocus,
          service: selectedServicesText,
          instructions: finalInstructions,
          productDetails: showProductDetails ? productDetails.trim() : undefined,
          negativePrompts: negativePrompts.length > 0 ? negativePrompts : undefined,
          hasProductDetails: showProductDetails,
          model: modelId,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success || !data.taskId) {
        const errorMessage = data.error || 'เกิดข้อผิดพลาดในการเริ่มการสร้างไอเดีย'
        console.error('[generate-ideas] Failed to enqueue task:', errorMessage)
        setIsGenerating(false)
        setIsLoadingMore(false)
        alert(errorMessage)
        return
      }

      taskContextRef.current = {
        mode: 'initial',
        finalInstructions,
        selectedTemplate,
        selectedModel: modelId,
        clientName: activeClientName,
        productFocus: activeProductFocus,
      }

      setCurrentTaskId(data.taskId)
      startTaskPolling(data.taskId)
    } catch (error) {
      console.error('Error generating topics:', error)
      setIsGenerating(false)
      setIsLoadingMore(false)
      alert('เกิดข้อผิดพลาดในการสร้างไอเดีย กรุณาลองใหม่อีกครั้ง')
    }
  }

  // Function to generate more ideas (avoiding duplicates)
  const handleGenerateMoreIdeas = async () => {
    if (!activeClientName || activeClientName === "No Client Selected") {
      alert('กรุณาเลือกลูกค้าก่อน')
      return
    }
    
    if (!activeProductFocus) {
      alert('กรุณาเลือก Product Focus ก่อน')
      return
    }

    setIsLoadingMore(true)
    stopTaskPolling()

    try {
      const existingConceptIdeas = topics.map(topic => topic.concept_idea).filter(Boolean)
      const finalInstructions = instructions.trim() || " "
      const modelId = modelOptions.find(m => m.name === selectedModel)?.id || "gemini-2.5-pro"

      const response = await fetch('/api/generate-ideas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientName: activeClientName,
          productFocus: activeProductFocus,
          service: selectedServicesText,
          instructions: finalInstructions,
          productDetails: showProductDetails ? productDetails.trim() : undefined,
          negativePrompts: negativePrompts.length > 0 ? negativePrompts : undefined,
          hasProductDetails: showProductDetails,
          model: modelId,
          existingConceptIdeas,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success || !data.taskId) {
        const errorMessage = data.error || 'เกิดข้อผิดพลาดในการเริ่มการสร้างไอเดียเพิ่มเติม'
        console.error('[generate-ideas] Failed to enqueue more ideas task:', errorMessage)
        setIsLoadingMore(false)
        alert(errorMessage)
        return
      }

      taskContextRef.current = {
        mode: 'append',
        finalInstructions,
        selectedTemplate,
        selectedModel: modelId,
        existingConceptIdeas,
        clientName: activeClientName,
        productFocus: activeProductFocus,
      }

      setCurrentTaskId(data.taskId)
      startTaskPolling(data.taskId)
    } catch (error) {
      console.error('Error generating more ideas:', error)
      setIsLoadingMore(false)
      alert('เกิดข้อผิดพลาดในการสร้างไอเดียเพิ่มเติม กรุณาลองใหม่อีกครั้ง')
    }
  }

  // Function to check saved ideas
  const fetchSavedTitles = async () => {
    if (!activeClientName || !activeProductFocus) return
    
    try {
      const response = await fetch(`/api/save-idea?clientName=${encodeURIComponent(activeClientName)}&productFocus=${encodeURIComponent(activeProductFocus)}`)
      if (response.ok) {
        const data = await response.json()
        setSavedTitles(data.savedTitles || [])
      }
    } catch (error) {
      console.error('Error fetching saved titles:', error)
    }
  }

  // Function to handle saving/unsaving ideas - instant UI update with background sync
  const handleSaveIdea = async (idea: IdeaRecommendation, index: number) => {
    console.log('🔍 handleSaveIdea called with:', {
      activeClientName,
      activeProductFocus,
      ideaTitle: idea.title
    })
    
    if (!activeClientName || !activeProductFocus) {
      console.warn('⚠️ Missing client info for save:', {
        activeClientName,
        activeProductFocus
      })
      return
    }
    
    const isSaved = savedTitles.includes(idea.title)
    const action = isSaved ? 'unsave' : 'save'
    
    // Instant UI update - silent success
    if (action === 'save') {
      setSavedTitles(prev => [...prev, idea.title])
    } else {
      setSavedTitles(prev => prev.filter(title => title !== idea.title))
    }
    
    // Submit in background without blocking UI
    saveLaterInBackground(idea, action, index)
  }

  // Background save submission
  const saveLaterInBackground = async (idea: IdeaRecommendation, action: 'save' | 'unsave', index: number) => {
    try {
      console.log('Saving idea:', { idea, clientName: activeClientName, productFocus: activeProductFocus, action })
      
      const response = await fetch('/api/save-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea,
          clientName: activeClientName,
          productFocus: activeProductFocus,
          action
        })
      })
      
      const result = await response.json()
      console.log('Save API response:', result)
      
      if (!response.ok) {
        console.error('Save API error:', result)
      }
    } catch (error) {
      console.error('Background save failed:', error)
      // Silently fail - user already got success message and UI updated
      // In a real app, you might want to revert the UI change on failure
    }
  }

  // Function to handle feedback - open modal for user input
  const handleFeedback = (idea: IdeaRecommendation, type: 'good' | 'bad') => {
    setSelectedFeedbackIdea(idea)
    setFeedbackFormOpen(true)
  }

  const handleTemplateSelect = (templateId: string) => {
    const template = briefTemplates.find(t => t.id === templateId)
    if (template) {
      if (selectedTemplate === templateId) {
        // If already selected, deselect it and clear input
        setSelectedTemplate(null)
        setInstructions("")
      } else {
        // Select the new template and auto-fill the input box
        setSelectedTemplate(templateId)
        setInstructions(template.content)
      }
    }
  }

  // Load sidebar history for current client
  const loadSidebarHistory = async () => {
    if (!activeClientName || activeClientName === "No Client Selected") {
      setSidebarHistory([])
      return
    }

    setIsLoadingSidebarHistory(true)
    try {
      const result = await sessionManager.getHistory({
        clientName: activeClientName,
        limit: 30 // Show last 30 sessions in dropdown
      })

      if (result.success) {
        console.log('📋 Session history loaded:', result.sessions)
        setSidebarHistory(result.sessions || [])
      }
    } catch (error) {
      console.error('Error loading sidebar history:', error)
    } finally {
      setIsLoadingSidebarHistory(false)
    }
  }

  // Handle history dropdown toggle - simplified since we auto-load
  const handleHistoryToggle = () => {
    setIsHistoryOpen(!isHistoryOpen)
    // No need to load here since we auto-load when client changes
  }

  // Fetch client ad account data
  const fetchClientAdAccount = async (clientId: string) => {
    try {
      console.log('🔄 Fetching ad account for clientId:', clientId)
      
      const response = await fetch(`/api/client-profile?clientId=${clientId}`)
      const result = await response.json()
      
      if (result.success && result.client?.ad_account_id) {
        console.log('✅ Found ad account:', result.client.ad_account_id)
        
        // Update the resolved client info with ad account
        setResolvedClientInfo(prev => ({
          ...prev,
          adAccount: result.client.ad_account_id
        }))
      } else {
        console.log('ℹ️ No ad account found for client')
      }
    } catch (error) {
      console.error('❌ Error fetching client ad account:', error)
    }
  }

  // Load the latest session ideas automatically
  const loadLatestSessionIdeas = async () => {
    if (!activeClientName || activeClientName === "No Client Selected") {
      return
    }

    try {
      console.log(`🎯 Auto-loading latest session ideas for client: ${activeClientName}`)
      
      const result = await sessionManager.getHistory({
        clientName: activeClientName,
        limit: 1 // Get only the most recent session
      })

      if (result.success && result.sessions && result.sessions.length > 0) {
        const latestSession = result.sessions[0]
        console.log('📖 Found latest session:', latestSession)
        
        // Load the ideas from the latest session
        loadSessionIdeas(latestSession)
      } else {
        console.log('ℹ️ No recent sessions found for client:', activeClientName)
        // Keep the input form visible if no recent sessions
        setShowResults(false)
        setTopics([])
      }
    } catch (error) {
      console.error('Error loading latest session ideas:', error)
      // Keep the input form visible on error
      setShowResults(false)
      setTopics([])
    }
  }

  // Load a specific session and show its ideas
  const loadSessionIdeas = async (session: any) => {
    try {
      console.log('🔄 Loading session ideas:', session)
      
      // Set the complete ideas from the session's n8nResponse
      if (session.n8nResponse?.ideas && session.n8nResponse.ideas.length > 0) {
        const normalized = session.n8nResponse.ideas.map(normalizeIdea)
        setTopics(normalized)
        setShowResults(true)
        
        // Also update form state to match the session
        setInstructions(session.userInput || "")
        if (session.selectedTemplate) {
          setSelectedTemplate(session.selectedTemplate)
        }
        
        console.log('✅ Session ideas loaded:', normalized.length, 'complete ideas with all fields')
      } else if (session.ideas && session.ideas.length > 0) {
        // Fallback to the simplified ideas if n8nResponse is not available
        const normalized = session.ideas.map(normalizeIdea)
        setTopics(normalized)
        setShowResults(true)
        console.log('✅ Session ideas loaded:', normalized.length, 'simplified ideas')
      } else {
        console.warn('⚠️ No ideas found in session:', session)
      }
    } catch (error) {
      console.error('Error loading session ideas:', error)
    }
  }

  const handleConfigureNavigation = useCallback(() => {
    if (isNavigatingToConfigure) return
    setIsNavigatingToConfigure(true)
    router.push(configureUrl)
  }, [configureUrl, isNavigatingToConfigure, router])

  // Handle product focus selection
  const handleProductFocusChange = (clientName: string, productFocusValue: string) => {
    const selectedClient = clients.find(client => client.clientName === clientName)
    const selectedProductFocus = selectedClient?.productFocuses.find(pf => pf.productFocus === productFocusValue)
    
    if (selectedClient && selectedProductFocus) {
      const newUrl = `?clientId=${selectedProductFocus.id}&clientName=${encodeURIComponent(clientName)}&productFocus=${encodeURIComponent(productFocusValue)}`
      router.push(newUrl)
    }
  }

  const handleServiceToggle = useCallback(
    (service: string | null) => {
      if (isGenerating) {
        return
      }
      if (service === null) {
        setSelectedServices([])
        return
      }
      setSelectedServices((prev) => {
        if (prev.includes(service)) {
          return prev.filter((item) => item !== service)
        }
        return [...prev, service]
      })
    },
    [isGenerating],
  )

  const handleAddService = useCallback(async () => {
    if (!activeClientId) {
      setServiceError("กรุณาเลือกลูกค้าก่อน")
      return
    }

    const value = newServiceName.trim()
    if (!value) {
      setServiceError("กรุณากรอกชื่อบริการ")
      return
    }

    if (clientServices.some((service) => service.toLowerCase() === value.toLowerCase())) {
      setServiceError("มีบริการนี้อยู่แล้ว")
      setSelectedServices((prev) => {
        if (prev.includes(value)) {
          return prev
        }
        return [...prev, value]
      })
      setNewServiceName("")
      return
    }

    try {
      setServiceError(null)
      setIsAddingService(true)
      const response = await fetch("/api/client-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: activeClientId, service: value }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to add service")
      }

      setClientServices((prev) => {
        const next = [...prev, value]
        next.sort((a, b) => a.localeCompare(b, "th"))
        return next
      })
      setSelectedServices((prev) => (prev.includes(value) ? prev : [...prev, value]))
      setNewServiceName("")
    } catch (error) {
      console.error("Failed to add service:", error)
      setServiceError("ไม่สามารถเพิ่มบริการได้ กรุณาลองใหม่")
    } finally {
      setIsAddingService(false)
    }
  }, [activeClientId, clientServices, newServiceName])

  const handleNewClientNavigation = useCallback(() => {
    if (isNavigatingToNewClient) return
    setIsNavigatingToNewClient(true)
    router.push('/new-client')
  }, [isNavigatingToNewClient, router])

  const mainUrl = useMemo(() => {
    if (!activeClientName || activeClientName === "No Client Selected") {
      return "/"
    }
    const params = new URLSearchParams()
    if (activeClientId) {
      params.set("clientId", String(activeClientId))
    }
    params.set("clientName", activeClientName)
    if (activeProductFocusEntry?.productFocus) {
      params.set("productFocus", activeProductFocusEntry.productFocus)
    }
    const query = params.toString()
    return query ? `/?${query}` : "/"
  }, [activeClientName, activeClientId, activeProductFocusEntry])

  const handleImagesNavigation = useCallback(() => {
    if (isNavigatingToImages) return
    setIsNavigatingToImages(true)
    router.push(imagesUrl)
  }, [imagesUrl, isNavigatingToImages, router])

  const handleMainNavigation = useCallback(() => {
    if (isGenerating) return
    router.push(mainUrl)
  }, [isGenerating, mainUrl, router])

  useEffect(() => {
    router.prefetch('/new-client')
  }, [router])

  useEffect(() => {
    router.prefetch(configureUrl)
    router.prefetch(imagesUrl)
  }, [router, configureUrl, imagesUrl])

  useEffect(() => {
    if (!pathname) return
    setIsNavigatingToConfigure(false)
    setIsNavigatingToImages(false)
    setIsNavigatingToNewClient(false)
  }, [pathname])

  // Memoized callbacks for better performance
  const handleDetailClick = useCallback((topic: IdeaRecommendation) => {
    setSelectedDetailIdea(topic)
    setDetailModalOpen(true)
  }, [])

  // Handle individual idea sharing
  const handleIndividualShare = useCallback((topic: IdeaRecommendation, index: number) => {
    setSelectedShareIdea(topic)
    setIndividualShareDialogOpen(true)
    setIndividualShareSuccess(false)
    setCurrentShareUrl(null) // Reset share URL for new idea
  }, [])

  // Auto-resize textarea function
  const autoResizeTextarea = useCallback((textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(Math.max(textarea.scrollHeight, 120), 400) + 'px'
  }, [])

  // Effect to auto-resize textarea when instructions change (from session loading, etc.)
  useEffect(() => {
    const textarea = document.querySelector('textarea[placeholder*="หรือใส่ความต้องการเฉพาะของคุณ"]') as HTMLTextAreaElement
    if (textarea && instructions) {
      autoResizeTextarea(textarea)
    }
  }, [instructions, autoResizeTextarea])

  const handleImprovePrompt = useCallback(async () => {
    if (isImprovingPrompt || !instructions.trim()) {
      return
    }

    setIsImprovingPrompt(true)
    try {
      const response = await fetch('/api/improve-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: instructions.trim(),
          clientName: activeClientName,
          productFocus: activeProductFocus,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        console.error('[prompt-enhancer] Error:', data?.error)
        alert(data?.error || 'ไม่สามารถปรับปรุงพรอมป์ได้ กรุณาลองใหม่อีกครั้ง')
        return
      }

      if (data.improvedPrompt) {
        setInstructions(data.improvedPrompt)
        setTimeout(() => {
          const textarea = document.querySelector(
            'textarea[placeholder*="หรือใส่ความต้องการเฉพาะของคุณ"]'
          ) as HTMLTextAreaElement | null
          if (textarea) {
            autoResizeTextarea(textarea)
          }
        }, 0)
      }
    } catch (error) {
      console.error('[prompt-enhancer] Unexpected error:', error)
      alert('เกิดข้อผิดพลาดในการปรับปรุงพรอมป์ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsImprovingPrompt(false)
    }
  }, [isImprovingPrompt, instructions, activeClientName, activeProductFocus, autoResizeTextarea])

  const handleShareIdeas = async () => {
    if (!topics.length) {
      alert('ไม่มีไอเดียที่จะแชร์')
      return
    }

    if (!activeClientName || activeClientName === "No Client Selected" || !activeProductFocus) {
      alert('กรุณาเลือกลูกค้าและ Product Focus ก่อนแชร์')
      return
    }

    setIsSharing(true)
    try {
      const response = await fetch('/api/share-ideas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ideas: topics.map(topic => ({
            // Only send essential fields to reduce payload
            title: topic.title,
            description: topic.description,
            category: topic.category,
            concept_type: topic.concept_type,
            competitiveGap: topic.competitiveGap,
            tags: topic.tags,
            content_pillar: topic.content_pillar,
            product_focus: topic.product_focus,
            concept_idea: topic.concept_idea,
            copywriting: topic.copywriting
          })),
          clientName: activeClientName,
          productFocus: activeProductFocus,
          instructions: instructions.trim() || null,
          model: selectedModel
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        await navigator.clipboard.writeText(data.shareUrl)
        setShareSuccess(true)
        // Link copied to clipboard silently
      } else {
        alert(`เกิดข้อผิดพลาด: ${data.error}`)
      }
    } catch (error) {
      console.error('Error sharing ideas:', error)
      alert('เกิดข้อผิดพลาดในการสร้างลิงก์แชร์')
    } finally {
      setIsSharing(false)
    }
  }

  // Handle individual idea sharing - create link AND copy to clipboard in one action
  const handleIndividualShareIdea = async () => {
    if (!selectedShareIdea) {
      alert('ไม่มีไอเดียที่เลือก')
      return
    }

    if (!activeClientName || activeClientName === "No Client Selected" || !activeProductFocus) {
      alert('กรุณาเลือกลูกค้าและ Product Focus ก่อนแชร์')
      return
    }

    setIsIndividualSharing(true)
    try {
      const response = await fetch('/api/share-ideas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ideas: [{
            title: selectedShareIdea.title,
            description: selectedShareIdea.description,
            category: selectedShareIdea.category,
            concept_type: selectedShareIdea.concept_type,
            competitiveGap: selectedShareIdea.competitiveGap,
            tags: selectedShareIdea.tags,
            content_pillar: selectedShareIdea.content_pillar,
            product_focus: selectedShareIdea.product_focus,
            concept_idea: selectedShareIdea.concept_idea,
            copywriting: selectedShareIdea.copywriting
          }],
          clientName: activeClientName,
          productFocus: activeProductFocus,
          instructions: `Individual idea: ${selectedShareIdea.title}`,
          model: selectedModel
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        // Auto-copy the link to clipboard immediately
        await navigator.clipboard.writeText(data.shareUrl)
        setCurrentShareUrl(data.shareUrl)
        setIndividualShareSuccess(true)
        console.log('Share URL created and copied:', data.shareUrl)
      } else {
        alert(`เกิดข้อผิดพลาด: ${data.error}`)
      }
    } catch (error) {
      console.error('Error sharing individual idea:', error)
      alert('เกิดข้อผิดพลาดในการสร้างลิงก์แชร์')
    } finally {
      setIsIndividualSharing(false)
    }
  }


  // Authentication function
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsAuthenticating(true)
    setPasswordError("")
    
    try {
      // Get password from env variable
      const correctPassword = process.env.NEXT_PUBLIC_ENTRY_PASSWORD
      
      if (password === correctPassword) {
        setIsAuthenticated(true)
        setPassword("") // Clear password from state for security
        
        // Save authentication to localStorage
        try {
          const authData = {
            authenticated: true,
            timestamp: Date.now()
          }
          localStorage.setItem('creative_strategist_auth', JSON.stringify(authData))
        } catch (storageError) {
          console.error('Error saving auth to localStorage:', storageError)
        }
      } else {
        setPasswordError("รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง")
      }
    } catch (error) {
      setPasswordError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง")
    }
    
    setIsAuthenticating(false)
  }

  // Logout function
  const handleLogout = () => {
    setIsAuthenticated(false)
    try {
      localStorage.removeItem('creative_strategist_auth')
    } catch (error) {
      console.error('Error removing auth from localStorage:', error)
    }
  }

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen bg-white items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#1d4ed8] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#8e8e93]">กำลังตรวจสอบการเข้าสู่ระบบ...</p>
        </div>
      </div>
    )
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen bg-white relative animate-in fade-in-0 duration-500">
        <div className="flex w-full relative z-10">
          {/* Left Panel - Branding */}
          <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
            <div 
              className="absolute inset-0"
              style={{
                backgroundImage: 'url("https://cfislibqbzcquplksmqt.supabase.co/storage/v1/object/public/image-creative-strategist-public/coolbackgrounds-topography-orleans.svg")',
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            />
            <div className="absolute inset-0 bg-[#0f172a]/70" />
            
            <div className="relative z-10 flex flex-col justify-center px-12 py-16 text-white">
              <div className="mb-8">
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
                  <Lock className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-4xl font-bold mb-4 leading-tight">
                  Creative Compass<br />Dashboard
                </h1>
                <p className="text-xl text-white/90 leading-relaxed">
                  เข้าสู่ระบบเพื่อเริ่มสร้างไอเดียคอนเทนต์และวิเคราะห์คู่แข่ง
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                  <span className="text-white/90">การสร้างไอเดียคอนเทนต์ด้วย AI</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                  <span className="text-white/90">การวิเคราะห์คู่แข่งเชิงลึก</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                  <span className="text-white/90">การค้นหารูปภาพอ้างอิง</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                  <span className="text-white/90">การจัดการข้อมูลลูกค้า</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Login Form */}
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="w-full max-w-md">
              <div className="text-center mb-8">
                <div className="lg:hidden w-12 h-12 bg-[#dbeafe] rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-6 h-6 text-[#1d4ed8]" />
                </div>
                <h2 className="text-3xl font-bold text-[#535862] mb-2">เข้าสู่ระบบ</h2>
                <p className="text-[#8e8e93]">กรุณาใส่รหัสผ่านเพื่อเข้าสู่ Creative Compass</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-[#535862] mb-2">
                    รหัสผ่าน
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="ใส่รหัสผ่าน"
                      className="pr-10 border-[#d1d1d6] focus:border-[#1d4ed8] focus:ring-0"
                      required
                      disabled={isAuthenticating}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#8e8e93] hover:text-[#535862]"
                      disabled={isAuthenticating}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordError && (
                    <p className="text-red-500 text-sm mt-2">{passwordError}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isAuthenticating || !password.trim()}
                  className="w-full bg-[#1d4ed8] hover:bg-[#063def] text-white py-3 rounded-lg font-medium transition-colors"
                >
                  {isAuthenticating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      กำลังตรวจสอบ...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      เข้าสู่ระบบ
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show main dashboard if authenticated
  return (
    <div className="flex h-screen bg-white relative overflow-hidden">
      <div 
        className="fixed inset-0 z-0 opacity-70"
        style={{
          backgroundImage: 'url("https://cfislibqbzcquplksmqt.supabase.co/storage/v1/object/public/image-creative-strategist-public/coolbackgrounds-topography-gulf.png")',
          backgroundSize: '800px',
          backgroundPosition: 'top right',
          backgroundRepeat: 'no-repeat'
        }}
      />
      <div className="flex w-full relative z-10">
        {/* Sidebar */}
        <aside className={`w-64 h-screen bg-white/90 backdrop-blur-sm p-6 border-r border-[#e4e7ec] flex flex-col overflow-hidden ${isGenerating ? 'pointer-events-none opacity-60' : ''}`}>
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-y-auto pr-2">
              <div className="flex items-center gap-2 mb-8">
                <Button
                  onClick={!isGenerating ? handleMainNavigation : undefined}
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-[#535862] hover:text-[#1d4ed8] hover:bg-[#f5f5f5]"
                  disabled={isGenerating}
                >
                  <Home className="h-4 w-4" />
                  <span className="sr-only">กลับหน้าหลัก</span>
                </Button>
                <h1 className="text-lg font-semibold text-[#000000]">Creative Compass</h1>
              </div>
              <Button
                onClick={!isGenerating && !isLoadingMore ? handleNewClientNavigation : undefined}
                variant="ghost"
                className="mb-4 w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]"
                disabled={isGenerating || isLoadingMore || isNavigatingToNewClient}
              >
                <Plus className="mr-2 h-4 w-4" />
                เพิ่มรายชื่อ
              </Button>
              <Input
                type="search"
                value={clientSearch}
                onChange={(event) => setClientSearch(event.target.value)}
                placeholder="ค้นหาชื่อลูกค้า"
                className="mb-4 h-9 text-sm border-[#e4e7ec] focus-visible:ring-0 focus-visible:border-[#1d4ed8]"
                disabled={isGenerating}
              />
              <nav className="space-y-2">
                <Collapsible open={isBrandOpen} onOpenChange={isGenerating ? undefined : setIsBrandOpen} className="w-full">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]"
                    disabled={isGenerating}
                  >
                    <User className="mr-2 h-4 w-4" />
                    แบรนด์
                    <ChevronUp
                      className={`ml-auto h-4 w-4 transition-transform ${isBrandOpen ? "rotate-0" : "rotate-180"}`}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 pl-8 pt-2">
                  <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                    {orderedClients.length > 0 ? (
                      orderedClients.map((client) => (
                        <div key={client.id} className="space-y-1">
                          {/* Client name - always show, highlight if active */}
                          {isGenerating ? (
                            <div
                              className={`block text-sm py-1 px-2 rounded-md font-medium cursor-not-allowed ${
                                client.clientName === activeClientName
                                  ? "text-[#063def] bg-[#dbeafe]"
                                  : "text-[#535862]"
                              }`}
                            >
                              {client.clientName}
                            </div>
                          ) : (
                            <Link
                              href={`?clientId=${client.productFocuses[0]?.id || client.id}&clientName=${encodeURIComponent(client.clientName)}&productFocus=${encodeURIComponent(client.productFocuses[0]?.productFocus || "")}`}
                              className={`block text-sm py-1 px-2 rounded-md font-medium ${
                                client.clientName === activeClientName
                                  ? "text-[#063def] bg-[#dbeafe]"
                                  : "text-[#535862] hover:text-[#063def] hover:bg-[#dbeafe]"
                              }`}
                            >
                              {client.clientName}
                            </Link>
                          )}

                          {/* Show product focus select ONLY for the selected/active client */}
                          {client.clientName === activeClientName && client.productFocuses.length >= 1 && (
                            <>
                              <div className="ml-4 mt-2 mb-2">
                                <Select
                                  value={activeProductFocus || ""}
                                  onValueChange={(value) => handleProductFocusChange(client.clientName, value)}
                                  disabled={isGenerating}
                                >
                                  <SelectTrigger className="w-full h-8 text-xs bg-white border-[#e4e7ec] hover:border-[#1d4ed8] focus:border-[#1d4ed8]">
                                    <SelectValue placeholder="เลือก Product Focus" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {client.productFocuses.map((pf) => (
                                      <SelectItem key={pf.id} value={pf.productFocus} className="text-xs">
                                        {pf.productFocus}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="ml-4 mt-3 mb-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8e8e93] mb-2">
                                  Services
                                </p>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-1.5">
                                    <Input
                                      value={newServiceName}
                                      onChange={(event) => {
                                        setNewServiceName(event.target.value)
                                        if (serviceError) {
                                          setServiceError(null)
                                        }
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                          event.preventDefault()
                                          handleAddService()
                                        }
                                      }}
                                      placeholder="เพิ่มบริการใหม่"
                                      disabled={isGenerating || isLoadingServices || isAddingService}
                                      className="h-7 text-[10px] px-2 py-1 border-[#d9dbe3] focus:border-[#1d4ed8] focus:ring-0 placeholder:text-[#a0a5b1] placeholder:text-[10px]"
                                    />
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      className="h-7 w-7 border-[#d9dbe3] text-[#535862] hover:text-[#1d4ed8]"
                                      onClick={handleAddService}
                                      disabled={isGenerating || isLoadingServices || isAddingService}
                                    >
                                      {isAddingService ? (
                                        <span className="inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                                      ) : (
                                        <Plus className="h-3 w-3" />
                                      )}
                                    </Button>
                                  </div>
                                  {serviceError && <p className="text-[10px] text-red-500">{serviceError}</p>}
                                  {isLoadingServices ? (
                                    <div className="text-xs text-[#535862]">กำลังโหลดบริการ...</div>
                                  ) : clientServices.length > 0 ? (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="w-full justify-between text-xs border-[#e4e7ec] text-[#535862] hover:text-[#063def]"
                                          disabled={isGenerating || isLoadingServices}
                                        >
                                          <span className="truncate">{selectedServicesLabel}</span>
                                          <ChevronUp className="ml-2 h-3 w-3 rotate-180 opacity-60" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent className="w-64 max-h-60 overflow-y-auto" align="start">
                                        <DropdownMenuLabel className="text-xs text-[#535862]">
                                          เลือกบริการ
                                        </DropdownMenuLabel>
                                        <DropdownMenuItem
                                          className="text-xs text-[#1d4ed8] focus:text-[#1d4ed8]"
                                          onSelect={(event) => {
                                            event.preventDefault()
                                            handleServiceToggle(null)
                                          }}
                                        >
                                          ล้างการเลือกทั้งหมด
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        {clientServices.map((service) => (
                                          <DropdownMenuCheckboxItem
                                            key={service}
                                            className="text-xs"
                                            checked={selectedServices.includes(service)}
                                            onCheckedChange={() => handleServiceToggle(service)}
                                            onSelect={(event) => event.preventDefault()}
                                          >
                                            {service}
                                          </DropdownMenuCheckboxItem>
                                        ))}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  ) : (
                                    <div className="text-xs text-[#8e8e93]">ไม่มีข้อมูลบริการ</div>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-[#8e8e93] p-2">ไม่พบลูกค้าตามการค้นหา</div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </nav>
            <div className="my-4 border-t border-[#e4e7ec]" />
            <nav className="space-y-2">
              <Collapsible open={isHistoryOpen} onOpenChange={isGenerating ? undefined : setIsHistoryOpen} className="w-full">
                <CollapsibleTrigger asChild>
                  <Button
                    onClick={!isGenerating ? handleHistoryToggle : undefined}
                    variant="ghost"
                    className="w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]"
                    disabled={isGenerating}
                  >
                    {isLoadingSidebarHistory ? (
                      <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <History className="mr-2 h-4 w-4" />
                    )}
                    ประวัติการสร้าง
                    {isLoadingSidebarHistory && (
                      <span className="ml-1 text-xs text-[#1d4ed8]">(กำลังโหลด...)</span>
                    )}
                    <ChevronUp
                      className={`ml-auto h-4 w-4 transition-transform ${isHistoryOpen ? "rotate-0" : "rotate-180"}`}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 pl-8 pt-2">
                  <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                    {isLoadingSidebarHistory ? (
                      <div className="text-[#535862] text-xs p-2">กำลังโหลด...</div>
                    ) : sidebarHistory.length > 0 ? (
                      sidebarHistory.map((session, index) => (
                        <button
                          key={session.id}
                          onClick={() => loadSessionIdeas(session)}
                          className="w-full text-left p-2 rounded-md hover:bg-[#dbeafe] hover:text-[#063def] transition-colors text-xs text-[#535862] border border-transparent hover:border-[#b692f6] mb-1 animate-in fade-in duration-1000 ease-out slide-in-from-left-10"
                          style={{ animationDelay: `${index * 120}ms`, animationFillMode: "both" }}
                        >
                          <div className="font-medium truncate">
                            {session.selectedTemplate ? 
                              briefTemplates.find(t => t.id === session.selectedTemplate)?.title?.substring(0, 40) + '...' :
                              session.userInput?.substring(0, 40) + '...' || 'Custom Ideas'
                            }
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {session.ideasCount || 0} ideas • {session.createdAt ? new Date(session.createdAt).toLocaleDateString('th-TH') : 'Unknown date'}
                          </div>
                        </button>
                      ))
                    ) : activeClientName !== "No Client Selected" ? (
                      <div className="text-[#535862] text-xs p-2">ยังไม่มีประวัติการสร้างไอเดีย</div>
                    ) : (
                      <div className="text-[#535862] text-xs p-2">เลือกลูกค้าเพื่อดูประวัติ</div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </nav>
          </div>
          <div className="border-t border-[#e4e7ec] mt-4 pt-4">
            <div className="flex items-center space-x-3 p-2 mb-2">
              <Avatar className="h-8 w-8 bg-[#1d4ed8] text-[#ffffff] font-bold">
                <AvatarFallback>A</AvatarFallback>
              </Avatar>
              <span className="text-[#000000] font-medium">Admin</span>
            </div>
            <Button
              onClick={!isGenerating && !isLoadingMore ? handleConfigureNavigation : undefined}
              variant="ghost"
              className="w-full justify-start text-[#063def] hover:bg-[#f5f5f5] hover:text-[#1d4ed8] mb-2"
              disabled={isNavigatingToConfigure || isGenerating || isLoadingMore}
            >
              <Settings className="mr-2 h-4 w-4" />
              ตั้งค่าและวิเคราะห์
            </Button>
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="w-full justify-start text-[#8e8e93] hover:bg-[#f5f5f5] hover:text-red-600 text-sm"
            >
              <Lock className="mr-2 h-4 w-4" />
              ออกจากระบบ
            </Button>
          </div>
        </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8 flex flex-col h-full bg-transparent overflow-y-auto">
          <div className="w-full flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end mb-6">
            <Button
              onClick={() => !isGenerating && !isLoadingMore && setSavedIdeasModalOpen(true)}
              size="sm"
              variant="outline"
              className="text-xs text-[#063def] border-[#d1d5db] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]"
              disabled={isGenerating || isLoadingMore}
            >
              <Bookmark className="mr-2 h-3 w-3" />
              รายการที่บันทึก
            </Button>
            <Button
              onClick={!isGenerating && !isLoadingMore ? handleImagesNavigation : undefined}
              size="sm"
              variant="outline"
              className="text-xs text-[#063def] border-[#d1d5db] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]"
              disabled={isNavigatingToImages || isGenerating || isLoadingMore}
            >
              <Images className="mr-2 h-3 w-3" />
              ค้นและสร้างภาพ
            </Button>
          </div>
          <div className="flex-1 min-h-0 flex items-start justify-center relative">
            {/* Pending Notification Banner */}
            {pendingNotification && (
              <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg border-l-4 border-green-600 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-white rounded-full animate-ping"></div>
                  <div>
                    <p className="font-medium">🎉 ไอเดียสร้างเสร็จแล้ว!</p>
                    <p className="text-sm opacity-90">คลิกแท็บนี้เพื่อดูผลลัพธ์และฟังเสียงแจ้งเตือน</p>
                  </div>
                  <button
                    onClick={() => {
                      playNotificationSoundImmediate()
                      setPendingNotification(false)
                    }}
                    className="ml-2 bg-white/20 hover:bg-white/30 rounded-full p-1 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
            
            {isGenerating ? (
              /* AI Typing Animation */
              <AITypingAnimation activeClientName={activeClientName} />
            ) : showResults && topics.length > 0 ? (
              /* Results Section */
              <div className="flex flex-col items-center text-center w-full max-w-6xl animate-in fade-in duration-1200 ease-out slide-in-from-top-10"
                style={{ animationFillMode: "both" }}>
              <div className="bg-white/95 rounded-2xl p-8 shadow-lg border border-[#e4e7ec] w-full">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-[#000000] mb-2">Generated Ideas</h3>
                  <p className="text-[#535862]">สร้างไอเดีย {topics.length} ข้อสำเร็จแล้ว</p>
                  
                  {/* Action Buttons */}
                  <div className="flex justify-center mt-6">
                    <Button
                      onClick={() => setShowResults(false)}
                      variant="outline"
                      className="px-6 border-[#e4e7ec] hover:bg-[#f5f5f5]"
                    >
                      ← กลับไปแก้ไขไอเดีย
                    </Button>
                  </div>
                </div>

                {/* Ideas Grid - Optimized */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 will-change-transform">
                  {topics.map((topic, index) => {
                    const isSaved = savedTitles.includes(topic.title)
                    
                    return (
                      <div
                        key={`${topic.title}-${index}`}
                        className="animate-in fade-in duration-1000 ease-out slide-in-from-bottom-12"
                        style={{ animationDelay: `${600 + index * 160}ms`, animationFillMode: "both" }}
                      >
                        <IdeaCard
                          topic={topic}
                          index={index}
                          isSaved={isSaved}
                          onDetailClick={handleDetailClick}
                          onSaveClick={handleSaveIdea}
                          onFeedback={handleFeedback}
                          onShare={handleIndividualShare}
                        />
                      </div>
                    )
                  })}
                </div>
                
                {/* Generate More Ideas Button */}
                <div className="flex justify-center mt-8 pt-6 border-t border-gray-200">
                  <Button
                    onClick={handleGenerateMoreIdeas}
                    disabled={isGenerating || isLoadingMore}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 py-3 rounded-lg font-medium shadow-lg transition-all duration-200 hover:shadow-xl disabled:opacity-50"
                  >
                    {isLoadingMore ? (
                      <>
                        <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                        กำลังเพิ่มไอเดียใหม่...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate More Ideas
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
            ) : (
              /* Input Section */
              <div className="flex flex-col items-center text-center w-full max-w-4xl h-full">
                <div
                  className="flex flex-col items-center text-center w-full px-4 sm:px-0 animate-in fade-in duration-1000 ease-out slide-in-from-bottom-8"
                  style={{ animationFillMode: "both" }}
                >
                  <Image
                    src="https://cfislibqbzcquplksmqt.supabase.co/storage/v1/object/public/image-creative-strategist-public/SCR-20250730-myam-Photoroom.png"
                    alt="Creative Compass Logo"
                    width={200}
                    height={200}
                    className="mb-2"
                  />
                  <h2 className="text-2xl font-bold text-[#000000] mb-2">ต้องการไอเดียสร้างคอนเทนต์ใช่ไหม?</h2>
                  <p className="text-sm text-[#535862] mb-8 max-w-full w-full">
                    <span className="font-bold">เลือกคอนเทนต์แนะนำด้านล่างได้เลย</span> — อย่าลืมเลือกลูกค้าทางซ้าย ให้ได้คอนเทนต์ที่ใช่ยิ่งขึ้น
                  </p>

                  {/* Client/Product Focus Status */}
                  {(!activeClientName || activeClientName === "No Client Selected" || !activeProductFocus) && (
                    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        {!activeClientName || activeClientName === "No Client Selected" 
                          ? "กรุณาเลือกลูกค้าจากแถบด้านซ้าย" 
                          : "กรุณาเลือก Product Focus"}
                      </p>
                    </div>
                  )}

                  {/* Custom Prompt Input */}
                  <div className="w-full max-w-2xl space-y-4 mb-8">
                    <textarea
                      value={instructions}
                      onChange={(e) => {
                        setInstructions(e.target.value)
                        autoResizeTextarea(e.target as HTMLTextAreaElement)
                      }}
                      placeholder="หรือใส่ความต้องการเฉพาะของคุณ..."
                      className="w-full min-h-[120px] max-h-[400px] p-4 text-[#000000] border border-[#e4e7ec] focus:border-[#1d4ed8] focus:outline-none focus:ring-2 focus:ring-[#1d4ed8] focus:ring-opacity-20 shadow-md resize-none overflow-y-auto rounded-md"
                      style={{ backgroundColor: "#ffffff", height: "120px" }}
                      disabled={isGenerating}
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleImprovePrompt}
                        disabled={
                          isImprovingPrompt ||
                          isGenerating ||
                          isLoadingMore ||
                          !instructions.trim()
                        }
                        className="border-[#d1d5db] text-[#063def] hover:bg-[#eef2ff] hover:text-[#063def]"
                      >
                        {isImprovingPrompt ? (
                          <>
                            <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                            กำลังปรับปรุง...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2 text-[#7c3aed]" />
                            Improve Prompt
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleGenerateTopics}
                        disabled={
                          isGenerating ||
                          isLoadingMore ||
                          (!activeClientName || activeClientName === "No Client Selected") ||
                          !activeProductFocus
                        }
                        className="bg-[#252b37] text-[#ffffff] hover:bg-[#181d27] px-6 py-2 rounded-md disabled:opacity-50"
                      >
                        {isGenerating ? (
                          <>
                            <span className="inline-flex items-center justify-center mr-2">
                              <img
                                src="https://cfislibqbzcquplksmqt.supabase.co/storage/v1/object/public/image-creative-strategist-public/a-minimalist-logo-design-featuring-a-sty_i3vs-y0STaWbGUfO4JyaDw_iMf0MEt0Qq6mW_Qu-aloAg-Photoroom.png"
                                alt="Generating"
                                className="h-[26px] w-[26px] animate-spin"
                                style={{ animationDuration: "1.6s" }}
                              />
                            </span>
                            กำลังสร้าง...
                          </>
                        ) : (
                          <>
                            <span className="inline-flex items-center justify-center mr-2">
                              <img
                                src="https://cfislibqbzcquplksmqt.supabase.co/storage/v1/object/public/image-creative-strategist-public/a-minimalist-logo-design-featuring-a-sty_i3vs-y0STaWbGUfO4JyaDw_iMf0MEt0Qq6mW_Qu-aloAg-Photoroom.png"
                                alt="Generate icon"
                                className="h-[26px] w-[26px]"
                              />
                            </span>
                            Generate
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Dynamic Template Buttons - HIDDEN */}
                  {/* <div className="flex flex-col gap-4 mb-8 items-center">
                    {briefTemplates.map((template) => (
                      <Button
                       key={template.id}
                        onClick={() => handleTemplateSelect(template.id)}
                        variant="outline"
                        disabled={isGenerating}
                        className={`h-auto py-4 px-6 flex items-center justify-start text-left border-white/30 hover:bg-[#dbeafe] hover:border-[#b692f6] hover:text-[#063def] shadow-lg max-w-fit transition-all ${
                          selectedTemplate === template.id 
                            ? 'bg-[#dbeafe] border-[#b692f6] text-[#063def]' 
                            : 'bg-white text-[#535862]'
                        }`}
                      >
                        <Sparkles className={`mr-3 h-5 w-5 ${
                          selectedTemplate === template.id ? 'text-[#063def]' : 'text-[#3b82f6]'
                        }`} />
                        {template.title}
                      </Button>
                    ))}
                  </div> */}

                  {/* Product Details Toggle (Hidden) */}
                  <div className="w-full max-w-2xl mb-6 hidden" aria-hidden="true">
                    <div className="flex items-center space-x-3 justify-center">
                      <Label htmlFor="product-details-toggle" className="sr-only">
                        เพิ่มรายละเอียดสินค้า
                      </Label>
                      <Switch
                        id="product-details-toggle"
                        checked={showProductDetails}
                        onCheckedChange={setShowProductDetails}
                        disabled={isGenerating}
                      />
                    </div>
                    
                    <Collapsible open={showProductDetails} className="mt-4">
                      <CollapsibleContent className="space-y-4">
                        <div className="bg-[#f3f0ff] border border-[#d8ccf1] rounded-lg p-4">
                          <Label className="text-sm font-medium text-[#063def] mb-2 block">
                            รายละเอียดสินค้าและบริการ
                          </Label>
                          <textarea
                            value={productDetails}
                            onChange={(e) => {
                              setProductDetails(e.target.value)
                              // Auto-resize textarea
                              const textarea = e.target as HTMLTextAreaElement
                              textarea.style.height = 'auto'
                              textarea.style.height = Math.min(Math.max(textarea.scrollHeight, 100), 300) + 'px'
                            }}
                            placeholder="อธิบายรายละเอียดเกี่ยวกับสินค้าหรือบริการของคุณ เช่น คุณสมบัติเด่น จุดขาย กลุ่มเป้าหมาย ความพิเศษ ฯลฯ"
                            className="w-full min-h-[100px] max-h-[300px] p-3 text-[#000000] border border-[#d8ccf1] focus:border-[#1d4ed8] focus:outline-none focus:ring-2 focus:ring-[#1d4ed8] focus:ring-opacity-20 bg-white resize-none overflow-hidden rounded-md"
                            style={{ height: "100px" }}
                            disabled={isGenerating}
                          />
                          <p className="text-xs text-[#1d4ed8] mt-2">
                            💡 ข้อมูลนี้จะช่วยให้ AI สร้างไอเดียที่เหมาะกับสินค้าที่คุณต้องการมากขึ้น
                          </p>
                        </div>
                        
                        {/* Negative Prompts Section */}
                        <div className="bg-[#fff3f3] border border-[#f1cccc] rounded-lg p-4">
                          <Label className="text-sm font-medium text-[#dc2626] mb-2 block">
                            Negative Prompts (สิ่งที่ไม่ต้องการ)
                          </Label>
                          
                          {/* Input field to add new negative prompt */}
                          <div className="flex gap-2 mb-3">
                            <Input
                              value={negativePromptInput}
                              onChange={(e) => setNegativePromptInput(e.target.value)}
                              placeholder="เช่น whey protein, gym supplements, ฟิตเนส"
                              className="flex-1 border-[#f1cccc] focus:border-[#dc2626] focus-visible:ring-0"
                              disabled={isGenerating}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && negativePromptInput.trim()) {
                                  const newPrompt = negativePromptInput.trim()
                                  if (!negativePrompts.includes(newPrompt)) {
                                    setNegativePrompts([...negativePrompts, newPrompt])
                                  }
                                  setNegativePromptInput("")
                                }
                              }}
                            />
                            <Button
                              type="button"
                              size="sm"
                              className="bg-[#dc2626] hover:bg-[#b91c1c] text-white"
                              disabled={!negativePromptInput.trim() || isGenerating}
                              onClick={() => {
                                const newPrompt = negativePromptInput.trim()
                                if (newPrompt && !negativePrompts.includes(newPrompt)) {
                                  setNegativePrompts([...negativePrompts, newPrompt])
                                  setNegativePromptInput("")
                                }
                              }}
                            >
                              เพิ่ม
                            </Button>
                          </div>
                          
                          {/* Bubble tags display */}
                          {negativePrompts.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {negativePrompts.map((prompt, index) => (
                                <div
                                  key={index}
                                  className="inline-flex items-center gap-1 bg-[#dc2626] text-white text-xs px-3 py-1 rounded-full"
                                >
                                  <span>{prompt}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setNegativePrompts(negativePrompts.filter((_, i) => i !== index))
                                    }}
                                    className="hover:bg-[#b91c1c] rounded-full p-0.5 ml-1"
                                    disabled={isGenerating}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <p className="text-xs text-[#dc2626]">
                            🚫 AI จะหลีกเลี่ยงการสร้างไอเดียที่เกี่ยวข้องกับคำเหล่านี้
                          </p>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                </div>
              </div>
              {/* Custom Input Field */}
            </div>
        )}
      </div>
        </main>
      </div>
      
      {/* Modals */}
      <FeedbackForm
        isOpen={feedbackFormOpen}
        onClose={() => {
          setFeedbackFormOpen(false)
          setSelectedFeedbackIdea(null)
        }}
        idea={selectedFeedbackIdea}
        clientName={activeClientName || ""}
        productFocus={activeProductFocus || ""}
      />

      <IdeaDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        idea={selectedDetailIdea}
        clientName={activeClientName}
        productFocus={activeProductFocus || undefined}
        adAccount={activeAdAccount || undefined}
        instructions={instructions}
      />
      
      <SessionHistory
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        activeClientName={activeClientName}
      />

      <SavedIdeas
        isOpen={savedIdeasModalOpen}
        onClose={() => setSavedIdeasModalOpen(false)}
        activeClientName={activeClientName}
        activeProductFocus={activeProductFocus || undefined}
        onViewDetails={(idea, savedId) => {
          setSelectedDetailIdea(idea)
          setDetailModalOpen(true)
          setSavedIdeasModalOpen(false)
        }}
      />

      <LoadingPopup
        isOpen={isNavigatingToConfigure}
        message="กำลังโหลดหน้าตั้งค่าและวิเคราะห์"
      />

      <LoadingPopup
        isOpen={isNavigatingToNewClient}
        message="กำลังโหลดหน้าเพิ่มลูกค้าใหม่"
      />

      <LoadingPopup
        isOpen={isNavigatingToImages}
        message="กำลังโหลดหน้าค้นหาและสร้างภาพ"
      />

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-md bg-[#1a1a1a] text-white border-gray-700">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-base font-medium text-gray-300">Share</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Share Link Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-300">People with access</h3>
              
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">Admin (you)</div>
                </div>
                <div className="text-sm text-gray-400 bg-gray-800 px-3 py-1 rounded-md">
                  Owner
                </div>
              </div>
            </div>

            {/* Visibility Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-300">Visibility</h3>
              
              <div className="flex items-center space-x-2">
                <Link2 className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-white">Anyone with the link</span>
              </div>

              <Button
                onClick={async () => {
                  if (!shareSuccess) {
                    await handleShareIdeas()
                  }
                }}
                disabled={isSharing}
                className={`w-full border ${
                  shareSuccess 
                    ? 'bg-green-600 hover:bg-green-700 border-green-500 text-white' 
                    : 'bg-gray-800 hover:bg-gray-700 text-white border-gray-600'
                }`}
              >
                {isSharing ? (
                  <>
                    <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : shareSuccess ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Link Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Link
                  </>
                )}
              </Button>
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {/* Individual Idea Share Dialog */}
      <Dialog open={individualShareDialogOpen} onOpenChange={setIndividualShareDialogOpen}>
        <DialogContent className="max-w-md bg-[#1a1a1a] text-white border-gray-700">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-base font-medium text-gray-300">Share</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Share Link Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-300">People with access</h3>
              
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">Admin (you)</div>
                </div>
                <div className="text-sm text-gray-400 bg-gray-800 px-3 py-1 rounded-md">
                  Owner
                </div>
              </div>
            </div>

            {/* Visibility Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-300">Visibility</h3>
              
              <div className="flex items-center space-x-2">
                <Link2 className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-white">Anyone with the link</span>
              </div>

              <Button
                onClick={handleIndividualShareIdea}
                disabled={isIndividualSharing}
                className={`w-full border ${
                  individualShareSuccess 
                    ? 'bg-green-600 hover:bg-green-700 border-green-500 text-white' 
                    : 'bg-gray-800 hover:bg-gray-700 text-white border-gray-600'
                }`}
              >
                {isIndividualSharing ? (
                  <>
                    <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : individualShareSuccess ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Link Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Link
                  </>
                )}
              </Button>
            </div>

          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col space-y-4 p-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    }>
      <MainContent />
    </Suspense>
  )
}
