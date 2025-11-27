"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronUp, Plus, User, Bookmark, Settings, History, Images, Lock, Home } from "lucide-react"
import { SavedIdeas } from "./saved-ideas"

type ClientWithProductFocus = {
  id: string
  clientName: string
  productFocuses: Array<{
    id: string
    productFocus: string
  }>
}

interface MainSidebarProps {
  clients: ClientWithProductFocus[]
  activeClientName: string
  activeProductFocus: string | null
  activeClientId: string | null
  activeClientServices?: string[]
  activeServiceFilter?: string | null
  showSecondaryNav?: boolean
  showHistory?: boolean
}

const ALL_SERVICES_VALUE = "__all_services__"

export function MainSidebar({ 
  clients, 
  activeClientName, 
  activeProductFocus, 
  activeClientId,
  activeClientServices = [],
  activeServiceFilter = null,
  showSecondaryNav = true,
  showHistory = true,
}: MainSidebarProps) {
  const router = useRouter()
  const [isBrandOpen, setIsBrandOpen] = useState(true)
  const [isHistoryOpen, setIsHistoryOpen] = useState(true)
  const [savedIdeasModalOpen, setSavedIdeasModalOpen] = useState(false)
  const [clientSearch, setClientSearch] = useState("")
  const normalizedQuery = clientSearch.trim().toLowerCase()
  const filteredClients = useMemo(() => {
    if (!normalizedQuery) {
      return clients
    }
    return clients.filter((client) => client.clientName.toLowerCase().includes(normalizedQuery))
  }, [clients, normalizedQuery])
  const hasClientResults = filteredClients.length > 0


  const handleNewClientNavigation = () => {
    router.push('/new-client')
  }

  const handleImagesNavigation = () => {
    const imagesUrl = `/images${activeClientName && activeClientName !== "No Client Selected" 
      ? `?clientName=${encodeURIComponent(activeClientName)}${activeProductFocus ? `&productFocus=${encodeURIComponent(activeProductFocus)}` : ''}` 
      : ''}`
    router.push(imagesUrl)
  }

  const handleMainNavigation = () => {
    const mainUrl = `/${activeClientName && activeClientName !== "No Client Selected" 
      ? `?clientName=${encodeURIComponent(activeClientName)}${activeProductFocus ? `&productFocus=${encodeURIComponent(activeProductFocus)}` : ''}` 
      : ''}`
    router.push(mainUrl)
  }

  const handleConfigureNavigation = () => {
    const configureUrl = `/configure${activeClientId ? `?clientId=${encodeURIComponent(activeClientId)}${activeClientName ? `&clientName=${encodeURIComponent(activeClientName)}` : ''}${activeProductFocus ? `&productFocus=${encodeURIComponent(activeProductFocus)}` : ''}` : ''}`
    router.push(configureUrl)
  }

  const handleProductFocusChange = (clientName: string, productFocus: string) => {
    const client = clients.find(c => c.clientName === clientName)
    const clientId = client?.id
    router.push(`/configure?clientId=${clientId}&clientName=${encodeURIComponent(clientName)}&productFocus=${encodeURIComponent(productFocus)}`)
  }

  const handleServiceFilterChange = (value: string) => {
    if (!activeClientId) {
      return
    }

    const params = new URLSearchParams()
    params.set("clientId", activeClientId)
    if (activeClientName && activeClientName !== "No Client Selected") {
      params.set("clientName", activeClientName)
    }
    if (activeProductFocus) {
      params.set("productFocus", activeProductFocus)
    }
    if (value && value !== ALL_SERVICES_VALUE) {
      params.set("serviceFilter", value)
    }
    params.set("page", "1")
    router.push(`/configure?${params.toString()}`)
  }

  const resolvedServiceFilterValue =
    activeServiceFilter &&
    activeServiceFilter !== "All Competitors" &&
    activeClientServices.includes(activeServiceFilter)
      ? activeServiceFilter
      : ALL_SERVICES_VALUE

  const handleLogout = () => {
    // Add logout logic here
  }

  return (
    <aside className="w-64 h-screen bg-white/90 backdrop-blur-sm p-6 border-r border-[#e4e7ec] flex flex-col overflow-hidden">
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto pr-2">
          <div className="flex items-center gap-2 mb-8">
            <Button
              onClick={handleMainNavigation}
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-[#535862] hover:text-[#1d4ed8] hover:bg-[#f5f5f5]"
            >
              <Home className="h-4 w-4" />
              <span className="sr-only">กลับหน้าหลัก</span>
            </Button>
            <h1 className="text-lg font-semibold text-[#000000]">Creative Compass</h1>
          </div>
          <nav className="space-y-2">
            <Button
              onClick={handleNewClientNavigation}
              variant="ghost"
              className="mb-4 w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]"
            >
              <Plus className="mr-2 h-4 w-4" />
              เพิ่มรายชื่อ
            </Button>
            <Input
              type="search"
              value={clientSearch}
              onChange={(event) => setClientSearch(event.target.value)}
              placeholder="ค้นหาชื่อลูกค้า"
              className="mb-4 h-9 text-sm border-[#e4e7ec] focus-visible:ring-0 focus-visible:border-[#1d4ed8]"
            />
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
                  {hasClientResults ? (
                    filteredClients.map((client) => (
                      <div key={client.id} className="space-y-1">
                        {/* Client name - always show, highlight if active */}
                        <Link
                          href={`/configure?clientId=${client.id}&clientName=${encodeURIComponent(client.clientName)}&productFocus=${encodeURIComponent(client.productFocuses[0]?.productFocus || '')}`}
                          className={`block text-sm py-1 px-2 rounded-md font-medium ${
                            client.clientName === activeClientName
                              ? 'text-[#063def] bg-[#dbeafe]'
                              : 'text-[#535862] hover:text-[#063def] hover:bg-[#dbeafe]'
                          }`}
                        >
                          {client.clientName}
                        </Link>
                        
                        {/* Show product focus select ONLY for the selected/active client */}
                        {client.clientName === activeClientName && client.productFocuses.length >= 1 && (
                          <>
                            <div className="ml-4 mt-2 mb-2">
                              <Select
                                value={activeProductFocus || ""}
                                onValueChange={(value) => handleProductFocusChange(client.clientName, value)}
                              >
                                <SelectTrigger className="w-full h-8 text-xs bg-white border-[#e4e7ec] hover:border-[#1d4ed8] focus:border-[#1d4ed8]">
                                  <SelectValue placeholder="เลือก Product Focus" />
                                </SelectTrigger>
                                <SelectContent>
                                  {client.productFocuses.map((pf) => (
                                    <SelectItem key={pf.id} value={pf.productFocus} className="text-xs">
                                      {pf.productFocus}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="ml-4 mt-3 mb-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8e8e93] mb-2">
                                Services
                              </p>
                              {activeClientServices.length > 0 ? (
                                <Select
                                  value={resolvedServiceFilterValue}
                                  onValueChange={handleServiceFilterChange}
                                  disabled={!activeClientId}
                                >
                                  <SelectTrigger className="w-full h-8 text-xs bg-white border-[#e4e7ec] hover:border-[#1d4ed8] focus:border-[#1d4ed8]">
                                    <SelectValue placeholder="Services" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={ALL_SERVICES_VALUE} className="text-xs">
                                      All Services
                                    </SelectItem>
                                    {activeClientServices.map((service) => (
                                      <SelectItem key={service} value={service} className="text-xs">
                                        {service}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="text-xs text-[#8e8e93]">ไม่มีข้อมูลบริการ</div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-[#8e8e93] p-2">ไม่พบลูกค้าตามการค้นหา</div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </nav>
          <div className="my-4 border-t border-[#e4e7ec]" />
          <nav className="space-y-2 pb-2">
            {showSecondaryNav && (
              <>
                <Button
                  onClick={handleMainNavigation}
                  variant="ghost"
                  className="w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  หน้าหลัก
                </Button>
                <Button
                  onClick={() => setSavedIdeasModalOpen(true)}
                  variant="ghost"
                  className="w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]"
                >
                  <Bookmark className="mr-2 h-4 w-4" />
                  รายการที่บันทึก
                </Button>
                <Button
                  onClick={handleImagesNavigation}
                  variant="ghost"
                  className="w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]"
                >
                  <Images className="mr-2 h-4 w-4" />
                  ค้นและสร้างภาพ
                </Button>
              </>
            )}
            {showHistory && (
              <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen} className="w-full">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]"
                  >
                    <History className="mr-2 h-4 w-4" />
                    ประวัติการสร้าง
                    <ChevronUp
                      className={`ml-auto h-4 w-4 transition-transform ${isHistoryOpen ? "rotate-0" : "rotate-180"}`}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 pl-8 pt-2">
                  <div className="text-[#535862] text-xs p-2 bg-white/70 rounded-md border border-[#e4e7ec]">
                    {activeClientName && activeClientName !== "No Client Selected"
                      ? "ยังไม่มีประวัติการสร้างไอเดีย"
                      : "เลือกลูกค้าเพื่อดูประวัติ"}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
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
          >
            <Settings className="mr-2 h-4 w-4" />
            ตั้งค่าและวิเคราะห์
          </Button>
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start text-[#8e8e93] hover:bg-[#f5f5f5] hover:text-red-600 text-sm"
          >
            <Lock className="mr-2 h-4 w-4" />
            ออกจากระบบ
          </Button>
        </div>
      </div>

      {/* SavedIdeas Modal */}
      <SavedIdeas
        isOpen={savedIdeasModalOpen}
        onClose={() => setSavedIdeasModalOpen(false)}
        activeClientName={activeClientName}
        activeProductFocus={activeProductFocus}
        onViewDetails={() => {
          // Close modal when viewing details
          setSavedIdeasModalOpen(false)
        }}
      />
    </aside>
  )
}
