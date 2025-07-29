'use client'

import { useState, useEffect, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RefreshCcw, Share2, Copy } from "lucide-react"
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
  
  // New state for card selection and feedback
  const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set())
  const [ideaFeedback, setIdeaFeedback] = useState<Record<number, {vote?: 'good' | 'bad', comment?: string, showTemplates?: boolean}>>({})
  const [editingFeedbackId, setEditingFeedbackId] = useState<number | null>(null)
  const [isRegeneratingIdea, setIsRegeneratingIdea] = useState(false)
  const [regeneratingIdeaId, setRegeneratingIdeaId] = useState<number | null>(null)

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
  const [isSharing, setIsSharing] = useState(false)
  const [showBriefTemplates, setShowBriefTemplates] = useState(false)
  
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

      // Auto close after 10 seconds
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

  const handleTemplateSelect = (templateId: string) => {
    const template = briefTemplates.find(t => t.id === templateId)
    if (template) {
      setInstructions(template.content)
      setSelectedTemplate(templateId)
      // Auto-generate ideas when template is selected
      handleGenerateTopics()
    }
  }

  const handleCopyAllIdeas = () => {
    if (!topics.length) {
      alert('ไม่มีไอเดียที่จะคัดลอก')
      return
    }

    const formattedText = `Creative Ideas - ${activeClientName}\nProduct Focus: ${activeProductFocus}\nCreated: ${new Date().toLocaleDateString('th-TH')}\nModel: ${selectedModel}\n${instructions ? `Instructions: ${instructions}\n` : ''}\n` +
      topics.map((idea, index) => 
        `${index + 1}. ${idea.concept_idea}\n` +
        `Impact: ${idea.impact}\n` +
        `Description: ${idea.description}\n` +
        `Tags: ${idea.tags.join(', ')}\n` +
        `Content Pillar: ${idea.content_pillar}\n` +
        `Headline: ${idea.copywriting.headline}\n` +
        `CTA: ${idea.copywriting.cta}\n` +
        `Competitive Gap: ${idea.competitiveGap}\n` +
        `---\n`
      ).join('\n')

    navigator.clipboard.writeText(formattedText)
    alert('คัดลอกไอเดียทั้งหมดแล้ว')
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
        // Copy URL to clipboard
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

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[280px_1fr] bg-white">
      <AppSidebar activeClientId={activeClientId} activeClientName={activeClientName || "No Client Selected"} activeProductFocus={activeProductFocus} />
      <div className="flex flex-col">
        <AppHeader activeClientId={activeClientId} activeProductFocus={activeProductFocus} activeClientName={activeClientName || "No Client Selected"} />

        {/* Main Content */}
        <div className="flex-1 bg-gray-50 p-8">

          {/* Gradient Section Container */}
          <div className="bg-gradient-to-br from-yellow-200 via-orange-300 to-pink-400 rounded-3xl p-12 shadow-lg">
            <div className="max-w-2xl mx-auto">
              {/* Main Heading */}
              <h1 className="text-5xl font-bold text-gray-900 text-center mb-8 font-ibm-plex-thai leading-tight">
                ต้องการไอเดียสร้างคอนเทนต์ใช่ไหม?
              </h1>

              {/* Description */}
              <p className="text-center text-gray-700 text-xl mb-12 font-ibm-plex-thai font-medium leading-relaxed">
                เลือกประเภทไอเดียที่ต้องการ เพื่อสร้างคอนเทนต์ที่ตรงกับกลุ่มเป้าหมายของคุณ
              </p>

              {/* Template Selection Cards */}
              <div className="space-y-4">
                <div
                  onClick={() => handleTemplateSelect('pain-point')}
                  className={`bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer ${
                    selectedTemplate === 'pain-point' ? 'ring-4 ring-blue-500 ring-opacity-50' : ''
                  } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">⚡</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-3 font-ibm-plex-thai">Pain Point Solutions</h3>
                      <p className="text-gray-700 font-ibm-plex-thai leading-relaxed">
                        สร้างไอเดียที่เจาะจงปัญหาหลักของลูกค้า และแสดงให้เห็นว่าผลิตภัณฑ์ของเราช่วยแก้ปัญหาได้อย่างไร
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => handleTemplateSelect('data-driven')}
                  className={`bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer ${
                    selectedTemplate === 'data-driven' ? 'ring-4 ring-blue-500 ring-opacity-50' : ''
                  } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">📊</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-3 font-ibm-plex-thai">Data-Driven Marketing</h3>
                      <p className="text-gray-700 font-ibm-plex-thai leading-relaxed">
                        ใช้ข้อมูล สถิติ และหลักฐานที่น่าเชื่อถือ เพื่อสร้างความเชื่อมั่นและแสดงประสิทธิภาพของผลิตภัณฑ์
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => handleTemplateSelect('unexpected')}
                  className={`bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer ${
                    selectedTemplate === 'unexpected' ? 'ring-4 ring-blue-500 ring-opacity-50' : ''
                  } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">✨</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-3 font-ibm-plex-thai">Creative Content</h3>
                      <p className="text-gray-700 font-ibm-plex-thai leading-relaxed">
                        สร้างไอเดียที่แตกต่าง ไม่เหมือนใคร และเน้นการใช้งานที่คู่แข่งยังไม่เคยพูดถึง
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Loading State */}
              {isGenerating && (
                <div className="mt-8 text-center">
                  <div className="flex items-center justify-center gap-3">
                    <RefreshCcw className="w-6 h-6 animate-spin text-gray-700" />
                    <span className="text-gray-700 font-semibold text-lg font-ibm-plex-thai">กำลังสร้างไอเดีย...</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Results Section */}
          {topics.length > 0 && (
            <div className="mt-8">
              <div className="bg-white rounded-2xl p-8 shadow-lg">
                <div className="text-center mb-8">
                  <h2 className="text-4xl font-bold text-gray-900 mb-4 font-ibm-plex-thai">Generated Ideas</h2>
                  <p className="text-gray-600 text-lg font-ibm-plex-thai font-medium">สร้างไอเดีย {topics.length} ข้อสำเร็จแล้ว</p>
                  
                  {/* Action Buttons */}
                  <div className="flex justify-center gap-4 mt-6">
                    <Button
                      onClick={handleCopyAllIdeas}
                      variant="outline"
                      className="px-6"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy All Ideas
                    </Button>
                    
                    <Button
                      onClick={handleShareIdeas}
                      disabled={isSharing}
                      className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white px-6"
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
                  {topics.map((topic, index) => (
                    <Card
                      key={index}
                      className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200 cursor-pointer"
                      onClick={() => {
                        setSelectedDetailIdea(topic)
                        setDetailModalOpen(true)
                      }}
                    >
                      {/* High Impact Badge */}
                      {topic.impact === 'High' && (
                        <div className="mb-4">
                          <Badge className="bg-green-500 text-white text-xs px-3 py-1 rounded-full">
                            High Impact
                          </Badge>
                        </div>
                      )}

                      <div className="space-y-4">
                        <div>
                          <Badge variant="outline" className="text-xs bg-gray-50 mb-3 font-ibm-plex-thai">
                            {topic.content_pillar}
                          </Badge>
                          <h3 className="text-lg font-bold text-gray-900 leading-tight mb-3 font-ibm-plex-thai">
                            {topic.concept_idea || topic.title}
                          </h3>
                        </div>
                        
                        <p className="text-gray-600 text-sm line-clamp-4 font-ibm-plex-thai leading-relaxed">
                          {topic.description}
                        </p>
                        
                        <div className="flex flex-wrap gap-2">
                          {(topic.tags || []).slice(0, 3).map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs font-ibm-plex-thai">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Modals */}
      <FeedbackForm
        isOpen={feedbackFormOpen}
        onClose={() => setFeedbackFormOpen(false)}
        idea={selectedIdea}
        clientName={activeClientName || ""}
        productFocus={activeProductFocus || ""}
      />

      <IdeaDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        idea={selectedDetailIdea}
      />
    </div>
  )
}

export default function RenewPage() {
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
