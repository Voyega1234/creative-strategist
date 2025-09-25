"use client"

// Performance optimization for client-side rendering
import Link from "next/link"
import { useState, useEffect, Suspense } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronUp, Plus, User, Bookmark, Settings, Upload, Image as ImageIcon, Sparkles, Images, Home } from "lucide-react"
import { useSearchParams, useRouter } from "next/navigation"
import { ImageUpload } from "@/components/image-upload"
import { ReferenceImageSearch } from "@/components/reference-image-search"
import { AIImageGenerator } from "@/components/ai-image-generator"
import { LoadingPopup } from "@/components/loading-popup"
import { SavedIdeas } from "@/components/saved-ideas"
import { IdeaDetailModal } from "@/components/idea-detail-modal"

type ClientWithProductFocus = {
  id: string
  clientName: string
  productFocuses: Array<{
    id: string
    productFocus: string
  }>
}

// Client component that uses useSearchParams
function MainContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [clients, setClients] = useState<ClientWithProductFocus[]>([])
  const [isBrandOpen, setIsBrandOpen] = useState(true)
  const [isNavigatingToConfigure, setIsNavigatingToConfigure] = useState(false)
  const [isNavigatingToHome, setIsNavigatingToHome] = useState(false)
  const [isNavigatingToNewClient, setIsNavigatingToNewClient] = useState(false)
  
  // Saved Ideas modal state
  const [savedIdeasOpen, setSavedIdeasOpen] = useState(false)
  const [selectedDetailIdea, setSelectedDetailIdea] = useState<any>(null)
  
  // Get URL parameters
  const activeProductFocus = searchParams.get('productFocus') || null
  const activeClientName = searchParams.get('clientName') || "No Client Selected"
  
  useEffect(() => {
    loadClients()
  }, [])

  const loadClients = async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      const response = await fetch(`${baseUrl}/api/clients-with-product-focus`)
      const clientsData = await response.json()
      if (Array.isArray(clientsData)) {
        setClients(clientsData)
      }
    } catch (error) {
      console.error('Error loading clients:', error)
    }
  }

  const handleConfigureNavigation = async () => {
    if (!activeClientName || activeClientName === "No Client Selected") {
      alert('กรุณาเลือกลูกค้าก่อนเข้าสู่หน้าตั้งค่า')
      return
    }
    
    const selectedClient = clients.find(c => c.clientName === activeClientName)
    if (!selectedClient) {
      alert('ไม่พบข้อมูลลูกค้าที่เลือก')
      return
    }

    const productFocusId = selectedClient.productFocuses.find(pf => pf.productFocus === activeProductFocus)?.id
    if (!productFocusId) {
      alert('ไม่พบ Product Focus ที่เลือก')
      return
    }

    setIsNavigatingToConfigure(true)
    
    try {
      router.push(`/configure?clientId=${productFocusId}`)
    } catch (error) {
      setIsNavigatingToConfigure(false)
    }
  }

  const handleNewClientNavigation = async () => {
    setIsNavigatingToNewClient(true)
    try {
      router.push('/new-client')
    } catch (error) {
      setIsNavigatingToNewClient(false)
    }
  }

  const handleHomeNavigation = async () => {
    setIsNavigatingToHome(true)
    
    try {
      const homeUrl = activeClientName && activeClientName !== "No Client Selected" 
        ? `/?clientId=${clients.find(c => c.clientName === activeClientName)?.productFocuses?.find(pf => pf.productFocus === activeProductFocus)?.id || clients.find(c => c.clientName === activeClientName)?.id}&clientName=${encodeURIComponent(activeClientName)}${activeProductFocus ? `&productFocus=${encodeURIComponent(activeProductFocus)}` : ''}`
        : '/'
      
      router.push(homeUrl)
    } catch (error) {
      setIsNavigatingToHome(false)
    }
  }

  const handleViewSavedIdeas = () => {
    if (!activeClientName || activeClientName === "No Client Selected" || !activeProductFocus) {
      alert('กรุณาเลือกลูกค้าและ Product Focus ก่อน')
      return
    }
    setSavedIdeasOpen(true)
  }

  const handleViewDetails = (idea: any, savedId: string) => {
    setSelectedDetailIdea(idea)
  }

  const handleCloseDetail = () => {
    setSelectedDetailIdea(null)
  }

  return (
    <div className="flex min-h-screen bg-white relative">
      <div className="flex w-full relative z-10">
        {/* Sidebar */}
        <aside className="w-64 bg-white/90 backdrop-blur-sm p-6 border-r border-[#e4e7ec] flex flex-col justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[#000000] mb-8">Creative Strategist</h1>
            <nav className="space-y-2">
              <Collapsible open={isBrandOpen} onOpenChange={setIsBrandOpen} className="w-full">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]"
                  >
                    <User className="mr-2 h-4 w-4" />
                    แบรนด์
                    <ChevronUp
                      className={`ml-auto h-4 w-4 transition-transform ${isBrandOpen ? "rotate-0" : "rotate-180"}`}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 pl-8 pt-2">
                  <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                    {(() => {
                      // Reorder clients: selected client first, then others
                      const activeClient = clients.find(client => client.clientName === activeClientName)
                      const otherClients = clients.filter(client => client.clientName !== activeClientName)
                      const reorderedClients = activeClient ? [activeClient, ...otherClients] : clients
                      
                      return reorderedClients.map((client) => (
                        <div key={client.id} className="space-y-1">
                          {/* Client name - always show, highlight if active */}
                          <Link
                            href={`/images?clientId=${client.productFocuses[0]?.id || client.id}&clientName=${encodeURIComponent(client.clientName)}&productFocus=${encodeURIComponent(client.productFocuses[0]?.productFocus || '')}`}
                            className={`block text-sm py-1 px-2 rounded-md font-medium ${
                              client.clientName === activeClientName
                                ? 'text-[#063def] bg-[#dbeafe]'
                                : 'text-[#535862] hover:text-[#063def] hover:bg-[#dbeafe]'
                            }`}
                          >
                            {client.clientName}
                          </Link>
                          
                          {/* Show product focuses ONLY for the selected/active client */}
                          {client.clientName === activeClientName && client.productFocuses.length >= 1 && (
                            <div className="ml-4 space-y-1 mb-2">
                              {client.productFocuses.map((pf) => (
                                <Link
                                  key={pf.id}
                                  href={`/images?clientId=${pf.id}&productFocus=${encodeURIComponent(pf.productFocus)}&clientName=${encodeURIComponent(activeClientName)}`}
                                  className={`block text-xs py-1 px-2 rounded-md ${
                                    activeProductFocus === pf.productFocus
                                      ? 'text-[#063def] bg-[#dbeafe] font-medium'
                                      : 'text-[#535862] hover:text-[#063def] hover:bg-[#dbeafe]'
                                  }`}
                                >
                                  {pf.productFocus}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    })()}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </nav>
            <div className="my-4 border-t border-[#e4e7ec]" />
            <nav className="space-y-2">
              <Button
                onClick={handleHomeNavigation}
                variant="ghost"
                className="w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]"
                disabled={isNavigatingToHome}
              >
                <Home className="mr-2 h-4 w-4" />
                กลับหน้าหลัก
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-[#063def] bg-[#dbeafe] hover:bg-[#dbeafe] hover:text-[#063def]"
                disabled
              >
                <Images className="mr-2 h-4 w-4" />
                ค้นและสร้างภาพ
              </Button>
            </nav>
          </div>
          <div className="border-t border-[#e4e7ec] mt-4 pt-4">
            <div className="flex items-center space-x-3 p-2 mb-2">
              <Avatar className="h-8 w-8 bg-[#1d4ed8] text-[#ffffff] font-bold">
                <AvatarFallback>A</AvatarFallback>
              </Avatar>
              <span className="text-[#000000] font-medium">Admin</span>
            </div>
            <Button
              onClick={handleConfigureNavigation}
              variant="ghost"
              className="w-full justify-start text-[#063def] hover:bg-[#f5f5f5] hover:text-[#1d4ed8] mb-2"
              disabled={isNavigatingToConfigure}
            >
              <Settings className="mr-2 h-4 w-4" />
              ตั้งค่าและวิเคราะห์
            </Button>
            <Button
              onClick={handleViewSavedIdeas}
              variant="ghost"
              className="w-full justify-start text-[#8e8e93] hover:bg-[#f5f5f5] hover:text-red-600 text-sm"
            >
              <Bookmark className="mr-2 h-4 w-4" />
              รายการที่บันทึก
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 flex flex-col min-h-screen bg-transparent overflow-y-auto">
          <div className="w-full flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end mb-6">
            <Button
              onClick={handleNewClientNavigation}
              size="sm"
              variant="outline"
              className="text-xs text-[#063def] border-[#d1d5db] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]"
              disabled={isNavigatingToNewClient}
            >
              <Plus className="mr-2 h-3 w-3" />
              เพิ่มรายชื่อ
            </Button>
            <Button
              onClick={handleViewSavedIdeas}
              size="sm"
              variant="outline"
              className="text-xs text-[#063def] border-[#d1d5db] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]"
            >
              <Bookmark className="mr-2 h-3 w-3" />
              รายการที่บันทึก
            </Button>
            <Button
              onClick={handleHomeNavigation}
              size="sm"
              variant="outline"
              className="text-xs text-[#063def] border-[#d1d5db] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]"
              disabled={isNavigatingToHome}
            >
              <Home className="mr-2 h-3 w-3" />
              กลับหน้าหลัก
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header Section */}
            <div className="flex items-center justify-between border-b border-[#d1d1d6] pb-6">
              <div>
                <h1 className="text-2xl font-bold text-black flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                    <ImageIcon className="w-5 h-5 text-white" />
                  </div>
                  ค้นหาและสร้างภาพที่ใช่สำหรับไอเดียคุณ
                </h1>
                <p className="text-[#8e8e93] mt-2 text-lg">จัดการ ค้นหา และสร้างตัวอย่างรูปภาพโฆษณาสำหรับแคมเปญ</p>
              </div>
            </div>

            {/* Main Content Tabs */}
            <Tabs defaultValue="reference-search" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2 bg-[#f2f2f7] border border-[#d1d1d6] p-1 rounded-xl">
                <TabsTrigger value="reference-search" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm text-[#8e8e93] transition-all duration-200">
                  <Images className="w-4 h-4" />
                  ค้นหารูปภาพอ้างอิง
                </TabsTrigger>
                <TabsTrigger value="generate" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm text-[#8e8e93] transition-all duration-200">
                  <Sparkles className="w-4 h-4" />
                  สร้างภาพและอัปโหลด
                </TabsTrigger>
              </TabsList>


              {/* Reference Search Tab */}
              <TabsContent value="reference-search" className="space-y-6">
                <Card className="p-6 border-2 border-[#d1d1d6] shadow-sm bg-white">
                  <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-black flex items-center gap-3">
                        <Images className="w-6 h-6 text-[#1d4ed8]" />
                        ค้นหารูปภาพอ้างอิง
                      </h2>
                      <p className="text-[#8e8e93] text-sm mt-1">ค้นหาและเก็บภาพอ้างอิงจาก Pinterest หรือ Facebook</p>
                    </div>
                  </div>
                  
                  <ReferenceImageSearch 
                    activeClientId={clients.find(c => c.clientName === activeClientName)?.id || null}
                    activeProductFocus={activeProductFocus}
                    activeClientName={activeClientName}
                  />
                </Card>
              </TabsContent>

              {/* Generate and Upload Images Tab */}
              <TabsContent value="generate" className="space-y-6">
                {/* Upload Images Section */}
                <Card className="p-6 border-2 border-[#d1d1d6] shadow-sm bg-white">
                  <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-black flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                          <Upload className="w-5 h-5 text-white" />
                        </div>
                        อัปโหลดรูปภาพอ้างอิง
                      </h2>
                      <p className="text-[#8e8e93] text-sm mt-1">เพิ่มรูปภาพโฆษณาใหม่เข้าสู่คลัง</p>
                    </div>
                  </div>
                  
                  <ImageUpload />
                </Card>
                
                {/* AI Image Generation Section */}
                <Card className="p-6 border-2 border-[#d1d1d6] shadow-sm bg-white">
                  <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-black flex items-center gap-3">
                        <Sparkles className="w-6 h-6 text-[#1d4ed8]" />
                        สร้างภาพด้วย AI
                      </h2>
                      <p className="text-[#8e8e93] text-sm mt-1">สร้างภาพใหม่ด้วยเทคโนโลยี AI ผ่าน N8N</p>
                    </div>
                  </div>
                  
                  <AIImageGenerator 
                    activeClientId={clients.find(c => c.clientName === activeClientName)?.id || null}
                    activeProductFocus={activeProductFocus}
                    activeClientName={activeClientName}
                  />
                </Card>
              </TabsContent>
            </Tabs>
          </div>
          </div>
        </main>
      </div>

      {/* Loading Popups */}
      <LoadingPopup
        isOpen={isNavigatingToHome}
        message="กลับสู่หน้าหลัก กำลังเตรียมข้อมูลสำหรับคุณ..."
      />
      
      <LoadingPopup
        isOpen={isNavigatingToConfigure}
        message="กำลังโหลดหน้าตั้งค่าและวิเคราะห์"
      />

      {/* Saved Ideas Modal */}
      <SavedIdeas 
        isOpen={savedIdeasOpen}
        onClose={() => setSavedIdeasOpen(false)}
        activeClientName={activeClientName || undefined}
        activeProductFocus={activeProductFocus || undefined}
        onViewDetails={handleViewDetails}
      />

      {/* Idea Detail Modal */}
      {selectedDetailIdea && (
        <IdeaDetailModal
          isOpen={true}
          onClose={handleCloseDetail}
          idea={selectedDetailIdea}
        />
      )}
    </div>
  )
}

export default function ImagesPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen bg-white" />}>
      <MainContent />
    </Suspense>
  )
}
