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
import Image from "next/image"
import { getStorageClient } from "@/lib/supabase/client"

interface ReferenceImage {
  name: string
  url: string
  size: number
  created_at: string
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
  
  // Reference image selection
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([])
  const [selectedReferenceImage, setSelectedReferenceImage] = useState<string>('')
  const [showAllReferenceImages, setShowAllReferenceImages] = useState(false)
  const [loadingReferenceImages, setLoadingReferenceImages] = useState(false)
  
  // AI generation results pagination
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
      loadReferenceImages()
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

  const loadReferenceImages = async () => {
    try {
      setLoadingReferenceImages(true)
      const storageClient = getStorageClient()
      
      if (!storageClient) {
        console.error('Storage client not available')
        return
      }
      
      // Get list of image files from the 'ads-creative-image' bucket, 'references' folder
      const { data: files, error } = await storageClient
        .from('ads-creative-image')
        .list('references')

      console.log('🔍 Reference images response:', { files, error })

      if (error) {
        console.error('Error loading reference images:', error)
        return
      }

      if (!files || files.length === 0) {
        console.log('No reference images found')
        setReferenceImages([])
        return
      }

      // Convert files to image objects with public URLs
      const imagePromises = files.map(async (file) => {
        const { data: urlData } = storageClient
          .from('ads-creative-image')
          .getPublicUrl(`references/${file.name}`)
        
        return {
          name: file.name,
          url: urlData.publicUrl,
          size: file.metadata?.size || 0,
          created_at: file.created_at || new Date().toISOString()
        }
      })

      const imageList = await Promise.all(imagePromises)
      
      // Sort by created date (newest first)
      const sortedImages = imageList.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      
      setReferenceImages(sortedImages)
      console.log('[AI Image Generator] Loaded', sortedImages.length, 'reference images')
    } catch (error) {
      console.error('Error loading reference images:', error)
    } finally {
      setLoadingReferenceImages(false)
    }
  }

  const generateImage = async () => {
    if (!selectedClientId || !selectedProductFocus) {
      alert('กรุณาเลือกลูกค้าและ Product Focus')
      return
    }

    if (!selectedTopic) {
      alert('กรุณาเลือกไอเดียที่บันทึกไว้')
      return
    }

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
          reference_image_url: selectedReferenceImage || null,
          client_name: selectedClient?.clientName,
          product_focus: selectedProductFocus,
          selected_topics: selectedTopicData ? [selectedTopicData] : [],
          core_concept: selectedTopicData?.concept_idea || '',
          topic_title: selectedTopicData?.title || '',
          topic_description: selectedTopicData?.description || '',
          content_pillar: selectedTopicData?.content_pillar || '',
          copywriting: selectedTopicData?.copywriting || null,
        }),
      })

      const result = await response.json()

      if (result.success && result.image_url) {
        // Update the loading image with the generated result
        setGeneratedImages(prev => prev.map(img => 
          img.id === newImageId 
            ? { 
                ...img, 
                url: result.image_url, 
                status: 'completed',
                reference_image: selectedReferenceImage || undefined
              }
            : img
        ))
        console.log(`Generated AI image: ${result.image_url}`)
      } else if (result.success && result.images && Array.isArray(result.images)) {
        // Handle multiple images if the N8N returns an array
        setGeneratedImages(prev => prev.filter(img => img.id !== newImageId))
        
        const aiImages = result.images.map((img: any, index: number) => ({
          id: `${newImageId}-${index}`,
          url: img.url || img.image_url || img,
          prompt: prompt.trim(),
          reference_image: selectedReferenceImage || undefined,
          status: 'completed' as const,
          created_at: new Date().toISOString()
        }))
        
        setGeneratedImages(prev => [...aiImages, ...prev])
        console.log(`Generated ${result.images.length} AI images`)
      } else {
        // Mark as error
        setGeneratedImages(prev => prev.map(img => 
          img.id === newImageId 
            ? { ...img, status: 'error' }
            : img
        ))
        alert(`เกิดข้อผิดพลาด: ${result.error || 'ไม่สามารถสร้างภาพได้'}`)
      }
    } catch (error) {
      console.error('Error generating AI images:', error)
      setGeneratedImages(prev => prev.map(img => 
        img.id === newImageId 
          ? { ...img, status: 'error' }
          : img
      ))
      alert('เกิดข้อผิดพลาดในการสร้างภาพด้วย AI')
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
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-xl font-bold text-black mb-2 flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Wand2 className="w-5 h-5 text-white" />
              </div>
              สร้างภาพด้วย AI
            </h3>
            <p className="text-[#8e8e93] text-sm">สร้างภาพโฆษณาใหม่ด้วยเทคโนโลยี AI ที่เข้ากับไอเดียและแนวคิดของคุณ</p>
          </div>

          {/* Client and Product Focus Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-black flex items-center gap-2">
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
                  <SelectTrigger className="border-[#d1d1d6] focus:border-black focus:ring-0 bg-white">
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

            <div className="space-y-3">
              <label className="text-sm font-medium text-black">
                Product Focus
              </label>
              {selectedClientId ? (
                <Select value={selectedProductFocus} onValueChange={setSelectedProductFocus}>
                  <SelectTrigger className="border-[#d1d1d6] focus:border-black focus:ring-0 bg-white">
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
                <div className="p-3 border border-[#d1d1d6] rounded-lg bg-[#f2f2f7] text-[#8e8e93] text-sm">
                  เลือกลูกค้าก่อน
                </div>
              )}
            </div>
          </div>

          {/* Saved Topics Selection */}
          {selectedClientId && selectedProductFocus && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-black flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                ไอเดียที่บันทึกไว้ <span className="text-red-500">*</span>
                <span className="text-xs text-gray-500">(จำเป็นต้องเลือก)</span>
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
                      className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                        selectedTopic === topic.title
                          ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200'
                          : 'border-gray-200 hover:border-amber-300 hover:bg-amber-25'
                      }`}
                      onClick={() => {
                        setSelectedTopic(topic.title)
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm text-black">{topic.title}</h4>
                          <p className="text-xs text-[#8e8e93] mt-1 line-clamp-2">{topic.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">{topic.category}</Badge>
                            {Array.isArray(topic.tags) && topic.tags.slice(0, 2).map(tag => (
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
                <div className="p-4 border border-[#d1d1d6] rounded-lg bg-[#f2f2f7] text-center">
                  <p className="text-[#8e8e93] text-sm">ยังไม่มีไอเดียที่บันทึกไว้สำหรับลูกค้าและ Product Focus นี้</p>
                  <p className="text-[#8e8e93] text-xs mt-1 opacity-70">ลองสร้างไอเดียใหม่ในหน้าหลักก่อน</p>
                </div>
              )}
              
              {selectedTopic ? (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border-2 border-amber-300">
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-medium">เลือกแล้ว: {selectedTopic}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 p-3 rounded-lg border-2 border-red-200">
                  <X className="w-4 h-4" />
                  <span className="font-medium">กรุณาเลือกไอเดียก่อนสร้างภาพ</span>
                </div>
              )}
            </div>
          )}

          {/* Reference Image Selection */}
          {selectedClientId && selectedProductFocus && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-black flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-500" />
                รูปภาพอ้างอิง (เลือกจากคลัง - ไม่บังคับ)
              </label>
              
              {loadingReferenceImages ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-500">กำลังโหลดรูปภาพ...</span>
                </div>
              ) : referenceImages.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {(showAllReferenceImages ? referenceImages : referenceImages.slice(0, 10)).map((image) => (
                      <Card 
                        key={image.url} 
                        className={`group overflow-hidden cursor-pointer transition-all ${
                          selectedReferenceImage === image.url
                            ? 'ring-2 ring-blue-500 shadow-lg'
                            : 'hover:shadow-lg'
                        }`}
                        onClick={() => {
                          setSelectedReferenceImage(prev => 
                            prev === image.url ? '' : image.url
                          )
                        }}
                      >
                        <div className="relative aspect-square">
                          <Image
                            src={image.url}
                            alt="Reference image"
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 20vw"
                          />
                          
                          {/* Selection overlay */}
                          {selectedReferenceImage === image.url && (
                            <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                              <div className="bg-blue-500 rounded-full p-2">
                                <CheckCircle className="w-5 h-5 text-white" />
                              </div>
                            </div>
                          )}
                          
                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </Card>
                    ))}
                  </div>
                  
                  {referenceImages.length > 10 && (
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAllReferenceImages(!showAllReferenceImages)}
                        className="text-blue-600 border-blue-300 hover:bg-blue-50"
                      >
                        {showAllReferenceImages 
                          ? 'แสดงน้อยลง' 
                          : `ดูทั้งหมด (${referenceImages.length} รูป)`
                        }
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <ImageIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">ยังไม่มีรูปภาพในคลัง</p>
                  <p className="text-xs mt-1">ลองอัปโหลดรูปภาพในแท็บ "อัปโหลดรูปภาพ" ก่อน</p>
                </div>
              )}
              
              {selectedReferenceImage && (
                <div className="flex items-center gap-2 text-sm text-blue-500 bg-blue-50 p-2 rounded-lg border border-blue-200">
                  <CheckCircle className="w-4 h-4" />
                  เลือกรูปภาพอ้างอิงแล้ว
                </div>
              )}
            </div>
          )}

          {/* AI Prompt Input */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-black">
              คำอธิบายภาพที่ต้องการสร้าง (ไม่บังคับ)
            </label>
            <Textarea
              placeholder="เช่น: professional advertisement for solar panels on house roof, bright sunlight, modern house, photorealistic, high quality"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="resize-none border-[#d1d1d6] focus:border-black focus:ring-0 bg-white text-black"
            />
            <p className="text-xs text-[#8e8e93]">
              อธิบายภาพที่ต้องการให้ AI สร้าง หรือใช้เฉพาะไอเดียและรูปภาพอ้างอิงก็ได้
            </p>
          </div>


          {/* Generate Button */}
          <Button 
            onClick={generateImage}
            disabled={isGenerating || !selectedTopic}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium shadow-lg transition-all duration-200 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Generated Images */}
      {generatedImages.length > 0 && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-xl font-bold text-black flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-white" />
                </div>
                ภาพที่สร้างด้วย AI
              </h3>
              <Badge variant="secondary" className="bg-[#f2f2f7] text-black border-0">
                {generatedImages.length} รูป
              </Badge>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {(showAllResults ? generatedImages : generatedImages.slice(0, 20)).map((image) => (
                <Card key={image.id} className="overflow-hidden border-[#d1d1d6] hover:border-black transition-all duration-200 hover:shadow-lg group">
                  <div className="aspect-square relative bg-gray-100">
                    {image.status === 'generating' && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
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
                  
                  <div className="p-3">
                    <p className="text-xs text-[#8e8e93] mb-3 line-clamp-2">
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
                            className="border-[#d1d1d6] hover:border-black hover:bg-black hover:text-white transition-all duration-200"
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
                            className="border-[#d1d1d6] hover:border-black hover:bg-black hover:text-white transition-all duration-200"
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyImageUrl(image.url)}
                            className="border-[#d1d1d6] hover:border-black hover:bg-black hover:text-white transition-all duration-200"
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
                          className="border-[#d1d1d6] hover:border-black hover:bg-black hover:text-white transition-all duration-200"
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
                <div className="flex justify-center pt-6">
                  <Button
                    variant="outline"
                    onClick={() => setShowAllResults(!showAllResults)}
                    className="border-[#d1d1d6] hover:border-black hover:bg-black hover:text-white transition-all duration-200"
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
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-100">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-black mb-3 text-lg">เคล็ดลับการสร้างภาพด้วย AI</h4>
            <ul className="text-sm text-[#8e8e93] space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-pink-500 font-boldตัว">•</span>
                <span>เลือกไอเดียที่บันทึกไว้เพื่อให้ AI เข้าใจแนวคิดของคุณ</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-500 font-bold">•</span>
                <span>ใช้คำอธิบายภาษาอังกฤษจะได้ผลลัพธ์ที่ดีกว่า</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-500 font-bold">•</span>
                <span>เพิ่มรายละเอียดเฉพาะ เช่น <code className="bg-white px-1 rounded text-xs">"photorealistic"</code>, <code className="bg-white px-1 rounded text-xs">"high quality"</code>, <code className="bg-white px-1 rounded text-xs">"professional"</code></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-500 font-bold">•</span>
                <span>ลองสร้างหลายครั้งด้วยคำอธิบายที่แตกต่างกันเพื่อได้ผลลัพธ์ที่หลากหลาย</span>
              </li>
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
                <ImageIcon className="w-5 h-5 text-blue-600" />
                ภาพที่สร้างด้วย AI
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
                  alt="AI generated image preview"
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
                  บันทึกภาพที่สร้าง
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