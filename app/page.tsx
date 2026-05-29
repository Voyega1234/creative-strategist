"use client"

import Image from "next/image"
import { useState, useEffect, Suspense, useCallback, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
// Optimize imports - only import what we need
import {
  Bookmark,
  Sparkles,
  RefreshCcw,
  Images,
  ArrowLeft,
  Link2,
  Copy,
  Check,
} from "lucide-react"
import { FeedbackForm } from "@/components/feedback-form"
import { IdeaDetailModal } from "@/components/idea-detail-modal"
import { SessionHistory } from "@/components/session-history"
import { SavedIdeas } from "@/components/saved-ideas"
import { AITypingAnimation } from "@/components/ai-typing-animation"
import { LoadingPopup } from "@/components/loading-popup"
import { IdeaCard } from "@/components/ideas/idea-card"
import { LoginGate } from "@/components/auth/login-gate"
import { MainDashboardSidebar } from "@/components/layout/main-dashboard-sidebar"
import { PendingIdeaNotification } from "@/components/notifications/pending-idea-notification"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { sessionManager } from "@/lib/session-manager"
import type { IdeaRecommendation } from "@/lib/ideas/types"
import { loadIdeasFromStorage, saveIdeasToStorage } from "@/lib/ideas/client-storage"
import { BRIEF_TEMPLATES } from "@/lib/ideas/generation-options"
import {
  enqueueIdeaGenerationTask,
  getIdeasFromTaskResult,
  mergeUniqueIdeas,
  resolveIdeaGenerationModelId,
  type IdeaGenerationTaskContext,
} from "@/lib/ideas/generation-task"
import { createShareLink } from "@/lib/ideas/share"
import { buildClientScopedRoute } from "@/lib/navigation/client-routes"
import { clearAuthSession, hasValidAuthSession, saveAuthSession } from "@/lib/auth/client-auth"
import { fetchLatestSession, fetchSessionHistory, getLoadedSessionIdeas } from "@/lib/sessions/history"
import {
  EMPTY_CLIENT_INFO,
  filterClientsBySearch,
  findActiveClientRecord,
  findActiveProductFocusEntry,
  orderClientsByActiveName,
  resolveClientInfoFromParams,
  type ResolvedClientInfo,
} from "@/lib/clients/client-selection"
import { useIdeaNotifications } from "@/hooks/use-idea-notifications"
import { useClientServices } from "@/hooks/use-client-services"
import { useClientsWithProductFocus } from "@/hooks/use-clients-with-product-focus"
import { usePersistVisualRoutes } from "@/hooks/use-persist-visual-routes"

// Client component that uses useSearchParams
function MainContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [topics, setTopics] = useState<IdeaRecommendation[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [instructions, setInstructions] = useState("")
  const { clients, isLoadingClients, loadClients } = useClientsWithProductFocus()
  const [feedbackFormOpen, setFeedbackFormOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedDetailIdea, setSelectedDetailIdea] = useState<IdeaRecommendation | null>(null)
  const [selectedFeedbackIdea, setSelectedFeedbackIdea] = useState<IdeaRecommendation | null>(null)
  const [savedTitles, setSavedTitles] = useState<string[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [selectedModel] = useState<string>("Gemini 2.5 Pro")
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
  const taskPollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const taskTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const taskContextRef = useRef<IdeaGenerationTaskContext | null>(null)

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
  const {
    pendingNotification,
    clearPendingNotification,
    playNotificationSound,
    playNotificationSoundImmediate,
    showNotification,
  } = useIdeaNotifications()
  usePersistVisualRoutes(topics)
  
  // Get URL parameters
  const urlProductFocus = searchParams.get('productFocus') || null
  const urlClientName = searchParams.get('clientName') || null
  const urlClientId = searchParams.get('clientId') || null
  
  // State to track resolved client info
  const [resolvedClientInfo, setResolvedClientInfo] = useState<ResolvedClientInfo>(EMPTY_CLIENT_INFO)

  // Derive active values from resolved info
  const activeClientName = resolvedClientInfo.clientName
  const activeProductFocus = resolvedClientInfo.productFocus
  const activeClientId = resolvedClientInfo.clientId
  const activeAdAccount = resolvedClientInfo.adAccount
  const normalizedClientSearch = clientSearch.trim().toLowerCase()
  const filteredClients = useMemo(() => {
    return filterClientsBySearch(clients, normalizedClientSearch)
  }, [clients, normalizedClientSearch])
  const orderedClients = useMemo(() => {
    return orderClientsByActiveName(filteredClients, activeClientName)
  }, [filteredClients, activeClientName])
  const pathname = usePathname()

  const activeClientRecord = useMemo(() => {
    return findActiveClientRecord(clients, activeClientName)
  }, [clients, activeClientName])

  const activeProductFocusEntry = useMemo(() => {
    return findActiveProductFocusEntry(activeClientRecord, activeProductFocus)
  }, [activeClientRecord, activeProductFocus])
  const {
    clientServices,
    isLoadingServices,
    selectedServices,
    selectedServicesLabel,
    selectedServicesText,
    newServiceName,
    setNewServiceName,
    isAddingService,
    serviceError,
    setServiceError,
    handleServiceToggle,
    handleAddService,
  } = useClientServices({
    activeClientId,
    activeProductFocusEntryId: activeProductFocusEntry?.id,
    isGenerating,
  })

  const configureUrl = useMemo(() => {
    return buildClientScopedRoute({
      basePath: "/configure",
      activeClientName,
      activeClientId,
      activeClientRecord,
      activeProductFocusEntry,
    })
  }, [activeClientName, activeClientId, activeProductFocusEntry, activeClientRecord])

  const imagesUrl = useMemo(() => {
    return buildClientScopedRoute({
      basePath: "/images",
      activeClientName,
      activeClientRecord,
      activeProductFocusEntry,
    })
  }, [activeClientName, activeProductFocusEntry, activeClientRecord])

  // Check authentication on mount
  useEffect(() => {
    setIsAuthenticated(hasValidAuthSession())
    setIsCheckingAuth(false)
  }, [])

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

    const resolvedInfo = resolveClientInfoFromParams({
      clients,
      urlClientId,
      urlClientName,
      urlProductFocus,
    })

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
      const ideas = getIdeasFromTaskResult(result)

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
          mergedIdeas = mergeUniqueIdeas(prevTopics, ideas)
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
      const modelId = resolveIdeaGenerationModelId(selectedModel)

      const data = await enqueueIdeaGenerationTask({
        clientName: activeClientName,
        productFocus: activeProductFocus,
        service: selectedServicesText,
        instructions: finalInstructions,
        productDetails: showProductDetails ? productDetails.trim() : undefined,
        negativePrompts: negativePrompts.length > 0 ? negativePrompts : undefined,
        hasProductDetails: showProductDetails,
        model: modelId,
      })

      if (!data.responseOk || !data.success || !data.taskId) {
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
      const modelId = resolveIdeaGenerationModelId(selectedModel)

      const data = await enqueueIdeaGenerationTask({
        clientName: activeClientName,
        productFocus: activeProductFocus,
        service: selectedServicesText,
        instructions: finalInstructions,
        productDetails: showProductDetails ? productDetails.trim() : undefined,
        negativePrompts: negativePrompts.length > 0 ? negativePrompts : undefined,
        hasProductDetails: showProductDetails,
        model: modelId,
        existingConceptIdeas,
      })

      if (!data.responseOk || !data.success || !data.taskId) {
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
    const template = BRIEF_TEMPLATES.find(t => t.id === templateId)
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
      const result = await fetchSessionHistory({
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
      
      const latestSession = await fetchLatestSession(activeClientName)

      if (latestSession) {
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

      const loadedSession = getLoadedSessionIdeas(session)

      if (loadedSession) {
        setTopics(loadedSession.ideas)
        setShowResults(true)
        setInstructions(loadedSession.userInput)
        if (loadedSession.selectedTemplate) {
          setSelectedTemplate(loadedSession.selectedTemplate)
        }

        console.log(
          '✅ Session ideas loaded:',
          loadedSession.ideas.length,
          loadedSession.source === "n8nResponse" ? 'complete ideas with all fields' : 'simplified ideas'
        )
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

  const handleNewClientNavigation = useCallback(() => {
    if (isNavigatingToNewClient) return
    setIsNavigatingToNewClient(true)
    router.push('/new-client')
  }, [isNavigatingToNewClient, router])

  const mainUrl = useMemo(() => {
    return buildClientScopedRoute({
      basePath: "/",
      activeClientName,
      activeClientId,
      activeProductFocusEntry,
    })
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
      const shareUrl = await createShareLink({
        ideas: topics,
        clientName: activeClientName,
        productFocus: activeProductFocus,
        instructions: instructions.trim() || null,
        model: selectedModel,
      })
      await navigator.clipboard.writeText(shareUrl)
      setShareSuccess(true)
      // Link copied to clipboard silently
    } catch (error) {
      console.error('Error sharing ideas:', error)
      alert(error instanceof Error ? `เกิดข้อผิดพลาด: ${error.message}` : 'เกิดข้อผิดพลาดในการสร้างลิงก์แชร์')
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
      const shareUrl = await createShareLink({
        ideas: [selectedShareIdea],
        clientName: activeClientName,
        productFocus: activeProductFocus,
        instructions: `Individual idea: ${selectedShareIdea.title}`,
        model: selectedModel,
      })
      // Auto-copy the link to clipboard immediately
      await navigator.clipboard.writeText(shareUrl)
      setCurrentShareUrl(shareUrl)
      setIndividualShareSuccess(true)
      console.log('Share URL created and copied:', shareUrl)
    } catch (error) {
      console.error('Error sharing individual idea:', error)
      alert(error instanceof Error ? `เกิดข้อผิดพลาด: ${error.message}` : 'เกิดข้อผิดพลาดในการสร้างลิงก์แชร์')
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
        saveAuthSession()
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
    clearAuthSession()
  }

  if (isCheckingAuth || !isAuthenticated) {
    return (
      <LoginGate
        isCheckingAuth={isCheckingAuth}
        password={password}
        passwordError={passwordError}
        showPassword={showPassword}
        isAuthenticating={isAuthenticating}
        onPasswordChange={setPassword}
        onShowPasswordChange={setShowPassword}
        onLogin={handleLogin}
      />
    )
  }

  // Show main dashboard if authenticated
  return (
    <div className="relative flex h-dvh overflow-hidden bg-white">
      <div 
        className="fixed inset-0 z-0 opacity-70"
        style={{
          backgroundImage: 'url("https://cfislibqbzcquplksmqt.supabase.co/storage/v1/object/public/image-creative-strategist-public/coolbackgrounds-topography-gulf.png")',
          backgroundSize: '800px',
          backgroundPosition: 'top right',
          backgroundRepeat: 'no-repeat'
        }}
      />
      <div className="relative z-10 flex min-w-0 w-full">
        <MainDashboardSidebar
          isGenerating={isGenerating}
          isLoadingMore={isLoadingMore}
          isNavigatingToNewClient={isNavigatingToNewClient}
          isNavigatingToConfigure={isNavigatingToConfigure}
          clientSearch={clientSearch}
          setClientSearch={setClientSearch}
          isBrandOpen={isBrandOpen}
          setIsBrandOpen={setIsBrandOpen}
          orderedClients={orderedClients}
          activeClientName={activeClientName}
          activeProductFocus={activeProductFocus}
          newServiceName={newServiceName}
          setNewServiceName={setNewServiceName}
          serviceError={serviceError}
          setServiceError={setServiceError}
          isLoadingServices={isLoadingServices}
          isAddingService={isAddingService}
          clientServices={clientServices}
          selectedServices={selectedServices}
          selectedServicesLabel={selectedServicesLabel}
          isHistoryOpen={isHistoryOpen}
          setIsHistoryOpen={setIsHistoryOpen}
          isLoadingSidebarHistory={isLoadingSidebarHistory}
          sidebarHistory={sidebarHistory}
          onMainNavigation={handleMainNavigation}
          onNewClientNavigation={handleNewClientNavigation}
          onProductFocusChange={handleProductFocusChange}
          onAddService={handleAddService}
          onServiceToggle={handleServiceToggle}
          onHistoryToggle={handleHistoryToggle}
          onLoadSessionIdeas={loadSessionIdeas}
          onConfigureNavigation={handleConfigureNavigation}
          onLogout={handleLogout}
        />

        {/* Main Content */}
        <main className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto bg-transparent p-4 lg:p-8">
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
            {pendingNotification && (
              <PendingIdeaNotification
                onReplaySound={playNotificationSoundImmediate}
                onDismiss={clearPendingNotification}
              />
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
                    {BRIEF_TEMPLATES.map((template) => (
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
