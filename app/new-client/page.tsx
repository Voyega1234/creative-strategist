"use client"

import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ArrowRight, ArrowLeft, HelpCircle, RefreshCcw, Plus, X } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { getClients } from "@/lib/data/clients"
import { useRouter } from "next/navigation"

type FacebookAnalysisData = {
  clientName: string;
  products: string[];
}

export default function NewClientPage() {
  const [clients, setClients] = useState<{ id: string; clientName: string }[]>([])
  const [formData, setFormData] = useState({
    clientName: "",
    websiteUrl: "",
    facebookUrl: "",
    market: "Thailand",
    productFocus: "",
    additionalInfo: "",
    userCompetitors: "",
    ad_account_id: ""
  })
  const [isCreating, setIsCreating] = useState(false)
  const [adAccountError, setAdAccountError] = useState("")
  const [showProductFocusTooltip, setShowProductFocusTooltip] = useState(false)
  
  // New state for Facebook analysis mode
  const [useAdvancedMode, setUseAdvancedMode] = useState(false)
  const [simpleFacebookUrl, setSimpleFacebookUrl] = useState("")
  const [isAnalyzingFacebook, setIsAnalyzingFacebook] = useState(false)
  const [facebookAnalysisData, setFacebookAnalysisData] = useState<FacebookAnalysisData | null>(null)
  const [selectedProduct, setSelectedProduct] = useState("")
  const [facebookAnalysisError, setFacebookAnalysisError] = useState("")
  const [customProductInput, setCustomProductInput] = useState("")
  const [customProducts, setCustomProducts] = useState<string[]>([])
  
  const router = useRouter()

  // Function to play notification sound
  const playNotificationSound = () => {
    try {
      const audio = new Audio('/new-notification-011-364050.mp3')
      audio.volume = 0.5
      console.log('Attempting to play notification sound...')
      
      audio.play().then(() => {
        console.log('Notification sound played successfully')
      }).catch(error => {
        console.error('Could not play notification sound:', error)
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
          const oscillator = audioContext.createOscillator()
          const gainNode = audioContext.createGain()
          
          oscillator.connect(gainNode)
          gainNode.connect(audioContext.destination)
          
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
          oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1)
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2)
          
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
          
          oscillator.start(audioContext.currentTime)
          oscillator.stop(audioContext.currentTime + 0.3)
          
          console.log('Played fallback beep sound')
        } catch (fallbackError) {
          console.error('Fallback sound also failed:', fallbackError)
        }
      })
    } catch (error) {
      console.error('Could not initialize notification sound:', error)
    }
  }

  useEffect(() => {
    const fetchClients = async () => {
      const fetchedClients = await getClients()
      setClients(fetchedClients)
    }
    fetchClients()
  }, [])

  const validateAndFormatAdAccountId = (adAccountId: string): string | null => {
    if (!adAccountId.trim()) return null
    
    const trimmed = adAccountId.trim()
    
    if (trimmed.startsWith('act_')) {
      const numberPart = trimmed.substring(4)
      if (!/^\d{15,16}$/.test(numberPart)) {
        throw new Error("Ad Account ID must be in format: act_1234567890123456 (15-16 digits after act_)")
      }
      return trimmed
    }
    
    if (/^\d{15,16}$/.test(trimmed)) {
      return `act_${trimmed}`
    }
    
    throw new Error("Ad Account ID must be either 15-16 digits or in format: act_1234567890123456")
  }

  const handleAdAccountChange = (value: string) => {
    setFormData(prev => ({ ...prev, ad_account_id: value }))
    
    if (!value.trim()) {
      setAdAccountError("")
      return
    }
    
    try {
      validateAndFormatAdAccountId(value)
      setAdAccountError("")
    } catch (error: any) {
      setAdAccountError(error.message)
    }
  }

  // Facebook analysis function
  const handleAnalyzeFacebook = async () => {
    if (!simpleFacebookUrl.trim()) {
      setFacebookAnalysisError("กรุณาใส่ URL Facebook Page")
      return
    }

    setIsAnalyzingFacebook(true)
    setFacebookAnalysisError("")
    
    try {
      const response = await fetch('/api/facebook-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          facebook_url: simpleFacebookUrl.trim()
        }),
      })

      const result = await response.json()
      
      if (result.success) {
        setFacebookAnalysisData(result.data)
        setSelectedProduct("") // Reset selection
      } else {
        setFacebookAnalysisError(result.error || "ไม่สามารถวิเคราะห์ Facebook Page ได้")
      }
    } catch (error) {
      console.error('Error analyzing Facebook:', error)
      setFacebookAnalysisError("เกิดข้อผิดพลาดในการวิเคราะห์ Facebook Page")
    }
    
    setIsAnalyzingFacebook(false)
  }

  // Reset function when switching modes
  const handleModeChange = (checked: boolean) => {
    setUseAdvancedMode(checked)
    // Reset all form states when switching
    setSimpleFacebookUrl("")
    setFacebookAnalysisData(null)
    setSelectedProduct("")
    setFacebookAnalysisError("")
    setCustomProductInput("")
    setCustomProducts([])
    setFormData({
      clientName: "",
      websiteUrl: "",
      facebookUrl: "",
      market: "Thailand",
      productFocus: "",
      additionalInfo: "",
      userCompetitors: "",
      ad_account_id: ""
    })
  }

  const handleAddCustomProduct = () => {
    if (customProductInput.trim() && !customProducts.includes(customProductInput.trim())) {
      const newCustomProduct = customProductInput.trim()
      setCustomProducts(prev => [...prev, newCustomProduct])
      setSelectedProduct(newCustomProduct)
      setCustomProductInput("")
    }
  }

  const handleRemoveCustomProduct = (productToRemove: string) => {
    setCustomProducts(prev => prev.filter(product => product !== productToRemove))
    if (selectedProduct === productToRemove) {
      setSelectedProduct("")
    }
  }

  const getAllAvailableProducts = () => {
    const facebookProducts = facebookAnalysisData?.products || []
    return [...facebookProducts, ...customProducts]
  }

  const handleCreateNewClient = async () => {
    let clientData;
    
    if (useAdvancedMode) {
      // Advanced mode - use manual form data
      if (!formData.clientName || !formData.market || !formData.productFocus) {
        alert("กรุณากรอกข้อมูลที่จำเป็น: ชื่อลูกค้า, ตลาดเป้าหมาย, และสินค้าหรือบริการที่สนใจ")
        return
      }

      let validatedAdAccountId = null
      if (formData.ad_account_id) {
        try {
          validatedAdAccountId = validateAndFormatAdAccountId(formData.ad_account_id)
        } catch (error: any) {
          alert(error.message)
          return
        }
      }

      clientData = {
        ...formData,
        ad_account_id: validatedAdAccountId
      }
    } else {
      // Simple mode - use Facebook analysis data
      if (!facebookAnalysisData || !selectedProduct) {
        alert("กรุณาเลือกสินค้าหรือบริการที่ต้องการวิเคราะห์")
        return
      }

      clientData = {
        clientName: facebookAnalysisData.clientName,
        websiteUrl: "",
        facebookUrl: simpleFacebookUrl,
        market: "Thailand",
        productFocus: selectedProduct,
        additionalInfo: "",
        userCompetitors: "",
        ad_account_id: null
      }
    }

    console.log('[new-client] Sending client data to competitor-research API:', clientData);
    console.log('[new-client] Mode:', useAdvancedMode ? 'Advanced' : 'Facebook');
    
    setIsCreating(true)
    
    try {
      const response = await fetch('/api/competitor-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clientData),
      })

      const result = await response.json()
      
      if (result.success) {
        const insightsStatus = result.strategicInsightsGenerated ? 
          "Competitor analysis and strategic insights completed successfully!" :
          "Competitor analysis completed successfully! (Strategic insights generation encountered an issue)"
        
        playNotificationSound()
        alert(insightsStatus)
        
        // Clear the clients cache completely for the main page
        try {
          console.log('Clearing client cache after new client creation...');
          await fetch('/api/clients-with-product-focus', { method: 'POST' });
          console.log('Client cache cleared successfully');
          
          // Small delay to ensure cache is fully cleared
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.warn('Failed to clear client cache:', error);
        }
        
        // Construct proper URL with clientName and productFocus
        let destination = `/configure`
        
        if (result.analysisRunId) {
          const clientName = useAdvancedMode ? formData.clientName : facebookAnalysisData?.clientName
          const productFocus = useAdvancedMode ? formData.productFocus : selectedProduct
          
          if (clientName && productFocus) {
            destination = `/configure?clientName=${encodeURIComponent(clientName)}&productFocus=${encodeURIComponent(productFocus)}`
          } else {
            // Fallback to clientId if we don't have name/productFocus
            destination = `/configure?clientId=${result.analysisRunId}`
          }
        }
        
        router.push(destination)
      } else {
        alert(`Failed to analyze competitors: ${result.error}`)
      }
    } catch (error) {
      console.error('Error calling competitor research API:', error)
      alert('An error occurred while analyzing competitors. Please try again.')
    }
    
    setIsCreating(false)
  }

  return (
    <>
      <style jsx>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
      <div className="flex min-h-screen bg-white relative animate-in fade-in-0 duration-500">
      <div className="flex w-full relative z-10">
        {/* Left Panel - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#7f56d9] to-[#063def] relative overflow-hidden">
          <div className="absolute inset-0 bg-white/5 opacity-20"></div>
          
          <div className="relative z-10 flex flex-col justify-center px-12 py-16 text-white">
            <div className="mb-8">
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                  <div className="w-4 h-4 bg-[#7f56d9] rounded-sm"></div>
                </div>
              </div>
              <h1 className="text-4xl font-bold mb-4 leading-tight">
                Strategic Competitor<br />Research Platform
              </h1>
              <p className="text-xl text-white/90 leading-relaxed">
                วิเคราะห์คู่แข่งเชิงลึก สร้างข้อมูลเชิงกลยุทธ์ และพัฒนากลยุทธ์การตลาดที่ขับเคลื่อนด้วยข้อมูล
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <span className="text-white/90">การวิเคราะห์คู่แข่งด้วย AI</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <span className="text-white/90">การสร้างข้อมูลเชิงกลยุทธ์</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <span className="text-white/90">การวิจัยตลาดแบบเรียลไทม์</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-4xl">
            {/* Back Navigation */}
            <div className="mb-4">
              <Link
                href="/"
                className="inline-flex items-center text-[#8e8e93] hover:text-[#7f56d9] transition-colors text-sm"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                กลับไปหน้าหลัก
              </Link>
            </div>

            <div className="text-center mb-6">
              <div className="lg:hidden w-12 h-12 bg-[#dbeafe] rounded-xl flex items-center justify-center mx-auto mb-3">
                <div className="w-6 h-6 bg-[#7f56d9] rounded-lg flex items-center justify-center">
                  <div className="w-3 h-3 bg-white rounded-sm"></div>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-[#535862] mb-2">Create New Analysis</h2>
              <p className="text-[#8e8e93]">Start your competitor research journey</p>
            </div>

            <Tabs defaultValue="new-client" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-auto bg-transparent p-0 border-b border-[#e4e7ec] mb-4">
                <TabsTrigger
                  value="new-client"
                  className="data-[state=active]:bg-[#dbeafe] data-[state=active]:text-[#063def] data-[state=active]:shadow-sm rounded-md text-base font-medium py-3 text-[#535862] hover:text-[#063def] hover:bg-[#f5f5f5]"
                >
                  ลูกค้าใหม่
                </TabsTrigger>
                <TabsTrigger
                  value="select-client"
                  className="data-[state=active]:bg-[#dbeafe] data-[state=active]:text-[#063def] data-[state=active]:shadow-sm rounded-md text-base font-medium py-3 text-[#535862] hover:text-[#063def] hover:bg-[#f5f5f5]"
                >
                  เลือกลูกค้า
                </TabsTrigger>
              </TabsList>

              <TabsContent value="new-client">
                {/* Mode Toggle */}
                <div className="flex items-center justify-center mb-6 p-4 bg-[#eff6ff] rounded-lg border border-[#dbeafe]">
                  <Label htmlFor="advanced-mode" className="text-sm font-medium text-[#535862] mr-3">
                    โหมดง่าย (Facebook)
                  </Label>
                  <Switch
                    id="advanced-mode"
                    checked={useAdvancedMode}
                    onCheckedChange={handleModeChange}
                    disabled={isCreating || isAnalyzingFacebook}
                  />
                  <Label htmlFor="advanced-mode" className="text-sm font-medium text-[#535862] ml-3">
                    โหมดขั้นสูง
                  </Label>
                </div>

                {/* Simple Mode - Facebook URL Input */}
                {!useAdvancedMode ? (
                  <div className="space-y-6">
                    {/* Step 1: Facebook URL Input */}
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-[#535862] mb-2">
                        ใส่ลิงก์ Facebook Page ของคุณ
                      </h3>
                      <p className="text-[#8e8e93] mb-4">
                        เราจะวิเคราะห์ข้อมูลบริษัทและสินค้าจาก Facebook Page ของคุณ
                      </p>
                    </div>

                    <div className="max-w-2xl mx-auto">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-[#535862] mb-2">
                            Facebook Page URL <span className="text-red-500">*</span>
                          </label>
                          <div className="flex gap-3">
                            <Input
                              type="url"
                              placeholder="https://www.facebook.com/your-page"
                              className="border-[#e4e7ec] focus:border-[#7f56d9] focus:ring-1 focus:ring-[#7f56d9]/20 h-12 text-base transition-colors flex-1"
                              value={simpleFacebookUrl}
                              onChange={(e) => setSimpleFacebookUrl(e.target.value)}
                              disabled={isAnalyzingFacebook || isCreating}
                            />
                            <Button
                              onClick={handleAnalyzeFacebook}
                              disabled={isAnalyzingFacebook || isCreating || !simpleFacebookUrl.trim()}
                              className="bg-[#7f56d9] text-white hover:bg-[#063def] px-6 h-12 whitespace-nowrap"
                            >
                              {isAnalyzingFacebook ? (
                                <>
                                  <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                                  วิเคราะห์...
                                </>
                              ) : (
                                'วิเคราะห์'
                              )}
                            </Button>
                          </div>
                          {facebookAnalysisError && (
                            <p className="text-red-500 text-sm mt-2">{facebookAnalysisError}</p>
                          )}
                        </div>

                        {/* Step 2: Show Company Info and Product Selection */}
                        {facebookAnalysisData && (
                          <div className="space-y-6 animate-in fade-in-0 slide-in-from-top-4 duration-300">
                            {/* Company Info Display */}
                            <Card className="border-[#dbeafe] bg-[#eff6ff]">
                              <CardContent className="p-6">
                                <h4 className="text-lg font-semibold text-[#063def] mb-2">
                                  ข้อมูลบริษัทที่วิเคราะห์ได้
                                </h4>
                                <p className="text-[#535862] text-base">
                                  <span className="font-medium">ชื่อบริษัท:</span> {facebookAnalysisData.clientName}
                                </p>
                              </CardContent>
                            </Card>

                            {/* Product Selection */}
                            <div>
                              <h4 className="text-lg font-semibold text-[#535862] mb-4">
                                เลือกสินค้าหรือบริการที่ต้องการวิเคราะห์คู่แข่ง <span className="text-red-500">*</span>
                              </h4>
                              
                              {/* Custom Product Input */}
                              <div className="mb-4 p-4 border border-[#e4e7ec] rounded-lg bg-[#fafafa]">
                                <h5 className="text-sm font-medium text-[#535862] mb-2">
                                  เพิ่มสินค้าหรือบริการของคุณเอง
                                </h5>
                                <div className="flex gap-2">
                                  <Input
                                    type="text"
                                    placeholder="เช่น การซื้อขายทอง, บริการลงทุน, กาแฟ"
                                    className="border-[#e4e7ec] focus:border-[#7f56d9] focus:ring-1 focus:ring-[#7f56d9]/20 h-10 text-base transition-colors flex-1"
                                    value={customProductInput}
                                    onChange={(e) => setCustomProductInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleAddCustomProduct()
                                      }
                                    }}
                                  />
                                  <Button
                                    onClick={handleAddCustomProduct}
                                    disabled={!customProductInput.trim()}
                                    className="bg-[#7f56d9] text-white hover:bg-[#063def] px-4 h-10"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>

                              {/* All Available Products */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {getAllAvailableProducts().length === 0 ? (
                                  <div className="col-span-full text-center py-8 text-[#8e8e93]">
                                    <p className="mb-2">ยังไม่มีสินค้าหรือบริการในรายการ</p>
                                    <p className="text-sm">โปรดเพิ่มสินค้าหรือบริการที่คุณต้องการวิเคราะห์ด้านบน</p>
                                  </div>
                                ) : (
                                  getAllAvailableProducts().map((product, index) => {
                                  const isCustomProduct = customProducts.includes(product)
                                  return (
                                    <Card 
                                      key={`${isCustomProduct ? 'custom' : 'facebook'}-${index}`}
                                      className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                                        selectedProduct === product
                                          ? 'border-[#7f56d9] bg-[#eff6ff] shadow-sm'
                                          : 'border-[#e4e7ec] hover:border-[#b692f6]'
                                      }`}
                                      onClick={() => setSelectedProduct(product)}
                                    >
                                      <CardContent className="p-4">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center space-x-3 flex-1">
                                            <div className={`w-4 h-4 rounded-full border-2 transition-colors ${
                                              selectedProduct === product
                                                ? 'border-[#7f56d9] bg-[#7f56d9]'
                                                : 'border-[#d1d1d6]'
                                            }`}>
                                              {selectedProduct === product && (
                                                <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                                              )}
                                            </div>
                                            <div className="flex-1">
                                              <span className={`text-base ${
                                                selectedProduct === product
                                                  ? 'text-[#063def] font-medium'
                                                  : 'text-[#535862]'
                                              }`}>
                                                {product}
                                              </span>
                                              {isCustomProduct && (
                                                <span className="text-xs text-[#8e8e93] block">
                                                  (เพิ่มโดยคุณ)
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          {isCustomProduct && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 w-6 p-0 text-[#ef4444] hover:text-[#dc2626] hover:bg-red-50"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                handleRemoveCustomProduct(product)
                                              }}
                                            >
                                              <X className="w-3 h-3" />
                                            </Button>
                                          )}
                                        </div>
                                      </CardContent>
                                    </Card>
                                  )
                                })
                                )}
                              </div>
                            </div>

                            {/* Submit Button */}
                            <div className="pt-4">
                              <Button
                                className={`w-full ${isCreating ? 'h-16' : 'h-12'} bg-[#7f56d9] text-white hover:bg-[#063def] text-base font-medium transition-all duration-300 shadow-sm disabled:opacity-75 relative overflow-hidden group`}
                                onClick={handleCreateNewClient}
                                disabled={isCreating || !selectedProduct}
                              >
                                {isCreating ? (
                                  <>
                                    <div className="flex flex-col items-center justify-center">
                                      <div className="flex items-center mb-2">
                                        <div className="flex space-x-1 mr-3">
                                          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                        </div>
                                        <span className="animate-pulse">กำลังประมวลผล</span>
                                      </div>
                                      <span className="text-xs text-white/80">
                                        กระบวนการนี้จะใช้เวลาประมาณ 5-10 นาที
                                      </span>
                                    </div>
                                    <div className="absolute bottom-0 left-0 h-1 bg-white/30 w-full">
                                      <div className="h-full bg-white animate-pulse" style={{ 
                                        width: '100%',
                                        animation: 'progress 3s ease-in-out infinite'
                                      }}></div>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <span className="group-hover:translate-x-1 transition-transform duration-200">
                                      เริ่มวิเคราะห์คู่แข่ง
                                    </span>
                                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Advanced Mode - Original Form */
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#535862] mb-1.5">
                        ชื่อลูกค้า <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="text"
                        placeholder="กรอกชื่อลูกค้า"
                        className="border-[#e4e7ec] focus:border-[#7f56d9] focus:ring-1 focus:ring-[#7f56d9]/20 h-10 text-base transition-colors"
                        value={formData.clientName}
                        onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                        disabled={isCreating}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#535862] mb-1.5">
                        ตลาดเป้าหมาย <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="text"
                        placeholder="เช่น ประเทศไทย, สิงคโปร์, มาเลเซีย"
                        className="border-[#e4e7ec] focus:border-[#7f56d9] focus:ring-1 focus:ring-[#7f56d9]/20 h-10 text-base transition-colors"
                        value={formData.market}
                        onChange={(e) => setFormData(prev => ({ ...prev, market: e.target.value }))}
                        disabled={isCreating}
                      />
                    </div>

                    <div>
                      <div className="flex items-center mb-1.5">
                        <label className="block text-sm font-medium text-[#535862]">
                          สินค้าหรือบริการที่สนใจ <span className="text-red-500">*</span>
                        </label>
                        <div className="relative ml-2">
                          <HelpCircle 
                            className="h-4 w-4 text-[#8e8e93] cursor-help hover:text-[#7f56d9] transition-colors"
                            onMouseEnter={() => setShowProductFocusTooltip(true)}
                            onMouseLeave={() => setShowProductFocusTooltip(false)}
                          />
                          {showProductFocusTooltip && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-sm text-white bg-gray-800 rounded-lg shadow-lg whitespace-nowrap z-10">
                              สินค้าหรือบริการที่ต้องการวิเคราะห์คู่แข่ง
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                            </div>
                          )}
                        </div>
                      </div>
                      <Input
                        type="text"
                        placeholder="เช่น การซื้อขายทอง, บริการลงทุน, กาแฟ, เสื้อผ้า"
                        className="border-[#e4e7ec] focus:border-[#7f56d9] focus:ring-1 focus:ring-[#7f56d9]/20 h-10 text-base transition-colors"
                        value={formData.productFocus}
                        onChange={(e) => setFormData(prev => ({ ...prev, productFocus: e.target.value }))}
                        disabled={isCreating}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#535862] mb-1.5">
                        เว็บไซต์
                      </label>
                      <Input
                        type="url"
                        placeholder="https://example.com"
                        className="border-[#e4e7ec] focus:border-[#7f56d9] focus:ring-1 focus:ring-[#7f56d9]/20 h-10 text-base transition-colors"
                        value={formData.websiteUrl}
                        onChange={(e) => setFormData(prev => ({ ...prev, websiteUrl: e.target.value }))}
                        disabled={isCreating}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#535862] mb-1.5">
                        เพจ Facebook
                      </label>
                      <Input
                        type="url"
                        placeholder="ลิงก์เพจ Facebook"
                        className="border-[#e4e7ec] focus:border-[#7f56d9] focus:ring-1 focus:ring-[#7f56d9]/20 h-10 text-base transition-colors"
                        value={formData.facebookUrl}
                        onChange={(e) => setFormData(prev => ({ ...prev, facebookUrl: e.target.value }))}
                        disabled={isCreating}
                      />
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#535862] mb-1.5">
                        ข้อมูลเพิ่มเติม
                      </label>
                      <Textarea
                        placeholder="ข้อมูลเพิ่มเติมเกี่ยวกับลูกค้า..."
                        className="border-[#e4e7ec] focus:border-[#7f56d9] focus:ring-1 focus:ring-[#7f56d9]/20 text-base resize-none transition-colors"
                        rows={3}
                        value={formData.additionalInfo}
                        onChange={(e) => setFormData(prev => ({ ...prev, additionalInfo: e.target.value }))}
                        disabled={isCreating}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#535862] mb-1.5">
                        คู่แข่งที่ทราบ
                      </label>
                      <Textarea
                        placeholder="ชื่อคู่แข่ง (คั่นด้วยเครื่องหมายจุลภาค)"
                        className="border-[#e4e7ec] focus:border-[#7f56d9] focus:ring-1 focus:ring-[#7f56d9]/20 text-base resize-none transition-colors"
                        rows={3}
                        value={formData.userCompetitors}
                        onChange={(e) => setFormData(prev => ({ ...prev, userCompetitors: e.target.value }))}
                        disabled={isCreating}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#535862] mb-1.5">
                        รหัสบัญชีโฆษณา
                      </label>
                      <Input
                        type="text"
                        placeholder="act_1234567890123456 (ไม่บังคับ)"
                        className={`border-[#e4e7ec] focus:border-[#7f56d9] focus:ring-1 focus:ring-[#7f56d9]/20 h-10 text-base transition-colors ${
                          adAccountError ? '!border-red-500 !focus:border-red-500 !focus:ring-red-500/20' : ''
                        }`}
                        value={formData.ad_account_id}
                        onChange={(e) => handleAdAccountChange(e.target.value)}
                        disabled={isCreating}
                      />
                      {adAccountError && (
                        <p className="text-red-500 text-sm mt-1">{adAccountError}</p>
                      )}
                    </div>

                    <div className="pt-4">
                      <Button
                        className={`w-full ${isCreating ? 'h-16' : 'h-12'} bg-[#7f56d9] text-white hover:bg-[#063def] text-base font-medium transition-all duration-300 shadow-sm disabled:opacity-75 relative overflow-hidden group`}
                        onClick={handleCreateNewClient}
                        disabled={isCreating}
                      >
                        {isCreating ? (
                          <>
                            <div className="flex flex-col items-center justify-center">
                              <div className="flex items-center mb-2">
                                {/* Animated dots */}
                                <div className="flex space-x-1 mr-3">
                                  <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                  <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                  <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                                <span className="animate-pulse">กำลังประมวลผล</span>
                              </div>
                              <span className="text-xs text-white/80">
                                กระบวนการนี้จะใช้เวลาประมาณ 5-10 นาที
                              </span>
                            </div>
                            {/* Progress bar animation */}
                            <div className="absolute bottom-0 left-0 h-1 bg-white/30 w-full">
                              <div className="h-full bg-white animate-pulse" style={{ 
                                width: '100%',
                                animation: 'progress 3s ease-in-out infinite'
                              }}></div>
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="group-hover:translate-x-1 transition-transform duration-200">
                              เริ่มวิเคราะห์คู่แข่ง
                            </span>
                            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                            {/* Hover effect background */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
                )}
              </TabsContent>

              <TabsContent value="select-client">
                <div className="space-y-4">
                  <p className="text-[#8e8e93] text-center mb-6">
                    เลือกลูกค้าที่มีอยู่เพื่อดูผลการวิเคราะห์
                  </p>
                  
                  {clients.length > 0 ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {clients.map((client) => (
                        <Link
                          key={client.id}
                          href={`/configure?clientId=${client.id}`}
                          className="group"
                        >
                          <div className="flex items-center justify-between p-4 border border-[#e4e7ec] rounded-lg hover:border-[#7f56d9] hover:bg-[#eff6ff] transition-all duration-200 cursor-pointer">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-[#dbeafe] rounded-lg flex items-center justify-center group-hover:bg-[#7f56d9] transition-colors">
                                <div className="w-5 h-5 bg-[#7f56d9] rounded-sm group-hover:bg-white transition-colors"></div>
                              </div>
                              <div>
                                <h3 className="font-medium text-[#535862] group-hover:text-[#063def]">
                                  {client.clientName}
                                </h3>
                                <p className="text-sm text-[#8e8e93]">ดูผลการวิเคราะห์</p>
                              </div>
                            </div>
                            <ArrowRight className="h-5 w-5 text-[#8e8e93] group-hover:text-[#7f56d9] transition-colors" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-[#f1f5f9] rounded-full flex items-center justify-center mx-auto mb-4">
                        <div className="w-8 h-8 bg-[#e4e7ec] rounded-full"></div>
                      </div>
                      <p className="text-[#8e8e93] mb-2">ไม่พบลูกค้า</p>
                      <p className="text-sm text-[#8e8e93]">สร้างการวิเคราะห์ลูกค้าแรกของคุณ</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}