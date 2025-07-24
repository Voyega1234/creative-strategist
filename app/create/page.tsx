'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
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
  ChevronDown,
  CheckSquare,
  ThumbsUp,
  ThumbsDown,
  X,
  MessageCircle,
  Save,
  Loader2,
  Info
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  
  // New state for card selection and feedback
  const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set())
  const [ideaFeedback, setIdeaFeedback] = useState<Record<number, {vote?: 'good' | 'bad', comment?: string, showTemplates?: boolean}>>({})
  const [editingFeedbackId, setEditingFeedbackId] = useState<number | null>(null)
  const [isRegeneratingIdea, setIsRegeneratingIdea] = useState(false)
  const [regeneratingIdeaId, setRegeneratingIdeaId] = useState<number | null>(null)

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

  // Feedback templates
  const FEEDBACK_TEMPLATES = {
    good: [
      "Great concept! Very relevant to our target audience.",
      "This has strong potential for engagement.",
      "Excellent alignment with brand values.",
      "Clear competitive advantage identified."
    ],
    bad: [
      "Doesn't align with our brand positioning.",
      "Too similar to existing competitor content.",
      "Target audience mismatch.",
      "Execution complexity too high."
    ]
  }

  // Card selection functions
  const handleCardSelectionToggle = (idea: IdeaRecommendation, index: number) => {
    setSelectedCards(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  // Feedback functions
  const handleFeedbackVote = (index: number, vote: 'good' | 'bad') => {
    setIdeaFeedback(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        vote,
        showTemplates: true
      }
    }))
  }

  const handleFeedbackComment = (index: number, comment: string) => {
    setIdeaFeedback(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        comment
      }
    }))
  }

  const toggleFeedbackEditing = (index: number | null) => {
    setEditingFeedbackId(index)
  }

  const toggleTemplates = (index: number, show: boolean) => {
    setIdeaFeedback(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        showTemplates: show
      }
    }))
  }

  const applyTemplate = (index: number, template: string) => {
    setIdeaFeedback(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        comment: template,
        showTemplates: false
      }
    }))
    setEditingFeedbackId(index)
  }

  const saveFeedbackToDatabase = async () => {
    // Placeholder function - implement actual database saving logic here
    console.log('Saving feedback to database:', ideaFeedback)
    alert('Feedback saved!')
    setEditingFeedbackId(null)
  }

  const regenerateIdea = async (index: number) => {
    setIsRegeneratingIdea(true)
    setRegeneratingIdeaId(index)
    
    try {
      // Placeholder for regeneration logic
      setTimeout(() => {
        alert('Idea regenerated!')
        setIsRegeneratingIdea(false)
        setRegeneratingIdeaId(null)
      }, 2000)
    } catch (error) {
      console.error('Error regenerating idea:', error)
      setIsRegeneratingIdea(false)
      setRegeneratingIdeaId(null)
    }
  }

  const handleOpenDetails = (idea: IdeaRecommendation, e: React.MouseEvent, index?: number) => {
    e.stopPropagation()
    // Placeholder for opening details dialog
    console.log('Opening details for idea:', idea.title, 'at index:', index)
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
              {filteredIdeas.map((idea, index) => {
                const isSelected = selectedCards.has(index);
                const hasCompetitors = true; // Assuming all ideas have competitor research
                const displayName = idea.content_pillar;
                
                return (
                  <Card
                    key={index}
                    onClick={() => handleCardSelectionToggle(idea, index)}
                    className={cn(
                      "cursor-pointer hover:shadow-md transition-shadow duration-200 flex flex-col h-full relative",
                      isSelected ? "border-2 border-primary shadow-md" : "border",
                      !isSelected && idea.impact === 'High' ? 'border-green-500' :
                      !isSelected && idea.impact === 'Medium' ? 'border-yellow-500' :
                      '',
                      hasCompetitors ? 'border-l-4 border-l-blue-500' : ''
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 p-1 bg-primary text-primary-foreground rounded-full z-10">
                        <CheckSquare size={16} />
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <Badge variant="outline" className={cn(
                            "text-xs mb-1",
                            hasCompetitors ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-muted'
                          )}>
                            {displayName}
                          </Badge>
                        </div>
                        {hasCompetitors && (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                            Market Research
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-base leading-tight pr-8">
                        {idea.concept_idea || idea.title}
                      </CardTitle>
                      <CardDescription className="pt-1 text-sm">
                        <span className="block font-semibold text-muted-foreground">{idea.title}</span>
                        <Badge variant="secondary" className="mr-1">{idea.category}</Badge>
                        <Badge variant={idea.impact === 'High' ? 'default' : idea.impact === 'Medium' ? 'outline' : 'secondary'} className={cn(
                          idea.impact === 'High' ? 'bg-green-600 text-white' :
                          idea.impact === 'Medium' ? 'border-yellow-600 text-yellow-700' :
                          ''
                        )}>{idea.impact} Impact</Badge>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow text-sm text-muted-foreground pb-3">
                      <p className="line-clamp-4 mb-2">{idea.description}</p>
                      
                      {/* Idea Evaluation UI */}
                      <div className="mt-3 pt-3 border-t border-dashed">
                        <p className="text-xs font-medium mb-2 text-gray-600">Rate this idea:</p>
                        <div className="space-y-2">
                          <div className="flex space-x-2">
                            <Button 
                              variant={ideaFeedback[index]?.vote === 'good' ? 'default' : 'outline'}
                              size="sm"
                              className={ideaFeedback[index]?.vote === 'good' ? 'bg-green-600 hover:bg-green-700' : ''}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFeedbackVote(index, 'good');
                              }}
                            >
                              <ThumbsUp className="h-4 w-4 mr-1" />
                              Good
                            </Button>
                            <Button 
                              variant={ideaFeedback[index]?.vote === 'bad' ? 'default' : 'outline'}
                              size="sm"
                              className={ideaFeedback[index]?.vote === 'bad' ? 'bg-red-600 hover:bg-red-700' : ''}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFeedbackVote(index, 'bad');
                              }}
                            >
                              <ThumbsDown className="h-4 w-4 mr-1" />
                              Bad
                            </Button>
                          </div>
                          
                          {/* Template suggestions */}
                          {ideaFeedback[index]?.showTemplates && (
                            <div className="bg-muted/50 p-2 rounded-md border border-border">
                              <div className="text-xs text-muted-foreground mb-1">
                                Quick feedback:
                              </div>
                              <div className="space-y-1">
                                {FEEDBACK_TEMPLATES[ideaFeedback[index]?.vote === 'good' ? 'good' : 'bad']?.map((template: string, templateIndex: number) => (
                                  <div 
                                    key={`${index}-template-${templateIndex}`}
                                    className="text-xs p-1.5 hover:bg-muted rounded cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      applyTemplate(index, template);
                                    }}
                                  >
                                    "{template}"
                                  </div>
                                ))}
                              </div>
                              <div className="flex justify-end mt-1">
                                <Button 
                                  variant="ghost" 
                                  className="h-6 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleTemplates(index, false);
                                  }}
                                >
                                  <X className="h-3 w-3 mr-1" /> Close
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Feedback textarea */}
                        {(editingFeedbackId === index || ideaFeedback[index]?.comment) && (
                          <div className="mb-3">
                            {editingFeedbackId === index ? (
                              <>
                                <Textarea 
                                  placeholder="Why do you like/dislike this idea?"
                                  className="w-full text-xs"
                                  value={ideaFeedback[index]?.comment || ''}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleFeedbackComment(index, e.target.value);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div className="flex flex-wrap gap-2">
                                  {Object.keys(ideaFeedback).length > 0 && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-xs h-7 mt-1"
                                      onClick={saveFeedbackToDatabase}
                                      disabled={!ideaFeedback[index]?.comment?.trim()}
                                    >
                                      <Save className="h-3 w-3 mr-1" />
                                      Save
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleFeedbackEditing(null);
                                    }}
                                  >
                                    Done
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <div 
                                className="p-2 bg-muted rounded-md text-xs cursor-pointer hover:bg-muted/80"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFeedbackEditing(index);
                                }}
                              >
                                <p>{ideaFeedback[index]?.comment}</p>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Add feedback or regenerate buttons */}
                        <div className="flex space-x-2">
                          {!ideaFeedback[index]?.comment && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFeedbackEditing(index);
                              }}
                            >
                              <MessageCircle className="h-3 w-3 mr-1" />
                              Add Feedback
                            </Button>
                          )}
                          
                          {/* Regenerate button - only visible if feedback exists */}
                          {ideaFeedback[index]?.comment && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                regenerateIdea(index);
                              }}
                              disabled={isRegeneratingIdea && regeneratingIdeaId === index}
                            >
                              {isRegeneratingIdea && regeneratingIdeaId === index ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Regenerating...
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                  Regenerate
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between items-center pt-2 pb-3">
                      <div className="flex flex-wrap gap-1 items-center">
                        {(idea.tags || []).map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7" 
                        onClick={(e) => handleOpenDetails(idea, e, index)}
                      >
                        <Info size={16} />
                        <span className="sr-only">View Details / Generate Image</span>
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
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