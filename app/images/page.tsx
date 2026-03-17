"use client"

// Performance optimization for client-side rendering
import { useState, useEffect, useMemo, Suspense } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Image as ImageIcon, PanelLeftClose, PanelLeftOpen, Sparkles } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { AIImageGenerator } from "@/components/ai-image-generator"
import { Button } from "@/components/ui/button"
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
  const [clients, setClients] = useState<ClientWithProductFocus[]>([])
  const [isSidebarHidden, setIsSidebarHidden] = useState(false)
  
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

  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {!isSidebarHidden && (
          <MainSidebar
            clients={clients}
            activeClientName={resolvedClientName}
            activeProductFocus={resolvedProductFocus}
            activeClientId={resolvedClientId}
            showHistory={false}
            showServiceFilters={false}
            mode="images"
          />
        )}

        {/* Main Content */}
        <main className="flex min-h-0 flex-1 flex-col bg-white overflow-hidden">
          <Tabs 
            defaultValue="reference-remix" 
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex flex-none items-center gap-3 border-b border-[#d1d1d6] bg-white px-4 py-3 lg:px-6">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsSidebarHidden((value) => !value)}
                className="h-10 w-10 rounded-full border-slate-200"
              >
                {isSidebarHidden ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                <span className="sr-only">{isSidebarHidden ? "Show sidebar" : "Hide sidebar"}</span>
              </Button>

              <TabsList className="grid h-11 flex-1 grid-cols-2 rounded-full bg-[#f2f2f7] p-1">
                <TabsTrigger 
                  value="reference-remix" 
                  className="flex items-center gap-2 rounded-full data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm text-[#8e8e93] transition-all duration-200"
                >
                  <ImageIcon className="w-4 h-4" />
                  Compass Creator
                </TabsTrigger>
                <TabsTrigger 
                  value="generate" 
                  className="flex items-center gap-2 rounded-full data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm text-[#8e8e93] transition-all duration-200"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate / Upload (Compass Ideas)
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Generate and Upload Images Tab */}
            <TabsContent value="generate" className="mt-0 min-h-0 flex-1 overflow-y-auto bg-slate-50/60 px-4 py-6 lg:px-6">
              <div className="mx-auto max-w-[1480px]">
                <AIImageGenerator
                  activeClientId={resolvedClientId}
                  activeProductFocus={resolvedProductFocus}
                  activeClientName={resolvedClientName}
                />
              </div>
            </TabsContent>

              {/* Compass Creator Chat Tab */}
              <TabsContent value="reference-remix" className="m-0 min-h-0 flex-1 overflow-hidden p-0">
                <div className="flex h-full min-h-0 flex-col">
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
