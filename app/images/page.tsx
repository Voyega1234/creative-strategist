"use client"

// Performance optimization for client-side rendering
import { useState, useEffect, useMemo, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Upload, Image as ImageIcon, Sparkles, Home, Bookmark } from "lucide-react"
import { useSearchParams, useRouter } from "next/navigation"
import { ImageUpload } from "@/components/image-upload"
import { AIImageGenerator } from "@/components/ai-image-generator"
import { LoadingPopup } from "@/components/loading-popup"
import { SavedIdeas } from "@/components/saved-ideas"
import { IdeaDetailModal } from "@/components/idea-detail-modal"
import { MainSidebar } from "@/components/main-sidebar"
import { RemixChatPanel } from "@/components/remix-chat-panel"

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
    // Don't auto-select first client - user must choose manually
    return null
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
    <div className="flex flex-col h-screen bg-white">
      <div className="flex flex-1 overflow-hidden">
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
        <main className="flex-1 flex flex-col bg-white overflow-hidden">
          <Tabs 
            defaultValue="reference-remix" 
            className="flex flex-col h-[calc(100vh-4rem)]"
          >
            <TabsList className="flex-shrink-0 grid w-full grid-cols-2 bg-[#f2f2f7] border-b border-[#d1d1d6] p-1 rounded-none h-12">
              <TabsTrigger 
                value="reference-remix" 
                className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm text-[#8e8e93] transition-all duration-200 py-4"
              >
                <ImageIcon className="w-4 h-4" />
                Compass Creator
              </TabsTrigger>
              <TabsTrigger 
                value="generate" 
                className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm text-[#8e8e93] transition-all duration-200 py-4"
              >
                <Sparkles className="w-4 h-4" />
                Generate / Upload (Compass Ideas)
              </TabsTrigger>
            </TabsList>

            {/* Generate and Upload Images Tab */}
            <TabsContent value="generate" className="flex-1 overflow-auto p-4">
              <div className="max-w-4xl mx-auto space-y-6">
                {/* AI Image Generation Section */}
                <Card className="border-2 border-[#d1d1d6] shadow-sm bg-white">
                  <div className="p-6">
                    <AIImageGenerator 
                      activeClientId={resolvedClientId}
                      activeProductFocus={resolvedProductFocus}
                      activeClientName={resolvedClientName}
                    />
                  </div>
                </Card>

                  {/* Upload Images Section */}
                  <Card className="border-2 border-[#d1d1d6] shadow-sm bg-white">
                    <div className="p-6">
                      <ImageUpload />
                    </div>
                  </Card>
                </div>
              </TabsContent>

              {/* Compass Creator Chat Tab */}
              <TabsContent value="reference-remix" className="flex-1 overflow-hidden p-0 m-0">
                <div className="h-full flex flex-col">
                  <RemixChatPanel
                    activeClientId={resolvedClientId}
                    activeProductFocus={resolvedProductFocus}
                    activeClientName={resolvedClientName}
                  />
                </div>
              </TabsContent>
            </Tabs>
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
