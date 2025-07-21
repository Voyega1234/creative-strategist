'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Sparkles, 
  Target, 
  TrendingUp, 
  Lightbulb, 
  Bookmark, 
  Copy, 
  RefreshCw,
  Filter,
  Search,
  CheckCircle2,
  Zap,
  Brain,
  ArrowRight,
  Star,
  Share2,
  Link as LinkIcon,
  Download,
  ChevronDown
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

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

export default function CreatePage() {
  const [clientName, setClientName] = useState("")
  const [productFocus, setProductFocus] = useState("")
  const [ideas, setIdeas] = useState<IdeaRecommendation[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedImpact, setSelectedImpact] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [savedIdeas, setSavedIdeas] = useState<Set<number>>(new Set())
  const [isSharing, setIsSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  const handleGenerateIdeas = async () => {
    if (!clientName.trim() || !productFocus.trim()) {
      alert('กرุณากรอกชื่อลูกค้าและ Product Focus')
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
          clientName: clientName.trim(),
          productFocus: productFocus.trim()
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        setIdeas(data.ideas)
      } else {
        alert(`เกิดข้อผิดพลาด: ${data.error}`)
      }
    } catch (error) {
      console.error('Error generating ideas:', error)
      alert('เกิดข้อผิดพลาดในการสร้างไอเดีย กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsGenerating(false)
    }
  }

  const toggleSaveIdea = (index: number) => {
    const newSavedIdeas = new Set(savedIdeas)
    if (newSavedIdeas.has(index)) {
      newSavedIdeas.delete(index)
    } else {
      newSavedIdeas.add(index)
    }
    setSavedIdeas(newSavedIdeas)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // You can add a toast notification here
  }

  const handleShareIdeas = async () => {
    if (!ideas.length) {
      alert('ไม่มีไอเดียที่จะแชร์')
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
          ideas: ideas,
          clientName: clientName.trim(),
          productFocus: productFocus.trim(),
          instructions: null, // No instructions in create page
          model: 'Generated Ideas'
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        setShareUrl(data.shareUrl)
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

  const handleCopyAllIdeas = () => {
    if (!ideas.length) {
      alert('ไม่มีไอเดียที่จะคัดลอก')
      return
    }

    const formattedText = `🎯 Creative Ideas - ${clientName}\n📦 Product Focus: ${productFocus}\n📅 สร้างเมื่อ: ${new Date().toLocaleDateString('th-TH')}\n\n` +
      ideas.map((idea, index) => 
        `${index + 1}. ${idea.title}\n` +
        `📊 Impact: ${idea.impact}\n` +
        `📝 Description: ${idea.description}\n` +
        `🏷️ Tags: ${idea.tags.join(', ')}\n` +
        `💡 Concept: ${idea.concept_idea}\n` +
        `📢 Headline: ${idea.copywriting.headline}\n` +
        `🎯 CTA: ${idea.copywriting.cta}\n` +
        `---\n`
      ).join('\n')

    navigator.clipboard.writeText(formattedText)
    alert('✅ คัดลอกไอเดียทั้งหมดแล้ว!')
  }

  const handleExportPDF = () => {
    // TODO: Implement PDF export
    alert('🚧 PDF Export จะเปิดใช้งานในเร็วๆ นี้!')
  }

  const handleShareSingleIdea = async (idea: IdeaRecommendation, index: number) => {
    setIsSharing(true)
    try {
      const response = await fetch('/api/share-ideas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ideas: [idea], // Single idea in array
          clientName: clientName.trim(),
          productFocus: productFocus.trim(),
          instructions: null,
          model: 'Single Idea Share'
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        // Copy URL to clipboard
        await navigator.clipboard.writeText(data.shareUrl)
        alert(`✅ ไอเดีย "${idea.title}" ถูกแชร์แล้ว!\n\nลิงก์ถูกคัดลอกไปยังคลิปบอร์ด:\n${data.shareUrl}`)
      } else {
        alert(`เกิดข้อผิดพลาด: ${data.error}`)
      }
    } catch (error) {
      console.error('Error sharing single idea:', error)
      alert('เกิดข้อผิดพลาดในการแชร์ไอเดีย')
    } finally {
      setIsSharing(false)
    }
  }

  const handleCopySingleIdea = (idea: IdeaRecommendation) => {
    const formattedText = `🎯 ${idea.title}\n` +
      `📊 Impact: ${idea.impact}\n` +
      `📝 ${idea.description}\n` +
      `🏷️ Tags: ${idea.tags.join(', ')}\n` +
      `💡 Concept: ${idea.concept_idea}\n` +
      `📢 Headline: ${idea.copywriting.headline}\n` +
      `🎯 CTA: ${idea.copywriting.cta}\n` +
      `\n🏢 Client: ${clientName}\n📦 Product Focus: ${productFocus}`

    navigator.clipboard.writeText(formattedText)
    alert('✅ คัดลอกไอเดียแล้ว!')
  }

  // Filter ideas based on selected filters and search
  const filteredIdeas = ideas.filter(idea => {
    const matchesCategory = selectedCategory === "all" || idea.category === selectedCategory
    const matchesImpact = selectedImpact === "all" || idea.impact === selectedImpact
    const matchesSearch = searchQuery === "" || 
      idea.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      idea.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      idea.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    
    return matchesCategory && matchesImpact && matchesSearch
  })

  // Get unique categories and impacts
  const categories = Array.from(new Set(ideas.map(idea => idea.category)))
  const impacts = Array.from(new Set(ideas.map(idea => idea.impact)))

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="p-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Creative Ideas Generator
            </h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            สร้างไอเดียการตลาดที่สร้างสรรค์และมีประสิทธิภาพด้วย AI ที่ปรับแต่งเฉพาะสำหรับธุรกิจของคุณ
          </p>
        </div>

        {/* Input Section */}
        <Card className="p-8 mb-8 border-0 shadow-xl bg-white/70 backdrop-blur-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-600" />
                ชื่อลูกค้า / แบรนด์
              </label>
              <Input
                placeholder="เช่น Acme Corporation"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="h-12 border-2 border-gray-200 focus:border-purple-400 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-600" />
                Product Focus
              </label>
              <Input
                placeholder="เช่น AI Analytics, โซลาร์เซลล์"
                value={productFocus}
                onChange={(e) => setProductFocus(e.target.value)}
                className="h-12 border-2 border-gray-200 focus:border-blue-400 transition-colors"
              />
            </div>
          </div>
          
          <div className="flex justify-center">
            <Button
              onClick={handleGenerateIdeas}
              disabled={isGenerating}
              className="h-14 px-12 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-3 animate-spin" />
                  กำลังสร้างไอเดีย...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-3" />
                  สร้างไอเดียใหม่
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Filters and Results */}
        {ideas.length > 0 && (
          <>
            {/* Filters */}
            <Card className="p-6 mb-6 border-0 shadow-lg bg-white/70 backdrop-blur-sm">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">กรองผลลัพธ์:</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="ค้นหาไอเดีย..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-64 h-9"
                  />
                </div>

                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48 h-9">
                    <SelectValue placeholder="เลือกหมวดหมู่" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedImpact} onValueChange={setSelectedImpact}>
                  <SelectTrigger className="w-48 h-9">
                    <SelectValue placeholder="เลือกระดับผลกระทบ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกระดับ</SelectItem>
                    {impacts.map(impact => (
                      <SelectItem key={impact} value={impact}>{impact} Impact</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="ml-auto flex items-center gap-4">
                  <span className="text-sm text-gray-600">พบ {filteredIdeas.length} ไอเดีย</span>
                  
                  {/* Share Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-2 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 hover:from-purple-100 hover:to-blue-100"
                        disabled={ideas.length === 0}
                      >
                        <Share2 className="w-4 h-4" />
                        แชร์ไอเดีย
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem 
                        onClick={handleShareIdeas}
                        disabled={isSharing}
                        className="gap-2"
                      >
                        {isSharing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            กำลังสร้างลิงก์...
                          </>
                        ) : (
                          <>
                            <LinkIcon className="w-4 h-4" />
                            สร้างลิงก์แชร์
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleCopyAllIdeas} className="gap-2">
                        <Copy className="w-4 h-4" />
                        คัดลอกข้อความ
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleExportPDF} className="gap-2">
                        <Download className="w-4 h-4" />
                        ดาวน์โหลด PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </Card>

            {/* Share Actions Bar */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900">💡 ไอเดียที่สร้างขึ้น</h3>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                  {ideas.length} ไอเดีย
                </Badge>
              </div>
              
              {ideas.length > 0 && (
                <div className="flex gap-3">
                  <Button
                    onClick={handleCopyAllIdeas}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    คัดลอกทั้งหมด
                  </Button>
                  
                  <Button
                    onClick={handleShareIdeas}
                    disabled={isSharing}
                    className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                    size="sm"
                  >
                    {isSharing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        กำลังสร้างลิงก์...
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4" />
                        แชร์ไอเดียทั้งหมด
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Ideas Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredIdeas.map((idea, index) => (
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
                    <div className="flex gap-2">
                      {/* Individual Share Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-400 hover:text-purple-600"
                          >
                            <Share2 className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleShareSingleIdea(idea, index)
                            }}
                            disabled={isSharing}
                            className="gap-2"
                          >
                            <LinkIcon className="w-4 h-4" />
                            แชร์ไอเดียนี้
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCopySingleIdea(idea)
                            }}
                            className="gap-2"
                          >
                            <Copy className="w-4 h-4" />
                            คัดลอกข้อความ
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSaveIdea(index)}
                        className="h-8 w-8 p-0"
                      >
                        <Bookmark 
                          className={cn("w-4 h-4", savedIdeas.has(index) ? "fill-yellow-400 text-yellow-400" : "text-gray-400")} 
                        />
                      </Button>
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
                              onClick={() => copyToClipboard(idea.copywriting.headline)}
                              className="h-6 px-2 text-xs"
                            >
                              <Copy className="w-3 h-3" />
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
                              onClick={() => copyToClipboard(idea.copywriting.cta)}
                              className="h-6 px-2 text-xs"
                            >
                              <Copy className="w-3 h-3" />
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

            {/* Summary Stats */}
            {filteredIdeas.length > 0 && (
              <Card className="p-6 mt-8 border-0 shadow-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold">{ideas.length}</div>
                    <div className="text-sm opacity-90">ไอเดียทั้งหมด</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold">{ideas.filter(i => i.impact === 'High').length}</div>
                    <div className="text-sm opacity-90">High Impact</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold">{categories.length}</div>
                    <div className="text-sm opacity-90">หมวดหมู่</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold">{savedIdeas.size}</div>
                    <div className="text-sm opacity-90">ไอเดียที่บันทึก</div>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}

        {/* Empty State */}
        {ideas.length === 0 && !isGenerating && (
          <Card className="p-12 text-center border-0 shadow-lg bg-white/70 backdrop-blur-sm">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lightbulb className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                เริ่มต้นสร้างไอเดียของคุณ
              </h3>
              <p className="text-gray-600 mb-6">
                กรอกข้อมูลลูกค้าและ Product Focus เพื่อสร้างไอเดียการตลาดที่สร้างสรรค์และมีประสิทธิภาพ
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-purple-600">
                <Star className="w-4 h-4" />
                <span>AI-Powered Creative Ideas</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}