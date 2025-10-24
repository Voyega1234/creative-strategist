"use client"

import { useState, useEffect } from "react"
import { getSupabase } from "@/lib/supabase/client"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  Sparkles, 
  Wand2, 
  Download, 
  Copy, 
  RefreshCw,
  CheckCircle,
  Loader2,
  Lightbulb,
  Target,
  X,
  Image as ImageIcon
} from "lucide-react"
import Image from "next/image"

interface GeneratedImage {
  id: string
  url: string
  prompt: string
  status: 'generating' | 'completed' | 'error'
  created_at: string
}

interface ClientOption {
  id: string
  clientName: string
  productFocuses: Array<{
    productFocus: string
  }>
}

interface SavedTopic {
  title: string
  description: string
  category: string
  concept_type: string
  impact?: string
  competitiveGap: string
  tags: string[]
  content_pillar: string
  product_focus: string
  concept_idea: string
  copywriting: {
    headline: string
    sub_headline_1: string
    sub_headline_2: string
    bullets: string[]
    cta: string
  }
}

interface RealAIImageGeneratorProps {
  activeClientId?: string | null
  activeProductFocus?: string | null  
  activeClientName?: string | null
}

export function RealAIImageGenerator({ 
  activeClientId, 
  activeProductFocus, 
  activeClientName 
}: RealAIImageGeneratorProps) {
  const [prompt, setPrompt] = useState('')
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  
  // Client and product focus selection
  const [clients, setClients] = useState<ClientOption[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [selectedProductFocus, setSelectedProductFocus] = useState<string>('')
  const [loadingClients, setLoadingClients] = useState(true)
  
  // Strategic insights and topics
  const [savedTopics, setSavedTopics] = useState<SavedTopic[]>([])
  const [selectedTopic, setSelectedTopic] = useState<string>('')
  const [loadingTopics, setLoadingTopics] = useState(false)
  
  // Image preview modal
  const [selectedImageForPreview, setSelectedImageForPreview] = useState<string | null>(null)

  useEffect(() => {
    loadClients()
  }, [])

  useEffect(() => {
    if (selectedClientId && selectedProductFocus) {
      loadSavedTopics()
    }
  }, [selectedClientId, selectedProductFocus])

  // Update selection when props change (from URL parameters)
  useEffect(() => {
    if (activeClientId && activeProductFocus && clients.length > 0) {
      console.log('[Real AI Image Generator] Props changed, updating selection:', {
        activeClientId,
        activeProductFocus
      })
      setSelectedClientId(activeClientId)
      setSelectedProductFocus(activeProductFocus)
    }
  }, [activeClientId, activeProductFocus, clients])

  const loadClients = async () => {
    try {
      setLoadingClients(true)
      const response = await fetch('/api/clients-with-product-focus')
      const clients = await response.json()
      
      console.log('[Real AI Image Generator] Loaded clients:', clients)
      
      if (Array.isArray(clients)) {
        setClients(clients)
        
        // Auto-select based on props (from URL params) or first available
        if (activeClientId && activeProductFocus) {
          console.log('[Real AI Image Generator] Auto-selecting from props:', {
            activeClientId,
            activeProductFocus,
            activeClientName
          })
          setSelectedClientId(activeClientId)
          setSelectedProductFocus(activeProductFocus)
        } else if (clients.length > 0 && clients[0].productFocuses.length > 0) {
          setSelectedClientId(clients[0].id)
          setSelectedProductFocus(clients[0].productFocuses[0].productFocus)
        }
      }
    } catch (error) {
      console.error('[Real AI Image Generator] Error loading clients:', error)
    } finally {
      setLoadingClients(false)
    }
  }

  const loadSavedTopics = async () => {
    if (!selectedClientId || !selectedProductFocus) return

    try {
      setLoadingTopics(true)
      const selectedClient = clients.find(c => c.id === selectedClientId)
      if (!selectedClient) return

      console.log('[Real AI Image Generator] Direct Supabase query for:', {
        clientName: selectedClient.clientName,
        productFocus: selectedProductFocus,
        selectedClientId
      })

      const supabase = getSupabase()
      const startTime = performance.now()

      const { data, error } = await supabase
        .from('savedideas')
        .select(`
          id,
          title,
          description,
          category,
          concept_type,
          impact,
          competitivegap,
          tags,
          content_pillar,
          product_focus,
          concept_idea,
          copywriting_headline,
          copywriting_sub_headline_1,
          copywriting_sub_headline_2,
          copywriting_bullets,
          copywriting_cta,
          savedat
        `)
        .eq('clientname', selectedClient.clientName)
        .eq('productfocus', selectedProductFocus)
        .order('savedat', { ascending: false })
        .limit(50)

      const endTime = performance.now()
      console.log(`[Real AI Image Generator] Direct Supabase query completed in ${endTime - startTime}ms for ${data?.length || 0} items`)

      if (error) {
        console.error('[Real AI Image Generator] Supabase error:', error)
        return
      }

      // Transform data to match SavedTopic interface
      const savedTopics = data.map(item => {
        // Parse tags from JSON array format
        let tags = [];
        try {
          tags = item.tags ? JSON.parse(item.tags) : [];
        } catch (e) {
          // Fallback to comma-separated if not JSON
          tags = item.tags ? item.tags.split(',').map((tag: string) => tag.trim()) : [];
        }

        // Parse bullets from JSON array format  
        let bullets = [];
        try {
          bullets = item.copywriting_bullets ? JSON.parse(item.copywriting_bullets) : [];
        } catch (e) {
          // Fallback to newline-separated if not JSON
          bullets = item.copywriting_bullets ? item.copywriting_bullets.split('\n').filter((b: string) => b.trim()) : [];
        }

        return {
          title: item.title,
          description: item.description,
          category: item.category,
          concept_type: item.concept_type || item.impact || '',
          competitiveGap: item.competitivegap,
          tags: tags,
          content_pillar: item.content_pillar,
          product_focus: item.product_focus,
          concept_idea: item.concept_idea,
          copywriting: {
            headline: item.copywriting_headline || '',
            sub_headline_1: item.copywriting_sub_headline_1 || '',
            sub_headline_2: item.copywriting_sub_headline_2 || '',
            bullets: bullets,
            cta: item.copywriting_cta || ''
          }
        };
      });

      setSavedTopics(savedTopics)
      console.log('[Real AI Image Generator] Loaded saved topics:', savedTopics.length)

    } catch (error) {
      console.error('[Real AI Image Generator] Error loading saved topics:', error)
    } finally {
      setLoadingTopics(false)
    }
  }

  const handleGenerateImage = async () => {
    if (!prompt.trim()) {
      alert('กรุณาใส่คำอธิบายภาพที่ต้องการสร้าง')
      return
    }

    if (!selectedClientId || !selectedProductFocus) {
      alert('กรุณาเลือกลูกค้าและ Product Focus')
      return
    }

    setIsGenerating(true)
    
    try {
      // Create temporary image entry
      const tempImage: GeneratedImage = {
        id: Date.now().toString(),
        url: '',
        prompt: prompt.trim(),
        status: 'generating',
        created_at: new Date().toISOString()
      }
      
      setGeneratedImages(prev => [tempImage, ...prev])

      // Call N8N API for image generation
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          clientId: selectedClientId,
          productFocus: selectedProductFocus,
          selectedTopic: selectedTopic
        }),
      })

      const data = await response.json()
      
      if (data.success && data.imageUrl) {
        // Update the temporary image with the real result
        setGeneratedImages(prev => prev.map(img => 
          img.id === tempImage.id 
            ? { ...img, url: data.imageUrl, status: 'completed' }
            : img
        ))
      } else {
        // Mark as error
        setGeneratedImages(prev => prev.map(img => 
          img.id === tempImage.id 
            ? { ...img, status: 'error' }
            : img
        ))
        alert(`เกิดข้อผิดพลาด: ${data.error || 'ไม่สามารถสร้างภาพได้'}`)
      }
    } catch (error) {
      console.error('[Real AI Image Generator] Error generating image:', error)
      alert('เกิดข้อผิดพลาดในการสร้างภาพ')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleTopicSelect = (topicTitle: string) => {
    if (topicTitle === selectedTopic) {
      setSelectedTopic('')
      setPrompt('')
    } else {
      const topic = savedTopics.find(t => t.title === topicTitle)
      if (topic) {
        setSelectedTopic(topicTitle)
        // Auto-fill prompt with topic information
        const autoPrompt = `สร้างภาพโฆษณาสำหรับ: ${topic.title}\n\nรายละเอียด: ${topic.description}\n\nCategory: ${topic.category}\nContent Pillar: ${topic.content_pillar}`
        setPrompt(autoPrompt)
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Client Selection */}
      <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="space-y-4">
          <h3 className="font-semibold text-blue-900 flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-600" />
            เลือกลูกค้า
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-blue-700 mb-1">ลูกค้า</label>
              <Select 
                value={selectedClientId} 
                onValueChange={setSelectedClientId}
                disabled={loadingClients}
              >
                <SelectTrigger className="bg-white border-blue-200">
                  <SelectValue placeholder="เลือกลูกค้า" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.clientName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-700 mb-1">Product Focus</label>
              <Select 
                value={selectedProductFocus} 
                onValueChange={setSelectedProductFocus}
                disabled={!selectedClientId}
              >
                <SelectTrigger className="bg-white border-blue-200">
                  <SelectValue placeholder="เลือก Product Focus" />
                </SelectTrigger>
                <SelectContent>
                  {clients
                    .find(c => c.id === selectedClientId)
                    ?.productFocuses.map((pf) => (
                    <SelectItem key={pf.productFocus} value={pf.productFocus}>
                      {pf.productFocus}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      {/* Saved Ideas Selection */}
      {selectedClientId && selectedProductFocus && (
        <Card className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <div className="space-y-4">
            <h3 className="font-semibold text-blue-900 flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              ไอเดียที่บันทึกไว้ (เลือกเพื่อใช้เป็นแรงบันดาลใจ)
            </h3>
            
            {loadingTopics ? (
              <div className="flex items-center gap-2 text-blue-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                กำลังโหลดไอเดีย...
              </div>
            ) : savedTopics.length > 0 ? (
              <div className="grid gap-3">
                {savedTopics.slice(0, 3).map((topic) => (
                  <div 
                    key={topic.title}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedTopic === topic.title
                        ? 'bg-blue-100 border-blue-300 shadow-md'
                        : 'bg-white border-blue-200 hover:bg-blue-50'
                    }`}
                    onClick={() => handleTopicSelect(topic.title)}
                  >
                    <h4 className="font-medium text-blue-900 mb-1">{topic.title}</h4>
                    <p className="text-sm text-blue-700 line-clamp-2">{topic.description}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="text-xs border-blue-300 text-blue-600">
                        {topic.content_pillar}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-blue-600 text-sm">ยังไม่มีไอเดียที่บันทึกไว้</p>
            )}
          </div>
        </Card>
      )}

      {/* Image Generation Form */}
      <Card className="p-4">
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Wand2 className="w-4 h-4" />
            คำอธิบายภาพที่ต้องการสร้าง
          </h3>
          
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="อธิบายภาพที่ต้องการสร้าง เช่น 'ภาพโฆษณาแผงโซลาร์เซลล์บนหลังคาบ้าน แสงแดดสวยงาม มีข้อความ ลดหย่อนภาษี 200,000 บาท'"
            className="min-h-[120px] resize-none"
            disabled={isGenerating}
          />
          
          <div className="text-sm text-gray-500 mb-4">
            <p><strong>คำค้นหาเพิ่มเติม (ไม่บังคับ)</strong></p>
            <p>เพิ่มรายละเอียดเช่น สี, สไตล์, องค์ประกอบ, ฯลฯ</p>
          </div>
          
          <Button 
            onClick={handleGenerateImage}
            disabled={isGenerating || !prompt.trim() || !selectedClientId || !selectedProductFocus}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังสร้างภาพ...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                สร้างภาพด้วย AI
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Generated Images Results */}
      {generatedImages.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            ภาพที่สร้างแล้ว ({generatedImages.length})
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {generatedImages.map((image) => (
              <div key={image.id} className="relative group">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border">
                  {image.status === 'generating' ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">กำลังสร้างภาพ...</p>
                      </div>
                    </div>
                  ) : image.status === 'error' ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center text-red-600">
                        <X className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-sm">เกิดข้อผิดพลาด</p>
                      </div>
                    </div>
                  ) : (
                    <Image
                      src={image.url}
                      alt={image.prompt}
                      fill
                      className="object-cover cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => setSelectedImageForPreview(image.url)}
                    />
                  )}
                </div>
                
                {image.status === 'completed' && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 w-8 p-0 bg-white/90 hover:bg-white"
                        onClick={() => window.open(image.url, '_blank')}
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 w-8 p-0 bg-white/90 hover:bg-white"
                        onClick={() => navigator.clipboard.writeText(image.url)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="mt-2">
                  <p className="text-xs text-gray-600 line-clamp-2">{image.prompt}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Image Preview Modal */}
      <Dialog open={!!selectedImageForPreview} onOpenChange={() => setSelectedImageForPreview(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>ตัวอย่างภาพ</DialogTitle>
          </DialogHeader>
          {selectedImageForPreview && (
            <div className="relative aspect-square">
              <Image
                src={selectedImageForPreview}
                alt="Generated image preview"
                fill
                className="object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
