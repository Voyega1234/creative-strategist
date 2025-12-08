"use client"

// Performance optimization for client-side rendering
import { useState, useEffect, useMemo, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Upload, Image as ImageIcon, Sparkles, Images, Home, Bookmark } from "lucide-react"
import { useSearchParams, useRouter } from "next/navigation"
import { ImageUpload } from "@/components/image-upload"
import { ReferenceImageSearch } from "@/components/reference-image-search"
import { AIImageGenerator } from "@/components/ai-image-generator"
import { LoadingPopup } from "@/components/loading-popup"
import { SavedIdeas } from "@/components/saved-ideas"
import { IdeaDetailModal } from "@/components/idea-detail-modal"
import { MainSidebar } from "@/components/main-sidebar"
import { ReferenceRemixPanel } from "@/components/reference-remix-panel"

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
  const [isNavigatingToHome, setIsNavigatingToHome] = useState(false)
  const [isNavigatingToNewClient, setIsNavigatingToNewClient] = useState(false)
  
  // Saved Ideas modal state
  const [savedIdeasOpen, setSavedIdeasOpen] = useState(false)
  const [selectedDetailIdea, setSelectedDetailIdea] = useState<any>(null)
  
  // Get URL parameters
  const activeProductFocusParam = searchParams.get('productFocus') || null
  const activeClientNameParam = searchParams.get('clientName') || "No Client Selected"
  const activeClientIdParam = searchParams.get('clientId')
  
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

  const activeClientRecord = useMemo(() => {
    if (clients.length === 0) return null
    if (activeClientIdParam) {
      const byProductFocus = clients.find((client) =>
        client.productFocuses.some((pf) => pf.id === activeClientIdParam),
      )
      if (byProductFocus) return byProductFocus
      const byClientId = clients.find((client) => client.id === activeClientIdParam)
      if (byClientId) return byClientId
    }
    if (activeClientNameParam && activeClientNameParam !== "No Client Selected") {
      const byName = clients.find((client) => client.clientName === activeClientNameParam)
      if (byName) return byName
    }
    return clients[0] || null
  }, [clients, activeClientIdParam, activeClientNameParam])

  const resolvedClientName =
    (activeClientNameParam && activeClientNameParam !== "No Client Selected"
      ? activeClientNameParam
      : activeClientRecord?.clientName) || "No Client Selected"

  const resolvedProductFocus =
    activeProductFocusParam || activeClientRecord?.productFocuses[0]?.productFocus || null

  const resolvedClientId = activeClientRecord?.id || null

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
      let homeUrl = "/"
      if (resolvedClientName && resolvedClientName !== "No Client Selected" && resolvedClientId) {
        const targetFocus = activeClientRecord?.productFocuses.find(
          (pf) => pf.productFocus === resolvedProductFocus,
        )
        const params = new URLSearchParams()
        params.set("clientId", targetFocus?.id || resolvedClientId)
        params.set("clientName", resolvedClientName)
        if (resolvedProductFocus) {
          params.set("productFocus", resolvedProductFocus)
        }
        homeUrl = `/?${params.toString()}`
      }
      
      router.push(homeUrl)
    } catch (error) {
      setIsNavigatingToHome(false)
    }
  }

  const handleViewSavedIdeas = () => {
    if (
      !resolvedClientName ||
      resolvedClientName === "No Client Selected" ||
      !resolvedProductFocus
    ) {
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
        <MainSidebar
          clients={clients}
          activeClientName={resolvedClientName}
          activeProductFocus={resolvedProductFocus}
          activeClientId={resolvedClientId}
          showHistory={false}
          showServiceFilters={false}
          mode="images"
        />

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
              <TabsList className="grid w-full grid-cols-3 bg-[#f2f2f7] border border-[#d1d1d6] p-1 rounded-xl">
                <TabsTrigger value="reference-search" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm text-[#8e8e93] transition-all duration-200">
                  <Images className="w-4 h-4" />
                  Reference Search
                </TabsTrigger>
                <TabsTrigger value="generate" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm text-[#8e8e93] transition-all duration-200">
                  <Sparkles className="w-4 h-4" />
                  Generate / Upload (Compass Ideas)
                </TabsTrigger>
                <TabsTrigger value="reference-remix" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm text-[#8e8e93] transition-all duration-200">
                  <ImageIcon className="w-4 h-4" />
                  Remix From Reference
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
                    activeClientId={resolvedClientId}
                    activeProductFocus={resolvedProductFocus}
                    activeClientName={resolvedClientName}
                  />
                </Card>
              </TabsContent>

              {/* Generate and Upload Images Tab */}
              <TabsContent value="generate" className="space-y-6">
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
                    activeClientId={resolvedClientId}
                    activeProductFocus={resolvedProductFocus}
                    activeClientName={resolvedClientName}
                  />
                </Card>

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
              </TabsContent>

              {/* Direct Reference Remix Tab */}
              <TabsContent value="reference-remix" className="space-y-6">
                <ReferenceRemixPanel 
                  activeClientId={resolvedClientId}
                  activeProductFocus={resolvedProductFocus}
                  activeClientName={resolvedClientName}
                />
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

      {/* Saved Ideas Modal */}
      <SavedIdeas 
        isOpen={savedIdeasOpen}
        onClose={() => setSavedIdeasOpen(false)}
        activeClientName={resolvedClientName !== "No Client Selected" ? resolvedClientName : undefined}
        activeProductFocus={resolvedProductFocus || undefined}
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
