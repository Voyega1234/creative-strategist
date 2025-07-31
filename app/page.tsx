"use client"

import Image from "next/image"
import Link from "next/link"
import { useState, useEffect, Suspense } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronUp, Plus, User, Bookmark, Settings, History, Sparkles, RefreshCcw, Share2, Zap, ThumbsUp, ThumbsDown, BookmarkCheck, Images, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react"
import { FeedbackForm } from "@/components/feedback-form"
import { IdeaDetailModal } from "@/components/idea-detail-modal"
import { SessionHistory } from "@/components/session-history"
import { SavedIdeas } from "@/components/saved-ideas"
import { AITypingAnimation } from "@/components/ai-typing-animation"
import { LoadingPopup } from "@/components/loading-popup"
import { useSearchParams, useRouter } from "next/navigation"
import { sessionManager } from "@/lib/session-manager"

// Types for ideas
export interface IdeaRecommendation {
  title: string;
  description: string;
  category: string;
  impact: 'High' | 'Medium' | 'Low';
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

type ClientWithProductFocus = {
  id: string
  clientName: string
  productFocuses: Array<{
    id: string
    productFocus: string
  }>
}

// Client component that uses useSearchParams
function MainContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [topics, setTopics] = useState<IdeaRecommendation[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [instructions, setInstructions] = useState("")
  const [clients, setClients] = useState<ClientWithProductFocus[]>([])
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
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [sidebarHistory, setSidebarHistory] = useState<any[]>([])
  const [isLoadingSidebarHistory, setIsLoadingSidebarHistory] = useState(false)
  const [isNavigatingToConfigure, setIsNavigatingToConfigure] = useState(false)
  const [isNavigatingToNewClient, setIsNavigatingToNewClient] = useState(false)
  
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  
  // Get URL parameters
  const activeProductFocus = searchParams.get('productFocus') || null
  const activeClientName = searchParams.get('clientName') || "No Client Selected"
  
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

  // Helper functions for localStorage
  const getStorageKey = (clientName: string, productFocus: string) => {
    return `ideas_${clientName}_${productFocus}`
  }

  const saveIdeasToStorage = (ideas: IdeaRecommendation[], clientName: string, productFocus: string) => {
    try {
      const key = getStorageKey(clientName, productFocus)
      localStorage.setItem(key, JSON.stringify({
        ideas,
        timestamp: Date.now(),
        clientName,
        productFocus
      }))
    } catch (error) {
      console.error('Error saving ideas to localStorage:', error)
    }
  }

  const loadIdeasFromStorage = (clientName: string, productFocus: string): IdeaRecommendation[] => {
    try {
      const key = getStorageKey(clientName, productFocus)
      const stored = localStorage.getItem(key)
      if (stored) {
        const data = JSON.parse(stored)
        // Check if data is not too old (24 hours)
        const now = Date.now()
        const timeDiff = now - data.timestamp
        if (timeDiff < 24 * 60 * 60 * 1000) {
          return data.ideas || []
        }
      }
    } catch (error) {
      console.error('Error loading ideas from localStorage:', error)
    }
    return []
  }

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

  // Load clients on mount
  useEffect(() => {
    const loadClients = async () => {
      try {
        const response = await fetch('/api/clients-with-product-focus')
        if (response.ok) {
          const clientsData = await response.json()
          setClients(clientsData)
        }
      } catch (error) {
        console.error('Error loading clients:', error)
      }
    }
    loadClients()
  }, [])

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

  // Reset history when client changes
  useEffect(() => {
    setSidebarHistory([])
    setIsHistoryOpen(false)
  }, [activeClientName])

  // Fetch saved titles when client or product focus changes
  useEffect(() => {
    fetchSavedTitles()
  }, [activeClientName, activeProductFocus])

  // Function to play notification sound
  const playNotificationSound = () => {
    try {
      const audio = new Audio('/new-notification-011-364050.mp3')
      audio.volume = 0.5
      audio.play().then(() => {
        console.log('Notification sound played successfully')
      }).catch(error => {
        console.error('Could not play notification sound:', error)
      })
    } catch (error) {
      console.error('Could not initialize notification sound:', error)
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
      }

      setTimeout(() => notification.close(), 10000)
    }
  }

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
    try {
      // Simply use whatever is in the input box (which may be auto-filled from template)
      // If empty, send a single space to N8N instead of undefined
      const finalInstructions = instructions.trim() || " "

      const response = await fetch('/api/generate-ideas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientName: activeClientName,
          productFocus: activeProductFocus,
          instructions: finalInstructions,
          model: modelOptions.find(m => m.name === selectedModel)?.id || "gemini-2.5-pro",
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        setTopics(data.ideas)
        setShowResults(true)
        // Save ideas to localStorage
        if (activeClientName && activeProductFocus) {
          saveIdeasToStorage(data.ideas, activeClientName, activeProductFocus)
        }
        
        // Save to database session history (non-blocking)
        if (activeClientName && activeProductFocus) {
          console.log('🎯 Initiating session save for:', {
            activeClientName,
            activeProductFocus,
            hasData: !!data,
            ideasCount: data?.ideas?.length || 0,
            finalInstructions,
            selectedTemplate,
            selectedModel
          })
          
          sessionManager.saveSession({
            clientName: activeClientName,
            productFocus: activeProductFocus,
            n8nResponse: data,
            userInput: finalInstructions,
            selectedTemplate: selectedTemplate || undefined,
            modelUsed: modelOptions.find(m => m.name === selectedModel)?.id || "gemini-2.5-pro"
          }).then(success => {
            console.log(success ? '✅ Session save initiated successfully' : '❌ Session save failed')
          }).catch(error => {
            console.error('❌ Session save failed (non-critical):', error)
          })
        }
        
        // Ideas generated successfully
        
        // Show completion notifications
        const ideaCount = data.ideas.length
        playNotificationSound()
        showNotification(
          '🎉 ไอเดียสร้างเสร็จแล้ว!',
          `สร้างไอเดีย ${ideaCount} ข้อสำเร็จแล้วสำหรับ ${activeClientName}`,
          ideaCount
        )
      } else {
        alert(`เกิดข้อผิดพลาด: ${data.error}`)
      }
    } catch (error) {
      console.error('Error generating topics:', error)
      alert('เกิดข้อผิดพลาดในการสร้างหัวข้อ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsGenerating(false)
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
    if (!activeClientName || !activeProductFocus) return
    
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
        limit: 10 // Show last 10 sessions in dropdown
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

  // Handle history dropdown toggle
  const handleHistoryToggle = () => {
    setIsHistoryOpen(!isHistoryOpen)
    if (!isHistoryOpen && sidebarHistory.length === 0) {
      loadSidebarHistory()
    }
  }

  // Load a specific session and show its ideas
  const loadSessionIdeas = async (session: any) => {
    try {
      console.log('🔄 Loading session ideas:', session)
      
      // Set the complete ideas from the session's n8nResponse
      if (session.n8nResponse?.ideas && session.n8nResponse.ideas.length > 0) {
        setTopics(session.n8nResponse.ideas)
        setShowResults(true)
        
        // Also update form state to match the session
        setInstructions(session.userInput || "")
        if (session.selectedTemplate) {
          setSelectedTemplate(session.selectedTemplate)
        }
        
        console.log('✅ Session ideas loaded:', session.n8nResponse.ideas.length, 'complete ideas with all fields')
      } else if (session.ideas && session.ideas.length > 0) {
        // Fallback to the simplified ideas if n8nResponse is not available
        setTopics(session.ideas)
        setShowResults(true)
        console.log('✅ Session ideas loaded:', session.ideas.length, 'simplified ideas')
      } else {
        console.warn('⚠️ No ideas found in session:', session)
      }
    } catch (error) {
      console.error('Error loading session ideas:', error)
    }
  }

  const handleConfigureNavigation = async () => {
    setIsNavigatingToConfigure(true)
    
    // Build configure URL with current client parameters
    const configureUrl = `/configure${activeClientName && activeClientName !== "No Client Selected" 
      ? `?clientName=${encodeURIComponent(activeClientName)}${activeProductFocus ? `&productFocus=${encodeURIComponent(activeProductFocus)}` : ''}` 
      : ''}`
    
    try {
      // Start timing for minimum loading display
      const startTime = Date.now()
      const minLoadingTime = 1500 // Minimum 1.5 second loading time for smooth UX
      
      // Preload the configure page data while showing loading popup
      const response = await fetch(configureUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Cache-Control': 'no-cache',
        },
      })
      
      // Wait for both preload completion and minimum loading time
      const elapsedTime = Date.now() - startTime
      const remainingTime = Math.max(0, minLoadingTime - elapsedTime)
      
      if (response.ok && response.status === 200) {
        // Ensure the response contains actual page content
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('text/html')) {
          await new Promise(resolve => setTimeout(resolve, remainingTime))
          router.push(configureUrl)
        } else {
          throw new Error('Invalid response type')
        }
      } else {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      console.error('Error preloading configure page:', error)
      // If preload fails, still respect minimum loading time before navigating
      setTimeout(() => {
        router.push(configureUrl)
      }, 1500)
    }
  }

  const handleNewClientNavigation = async () => {
    setIsNavigatingToNewClient(true)
    
    const newClientUrl = '/new-client'
    
    try {
      // Start timing for minimum loading display
      const startTime = Date.now()
      const minLoadingTime = 1500 // Minimum 1.5 second loading time for smooth UX
      
      // Preload the new-client page data while showing loading popup
      const response = await fetch(newClientUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Cache-Control': 'no-cache',
        },
      })
      
      // Wait for both preload completion and minimum loading time
      const elapsedTime = Date.now() - startTime
      const remainingTime = Math.max(0, minLoadingTime - elapsedTime)
      
      if (response.ok && response.status === 200) {
        // Ensure the response contains actual page content
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('text/html')) {
          await new Promise(resolve => setTimeout(resolve, remainingTime))
          router.push(newClientUrl)
        } else {
          throw new Error('Invalid response type')
        }
      } else {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      console.error('Error preloading new-client page:', error)
      // If preload fails, still respect minimum loading time before navigating
      setTimeout(() => {
        router.push(newClientUrl)
      }, 1500)
    }
  }

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
          ideas: topics,
          clientName: activeClientName,
          productFocus: activeProductFocus,
          instructions: instructions.trim() || null,
          model: selectedModel
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        await navigator.clipboard.writeText(data.shareUrl)
        alert(`✅ ลิงก์แชร์ถูกสร้างและคัดลอกแล้ว!\n\n${data.shareUrl}`)
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
          <div className="w-8 h-8 border-2 border-[#7f56d9] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
          <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#7f56d9] to-[#6941c6] relative overflow-hidden">
            <div className="absolute inset-0 bg-white/5 opacity-20"></div>
            
            <div className="relative z-10 flex flex-col justify-center px-12 py-16 text-white">
              <div className="mb-8">
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
                  <Lock className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-4xl font-bold mb-4 leading-tight">
                  Creative Strategist<br />Dashboard
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
                <div className="lg:hidden w-12 h-12 bg-[#e9d7fe] rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-6 h-6 text-[#7f56d9]" />
                </div>
                <h2 className="text-3xl font-bold text-[#535862] mb-2">เข้าสู่ระบบ</h2>
                <p className="text-[#8e8e93]">กรุณาใส่รหัสผ่านเพื่อเข้าสู่ Creative Strategist</p>
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
                      className="pr-10 border-[#d1d1d6] focus:border-[#7f56d9] focus:ring-0"
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
                  className="w-full bg-[#7f56d9] hover:bg-[#6941c6] text-white py-3 rounded-lg font-medium transition-colors"
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
    <div className="flex min-h-screen bg-white relative">
      {/* Background Image - Hidden temporarily */}
      {/* <div 
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: 'url("/vivid-blurred-colorful-background (1).jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      /> */}
      <div className="flex w-full relative z-10">
        {/* Sidebar */}
        <aside className={`w-64 bg-white/90 backdrop-blur-sm p-6 border-r border-white/20 flex flex-col justify-between ${isGenerating ? 'pointer-events-none opacity-60' : ''}`}>
          <div>
            <h1 className="text-lg font-semibold text-[#000000] mb-8">Creative Strategist.</h1>
            <nav className="space-y-2">
              <Collapsible open={isBrandOpen} onOpenChange={isGenerating ? undefined : setIsBrandOpen} className="w-full">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#7f56d9]"
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
                    {(() => {
                      // Reorder clients: selected client first, then others
                      const activeClient = clients.find(client => client.clientName === activeClientName)
                      const otherClients = clients.filter(client => client.clientName !== activeClientName)
                      const reorderedClients = activeClient ? [activeClient, ...otherClients] : clients
                      
                      return reorderedClients.map((client) => (
                        <div key={client.id} className="space-y-1">
                          {/* Client name - always show, highlight if active */}
                          {isGenerating ? (
                            <div className={`block text-sm py-1 px-2 rounded-md font-medium cursor-not-allowed ${
                              client.clientName === activeClientName
                                ? 'text-[#6941c6] bg-[#e9d7fe]'
                                : 'text-[#535862]'
                            }`}>
                              {client.clientName}
                            </div>
                          ) : (
                            <Link
                              href={`?clientId=${client.productFocuses[0]?.id || client.id}&clientName=${encodeURIComponent(client.clientName)}&productFocus=${encodeURIComponent(client.productFocuses[0]?.productFocus || '')}`}
                              className={`block text-sm py-1 px-2 rounded-md font-medium ${
                                client.clientName === activeClientName
                                  ? 'text-[#6941c6] bg-[#e9d7fe]'
                                  : 'text-[#535862] hover:text-[#6941c6] hover:bg-[#e9d7fe]'
                              }`}
                            >
                              {client.clientName}
                            </Link>
                          )}
                          
                          {/* Show product focuses ONLY for the selected/active client */}
                          {client.clientName === activeClientName && client.productFocuses.length >= 1 && (
                            <div className="ml-4 space-y-1 mb-2">
                              {client.productFocuses.map((pf) => (
                                isGenerating ? (
                                  <div
                                    key={pf.id}
                                    className={`block text-xs py-1 px-2 rounded-md cursor-not-allowed ${
                                      activeProductFocus === pf.productFocus
                                        ? 'text-[#6941c6] bg-[#e9d7fe] font-medium'
                                        : 'text-[#535862]'
                                    }`}
                                  >
                                    {pf.productFocus}
                                  </div>
                                ) : (
                                  <Link
                                    key={pf.id}
                                    href={`?clientId=${pf.id}&productFocus=${encodeURIComponent(pf.productFocus)}&clientName=${encodeURIComponent(activeClientName)}`}
                                    className={`block text-xs py-1 px-2 rounded-md ${
                                      activeProductFocus === pf.productFocus
                                        ? 'text-[#6941c6] bg-[#e9d7fe] font-medium'
                                        : 'text-[#535862] hover:text-[#6941c6] hover:bg-[#e9d7fe]'
                                    }`}
                                  >
                                    {pf.productFocus}
                                  </Link>
                                )
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    })()}
                  </div>
                </CollapsibleContent>
              </Collapsible>
              <Button
                onClick={!isGenerating ? handleNewClientNavigation : undefined}
                variant="ghost"
                className="w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#7f56d9]"
                disabled={isGenerating || isNavigatingToNewClient}
              >
                <Plus className="mr-2 h-4 w-4" />
                เพิ่มรายชื่อ
              </Button>
            </nav>
            <div className="my-4 border-t border-[#e4e7ec]" />
            <nav className="space-y-2">
              <Button
                onClick={() => !isGenerating && setSavedIdeasModalOpen(true)}
                variant="ghost"
                className="w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#7f56d9]"
                disabled={isGenerating}
              >
                <Bookmark className="mr-2 h-4 w-4" />
                รายการที่บันทึก
              </Button>
              {isGenerating ? (
                <Button
                  variant="ghost"
                  className="w-full justify-start text-[#535862] cursor-not-allowed"
                  disabled={true}
                >
                  <Images className="mr-2 h-4 w-4" />
                  ค้นหารูปภาพ Pinterest
                </Button>
              ) : (
                <Link
                  href={`/images${activeClientName && activeClientName !== "No Client Selected" 
                    ? `?clientId=${clients.find(c => c.clientName === activeClientName)?.productFocuses?.find(pf => pf.productFocus === activeProductFocus)?.id || clients.find(c => c.clientName === activeClientName)?.id}&clientName=${encodeURIComponent(activeClientName)}${activeProductFocus ? `&productFocus=${encodeURIComponent(activeProductFocus)}` : ''}` 
                    : ''}`}
                >
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#7f56d9]"
                  >
                    <Images className="mr-2 h-4 w-4" />
                    ค้นหารูปภาพ Pinterest
                  </Button>
                </Link>
              )}
              <Button
                onClick={!isGenerating ? handleConfigureNavigation : undefined}
                variant="ghost"
                className="w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#7f56d9]"
                disabled={isNavigatingToConfigure || isGenerating}
              >
                <Settings className="mr-2 h-4 w-4" />
                ตั้งค่าและวิเคราะห์
              </Button>
              <Collapsible open={isHistoryOpen} onOpenChange={isGenerating ? undefined : setIsHistoryOpen} className="w-full">
                <CollapsibleTrigger asChild>
                  <Button
                    onClick={!isGenerating ? handleHistoryToggle : undefined}
                    variant="ghost"
                    className="w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#7f56d9]"
                    disabled={isGenerating}
                  >
                    <History className="mr-2 h-4 w-4" />
                    ประวัติการสร้าง
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
                      sidebarHistory.map((session) => (
                        <button
                          key={session.id}
                          onClick={() => loadSessionIdeas(session)}
                          className="w-full text-left p-2 rounded-md hover:bg-[#e9d7fe] hover:text-[#6941c6] transition-colors text-xs text-[#535862] border border-transparent hover:border-[#b692f6] mb-1"
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
              <Avatar className="h-8 w-8 bg-[#7f56d9] text-[#ffffff] font-bold">
                <AvatarFallback>A</AvatarFallback>
              </Avatar>
              <span className="text-[#000000] font-medium">Admin</span>
            </div>
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="w-full justify-start text-[#8e8e93] hover:bg-[#f5f5f5] hover:text-red-600 text-sm"
            >
              <Lock className="mr-2 h-4 w-4" />
              ออกจากระบบ
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8 flex items-center justify-center min-h-screen bg-transparent">
          {isGenerating ? (
            /* AI Typing Animation */
            <AITypingAnimation activeClientName={activeClientName} />
          ) : !showResults ? (
            /* Input Section */
            <div className="flex flex-col items-center text-center w-full max-w-4xl">
              <Image
                src="/SCR-20250730-myam-Photoroom.png"
                alt="Creative Strategist Logo"
                width={120}
                height={120}
                className="mb-6"
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

              {/* Dynamic Template Buttons */}
              <div className="flex flex-col gap-4 mb-8 items-center">
                {briefTemplates.map((template) => (
                  <Button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template.id)}
                    variant="outline"
                    disabled={isGenerating}
                    className={`h-auto py-4 px-6 flex items-center justify-start text-left border-white/30 hover:bg-[#e9d7fe] hover:border-[#b692f6] hover:text-[#6941c6] shadow-lg max-w-fit transition-all ${
                      selectedTemplate === template.id 
                        ? 'bg-[#e9d7fe] border-[#b692f6] text-[#6941c6]' 
                        : 'bg-white text-[#535862]'
                    }`}
                  >
                    <Sparkles className={`mr-3 h-5 w-5 ${
                      selectedTemplate === template.id ? 'text-[#6941c6]' : 'text-[#9e77ed]'
                    }`} />
                    {template.title}
                  </Button>
                ))}
              </div>

              {/* Custom Input Field */}
              <div className="w-full relative max-w-2xl">
                <Textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="หรือใส่ความต้องการเฉพาะของคุณ..."
                  className="min-h-[120px] p-4 text-[#000000] border-[#e4e7ec] focus:border-[#7f56d9] focus-visible:ring-0 shadow-md"
                  style={{ backgroundColor: "#ffffff" }}
                  disabled={isGenerating}
                />
                <Button 
                  onClick={handleGenerateTopics}
                  disabled={isGenerating || (!activeClientName || activeClientName === "No Client Selected") || !activeProductFocus}
                  className="absolute bottom-4 right-4 bg-[#252b37] text-[#ffffff] hover:bg-[#181d27] px-6 py-2 rounded-md disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                      กำลังสร้าง...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4 text-[#7f56d9] animate-pulse" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* Results Section */
            <div className="flex flex-col items-center text-center w-full max-w-6xl">
              <div className="bg-white/95 rounded-2xl p-8 shadow-lg border border-[#e4e7ec] w-full">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-[#000000] mb-2">Generated Ideas</h3>
                  <p className="text-[#535862]">สร้างไอเดีย {topics.length} ข้อสำเร็จแล้ว</p>
                  
                  {/* Action Buttons */}
                  <div className="flex justify-center gap-4 mt-6">
                    <Button
                      onClick={() => setShowResults(false)}
                      variant="outline"
                      className="px-6 border-[#e4e7ec] hover:bg-[#f5f5f5]"
                    >
                      ← กลับไปแก้ไขไอเดีย
                    </Button>
                    
                    <Button
                      onClick={handleShareIdeas}
                      disabled={isSharing}
                      className="bg-[#7f56d9] hover:bg-[#6941c6] text-white px-6"
                    >
                      {isSharing ? (
                        <>
                          <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Share2 className="w-4 h-4 mr-2" />
                          Share Ideas
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Ideas Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {topics.map((topic, index) => {
                    const isSaved = savedTitles.includes(topic.title)
                    
                    return (
                    <Card
                      key={index}
                      className="bg-white/90 border border-[#e4e7ec] rounded-xl p-6 hover:shadow-md hover:border-[#7f56d9] transition-colors duration-150 relative will-change-auto"
                    >
                      {/* Impact Badge */}
                      {topic.impact && (
                        <div className="mb-4">
                          <Badge className={`text-white text-xs px-3 py-1 rounded-full ${
                            topic.impact === 'High' ? 'bg-green-500' :
                            topic.impact === 'Medium' ? 'bg-yellow-500' :
                            topic.impact === 'Low' ? 'bg-gray-500' : 'bg-blue-500'
                          }`}>
                            {topic.impact} Impact
                          </Badge>
                        </div>
                      )}

                      {/* Bookmark Button - Top Right */}
                      <div className="absolute top-3 right-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 hover:bg-blue-50 rounded-full bg-white/80 backdrop-blur-sm shadow-sm border border-gray-100"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSaveIdea(topic, index)
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
                        onClick={() => {
                          setSelectedDetailIdea(topic)
                          setDetailModalOpen(true)
                        }}
                      >
                        <div>
                          <Badge variant="outline" className="text-xs bg-gray-50 mb-3 border-[#e4e7ec]">
                            {topic.content_pillar}
                          </Badge>
                          <h4 className="text-lg font-bold text-[#000000] leading-tight mb-2">
                            {topic.title || topic.concept_idea}
                          </h4>
                          {topic.title && topic.concept_idea && topic.concept_idea !== topic.title && (
                            <p className="text-[#8e8e93] text-sm font-medium mb-2 italic">
                              {topic.concept_idea}
                            </p>
                          )}
                        </div>
                        
                        <p className="text-[#535862] text-sm line-clamp-4">
                          {topic.description}
                        </p>
                        
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
                                handleFeedback(topic, 'good')
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
                                handleFeedback(topic, 'bad')
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
                  })}
                </div>
              </div>
            </div>
          )}
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
        activeProductFocus={activeProductFocus}
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