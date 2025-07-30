'use client'

import { useState, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ChevronDown, Plus, ArrowRight, Lightbulb, History, Clock, Sparkles } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { SessionHistory } from "@/components/session-history"
// import { cachedApiCall } from "@/lib/utils/cache"

type AppSidebarProps = {
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

export function AppSidebar({ activeClientId, activeClientName, activeProductFocus }: AppSidebarProps) {
  const [clients, setClients] = useState<ClientWithProductFocus[]>([])
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const currentPath = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const loadClients = async () => {
      try {
        // Temporarily using direct fetch - will add caching back later
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

  // Auto-select single product focus
  useEffect(() => {
    if (clients.length > 0 && activeClientName && activeClientName !== "No Client Selected" && !activeProductFocus) {
      const currentClient = clients.find(client => client.clientName === activeClientName)
      
      if (currentClient && currentClient.productFocuses.length === 1) {
        // Auto-select the only product focus
        const singleProductFocus = currentClient.productFocuses[0]
        const newUrl = `${currentPath}?clientId=${singleProductFocus.id}&productFocus=${encodeURIComponent(singleProductFocus.productFocus)}&clientName=${encodeURIComponent(activeClientName)}`
        router.replace(newUrl)
      }
    }
  }, [clients, activeClientName, activeProductFocus, currentPath, router])

  return (
    <div className="hidden border-r-2 border-gray-300 bg-white/80 backdrop-blur-sm md:flex md:flex-col shadow-lg shadow-gray-200/50">
      <div className="flex h-20 items-center border-b border-gray-200 px-6">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 text-lg font-semibold w-full justify-start">
              <Avatar className="h-6 w-6">
                <AvatarImage src="/placeholder-user.jpg" />
                <AvatarFallback>CC</AvatarFallback>
              </Avatar>
              {activeClientName?.split(' - ')[0] || activeClientName || "Select Client"}
              <ChevronDown className="ml-auto h-4 w-4 text-[#8e8e93]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="start" 
            className="max-h-[400px] overflow-y-auto w-60"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#cbd5e1 #f1f5f9'
            }}
          >
            {clients.map((client) => (
              <DropdownMenuItem key={client.id} asChild>
                <Link href={`${currentPath}?clientId=${client.productFocuses[0]?.id || client.id}&clientName=${encodeURIComponent(client.clientName)}`}>
                  {client.clientName}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem asChild>
              <Link href="/new-client">
                <Plus className="mr-2 h-4 w-4" />
                New Client
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex-1 overflow-auto py-4">
        {/* Show product focuses for current client */}
        {activeClientName && activeClientName !== "No Client Selected" && (
          <div className="px-4">
            {(() => {
              const currentClient = clients.find(client => client.clientName === activeClientName)
              const productFocuses = currentClient?.productFocuses || []
              const hasMultipleOptions = productFocuses.length > 1
              const hasNoSelection = !activeProductFocus && productFocuses.length > 0
              
              return (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-black">Product Focuses</h3>
                    {hasNoSelection && hasMultipleOptions && (
                      <div className="flex items-center text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded-full">
                        <Lightbulb className="w-3 h-3 mr-1" />
                        เลือกหนึ่งอัน
                      </div>
                    )}
                  </div>
                  
                  {hasNoSelection && hasMultipleOptions && (
                    <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <ArrowRight className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-gray-700">
                          <p className="font-medium mb-1">กรุณาเลือก Product Focus</p>
                          <p className="text-gray-600">เลือกผลิตภัณฑ์ที่ต้องการสร้างไอเดียด้านล่าง</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-1">
                    {productFocuses.map((pf) => (
                      <Link
                        key={pf.id}
                        href={`${currentPath}?clientId=${pf.id}&productFocus=${encodeURIComponent(pf.productFocus)}&clientName=${encodeURIComponent(activeClientName)}`}
                        className={`block px-3 py-2 rounded-md text-sm transition-all duration-200 relative ${
                          activeProductFocus === pf.productFocus
                            ? 'bg-black text-white shadow-sm'
                            : hasNoSelection && hasMultipleOptions
                            ? 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 border border-gray-200 hover:border-gray-300 animate-pulse hover:animate-none'
                            : 'text-[#8e8e93] hover:bg-[#f5f5f5] hover:text-black'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{pf.productFocus}</span>
                          {hasNoSelection && hasMultipleOptions && activeProductFocus !== pf.productFocus && (
                            <ArrowRight className="w-3 h-3 text-gray-500" />
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )
            })()}
          </div>
        )}
        
        {/* Session History Section */}
        {activeClientName && activeClientName !== "No Client Selected" && (
          <div className="px-4 mt-6">
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-medium text-black mb-3 flex items-center gap-2">
                <History className="w-4 h-4" />
                ประวัติการสร้างไอเดีย
              </h3>
              
              <Button
                variant="ghost"
                onClick={() => setHistoryModalOpen(true)}
                className="w-full justify-start text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 p-3 h-auto"
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center">
                    <Clock className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">ดูประวัติ</span>
                      <Sparkles className="w-3 h-3 text-amber-500" />
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      7 วันล่าสุด
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </div>
              </Button>
              
              <div className="mt-2 text-xs text-gray-500 px-3">
                <div className="flex items-center justify-between">
                  <span>เซสชันล่าสุด</span>
                  <span>จัดเก็บ 7 วัน</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Session History Modal */}
      <SessionHistory
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        activeClientName={activeClientName}
      />
    </div>
  )
}
