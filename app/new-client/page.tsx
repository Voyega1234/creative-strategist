"use client"

import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ArrowRight, ArrowLeft, HelpCircle } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { getClients } from "@/lib/data/clients"
import { useRouter } from "next/navigation"

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

  const handleCreateNewClient = async () => {
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

    setIsCreating(true)
    
    try {
      const response = await fetch('/api/competitor-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          ad_account_id: validatedAdAccountId
        }),
      })

      const result = await response.json()
      
      if (result.success) {
        const insightsStatus = result.strategicInsightsGenerated ? 
          "Competitor analysis and strategic insights completed successfully!" :
          "Competitor analysis completed successfully! (Strategic insights generation encountered an issue)"
        
        playNotificationSound()
        alert(insightsStatus)
        
        const destination = result.analysisRunId 
          ? `/configure?clientId=${result.analysisRunId}` 
          : `/configure`
        router.push(destination)
      } else {
        alert(`Failed to analyze competitors: ${result.error}`)
      }
    } catch (error) {
      console.error('Error calling Jina search API:', error)
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
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#7f56d9] to-[#6941c6] relative overflow-hidden">
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
              <div className="lg:hidden w-12 h-12 bg-[#e9d7fe] rounded-xl flex items-center justify-center mx-auto mb-3">
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
                  className="data-[state=active]:bg-[#e9d7fe] data-[state=active]:text-[#6941c6] data-[state=active]:shadow-sm rounded-md text-base font-medium py-3 text-[#535862] hover:text-[#6941c6] hover:bg-[#f5f5f5]"
                >
                  ลูกค้าใหม่
                </TabsTrigger>
                <TabsTrigger
                  value="select-client"
                  className="data-[state=active]:bg-[#e9d7fe] data-[state=active]:text-[#6941c6] data-[state=active]:shadow-sm rounded-md text-base font-medium py-3 text-[#535862] hover:text-[#6941c6] hover:bg-[#f5f5f5]"
                >
                  เลือกลูกค้า
                </TabsTrigger>
              </TabsList>

              <TabsContent value="new-client">
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
                        className="w-full h-12 bg-[#7f56d9] text-white hover:bg-[#6941c6] text-base font-medium transition-all duration-300 shadow-sm disabled:opacity-75 relative overflow-hidden group"
                        onClick={handleCreateNewClient}
                        disabled={isCreating}
                      >
                        {isCreating ? (
                          <>
                            <div className="flex items-center justify-center">
                              {/* Animated dots */}
                              <div className="flex space-x-1 mr-3">
                                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                              </div>
                              <span className="animate-pulse">กำลังประมวลผล</span>
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
                          <div className="flex items-center justify-between p-4 border border-[#e4e7ec] rounded-lg hover:border-[#7f56d9] hover:bg-[#f8f6ff] transition-all duration-200 cursor-pointer">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-[#e9d7fe] rounded-lg flex items-center justify-center group-hover:bg-[#7f56d9] transition-colors">
                                <div className="w-5 h-5 bg-[#7f56d9] rounded-sm group-hover:bg-white transition-colors"></div>
                              </div>
                              <div>
                                <h3 className="font-medium text-[#535862] group-hover:text-[#6941c6]">
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