'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, RefreshCcw, Bookmark, Edit, Lock, Sparkles } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppSidebar } from "@/components/layout/sidebar"
import { AppHeader } from "@/components/layout/header"
import { FeedbackForm } from "@/components/feedback-form"
import { IdeaDetailModal } from "@/components/idea-detail-modal"
import { useSearchParams } from "next/navigation"

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

export default function Component() {
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
  const [selectedIdea, setSelectedIdea] = useState<IdeaRecommendation | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedDetailIdea, setSelectedDetailIdea] = useState<IdeaRecommendation | null>(null)
  
  const activeClientId = searchParams.get('clientId') || null
  const activeProductFocus = searchParams.get('productFocus') || null
  const activeClientName = searchParams.get('clientName') || "No Client Selected"

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
          productFocus: activeProductFocus
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        setTopics(data.ideas)
        // Clear saved ideas state when new topics are generated
        setSavedIdeas(new Set())
        // Load saved ideas for new topics
        setTimeout(loadSavedIdeas, 100)
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


  const ideasData = [
    {
      id: "1",
      focusTarget: "Focus Target 1",
      keyMessage: "ปลดล็อคยอดขายพุ่งทะยาน ด้วยจิตวิทยา 'ความกลัว' ใน 3 วินาที",
      topicIdeas: [
        {
          category: "Product Benefits",
          items: [
            "เพิ่มยอดขายอย่างรวดเร็วและมีประสิทธิภาพ",
            "เข้าถึงกลุ่มเป้าหมายที่ใช่ ด้วยแคมเปญที่ดึงดูด",
            "เรียนรู้วิธีสร้างสรรค์โฆษณาที่กระตุ้นการตัดสินใจซื้อทันที",
          ],
        },
        {
          category: "Pain Points & Emotional",
          items: [
            "ขาดความเข้าใจในการใช้จิตวิทยา 'ความกลัว' ในการตลาด",
            "แคมเปญโฆษณาไม่ดึงดูด ไม่ได้ผลลัพธ์ที่ต้องการ",
            "กลัวที่จะพลาดโอกาสในการเพิ่มยอดขายและเติบโต",
          ],
        },
        {
          category: "Promotion & Pricing",
          items: [
            "แพคเกจราคาพิเศษสำหรับลูกค้าใหม่ที่ต้องการทดลอง",
            "โปรโมชั่นลดราคาสำหรับการใช้บริการครบวงจร",
            "รับคำปรึกษาฟรี เพื่อวางแผนกลยุทธ์ที่เหมาะสมกับธุรกิจของคุณ",
          ],
        },
      ],
    },
    {
      id: "2",
      focusTarget: "Focus Target 2",
      keyMessage: "ปลดล็อคยอดขายพุ่งทะยาน ด้วยจิตวิทยา 'ความกลัว' ใน 3 วินาที",
      topicIdeas: [
        {
          category: "Product Benefits",
          items: [
            "เพิ่มยอดขายอย่างรวดเร็วและมีประสิทธิภาพ",
            "เข้าถึงกลุ่มเป้าหมายที่ใช่ ด้วยแคมเปญที่ดึงดูด",
            "เรียนรู้วิธีสร้างสรรค์โฆษณาที่กระตุ้นการตัดสินใจซื้อทันที",
          ],
        },
        {
          category: "Pain Points & Emotional",
          items: [
            "ขาดความเข้าใจในการใช้จิตวิทยา 'ความกลัว' ในการตลาด",
            "แคมเปญโฆษณาไม่ดึงดูด ไม่ได้ผลลัพธ์ที่ต้องการ",
            "กลัวที่จะพลาดโอกาสในการเพิ่มยอดขายและเติบโต",
          ],
        },
        {
          category: "Promotion & Pricing",
          items: [
            "แพคเกจราคาพิเศษสำหรับลูกค้าใหม่ที่ต้องการทดลอง",
            "โปรโมชั่นลดราคาสำหรับการใช้บริการครบวงจร",
            "รับคำปรึกษาฟรี เพื่อวางแผนกลยุทธ์ที่เหมาะสมกับธุรกิจของคุณ",
          ],
        },
      ],
    },
    {
      id: "3",
      focusTarget: "Focus Target 3",
      keyMessage: "ปลดล็อคยอดขายพุ่งทะยาน ด้วยจิตวิทยา 'ความกลัว' ใน 3 วินาที",
      topicIdeas: [
        {
          category: "Product Benefits",
          items: [
            "เพิ่มยอดขายอย่างรวดเร็วและมีประสิทธิภาพ",
            "เข้าถึงกลุ่มเป้าหมายที่ใช่ ด้วยแคมเปญที่ดึงดูด",
            "เรียนรู้วิธีสร้างสรรค์โฆษณาที่กระตุ้นการตัดสินใจซื้อทันที",
          ],
        },
        {
          category: "Pain Points & Emotional",
          items: [
            "ขาดความเข้าใจในการใช้จิตวิทยา 'ความกลัว' ในการตลาด",
            "แคมเปญโฆษณาไม่ดึงดูด ไม่ได้ผลลัพธ์ที่ต้องการ",
            "กลัวที่จะพลาดโอกาสในการเพิ่มยอดขายและเติบโต",
          ],
        },
        {
          category: "Promotion & Pricing",
          items: [
            "แพคเกจราคาพิเศษสำหรับลูกค้าใหม่ที่ต้องการทดลอง",
            "โปรโมชั่นลดราคาสำหรับการใช้บริการครบวงจร",
            "รับคำปรึกษาฟรี เพื่อวางแผนกลยุทธ์ที่เหมาะสมกับธุรกิจของคุณ",
          ],
        },
      ],
    },
    {
      id: "4",
      focusTarget: "Focus Target 4",
      keyMessage: "ปลดล็อคยอดขายพุ่งทะยาน ด้วยจิตวิทยา 'ความกลัว' ใน 3 วินาที",
      topicIdeas: [
        {
          category: "Product Benefits",
          items: [
            "เพิ่มยอดขายอย่างรวดเร็วและมีประสิทธิภาพ",
            "เข้าถึงกลุ่มเป้าหมายที่ใช่ ด้วยแคมเปญที่ดึงดูด",
            "เรียนรู้วิธีสร้างสรรค์โฆษณาที่กระตุ้นการตัดสินใจซื้อทันที",
          ],
        },
        {
          category: "Pain Points & Emotional",
          items: [
            "ขาดความเข้าใจในการใช้จิตวิทยา 'ความกลัว' ในการตลาด",
            "แคมเปญโฆษณาไม่ดึงดูด ไม่ได้ผลลัพธ์ที่ต้องการ",
            "กลัวที่จะพลาดโอกาสในการเพิ่มยอดขายและเติบโต",
          ],
        },
        {
          category: "Promotion & Pricing",
          items: [
            "แพคเกจราคาพิเศษสำหรับลูกค้าใหม่ที่ต้องการทดลอง",
            "โปรโมชั่นลดราคาสำหรับการใช้บริการครบวงจร",
            "รับคำปรึกษาฟรี เพื่อวางแผนกลยุทธ์ที่เหมาะสมกับธุรกิจของคุณ",
          ],
        },
      ],
    },
  ]

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[260px_1fr] bg-[#f2f2f7]">
      <AppSidebar activeClientId={activeClientId} activeClientName={activeClientName} activeProductFocus={activeProductFocus} />
      <div className="flex flex-col">
        <AppHeader activeClientId={activeClientId} activeProductFocus={activeProductFocus} activeClientName={activeClientName} />
        <main className="flex-1 p-6 overflow-auto">
          {/* Section 1: Generate Topics */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">1. Generate Topics</h2>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-[#d1d1d6]">
              <div className="flex items-center gap-4 mb-4">
                <label htmlFor="models" className="text-sm font-medium text-[#000000]">
                  Select Models to Run:
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2 border-[#999999] text-[#000000] hover:bg-[#eeeeee] bg-transparent"
                    >
                      Gemini
                      <ChevronDown className="ml-auto h-4 w-4 text-[#8e8e93]" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem>Gemini</DropdownMenuItem>
                    <DropdownMenuItem>Another Model</DropdownMenuItem>
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
                <label htmlFor="instructions" className="text-sm font-medium text-[#000000] block mb-2">
                  Optional instructions
                </label>
                <Textarea
                  id="instructions"
                  placeholder="Provide additional context or specific instructions..."
                  className="min-h-[80px] border-[#999999] focus:border-black focus:ring-0"
                />
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  "Pain Point Solution Focus",
                  "Emotional Testimonial Leverage",
                  "Data-Driven Proof",
                  "Comparison/Before-After Stories",
                  "Unexpected Use Cases or Benefits",
                ].map((filter, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="border-[#999999] text-[#000000] hover:bg-[#eeeeee] text-sm px-3 py-1 h-auto bg-transparent"
                  >
                    {filter}
                  </Button>
                ))}
              </div>

{activeTopicTab === "generate" ? (
                <Tabs defaultValue="openai" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 h-auto bg-transparent p-0 border-b border-[#d1d1d6]">
                    <TabsTrigger
                      value="openai"
                      className="data-[state=active]:bg-white data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none text-sm font-medium py-2"
                    >
                      Gemini
                    </TabsTrigger>
                    <TabsTrigger
                      value="openai-with-research"
                      className="data-[state=active]:bg-white data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none text-sm font-medium py-2"
                    >
                      Gemini (With Research)
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
                  <TabsContent value="openai-with-research" className="mt-4">
                    <div className="p-6 bg-white rounded-lg border border-[#d1d1d6] shadow-sm text-center text-[#8e8e93]">
                      Content for Gemini (With Research) goes here.
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

          {/* Section 2: Generate Ideas */}
          <section>
            <h2 className="text-xl font-semibold mb-4">2. Generate Ideas</h2>
            <div className="flex justify-end mb-4">
              <Button variant="ghost" size="icon" className="text-[#8e8e93] hover:text-black">
                <RefreshCcw className="h-5 w-5" />
                <span className="sr-only">Refresh</span>
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ideasData.map((target) => (
                <Card key={target.id} className="p-4 border border-[#d1d1d6] shadow-sm relative">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold">{target.focusTarget}</h3>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-[#8e8e93] hover:text-black">
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-[#8e8e93] hover:text-black">
                        <Lock className="h-4 w-4" />
                        <span className="sr-only">Lock</span>
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-[#000000] mb-4">
                    <span className="font-semibold">Key Message:</span> {target.keyMessage}
                  </p>
                  <h4 className="font-semibold mb-2">Topic Ideas:</h4>
                  <ul className="list-disc pl-5 text-sm text-[#000000] space-y-1">
                    {target.topicIdeas.map((ideaCategory, i) => (
                      <li key={i}>
                        <span className="font-semibold">{ideaCategory.category}</span>
                        <ul className="list-disc pl-5 text-xs space-y-0.5">
                          {ideaCategory.items.map((item, j) => (
                            <li key={j}>{item}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
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
