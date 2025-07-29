"use client"

import Image from "next/image"
import Link from "next/link"
import { useState, useEffect, Suspense } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronUp, Plus, User, Bookmark, Settings, History, Sparkles, ArrowRight, RefreshCcw, Share2, Copy, Lightbulb } from "lucide-react"
import { FeedbackForm } from "@/components/feedback-form"
import { IdeaDetailModal } from "@/components/idea-detail-modal"
import { SessionHistory } from "@/components/session-history"
import { useSearchParams } from "next/navigation"
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
  const [topics, setTopics] = useState<IdeaRecommendation[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [instructions, setInstructions] = useState("")
  const [clients, setClients] = useState<ClientWithProductFocus[]>([])
  const [savedIdeas, setSavedIdeas] = useState<Set<string>>(new Set())
  const [feedbackFormOpen, setFeedbackFormOpen] = useState(false)
  const [selectedIdea, setSelectedIdea] = useState<IdeaRecommendation | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedDetailIdea, setSelectedDetailIdea] = useState<IdeaRecommendation | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>("Gemini 2.5 Pro")
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')
  const [isSharing, setIsSharing] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [isBrandOpen, setIsBrandOpen] = useState(true)
  
  // Get URL parameters
  const activeClientId = searchParams.get('clientId') || null
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
      // Use template content if template is selected, otherwise use user input
      const selectedTemplateContent = selectedTemplate 
        ? briefTemplates.find(t => t.id === selectedTemplate)?.content 
        : undefined
      
      const finalInstructions = selectedTemplateContent || instructions.trim() || undefined

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
      setInstructions("")
      setSelectedTemplate(templateId)
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
    <div className="flex min-h-screen bg-[url('/placeholder.svg?height=100&width=100')] bg-repeat p-4 md:p-8">
      <div className="flex w-full max-w-screen-xl mx-auto rounded-lg shadow-lg overflow-hidden bg-[#ffffff]">
        {/* Sidebar */}
        <aside className="w-64 bg-[#ffffff] p-6 border-r border-[#e4e7ec] flex flex-col justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[#000000] mb-8">Creative Strategist.</h1>
            <nav className="space-y-2">
              <Collapsible open={isBrandOpen} onOpenChange={setIsBrandOpen} className="w-full">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#7f56d9]"
                  >
                    <User className="mr-2 h-4 w-4" />
                    แบรนด์
                    <ChevronUp
                      className={`ml-auto h-4 w-4 transition-transform ${isBrandOpen ? "rotate-0" : "rotate-180"}`}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 pl-8 pt-2">
                  {/* Current active client */}
                  {activeClientName !== "No Client Selected" && (
                    <div className="block text-sm text-[#6941c6] bg-[#e9d7fe] py-1 px-2 rounded-md font-medium">
                      {activeClientName}
                    </div>
                  )}
                  
                  {/* Dynamic client list */}
                  {clients.map((client) => (
                    <div key={client.id} className="space-y-1">
                      {client.clientName !== activeClientName && (
                        <Link
                          href={`?clientId=${client.productFocuses[0]?.id || client.id}&clientName=${encodeURIComponent(client.clientName)}`}
                          className="block text-sm text-[#535862] hover:text-[#6941c6] hover:bg-[#e9d7fe] py-1 px-2 rounded-md"
                        >
                          {client.clientName}
                        </Link>
                      )}
                      
                      {/* Show product focuses for active client */}
                      {client.clientName === activeClientName && client.productFocuses.length > 1 && (
                        <div className="ml-4 space-y-1">
                          {client.productFocuses.map((pf) => (
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
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Session History Link */}
                  {activeClientName !== "No Client Selected" && (
                    <Button
                      onClick={() => setHistoryModalOpen(true)}
                      variant="ghost"
                      className="w-full justify-between text-sm text-[#535862] hover:text-[#6941c6] hover:bg-[#e9d7fe] py-1 px-2 rounded-md mt-2 h-auto"
                    >
                      ดูการสร้างที่ผ่านมา
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </CollapsibleContent>
              </Collapsible>
              <Link href="/new-client">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#7f56d9]"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  เพิ่มรายชื่อ
                </Button>
              </Link>
            </nav>
            <div className="my-4 border-t border-[#e4e7ec]" />
            <nav className="space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#7f56d9]"
              >
                <Bookmark className="mr-2 h-4 w-4" />
                รายการที่บันทึก
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#7f56d9]"
              >
                <Settings className="mr-2 h-4 w-4" />
                ตั้งค่าและวิเคราะห์
              </Button>
              <Button
                onClick={() => setHistoryModalOpen(true)}
                variant="ghost"
                className="w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#7f56d9]"
              >
                <History className="mr-2 h-4 w-4" />
                ประวัติการสร้าง
              </Button>
              <div className="space-y-1 pl-8 pt-2 text-sm text-[#535862]">
                <p>สร้างคอนเทนต์ที่ตรงไอธุรกิจเลือก</p>
                <p>สร้างรูปที่ตรงใจธุรกิจคุณและลูกค้า</p>
                <p>สร้างคอนเทนต์ที่ตรงธุรกิจอย่าลืม</p>
                <p>สร้างคอนเทนต์ที่ตรงธุรกิจให้ได้</p>
              </div>
            </nav>
          </div>
          <div className="flex items-center space-x-3 p-2 border-t border-[#e4e7ec] mt-4">
            <Avatar className="h-8 w-8 bg-[#7f56d9] text-[#ffffff] font-bold">
              <AvatarFallback>A</AvatarFallback>
            </Avatar>
            <span className="text-[#000000] font-medium">Admin</span>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {/* Header Section */}
          <div className="flex flex-col items-center justify-center text-center mb-8">
            <Image
              src="/placeholder.svg?height=120&width=120"
              alt="Meditating person with laptop"
              width={120}
              height={120}
              className="mb-6"
            />
            <h2 className="text-2xl font-bold text-[#000000] mb-2">ต้องการไอเดียสร้างคอนเทนต์ใช่ไหม?</h2>
            <p className="text-sm text-[#535862] mb-8 max-w-md">
              เลือกคอนเทนต์แนะนำด้านล่างได้เลย — อย่าลืมเลือกลูกค้าทางซ้าย ให้ได้คอนเทนต์ที่ใช่ยิ่งขึ้น
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
                  className={`h-auto py-4 px-6 flex items-center justify-start text-left border-[#e4e7ec] hover:bg-[#e9d7fe] hover:border-[#b692f6] hover:text-[#6941c6] bg-transparent shadow-lg max-w-fit transition-all ${
                    selectedTemplate === template.id 
                      ? 'bg-[#e9d7fe] border-[#b692f6] text-[#6941c6]' 
                      : 'text-[#535862]'
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
                    <Lightbulb className="mr-2 h-4 w-4" />
                    Generate
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Results Section */}
          {topics.length > 0 && (
            <div className="mt-8">
              <div className="bg-white rounded-2xl p-8 shadow-lg border border-[#e4e7ec]">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-[#000000] mb-2">Generated Ideas</h3>
                  <p className="text-[#535862]">สร้างไอเดีย {topics.length} ข้อสำเร็จแล้ว</p>
                  
                  {/* Action Buttons */}
                  <div className="flex justify-center gap-4 mt-6">
                    <Button
                      onClick={handleCopyAllIdeas}
                      variant="outline"
                      className="px-6 border-[#e4e7ec] hover:bg-[#f5f5f5]"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy All Ideas
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
                  {topics.map((topic, index) => (
                    <Card
                      key={index}
                      className="bg-white border border-[#e4e7ec] rounded-xl p-6 hover:shadow-lg transition-all duration-200 cursor-pointer"
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
                          <Badge variant="outline" className="text-xs bg-gray-50 mb-3 border-[#e4e7ec]">
                            {topic.content_pillar}
                          </Badge>
                          <h4 className="text-lg font-bold text-[#000000] leading-tight mb-2">
                            {topic.concept_idea || topic.title}
                          </h4>
                        </div>
                        
                        <p className="text-[#535862] text-sm line-clamp-4">
                          {topic.description}
                        </p>
                        
                        <div className="flex flex-wrap gap-2">
                          {(topic.tags || []).slice(0, 3).map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs border-[#e4e7ec]">
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
        </main>
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
      
      <SessionHistory
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        activeClientName={activeClientName}
      />
    </div>
  )
}

export default function Component() {
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
