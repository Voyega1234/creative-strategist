'use client'

import { useState, useEffect } from "react"

// Utility function to normalize description to consistent format
const normalizeDescription = (description: any): {summary: string; sections: Array<{group: string; bullets: string[]}>} => {
  // New format with summary and sections
  if (description && typeof description === 'object' && description.summary && description.sections) {
    return {
      summary: description.summary,
      sections: description.sections.map((section: any) => ({
        group: getGroupLabel(section.group),
        bullets: Array.isArray(section.bullets) ? section.bullets : []
      }))
    };
  }
  
  // Old array format
  if (Array.isArray(description)) {
    return {
      summary: description.length > 0 ? description[0].text : 'No description available',
      sections: description.map((item: any) => ({
        group: item.label || 'Description',
        bullets: [item.text || '']
      }))
    };
  }
  
  // String format (oldest)
  if (typeof description === 'string') {
    return {
      summary: description,
      sections: []
    };
  }
  
  // Fallback
  return {
    summary: 'No description available',
    sections: []
  };
}

// Helper function to get readable labels for groups
const getGroupLabel = (group: string): string => {
  switch (group) {
    case 'pain': return 'Pain Point';
    case 'insight_solution': return 'Insight / Solution';
    case 'why_evidence': return 'Why this converts / Evidence';
    default: return group || 'Description';
  }
}
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Image from "next/image"
import { 
  Sparkles, 
  Target, 
  TrendingUp, 
  Lightbulb, 
  Copy, 
  RefreshCw,
  Share2,
  CheckCircle2,
  Zap,
  Brain,
  Calendar,
  User,
  ArrowLeft,
  ExternalLink
} from "lucide-react"
import { FacebookPost } from "@/components/facebook-post"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useParams } from "next/navigation"

// Types
interface IdeaRecommendation {
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

interface SharedIdeasData {
  id: string;
  clientName: string;
  productFocus: string;
  instructions: string | null;
  model: string;
  ideas: IdeaRecommendation[];
  createdAt: string;
  totalIdeas: number;
}

export default function SharedIdeasPage() {
  const params = useParams()
  const shareId = params.id as string
  
  const [sharedData, setSharedData] = useState<SharedIdeasData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedText, setCopiedText] = useState<string | null>(null)
  
  // Facebook mockup generation state
  const [isGeneratingFacebook, setIsGeneratingFacebook] = useState(false)
  const [facebookPostData, setFacebookPostData] = useState<{ [key: string]: any }>({})
  const [showFacebookPost, setShowFacebookPost] = useState<{ [key: string]: boolean }>({})

  useEffect(() => {
    const fetchSharedIdeas = async () => {
      try {
        const response = await fetch(`/api/share-ideas?id=${shareId}`)
        const result = await response.json()
        
        if (result.success) {
          setSharedData(result.data)
        } else {
          setError(result.error || 'Failed to load shared ideas')
        }
      } catch (err) {
        console.error('Error fetching shared ideas:', err)
        setError('Failed to load shared ideas')
      } finally {
        setIsLoading(false)
      }
    }

    if (shareId) {
      fetchSharedIdeas()
    }
  }, [shareId])

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedText(type)
      setTimeout(() => setCopiedText(null), 2000)
    } catch (err) {
      console.error('Failed to copy text:', err)
    }
  }

  const copyShareUrl = () => {
    const url = window.location.href
    copyToClipboard(url, 'shareUrl')
  }

  // Facebook mockup generation function - copied from idea-detail-modal.tsx
  const handleGenerateFacebookPost = async (idea: IdeaRecommendation) => {
    setIsGeneratingFacebook(true)
    
    // Create unique key for current idea
    const ideaKey = `${idea.title}-${idea.description}`.substring(0, 50)
    
    try {
      const payload = {
        clientName: sharedData?.clientName,
        productFocus: sharedData?.productFocus,
        adAccount: '', // Not available in shared context
        instructions: sharedData?.instructions || '',
        title: idea.title,
        description: idea.description,
        category: idea.category,
        impact: idea.impact,
        competitiveGap: idea.competitiveGap,
        tags: idea.tags,
        content_pillar: idea.content_pillar,
        product_focus: idea.product_focus,
        concept_idea: idea.concept_idea,
        copywriting: idea.copywriting
      }

      console.log('🔄 Generating Facebook post with payload:', payload)

      const response = await fetch('https://n8n.srv934175.hstgr.cloud/webhook/a6f8d152-df0d-4323-93ce-4b291703bb3f', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()
      
      if (response.ok) {
        console.log('✅ Facebook post generated:', result)
        // Handle both array and direct object responses
        const postData = Array.isArray(result) ? result : [result]
        setFacebookPostData(prev => ({ ...prev, [ideaKey]: postData[0] }))
        setShowFacebookPost(prev => ({ ...prev, [ideaKey]: true }))
      } else {
        console.error('❌ Facebook post generation failed:', result)
        alert('Failed to generate Facebook post. Please try again.')
      }
    } catch (error) {
      console.error('❌ Facebook post generation error:', error)
      alert('An error occurred while generating Facebook post. Please try again.')
    } finally {
      setIsGeneratingFacebook(false)
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'Proven Concept': return 'bg-blue-500 text-white'
      case 'New Concept': return 'bg-purple-500 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'Proven Concept': return <Target className="w-3 h-3" />
      case 'New Concept': return <Zap className="w-3 h-3" />
      default: return null
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">กำลังโหลดไอเดียที่แชร์...</p>
        </div>
      </div>
    )
  }

  if (error || !sharedData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 flex items-center justify-center">
        <Card className="p-8 max-w-md mx-auto text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">ไม่พบไอเดียที่แชร์</h1>
          <p className="text-gray-600 mb-4">{error || 'ลิงก์นี้อาจหมดอายุหรือไม่ถูกต้อง'}</p>
          <Link href="/">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <ArrowLeft className="w-4 h-4 mr-2" />
              กลับหน้าหลัก
            </Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white relative">
      <div className="max-w-4xl mx-auto p-8">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Image
              src="/SCR-20250730-myam-Photoroom.png"
              alt="Creative Strategist Logo"
              width={80}
              height={80}
              className="rounded-xl"
            />
            <div>
              <h1 className="text-3xl font-bold text-[#000000]">
                Shared Creative Idea
              </h1>
              <p className="text-[#535862] text-sm">
                ไอเดียการตลาดที่ถูกแชร์โดย AI Creative Strategist
              </p>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <Card className="p-6 mb-8 border-[#e4e7ec] bg-white shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-[#1d4ed8]" />
              <div>
                <p className="text-sm text-[#8e8e93]">ลูกค้า</p>
                <p className="font-semibold text-[#000000]">{sharedData.clientName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-[#1d4ed8]" />
              <div>
                <p className="text-sm text-[#8e8e93]">Product Focus</p>
                <p className="font-semibold text-[#000000]">{sharedData.productFocus}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Brain className="w-5 h-5 text-[#1d4ed8]" />
              <div>
                <p className="text-sm text-[#8e8e93]">AI Model</p>
                <p className="font-semibold text-[#000000]">{sharedData.model}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-[#1d4ed8]" />
              <div>
                <p className="text-sm text-[#8e8e93]">สร้างเมื่อ</p>
                <p className="font-semibold text-[#000000]">
                  {new Date(sharedData.createdAt).toLocaleDateString('th-TH')}
                </p>
              </div>
            </div>
          </div>

          {sharedData.instructions && !sharedData.instructions.startsWith('Individual idea:') && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[#535862] mb-2">คำแนะนำที่ใช้:</h3>
              <p className="text-sm text-[#535862] bg-[#f5f5f5] p-3 rounded-lg">
                {sharedData.instructions}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge className="bg-[#dbeafe] text-[#1d4ed8] border-[#1d4ed8]">
                {sharedData.totalIdeas} ไอเดีย
              </Badge>
              <Link href="/">
                <Button variant="outline" size="sm" className="border-[#e4e7ec] text-[#535862] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  กลับหน้าหลัก
                </Button>
              </Link>
            </div>
            <Button 
              onClick={copyShareUrl}
              variant="outline" 
              size="sm"
              className="gap-2 border-[#e4e7ec] text-[#535862] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]"
            >
              {copiedText === 'shareUrl' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  คัดลอกแล้ว
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  คัดลอกลิงก์
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Single Idea Card - Centered */}
        <div className="flex justify-center mb-8">
          {sharedData.ideas.map((idea, index) => (
            <Card key={index} className="p-6 border border-[#e4e7ec] bg-white/90 rounded-xl hover:shadow-md hover:border-[#1d4ed8] transition-all duration-200 max-w-2xl w-full">
              {/* Impact Badge */}
              {idea.impact && (
                <div className="mb-4">
                  <Badge className={`text-white text-xs px-3 py-1 rounded-full ${getImpactColor(idea.impact)}`}>
                    {idea.impact} Impact
                  </Badge>
                </div>
              )}

              {/* Title and Description */}
              <div className="mb-4">
                <Badge variant="outline" className="text-xs bg-gray-50 mb-3 border-[#e4e7ec]">
                  {idea.content_pillar}
                </Badge>
                <h4 className="text-lg font-bold text-[#000000] leading-tight mb-2">
                  {idea.title || idea.concept_idea}
                </h4>
                {idea.title && idea.concept_idea && idea.concept_idea !== idea.title && (
                  <p className="text-[#8e8e93] text-sm font-medium mb-2 italic">
                    {idea.concept_idea}
                  </p>
                )}
                {(() => {
                  const normalized = normalizeDescription(idea.description);
                  return (
                    <div className="space-y-4">
                      {/* Summary */}
                      <div className="bg-blue-50 border-l-4 border-[#1d4ed8] pl-4 py-3 rounded-r">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-block w-2 h-2 bg-[#1d4ed8] rounded-full"></span>
                          <h5 className="font-semibold text-sm text-[#1d4ed8]">Summary</h5>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{normalized.summary}</p>
                      </div>

                      {/* Detailed Sections */}
                      {normalized.sections.map((section, sectionIndex) => (
                        <div key={sectionIndex} className="bg-gray-50 border-l-4 border-[#1d4ed8] pl-4 py-3 rounded-r">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-block w-2 h-2 bg-[#1d4ed8] rounded-full"></span>
                            <h5 className="font-semibold text-sm text-[#1d4ed8]">{section.group}</h5>
                          </div>
                          <ul className="space-y-2">
                            {section.bullets.map((bullet, bulletIndex) => (
                              <li key={bulletIndex} className="flex gap-2">
                                <span className="text-[#1d4ed8] text-sm font-bold">•</span>
                                <span className="text-sm text-gray-700 leading-relaxed">{bullet}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {idea.tags.map((tag, tagIndex) => (
                  <Badge key={tagIndex} variant="outline" className="text-xs border-[#e4e7ec]">
                    {tag}
                  </Badge>
                ))}
              </div>

              {/* Content Tabs */}
              <Tabs defaultValue="concept" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-auto bg-transparent p-0 border-b border-[#e4e7ec] mb-6">
                  <TabsTrigger
                    value="concept"
                    className="data-[state=active]:bg-[#dbeafe] data-[state=active]:text-[#063def] data-[state=active]:shadow-sm rounded-md text-sm font-medium py-2 text-[#535862] hover:text-[#063def] hover:bg-[#f5f5f5]"
                  >
                    แนวคิด
                  </TabsTrigger>
                  <TabsTrigger
                    value="copywriting"
                    className="data-[state=active]:bg-[#dbeafe] data-[state=active]:text-[#063def] data-[state=active]:shadow-sm rounded-md text-sm font-medium py-2 text-[#535862] hover:text-[#063def] hover:bg-[#f5f5f5]"
                  >
                    Copy
                  </TabsTrigger>
                  <TabsTrigger
                    value="gap"
                    className="data-[state=active]:bg-[#dbeafe] data-[state=active]:text-[#063def] data-[state=active]:shadow-sm rounded-md text-sm font-medium py-2 text-[#535862] hover:text-[#063def] hover:bg-[#f5f5f5]"
                  >
                    Gap Analysis
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="concept" className="mt-4">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-[#535862] mb-2">แนวคิดหลัก</h4>
                      <p className="text-sm text-[#535862] leading-relaxed bg-[#f5f5f5] p-3 rounded-lg">
                        {idea.concept_idea}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-[#535862] mb-2">ช่องว่างในการแข่งขัน</h4>
                      <p className="text-sm text-[#535862] leading-relaxed">
                        {idea.competitiveGap}
                      </p>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="copywriting" className="mt-4">
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-[#535862]">หัวข้อหลัก</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(idea.copywriting.headline, `headline-${index}`)}
                          className="h-6 px-2 text-xs hover:bg-[#f5f5f5]"
                        >
                          {copiedText === `headline-${index}` ? (
                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3 text-[#535862]" />
                          )}
                        </Button>
                      </div>
                      <p className="text-sm font-medium text-[#000000] bg-[#f5f5f5] p-3 rounded-lg">
                        {idea.copywriting.headline}
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-semibold text-[#535862] mb-2">หัวข้อรอง</h4>
                      <div className="space-y-2">
                        <p className="text-xs text-[#535862] bg-[#f5f5f5] p-2 rounded">
                          {idea.copywriting.sub_headline_1}
                        </p>
                        <p className="text-xs text-[#535862] bg-[#f5f5f5] p-2 rounded">
                          {idea.copywriting.sub_headline_2}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-[#535862] mb-2">จุดเด่น</h4>
                      <ul className="space-y-1">
                        {idea.copywriting.bullets.map((bullet, bulletIndex) => (
                          <li key={bulletIndex} className="text-xs text-[#535862] flex items-start gap-2">
                            <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-[#535862]">Call to Action</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(idea.copywriting.cta, `cta-${index}`)}
                          className="h-6 px-2 text-xs hover:bg-[#f5f5f5]"
                        >
                          {copiedText === `cta-${index}` ? (
                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3 text-[#535862]" />
                          )}
                        </Button>
                      </div>
                      <p className="text-sm text-[#1d4ed8] bg-[#dbeafe] p-3 rounded-lg border border-[#1d4ed8]">
                        {idea.copywriting.cta}
                      </p>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="gap" className="mt-4">
                  <div>
                    <h4 className="text-sm font-semibold text-[#535862] mb-2 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-[#1d4ed8]" />
                      ช่องว่างในการแข่งขัน
                    </h4>
                    <p className="text-sm text-[#535862] leading-relaxed">
                      {idea.competitiveGap}
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
              
              {/* Facebook Post Mockup Generation Button */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <Button
                  onClick={() => handleGenerateFacebookPost(idea)}
                  disabled={isGeneratingFacebook}
                  className="w-full bg-[#1877f2] hover:bg-[#166fe5] text-white"
                >
                  {isGeneratingFacebook ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      กำลังสร้าง Facebook Mockup...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      สร้าง Facebook Post Mockup
                    </>
                  )}
                </Button>
              </div>
              
              {/* Facebook Post Preview */}
              {(() => {
                const ideaKey = `${idea.title}-${idea.description}`.substring(0, 50)
                return showFacebookPost[ideaKey] && facebookPostData[ideaKey] && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="font-semibold mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-[#1877f2]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      Facebook Post Mockup Preview
                    </h4>
                    <FacebookPost data={facebookPostData[ideaKey]} />
                  </div>
                )
              })()}
            </Card>
          ))}
        </div>

        {/* Footer */}
        <Card className="p-6 border-[#e4e7ec] bg-[#f5f5f5] text-center">
          <div className="max-w-2xl mx-auto">
            <Image
              src="/SCR-20250730-myam-Photoroom.png"
              alt="Creative Strategist Logo"
              width={60}
              height={60}
              className="rounded-xl mx-auto mb-3"
            />
            <h3 className="text-xl font-semibold mb-2 text-[#000000]">ต้องการสร้างไอเดียของคุณเอง?</h3>
            <p className="text-sm text-[#535862] mb-4">
              ใช้ AI Creative Strategist เพื่อสร้างไอเดียการตลาดที่สร้างสรรค์และมีประสิทธิภาพ
            </p>
            <Link href="/">
              <Button className="bg-[#1d4ed8] text-white hover:bg-[#063def]">
                <ExternalLink className="w-4 h-4 mr-2" />
                เริ่มสร้างไอเดีย
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}