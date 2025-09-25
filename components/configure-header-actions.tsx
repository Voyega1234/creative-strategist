"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { SavedIdeas } from "@/components/saved-ideas"
import { Plus, Bookmark, Images } from "lucide-react"

type ConfigureHeaderActionsProps = {
  activeClientName: string | null
  activeProductFocus: string | null
  activeClientId: string | null
}

export function ConfigureHeaderActions({
  activeClientName,
  activeProductFocus,
  activeClientId,
}: ConfigureHeaderActionsProps) {
  const router = useRouter()
  const [isNavigatingToNewClient, setIsNavigatingToNewClient] = useState(false)
  const [isNavigatingToImages, setIsNavigatingToImages] = useState(false)
  const [savedIdeasOpen, setSavedIdeasOpen] = useState(false)

  const normalizedClientName = activeClientName ?? "No Client Selected"
  const normalizedProductFocus = activeProductFocus ?? null
  const savedIdeasProductFocus = normalizedProductFocus ?? undefined

  const buildQueryParams = () => {
    if (!normalizedClientName || normalizedClientName === "No Client Selected") {
      return ""
    }
    const params = new URLSearchParams({ clientName: normalizedClientName })
    if (normalizedProductFocus) {
      params.set("productFocus", normalizedProductFocus)
    }
    if (activeClientId) {
      params.set("clientId", activeClientId)
    }
    const query = params.toString()
    return query ? `?${query}` : ""
  }

  const handleNewClientNavigation = async () => {
    setIsNavigatingToNewClient(true)
    try {
      router.push("/new-client")
    } finally {
      // keep disabled state until navigation resolves
    }
  }

  const handleImagesNavigation = async () => {
    setIsNavigatingToImages(true)
    const query = buildQueryParams()
    router.push(`/images${query}`)
  }

  return (
    <>
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
          onClick={() => setSavedIdeasOpen(true)}
          size="sm"
          variant="outline"
          className="text-xs text-[#063def] border-[#d1d5db] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]"
        >
          <Bookmark className="mr-2 h-3 w-3" />
          รายการที่บันทึก
        </Button>
        <Button
          onClick={handleImagesNavigation}
          size="sm"
          variant="outline"
          className="text-xs text-[#063def] border-[#d1d5db] hover:bg-[#f5f5f5] hover:text-[#1d4ed8]"
          disabled={isNavigatingToImages}
        >
          <Images className="mr-2 h-3 w-3" />
          ค้นและสร้างภาพ
        </Button>
      </div>

      <SavedIdeas
        isOpen={savedIdeasOpen}
        onClose={() => setSavedIdeasOpen(false)}
        activeClientName={normalizedClientName}
        activeProductFocus={savedIdeasProductFocus}
        onViewDetails={() => {
          setSavedIdeasOpen(false)
        }}
      />
    </>
  )
}
