'use client'

import { useState, useEffect, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, RefreshCcw, Bookmark, Sparkles } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppSidebar } from "@/components/layout/sidebar"
import { AppHeader } from "@/components/layout/header"
import { FeedbackForm } from "@/components/feedback-form"
import { IdeaDetailModal } from "@/components/idea-detail-modal"
import { useSearchParams } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"

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

// Client component that uses useSearchParams
function MainContent() {
  const searchParams = useSearchParams()
  const [topics, setTopics] = useState<IdeaRecommendation[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [instructions, setInstructions] = useState("")
  const [clients, setClients] = useState<any[]>([])
  const [savedIdeas, setSavedIdeas] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState<Set<number>>(new Set())
  const [savedTopics, setSavedTopics] = useState<IdeaRecommendation[]>([])
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)
  const [activeTopicTab, setActiveTopicTab] = useState<"generate" | "saved">("generate")
  const [feedbackFormOpen, setFeedbackFormOpen] = useState(false)

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
  const [selectedIdea, setSelectedIdea] = useState<IdeaRecommendation | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedDetailIdea, setSelectedDetailIdea] = useState<IdeaRecommendation | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>("Gemini 2.5 Pro")
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')
  const [showReturnNotification, setShowReturnNotification] = useState(false)
  const [returnNotificationData, setReturnNotificationData] = useState<any>(null)
  
  const modelOptions = [
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    { id: "gpt-4o", name: "GPT-4o" }
  ]
  
  const briefTemplates = [
    {
      id: "pain-point",
      title: "Pain Point Solution Focus",
      content: "I want you to generate ideas that directly address a key pain point of our target customers, and clearly show how our product or service uniquely solves this problem."
    },
    {
      id: "testimonial",
      title: "Emotional Testimonial Leverage",
      content: "Please create ideas that leverage real or hypothetical testimonials—showing authentic customer voices and how their lives improved after using our product or service."
    },
    {
      id: "data-driven",
      title: "Data-Driven Proof",
      content: "Develop ideas that use surprising, compelling, or quantifiable proof points (e.g., statistics, results, or proprietary data) to demonstrate the effectiveness of our product or service in a way that builds trust."
    },
    {
      id: "comparison",
      title: "Comparison/Before-After Stories",
      content: "Generate ideas that use 'before and after' scenarios, direct comparisons, or transformation stories to vividly illustrate the difference our product or service makes."
    },
    {
      id: "unexpected",
      title: "Unexpected Use Cases or Benefits",
      content: "I want you to come up with ideas that highlight unusual, overlooked, or unexpected ways our product or service can be used, providing fresh perspectives that competitors aren't talking about."
    }
  ]
  
  const activeClientId = searchParams.get('clientId') || null
  const activeProductFocus = searchParams.get('productFocus') || null
  const activeClientName = searchParams.get('clientName') || "No Client Selected"

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

  // Load ideas from localStorage when component mounts or client/product focus changes
  useEffect(() => {
    if (activeClientName && activeProductFocus && activeClientName !== 'No Client Selected') {
      const storedIdeas = loadIdeasFromStorage(activeClientName, activeProductFocus)
      if (storedIdeas.length > 0) {
        setTopics(storedIdeas)
        console.log(`Loaded ${storedIdeas.length} ideas from localStorage for ${activeClientName} - ${activeProductFocus}`)
      } else {
        // Clear topics if no stored ideas for this client/product focus
        setTopics([])
      }
    } else {
      // Clear topics if no valid client/product focus
      setTopics([])
    }
  }, [activeClientName, activeProductFocus])

  // Check for return notification on mount
  useEffect(() => {
    const checkReturnNotification = () => {
      try {
        const lastGeneration = localStorage.getItem('lastGenerationComplete')
        if (lastGeneration) {
          const data = JSON.parse(lastGeneration)
          const now = Date.now()
          const timeDiff = now - data.timestamp
          
          // Show return notification if:
          // 1. Generation completed within last 30 minutes
          // 2. Not already shown
          // 3. Current page matches the generation context
          if (
            timeDiff < 30 * 60 * 1000 && // 30 minutes
            !data.shown &&
            data.clientName === activeClientName &&
            data.productFocus === activeProductFocus
          ) {
            setReturnNotificationData(data)
            setShowReturnNotification(true)
            
            // Mark as shown
            localStorage.setItem('lastGenerationComplete', JSON.stringify({
              ...data,
              shown: true
            }))
          }
        }
      } catch (error) {
        console.log('Error checking return notification:', error)
      }
    }

    // Check after a small delay to ensure URL params are loaded
    if (activeClientName && activeProductFocus) {
      setTimeout(checkReturnNotification, 1000)
    }
  }, [activeClientName, activeProductFocus])

  // Function to play notification sound
  const playNotificationSound = () => {
    try {
      // Use the new notification sound file
      const audio = new Audio('/new-notification-011-364050.mp3')
      audio.volume = 0.5 // Set volume to 50%
      
      // Log for debugging
      console.log('Attempting to play notification sound...')
      
      audio.play().then(() => {
        console.log('Notification sound played successfully')
      }).catch(error => {
        console.error('Could not play notification sound:', error)
        // Fallback to Web Audio API beep
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
          const oscillator = audioContext.createOscillator()
          const gainNode = audioContext.createGain()
          
          oscillator.connect(gainNode)
          gainNode.connect(audioContext.destination)
          
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
          oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1)
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2)
          
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
          
          oscillator.start(audioContext.currentTime)
          oscillator.stop(audioContext.currentTime + 0.3)
          
          console.log('Played fallback beep sound')
        } catch (fallbackError) {
          console.error('Fallback sound also failed:', fallbackError)
        }
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
        icon: '/favicon.ico', // You can add a custom icon
        badge: '/favicon.ico',
        tag: 'idea-generation',
        requireInteraction: true,
        data: { ideaCount }
      })

      notification.onclick = () => {
        window.focus()
        notification.close()
      }

      // Auto close after 10 seconds
      setTimeout(() => notification.close(), 10000)
    }
  }

  // Load clients on mount
  useEffect(() => {
    const loadClients = async () => {
      try {
        const response = await fetch('/api/clients')
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

  // Load saved ideas when client/product focus changes
  useEffect(() => {
    const loadSavedIdeas = async () => {
      if (activeClientName && activeClientName !== "No Client Selected" && activeProductFocus) {
        try {
          const response = await fetch(`/api/save-idea?clientName=${encodeURIComponent(activeClientName)}&productFocus=${encodeURIComponent(activeProductFocus)}`)
          const data = await response.json()
          
          if (data.success) {
            setSavedIdeas(new Set(data.savedTitles))
          }
        } catch (error) {
          console.error('Error loading saved ideas:', error)
        }
      }
    }
    loadSavedIdeas()
  }, [activeClientName, activeProductFocus])

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
      const response = await fetch('/api/generate-ideas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientName: activeClientName,
          productFocus: activeProductFocus,
          instructions: instructions.trim() || undefined,
          model: modelOptions.find(m => m.name === selectedModel)?.id || "gemini-2.5-pro",
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        setTopics(data.ideas)
        // Save ideas to localStorage
        if (activeClientName && activeProductFocus) {
          saveIdeasToStorage(data.ideas, activeClientName, activeProductFocus)
        }
        // Clear saved ideas state when new topics are generated
        setSavedIdeas(new Set())
        // Load saved ideas for new topics
        setTimeout(loadSavedIdeas, 100)
        
        // Show completion notifications
        const ideaCount = data.ideas.length
        playNotificationSound()
        showNotification(
          '🎉 ไอเดียสร้างเสร็จแล้ว!',
          `สร้างไอเดีย ${ideaCount} ข้อสำเร็จแล้วสำหรับ ${activeClientName}`,
          ideaCount
        )
        
        // Store completion info in localStorage for return notification
        localStorage.setItem('lastGenerationComplete', JSON.stringify({
          timestamp: Date.now(),
          clientName: activeClientName,
          productFocus: activeProductFocus,
          ideaCount,
          shown: false
        }))
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

  const loadSavedIdeas = async () => {
    if (activeClientName && activeClientName !== "No Client Selected" && activeProductFocus) {
      try {
        const response = await fetch(`/api/save-idea?clientName=${encodeURIComponent(activeClientName)}&productFocus=${encodeURIComponent(activeProductFocus)}`)
        const data = await response.json()
        
        if (data.success) {
          setSavedIdeas(new Set(data.savedTitles))
        }
      } catch (error) {
        console.error('Error loading saved ideas:', error)
      }
    }
  }

  const handleSaveIdea = async (topic: IdeaRecommendation, index: number) => {
    if (!activeClientName || !activeProductFocus) {
      alert('กรุณาเลือกลูกค้าและ Product Focus ก่อน')
      return
    }

    const isSaved = savedIdeas.has(topic.title)
    const action = isSaved ? 'unsave' : 'save'

    // Add to saving state
    setIsSaving(prev => new Set(prev.add(index)))

    try {
      const response = await fetch('/api/save-idea', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idea: topic,
          clientName: activeClientName,
          productFocus: activeProductFocus,
          action
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        if (action === 'save') {
          setSavedIdeas(prev => new Set(prev.add(topic.title)))
          // Show success message (you can replace with toast)
          console.log('Idea saved successfully!')
        } else {
          setSavedIdeas(prev => {
            const newSet = new Set(prev)
            newSet.delete(topic.title)
            return newSet
          })
          console.log('Idea removed successfully!')
        }
      } else {
        alert(`เกิดข้อผิดพลาด: ${data.error}`)
      }
    } catch (error) {
      console.error('Error saving idea:', error)
      alert('เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่อีกครั้ง')
    } finally {
      // Remove from saving state
      setIsSaving(prev => {
        const newSet = new Set(prev)
        newSet.delete(index)
        return newSet
      })
    }
  }

  const handleOpenFeedback = (idea: IdeaRecommendation) => {
    setSelectedIdea(idea)
    setFeedbackFormOpen(true)
  }

  const handleCloseFeedback = () => {
    setFeedbackFormOpen(false)
    setSelectedIdea(null)
  }

  const handleOpenDetail = (idea: IdeaRecommendation) => {
    setSelectedDetailIdea(idea)
    setDetailModalOpen(true)
  }

  const handleCloseDetail = () => {
    setDetailModalOpen(false)
    setSelectedDetailIdea(null)
  }

  const handleTemplateSelect = (templateId: string) => {
    const template = briefTemplates.find(t => t.id === templateId)
    if (template) {
      setInstructions(template.content)
      setSelectedTemplate(templateId)
    }
  }

  // Clear template selection when user manually edits instructions
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInstructions(e.target.value)
    // Clear selected template if user manually edits
    if (selectedTemplate) {
      const selectedTemplateContent = briefTemplates.find(t => t.id === selectedTemplate)?.content
      if (e.target.value !== selectedTemplateContent) {
        setSelectedTemplate(null)
      }
    }
  }

  const loadSavedTopics = async () => {
    if (!activeClientName || activeClientName === "No Client Selected" || !activeProductFocus) {
      setSavedTopics([])
      return
    }
    
    setIsLoadingSaved(true)
    try {
      const response = await fetch(`/api/saved-topics?clientName=${encodeURIComponent(activeClientName)}&productFocus=${encodeURIComponent(activeProductFocus)}`)
      const data = await response.json()
      
      if (data.success) {
        setSavedTopics(data.savedTopics)
      } else {
        console.error('Error loading saved topics:', data.error)
      }
    } catch (error) {
      console.error('Error loading saved topics:', error)
    } finally {
      setIsLoadingSaved(false)
    }
  }

  // Load saved topics when tab is switched to saved or when client/product changes
  useEffect(() => {
    if (activeTopicTab === "saved") {
      loadSavedTopics()
    }
  }, [activeTopicTab, activeClientName, activeProductFocus])

  const renderTabButtons = (refreshAction?: () => void, isLoading?: boolean) => (
    <div className="relative flex justify-center mb-4">
      <div className="flex bg-[#f8f9fa] border border-[#d1d1d6] rounded-xl p-1 shadow-sm">
        <Button
          variant="ghost"
          className={`px-6 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
            activeTopicTab === "generate" 
              ? "bg-white text-black shadow-sm border border-white" 
              : "bg-transparent text-[#666666] hover:text-black hover:bg-white/50"
          }`}
          onClick={() => setActiveTopicTab("generate")}
        >
          🚀 Generate Topic
        </Button>
        <Button
          variant="ghost"
          className={`px-6 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
            activeTopicTab === "saved" 
              ? "bg-white text-black shadow-sm border border-white" 
              : "bg-transparent text-[#666666] hover:text-black hover:bg-white/50"
          }`}
          onClick={() => setActiveTopicTab("saved")}
        >
          💾 Saved Topic
        </Button>
      </div>
      <Button 
        variant="ghost" 
        size="icon" 
        className="absolute right-0 text-[#8e8e93] hover:text-black"
        onClick={refreshAction}
        disabled={isLoading}
      >
        <RefreshCcw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
        <span className="sr-only">Refresh</span>
      </Button>
    </div>
  )



  return (
    <div className="grid min-h-screen w-full md:grid-cols-[280px_1fr] bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <AppSidebar activeClientId={activeClientId} activeClientName={activeClientName} activeProductFocus={activeProductFocus} />
      <div className="flex flex-col">
        <AppHeader activeClientId={activeClientId} activeProductFocus={activeProductFocus} activeClientName={activeClientName} />
        <main className="flex-1 p-6 overflow-auto">
          {/* Return Notification Banner */}
          {showReturnNotification && returnNotificationData && (
            <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg relative">
              <button
                onClick={() => setShowReturnNotification(false)}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-green-100 hover:bg-green-200 flex items-center justify-center text-green-600 text-sm font-bold transition-colors"
              >
                ×
              </button>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-lg">🎉</span>
                </div>
                <div className="flex-1 pr-8">
                  <h3 className="text-green-800 font-medium mb-1">ไอเดียพร้อมแล้ว!</h3>
                  <div className="text-sm text-green-700">
                    <p>สร้างไอเดีย <span className="font-semibold">{returnNotificationData.ideaCount} ข้อ</span> เสร็จเรียบร้อยแล้ว</p>
                    <p className="text-xs text-green-600 mt-1">
                      เมื่อ {new Date(returnNotificationData.timestamp).toLocaleTimeString('th-TH')} • {returnNotificationData.clientName}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Product Focus Selection Guide */}
          {(!activeProductFocus || activeClientName === "No Client Selected") && (
            <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center mt-0.5">
                  <span className="text-white text-sm font-bold">!</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-amber-800 font-medium mb-1">เริ่มต้นสร้างไอเดีย</h3>
                  <div className="text-sm text-amber-700 space-y-1">
                    {activeClientName === "No Client Selected" ? (
                      <p>1. เลือกลูกค้าจากแถบด้านซ้าย</p>
                    ) : (
                      <>
                        <p>✅ เลือกลูกค้าแล้ว: <span className="font-medium">{activeClientName}</span></p>
                        <p>2. เลือก Product Focus จากแถบด้านซ้าย</p>
                      </>
                    )}
                    <p>{activeProductFocus ? "✅" : "3."} กดปุ่ม Generate Topics เพื่อสร้างไอเดีย</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 1: Generate Topics */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">1. Generate Topics</h2>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-[#d1d1d6]">
              {/* FYI Warning */}
              <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-white text-xs font-bold">i</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-blue-800">
                      <span className="font-medium">FYI:</span> กรุณาตรวจสอบการตั้งค่าลูกค้าและ Product Focus ให้ถูกต้องก่อนกดสร้างไอเดีย
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 mb-4">
                <label htmlFor="models" className="text-sm font-medium text-[#000000]">
                  Select Models to Run:
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2 border-[#999999] text-[#000000] hover:bg-[#eeeeee] bg-transparent min-w-[160px]"
                    >
                      {selectedModel}
                      <ChevronDown className="ml-auto h-4 w-4 text-[#8e8e93]" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {modelOptions.map((model) => (
                      <DropdownMenuItem 
                        key={model.id}
                        onClick={() => setSelectedModel(model.name)}
                      >
                        {model.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button 
                  onClick={handleGenerateTopics}
                  disabled={isGenerating}
                  className="ml-auto bg-black text-white hover:bg-gray-800"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                      กำลังสร้าง...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Topics
                    </>
                  )}
                </Button>
              </div>
              
              
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="instructions" className="text-sm font-medium text-[#000000]">
                    Optional instructions
                  </label>
                  {instructions && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setInstructions('')
                        setSelectedTemplate(null)
                      }}
                      className="text-gray-600 hover:text-gray-800 hover:bg-gray-50 text-xs h-auto py-1 px-2"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <Textarea
                  id="instructions"
                  value={instructions}
                  onChange={handleInstructionsChange}
                  placeholder="Provide additional context or specific instructions, or click one of the buttons below to auto-fill..."
                  className="min-h-[80px] border-[#999999] focus:border-black focus:ring-0"
                />
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {briefTemplates.map((template) => (
                  <Button
                    key={template.id}
                    variant="outline"
                    onClick={() => handleTemplateSelect(template.id)}
                    className={`text-sm px-3 py-1 h-auto transition-all duration-200 ${
                      selectedTemplate === template.id
                        ? 'border-black bg-black text-white hover:bg-gray-800'
                        : 'border-[#999999] text-[#000000] hover:bg-[#eeeeee] bg-transparent'
                    }`}
                  >
                    {template.title}
                  </Button>
                ))}
              </div>

{activeTopicTab === "generate" ? (
                <Tabs defaultValue="openai" className="w-full">
                  <TabsList className="grid w-full grid-cols-1 h-auto bg-transparent p-0 border-b border-[#d1d1d6]">
                    <TabsTrigger
                      value="openai"
                      className="data-[state=active]:bg-white data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none text-sm font-medium py-2"
                    >
                      Ideas Result
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="openai" className="mt-4">
                    {renderTabButtons()}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {topics.length > 0 ? topics.map((topic, index) => (
                        <Card 
                          key={index} 
                          className="p-4 border border-[#d1d1d6] shadow-sm relative cursor-pointer hover:shadow-md transition-shadow duration-200"
                          onClick={() => handleOpenDetail(topic)}
                        >
                          <Badge className={`text-white text-xs font-normal px-2 py-0.5 rounded-sm mb-2 ${
                            topic.impact === 'High' ? 'bg-[#34c759]' : 
                            topic.impact === 'Medium' ? 'bg-[#f59e0b]' : 'bg-[#ef4444]'
                          }`}>
                            {topic.impact} Impact
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSaveIdea(topic, index)
                            }}
                            disabled={isSaving.has(index)}
                            className="absolute top-4 right-4 h-6 w-6 text-[#8e8e93] hover:text-black"
                          >
                            {isSaving.has(index) ? (
                              <RefreshCcw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Bookmark 
                                className={`h-4 w-4 ${
                                  savedIdeas.has(topic.title) 
                                    ? 'fill-yellow-400 text-yellow-400' 
                                    : 'text-[#8e8e93]'
                                }`} 
                              />
                            )}
                            <span className="sr-only">
                              {savedIdeas.has(topic.title) ? 'Remove bookmark' : 'Add bookmark'}
                            </span>
                          </Button>
                          <h3 className="text-lg font-semibold mb-2">{topic.concept_idea}</h3>
                          <p className="text-sm text-[#000000] mb-4">{topic.description}</p>
                          <div className="flex flex-wrap gap-2 mb-4">
                            {topic.tags.map((tag, i) => (
                              <Button
                                key={i}
                                variant="outline"
                                className="border-[#999999] text-[#000000] hover:bg-[#eeeeee] text-xs px-2 py-0.5 h-auto bg-transparent"
                              >
                                {tag}
                              </Button>
                            ))}
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenFeedback(topic)
                            }}
                            className="text-sm text-[#000000] hover:underline cursor-pointer bg-transparent border-none p-0"
                          >
                            Add feedback
                          </button>
                        </Card>
                      )) : (
                        <div className="col-span-2 text-center py-8 text-gray-500">
                          {isGenerating ? (
                            <div className="flex items-center justify-center gap-2">
                              <RefreshCcw className="w-5 h-5 animate-spin" />
                              กำลังสร้างหัวข้อ...
                            </div>
                          ) : (
                            "คลิก Generate Topics เพื่อสร้างหัวข้อใหม่"
                          )}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="mt-4">
                  {renderTabButtons(loadSavedTopics, isLoadingSaved)}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {isLoadingSaved ? (
                      <div className="col-span-2 text-center py-8 text-gray-500">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCcw className="w-5 h-5 animate-spin" />
                          กำลังโหลดหัวข้อที่บันทึกไว้...
                        </div>
                      </div>
                    ) : savedTopics.length > 0 ? (
                      savedTopics.map((topic, index) => (
                        <Card 
                          key={index} 
                          className="p-4 border border-[#d1d1d6] shadow-sm relative cursor-pointer hover:shadow-md transition-shadow duration-200"
                          onClick={() => handleOpenDetail(topic)}
                        >
                          <Badge className={`text-white text-xs font-normal px-2 py-0.5 rounded-sm mb-2 ${
                            topic.impact === 'High' ? 'bg-[#34c759]' : 
                            topic.impact === 'Medium' ? 'bg-[#f59e0b]' : 'bg-[#ef4444]'
                          }`}>
                            {topic.impact} Impact
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSaveIdea(topic, index)
                            }}
                            disabled={isSaving.has(index)}
                            className="absolute top-4 right-4 h-6 w-6 text-[#8e8e93] hover:text-black"
                          >
                            <Bookmark className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="sr-only">Remove bookmark</span>
                          </Button>
                          <h3 className="text-lg font-semibold mb-2">{topic.concept_idea}</h3>
                          <p className="text-sm text-[#000000] mb-4">{topic.description}</p>
                          <div className="flex flex-wrap gap-2 mb-4">
                            {topic.tags.map((tag, i) => (
                              <Button
                                key={i}
                                variant="outline"
                                className="border-[#999999] text-[#000000] hover:bg-[#eeeeee] text-xs px-2 py-0.5 h-auto bg-transparent"
                              >
                                {tag}
                              </Button>
                            ))}
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenFeedback(topic)
                            }}
                            className="text-sm text-[#000000] hover:underline cursor-pointer bg-transparent border-none p-0"
                          >
                            Add feedback
                          </button>
                        </Card>
                      ))
                    ) : (
                      <div className="col-span-2 text-center py-8 text-gray-500">
                        {!activeClientName || activeClientName === "No Client Selected" || !activeProductFocus ? (
                          "กรุณาเลือกลูกค้าและ Product Focus เพื่อดูหัวข้อที่บันทึกไว้"
                        ) : (
                          "ยังไม่มีหัวข้อที่บันทึกไว้สำหรับลูกค้าและ Product Focus นี้"
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>


        </main>
      </div>
      
      {/* Feedback Form Modal */}
      <FeedbackForm
        isOpen={feedbackFormOpen}
        onClose={handleCloseFeedback}
        idea={selectedIdea}
        clientName={activeClientName}
        productFocus={activeProductFocus || ''}
      />

      {/* Idea Detail Modal */}
      <IdeaDetailModal
        isOpen={detailModalOpen}
        onClose={handleCloseDetail}
        idea={selectedDetailIdea}
      />
    </div>
  )
}

export default function Page() {
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
