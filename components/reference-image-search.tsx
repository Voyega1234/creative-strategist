"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
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
  X,
  Search,
  Globe
} from "lucide-react"

// Facebook Icon Component
const FacebookIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
)
import { getStorageClient, getSupabase } from "@/lib/supabase/client"
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
  // Facebook specific metadata
  title?: string
  description?: string
  ad_id?: string
  page_name?: string
  type?: string
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

interface ReferenceImageSearchProps {
  activeClientId?: string | null
  activeProductFocus?: string | null  
  activeClientName?: string | null
}

type SearchSource = 'pinterest' | 'facebook'

export function ReferenceImageSearch({ 
  activeClientId, 
  activeProductFocus, 
  activeClientName 
}: ReferenceImageSearchProps) {
  const [prompt, setPrompt] = useState('')
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  
  // Search source selection
  const [searchSource, setSearchSource] = useState<SearchSource>('facebook')
  const [facebookUrl, setFacebookUrl] = useState('')
  
  // Client and product focus selection
  const [clients, setClients] = useState<ClientOption[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [selectedProductFocus, setSelectedProductFocus] = useState<string>('')
  const [loadingClients, setLoadingClients] = useState(true)
  
  // Strategic insights and topics
  const [savedTopics, setSavedTopics] = useState<SavedTopic[]>([])
  const [selectedTopic, setSelectedTopic] = useState<string>('')
  const [loadingTopics, setLoadingTopics] = useState(false)
  
  // Results pagination
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
      console.log('[Reference Image Search] Props changed, updating selection:', {
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
      
      console.log('[Reference Image Search] Loaded clients:', clients)
      
      if (Array.isArray(clients)) {
        setClients(clients)
        
        // Auto-select based on props (from URL params) or first available
        if (activeClientId && activeProductFocus) {
          console.log('[Reference Image Search] Auto-selecting from props:', {
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
        console.error('[Reference Image Search] Invalid clients response format:', clients)
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

      console.log('[Reference Image Search] Direct Supabase query for:', {
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
      console.log(`[Reference Image Search] Direct Supabase query completed in ${endTime - startTime}ms for ${data?.length || 0} items`)

      if (error) {
        console.error('[Reference Image Search] Supabase error:', error)
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
      console.log('[Reference Image Search] Loaded saved topics:', savedTopics.length)

    } catch (error) {
      console.error('[Reference Image Search] Error loading saved topics:', error)
    } finally {
      setLoadingTopics(false)
    }
  }

  const generateImage = async () => {
    // Validation based on search source
    if (searchSource === 'pinterest') {
      if (!selectedClientId || !selectedProductFocus) {
        alert('กรุณาเลือกลูกค้าและ Product Focus สำหรับการค้นหา Pinterest')
        return
      }
    } else if (searchSource === 'facebook') {
      if (!facebookUrl.trim()) {
        alert('กรุณาใส่ Facebook URL สำหรับการค้นหา')
        return
      }
    }

    setIsGenerating(true)
    
    // Clear existing gallery before new search
    setGeneratedImages([])
    
    const selectedClient = clients.find(c => c.id === selectedClientId)
    const selectedTopicData = savedTopics.find(topic => topic.title === selectedTopic)
    
    const newImageId = Math.random().toString(36).substring(2, 11)
    const newImage: GeneratedImage = {
      id: newImageId,
      url: '',
      prompt: searchSource === 'pinterest' ? prompt.trim() : facebookUrl.trim(),
      reference_image: undefined,
      status: 'generating',
      created_at: new Date().toISOString()
    }

    setGeneratedImages([newImage])

    try {
      const apiUrl = searchSource === 'pinterest' 
        ? '/api/pinterest-research'
        : '/api/facebook-research'

      const requestBody = searchSource === 'pinterest' 
        ? {
            prompt: prompt.trim(),
            client_name: selectedClient?.clientName,
            product_focus: selectedProductFocus,
            selected_topics: selectedTopicData ? [selectedTopicData] : [],
          }
        : {
            facebook_url: facebookUrl.trim(),
          }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()

      if (result.success && result.images && Array.isArray(result.images)) {
        // Remove the loading placeholder
        setGeneratedImages(prev => prev.filter(img => img.id !== newImageId))
        
        // Add all reference images as separate items
        const referenceImages = result.images.map((img: any, index: number) => ({
          id: `${newImageId}-${index}`,
          url: img.url,
          prompt: searchSource === 'pinterest' ? prompt.trim() : facebookUrl.trim(),
          reference_image: undefined,
          status: 'completed' as const,
          created_at: new Date().toISOString(),
          // Facebook specific metadata
          ...(searchSource === 'facebook' && {
            title: img.title || 'Facebook Image',
            description: img.description || '',
            ad_id: img.ad_id,
            page_name: img.page_name,
            type: img.type
          })
        }))
        
        setGeneratedImages(prev => [...referenceImages, ...prev])
        console.log(`Found ${result.images.length} ${searchSource} images`)
      } else {
        // Mark as error
        setGeneratedImages(prev => prev.map(img => 
          img.id === newImageId 
            ? { ...img, status: 'error' }
            : img
        ))
        alert(`เกิดข้อผิดพลาด: ${result.error || `ไม่สามารถค้นหารูปภาพจาก ${searchSource} ได้`}`)
      }
    } catch (error) {
      console.error(`Error searching ${searchSource} images:`, error)
      setGeneratedImages(prev => prev.map(img => 
        img.id === newImageId 
          ? { ...img, status: 'error' }
          : img
      ))
      alert(`เกิดข้อผิดพลาดในการค้นหารูปภาพจาก ${searchSource}`)
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
      link.download = `reference-${searchSource}-${Date.now()}.png`
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
      
      // For Pinterest, validate client data
      if (searchSource === 'pinterest') {
        const selectedClient = clients.find(c => c.id === selectedClientId)
        if (!selectedClient) {
          alert('ไม่พบข้อมูลลูกค้า')
          return
        }
      }

      // Convert URL to a filename
      const urlParts = imageUrl.split('/')
      const filename = urlParts[urlParts.length - 1] || `${searchSource}-ref-${Date.now()}.jpg`
      
      const requestBody: any = {
        image_url: imageUrl,
        filename: filename,
        search_prompt: searchSource === 'pinterest' ? prompt.trim() : facebookUrl.trim(),
        source: searchSource
      }

      // Only add client data for Pinterest
      if (searchSource === 'pinterest') {
        const selectedClient = clients.find(c => c.id === selectedClientId)
        requestBody.client_name = selectedClient?.clientName
        requestBody.product_focus = selectedProductFocus
        requestBody.selected_topics = selectedTopic ? [selectedTopic] : []
      }
      
      const response = await fetch('/api/save-pinterest-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
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
      if (searchSource === 'pinterest') {
        setPrompt(image.prompt)
      } else {
        setFacebookUrl(image.prompt)
      }
      // Remove the failed image
      setGeneratedImages(prev => prev.filter(img => img.id !== imageId))
    }
  }

  const getSearchSourceIcon = (source: SearchSource) => {
    switch (source) {
      case 'pinterest':
        return <Search className="w-5 h-5" />
      case 'facebook':
        return <FacebookIcon className="w-5 h-5" />
      default:
        return <Search className="w-5 h-5" />
    }
  }

  const getSearchSourceColor = (source: SearchSource) => {
    switch (source) {
      case 'pinterest':
        return 'from-red-500 to-red-600'
      case 'facebook':
        return 'from-blue-500 to-blue-600'
      default:
        return 'from-blue-500 to-blue-600'
    }
  }

  return (
    <div className="space-y-6">
      {/* Search Source Selection */}
      <Card className="p-6">
        <div className="space-y-6">

          {/* Source Selection Toggle */}
          <div className="flex gap-4">
            <Button
              onClick={() => setSearchSource('pinterest')}
              variant={searchSource === 'pinterest' ? 'default' : 'outline'}
              className={`flex items-center gap-2 px-6 py-3 ${
                searchSource === 'pinterest'
                  ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white'
                  : 'border-red-300 text-red-600 hover:bg-red-50'
              }`}
            >
              <Search className="w-4 h-4" />
              Pinterest
              {searchSource === 'pinterest' && <CheckCircle className="w-4 h-4" />}
            </Button>
            
            <Button
              onClick={() => setSearchSource('facebook')}
              variant={searchSource === 'facebook' ? 'default' : 'outline'}
              className={`flex items-center gap-2 px-6 py-3 ${
                searchSource === 'facebook'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white'
                  : 'border-blue-300 text-blue-600 hover:bg-blue-50'
              }`}
            >
              <FacebookIcon className="w-4 h-4" />
              Facebook
              {searchSource === 'facebook' && <CheckCircle className="w-4 h-4" />}
            </Button>
          </div>

          {/* Selected Source Info */}
          <div className={`p-4 rounded-lg border-2 bg-gradient-to-r ${
            searchSource === 'pinterest' 
              ? 'from-red-50 to-red-100 border-red-200' 
              : 'from-blue-50 to-blue-100 border-blue-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 bg-gradient-to-r ${getSearchSourceColor(searchSource)} rounded-lg flex items-center justify-center`}>
                {getSearchSourceIcon(searchSource)}
              </div>
              <div>
                <h4 className="font-semibold text-black">
                  {searchSource === 'pinterest' ? 'Pinterest Search' : 'Facebook Search'}
                </h4>
                <p className="text-sm text-gray-600">
                  {searchSource === 'pinterest' 
                    ? 'ค้นหารูปภาพและไอเดียจาก Pinterest ด้วยคำค้นหา'
                    : 'ดึงรูปภาพจากหน้า Facebook หรือโพสต์ด้วย URL'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Client and Product Focus Selection - Only for Pinterest */}
          {searchSource === 'pinterest' && (
            <>
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

              {/* Saved Topics Selection - Only for Pinterest */}
              {selectedClientId && selectedProductFocus && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-black flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-500" />
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
                              : 'border-[#d1d1d6] hover:border-black'
                          }`}
                          onClick={() => {
                            setSelectedTopic(prev => 
                              prev === topic.title ? '' : topic.title
                            )
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1">
                              <h4 className="font-medium text-sm text-black">{topic.title}</h4>
                              <div className="text-xs text-[#8e8e93] mt-1 line-clamp-2">
                                {(() => {
                                  try {
                                    // Try to parse as JSON first (new format)
                                    const parsed = JSON.parse(topic.description)
                                    
                                    // New format with summary and sections
                                    if (parsed && typeof parsed === 'object' && parsed.summary && parsed.sections) {
                                      return parsed.summary
                                    }
                                    
                                    // Old array format
                                    if (Array.isArray(parsed)) {
                                      return parsed.length > 0 ? parsed[0].text : 'No description available'
                                    }
                                  } catch {
                                    // If parsing fails, it's probably an old string format
                                    return topic.description
                                  }
                                  // Fallback
                                  return topic.description
                                })()}
                              </div>
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
                  
                  {selectedTopic && (
                    <div className="flex items-center gap-2 text-sm text-amber-500 bg-amber-50 p-2 rounded-lg border border-amber-200">
                      <CheckCircle className="w-4 h-4" />
                      เลือกแล้ว 1 ไอเดีย
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Search Input - Pinterest Keywords or Facebook URL */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-black">
              {searchSource === 'pinterest' 
                ? 'คำค้นหาเพิ่มเติม (ไม่บังคับ)' 
                : 'Facebook URL (จำเป็น)'
              }
            </label>
            
            {searchSource === 'pinterest' ? (
              <Textarea
                placeholder="เช่น: modern coffee shop design, minimalist branding, cozy atmosphere, earth tones"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                className="resize-none border-[#d1d1d6] focus:border-black focus:ring-0 bg-white text-black"
              />
            ) : (
              <Input
                placeholder="https://facebook.com/your-page หรือ https://facebook.com/posts/..."
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
                className="border-[#d1d1d6] focus:border-black focus:ring-0 bg-white text-black"
              />
            )}
            
            <p className="text-xs text-[#8e8e93]">
              {searchSource === 'pinterest' 
                ? 'ระบุคำค้นหาเพิ่มเติม หรือใช้เฉพาะไอเดียที่บันทึกไว้ก็ได้'
                : 'ใส่ลิงค์หน้า Facebook หรือโพสต์ที่ต้องการดึงรูปภาพ'
              }
            </p>
          </div>

          {/* Generate Button */}
          <Button 
            onClick={generateImage}
            disabled={
              isGenerating || 
              (searchSource === 'facebook' && !facebookUrl.trim()) ||
              (searchSource === 'pinterest' && (!selectedClientId || !selectedProductFocus))
            }
            className={`w-full bg-gradient-to-r ${getSearchSourceColor(searchSource)} hover:shadow-xl text-white font-medium shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังค้นหารูปภาพ...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                ค้นหารูปภาพจาก {searchSource === 'pinterest' ? 'Pinterest' : 'Facebook'}
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
                <div className={`w-8 h-8 bg-gradient-to-r ${getSearchSourceColor(searchSource)} rounded-lg flex items-center justify-center`}>
                  <ImageIcon className="w-5 h-5 text-white" />
                </div>
                รูปภาพจาก {searchSource === 'pinterest' ? 'Pinterest' : 'Facebook'}
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
                    {/* Display Facebook metadata if available */}
                    {searchSource === 'facebook' && image.title && (
                      <div className="mb-3">
                        <h4 className="text-sm font-medium text-black mb-1 line-clamp-1">{image.title}</h4>
                        {image.page_name && (
                          <p className="text-xs text-blue-600 mb-1">จาก: {image.page_name}</p>
                        )}
                        {image.description && (
                          <p className="text-xs text-[#8e8e93] line-clamp-2 mb-2">{image.description}</p>
                        )}
                        {image.type && (
                          <Badge variant="outline" className="text-xs">
                            {image.type === 'video_preview' ? 'วิดีโอ' : image.type === 'profile_picture' ? 'โปรไฟล์' : 'โฆษณา'}
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    {/* Display Pinterest search prompt or Facebook URL */}
                    {searchSource === 'pinterest' && (
                      <p className="text-xs text-[#8e8e93] mb-3 line-clamp-2">
                        {image.prompt}
                      </p>
                    )}
                    
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
      <Card className={`p-6 bg-gradient-to-r ${searchSource === 'pinterest' ? 'from-red-50 to-red-100 border-2 border-red-100' : 'from-blue-50 to-blue-100 border-2 border-blue-100'}`}>
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 bg-gradient-to-r ${getSearchSourceColor(searchSource)} rounded-lg flex items-center justify-center flex-shrink-0`}>
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-black mb-3 text-lg">
              เคล็ดลับการค้นหารูปภาพจาก {searchSource === 'pinterest' ? 'Pinterest' : 'Facebook'}
            </h4>
            <ul className="text-sm text-[#8e8e93] space-y-2">
              {searchSource === 'pinterest' ? (
                <>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 font-bold">•</span>
                    <span>เลือกไอเดียที่บันทึกไว้เพื่อให้ Pinterest เข้าใจแนวคิดของคุณ</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 font-bold">•</span>
                    <span>ใช้คำค้นหาภาษาอังกฤษจะได้ผลลัพธ์ที่หลากหลายกว่า</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 font-bold">•</span>
                    <span>เพิ่มคำค้นหาเฉพาะ เช่น <code className="bg-white px-1 rounded text-xs">"design"</code>, <code className="bg-white px-1 rounded text-xs">"branding"</code>, <code className="bg-white px-1 rounded text-xs">"minimal"</code></span>
                  </li>
                </>
              ) : (
                <>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold">•</span>
                    <span>ใส่ลิงค์หน้า Facebook หรือโพสต์ที่มีรูปภาพที่ต้องการ</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold">•</span>
                    <span>รองรับทั้งหน้าแฟนเพจและโพสต์ส่วนตัว (ที่เปิดเป็น Public)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold">•</span>
                    <span>ตรวจสอบว่าลิงค์สามารถเข้าถึงได้โดยไม่ต้อง login Facebook</span>
                  </li>
                </>
              )}
              <li className="flex items-start gap-2">
                <span className={`${searchSource === 'pinterest' ? 'text-red-500' : 'text-blue-500'} font-bold`}>•</span>
                <span>ลองหลายครั้งด้วยแหล่งที่แตกต่างกันเพื่อได้แรงบันดาลใจมากขึ้น</span>
              </li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Image Preview Modal */}
      <Dialog open={!!selectedImageForPreview} onOpenChange={() => setSelectedImageForPreview(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-blue-600" />
              รูปภาพจาก {searchSource === 'pinterest' ? 'Pinterest' : 'Facebook'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedImageForPreview && (
            <div className="relative">
              {/* Display Facebook metadata in modal header if available */}
              {searchSource === 'facebook' && (() => {
                const selectedImage = generatedImages.find(img => img.url === selectedImageForPreview)
                return selectedImage?.title && (
                  <div className="px-6 pb-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-black mb-2">{selectedImage.title}</h3>
                    {selectedImage.page_name && (
                      <p className="text-sm text-blue-600 mb-1">จาก: {selectedImage.page_name}</p>
                    )}
                    {selectedImage.description && (
                      <p className="text-sm text-gray-600">{selectedImage.description}</p>
                    )}
                    <div className="flex gap-2 mt-2">
                      {selectedImage.type && (
                        <Badge variant="outline">
                          {selectedImage.type === 'video_preview' ? 'วิดีโอพรีวิว' : 
                           selectedImage.type === 'profile_picture' ? 'รูปโปรไฟล์' : 'โฆษณา Facebook'}
                        </Badge>
                      )}
                      {selectedImage.ad_id && (
                        <Badge variant="secondary">ID: {selectedImage.ad_id}</Badge>
                      )}
                    </div>
                  </div>
                )
              })()}
              
              <div className="relative w-full" style={{ aspectRatio: '1/1', maxHeight: '70vh' }}>
                <Image
                  src={selectedImageForPreview}
                  alt={`${searchSource} image preview`}
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
                    const imageId = Math.random().toString(36).substring(2, 11)
                    saveImageToSupabase(selectedImageForPreview, imageId)
                  }}
                  disabled={
                    (searchSource === 'pinterest' && !selectedClientId) || 
                    savingImageId !== null
                  }
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
