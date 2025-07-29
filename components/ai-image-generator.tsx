"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  Sparkles, 
  Image as ImageIcon, 
  Wand2, 
  Download, 
  Copy, 
  RefreshCw,
  CheckCircle,
  Loader2,
  Lightbulb,
  Target,
  X
} from "lucide-react"
import { getStorageClient } from "@/lib/supabase/client"
import Image from "next/image"

interface AdImage {
  name: string
  url: string
  size: number
  created_at: string
  metadata?: {
    width?: number
    height?: number
    type?: string
  }
}

interface GeneratedImage {
  id: string
  url: string
  prompt: string
  reference_image?: string
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
  impact: string
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

interface AIImageGeneratorProps {
  activeClientId?: string | null
  activeProductFocus?: string | null  
  activeClientName?: string | null
}

export function AIImageGenerator({ 
  activeClientId, 
  activeProductFocus, 
  activeClientName 
}: AIImageGeneratorProps) {
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
  
  // Pinterest results pagination
  const [showAllResults, setShowAllResults] = useState(false)
  const [savingImageId, setSavingImageId] = useState<string | null>(null)
  
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
      console.log('[AI Image Generator] Props changed, updating selection:', {
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
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      const response = await fetch(`${baseUrl}/api/clients-with-product-focus`)
      const clients = await response.json()
      
      console.log('[AI Image Generator] Loaded clients:', clients)
      
      if (Array.isArray(clients)) {
        setClients(clients)
        
        // Auto-select based on props (from URL params) or first available
        if (activeClientId && activeProductFocus) {
          console.log('[AI Image Generator] Auto-selecting from props:', {
            activeClientId,
            activeProductFocus,
            activeClientName
          })
          setSelectedClientId(activeClientId)
          setSelectedProductFocus(activeProductFocus)
        } else if (clients.length > 0) {
          // Fallback to first client if no props provided
          const firstClient = clients[0]
          setSelectedClientId(firstClient.id)
          if (firstClient.productFocuses.length > 0) {
            setSelectedProductFocus(firstClient.productFocuses[0].productFocus)
          }
        }
      } else {
        console.error('[AI Image Generator] Invalid clients response format:', clients)
      }
    } catch (error) {
      console.error('Error loading clients:', error)
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

      console.log('[AI Image Generator] Loading saved topics for:', {
        clientId: selectedClientId,
        clientName: selectedClient.clientName,
        productFocus: selectedProductFocus
      })

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      const response = await fetch(`${baseUrl}/api/saved-topics?clientName=${encodeURIComponent(selectedClient.clientName)}&productFocus=${encodeURIComponent(selectedProductFocus)}`)
      const result = await response.json()
      
      console.log('[AI Image Generator] Saved topics response:', result)
      
      if (result.success) {
        setSavedTopics(result.savedTopics || [])
        console.log('[AI Image Generator] Loaded', result.savedTopics?.length || 0, 'saved topics')
      } else {
        console.error('[AI Image Generator] Failed to load saved topics:', result.error)
      }
    } catch (error) {
      console.error('Error loading saved topics:', error)
    } finally {
      setLoadingTopics(false)
    }
  }

  const generateImage = async () => {
    if (!selectedClientId || !selectedProductFocus) {
      alert('กรุณาเลือกลูกค้าและ Product Focus')
      return
    }

    // User can generate with saved ideas only, no validation needed

    setIsGenerating(true)
    
    const selectedClient = clients.find(c => c.id === selectedClientId)
    const selectedTopicData = savedTopics.find(topic => topic.title === selectedTopic)
    
    const newImageId = Math.random().toString(36).substring(2, 11)
    const newImage: GeneratedImage = {
      id: newImageId,
      url: '',
      prompt: prompt.trim(),
      reference_image: undefined,
      status: 'generating',
      created_at: new Date().toISOString()
    }

    setGeneratedImages(prev => [newImage, ...prev])

    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      const response = await fetch(`${baseUrl}/api/generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          reference_image_url: null,
          client_name: selectedClient?.clientName,
          product_focus: selectedProductFocus,
          selected_topics: selectedTopicData ? [selectedTopicData] : [],
        }),
      })

      const result = await response.json()

      if (result.success && result.images && Array.isArray(result.images)) {
        // Remove the loading placeholder
        setGeneratedImages(prev => prev.filter(img => img.id !== newImageId))
        
        // Add all Pinterest images as separate items
        const pinterestImages = result.images.map((img: any, index: number) => ({
          id: `${newImageId}-${index}`,
          url: img.url,
          prompt: prompt.trim(),
          reference_image: undefined,
          status: 'completed' as const,
          created_at: new Date().toISOString()
        }))
        
        setGeneratedImages(prev => [...pinterestImages, ...prev])
        console.log(`Found ${result.images.length} Pinterest images`)
      } else {
        // Mark as error
        setGeneratedImages(prev => prev.map(img => 
          img.id === newImageId 
            ? { ...img, status: 'error' }
            : img
        ))
        alert(`เกิดข้อผิดพลาด: ${result.error || 'ไม่สามารถค้นหารูปภาพได้'}`)
      }
    } catch (error) {
      console.error('Error searching Pinterest images:', error)
      setGeneratedImages(prev => prev.map(img => 
        img.id === newImageId 
          ? { ...img, status: 'error' }
          : img
      ))
      alert('เกิดข้อผิดพลาดในการค้นหารูปภาพ')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownloadImage = async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `generated-${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading image:', error)
      alert('เกิดข้อผิดพลาดในการดาวน์โหลด')
    }
  }

  const copyImageUrl = async (imageUrl: string) => {
    try {
      await navigator.clipboard.writeText(imageUrl)
      alert('URL ถูกคัดลอกแล้ว!')
    } catch (error) {
      console.error('Error copying URL:', error)
    }
  }

  const saveImageToSupabase = async (imageUrl: string, imageId: string) => {
    try {
      setSavingImageId(imageId)
      
      const selectedClient = clients.find(c => c.id === selectedClientId)
      if (!selectedClient) {
        alert('ไม่พบข้อมูลลูกค้า')
        return
      }

      // Convert Pinterest URL to a filename
      const urlParts = imageUrl.split('/')
      const filename = urlParts[urlParts.length - 1] || `pinterest-${Date.now()}.jpg`
      
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      const response = await fetch(`${baseUrl}/api/save-pinterest-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: imageUrl,
          filename: filename,
          client_name: selectedClient.clientName,
          product_focus: selectedProductFocus,
          search_prompt: prompt.trim(),
          selected_topics: selectedTopic ? [selectedTopic] : []
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert('บันทึกรูปภาพเรียบร้อยแล้ว!')
      } else {
        alert(`เกิดข้อผิดพลาด: ${result.error || 'ไม่สามารถบันทึกรูปภาพได้'}`)
      }
    } catch (error) {
      console.error('Error saving image:', error)
      alert('เกิดข้อผิดพลาดในการบันทึกรูปภาพ')
    } finally {
      setSavingImageId(null)
    }
  }

  const retryGeneration = (imageId: string) => {
    const image = generatedImages.find(img => img.id === imageId)
    if (image) {
      setPrompt(image.prompt)
      // Remove the failed image
      setGeneratedImages(prev => prev.filter(img => img.id !== imageId))
    }
  }

  return (
    <div className="space-y-6">
      {/* Generation Controls */}
      <Card className="p-6">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-purple-600" />
              ค้นหารูปภาพอ้างอิงจาก Pinterest
            </h3>
            <p className="text-gray-600 text-sm">ค้นหารูปภาพที่เข้ากับไอเดียและแนวคิดของคุณ</p>
          </div>

          {/* Client and Product Focus Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-600" />
                เลือกลูกค้า
              </label>
              {loadingClients ? (
                <div className="flex items-center justify-center p-3 border rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-500 text-sm">กำลังโหลด...</span>
                </div>
              ) : (
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
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
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Product Focus
              </label>
              {selectedClientId ? (
                <Select value={selectedProductFocus} onValueChange={setSelectedProductFocus}>
                  <SelectTrigger>
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
              ) : (
                <div className="p-3 border rounded-lg bg-gray-50 text-gray-500 text-sm">
                  เลือกลูกค้าก่อน
                </div>
              )}
            </div>
          </div>

          {/* Saved Topics Selection */}
          {selectedClientId && selectedProductFocus && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-600" />
                ไอเดียที่บันทึกไว้ (เลือกเพื่อใช้เป็นแรงบันดาลใจ)
              </label>
              
              {loadingTopics ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-500 text-sm">กำลังโหลดไอเดีย...</span>
                </div>
              ) : savedTopics.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {savedTopics.map((topic) => (
                    <div
                      key={topic.title}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedTopic === topic.title
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => {
                        setSelectedTopic(prev => 
                          prev === topic.title ? '' : topic.title
                        )
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm text-gray-900">{topic.title}</h4>
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">{topic.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">{topic.category}</Badge>
                            {topic.tags.slice(0, 2).map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                            ))}
                          </div>
                        </div>
                        {selectedTopic === topic.title && (
                          <CheckCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 border rounded-lg bg-gray-50 text-center">
                  <p className="text-gray-500 text-sm">ยังไม่มีไอเดียที่บันทึกไว้สำหรับลูกค้าและ Product Focus นี้</p>
                  <p className="text-gray-400 text-xs mt-1">ลองสร้างไอเดียใหม่ในหน้าหลักก่อน</p>
                </div>
              )}
              
              {selectedTopic && (
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <CheckCircle className="w-4 h-4" />
                  เลือกแล้ว 1 ไอเดีย
                </div>
              )}
            </div>
          )}

          {/* Search Keywords Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              คำค้นหาเพิ่มเติม (ไม่บังคับ)
            </label>
            <Textarea
              placeholder="เช่น: modern coffee shop design, minimalist branding, cozy atmosphere, earth tones"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-gray-500">
              ระบุคำค้นหาเพิ่มเติม หรือใช้เฉพาะไอเดียที่บันทึกไว้ก็ได้
            </p>
          </div>


          {/* Generate Button */}
          <Button 
            onClick={generateImage}
            disabled={isGenerating}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังค้นหารูปภาพ...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                ค้นหารูปภาพ
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Generated Images */}
      {generatedImages.length > 0 && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-purple-600" />
                รูปภาพจาก Pinterest
              </h3>
              <Badge variant="secondary">
                {generatedImages.length} รูป
              </Badge>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {(showAllResults ? generatedImages : generatedImages.slice(0, 20)).map((image) => (
                <Card key={image.id} className="overflow-hidden">
                  <div className="aspect-square relative bg-gray-100">
                    {image.status === 'generating' && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">กำลังสร้าง...</p>
                        </div>
                      </div>
                    )}
                    
                    {image.status === 'completed' && image.url && (
                      <div 
                        className="cursor-pointer group"
                        onClick={() => setSelectedImageForPreview(image.url)}
                      >
                        <Image
                          src={image.url}
                          alt={image.prompt}
                          fill
                          className="object-cover transition-transform group-hover:scale-105"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <div className="w-8 h-8 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-gray-700" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {image.status === 'error' && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                            <span className="text-red-600 text-xl">✕</span>
                          </div>
                          <p className="text-sm text-red-600">สร้างไม่สำเร็จ</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4">
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {image.prompt}
                    </p>
                    
                    <div className="flex items-center gap-1">
                      {image.status === 'completed' && image.url && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => saveImageToSupabase(image.url, image.id)}
                            disabled={savingImageId === image.id}
                          >
                            {savingImageId === image.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3 h-3" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadImage(image.url)}
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyImageUrl(image.url)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                      
                      {image.status === 'error' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => retryGeneration(image.id)}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          ลองใหม่
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
                ))}
              </div>

              {/* Show More/Less Button */}
              {generatedImages.length > 20 && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowAllResults(!showAllResults)}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    {showAllResults ? (
                      <>
                        แสดงน้อยลง
                        <div className="ml-2 transform rotate-180">▼</div>
                      </>
                    ) : (
                      <>
                        ดูรูปภาพทั้งหมด ({generatedImages.length - 20} รูปเพิ่มเติม)
                        <div className="ml-2">▼</div>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Tips */}
      <Card className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
        <div className="flex items-start gap-3">
          <div className="w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <Sparkles className="w-3 h-3 text-white" />
          </div>
          <div>
            <h4 className="font-medium text-purple-900 mb-1">เคล็ดลับการค้นหารูปภาพ</h4>
            <ul className="text-sm text-purple-800 space-y-1">
              <li>• เลือกไอเดียที่บันทึกไว้เพื่อให้ Pinterest เข้าใจแนวคิดของคุณ</li>
              <li>• ใช้คำค้นหาภาษาอังกฤษจะได้ผลลัพธ์ที่หลากหลายกว่า</li>
              <li>• เพิ่มคำค้นหาเฉพาะ เช่น "design", "branding", "minimal", "modern"</li>
              <li>• ลองหลายครั้งด้วยคำค้นหาที่แตกต่างกันเพื่อได้แรงบันดาลใจมากขึ้น</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Image Preview Modal */}
      <Dialog open={!!selectedImageForPreview} onOpenChange={() => setSelectedImageForPreview(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-purple-600" />
                รูปภาพจาก Pinterest
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedImageForPreview(null)}
                className="h-6 w-6 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {selectedImageForPreview && (
            <div className="relative">
              <div className="relative w-full" style={{ aspectRatio: '1/1', maxHeight: '70vh' }}>
                <Image
                  src={selectedImageForPreview}
                  alt="Pinterest image preview"
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 80vw"
                />
              </div>
              
              {/* Action buttons */}
              <div className="p-6 pt-4 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const selectedClient = clients.find(c => c.id === selectedClientId)
                    if (selectedClient) {
                      const imageId = Math.random().toString(36).substring(2, 11)
                      saveImageToSupabase(selectedImageForPreview, imageId)
                    }
                  }}
                  disabled={!selectedClientId || savingImageId !== null}
                >
                  {savingImageId ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  บันทึกรูปภาพ
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleDownloadImage(selectedImageForPreview)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  ดาวน์โหลด
                </Button>
                <Button
                  variant="outline"
                  onClick={() => copyImageUrl(selectedImageForPreview)}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  คัดลอก URL
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}