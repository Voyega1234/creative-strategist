"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronUp, Plus, User, Bookmark, Settings, History, Images, Lock } from "lucide-react"
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
}

export function MainSidebar({ 
  clients, 
  activeClientName, 
  activeProductFocus, 
  activeClientId 
}: MainSidebarProps) {
  const router = useRouter()
  const [isBrandOpen, setIsBrandOpen] = useState(true)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [savedIdeasModalOpen, setSavedIdeasModalOpen] = useState(false)


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

  const handleProductFocusChange = (clientName: string, productFocus: string) => {
    router.push(`/configure?clientName=${encodeURIComponent(clientName)}&productFocus=${encodeURIComponent(productFocus)}`)
  }

  const handleLogout = () => {
    // Add logout logic here
  }

  return (
    <aside className="w-64 bg-white/90 backdrop-blur-sm p-6 border-r border-white/20 flex flex-col justify-between">
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
                {clients.map((client) => (
                  <div key={client.id} className="space-y-1">
                    {/* Client name - always show, highlight if active */}
                    <Link
                      href={`/configure?clientName=${encodeURIComponent(client.clientName)}&productFocus=${encodeURIComponent(client.productFocuses[0]?.productFocus || '')}`}
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
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
          <Button
            onClick={handleNewClientNavigation}
            variant="ghost"
            className="w-full justify-start text-[#535862] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]"
          >
            <Plus className="mr-2 h-4 w-4" />
            เพิ่มรายชื่อ
          </Button>
        </nav>
        <div className="my-4 border-t border-[#e4e7ec]" />
        <nav className="space-y-2">
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
          <Button
            variant="ghost"
            className="w-full justify-start text-[#063def] bg-[#dbeafe] hover:bg-[#dbeafe] hover:text-[#063def]"
          >
            <Settings className="mr-2 h-4 w-4" />
            ตั้งค่าและวิเคราะห์
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
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start text-[#8e8e93] hover:bg-[#f5f5f5] hover:text-red-600 text-sm"
        >
          <Lock className="mr-2 h-4 w-4" />
          ออกจากระบบ
        </Button>
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