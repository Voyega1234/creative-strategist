'use client'

import { useState, useEffect } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronUp, Plus, User, ArrowLeft, Settings, Images } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LoadingPopup } from "@/components/loading-popup"

type ConfigureSidebarProps = {
  activeClientId: string | null
  activeClientName: string | null
  activeProductFocus: string | null
}

type ClientWithProductFocus = {
  id: string
  clientName: string
  productFocuses: Array<{
    id: string
    productFocus: string
  }>
}

export function ConfigureSidebar({ activeClientId, activeClientName, activeProductFocus }: ConfigureSidebarProps) {
  const router = useRouter()
  const [clients, setClients] = useState<ClientWithProductFocus[]>([])
  const [isBrandOpen, setIsBrandOpen] = useState(true)
  const [isNavigatingToMain, setIsNavigatingToMain] = useState(false)

  useEffect(() => {
    const loadClients = async () => {
      try {
        const response = await fetch('/api/clients-with-product-focus')
        if (response.ok) {
          const clientsData = await response.json()
          setClients(clientsData)
        }
      } catch (error) {
        console.error('Error loading clients:', error)
      }
    }
    loadClients()
  }, [])

  const handleBackToMain = () => {
    setIsNavigatingToMain(true)
    
    // Build main page URL with current client parameters
    const mainUrl = `/${activeClientName && activeClientName !== "No Client Selected" 
      ? `?clientName=${encodeURIComponent(activeClientName)}${activeProductFocus ? `&productFocus=${encodeURIComponent(activeProductFocus)}` : ''}` 
      : ''}`
    
    // Small delay to show loading, then navigate
    setTimeout(() => {
      router.push(mainUrl)
    }, 500)
  }

  return (
    <>
      <aside className="w-64 bg-white/90 backdrop-blur-sm p-6 border-r border-white/20 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-lg font-semibold text-[#000000]">Creative Strategist</h1>
          </div>
          
          {/* Back to Main Button */}
          <div className="mb-6">
            <Button
              onClick={handleBackToMain}
              variant="ghost"
              className="w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]"
              disabled={isNavigatingToMain}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              กลับหน้าหลัก
            </Button>
          </div>

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
                        <button
                          onClick={() => {
                            const url = `/configure?clientId=${client.productFocuses[0]?.id || client.id}&clientName=${encodeURIComponent(client.clientName)}&productFocus=${encodeURIComponent(client.productFocuses[0]?.productFocus || '')}`
                            window.location.href = url
                          }}
                          className={`block w-full text-left text-sm py-1 px-2 rounded-md font-medium ${
                            client.clientName === activeClientName
                              ? 'text-[#063def] bg-[#dbeafe]'
                              : 'text-[#535862] hover:text-[#063def] hover:bg-[#dbeafe]'
                          }`}
                        >
                          {client.clientName}
                        </button>
                        
                        {/* Show product focuses ONLY for the selected/active client */}
                        {client.clientName === activeClientName && client.productFocuses.length >= 1 && (
                          <div className="ml-4 space-y-1 mb-2">
                            {client.productFocuses.map((pf) => (
                              <button
                                key={pf.id}
                                onClick={() => {
                                  const url = `/configure?clientId=${pf.id}&productFocus=${encodeURIComponent(pf.productFocus)}&clientName=${encodeURIComponent(activeClientName)}`
                                  window.location.href = url
                                }}
                                className={`block w-full text-left text-xs py-1 px-2 rounded-md ${
                                  activeProductFocus === pf.productFocus
                                    ? 'text-[#063def] bg-[#dbeafe] font-medium'
                                    : 'text-[#535862] hover:text-[#063def] hover:bg-[#dbeafe]'
                                }`}
                              >
                                {pf.productFocus}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  })()}
                </div>
              </CollapsibleContent>
            </Collapsible>
            <Link href="/new-client">
              <Button
                variant="ghost"
                className="w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]"
              >
                <Plus className="mr-2 h-4 w-4" />
                เพิ่มรายชื่อ
              </Button>
            </Link>
          </nav>
          <div className="my-4 border-t border-[#e4e7ec]" />
          <nav className="space-y-2">
            <Link href={`/images${activeClientName && activeClientName !== "No Client Selected" 
              ? `?clientName=${encodeURIComponent(activeClientName)}${activeProductFocus ? `&productFocus=${encodeURIComponent(activeProductFocus)}` : ''}` 
              : ''}`}>
              <Button
                variant="ghost"
                className="w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]"
              >
                <Images className="mr-2 h-4 w-4" />
                ค้นหารูปภาพ Pinterest
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="w-full justify-start text-[#063def] bg-[#dbeafe] hover:bg-[#dbeafe] hover:text-[#063def]"
            >
              <Settings className="mr-2 h-4 w-4" />
              ตั้งค่าและวิเคราะห์
            </Button>
          </nav>
        </div>
        <div className="flex items-center space-x-3 p-2 border-t border-[#e4e7ec] mt-4">
          <Avatar className="h-8 w-8 bg-[#1d4ed8] text-[#ffffff] font-bold">
            <AvatarFallback>A</AvatarFallback>
          </Avatar>
          <span className="text-[#000000] font-medium">Admin</span>
        </div>
      </aside>

      <LoadingPopup
        isOpen={isNavigatingToMain}
        message="กำลังกลับสู่หน้าหลัก"
      />
    </>
  )
}