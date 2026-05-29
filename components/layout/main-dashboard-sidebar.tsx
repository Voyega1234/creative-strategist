"use client"

import Link from "next/link"
import type { Dispatch, SetStateAction } from "react"
import {
  ChevronUp,
  History,
  Home,
  Lock,
  Plus,
  RefreshCcw,
  Settings,
  User,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BRIEF_TEMPLATES } from "@/lib/ideas/generation-options"
import type { ClientWithProductFocus } from "@/lib/clients/client-selection"

type MainDashboardSidebarProps = {
  isGenerating: boolean
  isLoadingMore: boolean
  isNavigatingToNewClient: boolean
  isNavigatingToConfigure: boolean
  clientSearch: string
  setClientSearch: (value: string) => void
  isBrandOpen: boolean
  setIsBrandOpen: Dispatch<SetStateAction<boolean>>
  orderedClients: ClientWithProductFocus[]
  activeClientName: string
  activeProductFocus: string | null
  newServiceName: string
  setNewServiceName: (value: string) => void
  serviceError: string | null
  setServiceError: (value: string | null) => void
  isLoadingServices: boolean
  isAddingService: boolean
  clientServices: string[]
  selectedServices: string[]
  selectedServicesLabel: string
  isHistoryOpen: boolean
  setIsHistoryOpen: Dispatch<SetStateAction<boolean>>
  isLoadingSidebarHistory: boolean
  sidebarHistory: any[]
  onMainNavigation: () => void
  onNewClientNavigation: () => void
  onProductFocusChange: (clientName: string, productFocusValue: string) => void
  onAddService: () => void
  onServiceToggle: (service: string | null) => void
  onHistoryToggle: () => void
  onLoadSessionIdeas: (session: any) => void
  onConfigureNavigation: () => void
  onLogout: () => void
}

export function MainDashboardSidebar({
  isGenerating,
  isLoadingMore,
  isNavigatingToNewClient,
  isNavigatingToConfigure,
  clientSearch,
  setClientSearch,
  isBrandOpen,
  setIsBrandOpen,
  orderedClients,
  activeClientName,
  activeProductFocus,
  newServiceName,
  setNewServiceName,
  serviceError,
  setServiceError,
  isLoadingServices,
  isAddingService,
  clientServices,
  selectedServices,
  selectedServicesLabel,
  isHistoryOpen,
  setIsHistoryOpen,
  isLoadingSidebarHistory,
  sidebarHistory,
  onMainNavigation,
  onNewClientNavigation,
  onProductFocusChange,
  onAddService,
  onServiceToggle,
  onHistoryToggle,
  onLoadSessionIdeas,
  onConfigureNavigation,
  onLogout,
}: MainDashboardSidebarProps) {
  return (
    <aside
      className={`h-dvh w-[clamp(13.5rem,18vw,16rem)] shrink-0 bg-white/90 backdrop-blur-sm px-4 py-5 sm:p-6 border-r border-[#e4e7ec] flex flex-col overflow-hidden ${isGenerating ? "pointer-events-none opacity-60" : ""}`}
    >
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto pr-2">
          <div className="flex items-center gap-2 mb-8">
            <Button
              onClick={!isGenerating ? onMainNavigation : undefined}
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-[#535862] hover:text-[#1d4ed8] hover:bg-[#f5f5f5]"
              disabled={isGenerating}
            >
              <Home className="h-4 w-4" />
              <span className="sr-only">กลับหน้าหลัก</span>
            </Button>
            <h1 className="text-lg font-semibold text-[#000000]">Creative Compass</h1>
          </div>
          <Button
            onClick={!isGenerating && !isLoadingMore ? onNewClientNavigation : undefined}
            variant="ghost"
            className="mb-4 w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]"
            disabled={isGenerating || isLoadingMore || isNavigatingToNewClient}
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
            disabled={isGenerating}
          />
          <nav className="space-y-2">
            <Collapsible
              open={isBrandOpen}
              onOpenChange={isGenerating ? undefined : setIsBrandOpen}
              className="w-full"
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]"
                  disabled={isGenerating}
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
                  {orderedClients.length > 0 ? (
                    orderedClients.map((client) => (
                      <div key={client.id} className="space-y-1">
                        {isGenerating ? (
                          <div
                            className={`block text-sm py-1 px-2 rounded-md font-medium cursor-not-allowed ${
                              client.clientName === activeClientName
                                ? "text-[#063def] bg-[#dbeafe]"
                                : "text-[#535862]"
                            }`}
                          >
                            {client.clientName}
                          </div>
                        ) : (
                          <Link
                            href={`?clientId=${client.productFocuses[0]?.id || client.id}&clientName=${encodeURIComponent(client.clientName)}&productFocus=${encodeURIComponent(client.productFocuses[0]?.productFocus || "")}`}
                            className={`block text-sm py-1 px-2 rounded-md font-medium ${
                              client.clientName === activeClientName
                                ? "text-[#063def] bg-[#dbeafe]"
                                : "text-[#535862] hover:text-[#063def] hover:bg-[#dbeafe]"
                            }`}
                          >
                            {client.clientName}
                          </Link>
                        )}

                        {client.clientName === activeClientName && client.productFocuses.length >= 1 && (
                          <>
                            <div className="ml-4 mt-2 mb-2">
                              <Select
                                value={activeProductFocus || ""}
                                onValueChange={(value) =>
                                  onProductFocusChange(client.clientName, value)
                                }
                                disabled={isGenerating}
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
                              <div className="space-y-2">
                                <div className="flex items-center gap-1.5">
                                  <Input
                                    value={newServiceName}
                                    onChange={(event) => {
                                      setNewServiceName(event.target.value)
                                      if (serviceError) {
                                        setServiceError(null)
                                      }
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault()
                                        onAddService()
                                      }
                                    }}
                                    placeholder="เพิ่มบริการใหม่"
                                    disabled={isGenerating || isLoadingServices || isAddingService}
                                    className="h-7 text-[10px] px-2 py-1 border-[#d9dbe3] focus:border-[#1d4ed8] focus:ring-0 placeholder:text-[#a0a5b1] placeholder:text-[10px]"
                                  />
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-7 w-7 border-[#d9dbe3] text-[#535862] hover:text-[#1d4ed8]"
                                    onClick={onAddService}
                                    disabled={isGenerating || isLoadingServices || isAddingService}
                                  >
                                    {isAddingService ? (
                                      <span className="inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                                    ) : (
                                      <Plus className="h-3 w-3" />
                                    )}
                                  </Button>
                                </div>
                                {serviceError && (
                                  <p className="text-[10px] text-red-500">{serviceError}</p>
                                )}
                                {isLoadingServices ? (
                                  <div className="text-xs text-[#535862]">กำลังโหลดบริการ...</div>
                                ) : clientServices.length > 0 ? (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full justify-between text-xs border-[#e4e7ec] text-[#535862] hover:text-[#063def]"
                                        disabled={isGenerating || isLoadingServices}
                                      >
                                        <span className="truncate">{selectedServicesLabel}</span>
                                        <ChevronUp className="ml-2 h-3 w-3 rotate-180 opacity-60" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-64 max-h-60 overflow-y-auto" align="start">
                                      <DropdownMenuLabel className="text-xs text-[#535862]">
                                        เลือกบริการ
                                      </DropdownMenuLabel>
                                      <DropdownMenuItem
                                        className="text-xs text-[#1d4ed8] focus:text-[#1d4ed8]"
                                        onSelect={(event) => {
                                          event.preventDefault()
                                          onServiceToggle(null)
                                        }}
                                      >
                                        ล้างการเลือกทั้งหมด
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      {clientServices.map((service) => (
                                        <DropdownMenuCheckboxItem
                                          key={service}
                                          className="text-xs"
                                          checked={selectedServices.includes(service)}
                                          onCheckedChange={() => onServiceToggle(service)}
                                          onSelect={(event) => event.preventDefault()}
                                        >
                                          {service}
                                        </DropdownMenuCheckboxItem>
                                      ))}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                ) : (
                                  <div className="text-xs text-[#8e8e93]">ไม่มีข้อมูลบริการ</div>
                                )}
                              </div>
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
          <nav className="space-y-2">
            <Collapsible
              open={isHistoryOpen}
              onOpenChange={isGenerating ? undefined : setIsHistoryOpen}
              className="w-full"
            >
              <CollapsibleTrigger asChild>
                <Button
                  onClick={!isGenerating ? onHistoryToggle : undefined}
                  variant="ghost"
                  className="w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]"
                  disabled={isGenerating}
                >
                  {isLoadingSidebarHistory ? (
                    <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <History className="mr-2 h-4 w-4" />
                  )}
                  ประวัติการสร้าง
                  {isLoadingSidebarHistory && (
                    <span className="ml-1 text-xs text-[#1d4ed8]">(กำลังโหลด...)</span>
                  )}
                  <ChevronUp
                    className={`ml-auto h-4 w-4 transition-transform ${isHistoryOpen ? "rotate-0" : "rotate-180"}`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pl-8 pt-2">
                <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                  {isLoadingSidebarHistory ? (
                    <div className="text-[#535862] text-xs p-2">กำลังโหลด...</div>
                  ) : sidebarHistory.length > 0 ? (
                    sidebarHistory.map((session, index) => (
                      <button
                        key={session.id}
                        onClick={() => onLoadSessionIdeas(session)}
                        className="w-full text-left p-2 rounded-md hover:bg-[#dbeafe] hover:text-[#063def] transition-colors text-xs text-[#535862] border border-transparent hover:border-[#b692f6] mb-1 animate-in fade-in duration-1000 ease-out slide-in-from-left-10"
                        style={{ animationDelay: `${index * 120}ms`, animationFillMode: "both" }}
                      >
                        <div className="font-medium truncate">
                          {session.selectedTemplate
                            ? `${BRIEF_TEMPLATES.find((template) => template.id === session.selectedTemplate)?.title?.substring(0, 40)}...`
                            : session.userInput?.substring(0, 40) + "..." || "Custom Ideas"}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {session.ideasCount || 0} ideas •{" "}
                          {session.createdAt
                            ? new Date(session.createdAt).toLocaleDateString("th-TH")
                            : "Unknown date"}
                        </div>
                      </button>
                    ))
                  ) : activeClientName !== "No Client Selected" ? (
                    <div className="text-[#535862] text-xs p-2">ยังไม่มีประวัติการสร้างไอเดีย</div>
                  ) : (
                    <div className="text-[#535862] text-xs p-2">เลือกลูกค้าเพื่อดูประวัติ</div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
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
            onClick={!isGenerating && !isLoadingMore ? onConfigureNavigation : undefined}
            variant="ghost"
            className="w-full justify-start text-[#063def] hover:bg-[#f5f5f5] hover:text-[#1d4ed8] mb-2"
            disabled={isNavigatingToConfigure || isGenerating || isLoadingMore}
          >
            <Settings className="mr-2 h-4 w-4" />
            ตั้งค่าและวิเคราะห์
          </Button>
          <Button
            onClick={onLogout}
            variant="ghost"
            className="w-full justify-start text-[#8e8e93] hover:bg-[#f5f5f5] hover:text-red-600 text-sm"
          >
            <Lock className="mr-2 h-4 w-4" />
            ออกจากระบบ
          </Button>
        </div>
      </div>
    </aside>
  )
}
