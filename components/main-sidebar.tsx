"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link, { useLinkStatus } from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronUp, Plus, User, Bookmark, Settings, History, Images, Lock, Home, Loader2 } from "lucide-react"
import { SavedIdeas } from "./saved-ideas"
import type { ClientWithProductFocus } from "@/lib/client-options"
import { buildMissingClientOnboardingUrl, clientExistsInSystem } from "@/lib/client-options"

type SidebarMode = "configure" | "images" | "v2"

type SidebarSession = {
  id: string
  clientName: string
  productFocus: string
  userInput?: string
  ideasCount?: number
  createdAt?: string
  title?: string | null
  ideas?: unknown[]
  n8nResponse?: unknown
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
  mode?: SidebarMode
  showServiceFilters?: boolean
}

const ALL_SERVICES_VALUE = "__all_services__"

// Shows a spinner inside a <Link> while its navigation is pending,
// so switching client gives immediate feedback instead of a frozen UI.
function LinkPendingSpinner() {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-current" />
}

export function MainSidebar({
  clients, 
  activeClientName, 
  activeProductFocus, 
  activeClientId,
  activeClientServices = [],
  activeServiceFilter = null,
  showSecondaryNav = true,
  showHistory = true,
  mode = "configure",
  showServiceFilters = true,
}: MainSidebarProps) {
  const router = useRouter()
  const [, startNavigation] = useTransition()
  const [isBrandOpen, setIsBrandOpen] = useState(true)
  const [isHistoryOpen, setIsHistoryOpen] = useState(true)
  const [savedIdeasModalOpen, setSavedIdeasModalOpen] = useState(false)
  const [clientSearch, setClientSearch] = useState("")
  const [historySessions, setHistorySessions] = useState<SidebarSession[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const normalizedQuery = clientSearch.trim().toLowerCase()
  const filteredClients = useMemo(() => {
    if (!normalizedQuery) {
      return clients.filter(clientExistsInSystem)
    }
    return clients.filter((client) => client.clientName.toLowerCase().includes(normalizedQuery))
  }, [clients, normalizedQuery])
  const hasClientResults = filteredClients.length > 0

  const loadHistorySessions = useCallback(async () => {
    if (!showHistory || !activeClientName || activeClientName === "No Client Selected") {
      setHistorySessions([])
      return
    }

    setIsHistoryLoading(true)
    try {
      const params = new URLSearchParams({
        clientName: activeClientName,
        limit: "10",
        offset: "0",
        summary: "true",
        _ts: String(Date.now()),
      })
      const response = await fetch(`/api/session-history?${params.toString()}`, {
        cache: "no-store",
      })
      const result = await response.json()
      setHistorySessions(result?.success && Array.isArray(result.sessions) ? result.sessions : [])
    } catch (error) {
      setHistorySessions([])
    } finally {
      setIsHistoryLoading(false)
    }
  }, [activeClientName, showHistory])

  useEffect(() => {
    void loadHistorySessions()
  }, [loadHistorySessions])

  useEffect(() => {
    const handleRefresh = () => void loadHistorySessions()
    window.addEventListener("idea-session-saved", handleRefresh)
    window.addEventListener("idea-session-favorite-changed", handleRefresh)
    window.addEventListener("idea-session-renamed", handleRefresh)
    return () => {
      window.removeEventListener("idea-session-saved", handleRefresh)
      window.removeEventListener("idea-session-favorite-changed", handleRefresh)
      window.removeEventListener("idea-session-renamed", handleRefresh)
    }
  }, [loadHistorySessions])

  const handleHistorySessionClick = (session: SidebarSession) => {
    if (mode === "v2") {
      const params = new URLSearchParams()
      const client = clients.find((item) => item.clientName === session.clientName) || clients.find((item) => item.clientName === activeClientName)
      const focusEntry = client?.productFocuses.find((focus) => focus.productFocus === session.productFocus)
      params.set("clientName", session.clientName || activeClientName)
      if (session.productFocus || activeProductFocus) {
        params.set("productFocus", session.productFocus || activeProductFocus || "")
      }
      params.set("clientId", focusEntry?.id || activeClientId || client?.id || "")
      params.set("ideaSessionId", session.id)
      startNavigation(() => {
        router.push(`/?${params.toString()}`)
      })
    }
  }

  const formatHistoryDate = (value?: string) => {
    if (!value) return ""
    try {
      return new Intl.DateTimeFormat("th-TH", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    } catch {
      return ""
    }
  }

  const getHistoryTitle = (session: SidebarSession) => {
    const title = session.title || session.userInput || "Concept ideas"
    return title.length > 46 ? `${title.slice(0, 46)}...` : title
  }

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
    if (mode === "v2") {
      const params = new URLSearchParams()
      if (activeClientId) params.set("clientId", activeClientId)
      if (activeClientName && activeClientName !== "No Client Selected") params.set("clientName", activeClientName)
      if (activeProductFocus) params.set("productFocus", activeProductFocus)
      router.push(`/${params.toString() ? `?${params.toString()}` : ""}`)
      return
    }

    const mainUrl = `/${activeClientName && activeClientName !== "No Client Selected" 
      ? `?clientName=${encodeURIComponent(activeClientName)}${activeProductFocus ? `&productFocus=${encodeURIComponent(activeProductFocus)}` : ''}` 
      : ''}`
    router.push(mainUrl)
  }

  const handleConfigureNavigation = () => {
    if (mode === "v2") {
      const params = new URLSearchParams()
      if (activeClientId) params.set("clientId", activeClientId)
      if (activeClientName && activeClientName !== "No Client Selected") params.set("clientName", activeClientName)
      if (activeProductFocus) params.set("productFocus", activeProductFocus)
      router.push(`/${params.toString() ? `?${params.toString()}` : ""}`)
      return
    }

    const configureUrl = `/configure${activeClientId ? `?clientId=${encodeURIComponent(activeClientId)}${activeClientName ? `&clientName=${encodeURIComponent(activeClientName)}` : ''}${activeProductFocus ? `&productFocus=${encodeURIComponent(activeProductFocus)}` : ''}` : ''}`
    router.push(configureUrl)
  }

  const buildClientUrl = (client: ClientWithProductFocus) => {
    if (!clientExistsInSystem(client)) {
      return buildMissingClientOnboardingUrl(client.clientName)
    }

    if (mode === "images") {
      const firstFocus = client.productFocuses[0]
      const params = new URLSearchParams()
      params.set("clientName", client.clientName)
      if (firstFocus?.productFocus) {
        params.set("productFocus", firstFocus.productFocus)
      }
      params.set("clientId", firstFocus?.id || client.id)
      return `/images?${params.toString()}`
    }
    if (mode === "v2") {
      const firstFocus = client.productFocuses[0]
      const params = new URLSearchParams()
      params.set("clientId", firstFocus?.id || client.id)
      params.set("clientName", client.clientName)
      if (firstFocus?.productFocus) {
        params.set("productFocus", firstFocus.productFocus)
      }
      return `/?${params.toString()}`
    }
    const params = new URLSearchParams()
    params.set("clientId", client.id)
    params.set("clientName", client.clientName)
    if (client.productFocuses[0]?.productFocus) {
      params.set("productFocus", client.productFocuses[0].productFocus)
    }
    return `/configure?${params.toString()}`
  }

  const handleProductFocusChange = (clientName: string, productFocus: string) => {
    const client = clients.find(c => c.clientName === clientName)
    const clientId = client?.id
    if (!client || !clientId) return
    const productFocusEntry = client.productFocuses.find((pf) => pf.productFocus === productFocus)
    if (mode === "images") {
      const targetId = productFocusEntry?.id || clientId
      router.push(`/images?clientId=${targetId}&clientName=${encodeURIComponent(clientName)}&productFocus=${encodeURIComponent(productFocus)}`)
    } else if (mode === "v2") {
      const targetId = productFocusEntry?.id || clientId
      startNavigation(() => {
        router.push(`/?clientId=${targetId}&clientName=${encodeURIComponent(clientName)}&productFocus=${encodeURIComponent(productFocus)}`)
      })
    } else {
      router.push(`/configure?clientId=${clientId}&clientName=${encodeURIComponent(clientName)}&productFocus=${encodeURIComponent(productFocus)}`)
    }
  }

  const handleServiceFilterChange = (value: string) => {
    if (!activeClientId || mode !== "configure") {
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
    try {
      localStorage.removeItem("creative_strategist_auth")
    } catch (error) {
      console.error("Error clearing auth on logout:", error)
    }
    router.push("/login")
  }

  const isV2Mode = mode === "v2"
  const shellClassName = isV2Mode
    ? "h-dvh w-[clamp(13.5rem,18vw,16rem)] shrink-0 bg-white/95 px-4 py-5 sm:p-6 border-r border-black/10 shadow-[12px_0_35px_rgba(15,23,42,0.06)] flex flex-col overflow-hidden"
    : "h-dvh w-[clamp(13.5rem,18vw,16rem)] shrink-0 bg-white/90 backdrop-blur-sm px-4 py-5 sm:p-6 border-r border-[#e4e7ec] flex flex-col overflow-hidden"
  const iconButtonClassName = isV2Mode
    ? "h-8 w-8 text-[#667085] hover:text-[#111827] hover:bg-white/70"
    : "h-8 w-8 text-[#535862] hover:text-[#1d4ed8] hover:bg-[#f5f5f5]"
  const sidebarButtonClassName = isV2Mode
    ? "w-full justify-start text-[#667085] hover:bg-white/70 hover:text-[#111827]"
    : "w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]"
  const activeItemClassName = isV2Mode
    ? "text-[#111827] bg-white/80 shadow-sm ring-1 ring-black/5"
    : "text-[#063def] bg-[#dbeafe]"
  const enabledItemClassName = isV2Mode
    ? "text-[#667085] hover:text-[#111827] hover:bg-white/70"
    : "text-[#535862] hover:text-[#063def] hover:bg-[#dbeafe]"
  const disabledItemClassName = isV2Mode
    ? "text-[#a0a5b1] hover:text-[#667085] hover:bg-white/55"
    : "text-[#a0a5b1] hover:text-[#8e8e93] hover:bg-[#f5f5f5]"
  const inputClassName = isV2Mode
    ? "mb-4 h-9 text-sm border-black/10 bg-white shadow-sm focus-visible:ring-0 focus-visible:border-[#111827]"
    : "mb-4 h-9 text-sm border-[#e4e7ec] focus-visible:ring-0 focus-visible:border-[#1d4ed8]"
  const selectTriggerClassName = isV2Mode
    ? "w-full h-8 text-xs bg-white border-black/10 hover:border-[#111827] focus:border-[#111827]"
    : "w-full h-8 text-xs bg-white border-[#e4e7ec] hover:border-[#1d4ed8] focus:border-[#1d4ed8]"

  return (
    <aside className={shellClassName}>
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto pr-2">
          <div className="flex items-center gap-2 mb-8">
            <Button
              onClick={handleMainNavigation}
              size="icon"
              variant="ghost"
                className={iconButtonClassName}
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
              className={`mb-4 ${sidebarButtonClassName}`}
            >
              <Plus className="mr-2 h-4 w-4" />
              เพิ่มรายชื่อ
            </Button>
            <Input
              type="search"
              value={clientSearch}
              onChange={(event) => setClientSearch(event.target.value)}
              placeholder="ค้นหาชื่อลูกค้า"
              className={inputClassName}
            />
            <Collapsible open={isBrandOpen} onOpenChange={setIsBrandOpen} className="w-full">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className={sidebarButtonClassName}
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
                        {(() => {
                          const existsInSystem = clientExistsInSystem(client)

                          return (
                            <>
                        {/* Client name - always show, highlight if active */}
                        <Link
                          href={buildClientUrl(client)}
                          className={`flex items-center justify-between gap-2 text-sm py-1 px-2 rounded-md font-medium ${
	                            client.clientName === activeClientName
	                              ? activeItemClassName
	                              : existsInSystem
	                                ? enabledItemClassName
	                                : disabledItemClassName
                          }`}
                        >
                          <span className="block truncate">{client.clientName}</span>
                          <LinkPendingSpinner />
                        </Link>
                        
                        {/* Show product focus select ONLY for the selected/active client */}
                        {existsInSystem && client.clientName === activeClientName && client.productFocuses.length >= 1 && (
                          <>
                            <div className="ml-4 mt-2 mb-2">
                              <Select
                                value={activeProductFocus || ""}
                                onValueChange={(value) => handleProductFocusChange(client.clientName, value)}
                              >
	                                <SelectTrigger className={selectTriggerClassName}>
                                  <SelectValue placeholder="เลือก Product Focus" />
                                </SelectTrigger>
                                <SelectContent className="max-h-48 overflow-y-auto">
                                  {client.productFocuses.map((pf) => (
                                    <SelectItem key={pf.id} value={pf.productFocus} className="text-xs">
                                      {pf.productFocus}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {showServiceFilters && (
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
	                                    <SelectTrigger className={selectTriggerClassName}>
                                      <SelectValue placeholder="Services" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-48 overflow-y-auto">
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
                            )}
                          </>
                        )}
                            </>
                          )
                        })()}
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-[#8e8e93] p-2">ไม่พบลูกค้าตามการค้นหา</div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </nav>
          <div className={`my-4 border-t ${isV2Mode ? "border-white/70" : "border-[#e4e7ec]"}`} />
          <nav className="space-y-2 pb-2">
            {showSecondaryNav && (
              <>
                <Button
                  onClick={handleMainNavigation}
                  variant="ghost"
	                className={sidebarButtonClassName}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  หน้าหลัก
                </Button>
                <Button
                  onClick={() => setSavedIdeasModalOpen(true)}
                  variant="ghost"
	                  className={sidebarButtonClassName}
                >
                  <Bookmark className="mr-2 h-4 w-4" />
                  รายการที่บันทึก
                </Button>
                <Button
                  onClick={handleImagesNavigation}
                  variant="ghost"
	                  className={sidebarButtonClassName}
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
	                    className={sidebarButtonClassName}
                  >
                    <History className="mr-2 h-4 w-4" />
                    ประวัติการสร้าง
                    <ChevronUp
                      className={`ml-auto h-4 w-4 transition-transform ${isHistoryOpen ? "rotate-0" : "rotate-180"}`}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 pl-8 pt-2">
                  {isHistoryLoading ? (
                    <div className={`flex items-center gap-2 text-[#535862] text-xs p-2 rounded-md border ${isV2Mode ? "bg-white/70 border-white/70 shadow-sm" : "bg-white/70 border-[#e4e7ec]"}`}>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      กำลังโหลดประวัติ
                    </div>
                  ) : historySessions.length > 0 ? (
                    <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                      {historySessions.map((session) => (
                        <button
                          key={session.id}
                          type="button"
                          onClick={() => handleHistorySessionClick(session)}
                          className={`w-full rounded-lg border p-2 text-left text-xs transition ${
                            isV2Mode
                              ? "border-white/70 bg-white/70 text-[#535862] shadow-sm hover:border-black/10 hover:bg-white hover:text-[#111827]"
                              : "border-[#e4e7ec] bg-white/70 text-[#535862] hover:bg-[#f5f5f5] hover:text-[#063def]"
                          }`}
                        >
                          <span className="block truncate font-medium">{getHistoryTitle(session)}</span>
                          <span className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[#8e8e93]">
                            <span className="truncate">{session.productFocus || "No product focus"}</span>
                            <span className="shrink-0">{session.ideasCount || 0} ideas</span>
                          </span>
                          {session.createdAt && (
                            <span className="mt-1 block text-[10px] text-[#a0a5b1]">
                              {formatHistoryDate(session.createdAt)}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className={`text-[#535862] text-xs p-2 rounded-md border ${isV2Mode ? "bg-white/70 border-white/70 shadow-sm" : "bg-white/70 border-[#e4e7ec]"}`}>
                      {activeClientName && activeClientName !== "No Client Selected"
                        ? "ยังไม่มีประวัติการสร้างไอเดีย"
                        : "เลือกลูกค้าเพื่อดูประวัติ"}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}
          </nav>
        </div>
        <div className={`border-t mt-4 pt-4 ${isV2Mode ? "border-white/70" : "border-[#e4e7ec]"}`}>
          <div className="flex items-center space-x-3 p-2 mb-2">
            <Avatar className="h-8 w-8 bg-[#1d4ed8] text-[#ffffff] font-bold">
              <AvatarFallback>A</AvatarFallback>
            </Avatar>
            <span className="text-[#000000] font-medium">Admin</span>
          </div>
          <Button
            onClick={handleConfigureNavigation}
            variant="ghost"
            className={isV2Mode ? "w-full justify-start text-[#111827] hover:bg-white/70 hover:text-[#111827] mb-2" : "w-full justify-start text-[#063def] hover:bg-[#f5f5f5] hover:text-[#1d4ed8] mb-2"}
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
        activeProductFocus={activeProductFocus ?? undefined}
        onViewDetails={() => {
          // Close modal when viewing details
          setSavedIdeasModalOpen(false)
        }}
      />
    </aside>
  )
}
