'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'High': return 'bg-red-100 text-red-800 border-red-200'
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'Low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'High': return <Zap className="w-3 h-3" />
      case 'Medium': return <TrendingUp className="w-3 h-3" />
      case 'Low': return <Target className="w-3 h-3" />
      default: return null
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">กำลังโหลดไอเดียที่แชร์...</p>
        </div>
      </div>
    )
  }

  if (error || !sharedData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="p-8 max-w-md mx-auto text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">ไม่พบไอเดียที่แชร์</h1>
          <p className="text-gray-600 mb-4">{error || 'ลิงก์นี้อาจหมดอายุหรือไม่ถูกต้อง'}</p>
          <Link href="/">
            <Button className="bg-purple-600 hover:bg-purple-700">
              <ArrowLeft className="w-4 h-4 mr-2" />
              กลับหน้าหลัก
            </Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="p-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl">
              <Share2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Shared Creative Ideas
            </h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            ไอเดียการตลาดที่ถูกแชร์โดย AI Creative Strategist
          </p>
        </div>

        {/* Info Section */}
        <Card className="p-6 mb-8 border-0 shadow-xl bg-white/70 backdrop-blur-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">ลูกค้า</p>
                <p className="font-semibold text-gray-900">{sharedData.clientName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Product Focus</p>
                <p className="font-semibold text-gray-900">{sharedData.productFocus}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Brain className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">AI Model</p>
                <p className="font-semibold text-gray-900">{sharedData.model}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-amber-600" />
              <div>
                <p className="text-sm text-gray-600">สร้างเมื่อ</p>
                <p className="font-semibold text-gray-900">
                  {new Date(sharedData.createdAt).toLocaleDateString('th-TH')}
                </p>
              </div>
            </div>
          </div>

          {sharedData.instructions && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">คำแนะนำที่ใช้:</h3>
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                {sharedData.instructions}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                {sharedData.totalIdeas} ไอเดีย
              </Badge>
              <Link href="/">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  กลับหน้าหลัก
                </Button>
              </Link>
            </div>
            <Button 
              onClick={copyShareUrl}
              variant="outline" 
              size="sm"
              className="gap-2"
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

        {/* Ideas Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {sharedData.ideas.map((idea, index) => (
            <Card key={index} className="p-6 border-0 shadow-xl bg-white/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 group">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Badge className={cn("flex items-center gap-1", getImpactColor(idea.impact))}>
                    {getImpactIcon(idea.impact)}
                    {idea.impact} Impact
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {idea.category}
                  </Badge>
                </div>
              </div>

              {/* Title and Description */}
              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors">
                  {idea.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {idea.description}
                </p>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {idea.tags.map((tag, tagIndex) => (
                  <Badge key={tagIndex} variant="secondary" className="text-xs bg-gray-100 text-gray-700">
                    {tag}
                  </Badge>
                ))}
              </div>

              {/* Content Tabs */}
              <Tabs defaultValue="concept" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-gray-100">
                  <TabsTrigger value="concept" className="text-xs py-2">แนวคิด</TabsTrigger>
                  <TabsTrigger value="copywriting" className="text-xs py-2">Copy</TabsTrigger>
                  <TabsTrigger value="gap" className="text-xs py-2">Gap Analysis</TabsTrigger>
                </TabsList>
                
                <TabsContent value="concept" className="mt-4">
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Content Pillar</h4>
                      <Badge variant="outline" className="text-xs">
                        {idea.content_pillar}
                      </Badge>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">แนวคิดหลัก</h4>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {idea.concept_idea}
                      </p>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="copywriting" className="mt-4">
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-gray-700">หัวข้อหลัก</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(idea.copywriting.headline, `headline-${index}`)}
                          className="h-6 px-2 text-xs"
                        >
                          {copiedText === `headline-${index}` ? (
                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                      <p className="text-sm font-medium text-gray-900 bg-gray-50 p-3 rounded-lg">
                        {idea.copywriting.headline}
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">หัวข้อรอง</h4>
                      <div className="space-y-2">
                        <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                          {idea.copywriting.sub_headline_1}
                        </p>
                        <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                          {idea.copywriting.sub_headline_2}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">จุดเด่น</h4>
                      <ul className="space-y-1">
                        {idea.copywriting.bullets.map((bullet, bulletIndex) => (
                          <li key={bulletIndex} className="text-xs text-gray-600 flex items-start gap-2">
                            <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-gray-700">Call to Action</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(idea.copywriting.cta, `cta-${index}`)}
                          className="h-6 px-2 text-xs"
                        >
                          {copiedText === `cta-${index}` ? (
                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                      <p className="text-sm text-purple-700 bg-purple-50 p-3 rounded-lg border border-purple-200">
                        {idea.copywriting.cta}
                      </p>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="gap" className="mt-4">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-yellow-500" />
                      ช่องว่างในการแข่งขัน
                    </h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {idea.competitiveGap}
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          ))}
        </div>

        {/* Footer */}
        <Card className="p-6 border-0 shadow-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white text-center">
          <div className="max-w-2xl mx-auto">
            <Sparkles className="w-8 h-8 mx-auto mb-3" />
            <h3 className="text-xl font-semibold mb-2">ต้องการสร้างไอเดียของคุณเอง?</h3>
            <p className="text-sm opacity-90 mb-4">
              ใช้ AI Creative Strategist เพื่อสร้างไอเดียการตลาดที่สร้างสรรค์และมีประสิทธิภาพ
            </p>
            <Link href="/">
              <Button className="bg-white text-purple-600 hover:bg-gray-100">
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